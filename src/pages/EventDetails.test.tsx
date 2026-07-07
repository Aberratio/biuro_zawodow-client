import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import EventDetails from "@/pages/EventDetails";
import {
  createTestEvent,
  createTestParticipantMapping,
  createTestUser,
} from "@/test/factories";

const useDataMock = vi.fn();

vi.mock("@/contexts/DataContext", () => ({
  useData: () => useDataMock(),
}));

vi.mock("@/hooks/use-route-event-context", () => ({
  useRouteEventContext: vi.fn(),
}));

vi.mock("@/hooks/use-toast", () => ({
  toast: vi.fn(),
}));

function renderPage(options: {
  addParticipantManually?: ReturnType<typeof vi.fn>;
  event?: ReturnType<typeof createTestEvent>;
  resetTestEvent?: ReturnType<typeof vi.fn>;
} = {}) {
  const event = options.event ?? createTestEvent();
  const addParticipantManually = options.addParticipantManually ?? vi.fn(async () => ({ ok: true }));
  const resetTestEvent = options.resetTestEvent ?? vi.fn(async () => ({ ok: true }));

  useDataMock.mockReturnValue({
    events: [event],
    archivedEvents: [],
    participants: [],
    users: [],
    currentRole: "admin",
    currentUser: createTestUser({ role: "admin", organization_id: event.organization_id }),
    setSelectedEventId: vi.fn(),
    isLoading: false,
    getParticipantFieldMappingsState: vi.fn(async () => ({
      has_mapping: true,
      has_baseline_import: false,
      mappings: [
        createTestParticipantMapping({
          source_column_name: "name",
          alias: "Imię",
          field_role: "display_name_part",
          is_required: true,
        }),
        createTestParticipantMapping({
          source_column_name: "distance",
          alias: "Dystans",
          field_type: "select",
          validation_rules: { options: ["5K", "10K"] },
          is_required: true,
        }),
        createTestParticipantMapping({
          source_column_name: "age",
          alias: "Wiek",
          field_type: "number",
          validation_rules: { min: 18, max: 80 },
          is_required: true,
        }),
      ],
    })),
    updateParticipantFieldMappings: vi.fn(async () => ({ ok: true, mappings: [], has_baseline_import: false })),
    addParticipantManually,
    addUser: vi.fn(async () => ({ ok: true })),
    assignScannerEvents: vi.fn(async () => ({ ok: true })),
    updateEvent: vi.fn(async () => ({ ok: true })),
    resetTestEvent,
    archiveEvent: vi.fn(async () => ({ ok: true })),
    deleteEvent: vi.fn(async () => ({ ok: true })),
    exportEventCsv: vi.fn(async () => ({ ok: true })),
    exportEventLogsCsv: vi.fn(async () => ({ ok: true })),
    exportEventParticipantChangesCsv: vi.fn(async () => ({ ok: true })),
    connectionState: "online",
  });

  render(
    <MemoryRouter initialEntries={["/events/event-1"]}>
      <Routes>
        <Route path="/events/:id" element={<EventDetails />} />
      </Routes>
    </MemoryRouter>,
  );

  return { addParticipantManually, resetTestEvent };
}

describe("EventDetails page", () => {
  beforeEach(() => {
    useDataMock.mockReset();
  });

  it("validates configured manual participant fields before creating a participant", async () => {
    const addParticipantManually = vi.fn(async () => ({ ok: true }));
    renderPage({ addParticipantManually });

    const participantSectionButtons = await screen.findAllByRole("button", { name: "Uczestnicy" });
    const participantSectionToggle = participantSectionButtons.find((button) => button.getAttribute("aria-expanded") === "false");
    expect(participantSectionToggle).toBeDefined();
    fireEvent.click(participantSectionToggle as HTMLElement);
    fireEvent.click(await screen.findByRole("button", { name: "Dodaj uczestnika ręcznie" }));

    fireEvent.change(screen.getByLabelText("Email"), { target: { value: "anna@example.com" } });
    fireEvent.change(screen.getByLabelText("Imię"), { target: { value: "Anna" } });
    fireEvent.change(screen.getByLabelText("Wiek"), { target: { value: "17" } });
    fireEvent.click(screen.getByRole("button", { name: "Zapisz uczestnika" }));

    expect(await screen.findByText("Pole Wiek musi mieć wartość nie mniejszą niż 18.")).toBeInTheDocument();
    expect(addParticipantManually).not.toHaveBeenCalled();

    fireEvent.change(screen.getByLabelText("Wiek"), { target: { value: "21" } });
    fireEvent.click(screen.getByRole("combobox", { name: "Dystans" }));
    fireEvent.click(await screen.findByRole("option", { name: "10K" }));
    fireEvent.click(screen.getByRole("button", { name: "Zapisz uczestnika" }));

    await waitFor(() => {
      expect(addParticipantManually).toHaveBeenCalledWith("event-1", "anna@example.com", expect.objectContaining({
        "Imię": "Anna",
        Dystans: "10K",
        Wiek: "21",
      }));
    });
  });

  it("shows test mode controls and resets sandbox data after confirmation", async () => {
    const resetTestEvent = vi.fn(async () => ({ ok: true }));
    renderPage({
      event: createTestEvent({ is_test: true }),
      resetTestEvent,
    });

    expect(await screen.findByText("Tryb testowy")).toBeInTheDocument();

    const adminSectionButtons = await screen.findAllByRole("button", { name: "Administracja" });
    const adminSectionToggle = adminSectionButtons.find((button) => button.getAttribute("aria-expanded") === "false");
    expect(adminSectionToggle).toBeDefined();
    fireEvent.click(adminSectionToggle as HTMLElement);

    fireEvent.click(await screen.findByRole("button", { name: "Resetuj dane testowe" }));
    fireEvent.click(await screen.findByRole("button", { name: "Resetuj dane" }));

    await waitFor(() => {
      expect(resetTestEvent).toHaveBeenCalledWith("event-1");
    });
  });
});
