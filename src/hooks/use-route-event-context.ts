import { useEffect } from 'react';
import { useData } from '@/contexts/DataContext';

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

    const requiresOrganizationSync = currentRole === 'admin' && routeEvent.organization_id !== selectedOrganizationId;
    if (routeEventId !== selectedEventId || requiresOrganizationSync) {
      selectEventContext(routeEventId);
    }
  }, [currentRole, events, routeEventId, selectEventContext, selectedEventId, selectedOrganizationId]);
}
