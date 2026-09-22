import { createContext, useContext, type ReactNode } from "react";
import type {
  ActivityLog,
  AppDiagnostics,
  ConnectionState,
  Event,
  Organization,
  Participant,
  ParticipantFieldMapping,
  ParticipantQrPreview,
  ParticipantScanResult,
  ParticipantStatus,
  QrEmailDeliveryReport,
  Role,
  ScannerMode,
  SnapshotSource,
  User,
} from "@/types";
import { useAuth } from "@/contexts/AuthContext";
import { useOrganizationMutations } from "@/contexts/data/useOrganizationMutations";
import { useUserMutations } from "@/contexts/data/useUserMutations";
import {
  useParticipantImport,
  type ParticipantFieldMappingUpdateResult,
  type ParticipantFieldMappingsState,
  type ParticipantImportAnalysis,
  type ParticipantImportMappingPayload,
  type ParticipantImportRunResult,
  type ParticipantListResetResult,
} from "@/contexts/data/useParticipantImport";
import { useEventMutations } from "@/contexts/data/useEventMutations";
import { useParticipantMutations } from "@/contexts/data/useParticipantMutations";
import { useDataSyncCore } from "@/contexts/data/useDataSyncCore";
import {
  useParticipantCheckinSync,
  type ParticipantUpdateOptions,
} from "@/contexts/data/useParticipantCheckinSync";

type UserCreateInput = Omit<User, "id" | "password"> & { password?: string };
type EventMutationInput = Omit<
  Event,
  | "id"
  | "archived_at"
  | "deleted_at"
  | "is_test"
  | "office_open_at"
  | "office_close_at"
>;
type EventUpdateInput = EventMutationInput & { reopen_office?: boolean };

interface MutationResult {
  ok: boolean;
  error?: string;
  entityId?: string;
  queued?: boolean;
}
interface ParticipantBibNumberConflict {
  bibNumber: string;
  conflictingParticipants: Participant[];
}
interface ParticipantBibNumberUpdateResult extends MutationResult {
  conflict?: ParticipantBibNumberConflict;
}
type EventQrPaymentScope = "all" | "paid_only";
interface EventQrEmailResult {
  ok: boolean;
  sent_count: number;
  error_count: number;
  unpaid_count?: number;
  unknown_payment_count?: number;
  skipped_unpaid_count?: number;
  reconciled_count?: number;
  errors: Array<{
    participant_id: number;
    participant_name: string;
    error: string;
  }>;
  error?: string;
}
interface ParticipantBibNumberUpdateOptions {
  conflictResolution?: "keep_duplicates" | "delete_conflicts";
}
interface OrganizationUpdateInput {
  name?: string;
  event_limit?: number;
}
interface UserUpdateInput {
  name: string;
  email: string;
}

interface DataContextType {
  organizations: Organization[];
  events: Event[];
  archivedEvents: Event[];
  participants: Participant[];
  users: User[];
  activityLog: ActivityLog[];
  currentRole: Role;
  currentUser: User;
  selectedOrganizationId: string;
  setSelectedOrganizationId: (id: string) => void;
  selectedEventId: string;
  setSelectedEventId: (id: string) => void;
  selectEventContext: (eventId: string) => void;
  updateParticipantStatus: (
    participantId: string,
    status: ParticipantStatus,
    options?: ParticipantUpdateOptions
  ) => Promise<MutationResult>;
  updateParticipantBibNumber: (
    participantId: string,
    bibNumber: string,
    options?: ParticipantBibNumberUpdateOptions
  ) => Promise<ParticipantBibNumberUpdateResult>;
  updateParticipantDetails: (
    participantId: string,
    email: string,
    fieldValues: Record<string, string>
  ) => Promise<MutationResult>;
  analyzeParticipantImport: (
    eventId: string,
    csvContent: string
  ) => Promise<ParticipantImportAnalysis>;
  confirmParticipantImportMapping: (
    eventId: string,
    payload: ParticipantImportMappingPayload
  ) => Promise<ParticipantFieldMapping[]>;
  runParticipantImport: (
    eventId: string,
    csvContent: string
  ) => Promise<ParticipantImportRunResult>;
  replaceParticipantImport: (
    eventId: string,
    csvContent: string,
    mapping: ParticipantImportMappingPayload,
    confirmQrSent?: boolean
  ) => Promise<ParticipantImportRunResult>;
  resetEventParticipantList: (
    eventId: string,
    confirmQrSent?: boolean
  ) => Promise<ParticipantListResetResult>;
  getParticipantFieldMappingsState: (
    eventId: string
  ) => Promise<ParticipantFieldMappingsState>;
  getParticipantFieldMappings: (
    eventId: string
  ) => Promise<ParticipantFieldMapping[]>;
  updateParticipantFieldMappings: (
    eventId: string,
    mappings: ParticipantFieldMapping[]
  ) => Promise<ParticipantFieldMappingUpdateResult>;
  addParticipantManually: (
    eventId: string,
    email: string,
    fieldValues: Record<string, string>
  ) => Promise<MutationResult>;
  createEvent: (e: EventMutationInput) => Promise<MutationResult>;
  createTestEvent: (organizationId: string) => Promise<MutationResult>;
  resetTestEvent: (eventId: string) => Promise<MutationResult>;
  updateEvent: (
    eventId: string,
    data: EventUpdateInput
  ) => Promise<MutationResult>;
  archiveEvent: (eventId: string) => Promise<MutationResult>;
  deleteEvent: (eventId: string) => Promise<MutationResult>;
  addUser: (u: UserCreateInput) => Promise<MutationResult>;
  updateUser: (
    userId: string,
    data: UserUpdateInput
  ) => Promise<MutationResult>;
  createOrganization: (data: {
    name: string;
    event_limit: number;
  }) => Promise<MutationResult>;
  updateOrganization: (
    organizationId: string,
    data: OrganizationUpdateInput
  ) => Promise<MutationResult>;
  updateOrganizationEventLimit: (
    organizationId: string,
    eventLimit: number
  ) => Promise<MutationResult>;
  deleteOrganization: (organizationId: string) => Promise<MutationResult>;
  removeUser: (id: string) => Promise<MutationResult>;
  triggerUserPasswordReset: (id: string) => Promise<MutationResult>;
  setUserPassword: (id: string, password: string) => Promise<MutationResult>;
  changeRole: (userId: string, role: Role) => Promise<MutationResult>;
  assignScannerEvents: (
    userId: string,
    eventIds: string[]
  ) => Promise<MutationResult>;
  sendParticipantQrEmail: (participantId: string) => Promise<MutationResult>;
  sendEventQrEmails: (
    eventId: string,
    resendAll?: boolean,
    paymentScope?: EventQrPaymentScope
  ) => Promise<EventQrEmailResult>;
  getParticipantQrPreview: (
    participantId: string
  ) => Promise<ParticipantQrPreview>;
  getEventQrEmailDeliveries: (
    eventId: string
  ) => Promise<QrEmailDeliveryReport>;
  scanParticipantQr: (qrCode: string) => Promise<{
    ok: boolean;
    data?: ParticipantScanResult;
    error?: string;
    status?: number;
  }>;
  deleteParticipant: (participantId: string) => Promise<MutationResult>;
  exportEventCsv: (eventId: string) => Promise<MutationResult>;
  exportEventLogsCsv: (eventId: string) => Promise<MutationResult>;
  exportEventParticipantChangesCsv: (
    eventId: string
  ) => Promise<MutationResult>;
  visibleEvents: Event[];
  canAccessEvent: (eventId: string) => boolean;
  canViewEvent: (eventId: string) => boolean;
  isLoading: boolean;
  connectionState: ConnectionState;
  lastSyncAt: string | null;
  snapshotSource: SnapshotSource;
  pendingMutationCount: number;
  scannerMode: ScannerMode;
  diagnostics: AppDiagnostics;
  refreshData: (silent?: boolean) => Promise<void>;
}

const DataContext = createContext<DataContextType | null>(null);

export function DataProvider({ children }: { children: ReactNode }) {
  const { user: authUser, token, getAuthHeaders, clearSession } = useAuth();

  const core = useDataSyncCore({
    authUser,
    token,
    getAuthHeaders,
    clearSession,
  });
  const {
    organizations,
    setOrganizations,
    events,
    setEvents,
    archivedEvents,
    setArchivedEvents,
    participantRecords,
    setParticipantRecords,
    users,
    setUsers,
    activityLog,
    currentUser,
    currentRole,
    selectedOrganizationId,
    setSelectedOrganizationId,
    selectedEventId,
    setSelectedEventId,
    selectEventContext,
    visibleEvents,
    canAccessEvent,
    canViewEvent,
    isLoading,
    connectionState,
    diagnostics,
    snapshotSource,
    lastSyncAt,
    setLastSyncAt,
    offlineDurationMs,
    loadBootstrap,
    resetState,
    ensureOnline,
    runMutation,
    applyOnlineOnly,
    handleNetworkFailure,
    markConnectionHealthy,
    setDegradedState,
    markLocalDataChanged,
    addLog,
    syncStoredAuthUser,
    updateSyncMeta,
    refreshData,
    clearParticipantImportCachesRef,
  } = core;

  const {
    analyzeParticipantImport,
    confirmParticipantImportMapping,
    runParticipantImport,
    replaceParticipantImport,
    resetEventParticipantList,
    getParticipantFieldMappings,
    getParticipantFieldMappingsState,
    updateParticipantFieldMappings,
    rememberParticipantFieldMappingsState,
    clearParticipantImportCaches,
  } = useParticipantImport({
    setParticipantRecords,
    addLog,
    applyOnlineOnly,
    ensureOnline,
    handleNetworkFailure,
    getAuthHeaders,
    loadBootstrap,
  });
  clearParticipantImportCachesRef.current = clearParticipantImportCaches;

  const {
    createEvent,
    createTestEvent,
    resetTestEvent,
    updateEvent,
    archiveEvent,
    deleteEvent,
    exportEventCsv,
    exportEventLogsCsv,
  } = useEventMutations({
    organizations,
    events,
    setEvents,
    archivedEvents,
    setArchivedEvents,
    setParticipantRecords,
    selectedEventId,
    setSelectedEventId,
    ensureOnline,
    runMutation,
    addLog,
    markLocalDataChanged,
    getAuthHeaders,
    loadBootstrap,
    handleNetworkFailure,
    rememberParticipantFieldMappingsState,
  });

  const {
    addUser,
    updateUser,
    removeUser,
    triggerUserPasswordReset,
    setUserPassword,
    changeRole,
    assignScannerEvents,
  } = useUserMutations({
    users,
    setUsers,
    ensureOnline,
    runMutation,
    addLog,
    markLocalDataChanged,
    getAuthHeaders,
    syncStoredAuthUser,
  });

  const {
    createOrganization,
    updateOrganization,
    updateOrganizationEventLimit,
    deleteOrganization,
  } = useOrganizationMutations({
    organizations,
    setOrganizations,
    events,
    ensureOnline,
    runMutation,
    addLog,
    markLocalDataChanged,
    getAuthHeaders,
    loadBootstrap,
  });

  const {
    participants,
    pendingMutationCount,
    scannerMode,
    updateParticipantInApi,
    replaceParticipantRecord,
    updateParticipantStatus,
    scanParticipantQr,
  } = useParticipantCheckinSync({
    authUserId: authUser?.id,
    token,
    connectionState,
    diagnosticsIndexedDbAvailable: diagnostics.indexedDbAvailable,
    offlineDurationMs,
    participantRecords,
    setParticipantRecords,
    events,
    archivedEvents,
    selectedEventId,
    ensureOnline,
    runMutation,
    addLog,
    handleNetworkFailure,
    markConnectionHealthy,
    setDegradedState,
    loadBootstrap,
    clearSession,
    resetState,
    getAuthHeaders,
    setLastSyncAt,
    updateSyncMeta,
  });

  const {
    updateParticipantBibNumber,
    updateParticipantDetails,
    addParticipantManually,
    deleteParticipant,
    sendParticipantQrEmail,
    sendEventQrEmails,
    getParticipantQrPreview,
    getEventQrEmailDeliveries,
    exportEventParticipantChangesCsv,
  } = useParticipantMutations({
    participants,
    setParticipantRecords,
    events,
    archivedEvents,
    ensureOnline,
    applyOnlineOnly,
    runMutation,
    handleNetworkFailure,
    addLog,
    getAuthHeaders,
    loadBootstrap,
    updateParticipantInApi,
    replaceParticipantRecord,
  });

  return (
    <DataContext.Provider
      value={{
        organizations,
        events,
        archivedEvents,
        participants,
        users,
        activityLog,
        currentRole,
        currentUser,
        selectedOrganizationId,
        setSelectedOrganizationId,
        selectedEventId,
        setSelectedEventId,
        selectEventContext,
        updateParticipantStatus,
        updateParticipantBibNumber,
        updateParticipantDetails,
        analyzeParticipantImport,
        confirmParticipantImportMapping,
        runParticipantImport,
        replaceParticipantImport,
        resetEventParticipantList,
        getParticipantFieldMappingsState,
        getParticipantFieldMappings,
        updateParticipantFieldMappings,
        addParticipantManually,
        createEvent,
        createTestEvent,
        resetTestEvent,
        updateEvent,
        archiveEvent,
        deleteEvent,
        addUser,
        updateUser,
        createOrganization,
        updateOrganization,
        updateOrganizationEventLimit,
        deleteOrganization,
        removeUser,
        triggerUserPasswordReset,
        setUserPassword,
        changeRole,
        assignScannerEvents,
        sendParticipantQrEmail,
        sendEventQrEmails,
        getParticipantQrPreview,
        getEventQrEmailDeliveries,
        scanParticipantQr,
        deleteParticipant,
        exportEventCsv,
        exportEventLogsCsv,
        exportEventParticipantChangesCsv,
        visibleEvents,
        canAccessEvent,
        canViewEvent,
        isLoading,
        connectionState,
        lastSyncAt,
        snapshotSource,
        pendingMutationCount,
        scannerMode,
        diagnostics,
        refreshData,
      }}
    >
      {children}
    </DataContext.Provider>
  );
}

export function useData() {
  const context = useContext(DataContext);
  if (!context) throw new Error("useData must be used within DataProvider");
  return context;
}
