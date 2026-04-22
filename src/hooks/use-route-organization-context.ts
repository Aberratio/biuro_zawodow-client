import { useEffect } from 'react';
import { useData } from '@/contexts/DataContext';

export function useRouteOrganizationContext(routeOrganizationId: string) {
  const {
    organizations,
    currentRole,
    selectedOrganizationId,
    setSelectedOrganizationId,
  } = useData();

  useEffect(() => {
    if (currentRole !== 'admin' || !routeOrganizationId) {
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
