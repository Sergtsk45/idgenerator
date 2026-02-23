/**
 * @file: SourceMaterials.tsx
 * @description: Страница списка материалов объекта (/source/materials).
 * @dependencies: hooks/use-source-data, hooks/use-materials, components/materials/*
 * @created: 2026-02-01
 */

import { useMemo, useState } from "react";
import { useLocation } from "wouter";
import { Header } from "@/components/Header";
import { BottomNav } from "@/components/BottomNav";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Loader2, Plus, Search } from "lucide-react";
import { useCurrentObject } from "@/hooks/use-source-data";
import { useProjectMaterials } from "@/hooks/use-materials";
import { MaterialCard, type ProjectMaterialListItem } from "@/components/materials/MaterialCard";
import { MaterialWizard } from "@/components/materials/MaterialWizard";
import { useLanguageStore } from "@/lib/i18n";
import { cn } from "@/lib/utils";

type Filter = "all" | "catalog" | "local" | "attention";

export default function SourceMaterials() {
  const [, setLocation] = useLocation();
  const { language } = useLanguageStore();
  const currentObject = useCurrentObject();
  const objectId = currentObject.data?.id;

  const materialsQuery = useProjectMaterials(objectId);

  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<Filter>("all");
  const [wizardOpen, setWizardOpen] = useState(false);

  const list = (materialsQuery.data ?? []) as any[];

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
    <div className="flex flex-col min-h-screen h-[100dvh] bg-background bg-grain">
      <Header
        title={language === "ru" ? "Материалы" : "Materials"}
        subtitle={
          currentObject.data?.title
            ? `${language === "ru" ? "ПРОЕКТ" : "PROJECT"}: ${currentObject.data.title}`
            : undefined
        }
      />

      <div className="flex-1 overflow-y-auto px-4 py-4 pb-28">
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
              <Button onClick={() => setWizardOpen(true)} className="rounded-xl">
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
                onOpen={() => setLocation(`/source/materials/${m.id}`)}
              />
            ))
          )}
        </div>
      </div>

      {/* FAB */}
      <div className="fixed bottom-20 right-4 z-40">
        {Number.isFinite(objectId) ? (
          <Button
            size="icon"
            className="h-14 w-14 rounded-full shadow-xl bg-primary hover:bg-primary/90 transition-transform hover:scale-105 active:scale-95"
            onClick={() => setWizardOpen(true)}
          >
            <Plus className="h-6 w-6" />
          </Button>
        ) : null}
      </div>

      {Number.isFinite(objectId) ? (
        <MaterialWizard objectId={objectId as number} open={wizardOpen} onOpenChange={setWizardOpen} />
      ) : null}

      <BottomNav />
    </div>
  );
}
