import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Building2, CalendarDays, Crown, Eye, FileUp, Info, LayoutDashboard, LogOut, Mail, Pencil, ScanLine, Shield, UserRound, Users } from 'lucide-react';
import { NavLink } from '@/components/NavLink';
import { useData } from '@/contexts/DataContext';
import { useAuth } from '@/contexts/AuthContext';
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from '@/components/ui/sidebar';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import type { Role } from '@/types';

const allItems = [
  { title: 'Panel', url: '/', icon: LayoutDashboard, roles: ['editor', 'admin', 'superadmin'] as Role[] },
  { title: 'Organizacje', url: '/organizations', icon: Building2, roles: ['admin', 'superadmin'] as Role[] },
  { title: 'Wydarzenia', url: '/events', icon: CalendarDays, roles: ['editor', 'admin', 'superadmin'] as Role[] },
  { title: 'Uczestnicy', url: '/participants', icon: Users, roles: ['scanner', 'editor', 'admin', 'superadmin'] as Role[] },
  { title: 'Skaner QR', url: '/scanner', icon: ScanLine, roles: ['scanner', 'editor', 'admin', 'superadmin'] as Role[] },
  { title: 'Informacje', url: '/scanner-info', icon: Info, roles: ['scanner'] as Role[] },
  { title: 'Import CSV', url: '/import', icon: FileUp, roles: ['editor', 'admin', 'superadmin'] as Role[] },
  { title: 'Wysyłka QR', url: '/emails', icon: Mail, roles: ['editor', 'admin', 'superadmin'] as Role[] },
];

const roleIcons: Record<Role, typeof Shield> = { superadmin: Crown, admin: Shield, editor: Pencil, scanner: Eye };
const roleLabels: Record<Role, string> = { superadmin: 'Superadmin', admin: 'Admin', editor: 'Organizator', scanner: 'Skaner' };
const eventScopedUrls = new Set(['/participants', '/scanner', '/import', '/emails']);

export function AppSidebar() {
  const { state } = useSidebar();
  const collapsed = state === 'collapsed';
  const navigate = useNavigate();
  const { currentRole, currentUser, visibleEvents, selectedEventId, setSelectedEventId } = useData();
  const { logout } = useAuth();

  const scannerHasActiveEvents = currentRole !== 'scanner' || visibleEvents.length > 0;
  const items = allItems.filter(item => {
    if (!item.roles.includes(currentRole)) return false;
    if (currentRole !== 'scanner') return true;
    if (item.url === '/participants' || item.url === '/scanner') return scannerHasActiveEvents;
    if (item.url === '/scanner-info') return !scannerHasActiveEvents;
    return true;
  });

  const generalItems = items.filter(item => !eventScopedUrls.has(item.url));
  const eventScopedItems = items.filter(item => eventScopedUrls.has(item.url));
  const RoleIcon = roleIcons[currentRole];
  const selectedEvent = visibleEvents.find(event => event.id === selectedEventId) ?? visibleEvents[0] ?? null;
  const showEventSelectControl = visibleEvents.length > 1 || currentRole !== 'scanner';

  return (
    <Sidebar collapsible="icon">
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>
            {!collapsed && (
              <span className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider">
                <ScanLine className="h-4 w-4" /> Biuro Zawodów
              </span>
            )}
            {collapsed && <ScanLine className="h-4 w-4" />}
          </SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {generalItems.map(item => (
                <SidebarMenuItem key={item.url}>
                  <SidebarMenuButton asChild>
                    <NavLink to={item.url} end={item.url === '/'} className="hover:bg-accent/50" activeClassName="bg-accent font-medium text-accent-foreground">
                      <item.icon className="mr-2 h-4 w-4 shrink-0" />
                      {!collapsed && <span>{item.title}</span>}
                    </NavLink>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        {!collapsed && eventScopedItems.length > 0 && visibleEvents.length > 0 && (
          <SidebarGroup>
            <SidebarGroupLabel>
              <span className="text-[11px] font-bold uppercase tracking-[0.18em] text-sidebar-foreground/70">
                Praca na wydarzeniu
              </span>
            </SidebarGroupLabel>
            <SidebarGroupContent>
              <div className="mx-2 rounded-2xl border border-sidebar-border/70 bg-sidebar-accent/35 p-2">
                <div className="rounded-xl border border-sidebar-border/60 bg-sidebar-accent/50 p-3">
                  <p className="text-[11px] uppercase tracking-[0.16em] text-sidebar-foreground/60">
                    Wybrane wydarzenie
                  </p>
                  {showEventSelectControl ? (
                    <div className="mt-2">
                      <Select value={selectedEventId} onValueChange={setSelectedEventId}>
                        <SelectTrigger className="h-10 border-sidebar-border bg-sidebar text-xs text-sidebar-foreground">
                          <SelectValue placeholder="Wybierz wydarzenie" />
                        </SelectTrigger>
                        <SelectContent>
                          {visibleEvents.map(event => (
                            <SelectItem key={event.id} value={event.id} className="text-xs">
                              {event.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  ) : selectedEvent ? (
                    <div className="mt-2 rounded-xl bg-sidebar px-3 py-3">
                      <p className="text-sm font-medium leading-snug text-sidebar-foreground">{selectedEvent.name}</p>
                      <p className="mt-1 text-[11px] text-sidebar-foreground/65">
                        Ten kontekst steruje narzędziami pracy dla wydarzenia.
                      </p>
                    </div>
                  ) : (
                    <div className="mt-2 rounded-xl bg-sidebar px-3 py-3 text-xs text-sidebar-foreground/70">
                      Brak dostępnych wydarzeń w tym kontekście.
                    </div>
                  )}
                </div>

                <SidebarMenu className="mt-2">
                  {selectedEvent && (
                    <SidebarMenuItem>
                      <SidebarMenuButton asChild>
                        <NavLink to={`/events/${selectedEvent.id}`} end className="rounded-xl hover:bg-accent/60" activeClassName="rounded-xl bg-sidebar-accent/80 font-medium text-sidebar-accent-foreground shadow-[inset_0_0_0_1px_hsl(var(--sidebar-primary)/0.14)]">
                          <CalendarDays className="mr-2 h-4 w-4 shrink-0" />
                          <span>Szczegóły wydarzenia</span>
                        </NavLink>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  )}
                  {eventScopedItems.map(item => (
                    <SidebarMenuItem key={item.url}>
                      <SidebarMenuButton asChild>
                        <NavLink to={item.url === '/import' && selectedEvent ? `/events/${selectedEvent.id}/import` : item.url} end={item.url !== '/import'} className="rounded-xl hover:bg-accent/60" activeClassName="rounded-xl bg-sidebar-accent/80 font-medium text-sidebar-accent-foreground shadow-[inset_0_0_0_1px_hsl(var(--sidebar-primary)/0.14)]">
                          <item.icon className="mr-2 h-4 w-4 shrink-0" />
                          <span>{item.title}</span>
                        </NavLink>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  ))}
                </SidebarMenu>
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
              onClick={() => navigate('/profile')}
            >
              <div className="flex min-w-0 items-center gap-2 text-left">
                <RoleIcon className="h-3.5 w-3.5 shrink-0 text-sidebar-foreground/75" />
                <div className="min-w-0">
                  <p className="truncate text-xs font-medium text-sidebar-foreground">{currentUser.name}</p>
                  <p className="text-[10px] text-sidebar-foreground/60">{roleLabels[currentRole]}</p>
                </div>
              </div>
            </Button>
            <Button
              variant="ghost"
              className="h-9 w-full justify-start rounded-[1.1rem] border border-sidebar-border/70 bg-sidebar-accent/15 px-3 text-xs hover:bg-sidebar-accent/45"
              onClick={logout}
            >
              <LogOut className="mr-2 h-4 w-4" />
              Wyloguj
            </Button>
          </div>
        ) : (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="mx-auto h-8 w-8" title={currentUser.name}>
                <RoleIcon className="h-3.5 w-3.5" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" side="right" className="w-52">
              <DropdownMenuItem onClick={() => navigate('/profile')}>
                <UserRound className="mr-2 h-4 w-4" />
                Mój profil
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={logout}>
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
