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

type RoleLabelForm = 'nominative' | 'accusative';

const roleLabels: Record<RoleLabelForm, Record<Role, string>> = {
  nominative: {
    superadmin: 'Superadmin',
    admin: 'Admin',
    editor: 'Organizator',
    scanner: 'Operator',
    scanner_plus: 'Operator Plus',
  },
  accusative: {
    superadmin: 'Superadmina',
    admin: 'Admina',
    editor: 'Organizatora',
    scanner: 'Operatora',
    scanner_plus: 'Operatora Plus',
  },
};

export function getRoleLabel(role: Role, form: RoleLabelForm = 'nominative'): string {
  return roleLabels[form][role];
}

export function getScannerPermissionLabel(role: Role): string {
  return role === 'scanner_plus' ? 'Rozszerzone' : 'Ograniczone';
}
