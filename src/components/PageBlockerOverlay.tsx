import { useEffect, useRef } from "react";
import { Coffee, Loader2 } from "lucide-react";

type PageBlockerOverlayProps = {
  title: string;
  description: string;
};

export function PageBlockerOverlay({
  title,
  description,
}: PageBlockerOverlayProps) {
  const overlayRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    overlayRef.current?.focus();
  }, []);

  return (
    <div
      ref={overlayRef}
      className="fixed inset-0 z-[100] flex items-center justify-center bg-background/80 p-4 backdrop-blur-sm"
      role="status"
      aria-live="polite"
      aria-label={title}
      tabIndex={-1}
      onKeyDown={(event) => event.preventDefault()}
    >
      <div className="w-full max-w-md rounded-lg border bg-card p-6 text-center shadow-xl">
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-primary/10 text-primary">
          <Coffee className="h-7 w-7" aria-hidden="true" />
        </div>
        <div className="mt-5 space-y-2">
          <h2 className="text-xl font-semibold tracking-normal text-foreground">
            {title}
          </h2>
          <p className="text-sm leading-6 text-muted-foreground">
            {description}
          </p>
        </div>
        <div className="mt-5 flex items-center justify-center gap-2 text-sm font-medium text-primary">
          <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
          Wysyłanie w toku...
        </div>
      </div>
    </div>
  );
}
