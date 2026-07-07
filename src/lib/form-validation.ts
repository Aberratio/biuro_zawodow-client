export function isValidEmailAddress(email: string, maxLength?: number): boolean {
  const trimmed = email.trim();
  if (maxLength !== undefined && trimmed.length > maxLength) return false;
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed);
}

export function validateRequired(value: string, message: string): string {
  return value.trim() ? "" : message;
}

export function validateNonNegativeInteger(value: string, message: string): string {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed >= 0 ? "" : message;
}

export function validateEmail(value: string, emptyMessage = "Podaj adres email.", maxLength?: number): string {
  const email = value.trim();
  if (!email) return emptyMessage;
  if (maxLength !== undefined && email.length > maxLength) {
    return `Adres e-mail może mieć maksymalnie ${maxLength} znaków.`;
  }
  return isValidEmailAddress(email) ? "" : "Podaj poprawny adres email.";
}

export function validateStrongPassword(value: string): string {
  if (!value) return "Podaj hasło.";
  if (value.length < 10) return "Hasło musi mieć minimum 10 znaków.";
  if (!/[a-z]/.test(value)) return "Hasło musi zawierać małą literę.";
  if (!/[A-Z]/.test(value)) return "Hasło musi zawierać wielką literę.";
  if (!/\d/.test(value)) return "Hasło musi zawierać cyfrę.";
  if (!/[^A-Za-z0-9]/.test(value)) return "Hasło musi zawierać znak specjalny.";
  return "";
}

export function validatePasswordConfirmation(password: string, confirmation: string): string {
  if (!confirmation) return "Powtórz hasło.";
  return password === confirmation ? "" : "Hasła muszą być takie same.";
}
