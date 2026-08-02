/**
 * @file: MaterialWizard.tsx
 * @description: Мастер добавления материала (4 шага): источник → материал → партия (опц.) → документы (опц.).
 * @dependencies: hooks/use-materials, hooks/use-documents, components/ui/*, materialWizardResult
 * @created: 2026-02-01
 */

import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PillTabs } from "@/components/ui/pill-tabs";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";
import { useCreateProjectMaterial, useMaterialsCatalogSearch } from "@/hooks/use-materials";
import { useCreateDocument, useCreateDocumentBinding, useDocuments } from "@/hooks/use-documents";
import { BatchForm, type BatchDraft } from "@/components/materials/BatchForm";
import {
  bindingRoleFromDocType,
  buildCreatedMaterialResult,
  type CreatedMaterialResult,
  type MaterialWizardSource,
} from "@/components/materials/materialWizardResult";
import { Loader2, Plus } from "lucide-react";
import { api, buildUrl } from "@shared/routes";
import { isQualityBindingRole } from "@shared/documentBinding";

export type { CreatedMaterialResult };

type Step = 1 | 2 | 3 | 4;
type DocScopeFilter = "all" | "project" | "global";

type DocDraft = {
  docType: "certificate" | "declaration" | "passport" | "protocol" | "scheme" | "other";
  scope: "project" | "global";
  title?: string;
  docNumber?: string;
  docDate?: string; // YYYY-MM-DD
  fileUrl?: string;
  useInActs: boolean;
};

export type MaterialWizardProps = {
  objectId: number;
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onCreated?: (result: CreatedMaterialResult) => void | Promise<void>;
  initialSource?: MaterialWizardSource;
  skipSourceStep?: boolean;
};

function documentScopeLabel(scope: string) {
  return scope === "global" ? "Глобальный" : "Проект";
}

export function MaterialWizard(props: MaterialWizardProps) {
  const { toast } = useToast();
  const skipSourceStep = Boolean(props.skipSourceStep);
  const initialSource: MaterialWizardSource = props.initialSource ?? "catalog";

  const [step, setStep] = useState<Step>(skipSourceStep ? 2 : 1);
  const [source, setSource] = useState<MaterialWizardSource>(initialSource);

  // step 2
  const [catalogQuery, setCatalogQuery] = useState("");
  const catalogSearch = useMaterialsCatalogSearch(catalogQuery);
  const [selectedCatalogId, setSelectedCatalogId] = useState<number | null>(null);

  const [nameOverride, setNameOverride] = useState("");
  const [baseUnitOverride, setBaseUnitOverride] = useState("");

  // step 3
  const [addBatch, setAddBatch] = useState(false);
  const [batch, setBatch] = useState<BatchDraft>({});

  // step 4
  const [addDoc, setAddDoc] = useState(false);
  const [docMode, setDocMode] = useState<"registry" | "new">("new");
  const [docSearch, setDocSearch] = useState("");
  const [docScopeFilter, setDocScopeFilter] = useState<DocScopeFilter>("all");
  const [selectedDocumentId, setSelectedDocumentId] = useState<number | null>(null);
  const [docBindTarget, setDocBindTarget] = useState<"material" | "batch">("material");
  const [doc, setDoc] = useState<DocDraft>({
    docType: "certificate",
    scope: "project",
    useInActs: true,
  });

  const createMaterial = useCreateProjectMaterial(props.objectId);
  const createDocument = useCreateDocument();
  const createBinding = useCreateDocumentBinding();
  const docsQuery = useDocuments({ query: docSearch, viewMode: docScopeFilter });

  const isBusy = createMaterial.isPending || createDocument.isPending || createBinding.isPending;

  const canNext = useMemo(() => {
    if (step === 1) return true;
    if (step === 2) {
      if (source === "catalog") return selectedCatalogId != null;
      return nameOverride.trim().length > 0 && baseUnitOverride.trim().length > 0;
    }
    return true;
  }, [step, source, selectedCatalogId, nameOverride, baseUnitOverride]);

  const reset = () => {
    setStep(skipSourceStep ? 2 : 1);
    setSource(initialSource);
    setCatalogQuery("");
    setSelectedCatalogId(null);
    setNameOverride("");
    setBaseUnitOverride("");
    setAddBatch(false);
    setBatch({});
    setAddDoc(false);
    setDocMode("new");
    setDocSearch("");
    setDocScopeFilter("all");
    setSelectedDocumentId(null);
    setDocBindTarget("material");
    setDoc({ docType: "certificate", scope: "project", useInActs: true });
  };

  useEffect(() => {
    if (!props.open) return;
    setStep(skipSourceStep ? 2 : 1);
    setSource(initialSource);
  }, [props.open, skipSourceStep, initialSource]);

  const close = () => {
    props.onOpenChange(false);
    reset();
  };

  const goBack = () => {
    if (step === 1 || (skipSourceStep && step === 2)) {
      close();
      return;
    }
    setStep((s) => (s - 1) as Step);
  };

  const submit = async () => {
    let materialCreated = false;
    try {
      const material = await createMaterial.mutateAsync({
        ...(source === "catalog" ? { catalogMaterialId: selectedCatalogId } : { nameOverride, baseUnitOverride }),
      } as Parameters<typeof createMaterial.mutateAsync>[0]);

      const projectMaterialId = Number((material as { id: number }).id);
      if (!Number.isFinite(projectMaterialId) || projectMaterialId <= 0) {
        throw new Error("Не удалось создать материал");
      }
      materialCreated = true;

      let createdBatchId: number | null = null;
      let documentId: number | null = null;
      let bindingRole: string | null = null;

      if (addBatch) {
        const url = buildUrl(api.materialBatches.create.path, { id: projectMaterialId });
        const res = await fetch(url, {
          method: api.materialBatches.create.method,
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            supplierName: batch.supplierName || null,
            plant: batch.plant || null,
            batchNumber: batch.batchNumber || null,
            deliveryDate: batch.deliveryDate || null,
            quantity: batch.quantity || null,
            unit: batch.unit || null,
            notes: batch.notes || null,
          }),
          credentials: "include",
        });
        if (!res.ok) {
          const errorData = await res.json().catch(() => ({}));
          throw new Error((errorData as { message?: string }).message || "Failed to create batch");
        }
        const createdBatch = api.materialBatches.create.responses[201].parse(await res.json());
        createdBatchId = Number((createdBatch as { id: number }).id);
      }

      if (addDoc) {
        const selectedExistingDoc =
          docMode === "registry"
            ? ((docsQuery.data ?? []) as Array<{ id: number; docType?: string }>).find(
                (d) => Number(d.id) === selectedDocumentId,
              )
            : null;

        if (docMode === "registry" && !selectedExistingDoc) {
          throw new Error("Выберите документ из реестра");
        }

        const documentForBinding =
          selectedExistingDoc ??
          (await createDocument.mutateAsync({
            docType: doc.docType,
            scope: doc.scope,
            title: doc.title || null,
            docNumber: doc.docNumber || null,
            docDate: doc.docDate || null,
            validFrom: null,
            validTo: null,
            meta: {},
            fileUrl: doc.fileUrl || null,
          } as Parameters<typeof createDocument.mutateAsync>[0]));

        documentId = Number((documentForBinding as { id: number }).id);
        const documentType = String(
          (documentForBinding as { docType?: string }).docType ?? doc.docType,
        );
        bindingRole = bindingRoleFromDocType(documentType);

        const batchIdForBinding = addBatch && docBindTarget === "batch" ? createdBatchId : null;

        await createBinding.mutateAsync({
          documentId,
          projectMaterialId,
          objectId: null,
          batchId: batchIdForBinding,
          bindingRole,
          useInActs: isQualityBindingRole(bindingRole) ? doc.useInActs : false,
          isPrimary: false,
        } as Parameters<typeof createBinding.mutateAsync>[0]);
      }

      const catalogName =
        source === "catalog"
          ? String(
              ((catalogSearch.data ?? []) as Array<{ id: number; name?: string }>).find(
                (m) => Number(m.id) === selectedCatalogId,
              )?.name ?? "",
            )
          : null;

      const result = buildCreatedMaterialResult({
        projectMaterialId,
        batchId: createdBatchId,
        documentId,
        bindingRole,
        source,
        nameOverride,
        catalogName,
      });

      if (props.onCreated) {
        try {
          await props.onCreated(result);
        } catch {
          toast({
            title: "Ошибка",
            description:
              "Материал создан, но не удалось добавить его в задачу. Материал доступен в списке материалов объекта.",
            variant: "destructive",
          });
          return;
        }
        toast({
          title: "Готово",
          description: "Материал создан и добавлен в задачу",
        });
      } else {
        toast({ title: "Готово", description: "Материал добавлен" });
      }

      close();
    } catch (e) {
      toast({
        title: "Ошибка",
        description: materialCreated
          ? e instanceof Error
            ? e.message
            : String(e)
          : "Не удалось создать материал. Проверьте заполненные данные и повторите попытку.",
        variant: "destructive",
      });
    }
  };

  return (
    <Dialog open={props.open} onOpenChange={(v) => (v ? props.onOpenChange(true) : close())}>
      <DialogContent className="max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Добавить материал</DialogTitle>
        </DialogHeader>

        {step === 1 && (
          <div className="grid gap-4">
            <div className="text-sm text-muted-foreground">Выберите источник материала.</div>
            <RadioGroup
              value={source}
              onValueChange={(v) => setSource(v as MaterialWizardSource)}
              className="grid gap-3"
            >
              <Label className="flex items-center gap-3 rounded-lg border p-3">
                <RadioGroupItem value="catalog" />
                <div>
                  <div className="font-medium">Из справочника</div>
                  <div className="text-xs text-muted-foreground">Быстро выбрать готовый материал</div>
                </div>
              </Label>
              <Label className="flex items-center gap-3 rounded-lg border p-3">
                <RadioGroupItem value="new" />
                <div>
                  <div className="font-medium">Создать новый</div>
                  <div className="text-xs text-muted-foreground">Локальный материал (можно сохранить в справочник позже)</div>
                </div>
              </Label>
            </RadioGroup>
          </div>
        )}

        {step === 2 && source === "catalog" && (
          <div className="grid gap-4">
            <div className="grid gap-2">
              <Label>Поиск по справочнику</Label>
              <Input value={catalogQuery} onChange={(e) => setCatalogQuery(e.target.value)} placeholder="например: труба DN100" />
            </div>

            <div className="grid gap-2">
              <Label>Выбор</Label>
              <Select value={selectedCatalogId ? String(selectedCatalogId) : ""} onValueChange={(v) => setSelectedCatalogId(Number(v))}>
                <SelectTrigger>
                  <SelectValue placeholder={catalogSearch.isLoading ? "Загрузка..." : "Выберите материал"} />
                </SelectTrigger>
                <SelectContent>
                  {(catalogSearch.data ?? []).slice(0, 50).map((m) => (
                    <SelectItem key={(m as { id: number }).id} value={String((m as { id: number }).id)}>
                      {(m as { name?: string }).name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        )}

        {step === 2 && source === "new" && (
          <div className="grid gap-4">
            <div className="grid gap-2">
              <Label>Наименование</Label>
              <Input value={nameOverride} onChange={(e) => setNameOverride(e.target.value)} placeholder="Труба стальная DN100" />
            </div>
            <div className="grid gap-2">
              <Label>Ед. измерения</Label>
              <Input
                value={baseUnitOverride}
                onChange={(e) => {
                  const v = e.target.value;
                  setBaseUnitOverride(v);
                  // Sync into batch unit only if it's empty (do not override manual input)
                  setBatch((prev) => ({ ...prev, unit: prev.unit ? prev.unit : v }));
                }}
                placeholder="м"
              />
            </div>
          </div>
        )}

        {step === 3 && (
          <div className="grid gap-4">
            <div className="flex items-center justify-between gap-3 rounded-lg border p-3">
              <div>
                <div className="font-medium">Добавить партию/поставку</div>
                <div className="text-xs text-muted-foreground">Опционально, можно пропустить</div>
              </div>
              <Switch
                checked={addBatch}
                onCheckedChange={(v) => {
                  setAddBatch(v);
                  if (v) {
                    setBatch((prev) => ({ ...prev, unit: prev.unit ? prev.unit : baseUnitOverride }));
                  }
                }}
              />
            </div>

            {addBatch ? <BatchForm value={batch} onChange={setBatch} /> : null}
          </div>
        )}

        {step === 4 && (
          <div className="grid gap-4">
            <div className="flex items-center justify-between gap-3 rounded-lg border p-3">
              <div>
                <div className="font-medium">Добавить документ</div>
                <div className="text-xs text-muted-foreground">Сертификат/паспорт и т.п.</div>
              </div>
              <Switch checked={addDoc} onCheckedChange={setAddDoc} />
            </div>

            {addDoc ? (
              <div className="grid gap-4">
                <div className="grid gap-2">
                  <Label>Источник документа</Label>
                  <RadioGroup
                    value={docMode}
                    onValueChange={(v) => setDocMode(v as "registry" | "new")}
                    className="grid grid-cols-2 gap-2"
                  >
                    <Label className="flex items-center gap-3 rounded-lg border p-3">
                      <RadioGroupItem value="registry" />
                      <div>
                        <div className="font-medium">Из реестра</div>
                        <div className="text-xs text-muted-foreground">Проект + глобальные</div>
                      </div>
                    </Label>
                    <Label className="flex items-center gap-3 rounded-lg border p-3">
                      <RadioGroupItem value="new" />
                      <div>
                        <div className="font-medium">Новый</div>
                        <div className="text-xs text-muted-foreground">Создать и привязать</div>
                      </div>
                    </Label>
                  </RadioGroup>
                </div>

                {addBatch ? (
                  <div className="grid gap-2">
                    <Label>Привязать документ</Label>
                    <RadioGroup
                      value={docBindTarget}
                      onValueChange={(v) => setDocBindTarget(v as "material" | "batch")}
                      className="grid gap-2"
                    >
                      <Label className="flex items-center gap-3 rounded-lg border p-3">
                        <RadioGroupItem value="material" />
                        <div>
                          <div className="font-medium">К материалу</div>
                          <div className="text-xs text-muted-foreground">Будет действовать для всех партий</div>
                        </div>
                      </Label>
                      <Label className="flex items-center gap-3 rounded-lg border p-3">
                        <RadioGroupItem value="batch" />
                        <div>
                          <div className="font-medium">К добавленной партии</div>
                          <div className="text-xs text-muted-foreground">Только для этой поставки</div>
                        </div>
                      </Label>
                    </RadioGroup>
                  </div>
                ) : null}

                {docMode === "registry" ? (
                  <div className="grid gap-3">
                    <div className="grid gap-2">
                      <Label>Поиск в реестре</Label>
                      <Input value={docSearch} onChange={(e) => setDocSearch(e.target.value)} placeholder="например: сертификат 123" />
                    </div>
                    <PillTabs
                      activeTab={docScopeFilter}
                      onTabChange={(v) => {
                        setDocScopeFilter(v as DocScopeFilter);
                        setSelectedDocumentId(null);
                      }}
                      tabs={[
                        { label: "Все", value: "all" },
                        { label: "Проект", value: "project" },
                        { label: "Глобальные", value: "global" },
                      ]}
                    />
                    <div className="grid gap-2 max-h-56 overflow-y-auto pr-1">
                      {docsQuery.isLoading ? (
                        <div className="text-sm text-muted-foreground py-4 text-center">Загрузка...</div>
                      ) : (docsQuery.data ?? []).length === 0 ? (
                        <div className="text-sm text-muted-foreground py-4 text-center">Документы не найдены</div>
                      ) : (
                        (docsQuery.data ?? []).slice(0, 50).map((d) => {
                          const row = d as {
                            id: number;
                            docType?: string;
                            docNumber?: string | null;
                            docDate?: string | null;
                            title?: string | null;
                            scope?: string;
                          };
                          const id = Number(row.id);
                          const label = [
                            String(row.docType ?? "document"),
                            row.docNumber ? `№${String(row.docNumber)}` : null,
                            row.docDate ? `от ${String(row.docDate)}` : null,
                            row.title ? String(row.title) : null,
                          ].filter(Boolean).join(" • ");
                          return (
                            <Button
                              key={String(row.id)}
                              type="button"
                              variant={selectedDocumentId === id ? "default" : "outline"}
                              className="w-full justify-start rounded-xl"
                              onClick={() => {
                                setSelectedDocumentId(id);
                                setDoc((current) => ({ ...current, useInActs: true }));
                              }}
                            >
                              <span className="min-w-0 flex-1 truncate text-left">{label}</span>
                              <Badge variant={row.scope === "global" ? "info" : "neutral"} className="ml-2 shrink-0">
                                {documentScopeLabel(String(row.scope ?? "project"))}
                              </Badge>
                            </Button>
                          );
                        })
                      )}
                    </div>
                  </div>
                ) : (
                  <>
                    <div className="grid gap-2">
                      <Label>Тип</Label>
                      <Select
                        value={doc.docType}
                        onValueChange={(v) =>
                          setDoc((p) => ({
                            ...p,
                            docType: v as DocDraft["docType"],
                            useInActs: v === "certificate" || v === "declaration" || v === "passport" || v === "protocol",
                          }))
                        }
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="certificate">certificate</SelectItem>
                          <SelectItem value="declaration">declaration</SelectItem>
                          <SelectItem value="passport">passport</SelectItem>
                          <SelectItem value="protocol">protocol</SelectItem>
                          <SelectItem value="scheme">scheme</SelectItem>
                          <SelectItem value="other">other</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="grid gap-2">
                      <Label>Номер</Label>
                      <Input value={doc.docNumber ?? ""} onChange={(e) => setDoc((p) => ({ ...p, docNumber: e.target.value }))} />
                    </div>

                    <div className="grid gap-2">
                      <Label>Дата</Label>
                      <Input type="date" value={doc.docDate ?? ""} onChange={(e) => setDoc((p) => ({ ...p, docDate: e.target.value }))} />
                    </div>

                    <div className="grid gap-2">
                      <Label>URL файла (опц.)</Label>
                      <Input value={doc.fileUrl ?? ""} onChange={(e) => setDoc((p) => ({ ...p, fileUrl: e.target.value }))} />
                    </div>
                  </>
                )}

                {(docMode === "registry" || doc.docType === "certificate" || doc.docType === "declaration" || doc.docType === "passport" || doc.docType === "protocol") && (
                  <div className="flex items-center justify-between gap-3 rounded-lg border p-3">
                    <div className="text-sm">Использовать в актах</div>
                    <Switch checked={doc.useInActs} onCheckedChange={(v) => setDoc((p) => ({ ...p, useInActs: v }))} />
                  </div>
                )}
              </div>
            ) : null}
          </div>
        )}

        <DialogFooter className="mt-4">
          <div className="flex w-full items-center justify-between gap-2">
            <Button type="button" variant="outline" onClick={goBack}>
              Назад
            </Button>

            {step < 4 ? (
              <Button type="button" onClick={() => setStep((s) => ((s + 1) as Step))} disabled={!canNext}>
                Далее
              </Button>
            ) : (
              <Button type="button" onClick={submit} disabled={isBusy}>
                {isBusy ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Plus className="h-4 w-4 mr-2" />}
                Готово
              </Button>
            )}
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
