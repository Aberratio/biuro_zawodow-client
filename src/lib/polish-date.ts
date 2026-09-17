// Pola dat w aplikacji zawsze pokazują polski format DD.MM.RRRR (i godzinę GG:MM), niezależnie od języka
// przeglądarki. Na zewnątrz wymieniają wartości ISO: RRRR-MM-DD.

const ISO_DATE_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;
const LOOSE_POLISH_DATE_PATTERN = /^(\d{1,2})[./-](\d{1,2})[./-](\d{4})$/;

function pad(value: number | string): string {
  return String(value).padStart(2, "0");
}

function toValidDate(year: number, month: number, day: number): Date | null {
  if (year < 1000) return null;
  const date = new Date(year, month - 1, day);
  if (date.getFullYear() !== year || date.getMonth() !== month - 1 || date.getDate() !== day) return null;
  return date;
}

export function dateToIso(date: Date): string {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

export function isoToDate(value: string): Date | null {
  const match = value.match(ISO_DATE_PATTERN);
  if (!match) return null;
  return toValidDate(Number(match[1]), Number(match[2]), Number(match[3]));
}

/** "1990-05-12" → "12.05.1990"; niepoprawne wartości → "". */
export function formatIsoAsPolishDate(value: string): string {
  const match = value.match(ISO_DATE_PATTERN);
  if (!match || !isoToDate(value)) return "";
  return `${match[3]}.${match[2]}.${match[1]}`;
}

/** "12.05.1990" → "1990-05-12"; niepełne lub nieistniejące daty → "". */
export function parsePolishDate(text: string): string {
  const match = text.trim().match(LOOSE_POLISH_DATE_PATTERN);
  if (!match) return "";
  const date = toValidDate(Number(match[3]), Number(match[2]), Number(match[1]));
  return date ? dateToIso(date) : "";
}

/** Maska wpisywania: same cyfry, kropki dokładane automatycznie (DD.MM.RRRR). */
export function maskPolishDateInput(raw: string): string {
  const trimmed = raw.trim();
  // Wklejona pełna data (także "1.5.1990" albo ISO) — przepisz ją wprost, zamiast sklejać cyfry.
  const loose = trimmed.match(LOOSE_POLISH_DATE_PATTERN);
  if (loose) return `${pad(loose[1])}.${pad(loose[2])}.${loose[3]}`;
  const iso = trimmed.match(ISO_DATE_PATTERN);
  if (iso) return `${iso[3]}.${iso[2]}.${iso[1]}`;

  const digits = trimmed.replace(/\D/g, "").slice(0, 8);
  if (digits.length <= 2) return digits;
  if (digits.length <= 4) return `${digits.slice(0, 2)}.${digits.slice(2)}`;
  return `${digits.slice(0, 2)}.${digits.slice(2, 4)}.${digits.slice(4)}`;
}

export const TIME_PATTERN = /^([01]\d|2[0-3]):[0-5]\d$/;

/** Maska godziny 24h: same cyfry, dwukropek dokładany automatycznie (GG:MM). */
export function maskTimeInput(raw: string): string {
  const loose = raw.trim().match(/^(\d{1,2}):(\d{2})$/);
  if (loose) return `${pad(loose[1])}:${loose[2]}`;
  const digits = raw.replace(/\D/g, "").slice(0, 4);
  return digits.length <= 2 ? digits : `${digits.slice(0, 2)}:${digits.slice(2)}`;
}
