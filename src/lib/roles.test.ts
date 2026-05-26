import type { Role } from '@/types';
import {
  canManageParticipantData,
  canUseParticipantAdminActions,
  getRoleLabel,
  getScannerPermissionLabel,
  isScannerRole,
} from './roles';

const roles: Role[] = ['superadmin', 'admin', 'editor', 'scanner', 'scanner_plus'];

describe('role helpers', () => {
  it('keeps scanner role detection narrow', () => {
    expect(roles.filter(isScannerRole)).toEqual(['scanner', 'scanner_plus']);
  });

  it('separates participant editing from administrative participant actions', () => {
    expect(roles.filter(canManageParticipantData)).toEqual(['superadmin', 'admin', 'editor', 'scanner_plus']);
    expect(roles.filter(canUseParticipantAdminActions)).toEqual(['superadmin', 'admin', 'editor']);
  });

  it('returns stable labels for every role and scanner permission tier', () => {
    expect(roles.map(getRoleLabel)).toEqual(['Superadmin', 'Admin', 'Organizator', 'Operator', 'Operator Plus']);
    expect(getScannerPermissionLabel('scanner')).toBe('Ograniczone');
    expect(getScannerPermissionLabel('scanner_plus')).toBe('Rozszerzone');
  });
});
