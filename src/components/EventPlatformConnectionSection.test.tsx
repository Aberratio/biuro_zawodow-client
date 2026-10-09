import {
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { EventPlatformConnectionSection } from "@/components/EventPlatformConnectionSection";

vi.mock("@/contexts/AuthContext", () => ({
  useAuth: () => ({
    getAuthHeaders: (json = false) => ({
      Authorization: "Bearer test-token",
      ...(json ? { "Content-Type": "application/json" } : {}),
    }),
  }),
}));

vi.mock("@/hooks/use-toast", () => ({
  toast: vi.fn(),
}));

type Responder = (
  url: string,
  init: RequestInit
) => { status: number; body: unknown };

const available = { available: true, reasons: [] as string[] };
const storedConnection = {
  platform_event_id: "p1",
  is_enabled: true,
  token_set: true,
  token_hint: "wxyz",
  token_readable: true,
  token_updated_at: "2026-10-05T10:00:00Z",
  last_test_at: null,
  last_test_status: null,
  updated_at: "2026-10-05T10:00:00Z",
};

function installFetch(responder: Responder) {
  const fetchMock = vi.fn(
    async (input: RequestInfo | URL, init: RequestInit = {}) => {
      const { status, body } = responder(String(input), init);
      return new Response(JSON.stringify(body), {
        status,
        headers: { "content-type": "application/json" },
      });
    }
  );
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

function renderSection(isOnline = true) {
  return render(
    <EventPlatformConnectionSection eventId="evt-1" isOnline={isOnline} />
  );
}

describe("EventPlatformConnectionSection", () => {
  beforeEach(() => {
    vi.unstubAllGlobals();
    Object.assign(navigator, {
      clipboard: { writeText: vi.fn(async () => undefined) },
    });
  });

  it("shows Polish reasons and disables the form when the integration is unavailable", async () => {
    installFetch(() => ({
      status: 200,
      body: {
        data: {
          availability: {
            available: false,
            reasons: ["token_key_missing", "app_key_missing"],
          },
          connection: null,
        },
      },
    }));
    renderSection();

    expect(
      await screen.findByText(
        "Integracja z platformą jest nieaktywna na tym serwerze."
      )
    ).toBeInTheDocument();
    expect(
      screen.getByText(
        "Brak klucza szyfrowania tokenów (BZ_PLATFORM_TOKEN_KEY)."
      )
    ).toBeInTheDocument();
    expect(
      screen.getByText(
        "Brak klucza aplikacji Biura Zawodów (BZ_PLATFORM_APP_KEY)."
      )
    ).toBeInTheDocument();
    expect(
      screen.getByText("Skontaktuj się z administratorem serwera.")
    ).toBeInTheDocument();
    expect(screen.getByLabelText("ID wydarzenia na platformie")).toBeDisabled();
    expect(screen.getByLabelText("Token organizacji")).toBeDisabled();
    expect(
      screen.getByRole("button", { name: "Zapisz połączenie" })
    ).toBeDisabled();
    expect(
      screen.getByRole("button", { name: "Testuj połączenie" })
    ).toBeDisabled();
  });

  it("generates a token, saves it once and clears it from the form after saving", async () => {
    let savedBody: Record<string, unknown> | null = null;
    installFetch((_url, init) => {
      if (init.method === "PUT") {
        savedBody = JSON.parse(String(init.body));
        return {
          status: 200,
          body: {
            data: {
              availability: available,
              connection: {
                ...storedConnection,
                token_hint: String(savedBody?.organization_token).slice(-4),
              },
            },
          },
        };
      }
      return {
        status: 200,
        body: { data: { availability: available, connection: null } },
      };
    });
    renderSection();

    const idInput = await screen.findByLabelText("ID wydarzenia na platformie");
    fireEvent.change(idInput, { target: { value: "p1" } });
    fireEvent.click(screen.getByRole("button", { name: "Wygeneruj token" }));
    const tokenInput = screen.getByLabelText(
      "Token organizacji"
    ) as HTMLInputElement;
    const token = tokenInput.value;
    expect(token).toMatch(/^[A-Za-z0-9_-]{43}$/);

    fireEvent.click(screen.getByRole("button", { name: "Zapisz połączenie" }));

    await waitFor(() => expect(savedBody).not.toBeNull());
    expect(savedBody).toMatchObject({
      platform_event_id: "p1",
      organization_token: token,
    });
    await waitFor(() =>
      expect(
        (screen.getByLabelText("Token organizacji") as HTMLInputElement).value
      ).toBe("")
    );
    expect(screen.queryByDisplayValue(token)).toBeNull();
    expect(screen.queryByText(token)).toBeNull();
    expect(
      screen.getByText(new RegExp(`kończy się na …${token.slice(-4)}`))
    ).toBeInTheDocument();
  });

  it("shows how many office changes wait for the platform and when it last reported a change", async () => {
    installFetch(() => ({
      status: 200,
      body: {
        data: {
          availability: available,
          connection: {
            ...storedConnection,
            push_pending: 4,
            push_failed: 1,
            last_webhook_at: "2026-10-09T10:00:00Z",
          },
        },
      },
    }));
    renderSection();

    expect(
      await screen.findByText(
        "Odprawy i poprawki czekające na wysłanie do platformy: 4. Nieudane: 1 — ponowienie automatyczne."
      )
    ).toBeInTheDocument();
    expect(
      screen.getByText(/Ostatnia zmiana z platformy: /)
    ).toBeInTheDocument();
  });

  it("shows no queue line before the server reports counters", async () => {
    installFetch(() => ({
      status: 200,
      body: {
        data: { availability: available, connection: storedConnection },
      },
    }));
    renderSection();

    expect(await screen.findByText(/kończy się na …wxyz/)).toBeInTheDocument();
    expect(screen.queryByText(/czekające na wysłanie do platformy/)).toBeNull();
  });

  it("keeps the stored token when saving without a new token", async () => {
    let savedBody: Record<string, unknown> | null = null;
    installFetch((_url, init) => {
      if (init.method === "PUT") {
        savedBody = JSON.parse(String(init.body));
        return {
          status: 200,
          body: {
            data: { availability: available, connection: storedConnection },
          },
        };
      }
      return {
        status: 200,
        body: {
          data: { availability: available, connection: storedConnection },
        },
      };
    });
    renderSection();

    expect(await screen.findByText(/kończy się na …wxyz/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Zapisz połączenie" }));

    await waitFor(() => expect(savedBody).not.toBeNull());
    expect(savedBody).toEqual({ platform_event_id: "p1", is_enabled: true });
    expect(savedBody).not.toHaveProperty("organization_token");
  });

  it("announces the connection test result in a live region", async () => {
    installFetch((url, init) => {
      if (init.method === "POST" && url.endsWith("/platform-connection/test")) {
        return {
          status: 200,
          body: {
            data: {
              result: { status: "token_rejected", participant_count: null },
              connection: {
                ...storedConnection,
                last_test_status: "token_rejected",
              },
            },
          },
        };
      }
      return {
        status: 200,
        body: {
          data: { availability: available, connection: storedConnection },
        },
      };
    });
    renderSection();

    fireEvent.click(
      await screen.findByRole("button", { name: "Testuj połączenie" })
    );

    const message = await screen.findByText(
      /Platforma odrzuciła token organizacji/
    );
    expect(message.closest('[aria-live="polite"]')).not.toBeNull();
  });

  it("shows remaining seconds when the test is throttled", async () => {
    installFetch((url, init) => {
      if (init.method === "POST" && url.endsWith("/platform-connection/test")) {
        return {
          status: 429,
          body: {
            error: "Odczekaj chwilę przed kolejnym testem połączenia.",
            code: "platform_connection_test_throttled",
            retry_after: 7,
          },
        };
      }
      return {
        status: 200,
        body: {
          data: { availability: available, connection: storedConnection },
        },
      };
    });
    renderSection();

    fireEvent.click(
      await screen.findByRole("button", { name: "Testuj połączenie" })
    );

    expect(
      await screen.findByText("Odczekaj 7 s przed kolejnym testem.")
    ).toBeInTheDocument();
  });

  it("links field errors to inputs for screen readers", async () => {
    const fetchMock = installFetch(() => ({
      status: 200,
      body: { data: { availability: available, connection: null } },
    }));
    renderSection();

    const idInput = await screen.findByLabelText("ID wydarzenia na platformie");
    fireEvent.change(idInput, { target: { value: "p 1" } });
    fireEvent.change(screen.getByLabelText("Token organizacji"), {
      target: { value: "short" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Zapisz połączenie" }));

    expect(idInput).toHaveAttribute("aria-invalid", "true");
    const describedBy = idInput.getAttribute("aria-describedby") ?? "";
    expect(describedBy).not.toBe("");
    const errorNode = document.getElementById(
      describedBy.split(" ").find((id) => id.includes("error")) ?? ""
    );
    expect(errorNode).not.toBeNull();
    expect(
      within(errorNode as HTMLElement).getByText(
        /Podaj ID wydarzenia z platformy/
      )
    ).toBeInTheDocument();
    expect(screen.getByLabelText("Token organizacji")).toHaveAttribute(
      "aria-invalid",
      "true"
    );
    // Only the initial GET happened: validation blocked the PUT.
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("shows the last stored test without inventing a participant count", async () => {
    installFetch(() => ({
      status: 200,
      body: {
        data: {
          availability: available,
          connection: {
            ...storedConnection,
            last_test_at: "2026-10-05T10:05:00Z",
            last_test_status: "ok",
          },
        },
      },
    }));
    renderSection();

    const line = await screen.findByText(/Ostatni test/);
    expect(line).toHaveTextContent("Połączenie działa.");
    expect(line.textContent).not.toMatch(/uczestnik/);
  });
});
