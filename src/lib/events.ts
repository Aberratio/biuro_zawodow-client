import type { Event } from '@/types';

function normalizeDateTimeInput(value: string): string {
  return value.includes(' ') ? value.replace(' ', 'T') : value;
}

export function parseEventDateTime(value: string): Date | null {
  if (!value) return null;

  const parsed = new Date(normalizeDateTimeInput(value));
  return Number.isNaN(parsed.getTime()) ? null : parsed;
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
  return parsedOpenAt < parsedCloseAt;
}

export function getEventOfficeOpenAt(event: Pick<Event, 'office_open_at'>): Date | null {
  return parseEventDateTime(event.office_open_at);
}

export function getEventOfficeCloseAt(event: Pick<Event, 'office_close_at'>): Date | null {
  return parseEventDateTime(event.office_close_at);
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
