/**
 * @file: odoo-form-section.tsx
 * @description: Odoo-style form section divider with overline label.
 * @dependencies: @/lib/utils
 * @created: 2026-03-22
 */

import * as React from "react";
import { cn } from "@/lib/utils";

export interface OdooFormSectionProps extends React.HTMLAttributes<HTMLDivElement> {
  label: string;
  /** Optional hint below the overline */
  hint?: string;
  /** Required field indicator */
  required?: boolean;
}

export function OdooFormSection({ label, hint, required, className, children, ...props }: OdooFormSectionProps) {
  return (
    <div className={cn("space-y-3", className)} {...props}>
      <div>
        <p className="o-overline">
          {label}
          {required && <span className="text-[--danger] ml-0.5 normal-case not-italic">*</span>}
        </p>
        {hint && <p className="text-[12px] text-[--g500] mt-0.5">{hint}</p>}
      </div>
      {children}
    </div>
  );
}

/** Inline field hint shown below an input */
export function OdooFieldHint({ className, children, ...props }: React.HTMLAttributes<HTMLParagraphElement>) {
  return (
    <p className={cn("text-[12px] text-[--g500] mt-1", className)} {...props}>
      {children}
    </p>
  );
}

/** Inline field error shown below an input */
export function OdooFieldError({ className, children, ...props }: React.HTMLAttributes<HTMLParagraphElement>) {
  return (
    <p
      className={cn(
        "text-[12px] text-[--danger] mt-1 animate-in slide-in-from-top-1 duration-200",
        className
      )}
      {...props}
    >
      {children}
    </p>
  );
}
