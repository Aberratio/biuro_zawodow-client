import { useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useData } from "@/contexts/DataContext";
import { Button } from "@/components/ui/button";
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
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import TableSkeleton from "@/components/skeletons/TableSkeleton";
import { toast } from "@/hooks/use-toast";
import { formatEventOfficeWindow, isValidEventOfficeRange } from "@/lib/events";
import {
  validateEmail,
  validateNonNegativeInteger,
  validateRequired,
} from "@/lib/form-validation";
import {
  getRoleLabel,
  isScannerRole,
} from "@/lib/roles";
import type { User } from "@/types";
import {
  ArrowLeft,
  Archive,
  Building2,
  KeyRound,
  Pencil,
  Plus,
  Trash2,
} from "lucide-react";

type MemberRole = "editor" | "scanner" | "scanner_plus";

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
  const [deleteOrganizationConfirmOpen, setDeleteOrganizationConfirmOpen] =
    useState(false);
  const [archiveUserConfirmOpen, setArchiveUserConfirmOpen] = useState(false);
  const [passwordResetConfirmOpen, setPasswordResetConfirmOpen] =
    useState(false);
  const [isSubmittingMember, setIsSubmittingMember] = useState(false);
  const [isSubmittingEvent, setIsSubmittingEvent] = useState(false);
  const [isSavingOrganization, setIsSavingOrganization] = useState(false);
  const [isDeletingOrganization, setIsDeletingOrganization] = useState(false);
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
    if (currentRole === "admin")
      return (currentUser.organization_ids ?? []).includes(organization.id);
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
    organization.event_limit - orgEvents.length,
    0,
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
  const adminLabel =
    organization.admin_user_name ??
    users.find((user) => user.id === organization.admin_user_id)?.name ??
    "Brak administratora";

  const openMemberDialog = (role: MemberRole) => {
    setMemberForm({ role, name: "", email: "", assigned_events: [] });
    setMemberDialogOpen(true);
  };

  const openLimitDialog = () => {
    setLimitDraft(String(organization.event_limit));
    setLimitDialogOpen(true);
  };

  const openScannerAssignmentsDialog = (scannerId: string) => {
    const scanner = scanners.find((user) => user.id === scannerId);
    setSelectedScannerId(scannerId);
    setScannerAssignmentDraft(scanner?.assigned_events ?? []);
    setScannerAssignmentsDialogOpen(true);
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
      assigned_events:
        isScannerRole(memberForm.role) ? memberForm.assigned_events : [],
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
      setLimitErrors({ event_limit: limitError || "Podaj liczbę całkowitą większą lub równą 0." });
      toast({
        title: "Nieprawidłowy limit",
        description: "Podaj liczbę całkowitą większą lub równą 0.",
        variant: "destructive",
      });
      return;
    }
    if (parsed < orgEvents.length) {
      setLimitErrors({
        event_limit: `Limit wydarzeń nie może być mniejszy niż ${orgEvents.length}.`,
      });
      toast({
        title: "Nieprawidłowy limit",
        description: `Limit wydarzeń nie może być mniejszy niż ${orgEvents.length}.`,
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
    setLimitDraft("");
    setLimitErrors({});
    toast({ title: "Zaktualizowano limit wydarzeń" });
  };

  const handleSaveOrganization = async () => {
    const name = organizationNameDraft.trim();
    const nameError = validateRequired(name, "Podaj nazwę organizacji.");
    if (nameError) {
      setOrganizationErrors({ name: nameError });
      toast({ title: "Nazwa jest wymagana", variant: "destructive" });
      return;
    }
    setOrganizationErrors({});
    setIsSavingOrganization(true);
    const result = await updateOrganization(organization.id, { name });
    setIsSavingOrganization(false);
    if (!result.ok) {
      setOrganizationErrors({ form: result.error ?? "Nie udało się zaktualizować organizacji." });
      toast({
        title: "Nie udało się zaktualizować organizacji",
        description: result.error ?? "Spróbuj ponownie.",
        variant: "destructive",
      });
      return;
    }
    setOrganizationEditOpen(false);
    setOrganizationErrors({});
    toast({ title: "Zaktualizowano organizację" });
  };

  const handleAddEvent = async () => {
    const nextErrors = {
      name: validateRequired(eventForm.name, "Podaj nazwę wydarzenia."),
      location: validateRequired(eventForm.location, "Podaj lokalizację wydarzenia."),
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
      setEventErrors({ form: result.error ?? "Nie udało się utworzyć wydarzenia." });
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
      scannerAssignmentDraft,
    );
    setIsSavingScannerAssignments(false);
    if (!result.ok) {
      toast({
        title: "Nie udało się zapisać przypisań skanera",
        description: result.error ?? "Spróbuj ponownie.",
        variant: "destructive",
      });
      return;
    }
    setScannerAssignmentsDialogOpen(false);
    toast({ title: "Zapisano przypisania skanera" });
  };

  const handleChangeScannerRole = async (scanner: User, role: "scanner" | "scanner_plus") => {
    const result = await changeRole(scanner.id, role);
    if (!result.ok) {
      toast({
        title: "Nie udało się zmienić uprawnień skanera",
        description: result.error ?? "Spróbuj ponownie.",
        variant: "destructive",
      });
      return;
    }

    toast({
      title: role === "scanner" ? "Skaner ma ograniczone uprawnienia" : "Skaner ma rozszerzone uprawnienia",
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
    toast({
      title:
        archivedUser.role === "editor"
          ? "Usunięto organizatora"
          : "Usunięto skanera",
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
    <div className="space-y-6">
      <Button
        variant="ghost"
        size="sm"
        onClick={() => navigate("/organizations")}
        className="w-fit touch-manipulation"
      >
        <ArrowLeft className="mr-1 h-4 w-4" />
        Wróć do organizacji
      </Button>

      <div className="space-y-2">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
          <div className="min-w-0">
            <div className="flex items-center gap-3">
              <div className="rounded-2xl bg-primary/10 p-3">
                <Building2 className="h-5 w-5 text-primary" />
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <h1 className="truncate text-xl font-bold tracking-tight sm:text-2xl">
                    {organization.name}
                  </h1>
                  {canEditOrganization && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 shrink-0 rounded-lg text-muted-foreground hover:text-foreground"
                      onClick={() => {
                        setOrganizationNameDraft(organization.name);
                        setOrganizationEditOpen(true);
                      }}
                      aria-label="Edytuj organizację"
                    >
                      <Pencil className="h-4 w-4" />
                    </Button>
                  )}
                </div>
                <p className="mt-1 text-sm text-muted-foreground">
                  Szczegóły organizacji i zespołu.
                </p>
              </div>
            </div>
          </div>
          {canEditOrganization && (
            <div className="flex flex-col gap-2 sm:flex-row">
              {canDeleteOrganization && (
                <Button
                  variant="destructive"
                  className="w-full sm:w-auto"
                  onClick={() => setDeleteOrganizationConfirmOpen(true)}
                >
                  <Trash2 className="mr-1 h-4 w-4" />
                  Usuń organizację
                </Button>
              )}
            </div>
          )}
        </div>
      </div>

      <Card>
        <CardContent className="flex flex-col gap-3 p-4 text-sm sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
          <div>
            <span className="text-muted-foreground">Wydarzenia</span>
            <span className="ml-2 font-medium">{orgEvents.length}/{organization.event_limit}</span>
          </div>
          <div>
            <span className="text-muted-foreground">Organizatorzy</span>
            <span className="ml-2 font-medium">{organizers.length}</span>
          </div>
          <div>
            <span className="text-muted-foreground">Skanerzy</span>
            <span className="ml-2 font-medium">{scanners.length}</span>
          </div>
          <div className="min-w-0">
            <span className="text-muted-foreground">Administrator</span>
            <span className="ml-2 font-medium">{adminLabel}</span>
          </div>
          {canEditOrganization && (
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="h-8 w-8 rounded-lg text-muted-foreground hover:text-foreground"
              onClick={openLimitDialog}
              aria-label="Edytuj limit wydarzeń"
            >
              <Pencil className="h-4 w-4" />
            </Button>
          )}
        </CardContent>
      </Card>

      <section className="space-y-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h2 className="text-lg font-semibold tracking-tight">Wydarzenia</h2>
          </div>
          {canCreateEvent && (
            <Button
              onClick={() => setEventDialogOpen(true)}
              className="h-11 w-full sm:h-10 sm:w-auto"
              disabled={remainingSlots <= 0}
            >
              <Plus className="mr-1 h-4 w-4" />
              Dodaj wydarzenie
            </Button>
          )}
        </div>
        {orgEvents.length === 0 ? (
          <EmptyTableState
            title="Brak wydarzeń"
            description="Po dodaniu wydarzeń pojawi się tutaj ich lista."
          />
        ) : (
          <>
            <div className="rounded-lg border overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Wydarzenie</TableHead>
                    <TableHead className="hidden md:table-cell">
                      Lokalizacja
                    </TableHead>
                    <TableHead>Biuro</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {orgEvents.map((event) => (
                    <TableRow
                      key={event.id}
                      className="cursor-pointer active:bg-accent/50 [&>td]:py-3"
                      onClick={() => navigate(`/events/${event.id}`)}
                      onKeyDown={(keyboardEvent) => {
                        if (
                          keyboardEvent.key === "Enter" ||
                          keyboardEvent.key === " "
                        ) {
                          keyboardEvent.preventDefault();
                          navigate(`/events/${event.id}`);
                        }
                      }}
                      tabIndex={0}
                      aria-label={`Otwórz wydarzenie ${event.name}`}
                    >
                      <TableCell>
                        <div>
                          <span className="font-medium text-sm">
                            {event.name}
                          </span>
                          <span className="block text-xs text-muted-foreground md:hidden">
                            {event.location}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell className="hidden text-sm text-muted-foreground md:table-cell">
                        {event.location}
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {formatEventOfficeWindow(event)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </>
        )}
      </section>

      <section className="space-y-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h2 className="text-lg font-semibold tracking-tight">
              Organizatorzy
            </h2>
          </div>
          {canManageMembers && (
            <Button
              onClick={() => openMemberDialog("editor")}
              className="h-11 w-full sm:h-10 sm:w-auto"
            >
              <Plus className="mr-1 h-4 w-4" />
              Dodaj organizatora
            </Button>
          )}
        </div>
        {organizers.length === 0 ? (
          <EmptyTableState
            title="Brak organizatorów"
            description="Po dodaniu organizatorów pojawi się tutaj ich lista."
          />
        ) : (
          <>
            <div className="rounded-lg border overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Imię i nazwisko</TableHead>
                    <TableHead>Email</TableHead>
                    {canManageMemberAccounts && (
                      <TableHead className="w-[250px]">Akcje</TableHead>
                    )}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {organizers.map((organizer) => (
                    <TableRow key={organizer.id}>
                      <TableCell className="font-medium text-sm">
                        {organizer.name}
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {organizer.email}
                      </TableCell>
                      {canManageMemberAccounts && (
                        <TableCell>
                          <div className="flex flex-col gap-2 sm:flex-row">
                            <Button
                              size="sm"
                              variant="outline"
                              className="h-8 w-full rounded-lg px-2.5 text-xs sm:w-auto"
                              onClick={() => openPasswordResetDialog(organizer)}
                            >
                              <KeyRound className="mr-1 h-3.5 w-3.5" />
                              Reset hasła
                            </Button>
                            <Button
                              size="sm"
                              variant="destructive"
                              className="h-8 w-full rounded-lg px-2.5 text-xs sm:w-auto"
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
          </>
        )}
      </section>

      <section className="space-y-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h2 className="text-lg font-semibold tracking-tight">Skanerzy</h2>
          </div>
          {canManageScanners && (
            <div className="flex flex-col gap-2 sm:flex-row">
              <Button
                onClick={() => openMemberDialog("scanner")}
                className="h-11 w-full sm:h-10 sm:w-auto"
              >
                <Plus className="mr-1 h-4 w-4" />
                Dodaj skanera
              </Button>
              <Button
                variant="outline"
                onClick={() => openMemberDialog("scanner_plus")}
                className="h-11 w-full sm:h-10 sm:w-auto"
              >
                <Plus className="mr-1 h-4 w-4" />
                Dodaj skanera plus
              </Button>
            </div>
          )}
        </div>
        {scanners.length === 0 ? (
          <EmptyTableState
            title="Brak skanerów"
            description="Po dodaniu skanerów pojawi się tutaj ich lista."
          />
        ) : (
          <>
            <div className="rounded-lg border overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Imię i nazwisko</TableHead>
                    <TableHead className="hidden md:table-cell">
                      Email
                    </TableHead>
                    <TableHead>Przypisane wydarzenia</TableHead>
                    {canManageScanners && (
                      <TableHead className="w-[300px]">Akcje</TableHead>
                    )}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {scanners.map((scanner) => (
                    <TableRow key={scanner.id}>
                      <TableCell>
                        <div>
                          <span className="font-medium text-sm">
                            {scanner.name}
                          </span>
                          <span className="block text-xs text-muted-foreground md:hidden">
                            {scanner.email}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell className="hidden text-sm text-muted-foreground md:table-cell">
                        {scanner.email}
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {getEventNames(scanner.assigned_events)}
                      </TableCell>
                      {canManageScanners && (
                        <TableCell>
                          <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
                            <Button
                              size="sm"
                              variant="outline"
                              className="h-8 w-full rounded-lg px-2.5 text-xs sm:w-auto"
                              onClick={() =>
                                openScannerAssignmentsDialog(scanner.id)
                              }
                            >
                              Przypisz wydarzenia
                            </Button>
                            {scanner.role === "scanner_plus" && (
                              <Button
                                size="sm"
                                variant="outline"
                                className="h-8 w-full rounded-lg px-2.5 text-xs sm:w-auto"
                                onClick={() => void handleChangeScannerRole(scanner, "scanner")}
                              >
                                Zmień na zwykły skaner
                              </Button>
                            )}
                            {canManageMemberAccounts && (
                              <>
                                <Button
                                  size="sm"
                                  variant="outline"
                                  className="h-8 w-full rounded-lg px-2.5 text-xs sm:w-auto"
                                  onClick={() =>
                                    openPasswordResetDialog(scanner)
                                  }
                                >
                                  <KeyRound className="mr-1 h-3.5 w-3.5" />
                                  Reset hasła
                                </Button>
                                <Button
                                  size="sm"
                                  variant="destructive"
                                  className="h-8 w-full rounded-lg px-2.5 text-xs sm:w-auto"
                                  onClick={() => openArchiveUserDialog(scanner)}
                                >
                                  <Trash2 className="mr-1 h-3.5 w-3.5" />
                                  Usuń
                                </Button>
                              </>
                            )}
                          </div>
                        </TableCell>
                      )}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </>
        )}
      </section>

      <section className="rounded-xl border border-dashed px-4 py-5 sm:px-5">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <Archive className="h-4 w-4 text-muted-foreground" />
              <h2 className="text-base font-semibold tracking-tight">
                Archiwum wydarzeń
              </h2>
            </div>
          </div>
          <Button
            variant="outline"
            className="h-11 w-full sm:h-10 sm:w-auto"
            onClick={() => navigate(`/organizations/${organization.id}/archived-events`)}
          >
            Otwórz archiwum
          </Button>
        </div>
      </section>

      <Dialog
        open={organizationEditOpen}
        onOpenChange={(open) => {
          setOrganizationEditOpen(open);
          if (!open) setOrganizationErrors({});
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
            <FieldError id="organization-edit-form-error">
              {organizationErrors.form}
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
                min={String(orgEvents.length)}
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
              Minimalny dozwolony limit to {orgEvents.length}, bo tyle wydarzeń
              jest już przypisanych do tej organizacji.
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
            {isScannerRole(memberForm.role) && orgEvents.length > 0 && (
              <div className="space-y-2">
                <Label>Przypisane wydarzenia</Label>
                <div className="space-y-2 rounded-xl border p-3">
                  {orgEvents.map((event) => (
                    <label
                      key={event.id}
                      className="flex items-center gap-3 text-sm"
                    >
                      <Checkbox
                        checked={memberForm.assigned_events.includes(event.id)}
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
            <FieldError id="organization-member-form-error">
              {memberErrors.form}
            </FieldError>
          </div>
          <DialogFooter>
            <Button
              className="w-full sm:w-auto"
              onClick={handleAddMember}
              disabled={isSubmittingMember}
            >
              <Plus className="mr-1 h-4 w-4" />
              Zapisz
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
            <DialogTitle>Przypisz wydarzenia skanerowi</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            {orgEvents.length > 0 ? (
              <div className="space-y-2 rounded-xl border p-3">
                {orgEvents.map((event) => (
                  <label
                    key={event.id}
                    className="flex items-center gap-3 text-sm"
                  >
                    <Checkbox
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
                Najpierw dodaj wydarzenia do tej organizacji.
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
              Limit organizacji: {orgEvents.length}/{organization.event_limit}{" "}
              wydarzeń.
            </p>
            <FieldError id="organization-event-form-error">
              {eventErrors.form}
            </FieldError>
          </div>
          <DialogFooter>
            <Button
              className="w-full sm:w-auto"
              onClick={handleAddEvent}
              disabled={
                remainingSlots <= 0 ||
                isSubmittingEvent
              }
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
    <Card className="border-dashed">
      <CardContent className="py-8 text-center">
        <p className="text-sm font-medium text-muted-foreground">{title}</p>
        <p className="mt-1 text-xs text-muted-foreground/70">{description}</p>
      </CardContent>
    </Card>
  );
}
