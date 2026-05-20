const DEFAULT_API_BASE_URL = 'http://localhost:8080';

function normalizeHostname(hostname: string): string {
  return hostname.trim().toLowerCase().replace(/^\[|\]$/g, '');
}

function isLoopbackHostname(hostname: string): boolean {
  const normalized = normalizeHostname(hostname);
  return normalized === 'localhost' || normalized === '127.0.0.1' || normalized === '::1';
}

export function resolveApiBaseUrl(
  configuredApiUrl = import.meta.env.VITE_API_URL ?? DEFAULT_API_BASE_URL,
  browserLocation: Pick<Location, 'hostname'> = window.location,
): string {
  const configuredValue = (configuredApiUrl || DEFAULT_API_BASE_URL).trim();

  try {
    const apiUrl = new URL(configuredValue);

    if (isLoopbackHostname(apiUrl.hostname) && !isLoopbackHostname(browserLocation.hostname)) {
      apiUrl.hostname = browserLocation.hostname;
    }

    return apiUrl.toString().replace(/\/+$/, '');
  } catch {
    return configuredValue.replace(/\/+$/, '');
  }
}

export const API_BASE_URL = resolveApiBaseUrl();

export class ApiResponseError extends Error {
  status: number;
  payload: unknown;

  constructor(message: string, status: number, payload: unknown) {
    super(message);
    this.name = 'ApiResponseError';
    this.status = status;
    this.payload = payload;
  }
}

export class NetworkRequestError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'NetworkRequestError';
  }
}

type FetchJsonOptions = RequestInit & {
  timeoutMs?: number;
};

function getErrorMessage(payload: unknown, fallback: string): string {
  if (payload && typeof payload === 'object' && 'error' in payload && typeof payload.error === 'string') {
    return payload.error;
  }

  return fallback;
}

export async function fetchJson(input: RequestInfo | URL, options: FetchJsonOptions = {}) {
  const { timeoutMs = 12_000, signal, ...init } = options;
  const controller = new AbortController();
  const timeoutId = window.setTimeout(() => controller.abort(), timeoutMs);

  if (signal) {
    signal.addEventListener('abort', () => controller.abort(), { once: true });
  }

  try {
    const response = await fetch(input, {
      ...init,
      signal: controller.signal,
    });

    const contentType = response.headers.get('content-type') ?? '';
    const payload = contentType.includes('application/json')
      ? await response.json().catch(() => ({}))
      : await response.text().catch(() => '');

    if (!response.ok) {
      throw new ApiResponseError(
        getErrorMessage(payload, `Żądanie zakończyło się błędem ${response.status}`),
        response.status,
        payload,
      );
    }

    return { response, payload };
  } catch (error) {
    if (error instanceof ApiResponseError) {
      throw error;
    }

    if (error instanceof DOMException && error.name === 'AbortError') {
      throw new NetworkRequestError('Upłynął czas oczekiwania na odpowiedź serwera.');
    }

    throw new NetworkRequestError('Nie udało się połączyć z serwerem.');
  } finally {
    window.clearTimeout(timeoutId);
  }
}

export function isApiResponseError(error: unknown): error is ApiResponseError {
  return error instanceof ApiResponseError;
}

export function isNetworkRequestError(error: unknown): error is NetworkRequestError {
  return error instanceof NetworkRequestError;
}

export function getApiErrorCode(error: unknown): string | null {
  if (!isApiResponseError(error)) {
    return null;
  }

  const payload = error.payload;
  if (payload && typeof payload === 'object' && 'code' in payload && typeof payload.code === 'string') {
    return payload.code;
  }

  return null;
}
