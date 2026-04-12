import type { Role } from '@/types';

export const SCANNER_ROLES: Role[] = ['scanner', 'scanner_plus'];

export function isScannerRole(role: Role): boolean {
  return role === 'scanner' || role === 'scanner_plus';
}

export function getRoleLabel(role: Role): string {
  if (role === 'superadmin') return 'Superadmin';
  if (role === 'admin') return 'Admin';
  if (role === 'editor') return 'Organizator';
  if (role === 'scanner_plus') return 'Skaner plus';
  return 'Skaner';
}

export function getScannerPermissionLabel(role: Role): string {
  return role === 'scanner_plus' ? 'Rozszerzone' : 'Ograniczone';
}
