import type { QrDeliveryEffectiveStatus } from '@/types';

type BadgeVariant = 'default' | 'secondary' | 'destructive' | 'outline';

// 'no_data' nie przychodzi z mailera — oznacza uczestnika z lokalnym statusem "wysłany",
// ale bez skorelowanego rekordu w mailerze (wysyłki sprzed wdrożenia śledzenia).
export type QrDeliveryDisplayStatus = QrDeliveryEffectiveStatus | 'no_data';

export interface QrDeliveryStatusDefinition {
  code: QrDeliveryDisplayStatus;
  label: string;
  shortLabel: string;
  badgeVariant: BadgeVariant;
}

// Etykieta 'sent' celowo brzmi "Wysłany", nie "Dostarczony" — mailer potwierdza
// tylko przyjęcie przez serwer SMTP, nie dotarcie do skrzynki.
export const QR_DELIVERY_STATUS_DEFINITIONS: QrDeliveryStatusDefinition[] = [
  { code: 'sent', label: 'Wysłany', shortLabel: 'Wysłany', badgeVariant: 'default' },
  { code: 'pending', label: 'W kolejce', shortLabel: 'W kolejce', badgeVariant: 'secondary' },
  { code: 'processing', label: 'Wysyłanie', shortLabel: 'Wysyłanie', badgeVariant: 'secondary' },
  { code: 'retry', label: 'Ponowna próba', shortLabel: 'Ponowna próba', badgeVariant: 'secondary' },
  { code: 'bounced', label: 'Odbity — nie dostarczono', shortLabel: 'Odbity', badgeVariant: 'destructive' },
  { code: 'failed', label: 'Błąd wysyłki', shortLabel: 'Błąd', badgeVariant: 'destructive' },
  { code: 'suppressed', label: 'Adres zablokowany', shortLabel: 'Zablokowany', badgeVariant: 'destructive' },
  { code: 'unknown', label: 'Nieznany wynik', shortLabel: 'Nieznany', badgeVariant: 'outline' },
  { code: 'no_data', label: 'Brak danych o dostarczeniu', shortLabel: 'Brak danych', badgeVariant: 'outline' },
];

export const QR_DELIVERY_STATUS_MAP = Object.fromEntries(
  QR_DELIVERY_STATUS_DEFINITIONS.map(status => [status.code, status])
) as Record<QrDeliveryDisplayStatus, QrDeliveryStatusDefinition>;

export function normalizeQrDeliveryStatus(status: string | null | undefined): QrDeliveryDisplayStatus {
  switch (status) {
    case 'pending':
    case 'processing':
    case 'retry':
    case 'sent':
    case 'failed':
    case 'bounced':
    case 'suppressed':
    case 'no_data':
      return status;
    default:
      return 'unknown';
  }
}

export function getQrDeliveryStatusDefinition(status: string | null | undefined): QrDeliveryStatusDefinition {
  return QR_DELIVERY_STATUS_MAP[normalizeQrDeliveryStatus(status)];
}

/** Statusy grupowane do chipów podsumowania na stronie wysyłki. */
export function isQueuedQrDeliveryStatus(status: QrDeliveryDisplayStatus): boolean {
  return status === 'pending' || status === 'processing' || status === 'retry';
}

export function isFailedQrDeliveryStatus(status: QrDeliveryDisplayStatus): boolean {
  return status === 'failed' || status === 'suppressed';
}
