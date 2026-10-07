import { API_BASE_URL, fetchJson } from "@/lib/api";

export type PlatformAvailabilityReason =
  | "sodium_missing"
  | "token_key_missing"
  | "token_key_invalid"
  | "previous_token_key_invalid"
  | "api_url_missing"
  | "api_url_invalid"
  | "app_key_missing";

export type PlatformTestStatus =
  | "ok"
  | "app_key_rejected"
  | "token_rejected"
  | "platform_event_not_found"
  | "network_error"
  | "token_unreadable"
  | "platform_rate_limited"
  | "invalid_response"
  | "platform_error";

export interface PlatformConnection {
  platform_event_id: string;
  is_enabled: boolean;
  token_set: boolean;
  token_hint: string;
  token_readable: boolean | null;
  token_updated_at: string | null;
  last_test_at: string | null;
  last_test_status: string | null;
  updated_at: string | null;
}

export interface PlatformConnectionView {
  availability: { available: boolean; reasons: string[] };
  connection: PlatformConnection | null;
}

export interface PlatformConnectionTestResult {
  result: { status: string; participant_count: number | null };
  connection: PlatformConnection | null;
}

export interface PlatformConnectionInput {
  platform_event_id: string;
  organization_token?: string;
  is_enabled: boolean;
}

export interface PlatformConnectionFormErrors {
  platformEventId?: string;
  token?: string;
}

const PLATFORM_EVENT_ID_ERROR =
  "Podaj ID wydarzenia z platformy (litery, cyfry, - lub _, maks. 64 znaki).";
const TOKEN_FORMAT_ERROR =
  "Token organizacji musi mieć od 32 do 255 znaków i nie może zawierać spacji.";
const TOKEN_REQUIRED_ERROR =
  "Podaj token organizacji (wygeneruj nowy albo wklej token zapisany na platformie).";

function connectionUrl(eventId: string, suffix = "") {
  return `${API_BASE_URL}/events/${encodeURIComponent(eventId)}/platform-connection${suffix}`;
}

function extractData<T>(payload: unknown): T {
  return (payload as { data: T }).data;
}

export async function getPlatformConnection(
  eventId: string,
  headers: Record<string, string>
): Promise<PlatformConnectionView> {
  const { payload } = await fetchJson(connectionUrl(eventId), {
    method: "GET",
    headers,
  });
  return extractData<PlatformConnectionView>(payload);
}

export async function savePlatformConnection(
  eventId: string,
  headers: Record<string, string>,
  input: PlatformConnectionInput
): Promise<PlatformConnectionView> {
  const { payload } = await fetchJson(connectionUrl(eventId), {
    method: "PUT",
    headers,
    body: JSON.stringify(input),
  });
  return extractData<PlatformConnectionView>(payload);
}

export async function testPlatformConnection(
  eventId: string,
  headers: Record<string, string>
): Promise<PlatformConnectionTestResult> {
  const { payload } = await fetchJson(connectionUrl(eventId, "/test"), {
    method: "POST",
    headers,
  });
  return extractData<PlatformConnectionTestResult>(payload);
}

export async function deletePlatformConnection(
  eventId: string,
  headers: Record<string, string>
): Promise<PlatformConnectionView> {
  const { payload } = await fetchJson(connectionUrl(eventId), {
    method: "DELETE",
    headers,
  });
  return extractData<PlatformConnectionView>(payload);
}

/** 32 random bytes as base64url (43 characters). Generated in the browser, sent once, never returned by the API. */
export function generateOrganizationToken(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  let binary = "";
  for (const byte of bytes) {
    binary += String.fromCharCode(byte);
  }

  return btoa(binary)
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

const AVAILABILITY_MESSAGES: Record<PlatformAvailabilityReason, string> = {
  api_url_missing: "Brak adresu API platformy (BZ_PLATFORM_API_URL).",
  api_url_invalid: "Adres API platformy jest nieprawidłowy (wymagany https).",
  app_key_missing: "Brak klucza aplikacji Biura Zawodów (BZ_PLATFORM_APP_KEY).",
  token_key_missing: "Brak klucza szyfrowania tokenów (BZ_PLATFORM_TOKEN_KEY).",
  token_key_invalid: "Klucz szyfrowania tokenów ma nieprawidłowy format.",
  previous_token_key_invalid:
    "Klucz szyfrowania tokenów ma nieprawidłowy format.",
  sodium_missing:
    "Serwer nie obsługuje szyfrowania (brak rozszerzenia PHP sodium).",
};

export const PLATFORM_UNAVAILABLE_HEADER =
  "Integracja z platformą jest nieaktywna na tym serwerze.";
export const PLATFORM_UNAVAILABLE_FOOTER =
  "Skontaktuj się z administratorem serwera.";

export function describeAvailabilityReason(code: string): string {
  return (
    AVAILABILITY_MESSAGES[code as PlatformAvailabilityReason] ??
    "Nieznany powód: integracja jest nieaktywna."
  );
}

function pluralizeParticipants(count: number): string {
  if (count === 1) return "1 uczestnika";
  return `${count} uczestników`;
}

export function describeTestStatus(
  status: string,
  participantCount: number | null
): string {
  switch (status) {
    case "ok":
      return `Połączenie działa. Platforma zwróciła ${pluralizeParticipants(participantCount ?? 0)}.`;
    case "app_key_rejected":
      return "Platforma odrzuciła klucz aplikacji Biura Zawodów. Skontaktuj się z administratorem serwera.";
    case "token_rejected":
      return "Platforma odrzuciła token organizacji albo integracja z Biurem Zawodów nie jest włączona dla tego wydarzenia na platformie.";
    case "platform_event_not_found":
      return "Platforma nie zna wydarzenia o tym ID.";
    case "network_error":
      return "Nie udało się połączyć z platformą (brak odpowiedzi lub przekroczony czas).";
    case "token_unreadable":
      return "Zapisanego tokenu nie da się odczytać. Wklej token ponownie i zapisz.";
    case "platform_rate_limited":
      return "Platforma chwilowo ogranicza liczbę zapytań. Spróbuj za chwilę.";
    default:
      return "Platforma zwróciła nieoczekiwaną odpowiedź.";
  }
}

export function validatePlatformConnectionForm(input: {
  platformEventId: string;
  token: string;
  hasStoredToken: boolean;
}): PlatformConnectionFormErrors {
  const errors: PlatformConnectionFormErrors = {};

  if (!/^[A-Za-z0-9_-]{1,64}$/.test(input.platformEventId.trim())) {
    errors.platformEventId = PLATFORM_EVENT_ID_ERROR;
  }

  const token = input.token.trim();
  if (token === "") {
    if (!input.hasStoredToken) {
      errors.token = TOKEN_REQUIRED_ERROR;
    }
  } else if (!/^[\x21-\x7E]{32,255}$/.test(token)) {
    errors.token = TOKEN_FORMAT_ERROR;
  }

  return errors;
}
