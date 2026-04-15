import type { ActivityLog, Event, Organization, Participant, ParticipantStatus, ParticipantSyncState, User } from '@/types';

const DB_NAME = 'biuro-zawodow-offline';
const DB_VERSION = 1;
const STORE_BOOTSTRAP = 'bootstrapSnapshots';
const STORE_INDEX = 'participantIndexByEvent';
const STORE_MUTATIONS = 'pendingMutations';
const STORE_META = 'syncMeta';

type StoreName =
  | typeof STORE_BOOTSTRAP
  | typeof STORE_INDEX
  | typeof STORE_MUTATIONS
  | typeof STORE_META;

type MemoryStores = Record<StoreName, Map<string, unknown>>;

const memoryStores: MemoryStores = {
  bootstrapSnapshots: new Map(),
  participantIndexByEvent: new Map(),
  pendingMutations: new Map(),
  syncMeta: new Map(),
};

export interface OfflineBootstrapSnapshot {
  key: string;
  apiBaseUrl: string;
  userId: string;
  savedAt: string;
  generatedAt: string;
  snapshotVersion: string;
  selectedOrganizationId: string;
  selectedEventId: string;
  data: {
    organizations: Organization[];
    events: Event[];
    archivedEvents: Event[];
    users: User[];
    participants: Participant[];
    activityLog: ActivityLog[];
  };
}

export interface OfflineParticipantIndex {
  key: string;
  apiBaseUrl: string;
  userId: string;
  eventId: string;
  items: Array<{ qrCode: string; participantId: string }>;
}

export interface PendingParticipantMutation {
  id: string;
  apiBaseUrl: string;
  userId: string;
  participantId: string;
  participantApiId: string;
  eventId: string;
  nextStatus: ParticipantStatus;
  baseStatus: ParticipantStatus;
  queuedAt: string;
  deviceId: string;
  state: 'queued' | 'requires_review';
  attempts: number;
  error?: string;
  syncState?: ParticipantSyncState;
}

export interface OfflineSyncMeta {
  key: string;
  apiBaseUrl: string;
  userId: string;
  lastSyncAt: string | null;
  offlineSinceAt: string | null;
}

function supportsIndexedDb(): boolean {
  return typeof indexedDB !== 'undefined';
}

function requestToPromise<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

function transactionToPromise(transaction: IDBTransaction): Promise<void> {
  return new Promise((resolve, reject) => {
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error);
    transaction.onabort = () => reject(transaction.error);
  });
}

let dbPromise: Promise<IDBDatabase> | null = null;

function getDb(): Promise<IDBDatabase> {
  if (dbPromise) {
    return dbPromise;
  }

  dbPromise = new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = () => {
      const db = request.result;

      if (!db.objectStoreNames.contains(STORE_BOOTSTRAP)) {
        db.createObjectStore(STORE_BOOTSTRAP, { keyPath: 'key' });
      }
      if (!db.objectStoreNames.contains(STORE_INDEX)) {
        db.createObjectStore(STORE_INDEX, { keyPath: 'key' });
      }
      if (!db.objectStoreNames.contains(STORE_MUTATIONS)) {
        db.createObjectStore(STORE_MUTATIONS, { keyPath: 'id' });
      }
      if (!db.objectStoreNames.contains(STORE_META)) {
        db.createObjectStore(STORE_META, { keyPath: 'key' });
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });

  return dbPromise;
}

async function withStore<T>(storeName: StoreName, mode: IDBTransactionMode, action: (store: IDBObjectStore) => Promise<T>): Promise<T> {
  if (!supportsIndexedDb()) {
    const map = memoryStores[storeName];
    const pseudoStore = {
      get: (key: string) => Promise.resolve(map.get(key) as T),
      put: (value: { key?: string; id?: string }) => {
        const key = String(value.key ?? value.id ?? '');
        map.set(key, value);
        return Promise.resolve(undefined as T);
      },
    };
    return action(pseudoStore as unknown as IDBObjectStore);
  }

  const db = await getDb();
  const transaction = db.transaction(storeName, mode);
  const store = transaction.objectStore(storeName);
  const result = await action(store);
  await transactionToPromise(transaction);
  return result;
}

async function putRecord<T extends { key?: string; id?: string }>(storeName: StoreName, value: T): Promise<void> {
  if (!supportsIndexedDb()) {
    const key = String(value.key ?? value.id ?? '');
    memoryStores[storeName].set(key, value);
    return;
  }

  await withStore(storeName, 'readwrite', async store => {
    await requestToPromise(store.put(value));
  });
}

async function getRecord<T>(storeName: StoreName, key: string): Promise<T | null> {
  if (!supportsIndexedDb()) {
    return (memoryStores[storeName].get(key) as T | undefined) ?? null;
  }

  return withStore(storeName, 'readonly', async store => {
    const value = await requestToPromise(store.get(key));
    return (value as T | undefined) ?? null;
  });
}

async function deleteRecord(storeName: StoreName, key: string): Promise<void> {
  if (!supportsIndexedDb()) {
    memoryStores[storeName].delete(key);
    return;
  }

  await withStore(storeName, 'readwrite', async store => {
    await requestToPromise(store.delete(key));
  });
}

async function getAllRecords<T>(storeName: StoreName): Promise<T[]> {
  if (!supportsIndexedDb()) {
    return Array.from(memoryStores[storeName].values()) as T[];
  }

  return withStore(storeName, 'readonly', async store => {
    const records = await requestToPromise(store.getAll());
    return records as T[];
  });
}

export function buildOfflineKey(apiBaseUrl: string, userId: string): string {
  return `${apiBaseUrl}::${userId}`;
}

function buildParticipantIndexKey(apiBaseUrl: string, userId: string, eventId: string): string {
  return `${buildOfflineKey(apiBaseUrl, userId)}::${eventId}`;
}

export async function saveBootstrapSnapshot(snapshot: OfflineBootstrapSnapshot): Promise<void> {
  await putRecord(STORE_BOOTSTRAP, snapshot);

  const participantsByEvent = snapshot.data.participants.reduce<Record<string, Array<{ qrCode: string; participantId: string }>>>((accumulator, participant) => {
    if (!participant.qr_code) {
      return accumulator;
    }

    accumulator[participant.event_id] ??= [];
    accumulator[participant.event_id].push({
      qrCode: participant.qr_code,
      participantId: participant.id,
    });

    return accumulator;
  }, {});

  await Promise.all(
    Object.entries(participantsByEvent).map(([eventId, items]) => putRecord(STORE_INDEX, {
      key: buildParticipantIndexKey(snapshot.apiBaseUrl, snapshot.userId, eventId),
      apiBaseUrl: snapshot.apiBaseUrl,
      userId: snapshot.userId,
      eventId,
      items,
    } satisfies OfflineParticipantIndex))
  );

  await saveSyncMeta({
    key: buildOfflineKey(snapshot.apiBaseUrl, snapshot.userId),
    apiBaseUrl: snapshot.apiBaseUrl,
    userId: snapshot.userId,
    lastSyncAt: snapshot.savedAt,
    offlineSinceAt: null,
  });
}

export function createSnapshotVersion(snapshotData: OfflineBootstrapSnapshot['data']): string {
  const source = JSON.stringify({
    organizations: snapshotData.organizations.length,
    events: snapshotData.events.map(event => event.id),
    archivedEvents: snapshotData.archivedEvents.map(event => event.id),
    users: snapshotData.users.map(user => user.id),
    participants: snapshotData.participants.map(participant => `${participant.id}:${participant.status}:${participant.email_status}`),
    activityLog: snapshotData.activityLog.map(log => log.id),
  });

  let hash = 0;
  for (let index = 0; index < source.length; index += 1) {
    hash = ((hash << 5) - hash) + source.charCodeAt(index);
    hash |= 0;
  }

  return `snapshot-${Math.abs(hash)}`;
}

export async function loadBootstrapSnapshot(apiBaseUrl: string, userId: string): Promise<OfflineBootstrapSnapshot | null> {
  return getRecord<OfflineBootstrapSnapshot>(STORE_BOOTSTRAP, buildOfflineKey(apiBaseUrl, userId));
}

export async function savePendingMutation(mutation: PendingParticipantMutation): Promise<void> {
  await putRecord(STORE_MUTATIONS, mutation);
}

export async function updatePendingMutation(mutationId: string, update: (mutation: PendingParticipantMutation) => PendingParticipantMutation | null): Promise<PendingParticipantMutation | null> {
  const current = await getRecord<PendingParticipantMutation>(STORE_MUTATIONS, mutationId);
  if (!current) {
    return null;
  }

  const next = update(current);
  if (!next) {
    await deleteRecord(STORE_MUTATIONS, mutationId);
    return null;
  }

  await savePendingMutation(next);
  return next;
}

export async function deletePendingMutation(mutationId: string): Promise<void> {
  await deleteRecord(STORE_MUTATIONS, mutationId);
}

export async function loadPendingMutations(apiBaseUrl: string, userId: string): Promise<PendingParticipantMutation[]> {
  const allMutations = await getAllRecords<PendingParticipantMutation>(STORE_MUTATIONS);
  return allMutations
    .filter(mutation => mutation.apiBaseUrl === apiBaseUrl && mutation.userId === userId)
    .sort((first, second) => first.queuedAt.localeCompare(second.queuedAt));
}

export async function saveSyncMeta(meta: OfflineSyncMeta): Promise<void> {
  await putRecord(STORE_META, meta);
}

export async function loadSyncMeta(apiBaseUrl: string, userId: string): Promise<OfflineSyncMeta | null> {
  return getRecord<OfflineSyncMeta>(STORE_META, buildOfflineKey(apiBaseUrl, userId));
}

export async function clearOfflineData(apiBaseUrl: string, userId: string): Promise<void> {
  const baseKey = buildOfflineKey(apiBaseUrl, userId);
  await deleteRecord(STORE_BOOTSTRAP, baseKey);
  await deleteRecord(STORE_META, baseKey);

  const [indexes, mutations] = await Promise.all([
    getAllRecords<OfflineParticipantIndex>(STORE_INDEX),
    getAllRecords<PendingParticipantMutation>(STORE_MUTATIONS),
  ]);

  await Promise.all([
    ...indexes
      .filter(index => index.apiBaseUrl === apiBaseUrl && index.userId === userId)
      .map(index => deleteRecord(STORE_INDEX, index.key)),
    ...mutations
      .filter(mutation => mutation.apiBaseUrl === apiBaseUrl && mutation.userId === userId)
      .map(mutation => deletePendingMutation(mutation.id)),
  ]);
}

export function __resetOfflineStoreForTests(): void {
  Object.values(memoryStores).forEach(store => store.clear());
  dbPromise = null;
}
