/**
 * @file: odoo-table.tsx
 * @description: Odoo-style table wrapper: sticky header, horizontal scroll, zebra rows, hover.
 *   NOTE: Do NOT use for WorkLog sections 1/2/4/5 — those have fixed headers.
 * @dependencies: @/lib/utils
 * @created: 2026-03-22
 */

import * as React from "react";
import { cn } from "@/lib/utils";

// ─── Wrapper ──────────────────────────────────────────────────────────────────

export interface OdooTableProps extends React.HTMLAttributes<HTMLDivElement> {
  /** Show mobile scroll hint on small screens */
  showScrollHint?: boolean;
}

export function OdooTable({ className, children, showScrollHint = true, ...props }: OdooTableProps) {
  return (
    <div className={cn("relative", className)} {...props}>
      {showScrollHint && (
        <p className="md:hidden text-[11px] text-[--g500] text-center mb-1 select-none">
          ← Прокрутите →
        </p>
      )}
      <div className="overflow-x-auto -webkit-overflow-scrolling-touch border border-[--g200] rounded-[--o-radius-lg]">
        <table className="w-full border-collapse text-left">{children}</table>
      </div>
    </div>
  );
}

// ─── Head ─────────────────────────────────────────────────────────────────────

export function OdooTHead({ className, ...props }: React.HTMLAttributes<HTMLTableSectionElement>) {
  return (
    <thead
      className={cn("sticky top-0 bg-[--g100] border-b-2 border-[--g300]", className)}
      {...props}
    />
  );
}

export function OdooTh({ className, numeric, ...props }: React.ThHTMLAttributes<HTMLTableCellElement> & { numeric?: boolean }) {
  return (
    <th
      className={cn(
        "text-[12px] font-semibold uppercase tracking-[0.03em] text-[--g700] whitespace-nowrap px-3 py-2",
        numeric && "text-right font-mono tabular-nums",
        className
      )}
      {...props}
    />
  );
}

// ─── Body ─────────────────────────────────────────────────────────────────────

export function OdooTBody({ className, ...props }: React.HTMLAttributes<HTMLTableSectionElement>) {
  return <tbody className={cn("divide-y divide-[--g200]", className)} {...props} />;
}

export function OdooTr({ className, ...props }: React.HTMLAttributes<HTMLTableRowElement>) {
  return (
    <tr
      className={cn("even:bg-[--g50] hover:bg-[--p50] transition-colors duration-[--duration-fast]", className)}
      {...props}
    />
  );
}

export function OdooTd({ className, numeric, ...props }: React.TdHTMLAttributes<HTMLTableCellElement> & { numeric?: boolean }) {
  return (
    <td
      className={cn(
        "text-[13px] px-3 py-[10px]",
        numeric && "text-right font-mono tabular-nums text-[12px]",
        className
      )}
      {...props}
    />
  );
}

// ─── Footer ───────────────────────────────────────────────────────────────────

export function OdooTFoot({ className, ...props }: React.HTMLAttributes<HTMLTableSectionElement>) {
  return (
    <tfoot
      className={cn("bg-[--g100] border-t-2 border-[--g300] font-semibold", className)}
      {...props}
    />
  );
}
