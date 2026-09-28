import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-xl text-sm font-medium transition-all duration-200 disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg:not([class*='size-'])]:size-4 shrink-0 [&_svg]:shrink-0 outline-none focus-visible:ring-[4px] focus-visible:ring-[#ef3943]/15 focus-visible:border-[#ef3943] aria-invalid:ring-destructive/20 aria-invalid:border-destructive shadow-sm",
  {
    variants: {
      variant: {
        default:
          "border border-[#ef3943] bg-[#ef3943] text-white hover:bg-[#ff4d57] hover:border-[#ff4d57] hover:shadow-[0_12px_24px_rgba(239,57,67,0.28)]",
        destructive:
          "border border-[#ef4444] bg-[#ef4444] text-white hover:bg-[#dc2626] hover:border-[#dc2626] hover:shadow-[0_12px_24px_rgba(239,68,68,0.24)]",
        outline:
          "border border-white/10 bg-[#10151d] text-[#e5ecf6] hover:bg-[#141b24] hover:border-white/16",
        secondary:
          "border border-[#713139]/60 bg-[#251317] text-[#ff777e] hover:bg-[#2a1519] hover:border-[#8a3a44]",
        ghost:
          "border border-transparent bg-transparent text-[#9aa6ba] hover:bg-[#11161f]/[0.05] hover:text-white",
        link: "text-[#ff777e] underline-offset-4 hover:underline shadow-none border-0 bg-transparent px-0",
      },
      size: {
        default: "h-10 px-4 py-2",
        sm: "h-8 rounded-lg gap-1.5 px-3 text-xs",
        lg: "h-11 rounded-xl px-6 text-sm",
        icon: "size-10",
        "icon-sm": "size-8 rounded-lg",
        "icon-lg": "size-11 rounded-xl",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
);

function Button({
  className,
  variant,
  size,
  asChild = false,
  ...props
}: React.ComponentProps<"button"> &
  VariantProps<typeof buttonVariants> & {
    asChild?: boolean;
  }) {
  const Comp = asChild ? Slot : "button";

  return (
    <Comp
      data-slot="button"
      className={cn(buttonVariants({ variant, size, className }))}
      {...props}
    />
  );
}

export { Button, buttonVariants };
