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
  X,
} from "lucide-react";
import { NavLink } from "@/components/NavLink";
import { BrandLogo } from "@/components/BrandLogo";
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
    title: "Organizacja",
    url: "/organization",
    icon: Building2,
    roles: ["editor"] as Role[],
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
    roles: [
      "scanner",
      "scanner_plus",
      "editor",
      "admin",
      "superadmin",
    ] as Role[],
  },
  {
    title: "Skaner QR",
    url: "/scanner",
    icon: ScanLine,
    roles: [
      "scanner",
      "scanner_plus",
      "editor",
      "admin",
      "superadmin",
    ] as Role[],
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
    title: "Wysyłka QR",
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

const primaryNavItemClassName =
  "h-13 rounded-[0.95rem] border border-transparent px-4.5 text-[0.94rem] font-medium text-sidebar-foreground/84 transition-all duration-200 hover:border-sidebar-border/70 hover:bg-[hsl(220_7%_14%/0.96)] hover:text-sidebar-foreground [&>svg]:text-sidebar-foreground/72 md:h-11 md:rounded-[0.9rem] md:px-4 md:text-[0.92rem]";

const primaryNavItemActiveClassName =
  "border-[hsl(var(--sidebar-primary)/0.22)] bg-[hsl(36_18%_19%/0.94)] text-sidebar-foreground shadow-[inset_0_1px_0_hsl(var(--foreground)/0.04),0_0_0_1px_hsl(var(--sidebar-primary)/0.05)] [&>svg]:text-[hsl(var(--sidebar-primary))]";

const workspaceNavItemClassName =
  "rounded-[0.9rem] px-3 py-2.5 text-[0.92rem] font-medium text-sidebar-foreground/76 transition-all duration-200 hover:bg-[hsl(220_7%_15%/0.95)] hover:text-sidebar-foreground md:rounded-[0.8rem] md:px-3 md:py-2.5 md:text-[0.9rem]";

const workspaceNavItemActiveClassName =
  "bg-[hsl(220_7%_15%/0.98)] text-sidebar-foreground shadow-[inset_0_0_0_1px_hsl(var(--sidebar-primary)/0.12)]";

const workspaceSelectTriggerClassName =
  "min-h-11 h-auto items-start gap-3 rounded-[0.85rem] border-sidebar-border/45 bg-[hsl(220_7%_11%/0.94)] px-4 py-3 text-left text-[0.92rem] font-semibold leading-snug text-sidebar-foreground shadow-none [&>span]:pr-2 [&>span]:whitespace-normal [&>span]:break-words [&>span]:line-clamp-3";

const workspaceValueCardClassName =
  "mt-3 rounded-[0.85rem] bg-[hsl(220_7%_11%/0.8)] px-4 py-3.5";

const workspaceInfoCardClassName =
  "mt-3 rounded-[0.85rem] bg-[hsl(220_7%_11%/0.72)] px-4 py-3.5 text-xs leading-5 text-sidebar-foreground/66";

const sidebarLogoClassName = "h-[3.5rem] w-auto object-contain";

export function AppSidebar() {
  const { state, isMobile, openMobile, setOpenMobile } = useSidebar();
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

  const handleLogoClick = () => {
    navigate("/");
    if (isMobile) {
      setOpenMobile(false);
    }
  };

  const scannerHasActiveEvents =
    !isScannerRole(currentRole) || visibleEvents.length > 0;
  const items = allItems
    .filter((item) => {
      if (!item.roles.includes(currentRole)) return false;
      if (!isScannerRole(currentRole)) return true;
      if (item.url === "/participants" || item.url === "/scanner") {
        return scannerHasActiveEvents;
      }
      if (item.url === "/scanner-info") return !scannerHasActiveEvents;
      return true;
    })
    .map((item) =>
      item.url === "/organization"
        ? {
            ...item,
            url: currentUser.organization_id
              ? `/organizations/${currentUser.organization_id}`
              : "/organizations",
          }
        : item,
    );

  const generalItems = items.filter((item) => !eventScopedUrls.has(item.url));
  const adminOrganizations = currentRole === "admin" ? organizations : [];
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
  const organizationSelectContent = showOrganizationSelectControl ? (
    <div className="mt-3">
      <Select
        value={selectedOrganizationId}
        onValueChange={handleOrganizationChange}
      >
        <SelectTrigger className={workspaceSelectTriggerClassName}>
          <SelectValue placeholder="Wybierz organizację" />
        </SelectTrigger>
        <SelectContent>
          {adminOrganizations.map((organization) => (
            <SelectItem
              key={organization.id}
              value={organization.id}
              className="text-sm"
            >
              {organization.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  ) : selectedOrganization ? (
    <div className={workspaceValueCardClassName}>
      <p className="text-[0.92rem] font-semibold leading-snug text-sidebar-foreground">
        {selectedOrganization.name}
      </p>
    </div>
  ) : (
    <div className={workspaceInfoCardClassName}>
      Brak dostępnych organizacji w tym kontekście.
    </div>
  );
  const eventWorkspaceCard = (
    <div className="rounded-[0.95rem] bg-[hsl(220_7%_13%/0.72)] p-3.5">
      <p className="text-[0.68rem] font-medium uppercase tracking-[0.2em] text-sidebar-foreground/56">
        Wybrane wydarzenie
      </p>
      {scopedVisibleEvents.length === 0 ? (
        <div className={workspaceInfoCardClassName}>
          Do tej organizacji nie dodano jeszcze wydarzeń. Dodaj je w zakładce
          Wydarzenia.
        </div>
      ) : showEventSelectControl ? (
        <div className="mt-2">
          <Select value={selectedEventId} onValueChange={handleEventChange}>
            <SelectTrigger className={workspaceSelectTriggerClassName}>
              <SelectValue placeholder="Wybierz wydarzenie" />
            </SelectTrigger>
            <SelectContent>
              {scopedVisibleEvents.map((event) => (
                <SelectItem key={event.id} value={event.id} className="text-sm">
                  {event.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      ) : selectedEvent ? (
        <div className="mt-2 rounded-[0.85rem] bg-[hsl(220_7%_11%/0.8)] px-4 py-3.5">
          <p className="text-[0.92rem] font-semibold leading-snug text-sidebar-foreground">
            {selectedEvent.name}
          </p>
        </div>
      ) : (
        <div className="mt-2 rounded-[0.85rem] bg-[hsl(220_7%_11%/0.72)] px-4 py-3.5 text-xs leading-5 text-sidebar-foreground/66">
          Brak dostępnych wydarzeń w tym kontekście.
        </div>
      )}

      {selectedEvent && (
        <div className="mt-4 border-t border-sidebar-border/35 pt-3">
          <SidebarMenu className="gap-1">
            <SidebarMenuItem>
              <SidebarMenuButton asChild>
                <NavLink
                  to={`/events/${selectedEvent.id}`}
                  end
                  className={workspaceNavItemClassName}
                  activeClassName={workspaceNavItemActiveClassName}
                >
                  <CalendarDays className="mr-2 h-4 w-4 shrink-0" />
                  <span>Szczegóły</span>
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
                    className={workspaceNavItemClassName}
                    activeClassName={workspaceNavItemActiveClassName}
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
  );

  return (
    <Sidebar collapsible="icon">
      <div className="relative flex min-h-0 flex-1 flex-col">
        {isMobile && (
          <Button
            variant="ghost"
            size="icon"
            className={`absolute left-full top-5 z-30 ml-3 h-12 w-12 rounded-[0.95rem] border border-sidebar-border/80 bg-sidebar-accent/15 text-sidebar-foreground/90 shadow-[0_16px_34px_hsl(var(--surface-shadow)/0.35)] backdrop-blur-xl transition-all duration-100 ease-out hover:bg-sidebar-accent/45 hover:text-sidebar-foreground ${
              openMobile
                ? "translate-x-0 opacity-100"
                : "-translate-x-2 opacity-0 pointer-events-none"
            }`}
            onClick={() => setOpenMobile(false)}
          >
            <X className="h-5 w-5" />
          </Button>
        )}

        <div
          data-sidebar-scroll-shell="true"
          className="themed-scrollbar flex min-h-0 flex-1 flex-col overflow-y-auto overflow-x-hidden"
        >
          <SidebarHeader className="px-4 pb-4 pt-5 md:px-4 md:pb-4 md:pt-5">
            <button
              type="button"
              onClick={handleLogoClick}
              className="flex justify-center w-full cursor-pointer rounded-[0.95rem] border-0 bg-transparent p-0 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sidebar-primary/60 focus-visible:ring-offset-2 focus-visible:ring-offset-sidebar"
              aria-label="Przejdź do strony głównej"
            >
              {collapsed ? (
                <BrandLogo
                  variant="short"
                  className="mx-auto h-11 w-11 object-contain"
                />
              ) : (
                <BrandLogo variant="long" className={sidebarLogoClassName} />
              )}
            </button>
            <div
              className="mx-auto mt-4 h-px w-[70%] bg-sidebar-border/70"
              aria-hidden="true"
            />
          </SidebarHeader>

          <SidebarContent className="!flex-none !overflow-visible gap-5 px-3 py-5 md:gap-4 md:px-2 md:py-4.5">
            <SidebarGroup className="px-1 py-0 md:px-2">
              <SidebarGroupLabel>
                {!collapsed && (
                  <span className="flex items-center gap-2 text-[0.66rem] font-semibold uppercase tracking-[0.24em] text-sidebar-foreground/58">
                    <ScanLine className="h-3.5 w-3.5 text-sidebar-primary/90" />
                    Nawigacja
                  </span>
                )}
                {collapsed && (
                  <ScanLine className="h-4 w-4 text-sidebar-primary/90" />
                )}
              </SidebarGroupLabel>
              <SidebarGroupContent>
                <SidebarMenu className="gap-1.5">
                  {generalItems.map((item) => (
                    <SidebarMenuItem key={item.url}>
                      <SidebarMenuButton asChild>
                        <NavLink
                          to={item.url}
                          end={item.url === "/"}
                          className={primaryNavItemClassName}
                          activeClassName={primaryNavItemActiveClassName}
                        >
                          <item.icon className="mr-3 h-[1rem] w-[1rem] shrink-0 md:h-[0.98rem] md:w-[0.98rem]" />
                          {!collapsed && <span>{item.title}</span>}
                        </NavLink>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  ))}
                </SidebarMenu>
              </SidebarGroupContent>
            </SidebarGroup>

            {showEventWorkspace && (
              <SidebarGroup className="px-1 py-0 md:px-2">
                <SidebarGroupLabel>
                  <span className="text-[0.66rem] font-semibold uppercase tracking-[0.24em] text-sidebar-foreground/58">
                    Praca na wydarzeniu
                  </span>
                </SidebarGroupLabel>
                <SidebarGroupContent>
                  {currentRole === "admin" && (
                    <div className="space-y-4 rounded-[0.95rem] bg-[hsl(220_7%_13%/0.68)] p-3.5">
                      <p className="text-[0.68rem] font-medium uppercase tracking-[0.2em] text-sidebar-foreground/56">
                        Wybrana organizacja
                      </p>
                      {organizationSelectContent}
                      {eventWorkspaceCard}
                    </div>
                  )}

                  {currentRole !== "admin" && eventWorkspaceCard}
                </SidebarGroupContent>
              </SidebarGroup>
            )}
          </SidebarContent>

          <SidebarFooter className="mt-auto border-t border-sidebar-border/70 p-4 pt-4 md:border-t-0 md:p-4 md:pt-2">
            {!collapsed ? (
              <div className="space-y-2">
                <Button
                  variant="ghost"
                  className="h-12 w-full justify-start rounded-[0.95rem] border border-sidebar-border/65 bg-[hsl(220_9%_9%/0.96)] px-4 shadow-[0_14px_30px_hsl(var(--surface-shadow)/0.22)] hover:bg-[hsl(220_8%_12%/0.98)]"
                  onClick={() => navigate("/profile")}
                >
                  <div className="flex min-w-0 items-center gap-3 text-left">
                    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-sidebar-border/80 bg-black/20 text-sidebar-foreground/86">
                      <UserRound className="h-3.5 w-3.5" />
                    </div>
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold text-sidebar-foreground">
                        {currentUser.name}
                      </p>
                    </div>
                  </div>
                </Button>
                <Button
                  variant="ghost"
                  className="h-12 w-full justify-start rounded-[0.95rem] border border-sidebar-border/65 bg-[hsl(220_9%_9%/0.96)] px-4 text-sm font-medium text-sidebar-foreground/82 hover:bg-[hsl(220_8%_12%/0.98)] hover:text-sidebar-foreground"
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
                    className="mx-auto h-10 w-10 rounded-2xl border border-sidebar-border/70 bg-sidebar-accent/20"
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
        </div>
      </div>
    </Sidebar>
  );
}
