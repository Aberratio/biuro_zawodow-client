import type { Role } from '@/types';
import {
  canManageParticipantData,
  canUseParticipantAdminActions,
  getRoleLabel,
  getScannerPermissionLabel,
  hasGlobalOrganizationScope,
  isScannerRole,
} from './roles';

const roles: Role[] = ['superadmin', 'admin', 'editor', 'scanner', 'scanner_plus'];

describe('role helpers', () => {
  it('keeps scanner role detection narrow', () => {
    expect(roles.filter(isScannerRole)).toEqual(['scanner', 'scanner_plus']);
  });

  it('keeps organization context switching limited to global roles', () => {
    expect(roles.filter(hasGlobalOrganizationScope)).toEqual(['superadmin', 'admin']);
  });

  it('separates participant editing from administrative participant actions', () => {
    expect(roles.filter(canManageParticipantData)).toEqual(['superadmin', 'admin', 'editor', 'scanner_plus']);
    expect(roles.filter(canUseParticipantAdminActions)).toEqual(['superadmin', 'admin', 'editor']);
  });

  it('returns stable labels for every role and scanner permission tier', () => {
    expect(roles.map((role) => getRoleLabel(role))).toEqual([
      'Superadmin',
      'Admin',
      'Organizator',
      'Operator',
      'Operator Plus',
    ]);
    expect(roles.map((role) => getRoleLabel(role, 'accusative'))).toEqual([
      'Superadmina',
      'Admina',
      'Organizatora',
      'Operatora',
      'Operatora Plus',
    ]);
    expect(getScannerPermissionLabel('scanner')).toBe('Ograniczone');
    expect(getScannerPermissionLabel('scanner_plus')).toBe('Rozszerzone');
  });
});
