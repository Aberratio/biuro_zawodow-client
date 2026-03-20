import { ReactNode } from 'react';
import { SidebarProvider, SidebarTrigger } from '@/components/ui/sidebar';
import { AppSidebar } from '@/components/AppSidebar';
import { useMockData } from '@/contexts/MockDataContext';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

const roleLabels: Record<string, string> = { superadmin: 'Superadmin', admin: 'Admin', editor: 'Organizator', scanner: 'Skaner' };

export function Layout({ children }: { children: ReactNode }) {
  const { currentRole, currentUser, selectedEventId, setSelectedEventId, visibleEvents } = useMockData();

  return (
    <SidebarProvider>
      <div className="min-h-screen flex w-full">
        <AppSidebar />
        <div className="flex-1 flex flex-col min-w-0">
          <header className="h-14 flex items-center justify-between border-b px-4 bg-background shrink-0">
            <div className="flex items-center gap-3">
              <SidebarTrigger />
              <Select value={selectedEventId} onValueChange={setSelectedEventId}>
                <SelectTrigger className="h-8 w-[220px] text-xs">
                  <SelectValue placeholder="Wybierz wydarzenie" />
                </SelectTrigger>
                <SelectContent>
                  {visibleEvents.map(e => (
                    <SelectItem key={e.id} value={e.id} className="text-xs">{e.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="hidden md:flex items-center gap-2">
              {currentUser.organization_id && (
                <Badge variant="outline" className="text-[10px]">
                  {currentUser.organization_id === 'org-1' ? 'SportEvents Pro' : 'RunPoland'}
                </Badge>
              )}
              <Badge variant="secondary" className="text-xs uppercase tracking-wider">
                {roleLabels[currentRole]}
              </Badge>
            </div>
          </header>
          <main className="flex-1 overflow-auto p-4 md:p-6">
            {children}
          </main>
        </div>
      </div>
    </SidebarProvider>
  );
}
