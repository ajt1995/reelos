import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap font-medium transition-[background-color,box-shadow,color,transform,opacity] duration-150 ease-out disabled:pointer-events-none disabled:opacity-40 [&_svg]:pointer-events-none [&_svg]:shrink-0 focus-visible:outline-none focus-visible:shadow-[0_0_0_2px_var(--color-background),0_0_0_4px_var(--color-circuit)]",
  {
    variants: {
      variant: {
        gold: "arena-gold-press bg-gold text-gold-fg hover:bg-gold-bright",
        ghost:
          "bg-transparent text-foreground hover:bg-foreground/6 shadow-[var(--shadow-border)] hover:shadow-[var(--shadow-border-hover)]",
        circuit:
          "bg-transparent text-circuit shadow-[var(--shadow-circuit)] hover:bg-circuit/10",
        quiet: "bg-transparent text-muted hover:text-foreground hover:bg-foreground/5",
        live: "bg-live text-background hover:brightness-110",
        danger: "bg-danger/15 text-danger hover:bg-danger/25",
      },
      size: {
        sm: "h-8 rounded-lg px-3 text-sm",
        md: "h-10 rounded-xl px-4 text-sm",
        lg: "h-11 rounded-xl px-5 text-[15px]",
        icon: "size-9 rounded-xl",
      },
    },
    defaultVariants: { variant: "ghost", size: "md" },
  },
);

export function Button({
  className,
  variant,
  size,
  asChild = false,
  ...props
}: React.ComponentProps<"button"> &
  VariantProps<typeof buttonVariants> & { asChild?: boolean }) {
  const Comp = asChild ? Slot : "button";
  return (
    <Comp className={cn(buttonVariants({ variant, size }), className)} {...props} />
  );
}
