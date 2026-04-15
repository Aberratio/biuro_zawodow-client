import React from "react";
import { useNavigate } from "react-router-dom";
import {
  Building2,
  CalendarDays,
  FileUp,
  Info,
  LayoutDashboard,
  LogOut,
  Mail,
  ScanLine,
  UserRound,
  Users,
} from "lucide-react";
import { NavLink } from "@/components/NavLink";
import { BrandWordmark } from "@/components/BrandWordmark";
import { useData } from "@/contexts/DataContext";
import { useAuth } from "@/contexts/AuthContext";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from "@/components/ui/sidebar";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { Role } from "@/types";
import { isEventOfficeOpen } from "@/lib/events";
import { isScannerRole } from "@/lib/roles";

const allItems = [
  {
    title: "Panel",
    url: "/",
    icon: LayoutDashboard,
    roles: ["editor", "admin", "superadmin"] as Role[],
  },
  {
    title: "Organizacje",
    url: "/organizations",
    icon: Building2,
    roles: ["admin", "superadmin"] as Role[],
  },
  {
    title: "Wydarzenia",
    url: "/events",
    icon: CalendarDays,
    roles: ["editor", "admin", "superadmin"] as Role[],
  },
  {
    title: "Uczestnicy",
    url: "/participants",
    icon: Users,
    roles: ["scanner", "scanner_plus", "editor", "admin", "superadmin"] as Role[],
  },
  {
    title: "Skaner QR",
    url: "/scanner",
    icon: ScanLine,
    roles: ["scanner", "scanner_plus", "editor", "admin", "superadmin"] as Role[],
  },
  {
    title: "Informacje",
    url: "/scanner-info",
    icon: Info,
    roles: ["scanner", "scanner_plus"] as Role[],
  },
  {
    title: "Import CSV",
    url: "/import",
    icon: FileUp,
    roles: ["editor", "admin", "superadmin"] as Role[],
  },
  {
    title: "Wysylka QR",
    url: "/emails",
    icon: Mail,
    roles: ["editor", "admin", "superadmin"] as Role[],
  },
];

const eventScopedUrls = new Set([
  "/participants",
  "/scanner",
  "/import",
  "/emails",
]);

export function AppSidebar() {
  const { state } = useSidebar();
  const collapsed = state === "collapsed";
  const navigate = useNavigate();
  const {
    currentRole,
    currentUser,
    organizations,
    visibleEvents,
    selectedOrganizationId,
    setSelectedOrganizationId,
    selectedEventId,
    setSelectedEventId,
  } = useData();
  const { logout } = useAuth();

  const handleLogout = () => {
    logout();
    navigate("/login", { replace: true });
  };

  const handleOrganizationChange = (organizationId: string) => {
    setSelectedOrganizationId(organizationId);
    navigate(`/organizations/${organizationId}`);
  };

  const handleEventChange = (eventId: string) => {
    setSelectedEventId(eventId);
    navigate(`/events/${eventId}`);
  };

  const scannerHasActiveEvents =
    !isScannerRole(currentRole) || visibleEvents.length > 0;
  const items = allItems.filter((item) => {
    if (!item.roles.includes(currentRole)) return false;
    if (!isScannerRole(currentRole)) return true;
    if (item.url === "/participants" || item.url === "/scanner") {
      return scannerHasActiveEvents;
    }
    if (item.url === "/scanner-info") return !scannerHasActiveEvents;
    return true;
  });

  const generalItems = items.filter((item) => !eventScopedUrls.has(item.url));
  const adminOrganizations =
    currentRole === "admin"
      ? organizations.filter((organization) =>
          (currentUser.organization_ids ?? []).includes(organization.id),
        )
      : [];
  const selectedOrganization =
    adminOrganizations.find(
      (organization) => organization.id === selectedOrganizationId,
    ) ?? null;
  const scopedVisibleEvents =
    currentRole === "admin"
      ? visibleEvents.filter(
          (event) => event.organization_id === selectedOrganizationId,
        )
      : visibleEvents;
  const selectedEvent =
    scopedVisibleEvents.find((event) => event.id === selectedEventId) ?? null;
  const selectedEventOfficeOpen =
    selectedEvent !== null && isEventOfficeOpen(selectedEvent);
  const eventScopedItems = items
    .filter((item) => eventScopedUrls.has(item.url))
    .filter((item) => item.url !== "/import" && item.url !== "/emails")
    .filter((item) => item.url !== "/scanner" || selectedEventOfficeOpen);
  const showOrganizationSelectControl = adminOrganizations.length > 1;
  const showEventSelectControl =
    scopedVisibleEvents.length > 1 || !isScannerRole(currentRole);
  const showEventWorkspace =
    !collapsed &&
    eventScopedItems.length > 0 &&
    (currentRole === "admin"
      ? adminOrganizations.length > 0
      : visibleEvents.length > 0);

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader className="border-b border-sidebar-border/70 px-3 pb-3 pt-4">
        {collapsed ? (
          <BrandWordmark compact className="mx-auto" />
        ) : (
          <BrandWordmark
            className="max-w-full"
            imageClassName="h-8 w-auto object-contain"
          />
        )}
      </SidebarHeader>

      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>
            {!collapsed && (
              <span className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.18em] text-sidebar-foreground/72">
                <ScanLine className="h-4 w-4 text-sidebar-primary" />
                Nawigacja
              </span>
            )}
            {collapsed && <ScanLine className="h-4 w-4 text-sidebar-primary" />}
          </SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {generalItems.map((item) => (
                <SidebarMenuItem key={item.url}>
                  <SidebarMenuButton asChild>
                    <NavLink
                      to={item.url}
                      end={item.url === "/"}
                      className="hover:bg-accent/50"
                      activeClassName="bg-accent font-medium text-accent-foreground"
                    >
                      <item.icon className="mr-2 h-4 w-4 shrink-0" />
                      {!collapsed && <span>{item.title}</span>}
                    </NavLink>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        {showEventWorkspace && (
          <SidebarGroup>
            <SidebarGroupLabel>
              <span className="text-[11px] font-bold uppercase tracking-[0.18em] text-sidebar-foreground/70">
                Praca na wydarzeniu
              </span>
            </SidebarGroupLabel>
            <SidebarGroupContent>
              <div className="mx-2 rounded-2xl border border-sidebar-border/70 bg-sidebar-accent/35 p-2">
                {currentRole === "admin" && (
                  <div className="rounded-xl border border-sidebar-border/60 bg-sidebar-accent/50 p-3">
                    <p className="text-[11px] uppercase tracking-[0.16em] text-sidebar-foreground/60">
                      Wybrana organizacja
                    </p>
                    {showOrganizationSelectControl ? (
                      <div className="mt-2">
                        <Select
                          value={selectedOrganizationId}
                          onValueChange={handleOrganizationChange}
                        >
                          <SelectTrigger className="h-10 border-sidebar-border bg-sidebar text-xs text-sidebar-foreground">
                            <SelectValue placeholder="Wybierz organizacje" />
                          </SelectTrigger>
                          <SelectContent>
                            {adminOrganizations.map((organization) => (
                              <SelectItem
                                key={organization.id}
                                value={organization.id}
                                className="text-xs"
                              >
                                {organization.name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    ) : selectedOrganization ? (
                      <div className="mt-2 rounded-xl bg-sidebar px-3 py-3">
                        <p className="text-sm font-medium leading-snug text-sidebar-foreground">
                          {selectedOrganization.name}
                        </p>
                      </div>
                    ) : (
                      <div className="mt-2 rounded-xl bg-sidebar px-3 py-3 text-xs text-sidebar-foreground/70">
                        Brak przypisanych organizacji w tym kontekscie.
                      </div>
                    )}
                  </div>
                )}

                <div
                  className={
                    currentRole === "admin"
                      ? "ml-3 mt-2 border-l border-sidebar-border/70 pl-3"
                      : "mt-2"
                  }
                >
                  <div className="rounded-xl border border-sidebar-border/60 bg-sidebar-accent/50 p-3">
                    <p className="text-[11px] uppercase tracking-[0.16em] text-sidebar-foreground/60">
                      Wybrane wydarzenie
                    </p>
                    {scopedVisibleEvents.length === 0 ? (
                      <div className="mt-2 rounded-xl bg-sidebar px-3 py-3 text-xs text-sidebar-foreground/70">
                        Do tej organizacji nie dodano jeszcze wydarzen. Dodaj je
                        w zakladce Wydarzenia.
                      </div>
                    ) : showEventSelectControl ? (
                      <div className="mt-2">
                        <Select
                          value={selectedEventId}
                          onValueChange={handleEventChange}
                        >
                          <SelectTrigger className="h-10 border-sidebar-border bg-sidebar text-xs text-sidebar-foreground">
                            <SelectValue placeholder="Wybierz wydarzenie" />
                          </SelectTrigger>
                          <SelectContent>
                            {scopedVisibleEvents.map((event) => (
                              <SelectItem
                                key={event.id}
                                value={event.id}
                                className="text-xs"
                              >
                                {event.name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    ) : selectedEvent ? (
                      <div className="mt-2 rounded-xl bg-sidebar px-3 py-3">
                        <p className="text-sm font-medium leading-snug text-sidebar-foreground">
                          {selectedEvent.name}
                        </p>
                      </div>
                    ) : (
                      <div className="mt-2 rounded-xl bg-sidebar px-3 py-3 text-xs text-sidebar-foreground/70">
                        Brak dostepnych wydarzen w tym kontekscie.
                      </div>
                    )}
                  </div>

                  {selectedEvent && (
                    <div className="mt-2 border-l border-sidebar-border/60 pl-3">
                      <SidebarMenu>
                        <SidebarMenuItem>
                          <SidebarMenuButton asChild>
                            <NavLink
                              to={`/events/${selectedEvent.id}`}
                              end
                              className="rounded-xl hover:bg-accent/60"
                              activeClassName="rounded-xl bg-sidebar-accent/80 font-medium text-sidebar-accent-foreground shadow-[inset_0_0_0_1px_hsl(var(--sidebar-primary)/0.14)]"
                            >
                              <CalendarDays className="mr-2 h-4 w-4 shrink-0" />
                              <span>Szczegoly</span>
                            </NavLink>
                          </SidebarMenuButton>
                        </SidebarMenuItem>
                        {eventScopedItems.map((item) => (
                          <SidebarMenuItem key={item.url}>
                            <SidebarMenuButton asChild>
                              <NavLink
                                to={
                                  item.url === "/import"
                                    ? `/events/${selectedEvent.id}/import`
                                    : item.url
                                }
                                end={item.url !== "/import"}
                                className="rounded-xl hover:bg-accent/60"
                                activeClassName="rounded-xl bg-sidebar-accent/80 font-medium text-sidebar-accent-foreground shadow-[inset_0_0_0_1px_hsl(var(--sidebar-primary)/0.14)]"
                              >
                                <item.icon className="mr-2 h-4 w-4 shrink-0" />
                                <span>{item.title}</span>
                              </NavLink>
                            </SidebarMenuButton>
                          </SidebarMenuItem>
                        ))}
                      </SidebarMenu>
                    </div>
                  )}
                </div>
              </div>
            </SidebarGroupContent>
          </SidebarGroup>
        )}
      </SidebarContent>

      <SidebarFooter className="p-3">
        {!collapsed ? (
          <div className="space-y-2">
            <Button
              variant="ghost"
              className="h-auto w-full justify-start rounded-[1.1rem] border border-sidebar-border/70 bg-sidebar-accent/25 px-3 py-2 shadow-[0_16px_34px_hsl(var(--surface-shadow)/0.3)] hover:bg-sidebar-accent/55"
              onClick={() => navigate("/profile")}
            >
              <div className="flex min-w-0 items-center gap-2 text-left">
                <UserRound className="h-3.5 w-3.5 shrink-0 text-sidebar-foreground/75" />
                <div className="min-w-0">
                  <p className="truncate text-xs font-medium text-sidebar-foreground">
                    {currentUser.name}
                  </p>
                </div>
              </div>
            </Button>
            <Button
              variant="ghost"
              className="h-9 w-full justify-start rounded-[1.1rem] border border-sidebar-border/70 bg-sidebar-accent/15 px-3 text-xs hover:bg-sidebar-accent/45"
              onClick={handleLogout}
            >
              <LogOut className="mr-2 h-4 w-4" />
              Wyloguj
            </Button>
          </div>
        ) : (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="mx-auto h-9 w-9 rounded-xl border border-sidebar-border/70 bg-sidebar-accent/20"
                title={currentUser.name}
              >
                <UserRound className="h-3.5 w-3.5" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" side="right" className="w-52">
              <DropdownMenuItem onClick={() => navigate("/profile")}>
                <UserRound className="mr-2 h-4 w-4" />
                Moj profil
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={handleLogout}>
                <LogOut className="mr-2 h-4 w-4" />
                Wyloguj
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        )}
      </SidebarFooter>
    </Sidebar>
  );
}
