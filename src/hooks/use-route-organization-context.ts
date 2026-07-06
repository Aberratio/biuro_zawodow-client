import { useEffect } from 'react';
import { useData } from '@/contexts/DataContext';
import { hasGlobalOrganizationScope } from '@/lib/roles';

export function useRouteOrganizationContext(routeOrganizationId: string) {
  const {
    organizations,
    currentRole,
    selectedOrganizationId,
    setSelectedOrganizationId,
  } = useData();

  useEffect(() => {
    if (!hasGlobalOrganizationScope(currentRole) || !routeOrganizationId) {
      return;
    }

    const routeOrganizationExists = organizations.some(
      organization => organization.id === routeOrganizationId,
    );
    if (!routeOrganizationExists || routeOrganizationId === selectedOrganizationId) {
      return;
    }

    setSelectedOrganizationId(routeOrganizationId);
  }, [
    currentRole,
    organizations,
    routeOrganizationId,
    selectedOrganizationId,
    setSelectedOrganizationId,
  ]);
}
