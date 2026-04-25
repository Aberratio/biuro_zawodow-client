import { useMemo, useState } from "react";
import type { ReactNode } from "react";
import {
  Activity,
  Archive,
  Building2,
  CalendarDays,
  Edit3,
  KeyRound,
  Loader2,
  Plus,
  Search,
  Shield,
  UserRound,
  Users,
  type LucideIcon,
} from "lucide-react";

import { PageHeader } from "@/components/PageHeader";
import { OnlineOnlyNotice } from "@/components/OnlineOnlyNotice";
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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
import { participantCountsAsCheckedIn } from "@/lib/participant-status";
import type { ParticipantStatus, Role, User } from "@/types";

type AuditScope = "all" | "user" | "organization" | "event" | "participant";

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
  const [hasLoadedRemoteAudit, setHasLoadedRemoteAudit] = useState(false);
  const [isAuditLoading, setIsAuditLoading] = useState(false);
  const [activeTab, setActiveTab] = useState("admins");

  const allEvents = useMemo(() => [...events, ...archivedEvents], [archivedEvents, events]);
  const isOnline = connectionState === "online";

  const adminUsers = useMemo(
    () => users.filter((user) => user.role === "admin").sort((left, right) => left.name.localeCompare(right.name, "pl")),
    [users],
  );

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

  const filteredEntityOptions = useMemo(() => {
    const query = normalizeSearch(entitySearch);
    if (!query) return entityOptions.slice(0, 12);

    return entityOptions
      .filter((entity) => `${entity.label} ${entity.meta}`.toLocaleLowerCase("pl-PL").includes(query))
      .slice(0, 12);
  }, [entityOptions, entitySearch]);

  const localAuditEntries = useMemo<AuditEntry[]>(() => {
    return activityLog.slice(0, 100).map((log) => ({
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

  const displayedAuditEntries = hasLoadedRemoteAudit ? auditEntries : localAuditEntries;

  const loadAudit = async (nextScope = auditScope, nextEntity = selectedEntity) => {
    setIsAuditLoading(true);
    try {
      const params = new URLSearchParams({
        scope: nextScope,
        limit: "200",
      });
      if (nextEntity?.id) params.set("id", nextEntity.id);
      if (auditQuery.trim()) params.set("q", auditQuery.trim());

      const { payload } = await fetchJson(`${API_BASE_URL}/superadmin/audit?${params.toString()}`, {
        headers: getAuthHeaders(),
      });
      const data = (payload as { data?: AuditEntry[] }).data;
      setAuditEntries(Array.isArray(data) ? data : []);
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
      await fetchJson(`${API_BASE_URL}/superadmin/admins/${admin.id}/password-reset`, {
        method: "POST",
        headers: getAuthHeaders(),
      });
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
    const confirmed = window.confirm(`Zarchiwizować konto admina ${admin.name}?`);
    if (!confirmed) return;

    try {
      await fetchJson(`${API_BASE_URL}/superadmin/admins/${admin.id}`, {
        method: "DELETE",
        headers: getAuthHeaders(),
      });
      toast({ title: "Zarchiwizowano konto admina" });
      await refreshData();
      if (activeTab === "audit" || hasLoadedRemoteAudit) {
        await loadAudit();
      }
    } catch (error) {
      toast({
        title: "Nie udało się zarchiwizować admina",
        description: error instanceof Error ? error.message : "Spróbuj ponownie.",
        variant: "destructive",
      });
    }
  };

  const changeAuditScope = (scope: AuditScope) => {
    setAuditScope(scope);
    setSelectedEntity(null);
    setEntitySearch("");
    if (activeTab === "audit") {
      void loadAudit(scope, null);
    }
  };

  const selectEntity = (entity: EntityOption) => {
    setSelectedEntity(entity);
    setEntitySearch(entity.label);
    void loadAudit(auditScope, entity);
  };

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
            void loadAudit("all", null);
          }
        }}
        className="space-y-5"
      >
        <TabsList className="grid h-auto w-full grid-cols-3 sm:w-auto">
          <TabsTrigger value="admins">Admini</TabsTrigger>
          <TabsTrigger value="audit">Audyt</TabsTrigger>
          <TabsTrigger value="control">Kontrola</TabsTrigger>
        </TabsList>

        <TabsContent value="admins" className="space-y-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between gap-3">
              <CardTitle className="text-lg">Konta adminów</CardTitle>
              <Badge variant="secondary">{adminUsers.length}</Badge>
            </CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Admin</TableHead>
                    <TableHead>E-mail</TableHead>
                    <TableHead className="hidden sm:table-cell">Rola</TableHead>
                    <TableHead className="text-right">Akcje</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {adminUsers.map((admin) => (
                    <TableRow key={admin.id}>
                      <TableCell className="font-medium">{admin.name}</TableCell>
                      <TableCell className="break-all text-sm text-muted-foreground">{admin.email}</TableCell>
                      <TableCell className="hidden sm:table-cell">
                        <Badge variant="outline">Admin</Badge>
                      </TableCell>
                      <TableCell>
                        <div className="flex justify-end gap-2">
                          <Button variant="ghost" size="icon" onClick={() => openEditAdmin(admin)} disabled={!isOnline} title="Edytuj" aria-label={`Edytuj admina ${admin.name}`}>
                            <Edit3 className="h-4 w-4" />
                          </Button>
                          <Button variant="ghost" size="icon" onClick={() => resetAdminPassword(admin)} disabled={!isOnline} title="Reset hasła" aria-label={`Wyślij reset hasła adminowi ${admin.name}`}>
                            <KeyRound className="h-4 w-4" />
                          </Button>
                          <Button variant="ghost" size="icon" onClick={() => archiveAdmin(admin)} disabled={!isOnline} title="Archiwizuj" aria-label={`Archiwizuj admina ${admin.name}`}>
                            <Archive className="h-4 w-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                  {adminUsers.length === 0 && (
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
                  <Button onClick={() => void loadAudit()} disabled={isAuditLoading} className="w-full lg:w-auto">
                    {isAuditLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Search className="mr-2 h-4 w-4" />}
                    Szukaj
                  </Button>
                </div>
              </div>

              {auditScope !== "all" && !selectedEntity && filteredEntityOptions.length > 0 && (
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
              )}

              {selectedEntity && (
                <div className="flex flex-wrap items-center gap-2">
                  <Badge variant="secondary">{selectedEntity.label}</Badge>
                  <Button variant="ghost" size="sm" onClick={() => setSelectedEntity(null)}>
                    Wyczyść
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Czas</TableHead>
                    <TableHead>Akcja</TableHead>
                    <TableHead className="hidden lg:table-cell">Powiązania</TableHead>
                    <TableHead className="hidden md:table-cell">Operator</TableHead>
                    <TableHead>Źródło</TableHead>
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
                      <TableCell className="hidden max-w-[22rem] lg:table-cell">
                        <RelatedAuditData entry={entry} />
                      </TableCell>
                      <TableCell className="hidden text-sm md:table-cell">{entry.user_name || "-"}</TableCell>
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
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="control" className="space-y-4">
          <div className="grid gap-4 lg:grid-cols-2">
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
                <div key={log.id} className="border-b py-2 last:border-0">
                  <p className="truncate text-sm font-medium">{log.action}</p>
                  <p className="text-xs text-muted-foreground">{formatDateTime(log.timestamp)}</p>
                </div>
              ))}
              {activityLog.length === 0 && <p className="text-sm text-muted-foreground">Brak aktywności.</p>}
            </ControlCard>
          </div>
        </TabsContent>
      </Tabs>

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

function RelatedAuditData({ entry }: { entry: AuditEntry }) {
  const values = [
    entry.organization_name,
    entry.event_name,
    entry.participant_name,
  ].filter(Boolean);

  if (values.length === 0) {
    return <span className="text-sm text-muted-foreground">-</span>;
  }

  return (
    <div className="space-y-1 text-sm">
      {values.map((value) => (
        <p key={value} className="truncate">
          {value}
        </p>
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
    <Card>
      <CardHeader className="flex flex-row items-center gap-3">
        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10 text-primary">
          <Icon className="h-4 w-4" />
        </div>
        <CardTitle className="text-lg">{title}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-1">{children}</CardContent>
    </Card>
  );
}

function ControlRow({ label, value }: { label: string; value: number }) {
  return (
    <div className="flex items-center justify-between gap-4 border-b py-2 text-sm last:border-0">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-semibold tabular-nums">{value}</span>
    </div>
  );
}
