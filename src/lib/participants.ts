export function formatBibNumber(bibNumber: string | null | undefined, fallback = 'Brak numeru'): string {
  const normalized = (bibNumber ?? '').trim();
  return normalized ? `#${normalized}` : fallback;
}

export function formatParticipantCount(value: number): string {
  return value === 1 ? '1 uczestnika' : `${value} uczestników`;
}
