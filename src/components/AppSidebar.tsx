import React from 'react';
import { LayoutDashboard, CalendarDays, Users, ScanLine, FileUp, Mail, UserCog, Shield, Pencil, Eye } from 'lucide-react';
import { NavLink } from '@/components/NavLink';
import { useMockData } from '@/contexts/MockDataContext';
import {
  Sidebar, SidebarContent, SidebarGroup, SidebarGroupContent, SidebarGroupLabel,
  SidebarMenu, SidebarMenuButton, SidebarMenuItem, SidebarFooter, useSidebar,
} from '@/components/ui/sidebar';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import type { Role } from '@/types';

const allItems = [
  { title: 'Dashboard', url: '/', icon: LayoutDashboard, roles: ['scanner', 'editor', 'admin'] as Role[] },
  { title: 'Wydarzenia', url: '/events', icon: CalendarDays, roles: ['admin'] as Role[] },
  { title: 'Uczestnicy', url: '/participants', icon: Users, roles: ['scanner', 'editor', 'admin'] as Role[] },
  { title: 'Skaner QR', url: '/scanner', icon: ScanLine, roles: ['scanner', 'editor', 'admin'] as Role[] },
  { title: 'Import CSV', url: '/import', icon: FileUp, roles: ['admin'] as Role[] },
  { title: 'Wysyłka QR', url: '/emails', icon: Mail, roles: ['admin'] as Role[] },
  { title: 'Użytkownicy', url: '/users', icon: UserCog, roles: ['admin'] as Role[] },
];

const roleIcons: Record<Role, typeof Shield> = { admin: Shield, editor: Pencil, scanner: Eye };
const roleLabels: Record<Role, string> = { admin: 'Admin', editor: 'Edytor', scanner: 'Skaner' };

export function AppSidebar() {
  const { state } = useSidebar();
  const collapsed = state === 'collapsed';
  const { currentRole, setCurrentRole } = useMockData();
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
            <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">Demo — zmień rolę</p>
            <Select value={currentRole} onValueChange={(v) => setCurrentRole(v as Role)}>
              <SelectTrigger className="h-9">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {(['admin', 'editor', 'scanner'] as Role[]).map(r => (
                  <SelectItem key={r} value={r}>
                    <span className="flex items-center gap-2">{React.createElement(roleIcons[r], { className: 'h-3.5 w-3.5' })} {roleLabels[r]}</span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        ) : (
          <Badge variant="outline" className="mx-auto flex h-8 w-8 items-center justify-center p-0">
            <RoleIcon className="h-3.5 w-3.5" />
          </Badge>
        )}
      </SidebarFooter>
    </Sidebar>
  );
}
