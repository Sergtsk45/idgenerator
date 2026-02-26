/**
 * @file: SelectTaskMaterials.tsx
 * @description: Полноэкранная страница управления материалами задачи графика с автосохранением
 * @dependencies: wouter, @/hooks/use-task-materials, @/hooks/use-materials, @/components/ui/*
 * @created: 2026-02-24
 */

import { useState, useMemo, useEffect, useCallback, useRef } from "react";
import { useLocation } from "wouter";
import { Header } from "@/components/Header";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { useTaskMaterials, useReplaceTaskMaterials } from "@/hooks/use-task-materials";
import { useProjectMaterials } from "@/hooks/use-materials";
import { useCurrentObject } from "@/hooks/use-source-data";
import { useLanguageStore, translations } from "@/lib/i18n";
import { useToast } from "@/hooks/use-toast";
import { Search, Loader2, Plus, Trash2, ChevronUp, ChevronDown, Check } from "lucide-react";

type MaterialItem = {
  projectMaterialId: number;
  batchId: number | null;
  qualityDocumentId: number | null;
  note: string | null;
};

type ProjectMaterial = {
  id: number;
  nameOverride?: string | null;
  name?: string | null;
  catalogMaterial?: { name?: string } | null;
};

export default function SelectTaskMaterials() {
  const [, navigate] = useLocation();
  const { language } = useLanguageStore();
  const t = translations[language].selectTaskMaterials;
  const { toast } = useToast();

  // Get taskId from history.state
  const taskId = window.history.state?.taskId as number | undefined;

  const { data: currentObject } = useCurrentObject();
  const objectId = currentObject?.id;
  const { data: projectMaterials = [], isLoading: isLoadingMaterials } = useProjectMaterials(objectId);
  const { data: taskMaterialsData, isLoading: isLoadingTaskMaterials } = useTaskMaterials(taskId);
  const replaceTaskMaterials = useReplaceTaskMaterials(taskId);

  const [materials, setMaterials] = useState<MaterialItem[]>([]);
  const [addDialogOpen, setAddDialogOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);

  // Initialize materials from loaded data
  useEffect(() => {
    if (!taskMaterialsData) return;
    const list = (taskMaterialsData as Array<{
      projectMaterialId: number;
      batchId?: number | null;
      qualityDocumentId?: number | null;
      note?: string | null;
    }>).map((r) => ({
      projectMaterialId: Number(r.projectMaterialId),
      batchId: r.batchId == null ? null : Number(r.batchId),
      qualityDocumentId: r.qualityDocumentId == null ? null : Number(r.qualityDocumentId),
      note: r.note ?? null,
    }));
    setMaterials(list);
    setHasUnsavedChanges(false);
  }, [taskMaterialsData]);

  // Save changes manually
  const saveChanges = useCallback(async () => {
    if (!taskId) {
      console.warn("Cannot save materials: taskId is missing");
      return;
    }
    try {
      setIsSaving(true);
      await replaceTaskMaterials.mutateAsync({
        items: materials.map((it, idx) => ({
          projectMaterialId: it.projectMaterialId,
          batchId: it.batchId ?? null,
          qualityDocumentId: it.qualityDocumentId ?? null,
          note: it.note ?? null,
          orderIndex: idx,
        })),
      });
      setHasUnsavedChanges(false);
      toast({
        title: t.saved,
        duration: 1800,
      });
    } catch (err: any) {
      toast({
        title: t.errorLoading,
        description: err?.message || "Failed to save materials",
        variant: "destructive",
      });
    } finally {
      setIsSaving(false);
    }
  }, [taskId, materials, replaceTaskMaterials, toast, t]);

  const handleBack = async () => {
    // Save before leaving if there are unsaved changes
    if (hasUnsavedChanges) {
      await saveChanges();
    }
    window.history.back();
  };

  const projectMaterialsMap = useMemo(() => {
    const map = new Map<number, ProjectMaterial>();
    for (const m of projectMaterials as ProjectMaterial[]) {
      map.set(Number(m.id), m);
    }
    return map;
  }, [projectMaterials]);

  const getMaterialLabel = useCallback((materialId: number): string => {
    const m = projectMaterialsMap.get(materialId);
    if (!m) return `Material #${materialId}`;
    return (
      String(m.nameOverride ?? "").trim() ||
      String(m.name ?? "").trim() ||
      (m.catalogMaterial?.name ? String(m.catalogMaterial.name) : "") ||
      `Material #${materialId}`
    );
  }, [projectMaterialsMap]);

  const availableMaterials = useMemo(() => {
    const selectedIds = new Set(materials.map((m) => m.projectMaterialId));
    return (projectMaterials as ProjectMaterial[])
      .filter((m) => !selectedIds.has(Number(m.id)))
      .map((m) => ({
        id: Number(m.id),
        label: getMaterialLabel(Number(m.id)),
      }));
  }, [projectMaterials, materials, getMaterialLabel]);

  const filteredAvailableMaterials = useMemo(() => {
    if (!searchQuery.trim()) return availableMaterials;
    const query = searchQuery.toLowerCase();
    return availableMaterials.filter((m) => m.label.toLowerCase().includes(query));
  }, [availableMaterials, searchQuery]);

  const handleAddMaterial = useCallback((materialId: number) => {
    setMaterials((prev) => [
      ...prev,
      {
        projectMaterialId: materialId,
        batchId: null,
        qualityDocumentId: null,
        note: null,
      },
    ]);
    setHasUnsavedChanges(true);
    setAddDialogOpen(false);
    setSearchQuery("");
  }, []);

  const handleRemoveMaterial = useCallback((index: number) => {
    setMaterials((prev) => prev.filter((_, i) => i !== index));
    setHasUnsavedChanges(true);
  }, []);

  const handleMoveUp = useCallback((index: number) => {
    if (index === 0) return;
    setMaterials((prev) => {
      const newList = [...prev];
      [newList[index - 1], newList[index]] = [newList[index], newList[index - 1]];
      return newList;
    });
    setHasUnsavedChanges(true);
  }, []);

  const handleMoveDown = useCallback((index: number) => {
    setMaterials((prev) => {
      const newList = [...prev];
      [newList[index], newList[index + 1]] = [newList[index + 1], newList[index]];
      return newList;
    });
    setHasUnsavedChanges(true);
  }, []);

  const handleUpdateMaterial = useCallback((index: number, field: keyof MaterialItem, value: number | string | null) => {
    setMaterials((prev) =>
      prev.map((item, i) => (i === index ? { ...item, [field]: value } : item))
    );
    setHasUnsavedChanges(true);
  }, []);

  const validateAndParseNumber = useCallback((value: string): number | null => {
    if (!value.trim()) return null;
    const num = Number(value);
    if (isNaN(num) || num <= 0 || !Number.isInteger(num)) {
      return null;
    }
    return num;
  }, []);

  // Validation: check if taskId is present
  if (!taskId) {
    return (
      <div className="flex flex-col min-h-screen bg-background">
        <Header title={t.title} showBack onBack={handleBack} showSearch={false} showZapLink={false} />
        <div className="flex-1 flex items-center justify-center px-4">
          <div className="text-center space-y-4">
            <p className="text-destructive font-medium">{t.errorLoading}</p>
            <Button onClick={handleBack}>{language === "ru" ? "Вернуться к графику" : "Back to schedule"}</Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col min-h-screen bg-background">
      <Header 
        title={t.title} 
        showBack 
        onBack={handleBack} 
        showSearch={false} 
        showZapLink={false}
        subtitle={isSaving ? (language === "ru" ? "Сохранение..." : "Saving...") : undefined}
      />

      <div className="flex-1 overflow-y-auto pb-24">
        <div className="max-w-2xl mx-auto px-4 py-4 space-y-4">
          {/* Loading state */}
          {(isLoadingTaskMaterials || isLoadingMaterials) && (
            <div className="flex items-center justify-center py-8 text-muted-foreground">
              <Loader2 className="h-6 w-6 animate-spin mr-2" />
              {t.loading}
            </div>
          )}

          {/* Materials list */}
          {!isLoadingTaskMaterials && !isLoadingMaterials && (
            <>
              {/* Add material button */}
              <Button
                variant="outline"
                className="w-full"
                onClick={() => setAddDialogOpen(true)}
              >
                <Plus className="h-4 w-4 mr-2" />
                {t.addMaterial}
              </Button>

              {materials.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground border rounded-lg">
                  {t.noMaterials}
                </div>
              ) : (
                <div className="space-y-3">
                  {materials.map((item, index) => (
                    <div key={index} className="border rounded-lg p-4 space-y-3 bg-card">
                      {/* Material name + actions */}
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium leading-snug break-words">
                            {getMaterialLabel(item.projectMaterialId)}
                          </p>
                        </div>
                        <div className="flex items-center gap-1 shrink-0">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7"
                            onClick={() => handleMoveUp(index)}
                            disabled={index === 0}
                            aria-label={language === "ru" ? "Вверх" : "Move up"}
                          >
                            <ChevronUp className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7"
                            onClick={() => handleMoveDown(index)}
                            disabled={index === materials.length - 1}
                            aria-label={language === "ru" ? "Вниз" : "Move down"}
                          >
                            <ChevronDown className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7 text-destructive"
                            onClick={() => handleRemoveMaterial(index)}
                            aria-label={t.remove}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>

                      {/* Batch ID */}
                      <div className="grid gap-1.5">
                        <label className="text-xs font-medium text-muted-foreground">
                          {t.batch}
                        </label>
                        <Input
                          type="number"
                          min="1"
                          step="1"
                          value={item.batchId ?? ""}
                          onChange={(e) =>
                            handleUpdateMaterial(
                              index,
                              "batchId",
                              validateAndParseNumber(e.target.value)
                            )
                          }
                          placeholder={language === "ru" ? "Номер партии" : "Batch number"}
                          className="h-9 text-sm"
                        />
                      </div>

                      {/* Quality Document ID */}
                      <div className="grid gap-1.5">
                        <label className="text-xs font-medium text-muted-foreground">
                          {t.qualityDoc}
                        </label>
                        <Input
                          type="number"
                          min="1"
                          step="1"
                          value={item.qualityDocumentId ?? ""}
                          onChange={(e) =>
                            handleUpdateMaterial(
                              index,
                              "qualityDocumentId",
                              validateAndParseNumber(e.target.value)
                            )
                          }
                          placeholder={language === "ru" ? "ID документа" : "Document ID"}
                          className="h-9 text-sm"
                        />
                      </div>

                      {/* Note */}
                      <div className="grid gap-1.5">
                        <label className="text-xs font-medium text-muted-foreground">
                          {t.note}
                        </label>
                        <Textarea
                          value={item.note ?? ""}
                          onChange={(e) =>
                            handleUpdateMaterial(index, "note", e.target.value || null)
                          }
                          placeholder={language === "ru" ? "Примечание" : "Note"}
                          className="text-sm resize-none"
                          rows={2}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* Saving indicator */}
              {isSaving && (
                <div className="flex items-center justify-center text-xs text-muted-foreground">
                  <Loader2 className="h-3 w-3 animate-spin mr-1.5" />
                  {language === "ru" ? "Сохранение..." : "Saving..."}
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {/* Add material dialog */}
      <Dialog open={addDialogOpen} onOpenChange={setAddDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{t.addMaterial}</DialogTitle>
          </DialogHeader>

          <div className="grid gap-4">
            {/* Empty state: no materials in project */}
            {(projectMaterials as ProjectMaterial[]).length === 0 && availableMaterials.length === 0 ? (
              <div className="text-center py-8 space-y-4">
                <p className="text-sm text-muted-foreground">
                  {language === "ru" 
                    ? "Сначала добавьте материалы в проект" 
                    : "Add materials to project first"}
                </p>
                <Button
                  onClick={() => {
                    setAddDialogOpen(false);
                    navigate("/source/materials");
                  }}
                >
                  {language === "ru" ? "Перейти к материалам" : "Go to materials"}
                </Button>
              </div>
            ) : (projectMaterials as ProjectMaterial[]).length > 0 && availableMaterials.length === 0 ? (
              <div className="text-center py-8">
                <p className="text-sm text-muted-foreground">
                  {language === "ru" 
                    ? "Все материалы уже добавлены в задачу" 
                    : "All materials already added to task"}
                </p>
              </div>
            ) : (
              <>
                {/* Search input */}
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    type="text"
                    placeholder={t.searchPlaceholder}
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-9"
                  />
                </div>

                {/* Materials list */}
                <div className="max-h-[300px] overflow-y-auto border rounded-lg">
                  {filteredAvailableMaterials.length === 0 ? (
                    <div className="text-center py-8 text-sm text-muted-foreground">
                      {language === "ru" ? "Материалы не найдены" : "No materials found"}
                    </div>
                  ) : (
                    <div className="divide-y">
                      {filteredAvailableMaterials.map((m) => (
                        <button
                          key={m.id}
                          type="button"
                          onClick={() => handleAddMaterial(m.id)}
                          className="flex w-full items-center gap-3 px-4 py-3 hover:bg-accent transition-colors text-left"
                        >
                          <Check className="h-4 w-4 shrink-0 opacity-0" />
                          <span className="text-sm flex-1 min-w-0 break-words">{m.label}</span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setAddDialogOpen(false)}>
              {t.cancel}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Floating save button */}
      {hasUnsavedChanges && (
        <div className="fixed bottom-4 left-0 right-0 flex justify-center px-4 z-50">
          <Button
            onClick={saveChanges}
            disabled={isSaving}
            size="lg"
            className="shadow-lg min-w-[200px]"
          >
            {isSaving ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
                {language === "ru" ? "Сохранение..." : "Saving..."}
              </>
            ) : (
              language === "ru" ? "Сохранить изменения" : "Save changes"
            )}
          </Button>
        </div>
      )}
    </div>
  );
}
