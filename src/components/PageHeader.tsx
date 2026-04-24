import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

type PageHeaderProps = {
  title: ReactNode;
  description?: ReactNode;
  actions?: ReactNode;
  className?: string;
  headingClassName?: string;
  contentClassName?: string;
  actionsClassName?: string;
};

export function PageHeader({
  title,
  description,
  actions,
  className,
  headingClassName,
  contentClassName,
  actionsClassName,
}: PageHeaderProps) {
  return (
    <div
      className={cn(
        "flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between",
        className,
      )}
    >
      <div className={cn("min-w-0 space-y-1.5", contentClassName)}>
        <h1
          className={cn(
            "text-[2rem] font-semibold tracking-[-0.05em] text-foreground md:text-[2.25rem] lg:text-[2.55rem]",
            headingClassName,
          )}
        >
          {title}
        </h1>
        {description ? (
          <div className="text-xs text-muted-foreground sm:text-sm">
            {description}
          </div>
        ) : null}
      </div>
      {actions ? (
        <div
          className={cn(
            "flex shrink-0 flex-col gap-2 sm:flex-row",
            actionsClassName,
          )}
        >
          {actions}
        </div>
      ) : null}
    </div>
  );
}
