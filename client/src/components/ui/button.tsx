import * as React from "react"
import { Slot } from "@radix-ui/react-slot"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0" +
  " hover-elevate active-elevate-2",
  {
    variants: {
      variant: {
        default:
          "bg-primary text-white border border-primary-border",
        destructive:
          "bg-destructive text-destructive-foreground border border-destructive-border",
        outline:
          " border [border-color:var(--button-outline)]  shadow-xs active:shadow-none ",
        secondary: "border bg-secondary text-secondary-foreground border border-secondary-border ",
        ghost: "border border-transparent",
        // ─── Odoo variants ───────────────────────────────────────────
        "odoo-primary":
          "bg-[--p500] text-white rounded-full px-5 hover:bg-[--p700] active:bg-[--p700] transition-colors duration-[--duration-fast] border-0",
        "odoo-secondary":
          "bg-transparent border border-[--g300] text-[--g700] rounded-full px-5 hover:bg-[--g100] active:bg-[--g200] transition-colors duration-[--duration-fast]",
        "odoo-ghost":
          "bg-transparent border border-transparent text-[--p500] rounded-[--o-radius-md] hover:bg-[--p50] active:bg-[--p100] transition-colors duration-[--duration-fast]",
        "odoo-icon":
          "bg-transparent border border-transparent rounded-[--o-radius-md] text-[--g700] hover:bg-[--g100] active:bg-[--g200] transition-colors duration-[--duration-fast]",
        "odoo-fab":
          "rounded-full bg-[--p500] text-white shadow-[--o-shadow-lg] fixed bottom-[88px] right-4 hover:bg-[--p700] transition-colors duration-[--duration-fast] border-0 z-50",
      },
      size: {
        default: "min-h-9 px-4 py-2",
        sm: "min-h-8 rounded-md px-3 text-xs",
        lg: "min-h-10 rounded-md px-8",
        icon: "h-9 w-9",
        // ─── Odoo sizes ──────────────────────────────────────────────
        cta:     "h-12 px-6 text-base",
        std:     "h-10 px-5",
        compact: "h-8 px-3 text-xs",
        "odoo-icon-sm": "h-9 w-9 p-0",
        "odoo-fab-size": "h-14 w-14 p-0",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  },
)

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : "button"
    return (
      <Comp
        className={cn(buttonVariants({ variant, size, className }))}
        ref={ref}
        {...props}
      />
    )
  },
)
Button.displayName = "Button"

export { Button, buttonVariants }
