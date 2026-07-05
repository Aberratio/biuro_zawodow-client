import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import ParticipantDetails from "@/pages/ParticipantDetails";
import { toast } from "@/hooks/use-toast";
import {
  createTestActivityLog,
  createTestEvent,
  createTestParticipant,
  createTestParticipantMapping,
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

vi.mock("@/components/ParticipantBibNumberConflictDialog", () => ({
  ParticipantBibNumberConflictDialog: () => null,
}));

function renderPage(options: {
  sendParticipantQrEmail?: ReturnType<typeof vi.fn>;
  deleteParticipant?: ReturnType<typeof vi.fn>;
  updateParticipantDetails?: ReturnType<typeof vi.fn>;
  mappings?: ReturnType<typeof createTestParticipantMapping>[];
  customFields?: Record<string, string>;
} = {}) {
  const participant = createTestParticipant({
    custom_fields: {
      Miasto: "Warszawa",
      ...(options.customFields ?? {}),
    },
  });
  const event = createTestEvent();
  const sendParticipantQrEmail = options.sendParticipantQrEmail ?? vi.fn(async () => ({ ok: true }));
  const deleteParticipant = options.deleteParticipant ?? vi.fn(async () => ({ ok: true }));
  const updateParticipantDetails = options.updateParticipantDetails ?? vi.fn(async () => ({ ok: true }));

  useDataMock.mockReturnValue({
    participants: [participant],
    events: [event],
    activityLog: [createTestActivityLog()],
    currentRole: "admin",
    updateParticipantStatus: vi.fn(async () => ({ ok: true })),
    updateParticipantBibNumber: vi.fn(async () => ({ ok: true })),
    updateParticipantDetails,
    getParticipantFieldMappings: vi.fn(async () => [
      ...(options.mappings ?? [createTestParticipantMapping({ alias: "Miasto" })]),
    ]),
    sendParticipantQrEmail,
    deleteParticipant,
    getParticipantQrPreview: vi.fn(async () => ({
      participant,
      event,
      qr_code_svg_data_uri: "data:image/svg+xml;base64,PHN2Zy8+",
      qr_code_image_url: "https://example.com/qr.svg",
    })),
    isLoading: false,
    connectionState: "online",
  });

  render(
    <MemoryRouter initialEntries={["/events/event-1/participants/p-1"]}>
      <Routes>
        <Route path="/events/:id/participants/:participantId" element={<ParticipantDetails />} />
        <Route path="/events/:id/participants" element={<div data-testid="participants-route" />} />
      </Routes>
    </MemoryRouter>,
  );

  return { sendParticipantQrEmail, deleteParticipant, updateParticipantDetails };
}

describe("ParticipantDetails page", () => {
  beforeEach(() => {
    useDataMock.mockReset();
    vi.mocked(toast).mockReset();
  });

  it("confirms and sends a QR email for the participant", async () => {
    const { sendParticipantQrEmail } = renderPage();

    fireEvent.click(screen.getByRole("button", { name: "Wyślij QR" }));
    fireEvent.click(screen.getByRole("button", { name: "Wyślij mail" }));

    await waitFor(() => {
      expect(sendParticipantQrEmail).toHaveBeenCalledWith("p-1");
    });
    expect(toast).toHaveBeenCalledWith(expect.objectContaining({
      title: "Mail z QR wysłany",
    }));
  });

  it("confirms participant deletion and navigates back to the participant list", async () => {
    const { deleteParticipant } = renderPage();

    fireEvent.click(screen.getByRole("button", { name: "Usuń uczestnika" }));
    const deleteButtons = screen.getAllByRole("button", { name: "Usuń uczestnika" });
    fireEvent.click(deleteButtons[deleteButtons.length - 1]);

    await waitFor(() => {
      expect(deleteParticipant).toHaveBeenCalledWith("p-1");
    });
    expect(await screen.findByTestId("participants-route")).toBeInTheDocument();
  });

  it("asks before leaving with unsaved participant status or number changes", async () => {
    const confirmSpy = vi.spyOn(window, "confirm").mockReturnValue(false);
    renderPage();

    fireEvent.change(screen.getByLabelText("Numer startowy"), {
      target: { value: "202" },
    });

    fireEvent.click(screen.getAllByRole("button")[0]);

    expect(confirmSpy).toHaveBeenCalledWith(
      expect.stringContaining("niezapisane zmiany"),
    );
    expect(screen.queryByTestId("participants-route")).not.toBeInTheDocument();

    confirmSpy.mockReturnValue(true);
    fireEvent.click(screen.getAllByRole("button")[0]);

    expect(await screen.findByTestId("participants-route")).toBeInTheDocument();
    confirmSpy.mockRestore();
  });

  it("renders typed edit fields and validates configured rules before submit", async () => {
    const updateParticipantDetails = vi.fn(async () => ({ ok: true }));
    renderPage({
      updateParticipantDetails,
      customFields: {
        Dystans: "5K",
        Wiek: "20",
      },
      mappings: [
        createTestParticipantMapping({
          source_column_name: "distance",
          alias: "Dystans",
          field_type: "select",
          validation_rules: { options: ["5K", "10K"] },
        }),
        createTestParticipantMapping({
          source_column_name: "age",
          alias: "Wiek",
          field_type: "number",
          validation_rules: { min: 18, max: 80 },
          is_required: true,
        }),
      ],
    });

    fireEvent.click(await screen.findByRole("button", { name: "Edytuj dane uczestnika" }));

    const ageInput = screen.getByLabelText("Wiek") as HTMLInputElement;
    expect(ageInput.type).toBe("number");

    fireEvent.change(ageInput, { target: { value: "17" } });
    fireEvent.click(screen.getByRole("button", { name: "Zapisz zmiany" }));

    expect(await screen.findByText("Pole Wiek musi mieć wartość nie mniejszą niż 18.")).toBeInTheDocument();
    expect(updateParticipantDetails).not.toHaveBeenCalled();

    fireEvent.change(ageInput, { target: { value: "21" } });
    fireEvent.click(screen.getByRole("combobox", { name: "Dystans" }));
    fireEvent.click(await screen.findByRole("option", { name: "10K" }));
    fireEvent.click(screen.getByRole("button", { name: "Zapisz zmiany" }));

    await waitFor(() => {
      expect(updateParticipantDetails).toHaveBeenCalledWith("p-1", "anna@example.com", expect.objectContaining({
        Dystans: "10K",
        Wiek: "21",
      }));
    });
  });
});
