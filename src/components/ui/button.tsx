import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-xl border text-sm font-medium ring-offset-background transition-all duration-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 disabled:shadow-none [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        default: "surface-button text-foreground hover:-translate-y-0.5",
        destructive: "border-destructive bg-destructive text-destructive-foreground shadow-[0_10px_24px_hsl(var(--destructive)/0.18)] hover:-translate-y-0.5 hover:bg-destructive/90",
        outline: "border-input bg-background/70 text-foreground shadow-[inset_0_1px_0_hsl(var(--foreground)/0.03)] backdrop-blur-sm hover:-translate-y-0.5 hover:bg-accent/80 hover:text-accent-foreground",
        secondary: "border-border/80 bg-secondary/90 text-secondary-foreground shadow-[inset_0_1px_0_hsl(var(--foreground)/0.03)] hover:-translate-y-0.5 hover:bg-secondary",
        ghost: "border-transparent text-foreground/80 shadow-none hover:bg-accent/75 hover:text-accent-foreground",
        link: "text-foreground/80 underline-offset-4 hover:text-[hsl(var(--button-highlight))] hover:underline",
      },
      size: {
        default: "h-10 px-4 py-2",
        sm: "h-9 rounded-lg px-3",
        lg: "h-11 rounded-xl px-8",
        icon: "h-10 w-10",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  },
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : "button";
    return <Comp className={cn(buttonVariants({ variant, size, className }))} ref={ref} {...props} />;
  },
);
Button.displayName = "Button";

export { Button, buttonVariants };
