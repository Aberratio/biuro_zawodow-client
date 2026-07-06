import { useEffect } from 'react';
import { useData } from '@/contexts/DataContext';
import { hasGlobalOrganizationScope } from '@/lib/roles';

export function useRouteEventContext(routeEventId: string) {
  const {
    events,
    currentRole,
    selectedOrganizationId,
    selectedEventId,
    selectEventContext,
  } = useData();

  useEffect(() => {
    if (!routeEventId) {
      return;
    }

    const routeEvent = events.find(event => event.id === routeEventId);
    if (!routeEvent) {
      return;
    }

    const requiresOrganizationSync = hasGlobalOrganizationScope(currentRole) && routeEvent.organization_id !== selectedOrganizationId;
    if (routeEventId !== selectedEventId || requiresOrganizationSync) {
      selectEventContext(routeEventId);
    }
  }, [currentRole, events, routeEventId, selectEventContext, selectedEventId, selectedOrganizationId]);
}
