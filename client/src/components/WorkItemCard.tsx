/**
 * @file: WorkItemCard.tsx
 * @description: Карточка позиции ВОР — компактный дизайн по макету
 * @dependencies: shared/schema (Work), lucide-react
 * @created: 2026-02-23
 */

import { Work } from "@shared/schema";

interface WorkItemCardProps {
  work: Work;
  onClick?: () => void;
}

export function WorkItemCard({ work, onClick }: WorkItemCardProps) {
  return (
    <div
      onClick={onClick}
      className="bg-card border border-border/60 rounded-2xl px-4 py-3 cursor-pointer active:scale-[0.98] transition-transform"
      data-testid={`card-work-${work.id}`}
    >
      <div className="flex items-center justify-between gap-3">
        <span className="font-mono text-[13px] font-semibold text-primary">{work.code}</span>
        <span className="text-[13px] font-semibold text-primary bg-primary/[0.08] px-2.5 py-0.5 rounded-full shrink-0">
          {work.quantityTotal
            ? `${Number(work.quantityTotal).toLocaleString("ru-RU")} ${work.unit}`
            : work.unit}
        </span>
      </div>
      <p className="text-[13px] text-foreground/80 leading-snug mt-1.5 line-clamp-2">
        {work.description}
      </p>
    </div>
  );
}
