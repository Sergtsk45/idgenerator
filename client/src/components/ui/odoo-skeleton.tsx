/**
 * @file: odoo-skeleton.tsx
 * @description: Shimmer skeleton loaders: SkeletonCard, SkeletonTableRow, SkeletonListItem.
 *   Use in place of spinners for initial data loads. Spinner stays only for inline actions.
 * @dependencies: @/lib/utils
 * @created: 2026-03-22
 */

import * as React from "react";
import { cn } from "@/lib/utils";

// ─── Base shimmer ─────────────────────────────────────────────────────────────

function Shimmer({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        "animate-pulse rounded-[--o-radius-md] bg-[--g200]",
        className
      )}
      {...props}
    />
  );
}

// ─── SkeletonCard ─────────────────────────────────────────────────────────────

export interface SkeletonCardProps {
  /** Show a stat-card layout (overline + large number + progress bar) */
  stat?: boolean;
  className?: string;
}

export function SkeletonCard({ stat, className }: SkeletonCardProps) {
  return (
    <div
      className={cn(
        "bg-white border border-[--o-card-border] rounded-[--o-radius-lg] p-4 shadow-[--o-shadow-sm]",
        className
      )}
    >
      {stat ? (
        <>
          <Shimmer className="h-3 w-20 mb-3" />
          <Shimmer className="h-7 w-28 mb-3" />
          <Shimmer className="h-1.5 w-full rounded-full" />
        </>
      ) : (
        <>
          <div className="flex items-center justify-between mb-3">
            <Shimmer className="h-4 w-32" />
            <Shimmer className="h-5 w-16 rounded-full" />
          </div>
          <Shimmer className="h-3 w-full mb-2" />
          <Shimmer className="h-3 w-3/4" />
        </>
      )}
    </div>
  );
}

// ─── SkeletonTableRow ─────────────────────────────────────────────────────────

export interface SkeletonTableRowProps {
  cols?: number;
  className?: string;
}

export function SkeletonTableRow({ cols = 5, className }: SkeletonTableRowProps) {
  return (
    <tr className={cn("border-b border-[--g200]", className)}>
      {Array.from({ length: cols }).map((_, i) => (
        <td key={i} className="px-3 py-[10px]">
          <Shimmer className={cn("h-3", i === 0 ? "w-8" : i === cols - 1 ? "w-16 ml-auto" : "w-full")} />
        </td>
      ))}
    </tr>
  );
}

/** Renders N skeleton rows inside a tbody */
export function SkeletonTableBody({ rows = 5, cols = 5 }: { rows?: number; cols?: number }) {
  return (
    <tbody>
      {Array.from({ length: rows }).map((_, i) => (
        <SkeletonTableRow key={i} cols={cols} />
      ))}
    </tbody>
  );
}

// ─── SkeletonListItem ─────────────────────────────────────────────────────────

export interface SkeletonListItemProps {
  avatar?: boolean;
  className?: string;
}

export function SkeletonListItem({ avatar, className }: SkeletonListItemProps) {
  return (
    <div className={cn("flex items-center gap-3 py-3 border-b border-[--g200]", className)}>
      {avatar && <Shimmer className="h-9 w-9 rounded-full shrink-0" />}
      <div className="flex-1 space-y-2">
        <Shimmer className="h-3.5 w-2/3" />
        <Shimmer className="h-3 w-1/2" />
      </div>
      <Shimmer className="h-5 w-14 rounded-full shrink-0" />
    </div>
  );
}
