/**
 * @file: SelectActTemplate.tsx
 * @description: Полноэкранная страница выбора типа акта (шаблона) с поиском и группировкой по категориям
 * @dependencies: wouter, @/hooks/use-act-templates, @/components/ui/*
 * @created: 2026-02-24
 */

import { useState, useMemo, useEffect } from "react";
import { useLocation } from "wouter";
import { Header } from "@/components/Header";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useActTemplates } from "@/hooks/use-act-templates";
import { useLanguageStore, translations } from "@/lib/i18n";
import { ChevronDown, Check, Search, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

export default function SelectActTemplate() {
  const [, navigate] = useLocation();
  const { language } = useLanguageStore();
  const t = translations[language].selectActTemplate;

  // Get current selection from history.state (passed from Schedule)
  const currentTemplateId = window.history.state?.currentTemplateId as string | undefined;

  const [search, setSearch] = useState("");
  const [collapsedCategories, setCollapsedCategories] = useState<Set<string>>(new Set());
  const [selectedTemplateId, setSelectedTemplateId] = useState<string | null>(
    currentTemplateId || null
  );

  const { data: templatesData, isLoading, error } = useActTemplates();

  const groupedActTemplates = useMemo(() => {
    const templates = templatesData?.templates ?? [];
    const acc: Record<string, typeof templates> = {};
    for (const tpl of templates) {
      if (!acc[tpl.category]) acc[tpl.category] = [];
      acc[tpl.category].push(tpl);
    }
    return acc;
  }, [templatesData]);

  // Initialize all categories as collapsed, then auto-expand only the one with current selection
  useEffect(() => {
    const allKeys = Object.keys(groupedActTemplates);
    if (allKeys.length === 0) return;
    
    if (!currentTemplateId || search.trim() !== "") {
      // Collapse all categories by default
      setCollapsedCategories(new Set(allKeys));
    } else {
      // Expand only the category with current selection
      const selectedCategory = allKeys.find((key) =>
        (groupedActTemplates[key] ?? []).some((t) => String(t.id) === currentTemplateId)
      );
      if (selectedCategory) {
        setCollapsedCategories(new Set(allKeys.filter((k) => k !== selectedCategory)));
      } else {
        setCollapsedCategories(new Set(allKeys));
      }
    }
  }, [currentTemplateId, groupedActTemplates, search]);

  const handleBack = () => {
    window.history.back();
  };

  const handleSelect = (templateId: string) => {
    // Store selected template ID in sessionStorage (synchronous, no race condition)
    sessionStorage.setItem("selectedActTemplateId", templateId);
    window.history.back();
  };

  const handleClear = () => {
    // Store clear signal in sessionStorage
    sessionStorage.setItem("selectedActTemplateId", "__clear__");
    window.history.back();
  };

  const isSearching = search.trim() !== "";

  return (
    <div className="flex flex-col min-h-screen bg-background">
      <Header title={t.title} showBack onBack={handleBack} showSearch={false} showZapLink={false} />

      <div className="flex-1 overflow-y-auto pb-20">
        <div className="max-w-md mx-auto px-4 py-4 space-y-4">
          {/* Search input */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              type="text"
              placeholder={t.searchPlaceholder}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9"
            />
          </div>

          {/* Clear selection button */}
          {selectedTemplateId && (
            <Button variant="outline" onClick={handleClear} className="w-full">
              {t.clearSelection}
            </Button>
          )}

          {/* Loading state */}
          {isLoading && (
            <div className="flex items-center justify-center py-8 text-muted-foreground">
              <Loader2 className="h-6 w-6 animate-spin mr-2" />
              {t.loading}
            </div>
          )}

          {/* Error state */}
          {error && (
            <div className="text-center py-8 text-destructive">
              {t.errorLoading}
            </div>
          )}

          {/* Templates list */}
          {!isLoading && !error && (
            <div className="space-y-2">
              {!isSearching && Object.keys(groupedActTemplates).length > 0 && (
                <div className="text-xs text-muted-foreground px-3 py-2 border-b">
                  {t.tapToExpand}
                </div>
              )}

              {Object.entries(groupedActTemplates).map(([categoryKey, templates]) => {
                const catInfo = (templatesData?.categories as any)?.[categoryKey];
                const catLabel =
                  language === "ru"
                    ? catInfo?.name ?? categoryKey
                    : catInfo?.nameEn ?? catInfo?.name ?? categoryKey;

                const filtered = isSearching
                  ? templates.filter((tpl) => {
                      const title =
                        language === "ru"
                          ? String(tpl.title ?? "")
                          : String(tpl.titleEn ?? tpl.title ?? "");
                      const searchLower = search.toLowerCase();
                      return (
                        title.toLowerCase().includes(searchLower) ||
                        String(tpl.code ?? "").toLowerCase().includes(searchLower)
                      );
                    })
                  : templates;

                if (filtered.length === 0) return null;

                const isCollapsed = !isSearching && collapsedCategories.has(categoryKey);

                return (
                  <div key={categoryKey} className="border rounded-lg overflow-hidden">
                    {/* Category header */}
                    <button
                      type="button"
                      className="flex w-full items-center justify-between px-4 py-3 hover:bg-accent transition-colors"
                      onClick={() => {
                        if (isSearching) return;
                        setCollapsedCategories((prev) => {
                          const next = new Set(prev);
                          if (next.has(categoryKey)) next.delete(categoryKey);
                          else next.add(categoryKey);
                          return next;
                        });
                      }}
                    >
                      <div className="flex items-center gap-2">
                        {!isSearching && (
                          <ChevronDown
                            className={cn(
                              "h-4 w-4 text-muted-foreground transition-transform duration-200 shrink-0",
                              isCollapsed && "-rotate-90"
                            )}
                          />
                        )}
                        <span className="text-sm font-semibold uppercase tracking-wide text-foreground">
                          {catLabel}
                        </span>
                      </div>
                      <Badge variant="secondary" className="text-xs h-5 px-2 py-0 leading-none">
                        {filtered.length}
                      </Badge>
                    </button>

                    {/* Templates list */}
                    {!isCollapsed && (
                      <div className="border-t">
                        {filtered.map((tpl) => {
                          const isSelected = String(tpl.id) === selectedTemplateId;
                          const title =
                            language === "ru"
                              ? String(tpl.title ?? "")
                              : String(tpl.titleEn ?? tpl.title ?? "");

                          return (
                            <button
                              key={tpl.id}
                              type="button"
                              onClick={() => handleSelect(String(tpl.id))}
                              className={cn(
                                "flex w-full items-start gap-3 px-4 py-3 hover:bg-accent transition-colors border-b last:border-b-0",
                                isSelected && "bg-accent/50"
                              )}
                            >
                              <Check
                                className={cn(
                                  "h-4 w-4 shrink-0 mt-0.5",
                                  isSelected ? "opacity-100 text-primary" : "opacity-0"
                                )}
                              />
                              <div className="flex-1 text-left min-w-0">
                                <div className="font-mono text-xs text-muted-foreground mb-1">
                                  {String(tpl.code ?? "")}
                                </div>
                                <div className="text-sm leading-snug break-words">{title}</div>
                              </div>
                            </button>
                          );
                        })}
                      </div>
                    )}
                  </div>
                );
              })}

              {Object.keys(groupedActTemplates).length === 0 && (
                <div className="text-center py-8 text-muted-foreground">{t.noTemplates}</div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
