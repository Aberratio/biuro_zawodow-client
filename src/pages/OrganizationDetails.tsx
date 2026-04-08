import { useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useData } from "@/contexts/DataContext";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
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
  ArrowLeft,
  Building2,
  CalendarDays,
  Pencil,
  Plus,
  Radio,
  Trash2,
  Users,
} from "lucide-react";

type MemberRole = "editor" | "scanner";

export default function OrganizationDetails() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const {
    organizations,
    events,
    users,
    currentRole,
    currentUser,
    addUser,
    createEvent,
    updateOrganization,
    updateOrganizationEventLimit,
    deleteOrganization,
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
  const [isSubmittingMember, setIsSubmittingMember] = useState(false);
  const [isSubmittingEvent, setIsSubmittingEvent] = useState(false);
  const [isSavingOrganization, setIsSavingOrganization] = useState(false);
  const [isDeletingOrganization, setIsDeletingOrganization] = useState(false);
  const [isSavingScannerAssignments, setIsSavingScannerAssignments] =
    useState(false);
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
        .filter((event) => event.organization_id === organization?.id)
        .sort((a, b) => a.name.localeCompare(b.name, "pl")),
    [events, organization?.id],
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
            user.role === "scanner",
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
  const canCreateEvent = currentRole !== "scanner";
  const canEditOrganization =
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

  const validateEmail = (email: string) =>
    /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);

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
      .filter((event) => eventIds.includes(event.id))
      .map((event) => event.name);
    return names.length > 0 ? names.join(", ") : "Brak przypisanych wydarzen";
  };

  const handleAddMember = async () => {
    if (!validateEmail(memberForm.email)) {
      toast({
        title: "Nieprawidlowy email",
        description: "Podaj poprawny adres email.",
        variant: "destructive",
      });
      return;
    }

    setIsSubmittingMember(true);
    const result = await addUser({
      name: memberForm.name,
      email: memberForm.email,
      role: memberForm.role,
      organization_id: organization.id,
      assigned_events:
        memberForm.role === "scanner" ? memberForm.assigned_events : [],
    });
    setIsSubmittingMember(false);

    if (!result.ok) {
      toast({
        title: "Nie udalo sie dodac konta",
        description: result.error ?? "Sprobuj ponownie.",
        variant: "destructive",
      });
      return;
    }

    setMemberDialogOpen(false);
    toast({
      title:
        memberForm.role === "editor" ? "Dodano organizatora" : "Dodano skanera",
      description: "Uzytkownik otrzyma mail z linkiem do ustawienia hasla.",
    });
  };

  const handleSaveLimit = async () => {
    const parsed = Number(limitDraft || organization.event_limit);
    if (!Number.isInteger(parsed) || parsed < 0) {
      toast({
        title: "Nieprawidlowy limit",
        description: "Podaj liczbe calkowita wieksza lub rowna 0.",
        variant: "destructive",
      });
      return;
    }
    if (parsed < orgEvents.length) {
      toast({
        title: "Nieprawidlowy limit",
        description: `Limit wydarzen nie moze byc mniejszy niz ${orgEvents.length}.`,
        variant: "destructive",
      });
      return;
    }
    const result = await updateOrganizationEventLimit(organization.id, parsed);
    if (!result.ok) {
      toast({
        title: "Nie udalo sie zapisac limitu",
        description: result.error ?? "Sprobuj ponownie.",
        variant: "destructive",
      });
      return;
    }
    setLimitDialogOpen(false);
    setLimitDraft("");
    toast({ title: "Zaktualizowano limit wydarzen" });
  };

  const handleSaveOrganization = async () => {
    const name = organizationNameDraft.trim();
    if (!name) {
      toast({ title: "Nazwa jest wymagana", variant: "destructive" });
      return;
    }
    setIsSavingOrganization(true);
    const result = await updateOrganization(organization.id, { name });
    setIsSavingOrganization(false);
    if (!result.ok) {
      toast({
        title: "Nie udalo sie zaktualizowac organizacji",
        description: result.error ?? "Sprobuj ponownie.",
        variant: "destructive",
      });
      return;
    }
    setOrganizationEditOpen(false);
    toast({ title: "Zaktualizowano organizacje" });
  };

  const handleAddEvent = async () => {
    if (!eventForm.name || !eventForm.location) return;
    if (
      !eventForm.office_open_at ||
      !eventForm.office_close_at ||
      !isValidEventOfficeRange(
        eventForm.office_open_at,
        eventForm.office_close_at,
      )
    ) {
      toast({
        title: "Nieprawidlowe godziny biura",
        description: "Podaj poprawny czas otwarcia i zamkniecia biura zawodow.",
        variant: "destructive",
      });
      return;
    }
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
      toast({
        title: "Nie udalo sie utworzyc wydarzenia",
        description: result.error ?? "Sprobuj ponownie.",
        variant: "destructive",
      });
      return;
    }
    setEventDialogOpen(false);
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
        title: "Nie udalo sie zapisac przypisan skanera",
        description: result.error ?? "Sprobuj ponownie.",
        variant: "destructive",
      });
      return;
    }
    setScannerAssignmentsDialogOpen(false);
    toast({ title: "Zapisano przypisania skanera" });
  };

  const handleDeleteOrganization = async () => {
    setIsDeletingOrganization(true);
    const result = await deleteOrganization(organization.id);
    setIsDeletingOrganization(false);
    if (!result.ok) {
      toast({
        title: "Nie udalo sie usunac organizacji",
        description:
          result.error ??
          "Usun najpierw wydarzenia i uzytkownikow przypisanych do organizacji.",
        variant: "destructive",
      });
      return;
    }
    setDeleteOrganizationConfirmOpen(false);
    toast({ title: "Organizacja usunieta" });
    navigate("/organizations");
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
        Wroc do organizacji
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
                      aria-label="Edytuj organizacje"
                    >
                      <Pencil className="h-4 w-4" />
                    </Button>
                  )}
                </div>
                <p className="mt-1 text-sm text-muted-foreground">
                  Administrator: {adminLabel}
                </p>
              </div>
            </div>
          </div>
          {canEditOrganization && (
            <div className="flex flex-col gap-2 sm:flex-row">
              <Button
                variant="destructive"
                className="w-full sm:w-auto"
                onClick={() => setDeleteOrganizationConfirmOpen(true)}
                disabled={!canDeleteOrganization}
              >
                <Trash2 className="mr-1 h-4 w-4" />
                Usun organizacje
              </Button>
            </div>
          )}
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <SummaryStat
          icon={<CalendarDays className="h-4 w-4 text-primary" />}
          label="Wydarzenia"
          value={`${orgEvents.length}/${organization.event_limit}`}
          hint={`${remainingSlots} wolnych miejsc`}
          action={
            canEditOrganization ? (
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="h-8 w-8 rounded-lg text-muted-foreground hover:text-foreground"
                onClick={openLimitDialog}
                aria-label="Edytuj limit wydarzen"
              >
                <Pencil className="h-4 w-4" />
              </Button>
            ) : undefined
          }
        />
        <SummaryStat
          icon={<Users className="h-4 w-4 text-primary" />}
          label="Organizatorzy"
          value={String(organizers.length)}
          hint="Konta organizatorow"
        />
        <SummaryStat
          icon={<Radio className="h-4 w-4 text-primary" />}
          label="Skanerzy"
          value={String(scanners.length)}
          hint="Konta skanerow"
        />
        <SummaryStat
          icon={<Building2 className="h-4 w-4 text-primary" />}
          label="Administrator"
          value={adminLabel}
          hint="Osoba odpowiedzialna za organizacje"
        />
      </div>

      <section className="space-y-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h2 className="text-lg font-semibold tracking-tight">Wydarzenia</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Wszystkie wydarzenia przypisane do tej organizacji. Kliknij
              wiersz, aby otworzyc szczegoly.
            </p>
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
            title="Brak wydarzen"
            description="Po dodaniu wydarzen pojawia sie tutaj ich lista."
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
                      aria-label={`Otworz wydarzenie ${event.name}`}
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
            <p className="text-xs text-muted-foreground">
              {orgEvents.length} wydarzen
            </p>
          </>
        )}
      </section>

      <section className="space-y-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h2 className="text-lg font-semibold tracking-tight">
              Organizatorzy
            </h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Osoby, ktore zarzadzaja wydarzeniami tej organizacji.
            </p>
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
            title="Brak organizatorow"
            description="Po dodaniu organizatorow pojawia sie tutaj ich lista."
          />
        ) : (
          <>
            <div className="rounded-lg border overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Imie i nazwisko</TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead className="w-[140px]">Rola</TableHead>
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
                      <TableCell>
                        <Badge variant="secondary" className="text-[10px]">
                          Organizator
                        </Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
            <p className="text-xs text-muted-foreground">
              {organizers.length} organizatorow
            </p>
          </>
        )}
      </section>

      <section className="space-y-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h2 className="text-lg font-semibold tracking-tight">Skanerzy</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Osoby, ktore pracuja na skanerze i maja przypisane wydarzenia.
            </p>
          </div>
          {canManageScanners && (
            <Button
              onClick={() => openMemberDialog("scanner")}
              className="h-11 w-full sm:h-10 sm:w-auto"
            >
              <Plus className="mr-1 h-4 w-4" />
              Dodaj skanera
            </Button>
          )}
        </div>
        {scanners.length === 0 ? (
          <EmptyTableState
            title="Brak skanerow"
            description="Po dodaniu skanerow pojawia sie tutaj ich lista."
          />
        ) : (
          <>
            <div className="rounded-lg border overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Imie i nazwisko</TableHead>
                    <TableHead className="hidden md:table-cell">
                      Email
                    </TableHead>
                    <TableHead>Przypisane wydarzenia</TableHead>
                    <TableHead className="w-[180px]">Akcja</TableHead>
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
                      <TableCell>
                        {canManageScanners ? (
                          <Button
                            size="sm"
                            variant="outline"
                            className="w-full"
                            onClick={() =>
                              openScannerAssignmentsDialog(scanner.id)
                            }
                          >
                            Przypisz wydarzenia
                          </Button>
                        ) : (
                          <span className="text-xs text-muted-foreground">
                            Podglad
                          </span>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
            <p className="text-xs text-muted-foreground">
              {scanners.length} skanerow
            </p>
          </>
        )}
      </section>

      <Dialog
        open={organizationEditOpen}
        onOpenChange={setOrganizationEditOpen}
      >
        <DialogContent className="max-w-[calc(100vw-2rem)] sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Edytuj organizacje</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Nazwa organizacji</Label>
              <Input
                value={organizationNameDraft}
                onChange={(event) =>
                  setOrganizationNameDraft(event.target.value)
                }
                className="mt-2"
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              className="w-full sm:w-auto"
              onClick={handleSaveOrganization}
              disabled={!organizationNameDraft.trim() || isSavingOrganization}
            >
              Zapisz zmiany
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={limitDialogOpen} onOpenChange={setLimitDialogOpen}>
        <DialogContent className="max-w-[calc(100vw-2rem)] sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Limit wydarzen</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Limit wydarzen dla organizacji</Label>
              <Input
                type="number"
                min={String(orgEvents.length)}
                value={limitDraft || String(organization.event_limit)}
                onChange={(event) => setLimitDraft(event.target.value)}
                className="mt-2"
              />
            </div>
            <p className="text-xs text-muted-foreground">
              Minimalny dozwolony limit to {orgEvents.length}, bo tyle wydarzen
              jest juz przypisanych do tej organizacji.
            </p>
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
            <AlertDialogTitle>Usunac organizacje?</AlertDialogTitle>
            <AlertDialogDescription>
              Organizacja{" "}
              <span className="font-medium text-foreground">
                {organization.name}
              </span>{" "}
              zostanie usunieta tylko wtedy, gdy nie ma juz przypisanych
              wydarzen ani uzytkownikow. Tej operacji nie da sie cofnac.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Anuluj</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => void handleDeleteOrganization()}
              disabled={isDeletingOrganization || !canDeleteOrganization}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Usun organizacje
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Dialog open={memberDialogOpen} onOpenChange={setMemberDialogOpen}>
        <DialogContent className="max-w-[calc(100vw-2rem)] sm:max-w-md">
          <DialogHeader>
            <DialogTitle>
              {memberForm.role === "editor"
                ? "Dodaj organizatora"
                : "Dodaj skanera"}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Imie i nazwisko</Label>
              <Input
                value={memberForm.name}
                onChange={(event) =>
                  setMemberForm((prev) => ({
                    ...prev,
                    name: event.target.value,
                  }))
                }
                className="mt-2"
              />
            </div>
            <div>
              <Label>Email</Label>
              <Input
                value={memberForm.email}
                onChange={(event) =>
                  setMemberForm((prev) => ({
                    ...prev,
                    email: event.target.value,
                  }))
                }
                className="mt-2"
              />
            </div>
            <p className="rounded-xl border bg-muted/40 px-3 py-2 text-xs text-muted-foreground">
              Po zapisaniu konto zostanie utworzone, a uzytkownik dostanie mail
              z linkiem do ustawienia hasla.
            </p>
            {memberForm.role === "scanner" && orgEvents.length > 0 && (
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
          </div>
          <DialogFooter>
            <Button
              className="w-full sm:w-auto"
              onClick={handleAddMember}
              disabled={
                !memberForm.name || !memberForm.email || isSubmittingMember
              }
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

      <Dialog open={eventDialogOpen} onOpenChange={setEventDialogOpen}>
        <DialogContent className="max-w-[calc(100vw-2rem)] sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Dodaj wydarzenie</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Nazwa</Label>
              <Input
                value={eventForm.name}
                onChange={(event) =>
                  setEventForm((prev) => ({
                    ...prev,
                    name: event.target.value,
                  }))
                }
                className="mt-2"
              />
            </div>
            <div>
              <Label>Lokalizacja</Label>
              <Input
                value={eventForm.location}
                onChange={(event) =>
                  setEventForm((prev) => ({
                    ...prev,
                    location: event.target.value,
                  }))
                }
                className="mt-2"
              />
            </div>
            <div>
              <Label>Data i godzina otwarcia biura zawodow</Label>
              <Input
                type="datetime-local"
                value={eventForm.office_open_at}
                onChange={(event) =>
                  setEventForm((prev) => ({
                    ...prev,
                    office_open_at: event.target.value,
                  }))
                }
                className="mt-2"
              />
            </div>
            <div>
              <Label>Data i godzina zamkniecia biura zawodow</Label>
              <Input
                type="datetime-local"
                value={eventForm.office_close_at}
                onChange={(event) =>
                  setEventForm((prev) => ({
                    ...prev,
                    office_close_at: event.target.value,
                  }))
                }
                className="mt-2"
              />
            </div>
            <p className="text-xs text-muted-foreground">
              Limit organizacji: {orgEvents.length}/{organization.event_limit}{" "}
              wydarzen.
            </p>
          </div>
          <DialogFooter>
            <Button
              className="w-full sm:w-auto"
              onClick={handleAddEvent}
              disabled={
                !eventForm.name ||
                !eventForm.location ||
                !eventForm.office_open_at ||
                !eventForm.office_close_at ||
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

function SummaryStat({
  icon,
  label,
  value,
  hint,
  action,
}: {
  icon: JSX.Element;
  label: string;
  value: string;
  hint: string;
  action?: JSX.Element;
}) {
  return (
    <Card className="border-border/70 shadow-sm">
      <CardContent className="flex items-start justify-between gap-3 p-5">
        <div className="flex min-w-0 items-start gap-3">
          <div className="rounded-xl bg-primary/10 p-2.5">{icon}</div>
          <div className="min-w-0">
            <p className="text-xs uppercase tracking-[0.16em] text-muted-foreground">
              {label}
            </p>
            <p className="mt-2 truncate text-lg font-semibold">{value}</p>
            <p className="mt-1 text-xs text-muted-foreground">{hint}</p>
          </div>
        </div>
        {action ? <div className="shrink-0">{action}</div> : null}
      </CardContent>
    </Card>
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
