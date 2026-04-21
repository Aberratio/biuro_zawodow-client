import type { Role } from '@/types';

export const SCANNER_ROLES: Role[] = ['scanner', 'scanner_plus'];
export const PARTICIPANT_DATA_EDITOR_ROLES: Role[] = ['editor', 'admin', 'superadmin', 'scanner_plus'];
export const PARTICIPANT_ADMIN_ACTION_ROLES: Role[] = ['editor', 'admin', 'superadmin'];

export function isScannerRole(role: Role): boolean {
  return role === 'scanner' || role === 'scanner_plus';
}

export function canManageParticipantData(role: Role): boolean {
  return PARTICIPANT_DATA_EDITOR_ROLES.includes(role);
}

export function canUseParticipantAdminActions(role: Role): boolean {
  return PARTICIPANT_ADMIN_ACTION_ROLES.includes(role);
}

export function getRoleLabel(role: Role): string {
  if (role === 'superadmin') return 'Superadmin';
  if (role === 'admin') return 'Admin';
  if (role === 'editor') return 'Organizator';
  if (role === 'scanner_plus') return 'Operator Plus';
  return 'Operator';
}

export function getScannerPermissionLabel(role: Role): string {
  return role === 'scanner_plus' ? 'Rozszerzone' : 'Ograniczone';
}
