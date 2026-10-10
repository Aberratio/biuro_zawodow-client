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

const { refreshData } = vi.hoisted(() => ({
  refreshData: vi.fn(async () => undefined),
}));

vi.mock("@/contexts/DataContext", () => ({
  useData: () => ({ refreshData }),
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
    refreshData.mockClear();
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

  it("pulls participants, announces the result and refreshes data", async () => {
    const fetchMock = installFetch((url, init) => {
      if (init.method === "POST" && url.endsWith("/platform-connection/pull")) {
        return {
          status: 200,
          body: {
            data: {
              result: {
                status: "ok",
                summary: {
                  fetched: 9,
                  created: 4,
                  updated: 2,
                  unchanged: 3,
                  skipped: 0,
                  skipped_by_reason: [],
                  removed: 1,
                  restored: 0,
                  possible_duplicates: 0,
                  warnings: {},
                  duration_ms: 120,
                },
                skipped_records: [],
                possible_duplicate_registration_ids: [],
              },
              connection: {
                ...storedConnection,
                last_pull_at: "2026-10-07T10:00:00Z",
                last_pull_status: "ok",
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
      await screen.findByRole("button", { name: "Pobierz uczestników teraz" })
    );

    const message = await screen.findByText(
      "Pobrano listę z platformy: nowi 4, zaktualizowani 2, bez zmian 3. Usunięci na platformie: 1."
    );
    expect(message.closest('[aria-live="polite"]')).not.toBeNull();
    await waitFor(() => expect(refreshData).toHaveBeenCalledWith(true));
    const pullCall = fetchMock.mock.calls.find(([url]) =>
      String(url).endsWith("/platform-connection/pull")
    );
    expect(pullCall).toBeDefined();
  });

  it("disables the pull button when the integration is disabled or offline", async () => {
    installFetch(() => ({
      status: 200,
      body: {
        data: {
          availability: available,
          connection: { ...storedConnection, is_enabled: false },
        },
      },
    }));
    const first = renderSection();

    const button = await screen.findByRole("button", {
      name: "Pobierz uczestników teraz",
    });
    expect(button).toBeDisabled();
    expect(
      screen.getByText(
        "Włącz integrację i zapisz połączenie, aby pobierać uczestników."
      )
    ).toBeInTheDocument();
    first.unmount();

    installFetch(() => ({
      status: 200,
      body: {
        data: { availability: available, connection: storedConnection },
      },
    }));
    renderSection(false);
    expect(
      await screen.findByRole("button", { name: "Pobierz uczestników teraz" })
    ).toBeDisabled();
  });

  it("shows the last pull status from the connection", async () => {
    installFetch(() => ({
      status: 200,
      body: {
        data: {
          availability: available,
          connection: {
            ...storedConnection,
            last_pull_at: "2026-10-07T10:00:00Z",
            last_pull_status: "partial",
            last_pull_summary: {
              fetched: 5,
              created: 2,
              updated: 1,
              unchanged: 1,
              skipped: 1,
              skipped_by_reason: { qr_collision: 1 },
              removed: 0,
              restored: 0,
              possible_duplicates: 0,
              warnings: {},
              duration_ms: 90,
            },
          },
        },
      },
    }));
    renderSection();

    const line = await screen.findByText(/Ostatnie pobranie/);
    expect(line).toHaveTextContent(
      "Pobrano listę uczestników z platformy, ale część rekordów pominięto."
    );
    expect(line).toHaveTextContent("Nowi 2, zaktualizowani 1, bez zmian 1.");
    expect(line).toHaveTextContent("Pominięto 1");
  });

  it("shows remaining seconds when the pull is throttled", async () => {
    installFetch((url, init) => {
      if (init.method === "POST" && url.endsWith("/platform-connection/pull")) {
        return {
          status: 429,
          body: {
            error: "Odczekaj chwilę przed kolejnym pobraniem uczestników.",
            code: "platform_pull_throttled",
            retry_after: 9,
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
      await screen.findByRole("button", { name: "Pobierz uczestników teraz" })
    );

    expect(
      await screen.findByText("Odczekaj 9 s przed kolejnym pobraniem.")
    ).toBeInTheDocument();
  });

  it("shows the in-progress message on 409", async () => {
    installFetch((url, init) => {
      if (init.method === "POST" && url.endsWith("/platform-connection/pull")) {
        return {
          status: 409,
          body: {
            error:
              "Pobieranie uczestników z platformy już trwa. Spróbuj za chwilę.",
            code: "platform_pull_in_progress",
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
      await screen.findByRole("button", { name: "Pobierz uczestników teraz" })
    );

    expect(
      await screen.findByText(
        "Pobieranie uczestników z platformy już trwa. Spróbuj za chwilę."
      )
    ).toBeInTheDocument();
    expect(refreshData).not.toHaveBeenCalled();
  });

  it("lists skipped platform registration ids without personal data", async () => {
    installFetch((url, init) => {
      if (init.method === "POST" && url.endsWith("/platform-connection/pull")) {
        return {
          status: 200,
          body: {
            data: {
              result: {
                status: "partial",
                summary: {
                  fetched: 3,
                  created: 2,
                  updated: 0,
                  unchanged: 0,
                  skipped: 1,
                  skipped_by_reason: { qr_collision: 1 },
                  removed: 0,
                  restored: 0,
                  possible_duplicates: 0,
                  warnings: {},
                  duration_ms: 10,
                },
                skipped_records: [
                  { registration_id: "reg-0005", reason: "qr_collision" },
                ],
                possible_duplicate_registration_ids: [],
              },
              connection: storedConnection,
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
      await screen.findByRole("button", { name: "Pobierz uczestników teraz" })
    );

    expect(
      await screen.findByText("Pominięte rekordy (ID zapisu na platformie)")
    ).toBeInTheDocument();
    const item = screen.getByText(/reg-0005/);
    expect(item).toHaveTextContent(
      "reg-0005 — kod QR jest już używany przez innego uczestnika (np. w innym wydarzeniu)"
    );
    expect(document.body.textContent).not.toMatch(/pqr_|zqr_|@/);
  });
});
