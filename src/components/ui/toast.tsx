import * as React from "react";
import * as ToastPrimitives from "@radix-ui/react-toast";
import { cva, type VariantProps } from "class-variance-authority";
import { X } from "lucide-react";

import { cn } from "@/lib/utils";

const ToastProvider = ToastPrimitives.Provider;

const ToastViewport = React.forwardRef<
  React.ElementRef<typeof ToastPrimitives.Viewport>,
  React.ComponentPropsWithoutRef<typeof ToastPrimitives.Viewport>
>(({ className, ...props }, ref) => (
  <ToastPrimitives.Viewport
    ref={ref}
    className={cn(
      "fixed top-0 z-[200] flex max-h-screen w-full flex-col-reverse gap-3 p-4 sm:bottom-0 sm:right-0 sm:top-auto sm:flex-col md:max-w-[460px]",
      className,
    )}
    {...props}
  />
));
ToastViewport.displayName = ToastPrimitives.Viewport.displayName;

const toastVariants = cva(
  "group pointer-events-auto relative flex w-full items-start gap-4 overflow-hidden rounded-2xl border p-4 pr-12 transition-all duration-200 data-[swipe=cancel]:translate-x-0 data-[swipe=end]:translate-x-[var(--radix-toast-swipe-end-x)] data-[swipe=move]:translate-x-[var(--radix-toast-swipe-move-x)] data-[swipe=move]:transition-none data-[state=open]:animate-in data-[state=closed]:animate-out data-[swipe=end]:animate-out data-[state=closed]:fade-out-80 data-[state=closed]:slide-out-to-right-full data-[state=open]:slide-in-from-top-full data-[state=open]:sm:slide-in-from-bottom-full",
  {
    variants: {
      variant: {
        default:
          "surface-popover border-white/10 bg-[linear-gradient(180deg,hsl(var(--foreground)/0.04),transparent_40%),radial-gradient(circle_at_top_left,hsl(var(--button-highlight)/0.12),transparent_60%),linear-gradient(180deg,hsl(var(--popover)/0.98),hsl(var(--card)/0.96))] text-foreground shadow-[0_24px_60px_hsl(var(--surface-shadow)/0.52)]",
        destructive:
          "destructive group border-red-400/30 bg-[linear-gradient(180deg,rgba(255,255,255,0.04),transparent_40%),radial-gradient(circle_at_top_left,rgba(248,113,113,0.16),transparent_60%),linear-gradient(180deg,rgba(127,29,29,0.96),rgba(69,10,10,0.98))] text-red-50 shadow-[0_24px_60px_rgba(69,10,10,0.45)]",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  },
);

const Toast = React.forwardRef<
  React.ElementRef<typeof ToastPrimitives.Root>,
  React.ComponentPropsWithoutRef<typeof ToastPrimitives.Root> & VariantProps<typeof toastVariants>
>(({ className, variant, ...props }, ref) => {
  return <ToastPrimitives.Root ref={ref} className={cn(toastVariants({ variant }), className)} {...props} />;
});
Toast.displayName = ToastPrimitives.Root.displayName;

const ToastAction = React.forwardRef<
  React.ElementRef<typeof ToastPrimitives.Action>,
  React.ComponentPropsWithoutRef<typeof ToastPrimitives.Action>
>(({ className, ...props }, ref) => (
  <ToastPrimitives.Action
    ref={ref}
    className={cn(
      "inline-flex h-9 shrink-0 items-center justify-center rounded-xl border border-white/10 bg-white/5 px-3 text-sm font-medium text-foreground ring-offset-background transition-colors hover:bg-white/10 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-1 group-[.destructive]:border-red-200/20 group-[.destructive]:bg-red-50/10 group-[.destructive]:text-red-50 group-[.destructive]:hover:bg-red-50/15 group-[.destructive]:focus:ring-red-300 disabled:pointer-events-none disabled:opacity-50",
      className,
    )}
    {...props}
  />
));
ToastAction.displayName = ToastPrimitives.Action.displayName;

const ToastClose = React.forwardRef<
  React.ElementRef<typeof ToastPrimitives.Close>,
  React.ComponentPropsWithoutRef<typeof ToastPrimitives.Close>
>(({ className, ...props }, ref) => (
  <ToastPrimitives.Close
    ref={ref}
    className={cn(
      "absolute right-3 top-3 inline-flex h-8 w-8 items-center justify-center rounded-lg border border-white/10 bg-black/10 text-foreground/80 opacity-100 transition-colors hover:bg-white/10 hover:text-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-1 group-[.destructive]:border-red-200/20 group-[.destructive]:bg-red-950/30 group-[.destructive]:text-red-100 group-[.destructive]:hover:bg-red-900/50 group-[.destructive]:focus:ring-red-300",
      className,
    )}
    toast-close=""
    aria-label="Zamknij powiadomienie"
    {...props}
  >
    <X className="h-4 w-4" />
  </ToastPrimitives.Close>
));
ToastClose.displayName = ToastPrimitives.Close.displayName;

const ToastTitle = React.forwardRef<
  React.ElementRef<typeof ToastPrimitives.Title>,
  React.ComponentPropsWithoutRef<typeof ToastPrimitives.Title>
>(({ className, ...props }, ref) => (
  <ToastPrimitives.Title ref={ref} className={cn("text-sm font-semibold leading-none tracking-tight", className)} {...props} />
));
ToastTitle.displayName = ToastPrimitives.Title.displayName;

const ToastDescription = React.forwardRef<
  React.ElementRef<typeof ToastPrimitives.Description>,
  React.ComponentPropsWithoutRef<typeof ToastPrimitives.Description>
>(({ className, ...props }, ref) => (
  <ToastPrimitives.Description
    ref={ref}
    className={cn("text-sm leading-snug text-foreground/80 group-[.destructive]:text-red-50/90", className)}
    {...props}
  />
));
ToastDescription.displayName = ToastPrimitives.Description.displayName;

type ToastProps = React.ComponentPropsWithoutRef<typeof Toast>;

type ToastActionElement = React.ReactElement<typeof ToastAction>;

export {
  type ToastProps,
  type ToastActionElement,
  ToastProvider,
  ToastViewport,
  Toast,
  ToastTitle,
  ToastDescription,
  ToastClose,
  ToastAction,
};
