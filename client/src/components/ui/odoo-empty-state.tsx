/**
 * @file: odoo-empty-state.tsx
 * @description: Empty state component: icon + title + hint + CTA button.
 * @dependencies: @/lib/utils
 * @created: 2026-03-22
 */

import * as React from "react";
import { cn } from "@/lib/utils";

export interface OdooEmptyStateProps extends React.HTMLAttributes<HTMLDivElement> {
  icon?: React.ReactNode;
  title: string;
  hint?: string;
  action?: React.ReactNode;
}

export function OdooEmptyState({ icon, title, hint, action, className, ...props }: OdooEmptyStateProps) {
  return (
    <div
      className={cn("flex flex-col items-center justify-center py-12 px-4 text-center", className)}
      {...props}
    >
      {icon && (
        <div className="mb-4 text-[--g300] [&_svg]:h-12 [&_svg]:w-12 [&_svg]:stroke-[1]">
          {icon}
        </div>
      )}
      <p className="text-base font-semibold text-[--g700] mb-1">{title}</p>
      {hint && <p className="text-[13px] text-[--g500] mb-4 max-w-xs">{hint}</p>}
      {action && <div>{action}</div>}
    </div>
  );
}
