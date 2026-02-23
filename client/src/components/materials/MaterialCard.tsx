/**
 * @file: MaterialCard.tsx
 * @description: Карточка материала в списке материалов объекта (с агрегатами партий/документов и индикатором готовности к актам).
 * @dependencies: components/ui/*, lib/i18n, lucide-react
 * @created: 2026-02-01
 */

import { AlertTriangle, CheckCircle2, ChevronRight, FileText, Package } from "lucide-react";
import { useLanguageStore } from "@/lib/i18n";
import { cn } from "@/lib/utils";

export type ProjectMaterialListItem = {
  id: number;
  nameOverride?: string | null;
  baseUnitOverride?: string | null;
  batchesCount: number;
  docsCount: number;
  qualityDocsCount: number;
  hasUseInActsQualityDoc: boolean;
  catalogMaterialId?: number | null;
};

interface MaterialCardProps {
  material: ProjectMaterialListItem;
  title?: string;
  onOpen?: () => void;
  unit?: string | null;
  isFromCatalog?: boolean;
  warningText?: string | null;
}

export function MaterialCard({ material, title: titleProp, onOpen, unit, isFromCatalog, warningText }: MaterialCardProps) {
  const { language } = useLanguageStore();

  const title = titleProp ?? (material.nameOverride?.trim() || `Материал #${material.id}`);
  const showWarning = !material.hasUseInActsQualityDoc || warningText;

  return (
    <div
      className={cn(
        "bg-card border border-border/60 rounded-2xl overflow-hidden cursor-pointer",
        "active:scale-[0.99] transition-transform"
      )}
      onClick={onOpen}
    >
      <div className="p-4 space-y-3">
        {/* Строка 1: название + badge типа + статус-иконка */}
        <div className="flex items-start justify-between gap-2">
          <div className="flex-1 min-w-0">
            <p className="font-semibold text-[15px] leading-snug">{title}</p>
            {unit && (
              <p className="text-[12px] text-muted-foreground mt-0.5">
                {language === "ru" ? "Единица измерения" : "Unit"}: {unit}
              </p>
            )}
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <span className="text-[11px] border border-border rounded-full px-2 py-0.5 text-muted-foreground whitespace-nowrap">
              {isFromCatalog
                ? language === "ru" ? "Справочник" : "Catalog"
                : language === "ru" ? "Локальный" : "Local"}
            </span>
            {material.hasUseInActsQualityDoc ? (
              <CheckCircle2 className="h-5 w-5 text-emerald-500 shrink-0" />
            ) : (
              <AlertTriangle className="h-5 w-5 text-amber-500 shrink-0" />
            )}
          </div>
        </div>

        {/* Строка 2: счётчики ПАРТИИ и ДОКУМЕНТЫ */}
        <div className="flex gap-6">
          <div className="flex items-center gap-2">
            <Package className="h-4 w-4 text-muted-foreground/60" />
            <div>
              <p className="text-[10px] uppercase tracking-wider text-muted-foreground">
                {language === "ru" ? "ПАРТИИ" : "BATCHES"}
              </p>
              <p className="text-[16px] font-bold leading-tight">{material.batchesCount}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <FileText className="h-4 w-4 text-muted-foreground/60" />
            <div>
              <p className="text-[10px] uppercase tracking-wider text-muted-foreground">
                {language === "ru" ? "ДОКУМЕНТЫ" : "DOCUMENTS"}
              </p>
              <p className="text-[16px] font-bold leading-tight">{material.docsCount}</p>
            </div>
          </div>
        </div>

        {/* Warning block */}
        {showWarning && (
          <div className="flex items-start gap-2 bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800/40 rounded-xl px-3 py-2">
            <AlertTriangle className="h-4 w-4 text-amber-500 shrink-0 mt-0.5" />
            <p className="text-[12px] text-amber-700 dark:text-amber-300">
              {warningText ?? (language === "ru" ? "Отсутствует документ качества" : "Quality document missing")}
            </p>
          </div>
        )}

        {/* Кнопка Подробнее */}
        {onOpen && (
          <div className="flex justify-end">
            <button
              type="button"
              className="text-[13px] font-medium text-primary flex items-center gap-0.5"
              onClick={(e) => {
                e.stopPropagation();
                onOpen();
              }}
            >
              {language === "ru" ? "Подробнее" : "Details"}
              <ChevronRight className="h-3.5 w-3.5" />
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
