import { useMemo, useState, type ReactNode } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useData } from "@/contexts/DataContext";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { DateTimePicker } from "@/components/ui/date-time-picker";
import { Checkbox } from "@/components/ui/checkbox";
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
import { Label } from "@/components/ui/label";
import { FieldError } from "@/components/ui/field-error";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import TableSkeleton from "@/components/skeletons/TableSkeleton";
import { toast } from "@/hooks/use-toast";
import {
  formatEventOfficeWindow,
  isEventCurrentOrUpcoming,
  isEventOfficeOpen,
  isEventOfficeStartAtOrAfterNow,
  isValidEventOfficeRange,
  parseEventDateTime,
} from "@/lib/events";
import {
  validateEmail,
  validateNonNegativeInteger,
  validateRequired,
} from "@/lib/form-validation";
import { getRoleLabel, isScannerRole } from "@/lib/roles";
import type { User } from "@/types";
import {
  ArrowLeft,
  Archive,
  Building2,
  ChevronDown,
  KeyRound,
  Loader2,
  Pencil,
  Plus,
  Trash2,
  Calculator,
} from "lucide-react";
import { cn } from "@/lib/utils";

type MemberRole = "editor" | "scanner" | "scanner_plus";

function CollapsibleOrganizationSection({
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
  const displayTitle = title.startsWith("Archiwum")
    ? "Archiwum wydarzen"
    : title;
  const isStaticSection = title.startsWith("Archiwum");

  if (isStaticSection) {
    return (
      <div className={cn("event-detail-list-section", className)}>
        <div className="event-detail-list-content space-y-4">{children}</div>
      </div>
    );
  }

  return (
    <Collapsible defaultOpen={defaultOpen}>
      <div className={cn("event-detail-list-section", className)}>
        <div className="flex items-center gap-3 pr-3">
          <CollapsibleTrigger className="event-detail-collapsible-trigger w-full flex-1">
            <h2 className="text-base font-semibold text-foreground">
              {displayTitle}
            </h2>
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

export default function OrganizationDetails() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const {
    organizations,
    events,
    archivedEvents,
    users,
    currentRole,
    currentUser,
    addUser,
    updateUser,
    createEvent,
    updateOrganization,
    updateOrganizationEventLimit,
    deleteOrganization,
    removeUser,
    triggerUserPasswordReset,
    changeRole,
    assignScannerEvents,
    isLoading,
  } = useData();

  const [memberDialogOpen, setMemberDialogOpen] = useState(false);
  const [scannerAssignmentsDialogOpen, setScannerAssignmentsDialogOpen] =
    useState(false);
  const [eventDialogOpen, setEventDialogOpen] = useState(false);
  const [organizationEditOpen, setOrganizationEditOpen] = useState(false);
  const [limitDialogOpen, setLimitDialogOpen] = useState(false);
  const [scannerEditDialogOpen, setScannerEditDialogOpen] = useState(false);
  const [deleteOrganizationConfirmOpen, setDeleteOrganizationConfirmOpen] =
    useState(false);
  const [archiveUserConfirmOpen, setArchiveUserConfirmOpen] = useState(false);
  const [passwordResetConfirmOpen, setPasswordResetConfirmOpen] =
    useState(false);
  const [isSubmittingMember, setIsSubmittingMember] = useState(false);
  const [isSubmittingEvent, setIsSubmittingEvent] = useState(false);
  const [isSavingOrganization, setIsSavingOrganization] = useState(false);
  const [isDeletingOrganization, setIsDeletingOrganization] = useState(false);
  const [isSavingScanner, setIsSavingScanner] = useState(false);
  const [isChangingScannerRole, setIsChangingScannerRole] = useState(false);
  const [isArchivingUser, setIsArchivingUser] = useState(false);
  const [isSendingPasswordReset, setIsSendingPasswordReset] = useState(false);
  const [isSavingScannerAssignments, setIsSavingScannerAssignments] =
    useState(false);
  const [selectedActionUser, setSelectedActionUser] = useState<User | null>(
    null,
  );
  const [selectedScannerId, setSelectedScannerId] = useState<string | null>(
    null,
  );
  const [selectedScanner, setSelectedScanner] = useState<User | null>(null);
  const [memberForm, setMemberForm] = useState({
    role: "editor" as MemberRole,
    name: "",
    email: "",
    assigned_events: [] as string[],
  });
  const [eventForm, setEventForm] = useState({
    name: "",
    location: "",
    office_open_at: "",
    office_close_at: "",
  });
  const [scannerAssignmentDraft, setScannerAssignmentDraft] = useState<
    string[]
  >([]);
  const [limitDraft, setLimitDraft] = useState("");
  const [organizationNameDraft, setOrganizationNameDraft] = useState("");
  const [scannerDraft, setScannerDraft] = useState({
    name: "",
    email: "",
  });
  const [memberErrors, setMemberErrors] = useState<{
    name?: string;
    email?: string;
    form?: string;
  }>({});
  const [limitErrors, setLimitErrors] = useState<{
    event_limit?: string;
    form?: string;
  }>({});
  const [organizationErrors, setOrganizationErrors] = useState<{
    name?: string;
    form?: string;
  }>({});
  const [scannerErrors, setScannerErrors] = useState<{
    name?: string;
    email?: string;
    form?: string;
  }>({});
  const [eventErrors, setEventErrors] = useState<{
    name?: string;
    location?: string;
    office_open_at?: string;
    office_close_at?: string;
    form?: string;
  }>({});

  const organization = useMemo(
    () => organizations.find((org) => org.id === id),
    [id, organizations],
  );

  const allowed = useMemo(() => {
    if (!organization) return false;
    if (currentRole === "superadmin") return true;
    if (currentRole === "admin") return true;
    return currentUser.organization_id === organization.id;
  }, [currentRole, currentUser, organization]);

  const orgEvents = useMemo(
    () =>
      events
        .filter(
          (event) =>
            event.organization_id === organization?.id && !event.archived_at,
        )
        .sort((a, b) => a.name.localeCompare(b.name, "pl")),
    [events, organization?.id],
  );
  const orgArchivedEvents = useMemo(
    () =>
      archivedEvents
        .filter((event) => event.organization_id === organization?.id)
        .sort((a, b) => a.name.localeCompare(b.name, "pl")),
    [archivedEvents, organization?.id],
  );
  const totalOrganizationEvents = orgEvents.length + orgArchivedEvents.length;
  const organizers = useMemo(
    () =>
      users
        .filter(
          (user) =>
            user.organization_id === organization?.id && user.role === "editor",
        )
        .sort((a, b) => a.name.localeCompare(b.name, "pl")),
    [users, organization?.id],
  );
  const scanners = useMemo(
    () =>
      users
        .filter(
          (user) =>
            user.organization_id === organization?.id &&
            isScannerRole(user.role),
        )
        .sort((a, b) => a.name.localeCompare(b.name, "pl")),
    [users, organization?.id],
  );
  if (isLoading) return <TableSkeleton rows={4} cols={4} subtitle="" />;
  if (!organization || !allowed)
    return (
      <div className="py-12 text-center text-muted-foreground">
        Nie znaleziono organizacji.
      </div>
    );

  const remainingSlots = Math.max(
    organization.event_limit - totalOrganizationEvents,
    0,
  );
  const addEventDisabledReason =
    remainingSlots <= 0
      ? "Osiągnięto limit wydarzeń dla tej organizacji, łącznie z wydarzeniami w archiwum. Zwiększ limit, aby dodać kolejne wydarzenie."
      : null;
  const assignableScannerEvents = orgEvents.filter((event) =>
    isEventCurrentOrUpcoming(event),
  );
  const assignableScannerEventIds = new Set(
    assignableScannerEvents.map((event) => event.id),
  );
  const canCreateEvent = !isScannerRole(currentRole);
  const canEditOrganization =
    currentRole === "superadmin" || currentRole === "admin";
  const canManageMemberAccounts =
    currentRole === "superadmin" || currentRole === "admin";
  const canManageMembers =
    currentRole === "superadmin" || currentRole === "admin";
  const canManageScanners =
    currentRole === "superadmin" ||
    currentRole === "admin" ||
    currentRole === "editor";
  const canDeleteOrganization =
    canEditOrganization &&
    orgEvents.length === 0 &&
    orgArchivedEvents.length === 0 &&
    organizers.length === 0 &&
    scanners.length === 0;
  const adminLabel = "Wszystkie organizacje";
  const sectionClassName =
    "overflow-hidden rounded-[1.35rem] border border-[hsl(var(--button-highlight)/0.14)] bg-[linear-gradient(180deg,hsl(220_13%_8%/_0.95),hsl(220_14%_6%/_0.98))] shadow-[0_18px_44px_hsl(var(--surface-shadow)/0.28),inset_0_1px_0_hsl(var(--foreground)/0.04)]";
  const sectionPrimaryButtonClassName =
    "h-12 w-full rounded-[1rem] border border-[hsl(42_62%_62%/0.78)] bg-[linear-gradient(180deg,hsl(42_46%_56%),hsl(38_34%_42%))] px-4 text-[0.98rem] font-semibold text-white shadow-[inset_0_1px_0_hsl(48_65%_78%/0.32)] hover:brightness-105";
  const sectionSecondaryButtonClassName =
    "h-12 w-full rounded-[1rem] border border-[hsl(var(--button-highlight)/0.32)] bg-[linear-gradient(180deg,hsl(220_10%_10%/_0.94),hsl(220_11%_8%/_0.96))] px-4 text-[0.98rem] font-semibold text-foreground shadow-[inset_0_1px_0_hsl(var(--foreground)/0.08)] hover:border-[hsl(var(--button-highlight)/0.52)] hover:bg-[linear-gradient(180deg,hsl(220_10%_11%/_0.98),hsl(220_11%_9%/_0.98))]";
  const subtleIconButtonClassName =
    "h-10 w-10 rounded-[0.95rem] border border-[hsl(var(--button-highlight)/0.22)] bg-[hsl(var(--background)/0.66)] text-[hsl(var(--button-highlight))] hover:bg-[hsl(var(--button-highlight)/0.12)] hover:text-[hsl(var(--button-highlight))]";
  const tableContainerClassName =
    "rounded-[1.2rem] border border-[hsl(var(--button-highlight)/0.12)] bg-[hsl(220_14%_7%/_0.72)] shadow-[inset_0_1px_0_hsl(var(--foreground)/0.03)]";
  const actionButtonClassName =
    "min-h-10 h-auto rounded-[0.95rem] px-3 py-2 text-xs font-medium";

  const openLimitDialog = () => {
    setLimitDraft(String(organization.event_limit));
    setLimitDialogOpen(true);
  };

  const openMemberDialog = (role: MemberRole) => {
    setMemberForm({ role, name: "", email: "", assigned_events: [] });
    setMemberDialogOpen(true);
  };

  const openScannerAssignmentsDialog = (scannerId: string) => {
    const scanner = scanners.find((user) => user.id === scannerId);
    setSelectedScannerId(scannerId);
    setScannerAssignmentDraft(
      (scanner?.assigned_events ?? []).filter((eventId) =>
        assignableScannerEventIds.has(eventId),
      ),
    );
    setScannerAssignmentsDialogOpen(true);
  };

  const openScannerEditDialog = (scanner: User) => {
    setSelectedScanner(scanner);
    setScannerDraft({
      name: scanner.name,
      email: scanner.email,
    });
    setScannerErrors({});
    setScannerEditDialogOpen(true);
  };

  const openArchiveUserDialog = (user: User) => {
    setSelectedActionUser(user);
    setArchiveUserConfirmOpen(true);
  };

  const openPasswordResetDialog = (user: User) => {
    setSelectedActionUser(user);
    setPasswordResetConfirmOpen(true);
  };

  const toggleScannerEvent = (eventId: string, checked: boolean) => {
    setMemberForm((prev) => ({
      ...prev,
      assigned_events: checked
        ? [...prev.assigned_events, eventId]
        : prev.assigned_events.filter((idValue) => idValue !== eventId),
    }));
  };

  const toggleScannerAssignmentDraft = (eventId: string, checked: boolean) => {
    setScannerAssignmentDraft((prev) =>
      checked
        ? [...prev, eventId]
        : prev.filter((idValue) => idValue !== eventId),
    );
  };

  const getEventNames = (eventIds: string[]) => {
    const names = orgEvents
      .filter((event) => eventIds.includes(event.id) && !event.archived_at)
      .map((event) => event.name);
    return names.length > 0 ? names.join(", ") : "Brak przypisanych wydarzeń";
  };

  const handleAddMember = async () => {
    const nextErrors = {
      name: validateRequired(memberForm.name, "Podaj imię i nazwisko."),
      email: validateEmail(memberForm.email),
    };

    if (nextErrors.name || nextErrors.email) {
      setMemberErrors(nextErrors);
      return;
    }

    setMemberErrors({});
    setIsSubmittingMember(true);
    const result = await addUser({
      name: memberForm.name,
      email: memberForm.email,
      role: memberForm.role,
      organization_id: organization.id,
      assigned_events: isScannerRole(memberForm.role)
        ? memberForm.assigned_events.filter((eventId) =>
            assignableScannerEventIds.has(eventId),
          )
        : [],
    });
    setIsSubmittingMember(false);

    if (!result.ok) {
      setMemberErrors({ form: result.error ?? "Nie udało się dodać konta." });
      toast({
        title: "Nie udało się dodać konta",
        description: result.error ?? "Spróbuj ponownie.",
        variant: "destructive",
      });
      return;
    }

    setMemberDialogOpen(false);
    setMemberErrors({});
    toast({
      title:
        memberForm.role === "editor"
          ? "Dodano organizatora"
          : `Dodano ${getRoleLabel(memberForm.role).toLocaleLowerCase("pl-PL")}`,
      description: "Użytkownik otrzyma mail z linkiem do ustawienia hasła.",
    });
  };

  const handleSaveLimit = async () => {
    const parsed = Number(limitDraft || organization.event_limit);
    const limitError = validateNonNegativeInteger(
      limitDraft || String(organization.event_limit),
      "Podaj liczbę całkowitą większą lub równą 0.",
    );
    if (limitError || !Number.isInteger(parsed) || parsed < 0) {
      setLimitErrors({
        event_limit:
          limitError || "Podaj liczbę całkowitą większą lub równą 0.",
      });
      toast({
        title: "Nieprawidłowy limit",
        description: "Podaj liczbę całkowitą większą lub równą 0.",
        variant: "destructive",
      });
      return;
    }
    if (parsed < totalOrganizationEvents) {
      setLimitErrors({
        event_limit: `Limit wydarzeń nie może być mniejszy niż ${totalOrganizationEvents}.`,
      });
      toast({
        title: "Nieprawidłowy limit",
        description: `Limit wydarzeń nie może być mniejszy niż ${totalOrganizationEvents}.`,
        variant: "destructive",
      });
      return;
    }
    setLimitErrors({});
    const result = await updateOrganizationEventLimit(organization.id, parsed);
    if (!result.ok) {
      setLimitErrors({ form: result.error ?? "Nie udało się zapisać limitu." });
      toast({
        title: "Nie udało się zapisać limitu",
        description: result.error ?? "Spróbuj ponownie.",
        variant: "destructive",
      });
      return;
    }
    setLimitDialogOpen(false);
    setLimitErrors({});
    toast({ title: "Zaktualizowano limit wydarzeń" });
  };

  const handleSaveOrganization = async () => {
    const name = organizationNameDraft.trim();
    const parsedLimit = Number(limitDraft || organization.event_limit);
    const limitError = validateNonNegativeInteger(
      limitDraft || String(organization.event_limit),
      "Podaj liczbÄ™ caĹ‚kowitÄ… wiÄ™kszÄ… lub rĂłwnÄ… 0.",
    );
    const nameError = validateRequired(name, "Podaj nazwę organizacji.");
    if (nameError) {
      setOrganizationErrors({ name: nameError });
      toast({ title: "Nazwa jest wymagana", variant: "destructive" });
      return;
    }
    if (limitError || !Number.isInteger(parsedLimit) || parsedLimit < 0) {
      setLimitErrors({
        event_limit:
          limitError || "Podaj liczbe calkowita wieksza lub rowna 0.",
      });
      toast({
        title: "Nieprawidlowy limit",
        description: "Podaj liczbe calkowita wieksza lub rowna 0.",
        variant: "destructive",
      });
      return;
    }
    if (parsedLimit < totalOrganizationEvents) {
      setLimitErrors({
        event_limit: `Limit wydarzen nie moze byc mniejszy niz ${totalOrganizationEvents}.`,
      });
      toast({
        title: "Nieprawidlowy limit",
        description: `Limit wydarzen nie moze byc mniejszy niz ${totalOrganizationEvents}.`,
        variant: "destructive",
      });
      return;
    }
    setOrganizationErrors({});
    setLimitErrors({});
    setIsSavingOrganization(true);
    const result = await updateOrganization(organization.id, { name });
    if (!result.ok) {
      setOrganizationErrors({
        form: result.error ?? "Nie udało się zaktualizować organizacji.",
      });
      toast({
        title: "Nie udało się zaktualizować organizacji",
        description: result.error ?? "Spróbuj ponownie.",
        variant: "destructive",
      });
      return;
    }
    if (parsedLimit !== organization.event_limit) {
      const limitResult = await updateOrganizationEventLimit(
        organization.id,
        parsedLimit,
      );
      if (!limitResult.ok) {
        setIsSavingOrganization(false);
        setLimitErrors({
          form: limitResult.error ?? "Nie udalo sie zapisac limitu.",
        });
        toast({
          title: "Nie udalo sie zapisac limitu",
          description: limitResult.error ?? "Sprobuj ponownie.",
          variant: "destructive",
        });
        return;
      }
    }
    setIsSavingOrganization(false);
    setOrganizationEditOpen(false);
    setOrganizationErrors({});
    toast({ title: "Zaktualizowano organizację" });
  };

  const handleAddEvent = async () => {
    const nextErrors = {
      name: validateRequired(eventForm.name, "Podaj nazwę wydarzenia."),
      location: validateRequired(
        eventForm.location,
        "Podaj lokalizację wydarzenia.",
      ),
      office_open_at: validateRequired(
        eventForm.office_open_at,
        "Podaj datę i godzinę otwarcia biura.",
      ),
      office_close_at: validateRequired(
        eventForm.office_close_at,
        "Podaj datę i godzinę zamknięcia biura.",
      ),
    };

    if (
      nextErrors.name ||
      nextErrors.location ||
      nextErrors.office_open_at ||
      nextErrors.office_close_at
    ) {
      setEventErrors(nextErrors);
      return;
    }

    if (
      !eventForm.office_open_at ||
      !isEventOfficeStartAtOrAfterNow(eventForm.office_open_at)
    ) {
      setEventErrors({
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
      !eventForm.office_open_at ||
      !eventForm.office_close_at ||
      !isValidEventOfficeRange(
        eventForm.office_open_at,
        eventForm.office_close_at,
      )
    ) {
      setEventErrors({
        office_close_at: "Zamknięcie biura musi być później niż otwarcie.",
      });
      toast({
        title: "Nieprawidłowe godziny biura",
        description: "Podaj poprawny czas otwarcia i zamknięcia biura zawodów.",
        variant: "destructive",
      });
      return;
    }
    setEventErrors({});
    setIsSubmittingEvent(true);
    const result = await createEvent({
      name: eventForm.name,
      location: eventForm.location,
      organization_id: organization.id,
      office_open_at: eventForm.office_open_at,
      office_close_at: eventForm.office_close_at,
    });
    setIsSubmittingEvent(false);
    if (!result.ok) {
      setEventErrors({
        form: result.error ?? "Nie udało się utworzyć wydarzenia.",
      });
      toast({
        title: "Nie udało się utworzyć wydarzenia",
        description: result.error ?? "Spróbuj ponownie.",
        variant: "destructive",
      });
      return;
    }
    setEventDialogOpen(false);
    setEventErrors({});
    setEventForm({
      name: "",
      location: "",
      office_open_at: "",
      office_close_at: "",
    });
    toast({ title: "Wydarzenie utworzone" });
  };

  const handleSaveScannerAssignments = async () => {
    if (!selectedScannerId) return;
    setIsSavingScannerAssignments(true);
    const result = await assignScannerEvents(
      selectedScannerId,
      scannerAssignmentDraft.filter((eventId) =>
        assignableScannerEventIds.has(eventId),
      ),
    );
    setIsSavingScannerAssignments(false);
    if (!result.ok) {
      toast({
        title: "Nie udało się zapisać przypisań operatora",
        description: result.error ?? "Spróbuj ponownie.",
        variant: "destructive",
      });
      return;
    }
    setScannerAssignmentsDialogOpen(false);
    toast({ title: "Zapisano przypisania operatora" });
  };

  const handleSaveScanner = async () => {
    if (!selectedScanner) return;

    const nextErrors = {
      name: validateRequired(scannerDraft.name, "Podaj imię i nazwisko."),
      email: validateEmail(scannerDraft.email),
    };

    if (nextErrors.name || nextErrors.email) {
      setScannerErrors(nextErrors);
      return;
    }

    setScannerErrors({});
    setIsSavingScanner(true);
    const result = await updateUser(selectedScanner.id, {
      name: scannerDraft.name.trim(),
      email: scannerDraft.email.trim(),
    });
    setIsSavingScanner(false);

    if (!result.ok) {
      setScannerErrors({
        form: result.error ?? "Nie udało się zaktualizować operatora.",
      });
      toast({
        title: "Nie udało się zapisać danych operatora",
        description: result.error ?? "Spróbuj ponownie.",
        variant: "destructive",
      });
      return;
    }

    setScannerEditDialogOpen(false);
    setSelectedScanner(null);
    setScannerErrors({});
    toast({ title: "Zaktualizowano dane operatora" });
  };

  const handleChangeScannerRole = async (
    scanner: User,
    role: "scanner" | "scanner_plus",
  ) => {
    setIsChangingScannerRole(true);
    const result = await changeRole(scanner.id, role);
    setIsChangingScannerRole(false);
    if (!result.ok) {
      toast({
        title: "Nie udało się zmienić uprawnień operatora",
        description: result.error ?? "Spróbuj ponownie.",
        variant: "destructive",
      });
      return;
    }

    setSelectedScanner((prev) =>
      prev && prev.id === scanner.id ? { ...prev, role } : prev,
    );
    toast({
      title:
        role === "scanner"
          ? "Zmieniono rolę na operatora"
          : "Zmieniono rolę na operatora Plus",
      description: scanner.name,
    });
  };

  const handleDeleteOrganization = async () => {
    setIsDeletingOrganization(true);
    const result = await deleteOrganization(organization.id);
    setIsDeletingOrganization(false);
    if (!result.ok) {
      toast({
        title: "Nie udało się usunąć organizacji",
        description:
          result.error ??
          "Usuń najpierw wydarzenia i użytkowników przypisanych do organizacji.",
        variant: "destructive",
      });
      return;
    }
    setDeleteOrganizationConfirmOpen(false);
    toast({ title: "Organizacja usunięta" });
    navigate("/organizations");
  };

  const handleArchiveUser = async () => {
    if (!selectedActionUser) return;

    setIsArchivingUser(true);
    const result = await removeUser(selectedActionUser.id);
    setIsArchivingUser(false);

    if (!result.ok) {
      toast({
        title: "Nie udało się usunąć konta",
        description: result.error ?? "Spróbuj ponownie.",
        variant: "destructive",
      });
      return;
    }

    const archivedUser = selectedActionUser;
    setArchiveUserConfirmOpen(false);
    setSelectedActionUser(null);
    if (selectedScanner?.id === archivedUser.id) {
      setScannerEditDialogOpen(false);
      setSelectedScanner(null);
      setScannerErrors({});
    }
    toast({
      title:
        archivedUser.role === "editor"
          ? "Usunięto organizatora"
          : "Usunięto operatora",
      description:
        "Konto zostało zarchiwizowane. Ta osoba nie zaloguje się już na stare konto, a ten email można wykorzystać ponownie.",
    });
  };

  const handleTriggerPasswordReset = async () => {
    if (!selectedActionUser) return;

    setIsSendingPasswordReset(true);
    const result = await triggerUserPasswordReset(selectedActionUser.id);
    setIsSendingPasswordReset(false);

    if (!result.ok) {
      toast({
        title: "Nie udało się wysłać resetu hasła",
        description: result.error ?? "Spróbuj ponownie.",
        variant: "destructive",
      });
      return;
    }

    const targetUser = selectedActionUser;
    setPasswordResetConfirmOpen(false);
    setSelectedActionUser(null);
    toast({
      title: "Wysłano reset hasła",
      description: `Email z resetem hasła został wysłany do ${targetUser.email}.`,
    });
  };

  return (
    <div className="mx-auto flex max-w-[1080px] flex-col gap-7 pb-6">
      <Button
        variant="ghost"
        size="sm"
        onClick={() => navigate("/organizations")}
        className="w-fit touch-manipulation rounded-full px-1 text-[0.98rem] font-medium text-[hsl(var(--button-highlight))] hover:bg-transparent hover:text-[hsl(var(--button-highlight))]"
      >
        <ArrowLeft className="mr-1 h-4 w-4" />
        Wróć do listy wszystkich organizacji
      </Button>

      <div className="flex flex-col gap-4">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
          <div className="min-w-0">
            <div className="flex items-center gap-4">
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <h1 className="truncate text-[2rem] font-bold leading-none tracking-[-0.03em] text-foreground sm:text-[2.35rem]">
                    {organization.name}
                  </h1>
                  {canEditOrganization && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className={subtleIconButtonClassName}
                      onClick={() => {
                        setOrganizationNameDraft(organization.name);
                        setLimitDraft(String(organization.event_limit));
                        setOrganizationEditOpen(true);
                      }}
                      aria-label="Edytuj organizację"
                    >
                      <Pencil className="h-4 w-4" />
                    </Button>
                  )}
                </div>
              </div>
            </div>
          </div>
          {canEditOrganization && (
            <div className="flex flex-col gap-2 sm:flex-row">
              <Button
                variant="outline"
                className="w-full rounded-[1rem] px-5 sm:w-auto"
                onClick={openLimitDialog}
              >
                <Calculator className="mr-1 h-4 w-4" />
                Zmień limit wydarzeń
              </Button>
              <Button
                variant="destructive"
                className="w-full rounded-[1rem] px-5 sm:w-auto"
                onClick={() => setDeleteOrganizationConfirmOpen(true)}
              >
                <Trash2 className="mr-1 h-4 w-4" />
                Usuń organizację
              </Button>
            </div>
          )}
        </div>
      </div>

      <section className={sectionClassName}>
        <CollapsibleOrganizationSection
          title={`Wydarzenia  (${orgEvents.length}/${organization.event_limit})`}
          defaultOpen
          action={
            canCreateEvent ? (
              <Tooltip>
                <TooltipTrigger asChild>
                  <span className="inline-flex">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => setEventDialogOpen(true)}
                      className="h-9 rounded-[0.9rem] border-[hsl(var(--button-highlight)/0.28)] bg-transparent px-3 text-xs font-medium hover:bg-[hsl(var(--button-highlight)/0.08)]"
                      disabled={remainingSlots <= 0}
                    >
                      <Plus className="mr-1 h-3.5 w-3.5" />
                      Dodaj wydarzenie
                    </Button>
                  </span>
                </TooltipTrigger>
                {addEventDisabledReason ? (
                  <TooltipContent
                    side="bottom"
                    align="end"
                    collisionPadding={16}
                    className="max-w-[min(18rem,calc(100vw-2rem))] whitespace-normal break-words"
                  >
                    {addEventDisabledReason}
                  </TooltipContent>
                ) : null}
              </Tooltip>
            ) : null
          }
        >
          <div className="flex flex-col gap-4">
            {orgEvents.length === 0 ? (
              <EmptyTableState
                title="Brak wydarzeń"
                description="Po dodaniu wydarzeń pojawi się tutaj ich lista."
              />
            ) : (
              <div className="w-full">
                <Table containerClassName={tableContainerClassName}>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="h-12 px-5 text-[0.72rem] tracking-[0.2em] sm:px-7">
                        Wydarzenie
                      </TableHead>
                      <TableHead className="hidden h-12 px-5 text-[0.72rem] tracking-[0.2em] md:table-cell sm:px-7">
                        Lokalizacja
                      </TableHead>
                      <TableHead className="h-12 px-5 text-[0.72rem] tracking-[0.2em] sm:px-7">
                        Biuro
                      </TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {orgEvents.map((event) => {
                      const now = new Date();
                      const openAt = parseEventDateTime(event.office_open_at);
                      const isOfficeOpen = isEventOfficeOpen(event, now);
                      const isUpcoming =
                        !isOfficeOpen &&
                        openAt !== null &&
                        openAt.getTime() > now.getTime();
                      const statusLabel = isOfficeOpen
                        ? "Otwarte"
                        : isUpcoming
                          ? "Nadchodzące"
                          : "Zamknięte";
                      const statusClassName = isOfficeOpen
                        ? "border border-emerald-400/14 bg-emerald-500/10 text-emerald-200/90 hover:bg-emerald-500/10"
                        : isUpcoming
                          ? "border border-sky-400/16 bg-sky-500/10 text-sky-100/90 hover:bg-sky-500/10"
                          : "border border-[hsl(var(--button-highlight)/0.18)] bg-[hsl(var(--button-highlight)/0.08)] text-[hsl(40_18%_78%)] hover:bg-[hsl(var(--button-highlight)/0.08)]";

                      return (
                        <TableRow
                        key={event.id}
                        className="cursor-pointer border-0 transition-colors hover:bg-[hsl(var(--button-highlight)/0.06)] active:bg-[hsl(var(--button-highlight)/0.1)] [&>td]:py-4"
                        onClick={() =>
                          navigate(`/events/${event.id}`, {
                            state: {
                              backTo: `/organizations/${organization.id}`,
                              backLabel: "Wróć do szczegółów organizacji",
                            },
                          })
                        }
                        onKeyDown={(keyboardEvent) => {
                          if (
                            keyboardEvent.key === "Enter" ||
                            keyboardEvent.key === " "
                          ) {
                            keyboardEvent.preventDefault();
                            navigate(`/events/${event.id}`, {
                              state: {
                                backTo: `/organizations/${organization.id}`,
                                backLabel: "Wróć do szczegółów organizacji",
                              },
                            });
                          }
                        }}
                        tabIndex={0}
                        aria-label={`Wyświetl wydarzenie ${event.name}`}
                      >
                        <TableCell className="px-5 sm:px-7">
                          <div>
                            <div className="flex flex-wrap items-center gap-2">
                              <span className="text-base font-medium text-foreground">
                                {event.name}
                              </span>
                              <Badge
                                className={cn(
                                  "rounded-full px-2.5 py-0.5 text-[0.68rem] font-medium shadow-none",
                                  statusClassName
                                )}
                              >
                                {statusLabel}
                              </Badge>
                            </div>
                            <span className="mt-1 block text-sm text-muted-foreground md:hidden">
                              {event.location}
                            </span>
                          </div>
                        </TableCell>
                        <TableCell className="hidden px-5 text-sm text-muted-foreground md:table-cell sm:px-7">
                          {event.location}
                        </TableCell>
                        <TableCell className="px-5 text-sm text-muted-foreground sm:px-7">
                          {formatEventOfficeWindow(event)}
                        </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            )}
          </div>
        </CollapsibleOrganizationSection>
      </section>

      <section className={sectionClassName}>
        <CollapsibleOrganizationSection
          title="Organizatorzy"
          action={
            canManageMembers ? (
              <Button
                size="sm"
                variant="outline"
                onClick={() => openMemberDialog("editor")}
                className="h-9 rounded-[0.9rem] border-[hsl(var(--button-highlight)/0.28)] bg-transparent px-3 text-xs font-medium hover:bg-[hsl(var(--button-highlight)/0.08)]"
              >
                <Plus className="mr-1 h-3.5 w-3.5" />
                Dodaj organizatora
              </Button>
            ) : null
          }
        >
          <div className="flex flex-col gap-4">
            {organizers.length === 0 ? (
              <EmptyTableState
                title="Brak organizatorów"
                description="Po dodaniu organizatorów pojawi się tutaj ich lista."
              />
            ) : (
              <div className="w-full">
                <Table containerClassName={tableContainerClassName}>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="h-12 px-5 text-[0.72rem] tracking-[0.2em] sm:px-7">
                        Imię i nazwisko
                      </TableHead>
                      <TableHead className="h-12 px-5 text-[0.72rem] tracking-[0.2em] sm:px-7">
                        Email
                      </TableHead>
                      {canManageMemberAccounts && (
                        <TableHead className="h-12 w-[250px] px-5 text-[0.72rem] tracking-[0.2em] sm:px-7">
                          Akcje
                        </TableHead>
                      )}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {organizers.map((organizer) => (
                      <TableRow
                        key={organizer.id}
                        className="border-0 hover:bg-[hsl(var(--button-highlight)/0.04)]"
                      >
                        <TableCell className="px-5 text-base font-medium sm:px-7">
                          {organizer.name}
                        </TableCell>
                        <TableCell className="px-5 text-sm text-muted-foreground sm:px-7">
                          {organizer.email}
                        </TableCell>
                        {canManageMemberAccounts && (
                          <TableCell className="px-5 sm:px-7">
                            <div className="flex flex-col gap-2 sm:flex-row">
                              <Button
                                size="sm"
                                variant="outline"
                                className={`${actionButtonClassName} w-full sm:w-auto`}
                                onClick={() =>
                                  openPasswordResetDialog(organizer)
                                }
                              >
                                <KeyRound className="mr-1 h-3.5 w-3.5" />
                                Reset hasła
                              </Button>
                              <Button
                                size="sm"
                                variant="destructive"
                                className={`${actionButtonClassName} w-full sm:w-auto`}
                                onClick={() => openArchiveUserDialog(organizer)}
                              >
                                <Trash2 className="mr-1 h-3.5 w-3.5" />
                                Usuń
                              </Button>
                            </div>
                          </TableCell>
                        )}
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </div>
        </CollapsibleOrganizationSection>
      </section>

      <section className={sectionClassName}>
        <CollapsibleOrganizationSection
          title="Operatorzy"
          action={
            canManageScanners ? (
              <div>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => openMemberDialog("scanner")}
                  className="h-9 rounded-[0.9rem] border-[hsl(var(--button-highlight)/0.28)] bg-transparent px-3 text-xs font-medium hover:bg-[hsl(var(--button-highlight)/0.08)]"
                >
                  <Plus className="mr-1 h-3.5 w-3.5" />
                  Dodaj operatora
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => openMemberDialog("scanner_plus")}
                  className="h-9 rounded-[0.9rem] border-[hsl(var(--button-highlight)/0.28)] bg-transparent px-3 text-xs font-medium hover:bg-[hsl(var(--button-highlight)/0.08)]"
                >
                  <Plus className="mr-1 h-3.5 w-3.5" />
                  Dodaj operatora plus
                </Button>
              </div>
            ) : null
          }
        >
          <div className="flex flex-col gap-4">
            {scanners.length === 0 ? (
              <EmptyTableState
                title="Brak operatorów"
                description="Po dodaniu operatorów pojawi się tutaj ich lista."
              />
            ) : (
              <div className="w-full">
                <Table containerClassName={tableContainerClassName}>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="h-12 px-5 text-[0.72rem] tracking-[0.2em] sm:px-7">
                        Imię i nazwisko
                      </TableHead>
                      <TableHead className="hidden h-12 px-5 text-[0.72rem] tracking-[0.2em] md:table-cell sm:px-7">
                        Email
                      </TableHead>
                      <TableHead className="h-12 px-5 text-[0.72rem] tracking-[0.2em] sm:px-7">
                        Przypisane wydarzenia
                      </TableHead>
                      {canManageScanners && (
                        <TableHead className="h-12 w-[11.5rem] px-5 text-[0.72rem] tracking-[0.2em] sm:w-[13.5rem] sm:px-7 lg:w-[240px]">
                          Akcje
                        </TableHead>
                      )}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {scanners.map((scanner) => (
                      <TableRow
                        key={scanner.id}
                        className="border-0 hover:bg-[hsl(var(--button-highlight)/0.04)]"
                      >
                        <TableCell className="px-5 sm:px-7">
                          <div>
                            <div className="flex flex-wrap items-center gap-2">
                              <span className="text-base font-medium text-foreground">
                                {scanner.name}
                              </span>
                              <Badge
                                variant={
                                  scanner.role === "scanner_plus"
                                    ? "default"
                                    : "secondary"
                                }
                                className="rounded-full px-2.5 py-0.5 text-[0.68rem] font-medium shadow-none"
                              >
                                {scanner.role === "scanner_plus"
                                  ? "Plus"
                                  : "Operator"}
                              </Badge>
                            </div>
                            <span className="mt-1 block text-sm text-muted-foreground md:hidden">
                              {scanner.email}
                            </span>
                          </div>
                        </TableCell>
                        <TableCell className="hidden px-5 text-sm text-muted-foreground md:table-cell sm:px-7">
                          {scanner.email}
                        </TableCell>
                        <TableCell className="px-5 text-sm text-muted-foreground sm:px-7">
                          {getEventNames(scanner.assigned_events)}
                        </TableCell>
                        {canManageScanners && (
                          <TableCell className="min-w-[11.5rem] px-5 align-top sm:min-w-[13.5rem] sm:px-7 lg:min-w-[240px]">
                            <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
                              <Button
                                size="sm"
                                variant="outline"
                                className={`${actionButtonClassName} w-full whitespace-normal text-center leading-[1.15rem]`}
                                onClick={() => openScannerEditDialog(scanner)}
                              >
                                Edytuj
                              </Button>
                              <Button
                                size="sm"
                                variant="outline"
                                className={`${actionButtonClassName} w-full whitespace-normal text-center leading-[1.15rem]`}
                                onClick={() =>
                                  openScannerAssignmentsDialog(scanner.id)
                                }
                              >
                                Przypisz
                              </Button>
                            </div>
                          </TableCell>
                        )}
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </div>
        </CollapsibleOrganizationSection>
      </section>

      <section className="rounded-[1.9rem] border border-[hsl(var(--button-highlight)/0.3)] bg-[linear-gradient(180deg,hsl(var(--button-highlight)/0.12),hsl(var(--background)/0.82))] px-5 py-5 shadow-[inset_0_1px_0_hsl(var(--foreground)/0.04)] sm:px-6">
        <CollapsibleOrganizationSection title="Archiwum wydarzeĹ„">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="min-w-0">
              <div className="flex items-center gap-3">
                <div className="flex h-11 w-11 items-center justify-center rounded-[0.95rem] border border-[hsl(var(--button-highlight)/0.22)] bg-[hsl(var(--background)/0.48)]">
                  <Archive className="h-4 w-4 text-[hsl(var(--button-highlight))]" />
                </div>
                <p className="hidden text-sm text-muted-foreground">
                  Archiwum wydarzeń
                </p>
                <p className="text-sm text-muted-foreground">
                  Przegladaj zakonczone wydarzenia tej organizacji w osobnym
                  widoku.
                </p>
              </div>
            </div>
            <Button
              variant="outline"
              className="h-12 w-full rounded-[1rem] border-[hsl(var(--button-highlight)/0.38)] bg-transparent text-[hsl(var(--button-highlight))] hover:bg-[hsl(var(--button-highlight)/0.08)] hover:text-[hsl(var(--button-highlight))] sm:w-auto"
              onClick={() =>
                navigate(`/organizations/${organization.id}/archived-events`)
              }
            >
              Otwórz archiwum
            </Button>
          </div>
        </CollapsibleOrganizationSection>
      </section>

      <Dialog
        open={organizationEditOpen}
        onOpenChange={(open) => {
          setOrganizationEditOpen(open);
          if (!open) {
            setOrganizationErrors({});
            setLimitErrors({});
            setLimitDraft("");
          }
        }}
      >
        <DialogContent className="max-w-[calc(100vw-2rem)] sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Edytuj organizację</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="organization-edit-name">Nazwa organizacji</Label>
              <Input
                id="organization-edit-name"
                value={organizationNameDraft}
                onChange={(event) => {
                  setOrganizationNameDraft(event.target.value);
                  setOrganizationErrors((prev) => ({
                    ...prev,
                    name: undefined,
                    form: undefined,
                  }));
                }}
                className="mt-2"
                required
                aria-invalid={Boolean(organizationErrors.name)}
                aria-describedby={
                  organizationErrors.name
                    ? "organization-edit-name-error"
                    : undefined
                }
              />
              <FieldError id="organization-edit-name-error" className="mt-2">
                {organizationErrors.name}
              </FieldError>
            </div>
            <div>
              <Label htmlFor="organization-edit-limit">Limit wydarzen</Label>
              <Input
                id="organization-edit-limit"
                type="number"
                min={String(totalOrganizationEvents)}
                value={limitDraft || String(organization.event_limit)}
                onChange={(event) => {
                  setLimitDraft(event.target.value);
                  setLimitErrors((prev) => ({
                    ...prev,
                    event_limit: undefined,
                    form: undefined,
                  }));
                }}
                className="mt-2"
                required
                aria-invalid={Boolean(limitErrors.event_limit)}
                aria-describedby={
                  limitErrors.event_limit
                    ? "organization-edit-limit-error"
                    : undefined
                }
              />
              <FieldError id="organization-edit-limit-error" className="mt-2">
                {limitErrors.event_limit}
              </FieldError>
              <p className="mt-2 text-xs text-muted-foreground">
                Minimalny limit to {totalOrganizationEvents}, bo tyle wydarzen,
                lacznie z archiwalnymi, jest juz przypisanych.
              </p>
            </div>
            <FieldError id="organization-edit-form-error">
              {organizationErrors.form}
            </FieldError>
            <FieldError id="organization-edit-limit-form-error">
              {limitErrors.form}
            </FieldError>
          </div>
          <DialogFooter>
            <Button
              className="w-full sm:w-auto"
              onClick={handleSaveOrganization}
              disabled={isSavingOrganization}
            >
              Zapisz zmiany
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={limitDialogOpen}
        onOpenChange={(open) => {
          setLimitDialogOpen(open);
          if (!open) setLimitErrors({});
        }}
      >
        <DialogContent className="max-w-[calc(100vw-2rem)] sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Limit wydarzeń</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="organization-event-limit">
                Limit wydarzeń dla organizacji
              </Label>
              <Input
                id="organization-event-limit"
                type="number"
                min={String(totalOrganizationEvents)}
                value={limitDraft || String(organization.event_limit)}
                onChange={(event) => {
                  setLimitDraft(event.target.value);
                  setLimitErrors((prev) => ({
                    ...prev,
                    event_limit: undefined,
                    form: undefined,
                  }));
                }}
                className="mt-2"
                required
                aria-invalid={Boolean(limitErrors.event_limit)}
                aria-describedby={
                  limitErrors.event_limit
                    ? "organization-event-limit-error"
                    : undefined
                }
              />
              <FieldError id="organization-event-limit-error" className="mt-2">
                {limitErrors.event_limit}
              </FieldError>
            </div>
            <p className="text-xs text-muted-foreground">
              Minimalny dozwolony limit to {totalOrganizationEvents}, bo tyle
              wydarzeń, łącznie z archiwalnymi, jest już przypisanych do tej
              organizacji.
            </p>
            <FieldError id="organization-limit-form-error">
              {limitErrors.form}
            </FieldError>
          </div>
          <DialogFooter>
            <Button className="w-full sm:w-auto" onClick={handleSaveLimit}>
              Zapisz limit
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog
        open={deleteOrganizationConfirmOpen}
        onOpenChange={setDeleteOrganizationConfirmOpen}
      >
        <AlertDialogContent className="max-w-[calc(100vw-2rem)] sm:max-w-md">
          <AlertDialogHeader>
            <AlertDialogTitle>Usunąć organizację?</AlertDialogTitle>
            <AlertDialogDescription>
              Organizacja{" "}
              <span className="font-medium text-foreground">
                {organization.name}
              </span>{" "}
              zostanie usunięta tylko wtedy, gdy nie ma już przypisanych
              wydarzeń ani użytkowników. Tej operacji nie da się cofnąć.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Anuluj</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => void handleDeleteOrganization()}
              disabled={isDeletingOrganization || !canDeleteOrganization}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Usuń organizację
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog
        open={archiveUserConfirmOpen}
        onOpenChange={(open) => {
          setArchiveUserConfirmOpen(open);
          if (!open) {
            setSelectedActionUser(null);
          }
        }}
      >
        <AlertDialogContent className="max-w-[calc(100vw-2rem)] sm:max-w-md">
          <AlertDialogHeader>
            <AlertDialogTitle>Usunąć konto?</AlertDialogTitle>
            <AlertDialogDescription>
              Konto{" "}
              <span className="font-medium text-foreground">
                {selectedActionUser?.name}
              </span>{" "}
              zostanie usunięte z widoku organizacji. W backendzie konto
              zostanie zarchiwizowane, ta osoba nie zaloguje się już na stare
              konto, a ten email będzie można wykorzystać ponownie.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Anuluj</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => void handleArchiveUser()}
              disabled={isArchivingUser || !selectedActionUser}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Usuń konto
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog
        open={passwordResetConfirmOpen}
        onOpenChange={(open) => {
          setPasswordResetConfirmOpen(open);
          if (!open) {
            setSelectedActionUser(null);
          }
        }}
      >
        <AlertDialogContent className="max-w-[calc(100vw-2rem)] sm:max-w-md">
          <AlertDialogHeader>
            <AlertDialogTitle>Wysłać reset hasła?</AlertDialogTitle>
            <AlertDialogDescription>
              Do{" "}
              <span className="font-medium text-foreground">
                {selectedActionUser?.email}
              </span>{" "}
              zostanie wysłany email z linkiem do ustawienia nowego hasła dla
              konta{" "}
              <span className="font-medium text-foreground">
                {selectedActionUser?.name}
              </span>
              .
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Anuluj</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => void handleTriggerPasswordReset()}
              disabled={isSendingPasswordReset || !selectedActionUser}
            >
              Wyślij reset hasła
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Dialog
        open={scannerEditDialogOpen}
        onOpenChange={(open) => {
          setScannerEditDialogOpen(open);
          if (!open) {
            setSelectedScanner(null);
            setScannerErrors({});
          }
        }}
      >
        <DialogContent className="max-w-[calc(100vw-2rem)] sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Edytuj dane operatora</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="scanner-edit-name">Imię i nazwisko</Label>
              <Input
                id="scanner-edit-name"
                value={scannerDraft.name}
                onChange={(event) => {
                  setScannerDraft((prev) => ({
                    ...prev,
                    name: event.target.value,
                  }));
                  setScannerErrors((prev) => ({
                    ...prev,
                    name: undefined,
                    form: undefined,
                  }));
                }}
                className="mt-2"
                required
                aria-invalid={Boolean(scannerErrors.name)}
                aria-describedby={
                  scannerErrors.name ? "scanner-edit-name-error" : undefined
                }
              />
              <FieldError id="scanner-edit-name-error" className="mt-2">
                {scannerErrors.name}
              </FieldError>
            </div>
            <div>
              <Label htmlFor="scanner-edit-email">Email</Label>
              <Input
                id="scanner-edit-email"
                type="email"
                value={scannerDraft.email}
                onChange={(event) => {
                  setScannerDraft((prev) => ({
                    ...prev,
                    email: event.target.value,
                  }));
                  setScannerErrors((prev) => ({
                    ...prev,
                    email: undefined,
                    form: undefined,
                  }));
                }}
                className="mt-2"
                required
                aria-invalid={Boolean(scannerErrors.email)}
                aria-describedby={
                  scannerErrors.email ? "scanner-edit-email-error" : undefined
                }
              />
              <FieldError id="scanner-edit-email-error" className="mt-2">
                {scannerErrors.email}
              </FieldError>
            </div>
            <FieldError id="scanner-edit-form-error">
              {scannerErrors.form}
            </FieldError>
            {selectedScanner && canManageScanners && (
              <div className="rounded-xl border border-white/10 bg-white/[0.02] p-4">
                <div className="space-y-1">
                  <p className="text-sm font-medium">Rola operatora</p>
                  <p className="text-xs text-muted-foreground">
                    Aktualna rola: {getRoleLabel(selectedScanner.role)}
                  </p>
                </div>
                <Button
                  variant="outline"
                  className="mt-3 w-full sm:w-auto"
                  onClick={() =>
                    void handleChangeScannerRole(
                      selectedScanner,
                      selectedScanner.role === "scanner"
                        ? "scanner_plus"
                        : "scanner",
                    )
                  }
                  disabled={isChangingScannerRole || isSavingScanner}
                >
                  {selectedScanner.role === "scanner"
                    ? "Zmień na Operator Plus"
                    : "Zmień na Operator"}
                </Button>
              </div>
            )}
            {selectedScanner && canManageMemberAccounts && (
              <div className="rounded-xl border border-white/10 bg-white/[0.02] p-4">
                <div className="space-y-1">
                  <p className="text-sm font-medium">Konto operatora</p>
                  <p className="text-xs text-muted-foreground">
                    Reset hasła i usunięcie konta są dostępne w tym oknie.
                  </p>
                </div>
                <div className="mt-3 flex flex-col gap-2 sm:flex-row">
                  <Button
                    variant="outline"
                    className="w-full sm:w-auto"
                    onClick={() => openPasswordResetDialog(selectedScanner)}
                    disabled={isSavingScanner || isChangingScannerRole}
                  >
                    <KeyRound className="mr-1 h-4 w-4" />
                    Reset hasła
                  </Button>
                  <Button
                    variant="destructive"
                    className="w-full sm:w-auto"
                    onClick={() => openArchiveUserDialog(selectedScanner)}
                    disabled={isSavingScanner || isChangingScannerRole}
                  >
                    <Trash2 className="mr-1 h-4 w-4" />
                    Usuń konto
                  </Button>
                </div>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button
              className="w-full sm:w-auto"
              onClick={handleSaveScanner}
              disabled={
                isSavingScanner || isChangingScannerRole || !selectedScanner
              }
            >
              Zapisz zmiany
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={memberDialogOpen}
        onOpenChange={(open) => {
          setMemberDialogOpen(open);
          if (!open) setMemberErrors({});
        }}
      >
        <DialogContent className="max-w-[calc(100vw-2rem)] sm:max-w-md">
          <DialogHeader>
            <DialogTitle>
              {memberForm.role === "editor"
                ? "Dodaj organizatora"
                : `Dodaj ${getRoleLabel(memberForm.role).toLocaleLowerCase("pl-PL")}`}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="organization-member-name">Imię i nazwisko</Label>
              <Input
                id="organization-member-name"
                value={memberForm.name}
                onChange={(event) => {
                  setMemberForm((prev) => ({
                    ...prev,
                    name: event.target.value,
                  }));
                  setMemberErrors((prev) => ({
                    ...prev,
                    name: undefined,
                    form: undefined,
                  }));
                }}
                className="mt-2"
                required
                aria-invalid={Boolean(memberErrors.name)}
                aria-describedby={
                  memberErrors.name
                    ? "organization-member-name-error"
                    : undefined
                }
              />
              <FieldError id="organization-member-name-error" className="mt-2">
                {memberErrors.name}
              </FieldError>
            </div>
            <div>
              <Label htmlFor="organization-member-email">Email</Label>
              <Input
                id="organization-member-email"
                type="email"
                value={memberForm.email}
                onChange={(event) => {
                  setMemberForm((prev) => ({
                    ...prev,
                    email: event.target.value,
                  }));
                  setMemberErrors((prev) => ({
                    ...prev,
                    email: undefined,
                    form: undefined,
                  }));
                }}
                className="mt-2"
                required
                aria-invalid={Boolean(memberErrors.email)}
                aria-describedby={
                  memberErrors.email
                    ? "organization-member-email-error"
                    : undefined
                }
              />
              <FieldError id="organization-member-email-error" className="mt-2">
                {memberErrors.email}
              </FieldError>
            </div>
            <p className="rounded-xl border bg-muted/40 px-3 py-2 text-xs text-muted-foreground">
              Po zapisaniu konto zostanie utworzone, a użytkownik dostanie mail
              z linkiem do ustawienia hasła.
            </p>
            {isScannerRole(memberForm.role) &&
              assignableScannerEvents.length > 0 && (
                <div className="space-y-2">
                  <Label>Przypisane wydarzenia</Label>
                  <div className="space-y-2 rounded-xl border p-3">
                    {assignableScannerEvents.map((event) => (
                      <label
                        key={event.id}
                        className="flex items-center gap-3 text-sm"
                      >
                        <Checkbox
                          className="rounded-[2px]"
                          checked={memberForm.assigned_events.includes(
                            event.id,
                          )}
                          onCheckedChange={(checked) =>
                            toggleScannerEvent(event.id, checked === true)
                          }
                        />
                        <span>{event.name}</span>
                      </label>
                    ))}
                  </div>
                </div>
              )}
            {isScannerRole(memberForm.role) &&
              assignableScannerEvents.length === 0 && (
                <p className="rounded-xl border border-dashed px-3 py-3 text-xs text-muted-foreground">
                  Operatora można przypisać tylko do aktualnie otwartych lub
                  przyszłych wydarzeń.
                </p>
              )}
            <FieldError id="organization-member-form-error">
              {memberErrors.form}
            </FieldError>
          </div>
          <DialogFooter>
            <Button
              className="w-full sm:w-auto"
              onClick={handleAddMember}
              disabled={isSubmittingMember}
              aria-busy={isSubmittingMember}
            >
              {isSubmittingMember ? (
                <Loader2 className="mr-1 h-4 w-4 animate-spin" />
              ) : (
                <Plus className="mr-1 h-4 w-4" />
              )}
              {isSubmittingMember ? "Zapisywanie..." : "Zapisz"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={scannerAssignmentsDialogOpen}
        onOpenChange={setScannerAssignmentsDialogOpen}
      >
        <DialogContent className="max-w-[calc(100vw-2rem)] sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Przypisz wydarzenia operatorowi</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            {assignableScannerEvents.length > 0 ? (
              <div className="space-y-2 rounded-xl border p-3">
                {assignableScannerEvents.map((event) => (
                  <label
                    key={event.id}
                    className="flex items-center gap-3 text-sm"
                  >
                    <Checkbox
                      className="rounded-[2px]"
                      checked={scannerAssignmentDraft.includes(event.id)}
                      onCheckedChange={(checked) =>
                        toggleScannerAssignmentDraft(event.id, checked === true)
                      }
                    />
                    <span>{event.name}</span>
                  </label>
                ))}
              </div>
            ) : (
              <div className="rounded-xl border border-dashed px-4 py-6 text-center text-sm text-muted-foreground">
                Brak aktualnie otwartych lub przyszłych wydarzeń do przypisania.
              </div>
            )}
          </div>
          <DialogFooter>
            <Button
              className="w-full sm:w-auto"
              onClick={handleSaveScannerAssignments}
              disabled={isSavingScannerAssignments}
            >
              Zapisz przypisania
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={eventDialogOpen}
        onOpenChange={(open) => {
          setEventDialogOpen(open);
          if (!open) setEventErrors({});
        }}
      >
        <DialogContent className="max-w-[calc(100vw-2rem)] sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Dodaj wydarzenie</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="organization-event-name">Nazwa</Label>
              <Input
                id="organization-event-name"
                value={eventForm.name}
                onChange={(event) => {
                  setEventForm((prev) => ({
                    ...prev,
                    name: event.target.value,
                  }));
                  setEventErrors((prev) => ({
                    ...prev,
                    name: undefined,
                    form: undefined,
                  }));
                }}
                className="mt-2"
                required
                aria-invalid={Boolean(eventErrors.name)}
                aria-describedby={
                  eventErrors.name ? "organization-event-name-error" : undefined
                }
              />
              <FieldError id="organization-event-name-error" className="mt-2">
                {eventErrors.name}
              </FieldError>
            </div>
            <div>
              <Label htmlFor="organization-event-location">Lokalizacja</Label>
              <Input
                id="organization-event-location"
                value={eventForm.location}
                onChange={(event) => {
                  setEventForm((prev) => ({
                    ...prev,
                    location: event.target.value,
                  }));
                  setEventErrors((prev) => ({
                    ...prev,
                    location: undefined,
                    form: undefined,
                  }));
                }}
                className="mt-2"
                required
                aria-invalid={Boolean(eventErrors.location)}
                aria-describedby={
                  eventErrors.location
                    ? "organization-event-location-error"
                    : undefined
                }
              />
              <FieldError
                id="organization-event-location-error"
                className="mt-2"
              >
                {eventErrors.location}
              </FieldError>
            </div>
            <div>
              <Label htmlFor="organization-event-office-open">
                Data i godzina otwarcia biura zawodów
              </Label>
              <DateTimePicker
                id="organization-event-office-open"
                value={eventForm.office_open_at}
                onChange={(value) => {
                  setEventForm((prev) => ({
                    ...prev,
                    office_open_at: value,
                  }));
                  setEventErrors((prev) => ({
                    ...prev,
                    office_open_at: undefined,
                    office_close_at: undefined,
                    form: undefined,
                  }));
                }}
                className="mt-2"
                aria-invalid={Boolean(eventErrors.office_open_at)}
                aria-describedby={
                  eventErrors.office_open_at
                    ? "organization-event-office-open-error"
                    : undefined
                }
              />
              <FieldError
                id="organization-event-office-open-error"
                className="mt-2"
              >
                {eventErrors.office_open_at}
              </FieldError>
            </div>
            <div>
              <Label htmlFor="organization-event-office-close">
                Data i godzina zamknięcia biura zawodów
              </Label>
              <DateTimePicker
                id="organization-event-office-close"
                value={eventForm.office_close_at}
                onChange={(value) => {
                  setEventForm((prev) => ({
                    ...prev,
                    office_close_at: value,
                  }));
                  setEventErrors((prev) => ({
                    ...prev,
                    office_close_at: undefined,
                    form: undefined,
                  }));
                }}
                className="mt-2"
                aria-invalid={Boolean(eventErrors.office_close_at)}
                aria-describedby={
                  eventErrors.office_close_at
                    ? "organization-event-office-close-error"
                    : undefined
                }
              />
              <FieldError
                id="organization-event-office-close-error"
                className="mt-2"
              >
                {eventErrors.office_close_at}
              </FieldError>
            </div>
            <p className="text-xs text-muted-foreground">
              Limit organizacji: {totalOrganizationEvents}/
              {organization.event_limit} wydarzeń, łącznie z archiwalnymi.
            </p>
            <FieldError id="organization-event-form-error">
              {eventErrors.form}
            </FieldError>
          </div>
          <DialogFooter>
            <Button
              className="w-full sm:w-auto"
              onClick={handleAddEvent}
              disabled={remainingSlots <= 0 || isSubmittingEvent}
            >
              <Plus className="mr-1 h-4 w-4" />
              Zapisz
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function EmptyTableState({
  title,
  description,
}: {
  title: string;
  description: string;
}) {
  return (
    <Card className="border-[hsl(var(--button-highlight)/0.16)] bg-[linear-gradient(180deg,hsl(220_13%_9%/_0.92),hsl(220_14%_7%/_0.96))]">
      <CardContent className="py-10 text-center">
        <p className="text-base font-medium text-foreground">{title}</p>
        <p className="mt-2 text-sm text-muted-foreground">{description}</p>
      </CardContent>
    </Card>
  );
}
