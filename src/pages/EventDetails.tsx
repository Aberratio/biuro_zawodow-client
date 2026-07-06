import { useEffect, useMemo, useState, type ReactNode } from "react";
import { useParams, useNavigate, useLocation } from "react-router-dom";
import { formatDistanceToNowStrict } from "date-fns";
import { pl } from "date-fns/locale";
import { useData } from "@/contexts/DataContext";
import { useRouteEventContext } from "@/hooks/use-route-event-context";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { DateTimePicker } from "@/components/ui/date-time-picker";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { FieldError } from "@/components/ui/field-error";
import { Checkbox } from "@/components/ui/checkbox";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  Archive,
  ArrowLeft,
  Calendar,
  ChevronDown,
  ChevronUp,
  Download,
  Eye,
  EyeOff,
  FileUp,
  Info,
  KeyRound,
  Loader2,
  Mail,
  MapPin,
  Pencil,
  Plus,
  ScanLine,
  Trash2,
  Users,
} from "lucide-react";
import { toast } from "@/hooks/use-toast";
import DetailSkeleton from "@/components/skeletons/DetailSkeleton";
import type { ParticipantFieldMapping, ParticipantFieldRole, ParticipantFieldType, ParticipantFieldValidationRules, User } from "@/types";
import {
  formatEventOfficeEnd,
  formatEventOfficeStart,
  getEventOfficeValidationErrors,
  formatEventOfficeWindow,
  getEventOfficeRangeValidationResult,
  getEventOfficeCloseAt,
  getEventOfficeOpenAt,
  isEventCurrentOrUpcoming,
  isEventOfficeStartAtOrAfterNow,
  isEventOfficeOpen,
  isValidEventOfficeRange,
  toLocalDateTimeValue,
} from "@/lib/events";
import {
  buildEmptyParticipantFieldValues,
  formatSelectOptions,
  getActiveParticipantMappings,
  getParticipantFieldType,
  getParticipantValidationRules,
  isConfigurableParticipantMapping,
  parseSelectOptions,
  participantFieldTypeLabels,
  validateParticipantFieldValue,
} from "@/lib/participant-fields";
import { participantCountsAsCheckedIn } from "@/lib/participant-status";
import {
  validateEmail,
  validateRequired,
  validateStrongPassword,
} from "@/lib/form-validation";
import { getRoleLabel, isScannerRole } from "@/lib/roles";
import { cn } from "@/lib/utils";
import { OnlineOnlyNotice } from "@/components/OnlineOnlyNotice";
import { PasswordRequirements } from "@/components/PasswordRequirements";
import { generateStrongPassword } from "@/lib/password";
import {
  buildEventEmailsPath,
  buildEventImportPath,
  buildEventParticipantsPath,
} from "@/lib/routes";

type OfficeStatusTone = "open" | "upcoming" | "closed";
type EditableMappingRole = Extract<ParticipantFieldRole, "custom" | "important_custom">;

type MappingDraft = ParticipantFieldMapping;

type MappingDraftErrors = {
  aliases: Record<string, string>;
  form?: string;
};

interface OfficeStatusSummary {
  tone: OfficeStatusTone;
  badgeLabel: string;
  headline: string;
  detail: string;
  timingLabel: string;
  timingValue: string;
}

const mappingRoleLabels: Record<ParticipantFieldRole, string> = {
  email: "E-mail",
  display_name_part: "Część nazwy",
  bib_number: "Numer startowy",
  custom: "Pole dodatkowe",
  important_custom: "Wyróżnij przy odprawie",
};

function isEditableMappingRole(role: ParticipantFieldRole): role is EditableMappingRole {
  return role === "custom" || role === "important_custom";
}

function validateMappingValidationRules(mapping: MappingDraft): string {
  if (!isConfigurableParticipantMapping(mapping)) return "";
  const fieldType = getParticipantFieldType(mapping);
  const rules = getParticipantValidationRules(mapping);

  if (fieldType === "text") {
    const minLength = rules.min_length;
    const maxLength = rules.max_length;
    if (typeof minLength === "number" && typeof maxLength === "number" && minLength > maxLength) {
      return "Minimalna liczba znaków nie może być większa od maksymalnej.";
    }
  }

  if (fieldType === "number") {
    const min = typeof rules.min === "number" ? rules.min : Number(rules.min);
    const max = typeof rules.max === "number" ? rules.max : Number(rules.max);
    if (Number.isFinite(min) && Number.isFinite(max) && min > max) {
      return "Minimalna wartość nie może być większa od maksymalnej.";
    }
  }

  if (fieldType === "date") {
    const min = typeof rules.min === "string" ? rules.min : "";
    const max = typeof rules.max === "string" ? rules.max : "";
    if (min && max && min > max) return "Data od nie może być późniejsza niż data do.";
  }

  if (fieldType === "select" && (rules.options ?? []).length === 0) {
    return "Dodaj co najmniej jedną opcję listy wyboru.";
  }

  return "";
}

function buildEditFormFromEvent(event: {
  name: string;
  location: string;
  office_open_at: string;
  office_close_at: string;
}) {
  return {
    name: event.name,
    location: event.location,
    office_open_at: toLocalDateTimeValue(event.office_open_at),
    office_close_at: toLocalDateTimeValue(event.office_close_at),
  };
}

function formatDateTimePickerValue(date: Date): string {
  const pad = (value: number) => String(value).padStart(2, "0");

  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}:00`;
}

function getDefaultReopenCloseAt(now: Date): string {
  const closeAt = new Date(now);
  closeAt.setHours(closeAt.getHours() + 1);
  closeAt.setSeconds(0, 0);

  return formatDateTimePickerValue(closeAt);
}

function getOfficeStatusSummary(
  eventOffice: { office_open_at: string; office_close_at: string },
  now: Date,
): OfficeStatusSummary {
  const openAt = getEventOfficeOpenAt(eventOffice);
  const closeAt = getEventOfficeCloseAt(eventOffice);

  if (!openAt || !closeAt) {
    return {
      tone: "closed",
      badgeLabel: "Brak godzin",
      headline: "Godziny pracy biura nie są ustawione poprawnie.",
      detail:
        "Uzupełnij datę i godzinę otwarcia oraz zamknięcia, aby zespół wiedział, kiedy obsługiwać uczestników.",
      timingLabel: "Zakres",
      timingValue: "Brak danych",
    };
  }

  if (isEventOfficeOpen(eventOffice, now)) {
    return {
      tone: "open",
      badgeLabel: "Biuro otwarte",
      headline: `Biuro pracuje jeszcze przez ${formatDistanceToNowStrict(closeAt, { addSuffix: false, locale: pl })}.`,
      detail: `Uczestnicy mogą być teraz odprawiani. Biuro zamyka się ${formatEventOfficeEnd(eventOffice)}.`,
      timingLabel: "Zamknięcie",
      timingValue: formatEventOfficeEnd(eventOffice),
    };
  }

  if (now < openAt) {
    return {
      tone: "upcoming",
      badgeLabel: "Biuro przed otwarciem",
      headline: `Biuro otworzy się za ${formatDistanceToNowStrict(openAt, { addSuffix: false, locale: pl })}.`,
      detail: `Zespół zacznie pracę ${formatEventOfficeStart(eventOffice)}. Do tego czasu operatorzy nie zobaczą aktywnego wydarzenia.`,
      timingLabel: "Otwarcie",
      timingValue: formatEventOfficeStart(eventOffice),
    };
  }

  return {
    tone: "closed",
    badgeLabel: "Biuro zamknięte",
    headline: `Biuro zakończyło pracę ${formatDistanceToNowStrict(closeAt, { addSuffix: true, locale: pl })}.`,
    detail:
      "Odprawa dla tego wydarzenia została już zamknięta. Nadal możesz sprawdzić dane, eksporty i skład zespołu.",
    timingLabel: "Zamknięcie",
    timingValue: formatEventOfficeEnd(eventOffice),
  };
}

function getOfficeToneClasses(tone: OfficeStatusTone) {
  if (tone === "open") {
    return {
      status: "event-detail-status-open",
    };
  }

  if (tone === "upcoming") {
    return {
      status: "event-detail-status-upcoming",
    };
  }

  return {
    status: "event-detail-status-closed",
  };
}

function TeamMemberRow({ user }: { user: User }) {
  const isScanner = isScannerRole(user.role);

  return (
    <div className="event-detail-member-row">
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          <p className="truncate text-sm font-semibold">{user.name}</p>
          {isScanner ? (
            <Badge
              variant={user.role === "scanner_plus" ? "default" : "secondary"}
              className="rounded-full px-2.5 py-0.5 text-[0.68rem] font-medium shadow-none"
            >
              {user.role === "scanner_plus" ? "Plus" : getRoleLabel(user.role)}
            </Badge>
          ) : null}
        </div>
        <p className="truncate text-xs text-muted-foreground">{user.email}</p>
      </div>
    </div>
  );
}

function CollapsibleSection({
  title,
  defaultOpen = false,
  children,
  className,
  action,
}: {
  title: string;
  defaultOpen?: boolean;
  children: ReactNode;
  className?: string;
  action?: ReactNode;
}) {
  return (
    <Collapsible defaultOpen={defaultOpen}>
      <div className={cn("event-detail-list-section", className)}>
        <div className="flex items-center gap-3 pr-3">
          <CollapsibleTrigger className="event-detail-collapsible-trigger w-full flex-1">
            <h2 className="text-base font-semibold text-foreground">{title}</h2>
            <ChevronDown className="event-detail-collapsible-chevron h-4 w-4 shrink-0" />
          </CollapsibleTrigger>
          {action ? <div className="shrink-0">{action}</div> : null}
        </div>
        <CollapsibleContent className="event-detail-collapsible-content">
          <div className="event-detail-list-content space-y-4">{children}</div>
        </CollapsibleContent>
      </div>
    </Collapsible>
  );
}

function TeamRoleTabPanel({
  role,
  users,
  emptyText,
  action,
}: {
  role: ManagedScannerRole;
  users: User[];
  emptyText: string;
  action?: ReactNode;
}) {
  const permissionDescription =
    role === "scanner"
      ? "Operator może pracować na uczestnikach przypisanych do wydarzenia i obsługiwać standardowy proces odprawy."
      : "Operator Plus ma rozszerzone uprawnienia do pracy na uczestnikach i obsługi przypisanego wydarzenia.";

  return (
    <div className="event-detail-list-section">
      <div className="flex items-center justify-between gap-3 border-b border-border/60 px-4 py-3">
        <div>
          <p className="text-sm font-semibold text-foreground">
            Uprawnienia roli
          </p>
          <p className="text-xs text-muted-foreground">
            {permissionDescription}
          </p>
        </div>
        {action ? <div className="shrink-0">{action}</div> : null}
      </div>
      <div className="event-detail-list-content space-y-4">
        {users.length === 0 ? (
          <div className="event-detail-empty-state px-4 py-5 text-sm text-muted-foreground">
            {emptyText}
          </div>
        ) : (
          users.map((user) => <TeamMemberRow key={user.id} user={user} />)
        )}
      </div>
    </div>
  );
}

type ManagedScannerRole = "scanner" | "scanner_plus";

export default function EventDetails() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  const {
    events,
    archivedEvents,
    participants,
    users,
    currentRole,
    currentUser,
    setSelectedEventId,
    isLoading,
    getParticipantFieldMappingsState,
    updateParticipantFieldMappings,
    addParticipantManually,
    addUser,
    assignScannerEvents,
    updateEvent,
    archiveEvent,
    deleteEvent,
    exportEventCsv,
    exportEventLogsCsv,
    exportEventParticipantChangesCsv,
    connectionState,
  } = useData();
  const [mappings, setMappings] = useState<ParticipantFieldMapping[]>([]);
  const [hasBaselineParticipantImport, setHasBaselineParticipantImport] =
    useState(false);
  const [manualOpen, setManualOpen] = useState(false);
  const [mappingDialogOpen, setMappingDialogOpen] = useState(false);
  const [mappingDrafts, setMappingDrafts] = useState<MappingDraft[]>([]);
  const [mappingErrors, setMappingErrors] = useState<MappingDraftErrors>({
    aliases: {},
  });
  const [mappingSaving, setMappingSaving] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [editReopeningOffice, setEditReopeningOffice] = useState(false);
  const [scannerDialogOpen, setScannerDialogOpen] = useState(false);
  const [managedScannerRole, setManagedScannerRole] =
    useState<ManagedScannerRole>("scanner");
  const [scannerManagerTab, setScannerManagerTab] = useState<
    "existing" | "new"
  >("existing");
  const [scannerSearchQuery, setScannerSearchQuery] = useState("");
  const [scannerSelection, setScannerSelection] = useState<string[]>([]);
  const [scannerSaving, setScannerSaving] = useState(false);
  const [scannerCreateSaving, setScannerCreateSaving] = useState(false);
  const [scannerCreateForm, setScannerCreateForm] = useState({
    name: "",
    email: "",
    use_manual_password: false,
    password: "",
  });
  const [showScannerCreatePassword, setShowScannerCreatePassword] =
    useState(false);
  const [scannerCreateErrors, setScannerCreateErrors] = useState<{
    name?: string;
    email?: string;
    password?: string;
    form?: string;
  }>({});
  const [manualEmail, setManualEmail] = useState("");
  const [manualFields, setManualFields] = useState<Record<string, string>>({});
  const [manualErrors, setManualErrors] = useState<{
    email?: string;
    fields: Record<string, string>;
    form?: string;
  }>({ fields: {} });
  const [manualSaving, setManualSaving] = useState(false);
  const [editSaving, setEditSaving] = useState(false);
  const [editErrors, setEditErrors] = useState<{
    name?: string;
    location?: string;
    office_open_at?: string;
    office_close_at?: string;
    form?: string;
  }>({});
  const [exportingCsv, setExportingCsv] = useState(false);
  const [exportingLogsCsv, setExportingLogsCsv] = useState(false);
  const [exportingParticipantChangesCsv, setExportingParticipantChangesCsv] =
    useState(false);
  const [archiveConfirmOpen, setArchiveConfirmOpen] = useState(false);
  const [isArchivingEvent, setIsArchivingEvent] = useState(false);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [isDeletingEvent, setIsDeletingEvent] = useState(false);
  const [nowTimestamp, setNowTimestamp] = useState(() => Date.now());
  const [editForm, setEditForm] = useState({
    name: "",
    location: "",
    office_open_at: "",
    office_close_at: "",
  });

  const event =
    events.find((entry) => entry.id === id) ??
    archivedEvents.find((entry) => entry.id === id);
  const isArchivedEvent = Boolean(event?.archived_at);
  const eventParticipants = participants.filter(
    (participant) => participant.event_id === id,
  );
  const checkedIn = eventParticipants.filter(
    participantCountsAsCheckedIn,
  ).length;
  const activeMappings = useMemo(
    () => getActiveParticipantMappings(mappings),
    [mappings],
  );
  const organizationScanners = useMemo(
    () =>
      users.filter(
        (user) =>
          isScannerRole(user.role) &&
          user.organization_id === event?.organization_id,
      ),
    [event?.organization_id, users],
  );
  const organizationStandardScanners = useMemo(
    () =>
      organizationScanners
        .filter((user) => user.role === "scanner")
        .sort((a, b) => a.name.localeCompare(b.name, "pl")),
    [organizationScanners],
  );
  const organizationPlusScanners = useMemo(
    () =>
      organizationScanners
        .filter((user) => user.role === "scanner_plus")
        .sort((a, b) => a.name.localeCompare(b.name, "pl")),
    [organizationScanners],
  );
  const assignedScanners = useMemo(
    () =>
      organizationStandardScanners.filter((scanner) =>
        scanner.assigned_events.includes(event?.id ?? ""),
      ),
    [event?.id, organizationStandardScanners],
  );
  const assignedScannerPlus = useMemo(
    () =>
      organizationPlusScanners.filter((scanner) =>
        scanner.assigned_events.includes(event?.id ?? ""),
      ),
    [event?.id, organizationPlusScanners],
  );
  const managedRoleScanners = useMemo(
    () =>
      managedScannerRole === "scanner"
        ? organizationStandardScanners
        : organizationPlusScanners,
    [managedScannerRole, organizationPlusScanners, organizationStandardScanners],
  );
  const filteredManagedRoleScanners = useMemo(() => {
    const normalizedQuery = scannerSearchQuery.trim().toLocaleLowerCase("pl-PL");

    if (!normalizedQuery) {
      return managedRoleScanners;
    }

    return managedRoleScanners.filter((scanner) =>
      `${scanner.name} ${scanner.email}`
        .toLocaleLowerCase("pl-PL")
        .includes(normalizedQuery),
    );
  }, [managedRoleScanners, scannerSearchQuery]);
  const canManageScanners = useMemo(() => {
    if (!event) return false;
    if (currentRole === "superadmin") return true;
    if (currentRole === "admin") return true;
    if (currentRole === "editor")
      return currentUser.organization_id === event.organization_id;
    return false;
  }, [currentRole, currentUser, event]);
  const canEditEvent = isArchivedEvent
    ? currentRole === "superadmin"
    : canManageScanners;
  const canManageEventLifecycle = useMemo(() => {
    if (!event || isArchivedEvent) return false;
    if (currentRole === "superadmin") return true;
    if (currentRole === "admin") return true;
    if (currentRole === "editor") {
      return currentUser.organization_id === event.organization_id;
    }
    return false;
  }, [currentRole, currentUser.organization_id, event, isArchivedEvent]);
  const canUseActiveEventTools =
    !isArchivedEvent &&
    event !== undefined &&
    isEventOfficeOpen(event, new Date(nowTimestamp));
  const isOnline = connectionState === "online";

  useRouteEventContext(id ?? "");

  useEffect(() => {
    const intervalId = window.setInterval(
      () => setNowTimestamp(Date.now()),
      30_000,
    );
    return () => window.clearInterval(intervalId);
  }, []);

  useEffect(() => {
    if (!id || !isOnline) {
      setHasBaselineParticipantImport(false);
      return;
    }

    getParticipantFieldMappingsState(id)
      .then((state) => {
        setMappings(state.mappings);
        setHasBaselineParticipantImport(state.has_baseline_import);
        setManualFields(buildEmptyParticipantFieldValues(state.mappings));
      })
      .catch(() => {
        setMappings([]);
        setHasBaselineParticipantImport(false);
        setManualFields({});
      });
  }, [getParticipantFieldMappingsState, id, isOnline]);

  useEffect(() => {
    if (!event) return;

    setEditForm(buildEditFormFromEvent(event));
  }, [event]);

  if (isLoading) return <DetailSkeleton />;
  if (!event)
    return (
      <div className="py-12 text-center text-muted-foreground">
        Nie znaleziono wydarzenia
      </div>
    );

  const hasSavedMapping = mappings.length > 0;
  const now = new Date(nowTimestamp);
  const officeStatus = getOfficeStatusSummary(event, now);
  const officeToneClasses = getOfficeToneClasses(officeStatus.tone);
  const hasAnyTeamMembers =
    assignedScanners.length > 0 || assignedScannerPlus.length > 0;
  const officeCloseAt = getEventOfficeCloseAt(event);
  const isFinishedEvent = officeCloseAt !== null && now > officeCloseAt;
  const canArchiveEvent = canManageEventLifecycle && isFinishedEvent;
  const canDeleteEvent = canManageEventLifecycle;
  const canDeleteEventNow = canDeleteEvent && !isFinishedEvent;
  const canReopenEvent = canEditEvent && !isArchivedEvent && isFinishedEvent;
  const canSendQrForEvent =
    !isArchivedEvent &&
    isEventCurrentOrUpcoming(event, now);
  const canAssignScannersToEvent =
    !isArchivedEvent && officeCloseAt !== null && now <= officeCloseAt;
  const canEditParticipantMappings = currentRole === "superadmin" && hasSavedMapping;

  const resetEditState = () => {
    setEditErrors({});
    setEditReopeningOffice(false);

    if (!event) {
      setEditForm({
        name: "",
        location: "",
        office_open_at: "",
        office_close_at: "",
      });
      return;
    }

    setEditForm(buildEditFormFromEvent(event));
  };

  const resetMappingDialogState = () => {
    setMappingDrafts(mappings);
    setMappingErrors({ aliases: {} });
  };

  const openMappingDialog = () => {
    resetMappingDialogState();
    setMappingDialogOpen(true);
  };

  const updateMappingDraft = (
    sourceColumnName: string,
    patch: Partial<MappingDraft>,
  ) => {
    setMappingDrafts((current) =>
      current.map((mapping) => {
        if (mapping.source_column_name !== sourceColumnName) return mapping;
        const nextMapping = { ...mapping, ...patch };
        if (!isConfigurableParticipantMapping(nextMapping)) {
          return {
            ...nextMapping,
            field_type: "text",
            validation_rules: {},
          };
        }
        return nextMapping;
      }),
    );
    setMappingErrors((current) => ({
      ...current,
      aliases: {
        ...current.aliases,
        [sourceColumnName]: "",
      },
      form: undefined,
    }));
  };

  const moveMappingDraft = (sourceColumnName: string, direction: -1 | 1) => {
    setMappingDrafts((current) => {
      const currentIndex = current.findIndex(
        (mapping) => mapping.source_column_name === sourceColumnName,
      );
      const nextIndex = currentIndex + direction;
      if (
        currentIndex < 0 ||
        nextIndex < 0 ||
        nextIndex >= current.length ||
        current[currentIndex].field_role === "email" ||
        current[nextIndex].field_role === "email"
      ) {
        return current;
      }

      const next = [...current];
      [next[currentIndex], next[nextIndex]] = [
        next[nextIndex],
        next[currentIndex],
      ];
      return next.map((mapping, index) => ({
        ...mapping,
        display_order: mapping.field_role === "email" ? 0 : index,
      }));
    });
    setMappingErrors({ aliases: {} });
  };

  const validateMappingDrafts = () => {
    const aliasErrors: Record<string, string> = {};
    const activeAliases = new Set<string>();
    let activeDisplayNamePartCount = 0;

    for (const mapping of mappingDrafts) {
      if (mapping.field_role === "email") continue;

      const alias = mapping.alias.trim();
      if (!alias) {
        aliasErrors[mapping.source_column_name] = "Podaj etykietę pola.";
      } else {
        const validationRulesError = validateMappingValidationRules(mapping);
        if (validationRulesError) {
          aliasErrors[mapping.source_column_name] = validationRulesError;
        }
      }

      if (mapping.is_active) {
        if (mapping.field_role === "display_name_part") {
          activeDisplayNamePartCount += 1;
        }

        const aliasKey = alias.toLocaleLowerCase("pl-PL");
        if (aliasKey && activeAliases.has(aliasKey)) {
          aliasErrors[mapping.source_column_name] =
            "Ta etykieta jest już użyta w aktywnym mapowaniu.";
        }
        if (aliasKey) activeAliases.add(aliasKey);
      }
    }

    const form =
      activeDisplayNamePartCount === 0
        ? "Zostaw co najmniej jedną aktywną kolumnę budującą nazwę uczestnika."
        : undefined;

    return { aliases: aliasErrors, form };
  };

  const handleSaveMappingDrafts = async () => {
    const nextErrors = validateMappingDrafts();
    if (Object.keys(nextErrors.aliases).length > 0 || nextErrors.form) {
      setMappingErrors(nextErrors);
      return;
    }

    setMappingErrors({ aliases: {} });
    setMappingSaving(true);
    const orderedMappings = mappingDrafts.map((mapping, index) => ({
      ...mapping,
      alias: mapping.alias.trim(),
      field_type: isConfigurableParticipantMapping(mapping)
        ? getParticipantFieldType(mapping)
        : "text",
      validation_rules: isConfigurableParticipantMapping(mapping)
        ? getParticipantValidationRules(mapping)
        : {},
      is_required:
        !mapping.is_active && mapping.field_role !== "email"
          ? false
          : mapping.field_role === "email" ||
              mapping.field_role === "display_name_part"
          ? true
          : mapping.is_required,
      is_active: mapping.field_role === "email" ? true : mapping.is_active,
      display_order: mapping.field_role === "email" ? 0 : index,
    }));
    const result = await updateParticipantFieldMappings(event.id, orderedMappings);
    setMappingSaving(false);

    if (!result.ok) {
      setMappingErrors({
        aliases: {},
        form: result.error ?? "Nie udało się zapisać mapowania.",
      });
      toast({
        title: "Nie udało się zapisać mapowania",
        description: result.error,
        variant: "destructive",
      });
      return;
    }

    setMappings(result.mappings);
    setHasBaselineParticipantImport(result.has_baseline_import);
    setManualFields(buildEmptyParticipantFieldValues(result.mappings));
    setMappingDialogOpen(false);
    toast({ title: "Zapisano mapowanie kolumn" });
  };

  const renderMappingValidationControls = (mapping: MappingDraft, index: number) => {
    if (!isConfigurableParticipantMapping(mapping)) return null;

    const fieldType = getParticipantFieldType(mapping);
    const rules = getParticipantValidationRules(mapping);
    const updateRules = (patch: ParticipantFieldValidationRules) => {
      updateMappingDraft(mapping.source_column_name, {
        validation_rules: {
          ...rules,
          ...patch,
        },
      });
    };
    const updateFieldType = (fieldTypeValue: ParticipantFieldType) => {
      updateMappingDraft(mapping.source_column_name, {
        field_type: fieldTypeValue,
        validation_rules: fieldTypeValue === "select" ? { options: rules.options ?? [] } : {},
      });
    };

    return (
      <Collapsible className="mt-3 rounded-md border border-border/60 bg-background/65 lg:col-span-4">
        <CollapsibleTrigger asChild>
          <Button type="button" variant="ghost" className="flex h-auto w-full justify-between rounded-md px-3 py-2 text-left">
            <span className="min-w-0">
              <span className="block text-sm font-medium">Walidacja i typ pola</span>
              <span className="block truncate text-xs text-muted-foreground">
                {mapping.is_required ? "Wymagane" : "Opcjonalne"} · {participantFieldTypeLabels[fieldType]}
              </span>
            </span>
            <ChevronDown className="h-4 w-4 shrink-0" />
          </Button>
        </CollapsibleTrigger>
        <CollapsibleContent className="space-y-3 border-t px-3 py-3">
          <div className="grid gap-3 md:grid-cols-[minmax(0,14rem)_1fr]">
            <div className="space-y-1.5">
              <Label htmlFor={`event-mapping-field-type-${index}`}>Typ pola</Label>
              <Select value={fieldType} onValueChange={(value) => updateFieldType(value as ParticipantFieldType)}>
                <SelectTrigger id={`event-mapping-field-type-${index}`} className="h-9">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="text">{participantFieldTypeLabels.text}</SelectItem>
                  <SelectItem value="number">{participantFieldTypeLabels.number}</SelectItem>
                  <SelectItem value="date">{participantFieldTypeLabels.date}</SelectItem>
                  <SelectItem value="select">{participantFieldTypeLabels.select}</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {fieldType === "text" && (
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label htmlFor={`event-mapping-text-min-${index}`}>Min. znaków</Label>
                  <Input
                    id={`event-mapping-text-min-${index}`}
                    type="number"
                    min={0}
                    value={rules.min_length ?? ""}
                    onChange={(eventValue) => updateRules({ min_length: eventValue.target.value === "" ? undefined : Number(eventValue.target.value) })}
                    className="h-9"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor={`event-mapping-text-max-${index}`}>Max. znaków</Label>
                  <Input
                    id={`event-mapping-text-max-${index}`}
                    type="number"
                    min={0}
                    value={rules.max_length ?? ""}
                    onChange={(eventValue) => updateRules({ max_length: eventValue.target.value === "" ? undefined : Number(eventValue.target.value) })}
                    className="h-9"
                  />
                </div>
              </div>
            )}

            {fieldType === "number" && (
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label htmlFor={`event-mapping-number-min-${index}`}>Min. wartość</Label>
                  <Input
                    id={`event-mapping-number-min-${index}`}
                    type="number"
                    value={rules.min ?? ""}
                    onChange={(eventValue) => updateRules({ min: eventValue.target.value === "" ? undefined : Number(eventValue.target.value) })}
                    className="h-9"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor={`event-mapping-number-max-${index}`}>Max. wartość</Label>
                  <Input
                    id={`event-mapping-number-max-${index}`}
                    type="number"
                    value={rules.max ?? ""}
                    onChange={(eventValue) => updateRules({ max: eventValue.target.value === "" ? undefined : Number(eventValue.target.value) })}
                    className="h-9"
                  />
                </div>
              </div>
            )}

            {fieldType === "date" && (
              <div className="grid gap-3 sm:grid-cols-3">
                <div className="space-y-1.5">
                  <Label htmlFor={`event-mapping-date-format-${index}`}>Format w CSV</Label>
                  <Select
                    value={rules.date_format ?? "auto"}
                    onValueChange={(value) => updateRules({ date_format: value === "auto" ? undefined : value as ParticipantFieldValidationRules["date_format"] })}
                  >
                    <SelectTrigger id={`event-mapping-date-format-${index}`} className="h-9">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="auto">Auto</SelectItem>
                      <SelectItem value="dmy">DD/MM/RRRR</SelectItem>
                      <SelectItem value="mdy">MM/DD/RRRR</SelectItem>
                      <SelectItem value="ymd">RRRR/MM/DD</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor={`event-mapping-date-min-${index}`}>Data od</Label>
                  <Input
                    id={`event-mapping-date-min-${index}`}
                    type="date"
                    value={typeof rules.min === "string" ? rules.min : ""}
                    onChange={(eventValue) => updateRules({ min: eventValue.target.value || undefined })}
                    className="h-9"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor={`event-mapping-date-max-${index}`}>Data do</Label>
                  <Input
                    id={`event-mapping-date-max-${index}`}
                    type="date"
                    value={typeof rules.max === "string" ? rules.max : ""}
                    onChange={(eventValue) => updateRules({ max: eventValue.target.value || undefined })}
                    className="h-9"
                  />
                </div>
              </div>
            )}
          </div>

          {fieldType === "select" && (
            <div className="space-y-2">
              <Label htmlFor={`event-mapping-select-options-${index}`}>Opcje listy, po jednej w linii</Label>
              <Textarea
                id={`event-mapping-select-options-${index}`}
                value={formatSelectOptions(rules.options)}
                onChange={(eventValue) => updateRules({ options: parseSelectOptions(eventValue.target.value) })}
                rows={4}
              />
            </div>
          )}
        </CollapsibleContent>
      </Collapsible>
    );
  };

  const openReopenOfficeDialog = () => {
    setEditReopeningOffice(true);
    setEditForm({
      ...buildEditFormFromEvent(event),
      office_close_at: getDefaultReopenCloseAt(new Date(nowTimestamp)),
    });
    setEditErrors({});
    setEditOpen(true);
  };

  const canKeepPastOfficeOpenAt = (officeOpenAt: string) => {
    const submittedOfficeOpenAt = toLocalDateTimeValue(officeOpenAt);
    const currentOfficeOpenAt = toLocalDateTimeValue(event.office_open_at);

    return (
      editReopeningOffice ||
      isEventOfficeOpen(event, new Date(nowTimestamp)) ||
      submittedOfficeOpenAt === currentOfficeOpenAt
    );
  };

  const applyEditOfficeValidationErrors = (
    officeOpenAt: string,
    officeCloseAt: string,
  ) => {
    const officeErrors = getEventOfficeValidationErrors(
      officeOpenAt,
      officeCloseAt,
      {
        allowPastOpenAt: canKeepPastOfficeOpenAt(officeOpenAt),
      },
    );

    setEditErrors((current) => ({
      ...current,
      office_open_at: officeErrors.office_open_at,
      office_close_at: officeErrors.office_close_at,
      form: undefined,
    }));

    return officeErrors;
  };

  const handleManualFieldChange = (alias: string, value: string) => {
    setManualFields((previous) => ({ ...previous, [alias]: value }));
    setManualErrors((previous) => ({
      ...previous,
      fields: { ...previous.fields, [alias]: "" },
      form: undefined,
    }));
  };

  const toggleScannerSelection = (scannerId: string, checked: boolean) => {
    setScannerSelection((previous) =>
      checked
        ? [...previous, scannerId]
        : previous.filter((idValue) => idValue !== scannerId),
    );
  };

  const resetScannerDialogState = () => {
    setScannerManagerTab("existing");
    setScannerSearchQuery("");
    setScannerCreateForm({
      name: "",
      email: "",
      use_manual_password: false,
      password: "",
    });
    setShowScannerCreatePassword(false);
    setScannerCreateErrors({});
  };

  const generateScannerCreatePassword = () => {
    setScannerCreateForm((current) => ({
      ...current,
      use_manual_password: true,
      password: generateStrongPassword(),
    }));
    setShowScannerCreatePassword(true);
    setScannerCreateErrors((current) => ({
      ...current,
      password: undefined,
      form: undefined,
    }));
  };

  const openScannerDialog = (role: ManagedScannerRole) => {
    setManagedScannerRole(role);
    setScannerSelection(
      (role === "scanner" ? assignedScanners : assignedScannerPlus).map(
        (scanner) => scanner.id,
      ),
    );
    resetScannerDialogState();
    setScannerDialogOpen(true);
  };

  const handleSaveScannerAssignments = async () => {
    const selectedScannerIds = new Set(scannerSelection);
    const changedScanners = managedRoleScanners.filter((scanner) => {
      const wasAssigned = scanner.assigned_events.includes(event.id);
      const shouldBeAssigned = selectedScannerIds.has(scanner.id);
      return wasAssigned !== shouldBeAssigned;
    });

    if (changedScanners.length === 0) {
      setScannerDialogOpen(false);
      resetScannerDialogState();
      return;
    }

    setScannerSaving(true);
    try {
      for (const scanner of changedScanners) {
        const shouldBeAssigned = selectedScannerIds.has(scanner.id);
        const nextAssignedEvents = shouldBeAssigned
          ? [...new Set([...scanner.assigned_events, event.id])]
          : scanner.assigned_events.filter(
              (assignedEventId) => assignedEventId !== event.id,
            );

        const result = await assignScannerEvents(
          scanner.id,
          nextAssignedEvents,
        );
        if (!result.ok) {
          toast({
            title: `Nie udało się zapisać przypisań ${getRoleLabel(
              managedScannerRole,
            ).toLocaleLowerCase("pl-PL")}`,
            description:
              result.error ??
              `Nie udało się zaktualizować operatora ${scanner.name}.`,
            variant: "destructive",
          });
          return;
        }
      }

      setScannerDialogOpen(false);
      resetScannerDialogState();
      toast({
        title: `Zapisano przypisania ${getRoleLabel(
          managedScannerRole,
        ).toLocaleLowerCase("pl-PL")}`,
      });
    } finally {
      setScannerSaving(false);
    }
  };

  const handleCreateScanner = async () => {
    const nextErrors = {
      name: validateRequired(
        scannerCreateForm.name,
        "Podaj imię i nazwisko operatora.",
      ),
      email: validateEmail(scannerCreateForm.email),
      password: scannerCreateForm.use_manual_password
        ? validateStrongPassword(scannerCreateForm.password)
        : "",
    };

    if (nextErrors.name || nextErrors.email || nextErrors.password) {
      setScannerCreateErrors(nextErrors);
      return;
    }

    setScannerCreateErrors({});
    setScannerCreateSaving(true);
    const result = await addUser({
      name: scannerCreateForm.name,
      email: scannerCreateForm.email,
      role: managedScannerRole,
      organization_id: event.organization_id,
      assigned_events: [event.id],
      password: scannerCreateForm.use_manual_password
        ? scannerCreateForm.password
        : undefined,
    });
    setScannerCreateSaving(false);

    if (!result.ok) {
      setScannerCreateErrors({
        form:
          result.error ??
          `Nie udało się dodać ${getRoleLabel(managedScannerRole).toLocaleLowerCase(
            "pl-PL",
          )}.`,
      });
      toast({
        title: `Nie udało się dodać ${getRoleLabel(
          managedScannerRole,
        ).toLocaleLowerCase("pl-PL")}`,
        description: result.error ?? "Spróbuj ponownie.",
        variant: "destructive",
      });
      return;
    }

    setScannerDialogOpen(false);
    resetScannerDialogState();
    toast({
      title:
        managedScannerRole === "scanner"
          ? "Dodano operatora i przypisano do wydarzenia"
          : "Dodano operatora Plus i przypisano do wydarzenia",
      description: "Użytkownik otrzyma e-mail z linkiem do ustawienia hasła ważnym przez 7 dni.",
    });
  };

  const handleManualSubmit = async () => {
    const fieldErrors = activeMappings.reduce<Record<string, string>>(
      (accumulator, mapping) => {
        const error = validateParticipantFieldValue(mapping, manualFields[mapping.alias] ?? "");
        if (error) accumulator[mapping.alias] = error;
        return accumulator;
      },
      {},
    );
    const nextErrors = {
      email: validateEmail(manualEmail),
      fields: fieldErrors,
    };

    if (nextErrors.email || Object.keys(fieldErrors).length > 0) {
      setManualErrors(nextErrors);
      return;
    }

    setManualErrors({ fields: {} });
    setManualSaving(true);
    const result = await addParticipantManually(
      event.id,
      manualEmail,
      manualFields,
    );
    setManualSaving(false);

    if (!result.ok) {
      setManualErrors({
        fields: {},
        form: result.error ?? "Nie udało się dodać uczestnika.",
      });
      toast({
        title: "Nie udało się dodać uczestnika",
        description: result.error,
        variant: "destructive",
      });
      return;
    }

    setManualOpen(false);
    setManualEmail("");
    setManualFields(buildEmptyParticipantFieldValues(mappings));
    setManualErrors({ fields: {} });
    toast({ title: "Dodano uczestnika ręcznie" });
  };

  const handleEditSubmit = async () => {
    const submittedOfficeOpenAt = toLocalDateTimeValue(editForm.office_open_at);
    const submittedOfficeCloseAt = toLocalDateTimeValue(editForm.office_close_at);
    const nextErrors = {
      name: validateRequired(editForm.name, "Podaj nazwę wydarzenia."),
      location: validateRequired(
        editForm.location,
        "Podaj lokalizację wydarzenia.",
      ),
      office_open_at: validateRequired(
        submittedOfficeOpenAt,
        "Podaj datę i godzinę otwarcia biura.",
      ),
      office_close_at: validateRequired(
        submittedOfficeCloseAt,
        "Podaj datę i godzinę zamknięcia biura.",
      ),
    };

    if (
      nextErrors.name ||
      nextErrors.location ||
      nextErrors.office_open_at ||
      nextErrors.office_close_at
    ) {
      setEditErrors(nextErrors);
      return;
    }

    if (
      !submittedOfficeOpenAt ||
      (!canKeepPastOfficeOpenAt(submittedOfficeOpenAt) &&
        !isEventOfficeStartAtOrAfterNow(submittedOfficeOpenAt))
    ) {
      setEditErrors({
        office_open_at: "Otwarcie biura nie może być ustawione w przeszłości.",
      });
      toast({
        title: "Nieprawidłowa data otwarcia",
        description:
          "Data i godzina otwarcia biura zawodów musi być nie wcześniejsza niż teraz.",
        variant: "destructive",
      });
      return;
    }

    if (
      getEventOfficeRangeValidationResult(
        submittedOfficeOpenAt,
        submittedOfficeCloseAt,
      ) === "shorter_than_minimum"
    ) {
      setEditErrors({
        office_close_at: "Biuro musi być otwarte przez co najmniej 1 godzinę.",
      });
      toast({
        title: "Nieprawidłowe godziny biura",
        description:
          "Ustaw godziny biura tak, aby było otwarte przez co najmniej 1 godzinę.",
        variant: "destructive",
      });
      return;
    }

    if (
      !submittedOfficeOpenAt ||
      !submittedOfficeCloseAt ||
      !isValidEventOfficeRange(submittedOfficeOpenAt, submittedOfficeCloseAt)
    ) {
      setEditErrors({
        office_close_at: "Zamknięcie biura musi być później niż otwarcie.",
      });
      toast({
        title: "Nieprawidłowe godziny biura",
        description:
          "Podaj poprawną datę i godzinę otwarcia oraz zamknięcia biura zawodów.",
        variant: "destructive",
      });
      return;
    }

    setEditErrors({});
    setEditSaving(true);
    const result = await updateEvent(event.id, {
      name: editForm.name,
      location: editForm.location,
      organization_id: event.organization_id,
      office_open_at: submittedOfficeOpenAt,
      office_close_at: submittedOfficeCloseAt,
      reopen_office: editReopeningOffice,
    });
    setEditSaving(false);

    if (!result.ok) {
      setEditErrors({
        form: result.error ?? "Nie udało się zaktualizować wydarzenia.",
      });
      toast({
        title: "Nie udało się zaktualizować wydarzenia",
        description: result.error ?? "Spróbuj ponownie.",
        variant: "destructive",
      });
      return;
    }

    setEditOpen(false);
    setEditReopeningOffice(false);
    setEditErrors({});
    toast({ title: "Zaktualizowano wydarzenie" });
  };

  const handleExportCsv = async () => {
    setExportingCsv(true);
    const result = await exportEventCsv(event.id);
    setExportingCsv(false);

    if (!result.ok) {
      toast({
        title: "Nie udało się wyeksportować CSV",
        description: result.error ?? "Spróbuj ponownie.",
        variant: "destructive",
      });
      return;
    }

    toast({ title: "Eksport CSV rozpoczęty" });
  };

  const handleExportLogsCsv = async () => {
    setExportingLogsCsv(true);
    const result = await exportEventLogsCsv(event.id);
    setExportingLogsCsv(false);

    if (!result.ok) {
      toast({
        title: "Nie udało się wyeksportować logów CSV",
        description: result.error ?? "Spróbuj ponownie.",
        variant: "destructive",
      });
      return;
    }

    toast({ title: "Eksport logów CSV rozpoczęty" });
  };

  const handleExportParticipantChangesCsv = async () => {
    setExportingParticipantChangesCsv(true);
    const result = await exportEventParticipantChangesCsv(event.id);
    setExportingParticipantChangesCsv(false);

    if (!result.ok) {
      toast({
        title: "Nie udało się wyeksportować zmian uczestników CSV",
        description: result.error ?? "Spróbuj ponownie.",
        variant: "destructive",
      });
      return;
    }

    toast({ title: "Eksport zmian uczestników CSV rozpoczęty" });
  };

  const handleArchiveEvent = async () => {
    setIsArchivingEvent(true);
    const result = await archiveEvent(event.id);
    setIsArchivingEvent(false);

    if (!result.ok) {
      toast({
        title: "Nie udało się przenieść wydarzenia do archiwum",
        description: result.error ?? "Spróbuj ponownie.",
        variant: "destructive",
      });
      return;
    }

    setArchiveConfirmOpen(false);
    toast({ title: "Wydarzenie przeniesione do archiwum" });
    navigate(`/organizations/${event.organization_id}/archived-events`);
  };

  const handleDeleteEvent = async () => {
    setIsDeletingEvent(true);
    const result = await deleteEvent(event.id);
    setIsDeletingEvent(false);

    if (!result.ok) {
      toast({
        title: "Nie udało się usunąć wydarzenia",
        description: result.error ?? "Spróbuj ponownie.",
        variant: "destructive",
      });
      return;
    }

    setDeleteConfirmOpen(false);
    toast({ title: "Wydarzenie usunięte" });
    navigate("/events");
  };

  const backTo =
    location.state?.backTo ??
    (isArchivedEvent
      ? `/organizations/${event.organization_id}/archived-events`
      : "/events");

  const backLabel =
    location.state?.backLabel ??
    (isArchivedEvent
      ? "Wróć do archiwum"
      : "Wróć do listy wszystkich wydarzeń");

  return (
    <div className="event-detail-page space-y-8">
      <Button
        variant="ghost"
        size="sm"
        onClick={() => navigate(backTo)}
        className="w-fit touch-manipulation rounded-full px-1 text-[0.98rem] font-medium text-[hsl(var(--button-highlight))] hover:bg-transparent hover:text-[hsl(var(--button-highlight))]"
      >
        <ArrowLeft className="mr-1 h-4 w-4" /> {backLabel}
      </Button>

      {isArchivedEvent && (
        <div className="archive-notice rounded-xl border px-4 py-3 text-sm">
          <div className="flex items-start gap-3">
            <div className="archive-notice-icon mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full border">
              <Archive className="h-4 w-4" />
            </div>
            <div>
              <p className="archive-notice-title font-semibold">
                To wydarzenie jest zarchiwizowane.
              </p>
              <p className="archive-notice-copy mt-1">
                Jest ukryte z aktywnych list i przypisań. Dane są dostępne do
                podglądu, a zmiany w archiwum może wykonywać tylko superadmin.
              </p>
            </div>
          </div>
        </div>
      )}

      {!isOnline && (
        <OnlineOnlyNotice description="Import CSV, edycja wydarzenia, eksporty, wysyłka QR, ręczne dodawanie uczestników i zarządzanie operatorami wymagają aktywnego połączenia z serwerem." />
      )}

      <section className="event-detail-header-grid">
        <div className="event-detail-info-panel">
          <div
            className={cn("event-detail-status-row", officeToneClasses.status)}
          >
            <div className="event-detail-status-dot" />
            <div className="min-w-0">
              <p className="event-detail-status-kicker">Status wydarzenia</p>
              <p className="event-detail-status-value">
                {officeStatus.badgeLabel}
              </p>
            </div>
          </div>

          <div className="space-y-3">
            <h1 className="event-detail-title">{event.name}</h1>
            <div className="event-detail-meta flex flex-col gap-2.5 text-sm sm:flex-row sm:flex-wrap sm:items-center sm:gap-4">
              <span className="flex items-center gap-2">
                <MapPin className="h-4 w-4" />
                {event.location}
              </span>
              <span className="flex items-center gap-2">
                <Calendar className="h-4 w-4" />
                {formatEventOfficeWindow(event)}
              </span>
            </div>
            <p className="event-detail-headline">{officeStatus.headline}</p>
            <p className="event-detail-supporting-copy">
              {officeStatus.detail}
            </p>
          </div>

          <div className="event-detail-summary-strip">
            <div className="event-detail-stats-grid">
              <div className="event-detail-stat-item">
                <span className="event-detail-stat-label">Odprawieni</span>
                <strong className="event-detail-stat-value">
                  {checkedIn}/{eventParticipants.length}
                </strong>
              </div>
              <div className="event-detail-stat-item">
                <span className="event-detail-stat-label">Uczestnicy</span>
                <strong className="event-detail-stat-value">
                  {eventParticipants.length}
                </strong>
              </div>
              <div className="event-detail-stat-item">
                <span className="event-detail-stat-label">
                  {officeStatus.timingLabel}
                </span>
                <strong className="event-detail-stat-value">
                  {officeStatus.timingValue}
                </strong>
              </div>
            </div>
          </div>
        </div>

        {((!isArchivedEvent && event) ||
          canUseActiveEventTools ||
          canEditEvent ||
          canArchiveEvent) && (
          <aside className="event-detail-actions-panel">
            {canUseActiveEventTools && (
              <Button
                onClick={() => {
                  setSelectedEventId(event.id);
                  navigate("/scanner");
                }}
                className="event-detail-primary-action h-12 w-full"
              >
                <ScanLine className="mr-1 h-4 w-4" /> Otwórz skaner
              </Button>
            )}
            {!isArchivedEvent && event && (
                <Button
                  variant="outline"
                  onClick={() => {
                    setSelectedEventId(event.id);
                    navigate(buildEventParticipantsPath(event.id));
                  }}
                  className="event-detail-secondary-action h-12 w-full"
                >
                <Users className="mr-1 h-4 w-4" /> Uczestnicy
              </Button>
            )}
            {canEditEvent && (
              <Button
                variant="outline"
                onClick={() => {
                  setEditReopeningOffice(false);
                  setEditOpen(true);
                }}
                className="event-detail-secondary-action h-12 w-full"
                disabled={!isOnline}
              >
                <Pencil className="h-4 w-4" /> Edytuj wydarzenie
              </Button>
            )}
            {canReopenEvent && (
              <Button
                onClick={openReopenOfficeDialog}
                className="event-detail-primary-action h-12 w-full"
                disabled={!isOnline}
              >
                <Calendar className="h-4 w-4" /> Otwórz biuro ponownie
              </Button>
            )}
            {canArchiveEvent && (
              <Button
                variant="outline"
                onClick={() => setArchiveConfirmOpen(true)}
                className="h-12 w-full"
                disabled={!isOnline}
              >
                <Archive className="mr-1 h-4 w-4" /> Przenieś do archiwum
              </Button>
            )}
          </aside>
        )}
      </section>

      <section className="space-y-4">
        <div>
          <h2 className="event-detail-section-title text-xl font-bold tracking-tight">
            Zespół
          </h2>
        </div>

        {!hasAnyTeamMembers && (
          <div className="event-detail-empty-panel py-10 text-center">
            <p className="text-base font-semibold">
              {isFinishedEvent
                ? "Nie było przypisanego zespołu"
                : "Nie ma jeszcze przypisanego zespołu"}
            </p>
            <p className="mt-2 text-sm text-muted-foreground">
              {isFinishedEvent
                ? "Sprawdź, czy do wydarzenia byli przypisani operatorzy lub operatorzy Plus."
                : "Dodaj operatorów albo operatorów Plus i przypisz ich do tego wydarzenia."}
            </p>
          </div>
        )}

        <div className="event-detail-section-group">
          <CollapsibleSection
            title={`Operatorzy (${assignedScanners.length})`}
            defaultOpen={false}
            action={
              canManageScanners && canAssignScannersToEvent ? (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => openScannerDialog("scanner")}
                  className="event-detail-secondary-action"
                  disabled={!isOnline}
                >
                  Zarządzaj
                </Button>
              ) : undefined
            }
          >
            <TeamRoleTabPanel
              role="scanner"
              users={assignedScanners}
              emptyText="Brak operatorów przypisanych do tego wydarzenia."
            />
          </CollapsibleSection>

          <CollapsibleSection
            title={`Operatorzy Plus (${assignedScannerPlus.length})`}
            defaultOpen={false}
            action={
              canManageScanners && canAssignScannersToEvent ? (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => openScannerDialog("scanner_plus")}
                  className="event-detail-secondary-action"
                  disabled={!isOnline}
                >
                  Zarządzaj
                </Button>
              ) : undefined
            }
          >
            <TeamRoleTabPanel
              role="scanner_plus"
              users={assignedScannerPlus}
              emptyText="Brak operatorów Plus przypisanych do tego wydarzenia."
            />
          </CollapsibleSection>
        </div>
      </section>

      <section className="space-y-4">
        <div>
          <h2 className="event-detail-section-title text-xl font-bold tracking-tight">
            Operacje
          </h2>
        </div>

        <div className="event-detail-section-group">
          {(!isArchivedEvent || currentRole === "superadmin") && (
            <CollapsibleSection title="Uczestnicy" defaultOpen={false}>
              <div className="flex flex-col gap-2">
                <Button
                  variant="outline"
                    onClick={() => {
                      setSelectedEventId(event.id);
                      navigate(buildEventImportPath(event.id));
                    }}
                  className="event-detail-operation-button h-11 justify-start"
                  disabled={!isOnline}
                >
                  <FileUp className="mr-1 h-4 w-4" /> Import uczestników CSV
                </Button>
                {canSendQrForEvent && (
                  <Button
                    variant="outline"
                    onClick={() => {
                      setSelectedEventId(event.id);
                      navigate(buildEventEmailsPath(event.id));
                    }}
                    className="event-detail-operation-button h-11 justify-start"
                    disabled={!isOnline}
                  >
                    <Mail className="mr-1 h-4 w-4" /> Wyślij QR do uczestników
                  </Button>
                )}
                {hasSavedMapping && (
                  <Button
                    variant="outline"
                    onClick={() => setManualOpen(true)}
                    className="event-detail-operation-button h-11 justify-start"
                    disabled={!isOnline}
                  >
                    <Plus className="mr-1 h-4 w-4" /> Dodaj uczestnika ręcznie
                  </Button>
                )}
                {canEditParticipantMappings && (
                  <Button
                    variant="outline"
                    onClick={openMappingDialog}
                    className="event-detail-operation-button h-11 justify-start"
                    disabled={!isOnline}
                  >
                    <Pencil className="mr-1 h-4 w-4" /> Edytuj mapowanie kolumn
                  </Button>
                )}
                {isFinishedEvent && (
                  <div className="flex items-start gap-3 rounded-xl border border-border/70 bg-muted/30 px-4 py-3 text-sm text-muted-foreground">
                    <Info className="mt-0.5 h-4 w-4 shrink-0" />
                    <p>
                      Dla zakończonych wydarzeń wysyłka kodów QR jest wyłączona,
                      dlatego ta opcja nie jest tutaj dostępna.
                    </p>
                  </div>
                )}
              </div>
            </CollapsibleSection>
          )}

          <CollapsibleSection title="Eksport" defaultOpen={false}>
            <div className="flex flex-col gap-2">
              <Button
                variant="outline"
                onClick={() => void handleExportCsv()}
                className="event-detail-operation-button h-11 justify-start"
                disabled={exportingCsv || !isOnline}
              >
                {exportingCsv ? (
                  <Loader2 className="mr-1 h-4 w-4 animate-spin" />
                ) : (
                  <Download className="mr-1 h-4 w-4" />
                )}
                Eksport uczestników CSV
              </Button>
              <Button
                variant="outline"
                onClick={() => void handleExportLogsCsv()}
                className="event-detail-operation-button h-11 justify-start"
                disabled={exportingLogsCsv || !isOnline}
              >
                {exportingLogsCsv ? (
                  <Loader2 className="mr-1 h-4 w-4 animate-spin" />
                ) : (
                  <Download className="mr-1 h-4 w-4" />
                )}
                Eksport logów CSV
              </Button>
              <Button
                variant="outline"
                onClick={() => void handleExportParticipantChangesCsv()}
                className="event-detail-operation-button h-11 justify-start"
                disabled={
                  exportingParticipantChangesCsv ||
                  !isOnline ||
                  !hasBaselineParticipantImport
                }
              >
                {exportingParticipantChangesCsv ? (
                  <Loader2 className="mr-1 h-4 w-4 animate-spin" />
                ) : (
                  <Download className="mr-1 h-4 w-4" />
                )}
                Eksport zmian uczestników CSV
              </Button>
              {!hasBaselineParticipantImport && (
                <div className="flex items-start gap-3 rounded-xl border border-border/70 bg-muted/30 px-4 py-3 text-sm text-muted-foreground">
                  <Info className="mt-0.5 h-4 w-4 shrink-0" />
                  <p>
                    Ten eksport będzie dostępny po pierwszym udanym imporcie
                    CSV dla tego wydarzenia.
                  </p>
                </div>
              )}
            </div>
          </CollapsibleSection>

          {canDeleteEvent && (
            <CollapsibleSection title="Administracja" defaultOpen={false}>
              <div className="flex flex-col gap-2">
                <Button
                  variant="destructive"
                  onClick={() => setDeleteConfirmOpen(true)}
                  className="event-detail-operation-button h-11 justify-start"
                  disabled={!isOnline || !canDeleteEventNow}
                >
                  <Trash2 className="mr-1 h-4 w-4" /> Usuń wydarzenie
                </Button>
                {!canDeleteEventNow && (
                  <div className="flex items-start gap-3 rounded-xl border border-border/70 bg-muted/30 px-4 py-3 text-sm text-muted-foreground">
                    <Info className="mt-0.5 h-4 w-4 shrink-0" />
                    <p>
                      Wydarzenia, które już się odbyły, przenieś do archiwum.
                    </p>
                  </div>
                )}
              </div>
            </CollapsibleSection>
          )}
        </div>
      </section>

      <AlertDialog
        open={archiveConfirmOpen}
        onOpenChange={setArchiveConfirmOpen}
      >
        <AlertDialogContent className="max-w-[calc(100vw-2rem)] sm:max-w-md">
          <AlertDialogHeader>
            <AlertDialogTitle>Przenieść wydarzenie do archiwum?</AlertDialogTitle>
            <AlertDialogDescription>
              Wydarzenie{" "}
              <span className="font-medium text-foreground">{event.name}</span>{" "}
              będzie widoczne w archiwum organizacji i nadal będzie wliczane do
              limitu wydarzeń.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Anuluj</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => void handleArchiveEvent()}
              disabled={isArchivingEvent || !isOnline}
            >
              {isArchivingEvent && (
                <Loader2 className="mr-1 h-4 w-4 animate-spin" />
              )}
              Przenieś do archiwum
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={deleteConfirmOpen} onOpenChange={setDeleteConfirmOpen}>
        <AlertDialogContent className="max-w-[calc(100vw-2rem)] sm:max-w-md">
          <AlertDialogHeader>
            <AlertDialogTitle>Usunąć wydarzenie?</AlertDialogTitle>
            <AlertDialogDescription>
              Wydarzenie{" "}
              <span className="font-medium text-foreground">{event.name}</span>{" "}
              zniknie na zawszei przestanie wliczać się do limitu wydarzeń.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Anuluj</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => void handleDeleteEvent()}
              disabled={isDeletingEvent || !isOnline}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {isDeletingEvent && (
                <Loader2 className="mr-1 h-4 w-4 animate-spin" />
              )}
              Usuń wydarzenie
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Dialog
        open={editOpen}
        onOpenChange={(nextOpen) => {
          setEditOpen(nextOpen);
          if (!nextOpen) resetEditState();
        }}
      >
        <DialogContent className="max-w-[calc(100vw-2rem)] sm:max-w-md">
          <DialogHeader>
            <DialogTitle>
              {isFinishedEvent ? "Otwórz biuro ponownie" : "Edytuj wydarzenie"}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="event-edit-name">Nazwa</Label>
              <Input
                id="event-edit-name"
                value={editForm.name}
                onChange={(eventValue) => {
                  setEditForm((current) => ({
                    ...current,
                    name: eventValue.target.value,
                  }));
                  setEditErrors((current) => ({
                    ...current,
                    name: undefined,
                    form: undefined,
                  }));
                }}
                required
                aria-invalid={Boolean(editErrors.name)}
                aria-describedby={
                  editErrors.name ? "event-edit-name-error" : undefined
                }
              />
              <FieldError id="event-edit-name-error" className="mt-2">
                {editErrors.name}
              </FieldError>
            </div>
            <div>
              <Label htmlFor="event-edit-location">Lokalizacja</Label>
              <Input
                id="event-edit-location"
                value={editForm.location}
                onChange={(eventValue) => {
                  setEditForm((current) => ({
                    ...current,
                    location: eventValue.target.value,
                  }));
                  setEditErrors((current) => ({
                    ...current,
                    location: undefined,
                    form: undefined,
                  }));
                }}
                required
                aria-invalid={Boolean(editErrors.location)}
                aria-describedby={
                  editErrors.location ? "event-edit-location-error" : undefined
                }
              />
              <FieldError id="event-edit-location-error" className="mt-2">
                {editErrors.location}
              </FieldError>
            </div>
            <div>
              <Label htmlFor="event-edit-office-open">
                Data i godzina otwarcia biura zawodów
              </Label>
              <DateTimePicker
                id="event-edit-office-open"
                value={editForm.office_open_at}
                disabled={isFinishedEvent}
                onChange={(value) => {
                  setEditForm((current) => ({
                    ...current,
                    office_open_at: value,
                  }));
                  setEditErrors((current) => ({
                    ...current,
                    office_open_at: undefined,
                    office_close_at: undefined,
                    form: undefined,
                  }));
                }}
                onCommit={(value) => {
                  applyEditOfficeValidationErrors(value, editForm.office_close_at);
                }}
                aria-invalid={Boolean(editErrors.office_open_at)}
                aria-describedby={
                  editErrors.office_open_at
                    ? "event-edit-office-open-error"
                    : undefined
                }
              />
              {isFinishedEvent && (
                <p className="mt-2 text-xs text-muted-foreground">
                  Data otwarcia zostaje bez zmian. Aby wznowić pracę biura,
                  ustaw nowe zamknięcie w przyszłości.
                </p>
              )}
              <FieldError id="event-edit-office-open-error" className="mt-2">
                {editErrors.office_open_at}
              </FieldError>
            </div>
            <div>
              <Label htmlFor="event-edit-office-close">
                Data i godzina zamknięcia biura zawodów
              </Label>
              <DateTimePicker
                id="event-edit-office-close"
                value={editForm.office_close_at}
                onChange={(value) => {
                  setEditForm((current) => ({
                    ...current,
                    office_close_at: value,
                  }));
                  setEditErrors((current) => ({
                    ...current,
                    office_close_at: undefined,
                    form: undefined,
                  }));
                }}
                onCommit={(value) => {
                  applyEditOfficeValidationErrors(editForm.office_open_at, value);
                }}
                aria-invalid={Boolean(editErrors.office_close_at)}
                aria-describedby={
                  editErrors.office_close_at
                    ? "event-edit-office-close-error"
                    : undefined
                }
              />
              <FieldError id="event-edit-office-close-error" className="mt-2">
                {editErrors.office_close_at}
              </FieldError>
            </div>
            <FieldError id="event-edit-form-error">
              {editErrors.form}
            </FieldError>
          </div>
          <DialogFooter>
            <Button
              type="button"
              className="w-full sm:w-auto"
              onClick={() => void handleEditSubmit()}
              disabled={editSaving}
            >
              {editSaving && <Loader2 className="mr-1 h-4 w-4 animate-spin" />}
              Zapisz
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={mappingDialogOpen}
        onOpenChange={(nextOpen) => {
          setMappingDialogOpen(nextOpen);
          if (!nextOpen) resetMappingDialogState();
        }}
      >
        <DialogContent className="flex max-h-[calc(100vh-2rem)] max-w-[calc(100vw-2rem)] flex-col overflow-hidden p-0 sm:max-w-4xl">
          <DialogHeader className="shrink-0 px-6 pb-2 pt-6">
            <DialogTitle>Mapowanie kolumn uczestników</DialogTitle>
            <p className="mt-2 text-sm text-muted-foreground">
              Kolumna CSV i role systemowe pozostają zablokowane. Zmiana etykiety przenosi zapisane wartości uczestników na nową nazwę pola.
            </p>
          </DialogHeader>
          <div className="themed-scrollbar flex-1 overflow-y-auto px-6 py-4">
            <div className="space-y-3">
              {mappingDrafts.map((mapping, index) => {
                const aliasError = mappingErrors.aliases[mapping.source_column_name];
                const isSystemRole =
                  mapping.field_role === "email" ||
                  mapping.field_role === "display_name_part" ||
                  mapping.field_role === "bib_number";
                const canMoveUp = index > 1 && mapping.field_role !== "email";
                const canMoveDown =
                  index < mappingDrafts.length - 1 &&
                  mapping.field_role !== "email" &&
                  mappingDrafts[index + 1]?.field_role !== "email";

                return (
                  <div
                    key={mapping.source_column_name}
                    className="grid gap-3 rounded-lg border border-border/70 p-3 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)_minmax(12rem,0.9fr)_auto]"
                  >
                    <div className="min-w-0">
                      <Label>Kolumna CSV</Label>
                      <p className="mt-2 truncate rounded-md border bg-muted/40 px-3 py-2 text-sm">
                        {mapping.source_column_name}
                      </p>
                    </div>
                    <div className="min-w-0">
                      <Label htmlFor={`mapping-alias-${index}`}>Etykieta</Label>
                      <Input
                        id={`mapping-alias-${index}`}
                        value={mapping.alias}
                        disabled={mapping.field_role === "email"}
                        onChange={(eventValue) =>
                          updateMappingDraft(mapping.source_column_name, {
                            alias: eventValue.target.value,
                          })
                        }
                        className="mt-2"
                        aria-invalid={Boolean(aliasError)}
                        aria-describedby={
                          aliasError ? `mapping-alias-${index}-error` : undefined
                        }
                      />
                      <FieldError id={`mapping-alias-${index}-error`} className="mt-2">
                        {aliasError}
                      </FieldError>
                    </div>
                    <div>
                      <Label>Rola</Label>
                      <Select
                        value={mapping.field_role}
                        disabled={!isEditableMappingRole(mapping.field_role)}
                        onValueChange={(value) =>
                          updateMappingDraft(mapping.source_column_name, {
                            field_role: value as EditableMappingRole,
                          })
                        }
                      >
                        <SelectTrigger className="mt-2">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {isEditableMappingRole(mapping.field_role) ? (
                            <>
                              <SelectItem value="custom">
                                {mappingRoleLabels.custom}
                              </SelectItem>
                              <SelectItem value="important_custom">
                                {mappingRoleLabels.important_custom}
                              </SelectItem>
                            </>
                          ) : (
                            <SelectItem value={mapping.field_role}>
                              {mappingRoleLabels[mapping.field_role]}
                            </SelectItem>
                          )}
                        </SelectContent>
                      </Select>
                      {isSystemRole && (
                        <p className="mt-2 text-xs text-muted-foreground">
                          Rola systemowa
                        </p>
                      )}
                    </div>
                    <div className="flex flex-col gap-3 lg:items-end">
                      <div className="flex gap-2">
                        <Button
                          type="button"
                          variant="outline"
                          size="icon"
                          onClick={() =>
                            moveMappingDraft(mapping.source_column_name, -1)
                          }
                          disabled={!canMoveUp}
                          aria-label="Przesuń pole wyżej"
                        >
                          <ChevronUp className="h-4 w-4" />
                        </Button>
                        <Button
                          type="button"
                          variant="outline"
                          size="icon"
                          onClick={() =>
                            moveMappingDraft(mapping.source_column_name, 1)
                          }
                          disabled={!canMoveDown}
                          aria-label="Przesuń pole niżej"
                        >
                          <ChevronDown className="h-4 w-4" />
                        </Button>
                      </div>
                      <label className="flex items-center gap-2 text-sm">
                        <Checkbox
                          checked={mapping.is_active}
                          disabled={mapping.field_role === "email"}
                          onCheckedChange={(checked) =>
                            updateMappingDraft(mapping.source_column_name, {
                              is_active: checked === true,
                            })
                          }
                        />
                        Aktywne
                      </label>
                      <label className="flex items-center gap-2 text-sm">
                        <Checkbox
                          checked={mapping.is_active ? mapping.is_required : false}
                          disabled={
                            !mapping.is_active ||
                            mapping.field_role === "email" ||
                            mapping.field_role === "display_name_part"
                          }
                          onCheckedChange={(checked) =>
                            updateMappingDraft(mapping.source_column_name, {
                              is_required: checked === true,
                            })
                          }
                        />
                        Wymagane
                      </label>
                    </div>
                    {renderMappingValidationControls(mapping, index)}
                  </div>
                );
              })}
            </div>
            <FieldError id="event-mapping-form-error" className="mt-4">
              {mappingErrors.form}
            </FieldError>
          </div>
          <DialogFooter className="shrink-0 border-t px-6 py-4">
            <Button
              type="button"
              className="w-full sm:w-auto"
              onClick={() => void handleSaveMappingDrafts()}
              disabled={mappingSaving || !isOnline}
            >
              {mappingSaving && (
                <Loader2 className="mr-1 h-4 w-4 animate-spin" />
              )}
              Zapisz mapowanie
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={manualOpen}
        onOpenChange={(nextOpen) => {
          setManualOpen(nextOpen);
          if (!nextOpen) setManualErrors({ fields: {} });
        }}
      >
        <DialogContent className="flex max-h-[calc(100vh-2rem)] max-w-[calc(100vw-2rem)] flex-col overflow-hidden p-0 sm:max-w-2xl lg:max-w-3xl">
          <DialogHeader className="shrink-0 px-6 pb-2 pt-6">
            <DialogTitle>Dodaj uczestnika ręcznie</DialogTitle>
          </DialogHeader>
          <div className="themed-scrollbar grid flex-1 gap-4 overflow-y-auto px-6 py-4 lg:grid-cols-2">
            <div className="lg:col-span-2">
              <Label htmlFor="event-manual-participant-email">Email</Label>
              <Input
                id="event-manual-participant-email"
                type="email"
                value={manualEmail}
                onChange={(eventValue) => {
                  setManualEmail(eventValue.target.value);
                  setManualErrors((previous) => ({
                    ...previous,
                    email: undefined,
                    form: undefined,
                  }));
                }}
                className="mt-2"
                required
                aria-invalid={Boolean(manualErrors.email)}
                aria-describedby={
                  manualErrors.email
                    ? "event-manual-participant-email-error"
                    : undefined
                }
              />
              <FieldError
                id="event-manual-participant-email-error"
                className="mt-2"
              >
                {manualErrors.email}
              </FieldError>
            </div>
            {activeMappings.map((mapping, index) => {
              const fieldId = `event-manual-participant-field-${index}`;
              const errorId = `${fieldId}-error`;
              const fieldError = manualErrors.fields[mapping.alias];
              const fieldType = getParticipantFieldType(mapping);
              const rules = getParticipantValidationRules(mapping);
              const fieldValue = manualFields[mapping.alias] ?? "";

              return (
                <div key={`${mapping.alias}-${mapping.source_column_name}`}>
                  <Label htmlFor={fieldId}>{mapping.alias}</Label>
                  {fieldType === "select" ? (
                    <Select
                      value={fieldValue || "__empty"}
                      onValueChange={(value) => handleManualFieldChange(mapping.alias, value === "__empty" ? "" : value)}
                    >
                      <SelectTrigger
                        id={fieldId}
                        className="mt-2"
                        aria-invalid={Boolean(fieldError)}
                        aria-describedby={fieldError ? errorId : undefined}
                      >
                        <SelectValue placeholder="Wybierz wartość" />
                      </SelectTrigger>
                      <SelectContent>
                        {!mapping.is_required && <SelectItem value="__empty">Brak wartości</SelectItem>}
                        {(rules.options ?? []).map((option) => (
                          <SelectItem key={option} value={option}>
                            {option}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  ) : (
                    <Input
                      id={fieldId}
                      type={fieldType === "number" ? "number" : fieldType === "date" ? "date" : "text"}
                      min={fieldType === "number" || fieldType === "date" ? rules.min : undefined}
                      max={fieldType === "number" || fieldType === "date" ? rules.max : undefined}
                      value={fieldValue}
                      onChange={(eventValue) =>
                        handleManualFieldChange(
                          mapping.alias,
                          eventValue.target.value,
                        )
                      }
                      className="mt-2"
                      aria-invalid={Boolean(fieldError)}
                      aria-describedby={fieldError ? errorId : undefined}
                    />
                  )}
                  <FieldError id={errorId} className="mt-2">
                    {fieldError}
                  </FieldError>
                </div>
              );
            })}
            <FieldError
              id="event-manual-participant-form-error"
              className="lg:col-span-2"
            >
              {manualErrors.form}
            </FieldError>
          </div>
          <DialogFooter className="shrink-0 border-t px-6 py-4">
            <Button
              className="w-full sm:w-auto"
              onClick={handleManualSubmit}
              disabled={manualSaving}
            >
              {manualSaving && (
                <Loader2 className="mr-1 h-4 w-4 animate-spin" />
              )}
              {!manualSaving && <Plus className="mr-1 h-4 w-4" />}
              Zapisz uczestnika
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={scannerDialogOpen}
        onOpenChange={(nextOpen) => {
          setScannerDialogOpen(nextOpen);
          if (!nextOpen) {
            resetScannerDialogState();
          }
        }}
      >
        <DialogContent className="flex max-h-[calc(100vh-2rem)] max-w-[calc(100vw-2rem)] flex-col overflow-hidden p-0 sm:max-w-3xl">
          <DialogHeader className="shrink-0 px-6 pb-2 pt-6">
            <DialogTitle>
              Zarządzaj{" "}
              {managedScannerRole === "scanner"
                ? "operatorami"
                : "operatorami Plus"}
            </DialogTitle>
            <p className="mt-2 text-sm text-muted-foreground">
              Dodaj nowe konto do organizacji i od razu przypisz je do
              wydarzenia albo wybierz istniejące konto z bazy organizacji.
            </p>
          </DialogHeader>
          <div className="themed-scrollbar flex-1 overflow-y-auto px-6 py-4">
            <Tabs
              value={scannerManagerTab}
              onValueChange={(value) =>
                setScannerManagerTab(value as "existing" | "new")
              }
              className="space-y-4"
            >
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="existing">Z bazy organizacji</TabsTrigger>
                <TabsTrigger value="new">Nowe konto</TabsTrigger>
              </TabsList>

              <TabsContent value="existing" className="mt-0 space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="event-scanner-search">
                    Szukaj po imieniu lub adresie e-mail
                  </Label>
                  <Input
                    id="event-scanner-search"
                    value={scannerSearchQuery}
                    onChange={(eventValue) =>
                      setScannerSearchQuery(eventValue.target.value)
                    }
                    placeholder="Np. Jan Kowalski albo jan@firma.pl"
                  />
                  <p className="text-xs text-muted-foreground">
                    {filteredManagedRoleScanners.length ===
                    managedRoleScanners.length
                      ? `Dostępne konta: ${managedRoleScanners.length}`
                      : `Wyniki: ${filteredManagedRoleScanners.length} z ${managedRoleScanners.length}`}
                  </p>
                </div>

                {managedRoleScanners.length > 0 ? (
                  <div className="max-h-[26rem] space-y-2 overflow-y-auto rounded-xl border p-3">
                    {filteredManagedRoleScanners.length > 0 ? (
                      filteredManagedRoleScanners.map((scanner) => (
                        <label
                          key={scanner.id}
                          className="flex items-start gap-3 rounded-lg px-2 py-2 text-sm hover:bg-muted/40"
                        >
                          <Checkbox
                            checked={scannerSelection.includes(scanner.id)}
                            onCheckedChange={(checked) =>
                              toggleScannerSelection(
                                scanner.id,
                                checked === true,
                              )
                            }
                          />
                          <div className="min-w-0 flex-1">
                            <p className="truncate font-medium">
                              {scanner.name}
                            </p>
                            <p className="truncate text-xs text-muted-foreground">
                              {scanner.email}
                            </p>
                          </div>
                        </label>
                      ))
                    ) : (
                      <div className="rounded-xl border border-dashed px-4 py-6 text-center text-sm text-muted-foreground">
                        Brak wyników dla podanej frazy.
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="rounded-xl border border-dashed px-4 py-6 text-center text-sm text-muted-foreground">
                    {managedScannerRole === "scanner"
                      ? "Organizacja nie ma jeszcze żadnych operatorów."
                      : "Organizacja nie ma jeszcze żadnych operatorów Plus."}
                  </div>
                )}
              </TabsContent>

              <TabsContent value="new" className="mt-0 space-y-4">
                <div>
                  <Label htmlFor="event-scanner-create-name">
                    Imię i nazwisko
                  </Label>
                  <Input
                    id="event-scanner-create-name"
                    value={scannerCreateForm.name}
                    onChange={(eventValue) => {
                      setScannerCreateForm((current) => ({
                        ...current,
                        name: eventValue.target.value,
                      }));
                      setScannerCreateErrors((current) => ({
                        ...current,
                        name: undefined,
                        form: undefined,
                      }));
                    }}
                    className="mt-2"
                    aria-invalid={Boolean(scannerCreateErrors.name)}
                    aria-describedby={
                      scannerCreateErrors.name
                        ? "event-scanner-create-name-error"
                        : undefined
                    }
                  />
                  <FieldError
                    id="event-scanner-create-name-error"
                    className="mt-2"
                  >
                    {scannerCreateErrors.name}
                  </FieldError>
                </div>

                <div>
                  <Label htmlFor="event-scanner-create-email">Email</Label>
                  <Input
                    id="event-scanner-create-email"
                    type="email"
                    value={scannerCreateForm.email}
                    onChange={(eventValue) => {
                      setScannerCreateForm((current) => ({
                        ...current,
                        email: eventValue.target.value,
                      }));
                      setScannerCreateErrors((current) => ({
                        ...current,
                        email: undefined,
                        form: undefined,
                      }));
                    }}
                    className="mt-2"
                    aria-invalid={Boolean(scannerCreateErrors.email)}
                    aria-describedby={
                      scannerCreateErrors.email
                        ? "event-scanner-create-email-error"
                        : undefined
                    }
                  />
                  <FieldError
                    id="event-scanner-create-email-error"
                    className="mt-2"
                  >
                    {scannerCreateErrors.email}
                  </FieldError>
                </div>

                <div className="space-y-3 rounded-xl border bg-muted/30 p-3">
                  <label className="flex items-start gap-3 text-sm">
                    <Checkbox
                      className="mt-0.5 rounded-[2px]"
                      checked={scannerCreateForm.use_manual_password}
                      onCheckedChange={(checked) => {
                        const enabled = checked === true;
                        setScannerCreateForm((current) => ({
                          ...current,
                          use_manual_password: enabled,
                          password: enabled ? current.password : "",
                        }));
                        setScannerCreateErrors((current) => ({
                          ...current,
                          password: undefined,
                          form: undefined,
                        }));
                      }}
                    />
                    <span>
                      <span className="block font-medium">
                        Ustaw hasło ręcznie
                      </span>
                      <span className="block text-xs text-muted-foreground">
                        Bez tej opcji użytkownik dostanie e-mail z linkiem do
                        ustawienia hasła.
                      </span>
                    </span>
                  </label>
                  {scannerCreateForm.use_manual_password && (
                    <div className="space-y-2">
                      <Label htmlFor="event-scanner-create-password">
                        Hasło
                      </Label>
                      <div className="flex gap-2">
                        <div className="relative min-w-0 flex-1">
                          <Input
                            id="event-scanner-create-password"
                            type={
                              showScannerCreatePassword ? "text" : "password"
                            }
                            value={scannerCreateForm.password}
                            onChange={(eventValue) => {
                              setScannerCreateForm((current) => ({
                                ...current,
                                password: eventValue.target.value,
                              }));
                              setScannerCreateErrors((current) => ({
                                ...current,
                                password: undefined,
                                form: undefined,
                              }));
                            }}
                            autoComplete="new-password"
                            className="pr-10"
                            aria-invalid={Boolean(
                              scannerCreateErrors.password,
                            )}
                            aria-describedby={
                              scannerCreateErrors.password
                                ? "event-scanner-create-password-error"
                                : undefined
                            }
                          />
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="absolute right-1 top-1/2 h-8 w-8 -translate-y-1/2"
                            onClick={() =>
                              setShowScannerCreatePassword(
                                (visible) => !visible,
                              )
                            }
                            aria-label={
                              showScannerCreatePassword
                                ? "Ukryj hasło"
                                : "Pokaż hasło"
                            }
                          >
                            {showScannerCreatePassword ? (
                              <EyeOff className="h-4 w-4" />
                            ) : (
                              <Eye className="h-4 w-4" />
                            )}
                          </Button>
                        </div>
                        <Button
                          type="button"
                          variant="outline"
                          onClick={generateScannerCreatePassword}
                          className="shrink-0"
                        >
                          <KeyRound className="mr-1 h-4 w-4" />
                          Generator
                        </Button>
                      </div>
                      <PasswordRequirements
                        password={scannerCreateForm.password}
                      />
                      <FieldError id="event-scanner-create-password-error">
                        {scannerCreateErrors.password}
                      </FieldError>
                    </div>
                  )}
                </div>

                <p className="rounded-xl border bg-muted/40 px-3 py-2 text-xs text-muted-foreground">
                  Konto zostanie dodane do organizacji i od razu przypisane do
                  tego wydarzenia.
                </p>

                <FieldError id="event-scanner-create-form-error">
                  {scannerCreateErrors.form}
                </FieldError>
              </TabsContent>
            </Tabs>
          </div>
          <DialogFooter className="shrink-0 border-t px-6 py-4">
            {scannerManagerTab === "existing" ? (
              <Button
                className="w-full sm:w-auto"
                onClick={handleSaveScannerAssignments}
                disabled={scannerSaving || managedRoleScanners.length === 0}
              >
                {scannerSaving && (
                  <Loader2 className="mr-1 h-4 w-4 animate-spin" />
                )}
                Zapisz przypisania
              </Button>
            ) : (
              <Button
                className="w-full sm:w-auto"
                onClick={handleCreateScanner}
                disabled={scannerCreateSaving}
              >
                {scannerCreateSaving ? (
                  <Loader2 className="mr-1 h-4 w-4 animate-spin" />
                ) : (
                  <Plus className="mr-1 h-4 w-4" />
                )}
                Dodaj i przypisz
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
