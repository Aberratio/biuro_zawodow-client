import * as React from "react";
import { createPortal } from "react-dom";
import { useToast } from "@/hooks/use-toast";
import { Toast, ToastClose, ToastDescription, ToastProvider, ToastTitle, ToastViewport } from "@/components/ui/toast";
import { AlertTriangle, CheckCircle2 } from "lucide-react";

export function Toaster() {
  const { toasts } = useToast();
  const [mounted, setMounted] = React.useState(false);

  React.useEffect(() => {
    setMounted(true);
  }, []);

  const content = (
    <ToastProvider duration={2800}>
      {toasts.map(function ({ id, title, description, action, variant, ...props }) {
        const isDestructive = variant === "destructive";
        const Icon = isDestructive ? AlertTriangle : CheckCircle2;

        return (
          <Toast key={id} variant={variant} {...props}>
            <div
              className={
                isDestructive
                  ? "mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl border border-red-200/20 bg-red-50/10 text-red-100"
                  : "mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl border border-emerald-300/20 bg-emerald-400/10 text-emerald-200"
              }
            >
              <Icon className="h-5 w-5" />
            </div>
            <div className="flex min-w-0 flex-1 items-start gap-3">
              <div className="grid flex-1 gap-1">
                {title && <ToastTitle>{title}</ToastTitle>}
                {description && <ToastDescription>{description}</ToastDescription>}
              </div>
              {action}
            </div>
            <ToastClose />
          </Toast>
        );
      })}
      <ToastViewport />
    </ToastProvider>
  );

  if (!mounted) {
    return null;
  }

  return createPortal(content, document.body);
}
