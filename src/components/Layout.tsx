import { ReactNode } from 'react';
import { SidebarProvider, SidebarTrigger } from '@/components/ui/sidebar';
import { AppSidebar } from '@/components/AppSidebar';
import { useMockData } from '@/contexts/MockDataContext';
import { Badge } from '@/components/ui/badge';

const roleLabels: Record<string, string> = { superadmin: 'Superadmin', admin: 'Admin', editor: 'Organizator', scanner: 'Skaner' };

export function Layout({ children }: { children: ReactNode }) {
  const { currentRole, currentUser, organizations } = useMockData();
  const currentOrganization = organizations.find(org => org.id === currentUser.organization_id)
    ?? organizations.find(org => (currentUser.organization_ids ?? []).includes(org.id));
  const organizationLabel = currentRole === 'admin'
    ? `${(currentUser.organization_ids ?? []).length} organizacji`
    : (currentOrganization?.name ?? currentUser.organization_id);

  return (
    <SidebarProvider>
      <div className="min-h-screen flex w-full">
        <AppSidebar />
        <div className="flex-1 flex flex-col min-w-0">
          <header className="h-14 flex items-center justify-between border-b px-4 bg-background shrink-0">
            <div className="flex items-center gap-3">
              <SidebarTrigger />
            </div>
            <div className="hidden md:flex items-center gap-2">
              {(currentUser.organization_id || currentRole === 'admin') && (
                <Badge variant="outline" className="text-[10px]">
                  {organizationLabel}
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
