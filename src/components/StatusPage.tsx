import { ReactNode } from "react";
import { Link } from "react-router-dom";
import { ArrowLeft, ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

type StatusPageProps = {
  code: string;
  eyebrow: string;
  title: string;
  description: string;
  hint: string;
  icon: ReactNode;
  primaryLabel?: string;
  primaryTo?: string;
};

export function StatusPage({
  code,
  eyebrow,
  title,
  description,
  hint,
  icon,
  primaryLabel = "Wróć do panelu",
  primaryTo = "/",
}: StatusPageProps) {
  return (
    <div className="min-h-app-viewport relative flex items-center justify-center overflow-x-hidden bg-background px-4 py-10">
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute left-[-8rem] top-[-6rem] h-56 w-56 rounded-full bg-primary/20 blur-3xl" />
        <div className="absolute bottom-[-7rem] right-[-5rem] h-64 w-64 rounded-full bg-sky-400/10 blur-3xl" />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,_rgba(255,255,255,0.06),_transparent_35%),linear-gradient(180deg,rgba(255,255,255,0.02),transparent)]" />
      </div>

      <Card className="relative w-full max-w-3xl border-border/70 bg-card/95 shadow-2xl backdrop-blur">
        <CardContent className="grid gap-8 p-6 sm:p-8 lg:grid-cols-[0.9fr_1.1fr] lg:items-center">
          <div className="relative overflow-hidden rounded-3xl border border-white/10 bg-gradient-to-br from-primary/20 via-primary/10 to-transparent p-6">
            <div className="absolute right-4 top-4 rounded-full border border-white/10 bg-black/20 px-3 py-1 text-[11px] font-heading font-bold uppercase tracking-[0.24em] text-white/70">
              {eyebrow}
            </div>
            <div className="flex min-h-[220px] flex-col justify-between">
              <div className="inline-flex h-16 w-16 items-center justify-center rounded-2xl border border-white/10 bg-black/25 text-white shadow-lg">
                {icon}
              </div>
              <div>
                <p className="font-heading text-6xl font-black tracking-[-0.06em] text-white sm:text-7xl">{code}</p>
                <p className="mt-2 max-w-xs text-sm leading-6 text-white/75">
                  Zegar tyka, ale ta ścieżka właśnie pobiegła nie w tę stronę.
                </p>
              </div>
            </div>
          </div>

          <div className="space-y-5">
            <div className="space-y-3">
              <p className="font-heading text-xs font-bold uppercase tracking-[0.28em] text-primary/80">{eyebrow}</p>
              <h1 className="font-heading text-3xl font-black tracking-tight text-foreground sm:text-4xl">{title}</h1>
              <p className="max-w-xl text-sm leading-7 text-muted-foreground sm:text-base">{description}</p>
            </div>

            <div className="rounded-2xl border border-dashed border-border/80 bg-muted/30 p-4 text-sm leading-6 text-muted-foreground">
              {hint}
            </div>

            <div className="flex flex-col gap-3 sm:flex-row">
              <Button asChild className="h-11 gap-2">
                <Link to={primaryTo}>
                  <ArrowLeft className="h-4 w-4" />
                  {primaryLabel}
                </Link>
              </Button>
              <Button asChild variant="outline" className="h-11 gap-2">
                <a href="https://zmierzymyczas.pl" target="_blank" rel="noreferrer">
                  Otwórz zmierzymyczas.pl
                  <ExternalLink className="h-4 w-4" />
                </a>
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
