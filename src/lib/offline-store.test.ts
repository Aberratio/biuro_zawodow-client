import type { OfflineBootstrapSnapshot, PendingParticipantMutation } from './offline-store';
import {
  __resetOfflineStoreForTests,
  buildOfflineKey,
  clearOfflineData,
  createSnapshotVersion,
  loadBootstrapSnapshot,
  loadPendingMutations,
  loadSyncMeta,
  saveBootstrapSnapshot,
  savePendingMutation,
  updatePendingMutation,
} from './offline-store';

function snapshot(participantStatus = 'not_checked_in'): OfflineBootstrapSnapshot {
  return {
    key: buildOfflineKey('http://api.test', 'user-1'),
    apiBaseUrl: 'http://api.test',
    userId: 'user-1',
    savedAt: '2026-05-25T10:00:00.000Z',
    generatedAt: '2026-05-25T10:00:00.000Z',
    snapshotVersion: 'snapshot-test',
    selectedOrganizationId: 'org-1',
    selectedEventId: 'event-1',
    data: {
      organizations: [{ id: 'org-1', name: 'Org', event_limit: 1 }],
      events: [{ id: 'event-1', name: 'Event', location: 'Warsaw', organization_id: 'org-1', office_open_at: '2026-05-25 10:00:00', office_close_at: '2026-05-25 12:00:00' }],
      archivedEvents: [],
      users: [],
      participants: [{ id: 'p-1', event_id: 'event-1', name: 'Anna', email: 'anna@example.com', bib_number: '1', qr_code: 'qr-1', status: participantStatus as never, email_status: 'not_sent' }],
      activityLog: [],
    },
  };
}

function mutation(id: string, queuedAt: string): PendingParticipantMutation {
  return {
    id,
    apiBaseUrl: 'http://api.test',
    userId: 'user-1',
    participantId: 'p-1',
    participantApiId: '1',
    eventId: 'event-1',
    nextStatus: 'checked_in',
    baseStatus: 'not_checked_in',
    queuedAt,
    deviceId: 'device-1',
    state: 'queued',
    attempts: 0,
  };
}

describe('offline store memory fallback', () => {
  beforeEach(() => {
    __resetOfflineStoreForTests();
    vi.stubGlobal('indexedDB', undefined);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('saves bootstrap snapshots and sync metadata under the API/user key', async () => {
    const data = snapshot();

    await saveBootstrapSnapshot(data);

    expect(await loadBootstrapSnapshot('http://api.test', 'user-1')).toEqual(data);
    expect(await loadSyncMeta('http://api.test', 'user-1')).toEqual({
      key: 'http://api.test::user-1',
      apiBaseUrl: 'http://api.test',
      userId: 'user-1',
      lastSyncAt: data.savedAt,
      offlineSinceAt: null,
    });
  });

  it('sorts, updates, deletes and clears pending mutations scoped to the current user', async () => {
    await savePendingMutation(mutation('later', '2026-05-25T11:00:00.000Z'));
    await savePendingMutation(mutation('earlier', '2026-05-25T10:00:00.000Z'));

    expect((await loadPendingMutations('http://api.test', 'user-1')).map(item => item.id)).toEqual(['earlier', 'later']);

    await updatePendingMutation('earlier', current => ({ ...current, attempts: current.attempts + 1 }));
    expect((await loadPendingMutations('http://api.test', 'user-1'))[0].attempts).toBe(1);

    await updatePendingMutation('earlier', () => null);
    expect((await loadPendingMutations('http://api.test', 'user-1')).map(item => item.id)).toEqual(['later']);

    await clearOfflineData('http://api.test', 'user-1');
    expect(await loadPendingMutations('http://api.test', 'user-1')).toEqual([]);
    expect(await loadBootstrapSnapshot('http://api.test', 'user-1')).toBeNull();
  });

  it('changes snapshot version when participant sync-relevant data changes', () => {
    expect(createSnapshotVersion(snapshot().data)).not.toBe(createSnapshotVersion(snapshot('checked_in').data));
  });
});
