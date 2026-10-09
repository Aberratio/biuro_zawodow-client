import { afterEach, describe, expect, it, vi } from "vitest";
import {
  describeAvailabilityReason,
  describePullResult,
  describePullStatus,
  describeSkipReason,
  describePlatformPushStatus,
  describeTestStatus,
  generateOrganizationToken,
  pullPlatformParticipants,
  savePlatformConnection,
  validatePlatformConnectionForm,
  type PlatformAvailabilityReason,
  type PlatformTestStatus,
} from "@/lib/platform-connection";

describe("platform connection helpers", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("generateOrganizationToken returns 43 url-safe characters and differs between calls", () => {
    const first = generateOrganizationToken();
    const second = generateOrganizationToken();

    expect(first).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(second).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(first).not.toBe(second);
  });

  it("validatePlatformConnectionForm mirrors the API rules", () => {
    const token = "a".repeat(43);

    expect(
      validatePlatformConnectionForm({
        platformEventId: "",
        token,
        hasStoredToken: false,
      }).platformEventId
    ).toBe(
      "Podaj ID wydarzenia z platformy (litery, cyfry, - lub _, maks. 64 znaki)."
    );
    expect(
      validatePlatformConnectionForm({
        platformEventId: "p 1",
        token,
        hasStoredToken: false,
      }).platformEventId
    ).toContain("Podaj ID wydarzenia z platformy");
    expect(
      validatePlatformConnectionForm({
        platformEventId: "a".repeat(65),
        token,
        hasStoredToken: false,
      }).platformEventId
    ).toBeDefined();
    expect(
      validatePlatformConnectionForm({
        platformEventId: "p1",
        token: "short",
        hasStoredToken: false,
      }).token
    ).toBe(
      "Token organizacji musi mieć od 32 do 255 znaków i nie może zawierać spacji."
    );
    expect(
      validatePlatformConnectionForm({
        platformEventId: "p1",
        token: `${"a".repeat(20)} ${"b".repeat(20)}`,
        hasStoredToken: true,
      }).token
    ).toContain("od 32 do 255 znaków");
    expect(
      validatePlatformConnectionForm({
        platformEventId: "p1",
        token: "",
        hasStoredToken: false,
      }).token
    ).toBe(
      "Podaj token organizacji (wygeneruj nowy albo wklej token zapisany na platformie)."
    );
    expect(
      validatePlatformConnectionForm({
        platformEventId: "p1",
        token: "",
        hasStoredToken: true,
      })
    ).toEqual({});
    expect(
      validatePlatformConnectionForm({
        platformEventId: " p1 ",
        token,
        hasStoredToken: false,
      })
    ).toEqual({});
  });

  it("describeAvailabilityReason returns Polish text for every reason code", () => {
    const reasons: PlatformAvailabilityReason[] = [
      "sodium_missing",
      "token_key_missing",
      "token_key_invalid",
      "previous_token_key_invalid",
      "api_url_missing",
      "api_url_invalid",
      "app_key_missing",
    ];

    for (const reason of reasons) {
      expect(describeAvailabilityReason(reason).length).toBeGreaterThan(10);
    }
    expect(describeAvailabilityReason("api_url_missing")).toBe(
      "Brak adresu API platformy (BZ_PLATFORM_API_URL)."
    );
    expect(describeAvailabilityReason("app_key_missing")).toBe(
      "Brak klucza aplikacji Biura Zawodów (BZ_PLATFORM_APP_KEY)."
    );
    expect(describeAvailabilityReason("sodium_missing")).toBe(
      "Serwer nie obsługuje szyfrowania (brak rozszerzenia PHP sodium)."
    );
    expect(describeAvailabilityReason("something_new")).toBe(
      "Nieznany powód: integracja jest nieaktywna."
    );
  });

  it("describeTestStatus covers every status and falls back for unknown", () => {
    expect(describeTestStatus("ok", 12)).toBe(
      "Połączenie działa. Platforma zwróciła 12 uczestników."
    );
    expect(describeTestStatus("ok", null)).toBe("Połączenie działa.");
    expect(describeTestStatus("ok", 1)).toBe(
      "Połączenie działa. Platforma zwróciła 1 uczestnika."
    );
    expect(describeTestStatus("ok", 2)).toBe(
      "Połączenie działa. Platforma zwróciła 2 uczestników."
    );
    expect(describeTestStatus("app_key_rejected", null)).toContain(
      "odrzuciła klucz aplikacji"
    );
    expect(describeTestStatus("token_rejected", null)).toContain(
      "odrzuciła token organizacji"
    );
    expect(describeTestStatus("platform_event_not_found", null)).toBe(
      "Platforma nie zna wydarzenia o tym ID."
    );
    expect(describeTestStatus("network_error", null)).toContain(
      "Nie udało się połączyć z platformą"
    );
    expect(describeTestStatus("token_unreadable", null)).toContain(
      "nie da się odczytać"
    );
    expect(describeTestStatus("platform_rate_limited", null)).toContain(
      "ogranicza liczbę zapytań"
    );
    const unexpected: PlatformTestStatus[] = [
      "invalid_response",
      "platform_error",
    ];
    for (const status of unexpected) {
      expect(describeTestStatus(status, null)).toBe(
        "Platforma zwróciła nieoczekiwaną odpowiedź."
      );
    }
    expect(describeTestStatus("brand_new_status", null)).toBe(
      "Platforma zwróciła nieoczekiwaną odpowiedź."
    );
  });

  it("savePlatformConnection sends PUT with JSON body and auth headers to the encoded event path", async () => {
    const fetchMock = vi.fn(
      async () =>
        new Response(
          JSON.stringify({
            data: {
              availability: { available: true, reasons: [] },
              connection: null,
            },
          }),
          { status: 200, headers: { "content-type": "application/json" } }
        )
    );
    vi.stubGlobal("fetch", fetchMock);

    const view = await savePlatformConnection(
      "evt/1",
      { Authorization: "Bearer abc", "Content-Type": "application/json" },
      {
        platform_event_id: "p1",
        organization_token: "t".repeat(40),
        is_enabled: true,
      }
    );

    expect(view.availability.available).toBe(true);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0] as unknown as [
      string,
      RequestInit,
    ];
    expect(url).toMatch(/\/events\/evt%2F1\/platform-connection$/);
    expect(init.method).toBe("PUT");
    expect(init.headers).toEqual({
      Authorization: "Bearer abc",
      "Content-Type": "application/json",
    });
    expect(JSON.parse(String(init.body))).toEqual({
      platform_event_id: "p1",
      organization_token: "t".repeat(40),
      is_enabled: true,
    });
  });

  it("pullPlatformParticipants posts to the encoded pull path with auth headers", async () => {
    const outcome = {
      result: {
        status: "ok",
        summary: null,
        skipped_records: [],
        possible_duplicate_registration_ids: [],
      },
      connection: null,
    };
    const fetchMock = vi.fn(
      async () =>
        new Response(JSON.stringify({ data: outcome }), {
          status: 200,
          headers: { "content-type": "application/json" },
        })
    );
    vi.stubGlobal("fetch", fetchMock);

    const result = await pullPlatformParticipants("evt/1", {
      Authorization: "Bearer abc",
    });

    expect(result).toEqual(outcome);
    const [url, init] = fetchMock.mock.calls[0] as unknown as [
      string,
      RequestInit,
    ];
    expect(url).toMatch(/\/events\/evt%2F1\/platform-connection\/pull$/);
    expect(init.method).toBe("POST");
    expect(init.headers).toEqual({ Authorization: "Bearer abc" });
  });

  it("describePullResult summarises created, updated, unchanged, removed, skipped and duplicates in Polish", () => {
    const summary = {
      fetched: 10,
      created: 3,
      updated: 2,
      unchanged: 4,
      skipped: 1,
      skipped_by_reason: { qr_collision: 1 },
      removed: 2,
      restored: 0,
      possible_duplicates: 5,
      warnings: {},
      duration_ms: 100,
    };

    expect(
      describePullResult({
        status: "partial",
        summary,
        skipped_records: [],
        possible_duplicate_registration_ids: [],
      })
    ).toBe(
      "Pobrano listę z platformy: nowi 3, zaktualizowani 2, bez zmian 4. Usunięci na platformie: 2. Pominięto 1: kod QR jest już używany przez innego uczestnika (np. w innym wydarzeniu) (1). Możliwe duplikaty z importu pliku: 5."
    );
    expect(
      describePullResult({
        status: "ok",
        summary: {
          ...summary,
          skipped: 0,
          skipped_by_reason: {},
          removed: 0,
          possible_duplicates: 0,
        },
        skipped_records: [],
        possible_duplicate_registration_ids: [],
      })
    ).toBe("Pobrano listę z platformy: nowi 3, zaktualizowani 2, bez zmian 4.");
    expect(
      describePullResult({
        status: "token_rejected",
        summary: null,
        skipped_records: [],
        possible_duplicate_registration_ids: [],
      })
    ).toBe(
      "Nie udało się pobrać uczestników. Platforma odrzuciła token organizacji albo integracja z Biurem Zawodów nie jest włączona dla tego wydarzenia na platformie."
    );
  });

  it("describePullStatus covers every status and falls back for unknown codes", () => {
    const statuses = [
      "ok",
      "partial",
      "connection_disabled",
      "connection_missing",
      "token_unreadable",
      "integration_unavailable",
      "event_inactive",
      "event_not_found",
      "in_progress",
      "app_key_rejected",
      "token_rejected",
      "platform_event_not_found",
      "platform_rate_limited",
      "network_error",
      "invalid_response",
      "platform_error",
      "response_too_large",
      "apply_failed",
    ];
    for (const status of statuses) {
      expect(describePullStatus(status)).not.toBe("");
    }
    expect(describePullStatus("ok")).toBe(
      "Pobrano listę uczestników z platformy."
    );
    expect(describePullStatus("network_error")).toBe(
      "Nie udało się połączyć z platformą (brak odpowiedzi lub przekroczony czas)."
    );
    expect(describePullStatus("something_new")).toBe(
      "Platforma zwróciła nieoczekiwaną odpowiedź."
    );
    expect(describePullStatus(null)).toBe(
      "Uczestnicy nie byli jeszcze pobierani."
    );
    expect(describeSkipReason("qr_collision")).toContain("kod QR");
  });
});

describe("describePlatformPushStatus", () => {
  const base = {
    platform_event_id: "p1",
    is_enabled: true,
    token_set: true,
    token_hint: "wxyz",
    token_readable: true,
    token_updated_at: null,
    last_test_at: null,
    last_test_status: null,
    updated_at: null,
  };

  it("reports waiting changes, failures and the last platform change", () => {
    const lines = describePlatformPushStatus({
      ...base,
      push_pending: 3,
      push_failed: 2,
      last_webhook_at: "2026-10-09T10:00:00Z",
    });
    expect(lines[0]).toBe(
      "Odprawy i poprawki czekające na wysłanie do platformy: 3. Nieudane: 2 — ponowienie automatyczne."
    );
    expect(lines[1]).toMatch(/^Ostatnia zmiana z platformy: /);
    expect(lines).toHaveLength(2);
  });

  it("stays quiet when the server has no queue counters yet", () => {
    expect(describePlatformPushStatus({ ...base })).toEqual([]);
    expect(
      describePlatformPushStatus({
        ...base,
        push_pending: null,
        push_failed: null,
        last_webhook_at: null,
      })
    ).toEqual([]);
    expect(describePlatformPushStatus(null)).toEqual([]);
  });

  it("omits the failure sentence when nothing failed", () => {
    expect(
      describePlatformPushStatus({ ...base, push_pending: 0, push_failed: 0 })
    ).toEqual(["Odprawy i poprawki czekające na wysłanie do platformy: 0"]);
  });
});
