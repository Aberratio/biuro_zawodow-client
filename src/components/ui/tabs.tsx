import * as React from "react";
import * as TabsPrimitive from "@radix-ui/react-tabs";

import { cn } from "@/lib/utils";

const Tabs = TabsPrimitive.Root;

const TabsList = React.forwardRef<
  React.ElementRef<typeof TabsPrimitive.List>,
  React.ComponentPropsWithoutRef<typeof TabsPrimitive.List>
>(({ className, ...props }, ref) => (
  <TabsPrimitive.List
    ref={ref}
    className={cn(
      "inline-flex min-h-12 items-center justify-center gap-1.5 rounded-2xl border border-border/70 bg-background/40 p-1.5 text-muted-foreground shadow-[0_18px_45px_hsl(var(--surface-shadow)/0.24),inset_0_1px_0_hsl(var(--foreground)/0.05)] backdrop-blur-xl supports-[backdrop-filter]:bg-background/32",
      className,
    )}
    {...props}
  />
));
TabsList.displayName = TabsPrimitive.List.displayName;

const TabsTrigger = React.forwardRef<
  React.ElementRef<typeof TabsPrimitive.Trigger>,
  React.ComponentPropsWithoutRef<typeof TabsPrimitive.Trigger>
>(({ className, ...props }, ref) => (
  <TabsPrimitive.Trigger
    ref={ref}
    className={cn(
      "inline-flex min-h-[2.5rem] items-center justify-center whitespace-nowrap rounded-xl border border-transparent px-4 py-2 text-sm font-medium text-muted-foreground ring-offset-background transition-all duration-200 hover:bg-foreground/5 hover:text-foreground data-[state=active]:border-white/10 data-[state=active]:bg-background/72 data-[state=active]:text-foreground data-[state=active]:shadow-[0_10px_28px_hsl(var(--surface-shadow)/0.24),inset_0_1px_0_hsl(var(--foreground)/0.08),0_0_0_1px_hsl(var(--foreground)/0.04)] data-[state=active]:backdrop-blur-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50",
      className,
    )}
    {...props}
  />
));
TabsTrigger.displayName = TabsPrimitive.Trigger.displayName;

const TabsContent = React.forwardRef<
  React.ElementRef<typeof TabsPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof TabsPrimitive.Content>
>(({ className, ...props }, ref) => (
  <TabsPrimitive.Content
    ref={ref}
    className={cn(
      "mt-3 ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
      className,
    )}
    {...props}
  />
));
TabsContent.displayName = TabsPrimitive.Content.displayName;

export { Tabs, TabsList, TabsTrigger, TabsContent };
