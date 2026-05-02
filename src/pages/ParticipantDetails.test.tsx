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
} = {}) {
  const participant = createTestParticipant({
    custom_fields: {
      Miasto: "Warszawa",
    },
  });
  const event = createTestEvent();
  const sendParticipantQrEmail = options.sendParticipantQrEmail ?? vi.fn(async () => ({ ok: true }));
  const deleteParticipant = options.deleteParticipant ?? vi.fn(async () => ({ ok: true }));

  useDataMock.mockReturnValue({
    participants: [participant],
    events: [event],
    activityLog: [createTestActivityLog()],
    currentRole: "admin",
    updateParticipantStatus: vi.fn(async () => ({ ok: true })),
    updateParticipantBibNumber: vi.fn(async () => ({ ok: true })),
    updateParticipantDetails: vi.fn(async () => ({ ok: true })),
    getParticipantFieldMappings: vi.fn(async () => [
      createTestParticipantMapping({ alias: "Miasto" }),
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

  return { sendParticipantQrEmail, deleteParticipant };
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
});
