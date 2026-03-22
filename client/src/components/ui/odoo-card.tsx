/**
 * @file: odoo-card.tsx
 * @description: Odoo-style card component. Replaces .glass-card and shadcn Card.
 * @dependencies: class-variance-authority, @/lib/utils
 * @created: 2026-03-22
 */

import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

// ─── Card root ────────────────────────────────────────────────────────────────

const cardVariants = cva(
  "bg-white border border-[--o-card-border] rounded-[--o-radius-lg] shadow-[--o-shadow-sm] transition-[box-shadow,transform] duration-[--duration-fast]",
  {
    variants: {
      variant: {
        default: "",
        stat:   "",
        status: "border-l-4",
      },
      hoverable: {
        true:  "cursor-pointer hover:shadow-[--o-shadow-md] active:scale-[0.995]",
        false: "",
      },
      padding: {
        none: "p-0",
        sm:   "p-3",
        md:   "p-4",
        lg:   "p-6",
      },
    },
    defaultVariants: {
      variant:  "default",
      hoverable: false,
      padding:  "md",
    },
  }
);

export interface OdooCardProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof cardVariants> {
  /** Slot rendered above the body, inside the card */
  header?: React.ReactNode;
  /** Slot rendered below the body, inside the card */
  footer?: React.ReactNode;
  /** Left border accent color for status variant (any CSS color) */
  statusColor?: string;
}

const OdooCard = React.forwardRef<HTMLDivElement, OdooCardProps>(
  (
    {
      className,
      variant,
      hoverable,
      padding,
      header,
      footer,
      statusColor,
      children,
      style,
      onClick,
      ...props
    },
    ref
  ) => {
    const isClickable = hoverable ?? !!onClick;

    return (
      <div
        ref={ref}
        role={isClickable ? "button" : undefined}
        tabIndex={isClickable ? 0 : undefined}
        className={cn(cardVariants({ variant, hoverable: isClickable, padding }), className)}
        style={
          variant === "status" && statusColor
            ? { borderLeftColor: statusColor, ...style }
            : style
        }
        onClick={onClick}
        {...props}
      >
        {header && <OdooCardHeader>{header}</OdooCardHeader>}
        {children}
        {footer && <OdooCardFooter>{footer}</OdooCardFooter>}
      </div>
    );
  }
);
OdooCard.displayName = "OdooCard";

// ─── Sub-components ───────────────────────────────────────────────────────────

const OdooCardHeader = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={cn("flex items-center justify-between mb-3", className)}
    {...props}
  />
));
OdooCardHeader.displayName = "OdooCardHeader";

const OdooCardFooter = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={cn("flex items-center gap-2 mt-3 pt-3 border-t border-[--g200]", className)}
    {...props}
  />
));
OdooCardFooter.displayName = "OdooCardFooter";

// ─── Stat Card ────────────────────────────────────────────────────────────────

export interface OdooStatCardProps extends React.HTMLAttributes<HTMLDivElement> {
  /** Overline label (small caps) */
  label: string;
  /** Primary numeric value */
  value: React.ReactNode;
  /** Delta indicator: positive/negative string, e.g. "+12%" */
  delta?: string;
  /** Progress bar value 0–100 */
  progress?: number;
  /** Actions slot (buttons) */
  actions?: React.ReactNode;
  hoverable?: boolean;
}

const OdooStatCard = React.forwardRef<HTMLDivElement, OdooStatCardProps>(
  ({ className, label, value, delta, progress, actions, hoverable, onClick, ...props }, ref) => {
    const isPositive = delta ? !delta.startsWith("-") : null;

    return (
      <OdooCard
        ref={ref}
        variant="stat"
        hoverable={hoverable ?? !!onClick}
        onClick={onClick}
        className={className}
        {...props}
      >
        {/* Overline */}
        <p className="o-overline mb-1">{label}</p>

        {/* Value + delta row */}
        <div className="flex items-end gap-2 mb-2">
          <span className="text-2xl font-semibold text-[--g900] leading-none o-numeric">
            {value}
          </span>
          {delta && (
            <span
              className={cn(
                "text-xs font-medium leading-none mb-0.5",
                isPositive ? "text-[--success]" : "text-[--danger]"
              )}
            >
              {delta}
            </span>
          )}
        </div>

        {/* Progress bar */}
        {progress !== undefined && (
          <div className="h-1 rounded-full bg-[--g200] overflow-hidden mb-2">
            <div
              className="h-full rounded-full bg-[--p500] transition-all duration-[--duration-slow]"
              style={{ width: `${Math.min(100, Math.max(0, progress))}%` }}
            />
          </div>
        )}

        {/* Actions */}
        {actions && (
          <div className="flex items-center gap-2 mt-1">{actions}</div>
        )}
      </OdooCard>
    );
  }
);
OdooStatCard.displayName = "OdooStatCard";

// ─── Exports ──────────────────────────────────────────────────────────────────

export { OdooCard, OdooCardHeader, OdooCardFooter, OdooStatCard, cardVariants };
