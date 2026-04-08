import { ReactNode } from 'react';
import { SidebarProvider, SidebarTrigger } from '@/components/ui/sidebar';
import { AppSidebar } from '@/components/AppSidebar';
import { useData } from '@/contexts/DataContext';
import { Badge } from '@/components/ui/badge';

const roleLabels: Record<string, string> = { superadmin: 'Superadmin', admin: 'Admin', editor: 'Organizator', scanner: 'Skaner' };

export function Layout({ children }: { children: ReactNode }) {
  const { currentRole, currentUser, organizations } = useData();
  const currentOrganization = organizations.find(org => org.id === currentUser.organization_id)
    ?? organizations.find(org => (currentUser.organization_ids ?? []).includes(org.id));
  const organizationLabel = currentRole === 'admin'
    ? `${(currentUser.organization_ids ?? []).length} organizacji`
    : (currentOrganization?.name ?? currentUser.organization_id);

  return (
    <SidebarProvider>
      <div className="min-h-screen flex w-full">
        <AppSidebar />
        <div className="relative flex-1 flex min-w-0 flex-col">
          <div className="pointer-events-none absolute inset-0 overflow-hidden">
            <div className="app-page-gradient absolute inset-0" />
          </div>
          <header className="surface-panel sticky top-0 z-20 flex min-h-14 shrink-0 flex-wrap items-center justify-between gap-3 border-b px-4 py-3 sm:px-5 lg:px-6">
            <div className="flex min-w-0 items-center gap-3">
              <SidebarTrigger className="rounded-xl border border-border/60 bg-background/35 backdrop-blur-sm hover:bg-accent/70" />
            </div>
            <div className="flex max-w-full flex-wrap items-center justify-end gap-2">
              {(currentUser.organization_id || currentRole === 'admin') && (
                <Badge variant="outline" className="max-w-[12rem] truncate text-[10px] sm:max-w-[18rem]">
                  {organizationLabel}
                </Badge>
              )}
              <Badge variant="secondary" className="text-xs uppercase tracking-[0.18em]">
                {roleLabels[currentRole]}
              </Badge>
            </div>
          </header>
          <main className="relative flex-1 overflow-auto p-4 sm:p-5 lg:p-6">
            <div className="pointer-events-none absolute inset-x-6 top-0 h-px bg-gradient-to-r from-transparent via-primary/25 to-transparent" />
            <div className="relative z-10 mx-auto w-full max-w-[1600px]">
              {children}
            </div>
          </main>
        </div>
      </div>
    </SidebarProvider>
  );
}
