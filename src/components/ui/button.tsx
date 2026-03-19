import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

/* Premium Dark button styling: rounded-[18px], mint primary, card secondary */
const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-[18px] font-medium transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:pointer-events-none disabled:opacity-50 active:scale-[0.98] [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        default: "btn-pastel-blue text-[#111111] hover:opacity-90",
        destructive: "bg-[#F2D6DE]/30 text-[#F2D6DE] hover:bg-[#F2D6DE]/40",
        outline: "border border-white/10 bg-transparent text-foreground hover:bg-card",
        secondary: "btn-pastel-mint text-[#111111] hover:opacity-90",
        ghost: "hover:bg-muted hover:text-foreground",
        link: "text-primary underline-offset-4 hover:underline",
        tonal: "bg-muted text-foreground hover:bg-muted/80",
        "pastel-blue": "btn-pastel-blue text-[#111111] hover:opacity-90",
        "pastel-lavender": "btn-pastel-lavender text-[#111111] hover:opacity-90",
        "pastel-pink": "btn-pastel-pink text-[#111111] hover:opacity-90",
        "pastel-mint": "btn-pastel-mint text-[#111111] hover:opacity-90",
        "pastel-peach": "btn-pastel-peach text-[#111111] hover:opacity-90",
        "pastel-lilac": "btn-pastel-lilac text-[#111111] hover:opacity-90",
      },
      size: {
        default: "px-6 py-3 text-base",
        sm: "px-4 py-2 text-sm",
        lg: "px-8 py-4 text-lg",
        icon: "h-10 w-10 p-0",
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
    return (
      <Comp
        className={cn(buttonVariants({ variant, size, className }))}
        ref={ref}
        {...props}
      />
    );
  },
);
Button.displayName = "Button";

export { Button, buttonVariants };
