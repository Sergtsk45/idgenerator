/**
 * @file: SourceMaterials.tsx
 * @description: Страница списка материалов объекта (/source/materials).
 * @dependencies: hooks/use-source-data, hooks/use-materials, components/materials/*
 * @created: 2026-02-01
 */

import { useMemo, useRef, useState, useEffect } from "react";
import { useLocation } from "wouter";
import { ResponsiveShell } from "@/components/ResponsiveShell";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { OdooCard } from "@/components/ui/odoo-card";
import { OdooEmptyState } from "@/components/ui/odoo-empty-state";
import { Badge } from "@/components/ui/badge";
import { PillTabs } from "@/components/ui/pill-tabs";
import { AlertTriangle, ChevronRight, Loader2, Package, Plus, Search } from "lucide-react";
import { useCurrentObject } from "@/hooks/use-source-data";
import { useProjectMaterials, useProjectMaterial } from "@/hooks/use-materials";
import { usePatchDocumentBinding } from "@/hooks/use-documents";
import { type ProjectMaterialListItem } from "@/components/materials/MaterialCard";
import { MaterialDetailView } from "@/components/materials/MaterialDetailView";
import { MaterialWizard } from "@/components/materials/MaterialWizard";
import { ScrollArea } from "@/components/ui/scroll-area";
import { InvoiceImportButton } from "@/components/materials/InvoiceImportButton";
import { InvoicePreviewDialog } from "@/components/materials/InvoicePreviewDialog";
import { TariffGuard } from "@/components/TariffGuard";
import { UpgradePrompt } from "@/components/UpgradePrompt";
import { useLanguageStore } from "@/lib/i18n";
import { useToast } from "@/hooks/use-toast";

const PAGE_SIZE = 20;

function MaterialDetailPanel({ materialId, onOpenFullCard }: { materialId: number; onOpenFullCard: () => void }) {
  const { language } = useLanguageStore();
  const { toast } = useToast();
  const materialQuery = useProjectMaterial(materialId);
  const patchBinding = usePatchDocumentBinding(materialId);

  const data: any = materialQuery.data;
  const material = data?.material;
  const catalog = data?.catalog;
  const title = material ? String(catalog?.name ?? material?.nameOverride ?? `Материал #${materialId}`) : "";
  const baseUnit = material ? ((catalog?.baseUnit ?? material?.baseUnitOverride) as string | null) : null;

  if (materialQuery.isLoading) {
    return (
      <div className="flex items-center justify-center flex-1">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!data || !material) {
    return (
      <div className="flex items-center justify-center flex-1">
        <OdooEmptyState icon={<Package />} title={language === "ru" ? "Материал не найден" : "Material not found"} />
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <div className="flex items-center justify-between px-6 pt-4 pb-2 shrink-0 border-b border-[--g200]">
        <div className="min-w-0 flex-1 mr-3">
          <p className="text-[15px] font-semibold text-[--g900] truncate">{title}</p>
          {baseUnit && <p className="text-[12px] text-[--g500]">{baseUnit}</p>}
        </div>
        <Button variant="odoo-primary" size="compact" onClick={onOpenFullCard} className="shrink-0">
          {language === "ru" ? "Полная карточка" : "Full card"}
          <ChevronRight className="h-4 w-4 ml-1" />
        </Button>
      </div>
      <ScrollArea className="flex-1 min-h-0">
        <div className="px-6 py-4">
          <MaterialDetailView
            materialTitle={title}
            badge={material.catalogMaterialId != null ? "catalog" : "local"}
            baseUnit={baseUnit}
            batches={data.batches ?? []}
            documents={(data.documents ?? []).map((d: any) => ({
              id: Number(d.id),
              docType: String(d.docType ?? ""),
              scope: String(d.scope ?? ""),
              title: d.title ?? null,
              docNumber: d.docNumber ?? null,
              docDate: d.docDate ?? null,
              fileUrl: d.fileUrl ?? null,
            }))}
            bindings={(data.bindings ?? []).map((b: any) => ({
              id: Number(b.id),
              documentId: Number(b.documentId),
              batchId: b.batchId == null ? null : Number(b.batchId),
              bindingRole: String(b.bindingRole ?? "quality"),
              useInActs: Boolean(b.useInActs),
              isPrimary: Boolean(b.isPrimary),
            }))}
            onPatchBinding={(bindingId, patch) =>
              patchBinding.mutate(
                { id: bindingId, patch: patch as any },
                {
                  onError: (e) =>
                    toast({
                      title: language === "ru" ? "Ошибка" : "Error",
                      description: e instanceof Error ? e.message : String(e),
                      variant: "destructive",
                    }),
                }
              )
            }
            onAddBatch={onOpenFullCard}
            onBindDocument={onOpenFullCard}
            onBindDocumentToBatch={onOpenFullCard}
          />
        </div>
      </ScrollArea>
    </div>
  );
}

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
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);
  const sentinelRef = useRef<HTMLDivElement>(null);

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

  // Reset visible count when filter/search changes
  useEffect(() => { setVisibleCount(PAGE_SIZE); }, [filter, search]);

  // Infinite scroll sentinel
  useEffect(() => {
    const el = sentinelRef.current;
    if (!el) return;
    const obs = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting) setVisibleCount((c) => c + PAGE_SIZE); },
      { rootMargin: "120px" }
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, []);

  const filterTabs = [
    { value: "all", label: language === "ru" ? "Все" : "All" },
    { value: "catalog", label: language === "ru" ? "Справочник" : "Catalog" },
    { value: "local", label: language === "ru" ? "Локальные" : "Local" },
    { value: "attention", label: "⚠" },
  ];

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
        <div className="lg:w-[380px] lg:border-r lg:border-[--g200] lg:overflow-y-auto flex-1 px-4 py-4 pb-28 lg:pb-4">
          {/* Поиск */}
          <div className="relative mb-3">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[--g400]" />
            <Input
              placeholder={language === "ru" ? "Поиск по названию..." : "Search by name..."}
              className="pl-9 h-10 text-[14px]"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>

          {/* PillTabs фильтры */}
          <PillTabs
            tabs={filterTabs}
            activeTab={filter}
            onTabChange={(v) => setFilter(v as Filter)}
            className="mb-3"
          />

          {/* Строка счётчик + сброс */}
          <div className="flex items-center justify-between py-1 mb-2">
            <p className="o-overline">
              {language === "ru" ? "позиций" : "positions"}: {filtered.length}
            </p>
            {(search || filter !== "all") && (
              <button
                type="button"
                className="text-[12px] text-[--p500]"
                onClick={() => { setSearch(""); setFilter("all"); }}
              >
                {language === "ru" ? "Сбросить" : "Reset"}
              </button>
            )}
          </div>

          {/* Список карточек (OdooCard) */}
          <div className="space-y-2">
            {materialsQuery.isLoading ? (
              <OdooEmptyState
                icon={<Package />}
                title={language === "ru" ? "Загрузка..." : "Loading..."}
              />
            ) : filtered.length === 0 ? (
              <OdooEmptyState
                icon={<Package />}
                title={language === "ru" ? "Материалы не найдены" : "No materials found"}
                hint={language === "ru" ? "Добавьте первый материал." : "Add your first material."}
                action={
                  <Button variant="odoo-primary" size="compact" onClick={openWizard}>
                    <Plus className="h-4 w-4 mr-1.5" />
                    {language === "ru" ? "Добавить" : "Add"}
                  </Button>
                }
              />
            ) : (
              <>
                {filtered.slice(0, visibleCount).map((m: any) => (
                  <OdooCard
                    key={m.id}
                    hoverable
                    onClick={() => {
                      if (window.innerWidth >= 1024) {
                        setSelectedMaterial(m);
                      } else {
                        setLocation(`/source/materials/${m.id}`);
                      }
                    }}
                  >
                    <div className="p-3 flex items-center gap-3">
                      <div className="h-9 w-9 rounded-[--o-radius-sm] bg-[--p50] flex items-center justify-center text-[--p500] shrink-0">
                        <Package className="h-4 w-4" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-[13px] font-medium text-[--g900] truncate">
                          {m.nameOverride ?? `Материал #${m.id}`}
                        </p>
                        <p className="text-[11px] text-[--g500]">
                          {m.baseUnitOverride ?? m.unit ?? ""}
                          {m.catalogMaterialId != null ? (language === "ru" ? " · Справочник" : " · Catalog") : (language === "ru" ? " · Локальный" : " · Local")}
                        </p>
                      </div>
                      <div className="flex flex-col items-end gap-1 shrink-0">
                        <Badge
                          variant={m.hasUseInActsQualityDoc ? "success" : "warning"}
                          className="text-[10px] px-1.5"
                        >
                          {m.hasUseInActsQualityDoc
                            ? (language === "ru" ? "Доки ✓" : "Docs ✓")
                            : (language === "ru" ? "Нет доков" : "No docs")}
                        </Badge>
                        {!m.hasUseInActsQualityDoc && (
                          <AlertTriangle className="h-3.5 w-3.5 text-amber-500" />
                        )}
                      </div>
                    </div>
                  </OdooCard>
                ))}
                {/* Infinite scroll sentinel */}
                {visibleCount < filtered.length && (
                  <div ref={sentinelRef} className="h-8 flex items-center justify-center">
                    <span className="text-[11px] text-[--g400]">
                      {language === "ru" ? "Загрузка..." : "Loading..."}
                    </span>
                  </div>
                )}
              </>
            )}
          </div>
        </div>

        {/* RIGHT PANEL: full detail — lg+ only */}
        <div className="hidden lg:flex flex-1 flex-col overflow-hidden" data-testid="materials-detail-panel">
          {selectedMaterial == null ? (
            <div className="flex flex-col items-center justify-center flex-1" data-testid="materials-detail-empty">
              <OdooEmptyState
                icon={<Package />}
                title={language === "ru" ? "Выберите материал из списка" : "Select a material from the list"}
              />
            </div>
          ) : (
            <MaterialDetailPanel
              materialId={selectedMaterial.id}
              onOpenFullCard={() => setLocation(`/source/materials/${selectedMaterial.id}`)}
            />
          )}
        </div>
      </div>

      {/* FAB */}
      <div className="fixed bottom-[88px] right-4 z-50 flex flex-row flex-nowrap items-center gap-3 md:bottom-6 md:right-6">
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
          variant="odoo-fab"
          size="odoo-fab-size"
          onClick={openWizard}
          className="!relative !bottom-auto !right-auto"
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
