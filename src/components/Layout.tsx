import { ReactNode } from 'react';
import { SidebarProvider, SidebarTrigger } from '@/components/ui/sidebar';
import { AppSidebar } from '@/components/AppSidebar';

export function Layout({ children }: { children: ReactNode }) {
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
