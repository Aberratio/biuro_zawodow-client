import type { Event, EventOfficeHourRange, EventOfficeLocation } from '@/types';

const MIN_EVENT_OFFICE_DURATION_MS = 60 * 60 * 1000;

export type EventOfficeRangeValidationResult =
  | 'valid'
  | 'invalid'
  | 'close_not_after_open'
  | 'shorter_than_minimum';

interface EventOfficeValidationOptions {
  allowPastOpenAt?: boolean;
}

interface EventOfficeValidationErrors {
  office_open_at?: string;
  office_close_at?: string;
}

function normalizeDateTimeInput(value: string): string {
  return value.includes(' ') ? value.replace(' ', 'T') : value;
}

function padDateTimePart(value: number): string {
  return String(value).padStart(2, '0');
}

function truncateDateToMinute(date: Date): Date {
  const truncated = new Date(date);
  truncated.setSeconds(0, 0);
  return truncated;
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

export interface EventOfficeHourRangeInstance {
  opensAt: Date;
  closesAt: Date;
}

/**
 * Every parsable hour range of every location, sorted by start. The single source for
 * "when is the office really open" — the aggregate office_open_at/office_close_at pair
 * cannot express the gap between the days of a multi-day event.
 */
function getEventOfficeHourRanges(event: Pick<Event, 'office_locations'>): EventOfficeHourRangeInstance[] {
  return event.office_locations
    .flatMap(location => location.hours)
    .map(range => ({
      opensAt: parseEventDateTime(range.opens_at),
      closesAt: parseEventDateTime(range.closes_at),
    }))
    .filter((range): range is EventOfficeHourRangeInstance => range.opensAt !== null && range.closesAt !== null)
    .sort((left, right) => left.opensAt.getTime() - right.opensAt.getTime());
}

export function getCurrentEventOfficeHourRange(
  event: Pick<Event, 'office_locations'>,
  now = new Date(),
): EventOfficeHourRangeInstance | null {
  return getEventOfficeHourRanges(event).find(range => now >= range.opensAt && now <= range.closesAt) ?? null;
}

export function getFirstEventOfficeHourRange(
  event: Pick<Event, 'office_locations'>,
): EventOfficeHourRangeInstance | null {
  return getEventOfficeHourRanges(event)[0] ?? null;
}

export function getNextEventOfficeHourRange(
  event: Pick<Event, 'office_locations'>,
  now = new Date(),
): EventOfficeHourRangeInstance | null {
  return getEventOfficeHourRanges(event).find(range => range.opensAt > now) ?? null;
}

export function getLastEventOfficeHourRange(
  event: Pick<Event, 'office_locations'>,
): EventOfficeHourRangeInstance | null {
  return getEventOfficeHourRanges(event).reduce<EventOfficeHourRangeInstance | null>(
    (latest, range) => (latest === null || range.closesAt > latest.closesAt ? range : latest),
    null,
  );
}

export function isEventOfficeOpen(event: Pick<Event, 'office_locations'>, now = new Date()): boolean {
  return getCurrentEventOfficeHourRange(event, now) !== null;
}

export function isValidEventOfficeRange(openAt: string, closeAt: string): boolean {
  return getEventOfficeRangeValidationResult(openAt, closeAt) === 'valid';
}

export function getEventOfficeValidationErrors(
  openAt: string,
  closeAt: string,
  options: EventOfficeValidationOptions = {},
): EventOfficeValidationErrors {
  const { allowPastOpenAt = false } = options;

  if (openAt && !allowPastOpenAt && !isEventOfficeStartAtOrAfterNow(openAt)) {
    return {
      office_open_at: 'Otwarcie biura nie może być ustawione w przeszłości.',
    };
  }

  if (!openAt || !closeAt) {
    return {};
  }

  const rangeValidation = getEventOfficeRangeValidationResult(openAt, closeAt);

  if (rangeValidation === 'shorter_than_minimum') {
    return {
      office_close_at: 'Biuro musi być otwarte przez co najmniej 1 godzinę.',
    };
  }

  if (rangeValidation !== 'valid') {
    return {
      office_close_at: 'Zamknięcie biura musi być później niż otwarcie.',
    };
  }

  return {};
}

export function getEventOfficeRangeValidationResult(openAt: string, closeAt: string): EventOfficeRangeValidationResult {
  const parsedOpenAt = parseEventDateTime(openAt);
  const parsedCloseAt = parseEventDateTime(closeAt);

  if (!parsedOpenAt || !parsedCloseAt) return 'invalid';

  if (parsedCloseAt.getTime() <= parsedOpenAt.getTime()) {
    return 'close_not_after_open';
  }

  if (parsedCloseAt.getTime() - parsedOpenAt.getTime() < MIN_EVENT_OFFICE_DURATION_MS) {
    return 'shorter_than_minimum';
  }

  return 'valid';
}

export function isEventOfficeStartAtOrAfterNow(openAt: string, now = new Date()): boolean {
  const parsedOpenAt = parseEventDateTime(openAt);

  if (!parsedOpenAt) return false;
  return parsedOpenAt.getTime() >= truncateDateToMinute(now).getTime();
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

const OFFICE_DATE_TIME_FORMATTER = new Intl.DateTimeFormat('pl-PL', {
  day: '2-digit',
  month: '2-digit',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
});

export function formatEventOfficeDateTime(date: Date): string {
  return OFFICE_DATE_TIME_FORMATTER.format(date);
}

export function formatEventOfficeStart(event: Pick<Event, 'office_open_at'>): string {
  const openAt = getEventOfficeOpenAt(event);
  if (!openAt) {
    return 'Termin otwarcia biura niedostępny';
  }

  return formatEventOfficeDateTime(openAt);
}

export function formatEventOfficeEnd(event: Pick<Event, 'office_close_at'>): string {
  const closeAt = getEventOfficeCloseAt(event);
  if (!closeAt) {
    return 'Termin zamknięcia biura niedostępny';
  }

  return formatEventOfficeDateTime(closeAt);
}

const OFFICE_WINDOW_DAY_FORMATTER = new Intl.DateTimeFormat('pl-PL', {
  day: '2-digit',
  month: '2-digit',
  year: 'numeric',
});
const OFFICE_WINDOW_TIME_FORMATTER = new Intl.DateTimeFormat('pl-PL', {
  hour: '2-digit',
  minute: '2-digit',
});
const OFFICE_WINDOW_WEEKDAY_FORMATTER = new Intl.DateTimeFormat('pl-PL', { weekday: 'short' });
const OFFICE_WINDOW_SHORT_DAY_FORMATTER = new Intl.DateTimeFormat('pl-PL', {
  day: '2-digit',
  month: '2-digit',
});

export function formatEventOfficeWindow(event: Pick<Event, 'office_open_at' | 'office_close_at'>): string {
  const openAt = parseEventDateTime(event.office_open_at);
  const closeAt = parseEventDateTime(event.office_close_at);

  if (!openAt || !closeAt) {
    return 'Godziny biura zawodów niedostępne';
  }

  const openDayLabel = OFFICE_WINDOW_DAY_FORMATTER.format(openAt);
  const closeDayLabel = OFFICE_WINDOW_DAY_FORMATTER.format(closeAt);

  if (openDayLabel === closeDayLabel) {
    return `${openDayLabel}, ${OFFICE_WINDOW_TIME_FORMATTER.format(openAt)} - ${OFFICE_WINDOW_TIME_FORMATTER.format(closeAt)}`;
  }

  return `${openDayLabel}, ${OFFICE_WINDOW_TIME_FORMATTER.format(openAt)} - ${closeDayLabel}, ${OFFICE_WINDOW_TIME_FORMATTER.format(closeAt)}`;
}

export function formatEventOfficeLocationRanges(location: Pick<EventOfficeLocation, 'hours'>): string[] {
  return location.hours.map(
    range =>
      formatEventOfficeHourRangeWithWeekday(range, { withYear: true }) ?? 'Godziny biura zawodów niedostępne',
  );
}

interface EventOfficeHourRangeFormatOptions {
  withYear?: boolean;
}

function formatEventOfficeDayLabel(date: Date, withYear: boolean): string {
  const weekdayLabel = OFFICE_WINDOW_WEEKDAY_FORMATTER.format(date).replace(/\.$/, '');
  const capitalizedWeekdayLabel = weekdayLabel.charAt(0).toUpperCase() + weekdayLabel.slice(1);
  const dayLabel = withYear
    ? OFFICE_WINDOW_DAY_FORMATTER.format(date)
    : OFFICE_WINDOW_SHORT_DAY_FORMATTER.format(date);

  return `${capitalizedWeekdayLabel} ${dayLabel}`;
}

/**
 * Formats a single hour range with its weekday/date, e.g. "Pt 12.09, 15:00 - 19:00" —
 * used where ranges from different locations/days must stay visually distinct instead
 * of being collapsed into one aggregate window. A range crossing midnight repeats the
 * day on both sides so the change of day never disappears from the label.
 */
export function formatEventOfficeHourRangeWithWeekday(
  range: Pick<EventOfficeHourRange, 'opens_at' | 'closes_at'>,
  options: EventOfficeHourRangeFormatOptions = {},
): string | null {
  const opensAt = parseEventDateTime(range.opens_at);
  const closesAt = parseEventDateTime(range.closes_at);

  if (!opensAt || !closesAt) {
    return null;
  }

  const { withYear = false } = options;
  const openDayLabel = formatEventOfficeDayLabel(opensAt, withYear);
  const closeDayLabel = formatEventOfficeDayLabel(closesAt, withYear);
  const openTime = OFFICE_WINDOW_TIME_FORMATTER.format(opensAt);
  const closeTime = OFFICE_WINDOW_TIME_FORMATTER.format(closesAt);

  if (openDayLabel === closeDayLabel) {
    return `${openDayLabel}, ${openTime} - ${closeTime}`;
  }

  return `${openDayLabel}, ${openTime} - ${closeDayLabel}, ${closeTime}`;
}

/**
 * Real opening hours of an event: every hour range of every location, sorted by start
 * and deduplicated. Replaces the aggregate min(open)/max(close) window, which claimed the
 * office was open overnight between the days of a multi-day event.
 */
export function getEventOfficeScheduleEntries(event: Pick<Event, 'office_locations'>): string[] {
  const entries = event.office_locations
    .flatMap(location =>
      location.hours.map(range => ({
        sortKey: toLocalDateTimeValue(range.opens_at),
        label: formatEventOfficeHourRangeWithWeekday(range, { withYear: true }),
      })),
    )
    .filter((entry): entry is { sortKey: string; label: string } => entry.label !== null)
    .sort((left, right) => left.sortKey.localeCompare(right.sortKey));

  return [...new Set(entries.map(entry => entry.label))];
}

export function formatEventOfficeSchedule(
  event: Pick<Event, 'office_locations' | 'office_open_at' | 'office_close_at'>,
): string {
  const entries = getEventOfficeScheduleEntries(event);

  if (entries.length === 0) {
    return formatEventOfficeWindow(event);
  }

  return entries.join(' • ');
}

export function isValidOptionalUrl(value: string): boolean {
  const trimmed = value.trim();
  if (trimmed === '') return true;

  try {
    const parsed = new URL(trimmed);
    return parsed.protocol === 'http:' || parsed.protocol === 'https:';
  } catch {
    return false;
  }
}

export function computeEventOfficeWindowFromLocations(
  locations: EventOfficeLocation[],
): { opensAt: string | null; closesAt: string | null } {
  let opensAt: string | null = null;
  let closesAt: string | null = null;

  for (const location of locations) {
    for (const range of location.hours) {
      if (!range.opens_at || !range.closes_at) continue;

      const normalizedOpensAt = toLocalDateTimeValue(range.opens_at);
      const normalizedClosesAt = toLocalDateTimeValue(range.closes_at);

      if (opensAt === null || normalizedOpensAt < opensAt) {
        opensAt = normalizedOpensAt;
      }
      if (closesAt === null || normalizedClosesAt > closesAt) {
        closesAt = normalizedClosesAt;
      }
    }
  }

  return { opensAt, closesAt };
}

export interface EventOfficeHourRangeErrors {
  opens_at?: string;
  closes_at?: string;
}

export interface EventOfficeLocationErrors {
  name?: string;
  google_maps_url?: string;
  form?: string;
  hours?: EventOfficeHourRangeErrors[];
}

export interface EventOfficeLocationsValidationErrors {
  form?: string;
  locations: EventOfficeLocationErrors[];
}

function hasAnyEventOfficeLocationError(errors: EventOfficeLocationErrors): boolean {
  return Boolean(
    errors.name ||
    errors.google_maps_url ||
    errors.form ||
    errors.hours?.some(rangeErrors => rangeErrors.opens_at || rangeErrors.closes_at),
  );
}

export function getEventOfficeLocationsValidationErrors(
  locations: EventOfficeLocation[],
  options: EventOfficeValidationOptions = {},
): EventOfficeLocationsValidationErrors {
  if (locations.length === 0) {
    return { form: 'Dodaj co najmniej jedną lokalizację biura zawodów.', locations: [] };
  }

  const locationErrors = locations.map((location): EventOfficeLocationErrors => {
    const errors: EventOfficeLocationErrors = {};

    if (!location.name.trim()) {
      errors.name = 'Nazwa lokalizacji jest wymagana.';
    }

    if (location.google_maps_url && !isValidOptionalUrl(location.google_maps_url)) {
      errors.google_maps_url = 'Link do Google Maps jest nieprawidłowy.';
    }

    if (location.hours.length === 0) {
      errors.form = 'Dodaj co najmniej jeden zakres godzin.';
      return errors;
    }

    errors.hours = location.hours.map((range): EventOfficeHourRangeErrors => {
      const rangeValidation = getEventOfficeRangeValidationResult(range.opens_at, range.closes_at);

      if (rangeValidation === 'invalid') {
        return {
          opens_at: 'Podaj prawidłową datę i godzinę.',
          closes_at: 'Podaj prawidłową datę i godzinę.',
        };
      }

      if (rangeValidation === 'close_not_after_open') {
        return { closes_at: 'Zamknięcie musi być później niż otwarcie.' };
      }

      if (rangeValidation === 'shorter_than_minimum') {
        return { closes_at: 'Ten zakres musi trwać co najmniej 1 godzinę.' };
      }

      return {};
    });

    return errors;
  });

  if (locationErrors.some(hasAnyEventOfficeLocationError)) {
    return { locations: locationErrors };
  }

  const { opensAt, closesAt } = computeEventOfficeWindowFromLocations(locations);
  if (!opensAt || !closesAt) {
    return {
      form: 'Nie udało się wyznaczyć okna otwarcia biura zawodów.',
      locations: locationErrors,
    };
  }

  const { allowPastOpenAt = false } = options;
  if (!allowPastOpenAt && !isEventOfficeStartAtOrAfterNow(opensAt)) {
    return {
      form: 'Otwarcie biura nie może być ustawione w przeszłości.',
      locations: locationErrors,
    };
  }

  return { locations: locationErrors };
}
