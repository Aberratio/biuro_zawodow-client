import React from 'react';
import { LayoutDashboard, CalendarDays, Users, ScanLine, FileUp, Mail, Shield, Pencil, Eye, Building2, LogOut, Crown } from 'lucide-react';
import { NavLink } from '@/components/NavLink';
import { useMockData } from '@/contexts/MockDataContext';
import { useAuth } from '@/contexts/AuthContext';
import {
  Sidebar, SidebarContent, SidebarGroup, SidebarGroupContent, SidebarGroupLabel,
  SidebarMenu, SidebarMenuButton, SidebarMenuItem, SidebarFooter, useSidebar,
} from '@/components/ui/sidebar';
import { Button } from '@/components/ui/button';
import type { Role } from '@/types';

const allItems = [
  { title: 'Dashboard', url: '/', icon: LayoutDashboard, roles: ['scanner', 'editor', 'admin', 'superadmin'] as Role[] },
  { title: 'Organizacje', url: '/organizations', icon: Building2, roles: ['admin', 'superadmin'] as Role[] },
  { title: 'Wydarzenia', url: '/events', icon: CalendarDays, roles: ['editor', 'admin', 'superadmin'] as Role[] },
  { title: 'Uczestnicy', url: '/participants', icon: Users, roles: ['scanner', 'editor', 'admin', 'superadmin'] as Role[] },
  { title: 'Skaner QR', url: '/scanner', icon: ScanLine, roles: ['scanner', 'editor', 'admin', 'superadmin'] as Role[] },
  { title: 'Import CSV', url: '/import', icon: FileUp, roles: ['editor', 'admin', 'superadmin'] as Role[] },
  { title: 'Wysylka QR', url: '/emails', icon: Mail, roles: ['editor', 'admin', 'superadmin'] as Role[] },
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
              <ScanLine className="h-4 w-4" /> Biuro Zawodow
            </span>}
            {collapsed && <ScanLine className="h-4 w-4" />}
          </SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {items.map(item => (
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
      </SidebarContent>
      <SidebarFooter className="p-3">
        {!collapsed ? (
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <RoleIcon className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
              <div className="min-w-0">
                <p className="truncate text-xs font-medium">{currentUser.name}</p>
                <p className="text-[10px] text-muted-foreground">{roleLabels[currentRole]}</p>
              </div>
            </div>
            <Button variant="ghost" size="sm" className="h-8 w-full justify-start text-xs" onClick={logout}>
              <LogOut className="mr-2 h-3.5 w-3.5" /> Wyloguj
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
