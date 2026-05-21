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

export function buildEventImportSummaryPath(eventId: string): string {
  return `${buildEventImportPath(eventId)}/summary`;
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

export function buildEventParticipantDocumentHref(
  eventId: string,
  participantId: string,
): string {
  const path = buildEventParticipantPath(eventId, participantId);

  if (typeof window !== "undefined" && window.location.hash.startsWith("#/")) {
    return `${window.location.pathname}${window.location.search}#${path}`;
  }

  return path;
}

export function buildEventEmailsPath(eventId: string): string {
  return `${buildEventPath(eventId)}/emails`;
}
