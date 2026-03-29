/**
 * @file: MaterialWizard.tsx
 * @description: Мастер добавления материала (4 шага): источник → материал → партия (опц.) → документы (опц.).
 * @dependencies: hooks/use-materials, hooks/use-documents, components/ui/*
 * @created: 2026-02-01
 */

import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";
import { useCreateProjectMaterial, useMaterialsCatalogSearch } from "@/hooks/use-materials";
import { useCreateDocument, useCreateDocumentBinding } from "@/hooks/use-documents";
import { BatchForm, type BatchDraft } from "@/components/materials/BatchForm";
import { Loader2, Plus } from "lucide-react";
import { api, buildUrl } from "@shared/routes";

type Step = 1 | 2 | 3 | 4;

type DocDraft = {
  docType: "certificate" | "declaration" | "passport" | "protocol" | "scheme" | "other";
  scope: "project" | "global";
  title?: string;
  docNumber?: string;
  docDate?: string; // YYYY-MM-DD
  fileUrl?: string;
  useInActs: boolean;
};

export function MaterialWizard(props: { objectId: number; open: boolean; onOpenChange: (v: boolean) => void }) {
  const { toast } = useToast();

  const [step, setStep] = useState<Step>(1);
  const [source, setSource] = useState<"catalog" | "new">("catalog");

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
  const [docBindTarget, setDocBindTarget] = useState<"material" | "batch">("material");
  const [doc, setDoc] = useState<DocDraft>({
    docType: "certificate",
    scope: "project",
    useInActs: true,
  });

  const createMaterial = useCreateProjectMaterial(props.objectId);
  const createDocument = useCreateDocument();
  const createBinding = useCreateDocumentBinding();

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
    setStep(1);
    setSource("catalog");
    setCatalogQuery("");
    setSelectedCatalogId(null);
    setNameOverride("");
    setBaseUnitOverride("");
    setAddBatch(false);
    setBatch({});
    setAddDoc(false);
    setDocBindTarget("material");
    setDoc({ docType: "certificate", scope: "project", useInActs: true });
  };

  const close = () => {
    props.onOpenChange(false);
    reset();
  };

  const submit = async () => {
    try {
      const material = await createMaterial.mutateAsync({
        ...(source === "catalog" ? { catalogMaterialId: selectedCatalogId } : { nameOverride, baseUnitOverride }),
      } as any);

      const projectMaterialId = Number((material as any).id);
      let createdBatchId: number | null = null;

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
          throw new Error(errorData.message || "Failed to create batch");
        }
        const createdBatch = api.materialBatches.create.responses[201].parse(await res.json());
        createdBatchId = Number((createdBatch as any).id);
      }

      if (addDoc) {
        const createdDoc = await createDocument.mutateAsync({
          docType: doc.docType,
          scope: doc.scope,
          title: doc.title || null,
          docNumber: doc.docNumber || null,
          docDate: doc.docDate || null,
          validFrom: null,
          validTo: null,
          meta: {},
          fileUrl: doc.fileUrl || null,
        } as any);

        const bindingRole =
          doc.docType === "passport"
            ? "passport"
            : doc.docType === "protocol"
              ? "protocol"
              : doc.docType === "scheme"
                ? "scheme"
                : "quality";

        const batchIdForBinding =
          addBatch && docBindTarget === "batch" ? createdBatchId : null;

        await createBinding.mutateAsync({
          documentId: (createdDoc as any).id,
          projectMaterialId,
          objectId: null,
          batchId: batchIdForBinding,
          bindingRole,
          useInActs: bindingRole === "quality" ? doc.useInActs : false,
          isPrimary: false,
        } as any);
      }

      toast({ title: "Готово", description: "Материал добавлен" });
      close();
    } catch (e) {
      toast({
        title: "Ошибка",
        description: e instanceof Error ? e.message : String(e),
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
            <RadioGroup value={source} onValueChange={(v) => setSource(v as any)} className="grid gap-3">
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
                    <SelectItem key={(m as any).id} value={String((m as any).id)}>
                      {(m as any).name}
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
                {addBatch ? (
                  <div className="grid gap-2">
                    <Label>Привязать документ</Label>
                    <RadioGroup value={docBindTarget} onValueChange={(v) => setDocBindTarget(v as any)} className="grid gap-2">
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

                <div className="grid gap-2">
                  <Label>Тип</Label>
                  <Select value={doc.docType} onValueChange={(v) => setDoc((p) => ({ ...p, docType: v as any, useInActs: v !== "passport" }))}>
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

                {(doc.docType === "certificate" || doc.docType === "declaration") && (
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
            <Button type="button" variant="outline" onClick={() => (step === 1 ? close() : setStep((s) => ((s - 1) as Step)))}>
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

