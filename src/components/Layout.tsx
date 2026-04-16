import { ReactNode, useEffect, useRef } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import {
  SidebarProvider,
  SidebarTrigger,
  useSidebar,
} from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/AppSidebar";
import { BrandWordmark } from "@/components/BrandWordmark";
import { ConnectionBanner } from "@/components/ConnectionBanner";

function LayoutContent({ children }: { children: ReactNode }) {
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const { isMobile, setOpenMobile } = useSidebar();
  const mainRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    mainRef.current?.scrollTo({ top: 0 });
  }, [pathname]);

  useEffect(() => {
    if (isMobile) {
      setOpenMobile(false);
    }
  }, [isMobile, pathname, setOpenMobile]);

  return (
    <div className="app-shell relative flex min-h-screen w-full overflow-hidden">
      <AppSidebar />
      <div className="relative flex min-w-0 flex-1 flex-col">
        <div className="pointer-events-none absolute inset-0 overflow-hidden">
          <div className="app-page-gradient absolute inset-0" />
        </div>
        <header className="surface-panel sticky top-0 z-20 flex min-h-[4.9rem] shrink-0 items-center gap-3 border-b px-4 py-3.5 md:min-h-[5.1rem] md:flex-wrap md:px-5 lg:px-7">
          <div className="flex min-w-0 items-center gap-3.5">
            {isMobile && (
              <SidebarTrigger className="h-12 w-12 rounded-[1.15rem] border border-border/80 bg-background/45 text-primary backdrop-blur-xl hover:bg-accent/80 hover:text-foreground" />
            )}
          </div>
          <div className="pointer-events-none absolute inset-0 flex items-center justify-center md:hidden">
            <button
              type="button"
              onClick={() => navigate("/")}
              className="pointer-events-auto shrink-0 rounded-[0.95rem] border-0 bg-transparent p-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/60 focus-visible:ring-offset-2 focus-visible:ring-offset-background"
              aria-label="Przejdź do strony głównej"
            >
              <BrandWordmark
                className="shrink-0"
                imageClassName="h-12 w-auto object-contain"
              />
            </button>
          </div>
        </header>
        <ConnectionBanner />
        <main
          ref={mainRef}
          data-app-scroll-root="true"
          className="relative flex-1 overflow-auto px-4 pb-7 pt-4 md:px-5 md:pb-8 md:pt-5 lg:px-8 lg:pb-10 lg:pt-7"
        >
          <div className="pointer-events-none absolute inset-x-6 top-0 h-px bg-gradient-to-r from-transparent via-primary/25 to-transparent" />
          <div className="relative z-10 mx-auto w-full max-w-[1480px]">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}

export function Layout({ children }: { children: ReactNode }) {
  return (
    <SidebarProvider>
      <LayoutContent>{children}</LayoutContent>
    </SidebarProvider>
  );
}
