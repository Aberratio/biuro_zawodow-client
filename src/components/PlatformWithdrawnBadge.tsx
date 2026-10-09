import { Badge } from "@/components/ui/badge";
import {
  PLATFORM_WITHDRAWN_LABEL,
  PLATFORM_WITHDRAWN_SCAN_WARNING,
  describePlatformWithdrawal,
} from "@/lib/platform-withdrawal";

export function PlatformWithdrawnBadge({
  removedAt,
  className = "",
}: {
  removedAt: string | null | undefined;
  className?: string;
}) {
  return (
    <Badge
      variant="outline"
      className={`border-amber-500/70 bg-amber-500/10 text-amber-800 dark:text-amber-300 ${className}`.trim()}
      title={describePlatformWithdrawal(removedAt)}
    >
      {PLATFORM_WITHDRAWN_LABEL}
    </Badge>
  );
}

/** Shown in the scanner next to the check-in summary. A warning only: check-in stays possible. */
export function PlatformWithdrawnWarning() {
  return (
    <div
      role="alert"
      className="mt-3 rounded-xl border border-amber-500/60 bg-amber-500/10 px-4 py-3 text-sm font-medium text-amber-900 dark:text-amber-200"
    >
      {PLATFORM_WITHDRAWN_SCAN_WARNING}
    </div>
  );
}
