import {
  buildEventEmailsPath,
  buildEventImportPath,
  buildEventImportSummaryPath,
  buildEventParticipantDocumentHref,
  buildEventParticipantPath,
  buildEventParticipantsPath,
  buildEventPath,
  buildOrganizationArchivedEventsPath,
  buildOrganizationPath,
} from './routes';

describe('route builders', () => {
  it('encodes route identifiers and composes nested paths', () => {
    expect(buildOrganizationPath('org 1/2')).toBe('/organizations/org%201%2F2');
    expect(buildOrganizationArchivedEventsPath('org 1/2')).toBe('/organizations/org%201%2F2/archived-events');
    expect(buildEventPath('event 1/2')).toBe('/events/event%201%2F2');
    expect(buildEventImportPath('event 1')).toBe('/events/event%201/import');
    expect(buildEventImportSummaryPath('event 1')).toBe('/events/event%201/import/summary');
    expect(buildEventParticipantsPath('event 1')).toBe('/events/event%201/participants');
    expect(buildEventParticipantPath('event 1', 'p/1')).toBe('/events/event%201/participants/p%2F1');
    expect(buildEventEmailsPath('event 1')).toBe('/events/event%201/emails');
  });

  it('builds document hrefs that preserve hash-router deployments', () => {
    window.history.replaceState(null, '', '/app/index.html?x=1#/events');

    expect(buildEventParticipantDocumentHref('event 1', 'p/1')).toBe(
      '/app/index.html?x=1#/events/event%201/participants/p%2F1',
    );
  });
});
