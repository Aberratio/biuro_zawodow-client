import React from 'react';
import { LayoutDashboard, CalendarDays, Users, ScanLine, FileUp, Mail, UserCog, Shield, Pencil, Eye, Building2, LogOut, Crown } from 'lucide-react';
import { NavLink } from '@/components/NavLink';
import { useMockData } from '@/contexts/MockDataContext';
import { useAuth } from '@/contexts/AuthContext';
import {
  Sidebar, SidebarContent, SidebarGroup, SidebarGroupContent, SidebarGroupLabel,
  SidebarMenu, SidebarMenuButton, SidebarMenuItem, SidebarFooter, useSidebar,
} from '@/components/ui/sidebar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import type { Role } from '@/types';

const allItems = [
  { title: 'Dashboard', url: '/', icon: LayoutDashboard, roles: ['scanner', 'editor', 'admin', 'superadmin'] as Role[] },
  { title: 'Organizacje', url: '/organizations', icon: Building2, roles: ['superadmin'] as Role[] },
  { title: 'Wydarzenia', url: '/events', icon: CalendarDays, roles: ['editor', 'admin', 'superadmin'] as Role[] },
  { title: 'Uczestnicy', url: '/participants', icon: Users, roles: ['scanner', 'editor', 'admin', 'superadmin'] as Role[] },
  { title: 'Skaner QR', url: '/scanner', icon: ScanLine, roles: ['scanner', 'editor', 'admin', 'superadmin'] as Role[] },
  { title: 'Import CSV', url: '/import', icon: FileUp, roles: ['editor', 'admin', 'superadmin'] as Role[] },
  { title: 'Wysyłka QR', url: '/emails', icon: Mail, roles: ['editor', 'admin', 'superadmin'] as Role[] },
  { title: 'Użytkownicy', url: '/users', icon: UserCog, roles: ['editor', 'admin', 'superadmin'] as Role[] },
];

const roleIcons: Record<Role, typeof Shield> = { superadmin: Crown, admin: Shield, editor: Pencil, scanner: Eye };
const roleLabels: Record<Role, string> = { superadmin: 'Superadmin', admin: 'Admin', editor: 'Organizator', scanner: 'Skaner' };

export function AppSidebar() {
  const { state } = useSidebar();
  const collapsed = state === 'collapsed';
  const { currentRole, currentUser } = useMockData();
  const { logout } = useAuth();
  const items = allItems.filter(item => item.roles.includes(currentRole));
  const RoleIcon = roleIcons[currentRole];

  return (
    <Sidebar collapsible="icon">
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>
            {!collapsed && <span className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider">
              <ScanLine className="h-4 w-4" /> Biuro Zawodów
            </span>}
            {collapsed && <ScanLine className="h-4 w-4" />}
          </SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {items.map(item => (
                <SidebarMenuItem key={item.url}>
                  <SidebarMenuButton asChild>
                    <NavLink to={item.url} end={item.url === '/'} className="hover:bg-accent/50" activeClassName="bg-accent text-accent-foreground font-medium">
                      <item.icon className="mr-2 h-4 w-4 shrink-0" />
                      {!collapsed && <span>{item.title}</span>}
                    </NavLink>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
      <SidebarFooter className="p-3">
        {!collapsed ? (
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <RoleIcon className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
              <div className="min-w-0">
                <p className="text-xs font-medium truncate">{currentUser.name}</p>
                <p className="text-[10px] text-muted-foreground">{roleLabels[currentRole]}</p>
              </div>
            </div>
            <Button variant="ghost" size="sm" className="w-full justify-start text-xs h-8" onClick={logout}>
              <LogOut className="h-3.5 w-3.5 mr-2" /> Wyloguj
            </Button>
          </div>
        ) : (
          <Button variant="ghost" size="icon" className="mx-auto h-8 w-8" onClick={logout} title="Wyloguj">
            <LogOut className="h-3.5 w-3.5" />
          </Button>
        )}
      </SidebarFooter>
    </Sidebar>
  );
}
