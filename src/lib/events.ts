import type { Event } from '@/types';

const MIN_EVENT_OFFICE_DURATION_MS = 60 * 60 * 1000;

function normalizeDateTimeInput(value: string): string {
  return value.includes(' ') ? value.replace(' ', 'T') : value;
}

function padDateTimePart(value: number): string {
  return String(value).padStart(2, '0');
}

const LOCAL_DATE_TIME_PATTERN =
  /^(\d{4})-(\d{2})-(\d{2})[T ](\d{2}):(\d{2})(?::(\d{2}))?(?:\.\d+)?$/;

export function parseEventDateTime(value: string): Date | null {
  if (!value) return null;

  const parsed = new Date(normalizeDateTimeInput(value));
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

export function toLocalDateTimeValue(value: string): string {
  const normalizedInput = normalizeDateTimeInput(value.trim());
  const match = normalizedInput.match(LOCAL_DATE_TIME_PATTERN);

  if (match) {
    const [, year, month, day, hour, minute, second = '00'] = match;
    return `${year}-${month}-${day}T${hour}:${minute}:${second}`;
  }

  const parsed = parseEventDateTime(value);

  if (!parsed) {
    return normalizedInput;
  }

  return `${parsed.getFullYear()}-${padDateTimePart(parsed.getMonth() + 1)}-${padDateTimePart(parsed.getDate())}T${padDateTimePart(parsed.getHours())}:${padDateTimePart(parsed.getMinutes())}:${padDateTimePart(parsed.getSeconds())}`;
}

export function isEventOfficeOpen(event: Pick<Event, 'office_open_at' | 'office_close_at'>, now = new Date()): boolean {
  const openAt = parseEventDateTime(event.office_open_at);
  const closeAt = parseEventDateTime(event.office_close_at);

  if (!openAt || !closeAt) return false;
  return now >= openAt && now <= closeAt;
}

export function isValidEventOfficeRange(openAt: string, closeAt: string): boolean {
  const parsedOpenAt = parseEventDateTime(openAt);
  const parsedCloseAt = parseEventDateTime(closeAt);

  if (!parsedOpenAt || !parsedCloseAt) return false;
  return parsedCloseAt.getTime() - parsedOpenAt.getTime() >= MIN_EVENT_OFFICE_DURATION_MS;
}

export function isEventOfficeStartAtOrAfterNow(openAt: string, now = new Date()): boolean {
  const parsedOpenAt = parseEventDateTime(openAt);

  if (!parsedOpenAt) return false;
  return parsedOpenAt.getTime() >= now.getTime();
}

export function getEventOfficeOpenAt(event: Pick<Event, 'office_open_at'>): Date | null {
  return parseEventDateTime(event.office_open_at);
}

export function getEventOfficeCloseAt(event: Pick<Event, 'office_close_at'>): Date | null {
  return parseEventDateTime(event.office_close_at);
}

export function isEventCurrentOrUpcoming(event: Pick<Event, 'office_close_at'>, now = new Date()): boolean {
  const closeAt = getEventOfficeCloseAt(event);
  return closeAt !== null && closeAt > now;
}

export function formatEventOfficeStart(event: Pick<Event, 'office_open_at'>): string {
  const openAt = getEventOfficeOpenAt(event);
  if (!openAt) {
    return 'Termin otwarcia biura niedostępny';
  }

  const formatter = new Intl.DateTimeFormat('pl-PL', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });

  return formatter.format(openAt);
}

export function formatEventOfficeEnd(event: Pick<Event, 'office_close_at'>): string {
  const closeAt = getEventOfficeCloseAt(event);
  if (!closeAt) {
    return 'Termin zamknięcia biura niedostępny';
  }

  const formatter = new Intl.DateTimeFormat('pl-PL', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });

  return formatter.format(closeAt);
}

export function formatEventOfficeWindow(event: Pick<Event, 'office_open_at' | 'office_close_at'>): string {
  const openAt = parseEventDateTime(event.office_open_at);
  const closeAt = parseEventDateTime(event.office_close_at);

  if (!openAt || !closeAt) {
    return 'Godziny biura zawodów niedostępne';
  }

  const dayFormatter = new Intl.DateTimeFormat('pl-PL', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
  const timeFormatter = new Intl.DateTimeFormat('pl-PL', {
    hour: '2-digit',
    minute: '2-digit',
  });

  return `${dayFormatter.format(openAt)}, ${timeFormatter.format(openAt)} - ${timeFormatter.format(closeAt)}`;
}
