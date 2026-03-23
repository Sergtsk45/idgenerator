/**
 * @file: pill-tabs.tsx
 * @description: Odoo-style pill tabs navigation bar. Horizontal scroll, snap, no underline.
 *   Use with Radix Tabs (keeps TabsContent), or standalone with conditional rendering.
 * @dependencies: @/lib/utils
 * @created: 2026-03-22
 */

import * as React from "react";
import { cn } from "@/lib/utils";

export interface PillTab {
  label: string;
  value: string;
  count?: number;
}

export interface PillTabsProps {
  tabs: PillTab[];
  activeTab: string;
  onTabChange: (value: string) => void;
  className?: string;
}

export function PillTabs({ tabs, activeTab, onTabChange, className }: PillTabsProps) {
  return (
    <div
      className={cn(
        "flex gap-2 overflow-x-auto scrollbar-hide pb-0.5 scroll-smooth",
        className
      )}
      style={{ WebkitOverflowScrolling: "touch" }}
    >
      {tabs.map((tab) => {
        const isActive = tab.value === activeTab;
        return (
          <button
            key={tab.value}
            type="button"
            onClick={() => onTabChange(tab.value)}
            className={cn(
              "inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-4 py-1.5 text-[13px] font-medium border transition-colors duration-[--duration-fast] scroll-snap-align-start shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[--p500]",
              isActive
                ? "bg-[--p500] text-white border-[--p500] font-semibold"
                : "bg-transparent border-[--g300] text-[--g700] hover:bg-[--g100]"
            )}
          >
            {tab.label}
            {tab.count !== undefined && (
              <span
                className={cn(
                  "text-[11px] rounded-full px-1.5 py-0 min-w-[18px] text-center",
                  isActive ? "bg-white/20 text-white" : "bg-[--g200] text-[--g700]"
                )}
              >
                {tab.count}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}
