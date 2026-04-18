export function formatBibNumber(bibNumber: string | null | undefined, fallback = 'Brak numeru'): string {
  const normalized = (bibNumber ?? '').trim();
  return normalized ? `#${normalized}` : fallback;
}
