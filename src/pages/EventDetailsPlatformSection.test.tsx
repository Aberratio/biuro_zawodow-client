import { fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import EventDetails from "@/pages/EventDetails";
import { createTestEvent, createTestUser } from "@/test/factories";

const useDataMock = vi.fn();
const SECTION_TITLE = "Integracja z platformą Zmierzymy Czas";

vi.mock("@/contexts/DataContext", () => ({
  useData: () => useDataMock(),
}));

vi.mock("@/hooks/use-route-event-context", () => ({
  useRouteEventContext: vi.fn(),
}));

vi.mock("@/hooks/use-toast", () => ({
  toast: vi.fn(),
}));

vi.mock("@/components/EventPlatformConnectionSection", () => ({
  EventPlatformConnectionSection: () => (
    <div data-testid="platform-connection-section" />
  ),
}));

function renderPage(role: "admin" | "scanner") {
  const event = createTestEvent();
  const ok = vi.fn(async () => ({ ok: true }));

  useDataMock.mockReturnValue({
    events: [event],
    archivedEvents: [],
    participants: [],
    users: [],
    currentRole: role,
    currentUser: createTestUser({
      role,
      organization_id: event.organization_id,
    }),
    setSelectedEventId: vi.fn(),
    isLoading: false,
    getParticipantFieldMappingsState: vi.fn(async () => ({
      has_mapping: true,
      has_baseline_import: false,
      mappings: [],
    })),
    updateParticipantFieldMappings: vi.fn(async () => ({
      ok: true,
      mappings: [],
      has_baseline_import: false,
    })),
    addParticipantManually: ok,
    addUser: ok,
    assignScannerEvents: ok,
    updateEvent: ok,
    resetTestEvent: ok,
    archiveEvent: ok,
    deleteEvent: ok,
    exportEventCsv: ok,
    exportEventLogsCsv: ok,
    exportEventParticipantChangesCsv: ok,
    connectionState: "online",
  });

  render(
    <MemoryRouter initialEntries={["/events/event-1"]}>
      <Routes>
        <Route path="/events/:id" element={<EventDetails />} />
      </Routes>
    </MemoryRouter>
  );

  return event;
}

describe("EventDetails platform integration section", () => {
  beforeEach(() => {
    useDataMock.mockReset();
  });

  it("renders the platform integration section for an admin", async () => {
    renderPage("admin");

    const toggle = await screen.findByRole("button", { name: SECTION_TITLE });
    expect(toggle).toHaveAttribute("aria-expanded", "false");
    fireEvent.click(toggle);

    expect(
      await screen.findByTestId("platform-connection-section")
    ).toBeInTheDocument();
  });

  it("hides the platform integration section for a scanner", async () => {
    const event = renderPage("scanner");

    await screen.findAllByText(event.name);
    expect(screen.queryByTestId("platform-connection-section")).toBeNull();
    expect(screen.queryByRole("button", { name: SECTION_TITLE })).toBeNull();
  });
});
