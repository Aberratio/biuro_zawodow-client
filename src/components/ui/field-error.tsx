import { AlertCircle } from "lucide-react";

import { cn } from "@/lib/utils";

export function FieldError({
  id,
  children,
  className,
  reserveSpace = false,
}: {
  id: string;
  children?: string;
  className?: string;
  reserveSpace?: boolean;
}) {
  if (!children && !reserveSpace) return null;

  return (
    <p
      id={id}
      role="alert"
      aria-live="polite"
      className={cn(
        "flex items-start gap-1.5 text-xs font-medium leading-5 text-destructive",
        !children && "invisible",
        className,
      )}
    >
      <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
      <span>{children}</span>
    </p>
  );
}
