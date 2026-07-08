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
import type { ConnectionState, Participant, QrEmailDeliveryParticipant, QrEmailDeliveryReport } from "@/types";

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

function createTestDeliveryReport(overrides: Partial<QrEmailDeliveryReport> = {}): QrEmailDeliveryReport {
  return {
    event_id: "event-1",
    generated_at: "2026-07-08T10:00:00Z",
    mailer_available: true,
    mailer_error: null,
    summary: {
      participants_total: 0,
      sent: 0,
      queued: 0,
      failed: 0,
      bounced: 0,
      unknown: 0,
      no_data: 0,
    },
    participants: [],
    ...overrides,
  };
}

function createTestDeliveryParticipant(
  overrides: Partial<QrEmailDeliveryParticipant> = {},
): QrEmailDeliveryParticipant {
  return {
    participant_id: 1,
    name: "Jan Kowalski",
    email: "jan@example.com",
    bib_number: "1",
    local_email_status: "sent",
    delivery: {
      email_id: "mail-1",
      status: "sent",
      effective_status: "sent",
      is_batch: false,
      batch_id: null,
      sent_at: "2026-07-08 10:05:00",
      created_at: "2026-07-08 10:00:00",
      last_error: null,
      send_count: 1,
    },
    ...overrides,
  };
}

function renderPage(options: {
  participants?: Participant[];
  connectionState?: ConnectionState;
  sendEventQrEmails?: ReturnType<typeof vi.fn>;
  sendParticipantQrEmail?: ReturnType<typeof vi.fn>;
  getEventQrEmailDeliveries?: ReturnType<typeof vi.fn>;
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
  const getEventQrEmailDeliveries = options.getEventQrEmailDeliveries
    ?? vi.fn(async () => createTestDeliveryReport());

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
    getEventQrEmailDeliveries,
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

  return { sendEventQrEmails, sendParticipantQrEmail, getEventQrEmailDeliveries };
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
      expect(sendEventQrEmails).toHaveBeenCalledWith("event-1", false, "all");
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

  it("renders delivery statuses with bounced badge and batch indicator", async () => {
    renderPage({
      participants: [
        createTestParticipant({ id: "p-1", name: "Anna Pierwsza", email: "anna@example.com", email_status: "sent" }),
        createTestParticipant({ id: "p-2", name: "Bartek Drugi", email: "bartek@example.com", email_status: "sent" }),
      ],
      getEventQrEmailDeliveries: vi.fn(async () => createTestDeliveryReport({
        summary: { participants_total: 2, sent: 1, queued: 0, failed: 0, bounced: 1, unknown: 0, no_data: 0 },
        participants: [
          createTestDeliveryParticipant({
            participant_id: 1,
            name: "Anna Pierwsza",
            email: "anna@example.com",
            delivery: {
              email_id: "mail-1",
              status: "sent",
              effective_status: "bounced",
              is_batch: true,
              batch_id: "batch-9",
              sent_at: "2026-07-08 10:05:00",
              created_at: "2026-07-08 10:00:00",
              last_error: "User unknown",
              send_count: 2,
            },
          }),
          createTestDeliveryParticipant({
            participant_id: 2,
            name: "Bartek Drugi",
            email: "bartek@example.com",
          }),
        ],
      })),
    });

    await waitFor(() => {
      expect(screen.getByText("Odbity")).toBeInTheDocument();
    });
    expect(screen.getByText("Masowa ×2")).toBeInTheDocument();
    expect(screen.getByText("Pojedyncza")).toBeInTheDocument();
    expect(screen.getByText("User unknown")).toBeInTheDocument();
    expect(screen.getByTestId("delivery-summary")).toHaveTextContent("Odbite: 1");
  });

  it("filters participants by delivery status", async () => {
    renderPage({
      participants: [
        createTestParticipant({ id: "p-1", name: "Anna Pierwsza", email: "anna@example.com", email_status: "sent" }),
        createTestParticipant({ id: "p-2", name: "Bartek Drugi", email: "bartek@example.com", email_status: "sent" }),
      ],
      getEventQrEmailDeliveries: vi.fn(async () => createTestDeliveryReport({
        participants: [
          createTestDeliveryParticipant({
            participant_id: 1,
            name: "Anna Pierwsza",
            email: "anna@example.com",
            delivery: {
              email_id: "mail-1",
              status: "sent",
              effective_status: "bounced",
              is_batch: false,
              batch_id: null,
              sent_at: null,
              created_at: "2026-07-08 10:00:00",
              last_error: "User unknown",
              send_count: 1,
            },
          }),
          createTestDeliveryParticipant({
            participant_id: 2,
            name: "Bartek Drugi",
            email: "bartek@example.com",
          }),
        ],
      })),
    });

    await waitFor(() => {
      expect(screen.getByText("Odbity")).toBeInTheDocument();
    });

    fireEvent.click(screen.getByLabelText("Filtr statusu dostarczenia"));
    fireEvent.click(screen.getByRole("option", { name: "Odbity — nie dostarczono" }));

    await waitFor(() => {
      expect(screen.queryByText("Bartek Drugi")).not.toBeInTheDocument();
    });
    expect(screen.getByText("Anna Pierwsza")).toBeInTheDocument();
  });

  it("falls back to local statuses with a notice when the mailer is unavailable", async () => {
    renderPage({
      participants: [
        createTestParticipant({ id: "p-1", name: "Anna Pierwsza", email: "anna@example.com", email_status: "sent" }),
      ],
      getEventQrEmailDeliveries: vi.fn(async () => createTestDeliveryReport({
        mailer_available: false,
        mailer_error: "HTTP 503",
      })),
    });

    await waitFor(() => {
      expect(screen.getByText(/Statusy dostarczenia są chwilowo niedostępne/)).toBeInTheDocument();
    });
    expect(screen.getByText("Wysłany")).toBeInTheDocument();
    expect(screen.queryByTestId("delivery-summary")).not.toBeInTheDocument();
  });

  it("refetches delivery statuses when refresh button is clicked", async () => {
    const getEventQrEmailDeliveries = vi.fn(async () => createTestDeliveryReport());
    renderPage({ getEventQrEmailDeliveries });

    await waitFor(() => {
      expect(getEventQrEmailDeliveries).toHaveBeenCalledTimes(1);
    });

    fireEvent.click(findButtonByText("Odśwież statusy"));

    await waitFor(() => {
      expect(getEventQrEmailDeliveries).toHaveBeenCalledTimes(2);
    });
  });
});
