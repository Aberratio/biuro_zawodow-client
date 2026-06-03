import { useMemo, useState } from "react";
import type { ReactNode } from "react";
import { Link } from "react-router-dom";
import {
  Activity,
  Archive,
  Building2,
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  Database,
  Edit3,
  Eye,
  EyeOff,
  KeyRound,
  Loader2,
  Plus,
  RefreshCw,
  Search,
  Shield,
  UserRound,
  Users,
  type LucideIcon,
} from "lucide-react";

import { PageHeader } from "@/components/PageHeader";
import { OnlineOnlyNotice } from "@/components/OnlineOnlyNotice";
import { PasswordRequirements } from "@/components/PasswordRequirements";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { FieldError } from "@/components/ui/field-error";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Pagination,
  PaginationContent,
  PaginationItem,
} from "@/components/ui/pagination";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import TableSkeleton from "@/components/skeletons/TableSkeleton";
import { useAuth } from "@/contexts/AuthContext";
import { useData } from "@/contexts/DataContext";
import { toast } from "@/hooks/use-toast";
import { API_BASE_URL, fetchJson } from "@/lib/api";
import { validateStrongPassword } from "@/lib/form-validation";
import { participantCountsAsCheckedIn } from "@/lib/participant-status";
import { generateStrongPassword } from "@/lib/password";
import {
  buildEventParticipantPath,
  buildEventPath,
  buildOrganizationPath,
} from "@/lib/routes";
import type { ParticipantStatus, Role, User } from "@/types";

type AuditScope = "all" | "user" | "organization" | "event" | "participant";
type UserRoleTab = "admin" | "editor" | "scanner" | "scanner_plus";

type AuditEntry = {
  source: "activity" | "participant_change";
  id: string;
  action: string;
  timestamp: string;
  event_id?: string | null;
  event_name?: string | null;
  organization_id?: string | null;
  organization_name?: string | null;
  participant_id?: number | string | null;
  participant_name?: string | null;
  user_id?: string | null;
  user_name?: string | null;
  change_type?: string | null;
  change_source?: string | null;
  changed_fields?: string[];
};

type EntityOption = {
  id: string;
  label: string;
  meta: string;
};

type AuditMeta = {
  page: number;
  per_page: number;
  total: number;
  total_pages: number;
};

type DatabaseTableSummary = {
  name: string;
  row_estimate?: number | null;
};

type DatabaseColumn = {
  name: string;
  type: string;
  nullable: boolean;
  key: string;
  default: string | null;
  extra: string;
};

type DatabaseMeta = {
  selected_table: string | null;
  page: number;
  per_page: number;
  total: number;
  total_pages: number;
};

const AUDIT_PAGE_SIZE = 50;
const AUDIT_ENTITY_OPTION_LIMIT = 12;
const DATABASE_PAGE_SIZE = 100;

const USER_ROLE_TABS: Array<{ value: UserRoleTab; label: string }> = [
  { value: "admin", label: "Admini" },
  { value: "editor", label: "Organizatorzy" },
  { value: "scanner", label: "Operatorzy" },
  { value: "scanner_plus", label: "Operator Plus" },
];

const roleLabels: Record<Role, string> = {
  superadmin: "Superadmin",
  admin: "Admin",
  editor: "Organizator",
  scanner: "Operator",
  scanner_plus: "Operator+",
};

const participantStatusLabels: Record<ParticipantStatus, string> = {
  not_checked_in: "Nieodprawieni",
  checked_in: "Odprawieni",
  checked_in_not_starting: "Bez startu",
};

function formatDateTime(value?: string | null): string {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;

  return new Intl.DateTimeFormat("pl-PL", {
    dateStyle: "short",
    timeStyle: "short",
  }).format(date);
}

function normalizeSearch(value: string): string {
  return value.trim().toLocaleLowerCase("pl-PL");
}

function participantApiId(participantId: string): string {
  return participantId.startsWith("p-") ? participantId.slice(2) : participantId;
}

export default function SuperAdmin() {
  const { getAuthHeaders } = useAuth();
  const {
    users,
    organizations,
    events,
    archivedEvents,
    participants,
    activityLog,
    addUser,
    updateUser,
    removeUser,
    triggerUserPasswordReset,
    setUserPassword,
    changeRole,
    refreshData,
    isLoading,
    connectionState,
  } = useData();

  const [adminDialogOpen, setAdminDialogOpen] = useState(false);
  const [editAdmin, setEditAdmin] = useState<User | null>(null);
  const [adminForm, setAdminForm] = useState({ name: "", email: "" });
  const [isSavingAdmin, setIsSavingAdmin] = useState(false);
  const [auditScope, setAuditScope] = useState<AuditScope>("all");
  const [entitySearch, setEntitySearch] = useState("");
  const [selectedEntity, setSelectedEntity] = useState<EntityOption | null>(null);
  const [auditQuery, setAuditQuery] = useState("");
  const [auditEntries, setAuditEntries] = useState<AuditEntry[]>([]);
  const [auditMeta, setAuditMeta] = useState<AuditMeta>({
    page: 1,
    per_page: AUDIT_PAGE_SIZE,
    total: 0,
    total_pages: 1,
  });
  const [auditPage, setAuditPage] = useState(1);
  const [hasLoadedRemoteAudit, setHasLoadedRemoteAudit] = useState(false);
  const [isAuditLoading, setIsAuditLoading] = useState(false);
  const [databaseTables, setDatabaseTables] = useState<DatabaseTableSummary[]>([]);
  const [selectedDatabaseTable, setSelectedDatabaseTable] = useState("");
  const [databaseColumns, setDatabaseColumns] = useState<DatabaseColumn[]>([]);
  const [databaseRows, setDatabaseRows] = useState<Record<string, unknown>[]>([]);
  const [databaseMeta, setDatabaseMeta] = useState<DatabaseMeta>({
    selected_table: null,
    page: 1,
    per_page: DATABASE_PAGE_SIZE,
    total: 0,
    total_pages: 1,
  });
  const [databasePage, setDatabasePage] = useState(1);
  const [hasLoadedDatabase, setHasLoadedDatabase] = useState(false);
  const [isDatabaseLoading, setIsDatabaseLoading] = useState(false);
  const [activeTab, setActiveTab] = useState("users");
  const [activeUserRoleTab, setActiveUserRoleTab] = useState<UserRoleTab>("admin");
  const [userSearch, setUserSearch] = useState("");
  const [userOrganizationFilter, setUserOrganizationFilter] = useState("all");
  const [userEventFilter, setUserEventFilter] = useState("all");
  const [profileUser, setProfileUser] = useState<User | null>(null);
  const [profileDialogOpen, setProfileDialogOpen] = useState(false);
  const [editUser, setEditUser] = useState<User | null>(null);
  const [userDialogOpen, setUserDialogOpen] = useState(false);
  const [userForm, setUserForm] = useState({ name: "", email: "" });
  const [isSavingUser, setIsSavingUser] = useState(false);
  const [selectedActionUser, setSelectedActionUser] = useState<User | null>(null);
  const [passwordDialogOpen, setPasswordDialogOpen] = useState(false);
  const [passwordDraft, setPasswordDraft] = useState("");
  const [showPasswordDraft, setShowPasswordDraft] = useState(false);
  const [passwordErrors, setPasswordErrors] = useState<{ password?: string; form?: string }>({});
  const [isSettingPassword, setIsSettingPassword] = useState(false);
  const [isChangingUserRole, setIsChangingUserRole] = useState(false);

  const allEvents = useMemo(() => [...events, ...archivedEvents], [archivedEvents, events]);
  const isOnline = connectionState === "online";

  const roleCounts = useMemo(() => {
    return users.reduce<Record<Role, number>>(
      (counts, user) => ({ ...counts, [user.role]: counts[user.role] + 1 }),
      { superadmin: 0, admin: 0, editor: 0, scanner: 0, scanner_plus: 0 },
    );
  }, [users]);

  const participantStatusCounts = useMemo(() => {
    return participants.reduce<Record<ParticipantStatus, number>>(
      (counts, participant) => ({ ...counts, [participant.status]: counts[participant.status] + 1 }),
      { not_checked_in: 0, checked_in: 0, checked_in_not_starting: 0 },
    );
  }, [participants]);

  const checkedInCount = useMemo(
    () => participants.filter((participant) => participantCountsAsCheckedIn(participant)).length,
    [participants],
  );

  const organizationNameById = useMemo(() => {
    return new Map(organizations.map((organization) => [organization.id, organization.name]));
  }, [organizations]);

  const eventById = useMemo(() => {
    return new Map(allEvents.map((event) => [event.id, event]));
  }, [allEvents]);

  const activeRoleUsers = useMemo(() => {
    const query = normalizeSearch(userSearch);

    return users
      .filter((user) => user.role === activeUserRoleTab)
      .filter((user) => {
        if (userOrganizationFilter !== "all" && user.organization_id !== userOrganizationFilter) {
          return false;
        }

        if (userEventFilter !== "all") {
          if (user.role === "editor") {
            return allEvents.some(
              (event) => event.id === userEventFilter && event.organization_id === user.organization_id,
            );
          }

          if (!user.assigned_events.includes(userEventFilter)) {
            return false;
          }
        }

        if (!query) return true;

        const organizationName = user.organization_id ? organizationNameById.get(user.organization_id) ?? "" : "";
        const assignedEventNames = user.assigned_events
          .map((eventId) => eventById.get(eventId)?.name ?? eventId)
          .join(" ");
        const haystack = `${user.name} ${user.email} ${roleLabels[user.role]} ${organizationName} ${assignedEventNames}`;

        return haystack.toLocaleLowerCase("pl-PL").includes(query);
      })
      .sort((left, right) => left.name.localeCompare(right.name, "pl"));
  }, [
    activeUserRoleTab,
    allEvents,
    eventById,
    organizationNameById,
    userEventFilter,
    userOrganizationFilter,
    userSearch,
    users,
  ]);

  const availableEventFilters = useMemo(() => {
    if (userOrganizationFilter === "all") return allEvents;
    return allEvents.filter((event) => event.organization_id === userOrganizationFilter);
  }, [allEvents, userOrganizationFilter]);

  const entityOptions = useMemo<EntityOption[]>(() => {
    if (auditScope === "user") {
      return users.map((user) => ({
        id: user.id,
        label: user.name,
        meta: `${user.email} · ${roleLabels[user.role]}`,
      }));
    }

    if (auditScope === "organization") {
      return organizations.map((organization) => ({
        id: organization.id,
        label: organization.name,
        meta: `${allEvents.filter((event) => event.organization_id === organization.id).length} wydarzeń`,
      }));
    }

    if (auditScope === "event") {
      return allEvents.map((event) => ({
        id: event.id,
        label: event.name,
        meta: organizations.find((organization) => organization.id === event.organization_id)?.name ?? event.location,
      }));
    }

    if (auditScope === "participant") {
      return participants.map((participant) => ({
        id: participantApiId(participant.id),
        label: participant.name,
        meta: `${participant.email} · ${allEvents.find((event) => event.id === participant.event_id)?.name ?? "bez wydarzenia"}`,
      }));
    }

    return [];
  }, [allEvents, auditScope, organizations, participants, users]);

  const matchingEntityOptions = useMemo(() => {
    const query = normalizeSearch(entitySearch);
    if (!query) return entityOptions;

    return entityOptions
      .filter((entity) => `${entity.label} ${entity.meta}`.toLocaleLowerCase("pl-PL").includes(query));
  }, [entityOptions, entitySearch]);
  const filteredEntityOptions = useMemo(
    () => matchingEntityOptions.slice(0, AUDIT_ENTITY_OPTION_LIMIT),
    [matchingEntityOptions],
  );

  const localAuditEntries = useMemo<AuditEntry[]>(() => {
    return activityLog.map((log) => ({
      source: "activity",
      id: log.id,
      action: log.action,
      timestamp: log.timestamp,
      event_id: log.event_id ?? null,
      participant_id: log.participant_id ?? null,
      participant_name: log.participant_name ?? null,
      user_name: log.user_name ?? null,
      changed_fields: [],
    }));
  }, [activityLog]);

  const localAuditMeta = useMemo<AuditMeta>(() => ({
    page: auditPage,
    per_page: AUDIT_PAGE_SIZE,
    total: localAuditEntries.length,
    total_pages: Math.max(1, Math.ceil(localAuditEntries.length / AUDIT_PAGE_SIZE)),
  }), [auditPage, localAuditEntries.length]);

  const displayedAuditEntries = hasLoadedRemoteAudit
    ? auditEntries
    : localAuditEntries.slice((auditPage - 1) * AUDIT_PAGE_SIZE, auditPage * AUDIT_PAGE_SIZE);
  const displayedAuditMeta = hasLoadedRemoteAudit ? auditMeta : localAuditMeta;

  const loadAudit = async (nextScope = auditScope, nextEntity = selectedEntity, nextPage = auditPage) => {
    setIsAuditLoading(true);
    try {
      const params = new URLSearchParams({
        scope: nextScope,
        limit: String(AUDIT_PAGE_SIZE),
        page: String(nextPage),
      });
      if (nextEntity?.id) params.set("id", nextEntity.id);
      if (auditQuery.trim()) params.set("q", auditQuery.trim());

      const { payload } = await fetchJson(`${API_BASE_URL}/superadmin/audit?${params.toString()}`, {
        headers: getAuthHeaders(),
      });
      const responseData = payload as { data?: AuditEntry[]; meta?: Partial<AuditMeta> };
      const data = responseData.data;
      setAuditEntries(Array.isArray(data) ? data : []);
      setAuditMeta({
        page: Number(responseData.meta?.page ?? nextPage),
        per_page: Number(responseData.meta?.per_page ?? AUDIT_PAGE_SIZE),
        total: Number(responseData.meta?.total ?? (Array.isArray(data) ? data.length : 0)),
        total_pages: Math.max(1, Number(responseData.meta?.total_pages ?? 1)),
      });
      setAuditPage(Number(responseData.meta?.page ?? nextPage));
      setHasLoadedRemoteAudit(true);
    } catch (error) {
      toast({
        title: "Nie udało się pobrać audytu",
        description: error instanceof Error ? error.message : "Spróbuj ponownie.",
        variant: "destructive",
      });
    } finally {
      setIsAuditLoading(false);
    }
  };

  const loadDatabase = async (nextTable = selectedDatabaseTable, nextPage = databasePage) => {
    setIsDatabaseLoading(true);
    try {
      const params = new URLSearchParams({
        limit: String(DATABASE_PAGE_SIZE),
        page: String(nextPage),
      });
      if (nextTable) {
        params.set("table", nextTable);
      }

      const { payload } = await fetchJson(`${API_BASE_URL}/superadmin/database?${params.toString()}`, {
        headers: getAuthHeaders(),
      });
      const responseData = payload as {
        tables?: DatabaseTableSummary[];
        columns?: DatabaseColumn[];
        rows?: Record<string, unknown>[];
        meta?: Partial<DatabaseMeta>;
      };
      const tables = Array.isArray(responseData.tables) ? responseData.tables : [];
      const columns = Array.isArray(responseData.columns) ? responseData.columns : [];
      const rows = Array.isArray(responseData.rows) ? responseData.rows : [];
      const selectedTable = typeof responseData.meta?.selected_table === "string"
        ? responseData.meta.selected_table
        : nextTable || "";

      setDatabaseTables(tables);
      setDatabaseColumns(columns);
      setDatabaseRows(rows);
      setSelectedDatabaseTable(selectedTable);
      setDatabaseMeta({
        selected_table: selectedTable || null,
        page: Number(responseData.meta?.page ?? nextPage),
        per_page: Number(responseData.meta?.per_page ?? DATABASE_PAGE_SIZE),
        total: Number(responseData.meta?.total ?? rows.length),
        total_pages: Math.max(1, Number(responseData.meta?.total_pages ?? 1)),
      });
      setDatabasePage(Number(responseData.meta?.page ?? nextPage));
      setHasLoadedDatabase(true);
    } catch (error) {
      toast({
        title: "Nie udało się pobrać danych z bazy",
        description: error instanceof Error ? error.message : "Spróbuj ponownie.",
        variant: "destructive",
      });
    } finally {
      setIsDatabaseLoading(false);
    }
  };

  const resetAdminForm = () => {
    setAdminForm({ name: "", email: "" });
    setEditAdmin(null);
  };

  const openCreateAdmin = () => {
    resetAdminForm();
    setAdminDialogOpen(true);
  };

  const openEditAdmin = (admin: User) => {
    setEditAdmin(admin);
    setAdminForm({ name: admin.name, email: admin.email });
    setAdminDialogOpen(true);
  };

  const saveAdmin = async () => {
    const name = adminForm.name.trim();
    const email = adminForm.email.trim();
    if (!name || !email) {
      toast({ title: "Uzupełnij nazwę i e-mail", variant: "destructive" });
      return;
    }

    setIsSavingAdmin(true);
    try {
      if (editAdmin) {
        await fetchJson(`${API_BASE_URL}/superadmin/admins/${editAdmin.id}`, {
          method: "PATCH",
          headers: getAuthHeaders(true),
          body: JSON.stringify({ name, email }),
        });
        toast({ title: "Zapisano konto admina" });
      } else {
        const result = await addUser({
          name,
          email,
          role: "admin",
          organization_id: undefined,
          assigned_events: [],
        });

        if (!result.ok) {
          throw new Error(result.error ?? "Nie udało się utworzyć admina.");
        }
        toast({ title: "Utworzono konto admina" });
      }

      setAdminDialogOpen(false);
      resetAdminForm();
      await refreshData();
      if (activeTab === "audit" || hasLoadedRemoteAudit) {
        await loadAudit();
      }
    } catch (error) {
      toast({
        title: "Nie udało się zapisać admina",
        description: error instanceof Error ? error.message : "Spróbuj ponownie.",
        variant: "destructive",
      });
    } finally {
      setIsSavingAdmin(false);
    }
  };

  const resetAdminPassword = async (admin: User) => {
    try {
      if (admin.role === "admin") {
        await fetchJson(`${API_BASE_URL}/superadmin/admins/${admin.id}/password-reset`, {
          method: "POST",
          headers: getAuthHeaders(),
        });
      } else {
        const result = await triggerUserPasswordReset(admin.id);
        if (!result.ok) {
          throw new Error(result.error ?? "Nie udało się wysłać resetu.");
        }
      }
      toast({ title: "Wysłano reset hasła" });
      if (activeTab === "audit" || hasLoadedRemoteAudit) {
        await loadAudit();
      }
    } catch (error) {
      toast({
        title: "Nie udało się wysłać resetu",
        description: error instanceof Error ? error.message : "Spróbuj ponownie.",
        variant: "destructive",
      });
    }
  };

  const archiveAdmin = async (admin: User) => {
    const confirmed = window.confirm(`Zarchiwizować konto ${admin.name}?`);
    if (!confirmed) return;

    try {
      if (admin.role === "admin") {
        await fetchJson(`${API_BASE_URL}/superadmin/admins/${admin.id}`, {
          method: "DELETE",
          headers: getAuthHeaders(),
        });
      } else {
        const result = await removeUser(admin.id);
        if (!result.ok) {
          throw new Error(result.error ?? "Nie udało się zarchiwizować konta.");
        }
      }
      toast({ title: "Zarchiwizowano konto" });
      await refreshData();
      if (activeTab === "audit" || hasLoadedRemoteAudit) {
        await loadAudit();
      }
    } catch (error) {
      toast({
        title: "Nie udało się zarchiwizować konta",
        description: error instanceof Error ? error.message : "Spróbuj ponownie.",
        variant: "destructive",
      });
    }
  };

  const openUserDetails = (user: User) => {
    setProfileUser(user);
    setProfileDialogOpen(true);
  };

  const openEditUser = (user: User) => {
    if (user.role === "admin") {
      openEditAdmin(user);
      return;
    }

    setEditUser(user);
    setUserForm({ name: user.name, email: user.email });
    setUserDialogOpen(true);
  };

  const saveUser = async () => {
    if (!editUser) return;

    const name = userForm.name.trim();
    const email = userForm.email.trim();
    if (!name || !email) {
      toast({ title: "Uzupełnij nazwę i e-mail", variant: "destructive" });
      return;
    }

    setIsSavingUser(true);
    const result = await updateUser(editUser.id, { name, email });
    setIsSavingUser(false);

    if (!result.ok) {
      toast({
        title: "Nie udało się zapisać użytkownika",
        description: result.error ?? "Spróbuj ponownie.",
        variant: "destructive",
      });
      return;
    }

    setUserDialogOpen(false);
    setEditUser(null);
    setUserForm({ name: "", email: "" });
    toast({ title: "Zapisano konto użytkownika" });
    if (activeTab === "audit" || hasLoadedRemoteAudit) {
      await loadAudit();
    }
  };

  const generatePasswordDraft = () => {
    setPasswordDraft(generateStrongPassword());
    setPasswordErrors({});
  };

  const openPasswordDialog = (user: User) => {
    setSelectedActionUser(user);
    setPasswordDraft(generateStrongPassword());
    setPasswordErrors({});
    setShowPasswordDraft(false);
    setPasswordDialogOpen(true);
  };

  const saveUserPassword = async () => {
    if (!selectedActionUser) return;

    const passwordError = validateStrongPassword(passwordDraft);
    if (passwordError) {
      setPasswordErrors({ password: passwordError });
      return;
    }

    setIsSettingPassword(true);
    const result = await setUserPassword(selectedActionUser.id, passwordDraft);
    setIsSettingPassword(false);

    if (!result.ok) {
      setPasswordErrors({ form: result.error ?? "Nie udało się ustawić hasła." });
      return;
    }

    const targetUser = selectedActionUser;
    setPasswordDialogOpen(false);
    setSelectedActionUser(null);
    setPasswordDraft("");
    setPasswordErrors({});
    toast({
      title: "Ustawiono hasło",
      description: `Konto ${targetUser.email} może logować się nowym hasłem.`,
    });
    if (activeTab === "audit" || hasLoadedRemoteAudit) {
      await loadAudit();
    }
  };

  const openUserLogs = (user: User) => {
    const entity = {
      id: user.id,
      label: user.name,
      meta: `${user.email} · ${roleLabels[user.role]}`,
    };
    setAuditScope("user");
    setSelectedEntity(entity);
    setEntitySearch(user.name);
    setAuditPage(1);
    setActiveTab("audit");
    void loadAudit("user", entity, 1);
  };

  const toggleScannerRole = async (user: User) => {
    const nextRole = user.role === "scanner" ? "scanner_plus" : "scanner";
    setIsChangingUserRole(true);
    const result = await changeRole(user.id, nextRole);
    setIsChangingUserRole(false);

    if (!result.ok) {
      toast({
        title: "Nie udało się zmienić roli",
        description: result.error ?? "Spróbuj ponownie.",
        variant: "destructive",
      });
      return;
    }

    toast({ title: `Zmieniono rolę na ${roleLabels[nextRole]}` });
    await refreshData();
    if (profileUser?.id === user.id) {
      setProfileUser({ ...user, role: nextRole });
    }
  };

  const changeAuditScope = (scope: AuditScope) => {
    setAuditScope(scope);
    setSelectedEntity(null);
    setEntitySearch("");
    setAuditPage(1);
    if (activeTab === "audit") {
      void loadAudit(scope, null, 1);
    }
  };

  const selectEntity = (entity: EntityOption) => {
    setSelectedEntity(entity);
    setEntitySearch(entity.label);
    setAuditPage(1);
    void loadAudit(auditScope, entity, 1);
  };

  const goToAuditPage = (page: number) => {
    const nextPage = Math.min(Math.max(1, page), displayedAuditMeta.total_pages);
    if (nextPage === auditPage || isAuditLoading) return;

    setAuditPage(nextPage);
    if (hasLoadedRemoteAudit) {
      void loadAudit(auditScope, selectedEntity, nextPage);
    }
  };

  const selectDatabaseTable = (tableName: string) => {
    setSelectedDatabaseTable(tableName);
    setDatabasePage(1);
    void loadDatabase(tableName, 1);
  };

  const goToDatabasePage = (page: number) => {
    const nextPage = Math.min(Math.max(1, page), databaseMeta.total_pages);
    if (nextPage === databasePage || isDatabaseLoading || !selectedDatabaseTable) return;

    setDatabasePage(nextPage);
    void loadDatabase(selectedDatabaseTable, nextPage);
  };

  const auditRangeStart = displayedAuditMeta.total === 0
    ? 0
    : (displayedAuditMeta.page - 1) * displayedAuditMeta.per_page + 1;
  const auditRangeEnd = Math.min(displayedAuditMeta.total, displayedAuditMeta.page * displayedAuditMeta.per_page);
  const databaseRangeStart = databaseMeta.total === 0
    ? 0
    : (databaseMeta.page - 1) * databaseMeta.per_page + 1;
  const databaseRangeEnd = Math.min(databaseMeta.total, databaseMeta.page * databaseMeta.per_page);

  if (isLoading) {
    return <TableSkeleton rows={8} cols={4} subtitle="" showFilters />;
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Superadmin"
        actions={
          <Button onClick={openCreateAdmin} size="sm" disabled={!isOnline}>
            <Plus className="mr-1 h-4 w-4" />
            Admin
          </Button>
        }
      />

      {!isOnline && (
        <OnlineOnlyNotice description="Operacje superadmina wymagają aktywnego połączenia z serwerem." />
      )}

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard icon={Users} label="Użytkownicy" value={users.length} detail={`${roleCounts.admin} adminów`} />
        <MetricCard icon={Building2} label="Organizacje" value={organizations.length} detail={`${events.length} aktywnych wydarzeń`} />
        <MetricCard icon={CalendarDays} label="Archiwum" value={archivedEvents.length} detail="wydarzenia po zamknięciu" />
        <MetricCard icon={Activity} label="Odprawy" value={checkedInCount} detail={`${participants.length} uczestników`} />
      </div>

      <Tabs
        value={activeTab}
        onValueChange={(value) => {
          setActiveTab(value);
          if (value === "audit" && !hasLoadedRemoteAudit && !isAuditLoading) {
            void loadAudit("all", null, 1);
          }
          if (value === "database" && isOnline && !hasLoadedDatabase && !isDatabaseLoading) {
            void loadDatabase("", 1);
          }
        }}
        className="space-y-5"
      >
        <TabsList className="grid h-auto w-full grid-cols-2 sm:w-auto sm:grid-cols-4">
          <TabsTrigger value="users">Userzy</TabsTrigger>
          <TabsTrigger value="audit">Audyt</TabsTrigger>
          <TabsTrigger value="database">Baza danych</TabsTrigger>
          <TabsTrigger value="control">Kontrola</TabsTrigger>
        </TabsList>

        <TabsContent value="users" className="space-y-4">
          <Tabs
            value={activeUserRoleTab}
            onValueChange={(value) => {
              setActiveUserRoleTab(value as UserRoleTab);
              setUserEventFilter("all");
            }}
            className="space-y-4"
          >
            <TabsList className="grid h-auto w-full grid-cols-2 lg:w-auto lg:grid-cols-4">
              {USER_ROLE_TABS.map((tab) => (
                <TabsTrigger key={tab.value} value={tab.value} className="gap-2">
                  {tab.label}
                  <Badge variant="secondary" className="px-1.5 py-0 text-[0.65rem]">
                    {roleCounts[tab.value]}
                  </Badge>
                </TabsTrigger>
              ))}
            </TabsList>

            <Card>
              <CardContent className="space-y-4 p-4 sm:p-5">
                <div className="grid gap-3 lg:grid-cols-[minmax(14rem,1fr)_minmax(12rem,16rem)_minmax(12rem,16rem)_auto]">
                  <div className="space-y-2">
                    <Label htmlFor="superadmin-user-search">Szukaj</Label>
                    <div className="relative">
                      <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                      <Input
                        id="superadmin-user-search"
                        value={userSearch}
                        onChange={(event) => setUserSearch(event.target.value)}
                        placeholder="Nazwa, e-mail, organizacja, wydarzenie"
                        className="pl-9"
                      />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label>Organizacja</Label>
                    <Select
                      value={userOrganizationFilter}
                      onValueChange={(value) => {
                        setUserOrganizationFilter(value);
                        setUserEventFilter("all");
                      }}
                      disabled={activeUserRoleTab === "admin"}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">Wszystkie</SelectItem>
                        {organizations.map((organization) => (
                          <SelectItem key={organization.id} value={organization.id}>
                            {organization.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Wydarzenie</Label>
                    <Select
                      value={userEventFilter}
                      onValueChange={setUserEventFilter}
                      disabled={activeUserRoleTab === "admin" || availableEventFilters.length === 0}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">Wszystkie</SelectItem>
                        {availableEventFilters.map((event) => (
                          <SelectItem key={event.id} value={event.id}>
                            {event.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="flex items-end">
                    <Button
                      type="button"
                      variant="outline"
                      className="w-full lg:w-auto"
                      onClick={() => {
                        setUserSearch("");
                        setUserOrganizationFilter("all");
                        setUserEventFilter("all");
                      }}
                    >
                      Wyczyść
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between gap-3">
              <CardTitle className="text-lg">Konta użytkowników</CardTitle>
              <Badge variant="secondary">{activeRoleUsers.length}</Badge>
            </CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Konto</TableHead>
                    <TableHead>Organizacja i przypisania</TableHead>
                    <TableHead className="hidden sm:table-cell">Rola</TableHead>
                    <TableHead className="text-right">Akcje</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {activeRoleUsers.map((admin) => {
                    const organizationName = admin.organization_id
                      ? organizationNameById.get(admin.organization_id) ?? admin.organization_id
                      : "Wszystkie organizacje";
                    const assignedEventNames = admin.assigned_events
                      .map((eventId) => eventById.get(eventId)?.name ?? eventId)
                      .join(", ");
                    const organizationEventCount = admin.organization_id
                      ? allEvents.filter((event) => event.organization_id === admin.organization_id).length
                      : allEvents.length;

                    return (
                    <TableRow key={admin.id}>
                      <TableCell>
                        <div className="min-w-0">
                          <p className="truncate font-medium">{admin.name}</p>
                          <p className="break-all text-xs text-muted-foreground">{admin.email}</p>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="space-y-1 text-sm">
                          <p className="line-clamp-1">{organizationName}</p>
                          {admin.role === "admin" && (
                            <p className="text-xs text-muted-foreground">Pełny dostęp do systemu</p>
                          )}
                          {admin.role === "editor" && (
                            <p className="text-xs text-muted-foreground">{organizationEventCount} wydarzeń organizacji</p>
                          )}
                          {(admin.role === "scanner" || admin.role === "scanner_plus") && (
                            <p className="truncate text-xs text-muted-foreground">
                              {admin.assigned_events.length > 0 ? assignedEventNames : "Brak przypisanych wydarzeń"}
                            </p>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="hidden sm:table-cell">
                        <Badge variant="outline">{roleLabels[admin.role]}</Badge>
                      </TableCell>
                      <TableCell>
                        <div className="flex justify-end gap-2">
                          <Button variant="ghost" size="icon" onClick={() => openUserDetails(admin)} title="Szczegóły konta" aria-label={`Szczegóły konta ${admin.name}`}>
                            <UserRound className="h-4 w-4" />
                          </Button>
                          <Button variant="ghost" size="icon" onClick={() => openEditUser(admin)} disabled={!isOnline} title="Edytuj" aria-label={`Edytuj konto ${admin.name}`}>
                            <Edit3 className="h-4 w-4" />
                          </Button>
                          <Button variant="ghost" size="icon" onClick={() => resetAdminPassword(admin)} disabled={!isOnline} title="Reset hasła" aria-label={`Wyślij reset hasła dla ${admin.name}`}>
                            <KeyRound className="h-4 w-4" />
                          </Button>
                          {admin.role !== "admin" && (
                            <Button variant="ghost" size="icon" onClick={() => openPasswordDialog(admin)} disabled={!isOnline} title="Ustaw hasło" aria-label={`Ustaw hasło dla ${admin.name}`}>
                              <EyeOff className="h-4 w-4" />
                            </Button>
                          )}
                          <Button variant="ghost" size="icon" onClick={() => openUserLogs(admin)} title="Logi konta" aria-label={`Zobacz logi konta ${admin.name}`}>
                            <Activity className="h-4 w-4" />
                          </Button>
                          <Button variant="ghost" size="icon" onClick={() => archiveAdmin(admin)} disabled={!isOnline} title="Archiwizuj" aria-label={`Archiwizuj konto ${admin.name}`}>
                            <Archive className="h-4 w-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                    );
                  })}
                  {activeRoleUsers.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={4} className="py-8 text-center text-sm text-muted-foreground">
                        Brak kont adminów.
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
          </Tabs>
        </TabsContent>

        <TabsContent value="audit" className="space-y-4">
          <Card>
            <CardContent className="space-y-4 p-4 sm:p-5">
              <div className="grid gap-3 lg:grid-cols-[13rem_minmax(0,1fr)_minmax(0,1fr)_auto]">
                <div className="space-y-2">
                  <Label>Zakres</Label>
                  <Select value={auditScope} onValueChange={(value) => changeAuditScope(value as AuditScope)}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Wszystko</SelectItem>
                      <SelectItem value="user">Użytkownik</SelectItem>
                      <SelectItem value="organization">Organizacja</SelectItem>
                      <SelectItem value="event">Wydarzenie</SelectItem>
                      <SelectItem value="participant">Uczestnik</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label>Encja</Label>
                  <Input
                    value={entitySearch}
                    onChange={(event) => {
                      setEntitySearch(event.target.value);
                      setSelectedEntity(null);
                    }}
                    disabled={auditScope === "all"}
                    placeholder={auditScope === "all" ? "Cały system" : "Szukaj..."}
                  />
                </div>

                <div className="space-y-2">
                  <Label>Tekst w logach</Label>
                  <Input value={auditQuery} onChange={(event) => setAuditQuery(event.target.value)} placeholder="Akcja, osoba, pole..." />
                </div>

                <div className="flex items-end">
                  <Button onClick={() => void loadAudit(auditScope, selectedEntity, 1)} disabled={isAuditLoading} className="w-full lg:w-auto">
                    {isAuditLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Search className="mr-2 h-4 w-4" />}
                    Szukaj
                  </Button>
                </div>
              </div>

              {auditScope !== "all" && !selectedEntity && filteredEntityOptions.length > 0 && (
                <div className="space-y-2">
                  <p className="text-xs text-muted-foreground">
                    Pokazano maksymalnie {AUDIT_ENTITY_OPTION_LIMIT} z {matchingEntityOptions.length} pasujących encji. Zawęź wyszukiwanie, aby znaleźć konkretną pozycję.
                  </p>
                  <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-3">
                    {filteredEntityOptions.map((entity) => (
                      <button
                        key={entity.id}
                        type="button"
                        onClick={() => selectEntity(entity)}
                        className="rounded-lg border bg-background px-3 py-2 text-left transition-colors hover:bg-accent"
                      >
                        <span className="block truncate text-sm font-medium">{entity.label}</span>
                        <span className="block truncate text-xs text-muted-foreground">{entity.meta}</span>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {selectedEntity && (
                <div className="flex flex-wrap items-center gap-2">
                  <Badge variant="secondary">{selectedEntity.label}</Badge>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      setSelectedEntity(null);
                      setAuditPage(1);
                      void loadAudit(auditScope, null, 1);
                    }}
                  >
                    Wyczyść
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between gap-3">
              <CardTitle className="text-lg">Logi audytu</CardTitle>
              <p className="text-sm text-muted-foreground">
                {auditRangeStart}-{auditRangeEnd} z {displayedAuditMeta.total}
              </p>
            </CardHeader>
            <CardContent className="p-0">
              <Table className="min-w-[1120px] table-fixed">
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[10rem]">Czas</TableHead>
                    <TableHead>Akcja</TableHead>
                    <TableHead className="w-[22rem]">Powiązania</TableHead>
                    <TableHead className="w-[13rem]">Operator</TableHead>
                    <TableHead className="w-[9rem]">Źródło</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {displayedAuditEntries.map((entry) => (
                    <TableRow key={`${entry.source}-${entry.id}`}>
                      <TableCell className="whitespace-nowrap text-xs text-muted-foreground">{formatDateTime(entry.timestamp)}</TableCell>
                      <TableCell>
                        <div className="space-y-1">
                          <p className="text-sm font-medium">{entry.action}</p>
                          {entry.changed_fields && entry.changed_fields.length > 0 && (
                            <p className="text-xs text-muted-foreground">{entry.changed_fields.join(", ")}</p>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <RelatedAuditData entry={entry} />
                      </TableCell>
                      <TableCell className="text-sm">{entry.user_name || "-"}</TableCell>
                      <TableCell>
                        <Badge variant={entry.source === "participant_change" ? "secondary" : "outline"}>
                          {entry.source === "participant_change" ? "zmiana" : "aktywność"}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                  {displayedAuditEntries.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={5} className="py-8 text-center text-sm text-muted-foreground">
                        Brak logów dla wybranego zakresu.
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
              {displayedAuditMeta.total_pages > 1 && (
                <div className="flex flex-col gap-3 border-t px-4 py-3 sm:flex-row sm:items-center sm:justify-between sm:px-5">
                  <p className="text-sm text-muted-foreground">
                    Strona {displayedAuditMeta.page} z {displayedAuditMeta.total_pages}
                  </p>
                  <Pagination className="mx-0 w-auto justify-start sm:justify-end">
                    <PaginationContent>
                      <PaginationItem>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          onClick={() => goToAuditPage(displayedAuditMeta.page - 1)}
                          disabled={displayedAuditMeta.page <= 1 || isAuditLoading}
                          aria-label="Poprzednia strona"
                        >
                          <ChevronLeft className="h-4 w-4" />
                        </Button>
                      </PaginationItem>
                      <PaginationItem>
                        <span className="flex h-9 min-w-20 items-center justify-center rounded-md border px-3 text-sm tabular-nums">
                          {displayedAuditMeta.page} / {displayedAuditMeta.total_pages}
                        </span>
                      </PaginationItem>
                      <PaginationItem>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          onClick={() => goToAuditPage(displayedAuditMeta.page + 1)}
                          disabled={displayedAuditMeta.page >= displayedAuditMeta.total_pages || isAuditLoading}
                          aria-label="Nastepna strona"
                        >
                          <ChevronRight className="h-4 w-4" />
                        </Button>
                      </PaginationItem>
                    </PaginationContent>
                  </Pagination>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="database" className="space-y-4">
          <Card>
            <CardContent className="space-y-4 p-4 sm:p-5">
              <div className="grid gap-3 lg:grid-cols-[minmax(16rem,26rem)_auto_1fr]">
                <div className="space-y-2">
                  <Label>Tabela</Label>
                  <Select
                    value={selectedDatabaseTable}
                    onValueChange={selectDatabaseTable}
                    disabled={!isOnline || isDatabaseLoading || databaseTables.length === 0}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder={hasLoadedDatabase ? "Wybierz tabelę" : "Załaduj listę tabel"} />
                    </SelectTrigger>
                    <SelectContent>
                      {databaseTables.map((table) => (
                        <SelectItem key={table.name} value={table.name}>
                          {table.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="flex items-end">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => void loadDatabase(selectedDatabaseTable, selectedDatabaseTable ? databasePage : 1)}
                    disabled={!isOnline || isDatabaseLoading}
                    className="w-full lg:w-auto"
                  >
                    {isDatabaseLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <RefreshCw className="mr-2 h-4 w-4" />}
                    Odśwież
                  </Button>
                </div>

                <div className="flex flex-wrap items-end gap-2">
                  <Badge variant="secondary">{databaseTables.length} tabel</Badge>
                  {selectedDatabaseTable && (
                    <>
                      <Badge variant="outline">{databaseColumns.length} kolumn</Badge>
                      <Badge variant="outline">{databaseMeta.total} wierszy</Badge>
                    </>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between gap-3">
              <CardTitle className="flex min-w-0 items-center gap-2 text-lg">
                <Database className="h-5 w-5 shrink-0" />
                <span className="truncate">{selectedDatabaseTable || "Dane tabeli"}</span>
              </CardTitle>
              {selectedDatabaseTable && (
                <p className="shrink-0 text-sm text-muted-foreground">
                  {databaseRangeStart}-{databaseRangeEnd} z {databaseMeta.total}
                </p>
              )}
            </CardHeader>
            <CardContent className="p-0">
              {!selectedDatabaseTable && (
                <div className="px-4 py-8 text-center text-sm text-muted-foreground sm:px-5">
                  Wybierz tabelę, aby zobaczyć wszystkie jej kolumny i wiersze.
                </div>
              )}

              {selectedDatabaseTable && (
                <>
                  <div className="overflow-x-auto">
                    <Table className="min-w-[960px]">
                      <TableHeader>
                        <TableRow>
                          {databaseColumns.map((column) => (
                            <TableHead key={column.name} className="min-w-40 align-top">
                              <span className="block truncate font-mono text-xs">{column.name}</span>
                              <span className="block truncate text-[0.68rem] font-normal text-muted-foreground">
                                {column.type}{column.key ? ` · ${column.key}` : ""}
                              </span>
                            </TableHead>
                          ))}
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {databaseRows.map((row, rowIndex) => (
                          <TableRow key={`${selectedDatabaseTable}-${databaseMeta.page}-${rowIndex}`}>
                            {databaseColumns.map((column) => {
                              const value = formatDatabaseValue(row[column.name]);
                              const isNull = row[column.name] === null || typeof row[column.name] === "undefined";

                              return (
                                <TableCell
                                  key={column.name}
                                  title={value}
                                  className={`max-w-[18rem] truncate whitespace-nowrap font-mono text-xs ${isNull ? "text-muted-foreground" : ""}`}
                                >
                                  {value}
                                </TableCell>
                              );
                            })}
                          </TableRow>
                        ))}
                        {databaseRows.length === 0 && !isDatabaseLoading && (
                          <TableRow>
                            <TableCell colSpan={Math.max(databaseColumns.length, 1)} className="py-8 text-center text-sm text-muted-foreground">
                              Brak wierszy w wybranej tabeli.
                            </TableCell>
                          </TableRow>
                        )}
                        {isDatabaseLoading && (
                          <TableRow>
                            <TableCell colSpan={Math.max(databaseColumns.length, 1)} className="py-8 text-center text-sm text-muted-foreground">
                              <Loader2 className="mr-2 inline h-4 w-4 animate-spin" />
                              Ładowanie danych...
                            </TableCell>
                          </TableRow>
                        )}
                      </TableBody>
                    </Table>
                  </div>

                  {databaseMeta.total_pages > 1 && (
                    <div className="flex flex-col gap-3 border-t px-4 py-3 sm:flex-row sm:items-center sm:justify-between sm:px-5">
                      <p className="text-sm text-muted-foreground">
                        Strona {databaseMeta.page} z {databaseMeta.total_pages}
                      </p>
                      <Pagination className="mx-0 w-auto justify-start sm:justify-end">
                        <PaginationContent>
                          <PaginationItem>
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              onClick={() => goToDatabasePage(databaseMeta.page - 1)}
                              disabled={databaseMeta.page <= 1 || isDatabaseLoading}
                              aria-label="Poprzednia strona"
                            >
                              <ChevronLeft className="h-4 w-4" />
                            </Button>
                          </PaginationItem>
                          <PaginationItem>
                            <span className="flex h-9 min-w-20 items-center justify-center rounded-md border px-3 text-sm tabular-nums">
                              {databaseMeta.page} / {databaseMeta.total_pages}
                            </span>
                          </PaginationItem>
                          <PaginationItem>
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              onClick={() => goToDatabasePage(databaseMeta.page + 1)}
                              disabled={databaseMeta.page >= databaseMeta.total_pages || isDatabaseLoading}
                              aria-label="Następna strona"
                            >
                              <ChevronRight className="h-4 w-4" />
                            </Button>
                          </PaginationItem>
                        </PaginationContent>
                      </Pagination>
                    </div>
                  )}
                </>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="control" className="space-y-3 sm:space-y-4">
          <div className="grid gap-2 sm:gap-4 lg:grid-cols-2">
            <ControlCard title="Role" icon={Shield}>
              {Object.entries(roleCounts).map(([role, count]) => (
                <ControlRow key={role} label={roleLabels[role as Role]} value={count} />
              ))}
            </ControlCard>

            <ControlCard title="Uczestnicy" icon={UserRound}>
              {Object.entries(participantStatusCounts).map(([status, count]) => (
                <ControlRow key={status} label={participantStatusLabels[status as ParticipantStatus]} value={count} />
              ))}
            </ControlCard>

            <ControlCard title="Wydarzenia" icon={CalendarDays}>
              <ControlRow label="Aktywne" value={events.length} />
              <ControlRow label="Archiwalne" value={archivedEvents.length} />
              <ControlRow label="Z uczestnikami" value={new Set(participants.map((participant) => participant.event_id)).size} />
            </ControlCard>

            <ControlCard title="Ostatnie aktywności" icon={Activity}>
              {activityLog.slice(0, 5).map((log) => (
                <div key={log.id} className="border-b py-1.5 last:border-0 sm:py-2">
                  <p className="break-words text-xs font-medium sm:text-sm">{log.action}</p>
                  <p className="text-xs text-muted-foreground">{formatDateTime(log.timestamp)}</p>
                </div>
              ))}
              {activityLog.length === 0 && <p className="text-sm text-muted-foreground">Brak aktywności.</p>}
            </ControlCard>
          </div>
        </TabsContent>
      </Tabs>

      <Dialog
        open={profileDialogOpen}
        onOpenChange={(open) => {
          setProfileDialogOpen(open);
          if (!open) setProfileUser(null);
        }}
      >
        <DialogContent className="max-w-[calc(100vw-2rem)] sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Szczegóły konta</DialogTitle>
          </DialogHeader>
          {profileUser && (
            <div className="space-y-4">
              <div className="rounded-lg border bg-muted/30 p-3">
                <p className="font-medium">{profileUser.name}</p>
                <p className="break-all text-sm text-muted-foreground">{profileUser.email}</p>
              </div>
              <div className="grid gap-3 text-sm sm:grid-cols-2">
                <AccountDetail label="Rola" value={roleLabels[profileUser.role]} />
                <AccountDetail
                  label="Organizacja"
                  value={
                    profileUser.organization_id
                      ? organizationNameById.get(profileUser.organization_id) ?? profileUser.organization_id
                      : "Wszystkie organizacje"
                  }
                />
                <AccountDetail label="ID konta" value={profileUser.id} />
                <AccountDetail
                  label="Przypisane wydarzenia"
                  value={
                    profileUser.role === "admin"
                      ? "Pełny dostęp"
                      : profileUser.role === "editor"
                        ? `${allEvents.filter((event) => event.organization_id === profileUser.organization_id).length} wydarzeń organizacji`
                        : profileUser.assigned_events
                            .map((eventId) => eventById.get(eventId)?.name ?? eventId)
                            .join(", ") || "Brak"
                  }
                />
              </div>
              <div className="flex flex-wrap gap-2">
                <Button variant="outline" size="sm" onClick={() => openUserLogs(profileUser)}>
                  <Activity className="mr-1 h-4 w-4" />
                  Logi
                </Button>
                <Button variant="outline" size="sm" onClick={() => openEditUser(profileUser)} disabled={!isOnline}>
                  <Edit3 className="mr-1 h-4 w-4" />
                  Edytuj
                </Button>
                <Button variant="outline" size="sm" onClick={() => resetAdminPassword(profileUser)} disabled={!isOnline}>
                  <KeyRound className="mr-1 h-4 w-4" />
                  Reset hasła
                </Button>
                {profileUser.role !== "admin" && (
                  <Button variant="outline" size="sm" onClick={() => openPasswordDialog(profileUser)} disabled={!isOnline}>
                    <EyeOff className="mr-1 h-4 w-4" />
                    Ustaw hasło
                  </Button>
                )}
                {(profileUser.role === "scanner" || profileUser.role === "scanner_plus") && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => void toggleScannerRole(profileUser)}
                    disabled={!isOnline || isChangingUserRole}
                  >
                    {isChangingUserRole && <Loader2 className="mr-1 h-4 w-4 animate-spin" />}
                    {profileUser.role === "scanner" ? "Zmień na Operator Plus" : "Zmień na Operator"}
                  </Button>
                )}
                <Button variant="destructive" size="sm" onClick={() => archiveAdmin(profileUser)} disabled={!isOnline}>
                  <Archive className="mr-1 h-4 w-4" />
                  Archiwizuj
                </Button>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button onClick={() => setProfileDialogOpen(false)}>Zamknij</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={userDialogOpen}
        onOpenChange={(open) => {
          setUserDialogOpen(open);
          if (!open) {
            setEditUser(null);
            setUserForm({ name: "", email: "" });
          }
        }}
      >
        <DialogContent className="max-w-[calc(100vw-2rem)] sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Edytuj konto</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="superadmin-user-name">Nazwa</Label>
              <Input
                id="superadmin-user-name"
                value={userForm.name}
                onChange={(event) => setUserForm((previous) => ({ ...previous, name: event.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="superadmin-user-email">E-mail</Label>
              <Input
                id="superadmin-user-email"
                type="email"
                value={userForm.email}
                onChange={(event) => setUserForm((previous) => ({ ...previous, email: event.target.value }))}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setUserDialogOpen(false)} disabled={isSavingUser}>
              Anuluj
            </Button>
            <Button onClick={() => void saveUser()} disabled={isSavingUser}>
              {isSavingUser && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Zapisz
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={passwordDialogOpen}
        onOpenChange={(open) => {
          setPasswordDialogOpen(open);
          if (!open) {
            setSelectedActionUser(null);
            setPasswordDraft("");
            setShowPasswordDraft(false);
            setPasswordErrors({});
          }
        }}
      >
        <DialogContent className="max-w-[calc(100vw-2rem)] sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Ustaw hasło</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="rounded-lg border bg-muted/30 p-3 text-sm">
              <p className="font-medium">{selectedActionUser?.name}</p>
              <p className="break-all text-xs text-muted-foreground">{selectedActionUser?.email}</p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="superadmin-user-password">Nowe hasło</Label>
              <div className="flex gap-2">
                <div className="relative min-w-0 flex-1">
                  <Input
                    id="superadmin-user-password"
                    type={showPasswordDraft ? "text" : "password"}
                    value={passwordDraft}
                    onChange={(event) => {
                      setPasswordDraft(event.target.value);
                      setPasswordErrors({});
                    }}
                    autoComplete="new-password"
                    className="pr-10"
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="absolute right-1 top-1/2 h-8 w-8 -translate-y-1/2"
                    onClick={() => setShowPasswordDraft((visible) => !visible)}
                    aria-label={showPasswordDraft ? "Ukryj hasło" : "Pokaż hasło"}
                  >
                    {showPasswordDraft ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </Button>
                </div>
                <Button type="button" variant="outline" onClick={generatePasswordDraft}>
                  <KeyRound className="mr-1 h-4 w-4" />
                  Generator
                </Button>
              </div>
              <PasswordRequirements password={passwordDraft} />
              <FieldError id="superadmin-user-password-error">{passwordErrors.password}</FieldError>
            </div>
            <FieldError id="superadmin-user-password-form-error">{passwordErrors.form}</FieldError>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPasswordDialogOpen(false)} disabled={isSettingPassword}>
              Anuluj
            </Button>
            <Button onClick={() => void saveUserPassword()} disabled={isSettingPassword || !selectedActionUser}>
              {isSettingPassword && <Loader2 className="mr-1 h-4 w-4 animate-spin" />}
              Zapisz hasło
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={adminDialogOpen}
        onOpenChange={(nextOpen) => {
          setAdminDialogOpen(nextOpen);
          if (!nextOpen) resetAdminForm();
        }}
      >
        <DialogContent className="max-w-[calc(100vw-2rem)] sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{editAdmin ? "Edytuj admina" : "Nowy admin"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="superadmin-admin-name">Nazwa</Label>
              <Input
                id="superadmin-admin-name"
                value={adminForm.name}
                onChange={(event) => setAdminForm((previous) => ({ ...previous, name: event.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="superadmin-admin-email">E-mail</Label>
              <Input
                id="superadmin-admin-email"
                type="email"
                value={adminForm.email}
                onChange={(event) => setAdminForm((previous) => ({ ...previous, email: event.target.value }))}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAdminDialogOpen(false)}>
              Anuluj
            </Button>
            <Button onClick={saveAdmin} disabled={isSavingAdmin}>
              {isSavingAdmin && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Zapisz
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function formatDatabaseValue(value: unknown): string {
  if (value === null || typeof value === "undefined") {
    return "NULL";
  }

  if (typeof value === "object") {
    try {
      return JSON.stringify(value);
    } catch {
      return String(value);
    }
  }

  return String(value);
}

function MetricCard({
  icon: Icon,
  label,
  value,
  detail,
}: {
  icon: LucideIcon;
  label: string;
  value: number;
  detail: string;
}) {
  return (
    <Card>
      <CardContent className="flex items-center gap-4 p-4">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
          <Icon className="h-5 w-5" />
        </div>
        <div className="min-w-0">
          <p className="text-xs uppercase tracking-[0.16em] text-muted-foreground">{label}</p>
          <p className="text-2xl font-semibold">{value}</p>
          <p className="truncate text-xs text-muted-foreground">{detail}</p>
        </div>
      </CardContent>
    </Card>
  );
}

function AccountDetail({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0 rounded-md border bg-background/60 p-3">
      <p className="text-xs uppercase tracking-[0.14em] text-muted-foreground">{label}</p>
      <p className="mt-1 break-words text-sm font-medium">{value}</p>
    </div>
  );
}

function RelatedAuditData({ entry }: { entry: AuditEntry }) {
  const participantId = entry.participant_id ? String(entry.participant_id) : "";
  const participantUiId = participantId.startsWith("p-") ? participantId : `p-${participantId}`;
  const values = [
    entry.organization_id && entry.organization_name
      ? {
          key: `organization-${entry.organization_id}`,
          label: entry.organization_name,
          meta: "Organizacja",
          to: buildOrganizationPath(entry.organization_id),
        }
      : null,
    entry.event_id && entry.event_name
      ? {
          key: `event-${entry.event_id}`,
          label: entry.event_name,
          meta: "Wydarzenie",
          to: buildEventPath(entry.event_id),
        }
      : null,
    entry.event_id && participantId && entry.participant_name
      ? {
          key: `participant-${participantId}`,
          label: entry.participant_name,
          meta: "Uczestnik",
          to: buildEventParticipantPath(entry.event_id, participantUiId),
        }
      : null,
  ].filter((value): value is { key: string; label: string; meta: string; to: string } => value !== null);

  if (values.length === 0) {
    return <span className="text-sm text-muted-foreground">-</span>;
  }

  return (
    <div className="space-y-1 text-sm">
      {values.map((value) => (
        <Link
          key={value.key}
          to={value.to}
          className="block min-w-0 rounded-md px-1 py-0.5 text-primary transition-colors hover:bg-primary/10 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <span className="block truncate text-[0.68rem] uppercase tracking-[0.14em] text-muted-foreground">
            {value.meta}
          </span>
          <span className="block truncate font-medium">{value.label}</span>
        </Link>
      ))}
    </div>
  );
}

function ControlCard({
  title,
  icon: Icon,
  children,
}: {
  title: string;
  icon: LucideIcon;
  children: ReactNode;
}) {
  return (
    <Card className="rounded-xl sm:rounded-[1.5rem]">
      <CardHeader className="flex flex-row items-center gap-2 p-3 pb-2 sm:gap-3 sm:p-6">
        <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary sm:h-9 sm:w-9 sm:rounded-lg">
          <Icon className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
        </div>
        <CardTitle className="truncate text-sm sm:text-lg">{title}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-0.5 px-3 pb-3 pt-0 sm:space-y-1 sm:px-6 sm:pb-6">{children}</CardContent>
    </Card>
  );
}

function ControlRow({ label, value }: { label: string; value: number }) {
  return (
    <div className="flex items-center justify-between gap-2 border-b py-1.5 text-xs last:border-0 sm:gap-4 sm:py-2 sm:text-sm">
      <span className="min-w-0 truncate text-muted-foreground">{label}</span>
      <span className="shrink-0 font-semibold tabular-nums">{value}</span>
    </div>
  );
}
