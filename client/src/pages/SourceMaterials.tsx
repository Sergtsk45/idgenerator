/**
 * @file: SourceMaterials.tsx
 * @description: Страница списка материалов объекта (/source/materials).
 * @dependencies: hooks/use-source-data, hooks/use-materials, components/materials/*
 * @created: 2026-02-01
 */

import { useMemo, useState } from "react";
import { useLocation } from "wouter";
import { ResponsiveShell } from "@/components/ResponsiveShell";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { AlertTriangle, ChevronRight, Loader2, Package, Plus, Search } from "lucide-react";
import { useCurrentObject } from "@/hooks/use-source-data";
import { useProjectMaterials } from "@/hooks/use-materials";
import { MaterialCard, type ProjectMaterialListItem } from "@/components/materials/MaterialCard";
import { MaterialWizard } from "@/components/materials/MaterialWizard";
import { InvoiceImportButton } from "@/components/materials/InvoiceImportButton";
import { InvoicePreviewDialog } from "@/components/materials/InvoicePreviewDialog";
import { TariffGuard } from "@/components/TariffGuard";
import { UpgradePrompt } from "@/components/UpgradePrompt";
import { useLanguageStore } from "@/lib/i18n";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";

type Filter = "all" | "catalog" | "local" | "attention";

export default function SourceMaterials() {
  const [, setLocation] = useLocation();
  const { language } = useLanguageStore();
  const { toast } = useToast();
  const currentObject = useCurrentObject();
  const objectId = currentObject.data?.id;

  const materialsQuery = useProjectMaterials(objectId);

  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<Filter>("all");
  const [wizardOpen, setWizardOpen] = useState(false);
  const [parsedInvoice, setParsedInvoice] = useState<any>(null);
  const [previewDialogOpen, setPreviewDialogOpen] = useState(false);
  const [selectedMaterial, setSelectedMaterial] = useState<any>(null);

  const list = (materialsQuery.data ?? []) as any[];
  const canAddMaterial = Number.isFinite(objectId) && (objectId as number) > 0;

  const openWizard = () => {
    if (!canAddMaterial) {
      toast({
        title: language === "ru" ? "Объект ещё не загружен" : "Object is not loaded yet",
        description:
          language === "ru"
            ? "Подождите загрузки объекта и попробуйте снова."
            : "Wait until the object loads and try again.",
        variant: "destructive",
      });
      return;
    }
    setWizardOpen(true);
  };

  const handleInvoiceParsed = (data: any) => {
    setParsedInvoice(data);
    setPreviewDialogOpen(true);
  };

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return list
      .filter((m: any) => {
        if (filter === "catalog") return m.catalogMaterialId != null;
        if (filter === "local") return m.catalogMaterialId == null;
        if (filter === "attention") return !m.hasUseInActsQualityDoc;
        return true;
      })
      .filter((m: any) => {
        if (!q) return true;
        const title = String(m.nameOverride ?? `Материал #${m.id}`).toLowerCase();
        return title.includes(q);
      });
  }, [filter, list, search]);

  const filterLabels: Record<Filter, string> = {
    all: language === "ru" ? "Все" : "All",
    catalog: language === "ru" ? "Справочник" : "Catalog",
    local: language === "ru" ? "Локальные" : "Local",
    attention: "⚠",
  };

  return (
    <ResponsiveShell
      className="min-h-screen h-[100dvh] bg-background bg-grain"
      title={language === "ru" ? "Материалы" : "Materials"}
      subtitle={
        currentObject.data?.title
          ? `${language === "ru" ? "ПРОЕКТ" : "PROJECT"}: ${currentObject.data.title}`
          : undefined
      }
      showObjectSelector
    >

      <div className="flex-1 overflow-hidden flex flex-col lg:flex-row">
        {/* LEFT PANEL: list */}
        <div className="lg:w-[380px] lg:border-r lg:border-border/50 lg:overflow-y-auto flex-1 px-4 py-4 pb-28 lg:pb-4">
          {/* Поиск */}
          <div className="relative mb-3">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground/60" />
            <Input
              placeholder={language === "ru" ? "Поиск по названию..." : "Search by name..."}
              className="pl-9 rounded-xl bg-muted/40 border-transparent focus:border-border focus:bg-background h-11 text-[14px]"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>

          {/* Pill-фильтры */}
          <div className="flex gap-2 overflow-x-auto mb-3 pb-0.5">
            {(["all", "catalog", "local", "attention"] as Filter[]).map((f) => (
              <button
                key={f}
                type="button"
                onClick={() => setFilter(f)}
                className={cn(
                  "shrink-0 px-4 py-1.5 rounded-full text-[13px] font-medium transition-colors",
                  filter === f
                    ? "bg-primary text-white"
                    : "bg-muted/60 text-muted-foreground hover:text-foreground"
                )}
              >
                {filterLabels[f]}
              </button>
            ))}
          </div>

          {/* Строка "список позиций (N) Сбросить" */}
          <div className="flex items-center justify-between py-1 mb-2">
            <p className="text-[12px] text-muted-foreground">
              {language === "ru" ? "список позиций" : "positions"} ({filtered.length})
            </p>
            {(search || filter !== "all") && (
              <button
                type="button"
                className="text-[12px] text-primary"
                onClick={() => {
                  setSearch("");
                  setFilter("all");
                }}
              >
                {language === "ru" ? "Сбросить" : "Reset"}
              </button>
            )}
          </div>

          {/* Список карточек */}
          <div className="space-y-3">
            {materialsQuery.isLoading ? (
              <div className="flex items-center justify-center py-10 text-muted-foreground">
                <Loader2 className="h-5 w-5 animate-spin mr-2" />
                {language === "ru" ? "Загрузка..." : "Loading..."}
              </div>
            ) : filtered.length === 0 ? (
              <div className="py-10 text-center text-muted-foreground">
                <div className="mb-3">{language === "ru" ? "Материалы не найдены" : "No materials found"}</div>
                <Button onClick={openWizard} className="rounded-xl">
                  <Plus className="h-4 w-4 mr-2" />
                  {language === "ru" ? "Добавить материал" : "Add material"}
                </Button>
              </div>
            ) : (
              filtered.map((m: any) => (
                <MaterialCard
                  key={m.id}
                  material={m as ProjectMaterialListItem}
                  title={String(m.nameOverride ?? `Материал #${m.id}`)}
                  unit={m.baseUnitOverride ?? m.unit ?? null}
                  isFromCatalog={m.catalogMaterialId != null}
                  warningText={m.warningText ?? null}
                  onOpen={() => {
                    if (window.innerWidth >= 1024) {
                      setSelectedMaterial(m);
                    } else {
                      setLocation(`/source/materials/${m.id}`);
                    }
                  }}
                />
              ))
            )}
          </div>
        </div>

        {/* RIGHT PANEL: detail preview — lg+ only */}
        <div className="hidden lg:flex flex-1 flex-col p-6 overflow-y-auto" data-testid="materials-detail-panel">
          {selectedMaterial == null ? (
            <div className="flex flex-col items-center justify-center flex-1 text-muted-foreground" data-testid="materials-detail-empty">
              <Package className="h-12 w-12 mb-3 opacity-30" />
              <p className="text-base">{language === "ru" ? "Выберите материал из списка" : "Select a material from the list"}</p>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h2 className="text-xl font-semibold" data-testid="material-detail-title">
                    {selectedMaterial.nameOverride ?? `Материал #${selectedMaterial.id}`}
                  </h2>
                  {selectedMaterial.baseUnitOverride && (
                    <p className="text-sm text-muted-foreground mt-1">
                      {language === "ru" ? "Ед. изм." : "Unit"}: {selectedMaterial.baseUnitOverride}
                    </p>
                  )}
                </div>
                <span className="text-xs border border-border rounded-full px-2 py-0.5 text-muted-foreground shrink-0">
                  {selectedMaterial.catalogMaterialId != null
                    ? (language === "ru" ? "Справочник" : "Catalog")
                    : (language === "ru" ? "Локальный" : "Local")}
                </span>
              </div>

              <div className="flex gap-6 p-4 bg-muted/30 rounded-xl">
                <div className="text-center">
                  <p className="text-2xl font-bold">{selectedMaterial.batchesCount ?? 0}</p>
                  <p className="text-xs text-muted-foreground">{language === "ru" ? "Партии" : "Batches"}</p>
                </div>
                <div className="text-center">
                  <p className="text-2xl font-bold">{selectedMaterial.docsCount ?? 0}</p>
                  <p className="text-xs text-muted-foreground">{language === "ru" ? "Документы" : "Docs"}</p>
                </div>
                <div className="text-center">
                  <p className="text-2xl font-bold">{selectedMaterial.qualityDocsCount ?? 0}</p>
                  <p className="text-xs text-muted-foreground">{language === "ru" ? "Кач. документы" : "Quality docs"}</p>
                </div>
              </div>

              {!selectedMaterial.hasUseInActsQualityDoc && (
                <div className="flex items-start gap-2 bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800/40 rounded-xl px-3 py-2">
                  <AlertTriangle className="h-4 w-4 text-amber-500 shrink-0 mt-0.5" />
                  <p className="text-sm text-amber-700 dark:text-amber-300">
                    {language === "ru" ? "Отсутствует документ качества для актов" : "Quality document for acts is missing"}
                  </p>
                </div>
              )}

              <Button
                className="w-full rounded-xl"
                onClick={() => setLocation(`/source/materials/${selectedMaterial.id}`)}
              >
                {language === "ru" ? "Открыть полную карточку" : "Open full card"}
                <ChevronRight className="h-4 w-4 ml-2" />
              </Button>
            </div>
          )}
        </div>
      </div>

      {/* FAB */}
      <div className="fixed bottom-20 right-4 z-40 flex items-center gap-3 md:bottom-6 md:right-6 lg:fixed lg:bottom-6 lg:right-6 lg:left-auto">
        {filter === "local" && Number.isFinite(objectId) && (
          <TariffGuard 
            feature="INVOICE_IMPORT"
            fallback={
              <UpgradePrompt feature="INVOICE_IMPORT" className="max-w-sm" />
            }
          >
            <InvoiceImportButton objectId={objectId as number} onParsed={handleInvoiceParsed} />
          </TariffGuard>
        )}
        <Button
          size="icon"
          className="h-14 w-14 rounded-full shadow-xl bg-primary hover:bg-primary/90 transition-transform hover:scale-105 active:scale-95"
          onClick={openWizard}
          aria-label={language === "ru" ? "Добавить материал" : "Add material"}
        >
          <Plus className="h-6 w-6" />
        </Button>
      </div>

      {Number.isFinite(objectId) ? (
        <>
          <MaterialWizard objectId={objectId as number} open={wizardOpen} onOpenChange={setWizardOpen} />
          <InvoicePreviewDialog
            objectId={objectId as number}
            open={previewDialogOpen}
            onOpenChange={setPreviewDialogOpen}
            parsedData={parsedInvoice}
          />
        </>
      ) : null}

    </ResponsiveShell>
  );
}
