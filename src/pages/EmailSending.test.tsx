import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import EmailSending from "@/pages/EmailSending";
import { toast } from "@/hooks/use-toast";
import {
  createTestActivityLog,
  createTestEvent,
  createTestParticipant,
} from "@/test/factories";
import type { ConnectionState, Participant } from "@/types";

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

function findButtonByText(text: string) {
  const button = screen
    .getAllByRole("button")
    .find((element) => element.textContent?.includes(text));

  expect(button).toBeDefined();
  return button as HTMLButtonElement;
}

function renderPage(options: {
  participants?: Participant[];
  connectionState?: ConnectionState;
  sendEventQrEmails?: ReturnType<typeof vi.fn>;
  sendParticipantQrEmail?: ReturnType<typeof vi.fn>;
} = {}) {
  const sendEventQrEmails = options.sendEventQrEmails ?? vi.fn(async () => ({
    ok: true,
    sent_count: 2,
    error_count: 0,
    errors: [],
  }));
  const sendParticipantQrEmail = options.sendParticipantQrEmail ?? vi.fn(async () => ({
    ok: true,
  }));

  useDataMock.mockReturnValue({
    participants: options.participants ?? [
      createTestParticipant({ id: "p-1", email_status: "not_sent" }),
      createTestParticipant({
        id: "p-2",
        name: "Jan Nowak",
        email: "jan@example.com",
        email_status: "not_sent",
      }),
    ],
    activityLog: [createTestActivityLog()],
    events: [createTestEvent()],
    selectedEventId: "event-1",
    sendEventQrEmails,
    sendParticipantQrEmail,
    isLoading: false,
    connectionState: options.connectionState ?? "online",
  });

  render(
    <MemoryRouter initialEntries={["/events/event-1/emails"]}>
      <Routes>
        <Route path="/events/:id/emails" element={<EmailSending />} />
      </Routes>
    </MemoryRouter>,
  );

  return { sendEventQrEmails, sendParticipantQrEmail };
}

describe("EmailSending page", () => {
  beforeEach(() => {
    useDataMock.mockReset();
    vi.mocked(toast).mockReset();
  });

  it("confirms and sends missing QR emails for the current event", async () => {
    const { sendEventQrEmails } = renderPage();

    fireEvent.click(findButtonByText("wszystkich"));
    fireEvent.click(findButtonByText("mail"));

    await waitFor(() => {
      expect(sendEventQrEmails).toHaveBeenCalledWith("event-1", false);
    });
    expect(toast).toHaveBeenCalledWith(expect.objectContaining({
      title: expect.stringMatching(/QR/i),
    }));
  });

  it("disables QR sending actions while offline", () => {
    renderPage({ connectionState: "offline" });

    expect(findButtonByText("wszystkich")).toBeDisabled();
    expect(findButtonByText("Wy")).toBeDisabled();
  });

  it("keeps participants in stable list order regardless of refreshed payload order", () => {
    renderPage({
      participants: [
        createTestParticipant({
          id: "p-3",
          name: "Celina Trzecia",
          email: "celina@example.com",
          email_status: "not_sent",
        }),
        createTestParticipant({
          id: "p-1",
          name: "Anna Pierwsza",
          email: "anna@example.com",
          email_status: "sent",
        }),
        createTestParticipant({
          id: "p-2",
          name: "Bartek Drugi",
          email: "bartek@example.com",
          email_status: "not_sent",
        }),
      ],
    });

    const participantNames = screen
      .getAllByRole("row")
      .slice(1)
      .map((row) => row.querySelector("td")?.textContent ?? "");

    expect(participantNames).toEqual([
      expect.stringContaining("Anna Pierwsza"),
      expect.stringContaining("Bartek Drugi"),
      expect.stringContaining("Celina Trzecia"),
    ]);
  });
});
