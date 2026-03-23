import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

const badgeVariants = cva(
  "whitespace-nowrap inline-flex items-center rounded-md border px-2.5 py-0.5 text-xs font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2" +
  " hover-elevate " ,
  {
    variants: {
      variant: {
        default:
          "border-transparent bg-primary text-primary-foreground shadow-xs",
        secondary: "border-transparent bg-secondary text-secondary-foreground",
        destructive:
          "border-transparent bg-destructive text-destructive-foreground shadow-xs",
        outline: " border [border-color:var(--badge-outline)] shadow-xs",
        // ─── Odoo semantic badges ─────────────────────────────────────
        // pill-shaped, no border, uppercase tracking
        success: "border-0 rounded-full px-2.5 py-0.5 text-[11px] font-semibold uppercase tracking-[0.03em] bg-[--success-bg] text-[--success]",
        warning: "border-0 rounded-full px-2.5 py-0.5 text-[11px] font-semibold uppercase tracking-[0.03em] bg-[--warning-bg] text-[--warning]",
        danger:  "border-0 rounded-full px-2.5 py-0.5 text-[11px] font-semibold uppercase tracking-[0.03em] bg-[--danger-bg]  text-[--danger]",
        info:    "border-0 rounded-full px-2.5 py-0.5 text-[11px] font-semibold uppercase tracking-[0.03em] bg-[--info-bg]    text-[--info]",
        neutral: "border-0 rounded-full px-2.5 py-0.5 text-[11px] font-semibold uppercase tracking-[0.03em] bg-[--g200]       text-[--g700]",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  },
)

export interface BadgeProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps) {
  return (
    <div className={cn(badgeVariants({ variant }), className)} {...props} />
  );
}

export { Badge, badgeVariants }
