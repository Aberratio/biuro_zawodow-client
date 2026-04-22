function encodeRouteParam(value: string): string {
  return encodeURIComponent(value);
}

export function buildOrganizationPath(organizationId: string): string {
  return `/organizations/${encodeRouteParam(organizationId)}`;
}

export function buildOrganizationArchivedEventsPath(
  organizationId: string,
): string {
  return `${buildOrganizationPath(organizationId)}/archived-events`;
}

export function buildEventPath(eventId: string): string {
  return `/events/${encodeRouteParam(eventId)}`;
}

export function buildEventImportPath(eventId: string): string {
  return `${buildEventPath(eventId)}/import`;
}

export function buildEventParticipantsPath(eventId: string): string {
  return `${buildEventPath(eventId)}/participants`;
}

export function buildEventParticipantPath(
  eventId: string,
  participantId: string,
): string {
  return `${buildEventParticipantsPath(eventId)}/${encodeRouteParam(participantId)}`;
}

export function buildEventEmailsPath(eventId: string): string {
  return `${buildEventPath(eventId)}/emails`;
}
