// Lustro QrCodeService::isSecureToken po stronie API (src/QrCodeService.php).
// Trzymamy wzorzec w jednym miejscu, bo docelowo dojdzie drugi prefiks (kod
// tozsamosci zawodnika) i wtedy zmiana ma byc jednolinijkowa.
const SECURE_QR_TOKEN_PATTERN = /^pqr_[a-f0-9]{48}$/;

export function isSecureQrToken(value: string | null | undefined) {
  return SECURE_QR_TOKEN_PATTERN.test(String(value ?? '').trim());
}
