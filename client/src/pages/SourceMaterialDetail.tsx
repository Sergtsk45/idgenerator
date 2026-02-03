/**
 * @file: SourceMaterialDetail.tsx
 * @description: Детальная страница материала (/source/materials/:id).
 * @dependencies: hooks/use-materials, hooks/use-documents, components/materials/MaterialDetailView
 * @created: 2026-02-01
 */

import { useEffect, useMemo, useState } from "react";
import { BottomNav } from "@/components/BottomNav";
import { Header } from "@/components/Header";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Drawer, DrawerContent, DrawerFooter, DrawerHeader, DrawerTitle } from "@/components/ui/drawer";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { useCurrentObject } from "@/hooks/use-source-data";
import { useCreateBatch, useProjectMaterial, useSaveProjectMaterialToCatalog } from "@/hooks/use-materials";
import { useCreateDocument, useCreateDocumentBinding, useDocuments, usePatchDocumentBinding } from "@/hooks/use-documents";
import { MaterialDetailView } from "@/components/materials/MaterialDetailView";
import { format } from "date-fns";
import { ArrowLeft, CalendarIcon, Loader2, Plus, Star } from "lucide-react";
import { useLocation } from "wouter";
import { BatchForm, type BatchDraft } from "@/components/materials/BatchForm";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Switch } from "@/components/ui/switch";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { formatIsoToDmy, normalizeDmyInput, parseDmyToIso } from "@/lib/dateFormat";

type DocDraft = {
  docType: "certificate" | "declaration" | "passport" | "protocol" | "scheme" | "other";
  scope: "project" | "global";
  title?: string;
  docNumber?: string;
  docDate?: string; // YYYY-MM-DD
  fileUrl?: string;
  useInActs: boolean;
};

function deriveBindingRole(docType: DocDraft["docType"]) {
  if (docType === "passport") return "passport";
  if (docType === "protocol") return "protocol";
  if (docType === "scheme") return "scheme";
  if (docType === "other") return "other";
  return "quality";
}

export default function SourceMaterialDetail(props: { params: { id: string } }) {
  const id = Number(props.params.id);
  const { toast } = useToast();
  const [, setLocation] = useLocation();
  const currentObject = useCurrentObject();
  const objectId = currentObject.data?.id;

  const materialQuery = useProjectMaterial(id);
  const saveToCatalog = useSaveProjectMaterialToCatalog(id, objectId);
  const patchBinding = usePatchDocumentBinding(id);
  const createBatch = useCreateBatch(id, objectId);
  const createDocument = useCreateDocument();
  const createBinding = useCreateDocumentBinding();

  const data: any = materialQuery.data;
  const material = data?.material;
  const catalog = data?.catalog;

  const title = String(catalog?.name ?? material?.nameOverride ?? `Материал #${id}`);
  const baseUnit = (catalog?.baseUnit ?? material?.baseUnitOverride) as string | null | undefined;

  const [addBatchOpen, setAddBatchOpen] = useState(false);
  const [batchDraft, setBatchDraft] = useState<BatchDraft>({});

  const [bindDocOpen, setBindDocOpen] = useState(false);
  const [bindTab, setBindTab] = useState<"registry" | "new">("registry");
  const [docSearch, setDocSearch] = useState("");
  const docsQuery = useDocuments({ query: docSearch });
  const [bindDocPreselectedBatchId, setBindDocPreselectedBatchId] = useState<number | null>(null);
  const [bindDocTarget, setBindDocTarget] = useState<"material" | "batch">("material");
  const [bindDocSelectedBatchId, setBindDocSelectedBatchId] = useState<number | null>(null);

  const [newDoc, setNewDoc] = useState<DocDraft>({
    docType: "certificate",
    scope: "project",
    useInActs: true,
  });

  const openBindDocDrawer = (opts?: { preselectedBatchId?: number | null }) => {
    const pre = opts?.preselectedBatchId ?? null;
    setBindTab("registry");
    setDocSearch("");
    setBindDocPreselectedBatchId(pre);
    if (pre != null) {
      setBindDocTarget("batch");
      setBindDocSelectedBatchId(pre);
    } else {
      setBindDocTarget("material");
      setBindDocSelectedBatchId(null);
    }
    setBindDocOpen(true);
  };
  const [newDocDateText, setNewDocDateText] = useState<string>(formatIsoToDmy(newDoc.docDate) ?? "");
  const [newDocCalendarOpen, setNewDocCalendarOpen] = useState(false);

  useEffect(() => {
    setNewDocDateText(formatIsoToDmy(newDoc.docDate) ?? "");
  }, [newDoc.docDate]);

  const selectedNewDocDate = useMemo(() => {
    if (!newDoc.docDate) return undefined;
    const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(newDoc.docDate);
    if (!m) return undefined;
    const y = Number(m[1]);
    const mo = Number(m[2]);
    const d = Number(m[3]);
    if (!Number.isFinite(y) || !Number.isFinite(mo) || !Number.isFinite(d)) return undefined;
    return new Date(y, mo - 1, d, 12, 0, 0, 0);
  }, [newDoc.docDate]);

  return (
    <div className="flex flex-col min-h-screen h-[100dvh] bg-background bg-grain">
      <Header title={title} />

      <div className="flex-1 min-h-0 overflow-hidden px-4 py-6 pb-24 flex flex-col">
        {materialQuery.isLoading ? (
          <div className="flex items-center justify-center py-10 text-muted-foreground">
            <Loader2 className="h-5 w-5 animate-spin mr-2" />
            Загрузка...
          </div>
        ) : !data ? (
          <div className="py-10 text-center text-muted-foreground">Материал не найден</div>
        ) : (
          <ScrollArea className="flex-1 min-h-0">
            <div className="space-y-4 pr-2">
              <div>
                <Button
                  variant="outline"
                  className="w-full rounded-xl"
                  onClick={() => setLocation("/source/materials")}
                >
                  <ArrowLeft className="h-4 w-4 mr-2" />
                  Назад к материалам
                </Button>
              </div>

              {(material as any).catalogMaterialId == null ? (
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    className="w-full rounded-xl"
                    disabled={saveToCatalog.isPending}
                    onClick={async () => {
                      try {
                        await saveToCatalog.mutateAsync();
                        toast({ title: "Сохранено", description: "Материал добавлен в справочник" });
                      } catch (e) {
                        toast({
                          title: "Ошибка",
                          description: e instanceof Error ? e.message : String(e),
                          variant: "destructive",
                        });
                      }
                    }}
                  >
                    <Star className="h-4 w-4 mr-2" />
                    Сохранить в справочник
                  </Button>
                </div>
              ) : null}

              <MaterialDetailView
                materialTitle={title}
                badge={(material as any).catalogMaterialId != null ? "catalog" : "local"}
                baseUnit={baseUnit ?? null}
                batches={(data.batches ?? [])}
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
                      onError: (e) => {
                        toast({
                          title: "Ошибка",
                          description: e instanceof Error ? e.message : String(e),
                          variant: "destructive",
                        });
                      },
                    }
                  )
                }
                onAddBatch={() => {
                  setBatchDraft({ unit: baseUnit ?? undefined });
                  setAddBatchOpen(true);
                }}
                onBindDocument={() => {
                  openBindDocDrawer({ preselectedBatchId: null });
                }}
                onBindDocumentToBatch={(batchId) => {
                  openBindDocDrawer({ preselectedBatchId: batchId });
                }}
              />
            </div>
          </ScrollArea>
        )}
      </div>

      <BottomNav />

      <Drawer open={addBatchOpen} onOpenChange={setAddBatchOpen}>
        <DrawerContent className="max-h-[90vh]">
          <DrawerHeader>
            <DrawerTitle>Добавить партию</DrawerTitle>
          </DrawerHeader>
          <div className="px-4 pb-4">
            <ScrollArea className="h-[60vh] pr-2">
              <BatchForm value={batchDraft} onChange={setBatchDraft} disabled={createBatch.isPending} />
            </ScrollArea>
          </div>
          <DrawerFooter>
            <Button
              className="w-full rounded-xl"
              disabled={createBatch.isPending}
              onClick={async () => {
                try {
                  await createBatch.mutateAsync({
                    supplierName: batchDraft.supplierName || null,
                    plant: batchDraft.plant || null,
                    batchNumber: batchDraft.batchNumber || null,
                    deliveryDate: batchDraft.deliveryDate || null,
                    quantity: batchDraft.quantity || null,
                    unit: batchDraft.unit || null,
                    notes: batchDraft.notes || null,
                  } as any);
                  toast({ title: "Готово", description: "Партия добавлена" });
                  setAddBatchOpen(false);
                  setBatchDraft({});
                } catch (e) {
                  toast({
                    title: "Ошибка",
                    description: e instanceof Error ? e.message : String(e),
                    variant: "destructive",
                  });
                }
              }}
            >
              <Plus className="h-4 w-4 mr-2" />
              Сохранить
            </Button>
            <Button type="button" variant="outline" className="w-full rounded-xl" onClick={() => setAddBatchOpen(false)} disabled={createBatch.isPending}>
              Отмена
            </Button>
          </DrawerFooter>
        </DrawerContent>
      </Drawer>

      <Drawer
        open={bindDocOpen}
        onOpenChange={(v) => {
          setBindDocOpen(v);
          if (!v) {
            setBindDocPreselectedBatchId(null);
            setBindDocTarget("material");
            setBindDocSelectedBatchId(null);
          }
        }}
      >
        <DrawerContent className="max-h-[90vh]">
          <DrawerHeader>
            <DrawerTitle>Привязать документ</DrawerTitle>
          </DrawerHeader>
          <div className="px-4 pb-4">
            <div className="rounded-xl border p-3">
              <div className="text-sm font-medium">К чему привязать</div>
              <RadioGroup
                value={bindDocTarget}
                onValueChange={(v) => {
                  const next = v as "material" | "batch";
                  if (next === "material") {
                    setBindDocTarget("material");
                    setBindDocSelectedBatchId(null);
                    return;
                  }

                  const batches = (data?.batches ?? []) as any[];
                  if (batches.length === 0) {
                    toast({
                      title: "Нет партий",
                      description: "Сначала добавьте партию, чтобы привязать документ к конкретной поставке.",
                      variant: "destructive",
                    });
                    setBindDocTarget("material");
                    setBindDocSelectedBatchId(null);
                    return;
                  }

                  setBindDocTarget("batch");
                  if (bindDocSelectedBatchId == null) {
                    setBindDocSelectedBatchId(Number(batches[0]?.id ?? null));
                  }
                }}
                className="mt-3 grid gap-2"
              >
                <Label className="flex items-center gap-2">
                  <RadioGroupItem value="material" id="bind-target-material" />
                  К материалу (всем партиям)
                </Label>
                <Label className="flex items-center gap-2">
                  <RadioGroupItem
                    value="batch"
                    id="bind-target-batch"
                    disabled={((data?.batches ?? []) as any[]).length === 0}
                  />
                  К партии
                </Label>
              </RadioGroup>

              {bindDocTarget === "batch" ? (
                <div className="mt-3 grid gap-2">
                  <Label>Партия</Label>
                  <Select
                    value={bindDocSelectedBatchId != null ? String(bindDocSelectedBatchId) : ""}
                    onValueChange={(v) => setBindDocSelectedBatchId(Number(v))}
                  >
                    <SelectTrigger className="rounded-xl">
                      <SelectValue placeholder="Выберите партию" />
                    </SelectTrigger>
                    <SelectContent>
                      {((data?.batches ?? []) as any[]).map((b: any) => {
                        const head = b.batchNumber ? `Партия №${String(b.batchNumber)}` : `Партия #${String(b.id)}`;
                        const date = b.deliveryDate ? (formatIsoToDmy(String(b.deliveryDate)) ?? String(b.deliveryDate)) : null;
                        const supplier = b.supplierName ? String(b.supplierName) : null;
                        const label = [head, date, supplier].filter(Boolean).join(" • ");
                        return (
                          <SelectItem key={String(b.id)} value={String(b.id)}>
                            {label}
                          </SelectItem>
                        );
                      })}
                    </SelectContent>
                  </Select>
                </div>
              ) : null}
            </div>

            <Tabs value={bindTab} onValueChange={(v) => setBindTab(v as any)}>
              <TabsList className="w-full">
                <TabsTrigger value="registry" className="flex-1">
                  Из реестра
                </TabsTrigger>
                <TabsTrigger value="new" className="flex-1">
                  Новый
                </TabsTrigger>
              </TabsList>

              <TabsContent value="registry" className="mt-4">
                <div className="grid gap-2">
                  <Label>Поиск</Label>
                  <Input value={docSearch} onChange={(e) => setDocSearch(e.target.value)} placeholder="например: сертификат 123" />
                </div>

                <div className="mt-4">
                  <ScrollArea className="h-[46vh] pr-2">
                    <div className="grid gap-2">
                      {(docsQuery.data ?? []).length === 0 ? (
                        <div className="text-sm text-muted-foreground py-6 text-center">Документы не найдены</div>
                      ) : (
                        (docsQuery.data ?? []).map((d: any) => {
                          const labelParts = [
                            String(d.docType ?? "document"),
                            d.docNumber ? `№${String(d.docNumber)}` : null,
                            d.docDate ? `от ${String(d.docDate)}` : null,
                            d.title ? String(d.title) : null,
                          ].filter(Boolean);
                          const label = labelParts.join(" ");
                          return (
                            <Button
                              key={String(d.id)}
                              type="button"
                              variant="outline"
                              className="w-full justify-start rounded-xl"
                              disabled={createBinding.isPending}
                              onClick={async () => {
                                try {
                                  const batchIdForBinding =
                                    bindDocTarget === "batch" ? bindDocSelectedBatchId : null;
                                  if (bindDocTarget === "batch" && batchIdForBinding == null) {
                                    toast({
                                      title: "Выберите партию",
                                      description: "Чтобы привязать документ к партии, выберите конкретную партию.",
                                      variant: "destructive",
                                    });
                                    return;
                                  }
                                  const docType = String(d.docType ?? "other") as DocDraft["docType"];
                                  const role = deriveBindingRole(docType);
                                  await createBinding.mutateAsync({
                                    documentId: Number(d.id),
                                    projectMaterialId: id,
                                    objectId: null,
                                    batchId: batchIdForBinding,
                                    bindingRole: role,
                                    useInActs: role === "quality" ? true : false,
                                    isPrimary: false,
                                  } as any);
                                  toast({ title: "Готово", description: "Документ привязан" });
                                  setBindDocOpen(false);
                                } catch (e) {
                                  toast({
                                    title: "Ошибка",
                                    description: e instanceof Error ? e.message : String(e),
                                    variant: "destructive",
                                  });
                                }
                              }}
                            >
                              {label}
                            </Button>
                          );
                        })
                      )}
                    </div>
                  </ScrollArea>
                </div>
              </TabsContent>

              <TabsContent value="new" className="mt-4">
                <ScrollArea className="h-[58vh] pr-2">
                  <div className="grid gap-4">
                    <div className="grid gap-2">
                      <Label>Тип</Label>
                      <div className="grid grid-cols-2 gap-2">
                        {(["certificate", "declaration", "passport", "protocol", "scheme", "other"] as const).map((t) => (
                          <Button
                            key={t}
                            type="button"
                            variant={newDoc.docType === t ? "default" : "outline"}
                            className="rounded-xl justify-center"
                            onClick={() => {
                              setNewDoc((p) => ({ ...p, docType: t, useInActs: t === "certificate" || t === "declaration" }));
                            }}
                          >
                            {t}
                          </Button>
                        ))}
                      </div>
                    </div>

                    <div className="grid gap-2">
                      <Label>Номер</Label>
                      <Input value={newDoc.docNumber ?? ""} onChange={(e) => setNewDoc((p) => ({ ...p, docNumber: e.target.value }))} />
                    </div>

                    <div className="grid gap-2">
                      <Label>Дата</Label>
                      <Popover open={newDocCalendarOpen} onOpenChange={setNewDocCalendarOpen}>
                        <div className="relative">
                          <Input
                            type="text"
                            inputMode="numeric"
                            placeholder="дд/мм/гггг"
                            className="pr-10"
                            value={newDocDateText}
                            onChange={(e) => {
                              const nextText = normalizeDmyInput(e.target.value);
                              setNewDocDateText(nextText);

                              if (!nextText) {
                                setNewDoc((p) => ({ ...p, docDate: undefined }));
                                return;
                              }
                              const iso = parseDmyToIso(nextText);
                              if (iso) {
                                setNewDoc((p) => ({ ...p, docDate: iso }));
                                return;
                              }
                              if (nextText.length === 10) {
                                setNewDoc((p) => ({ ...p, docDate: undefined }));
                              }
                            }}
                          />
                          <PopoverTrigger asChild>
                            <Button type="button" variant="ghost" size="icon" className="absolute right-1 top-1/2 -translate-y-1/2 h-8 w-8" title="Выбрать дату">
                              <CalendarIcon className="h-4 w-4" />
                            </Button>
                          </PopoverTrigger>
                        </div>
                        <PopoverContent className="w-auto p-0" align="start">
                          <Calendar
                            mode="single"
                            selected={selectedNewDocDate}
                            onSelect={(d) => {
                              if (!d) return;
                              const iso = format(d, "yyyy-MM-dd");
                              setNewDoc((p) => ({ ...p, docDate: iso }));
                              setNewDocDateText(formatIsoToDmy(iso) ?? "");
                              setNewDocCalendarOpen(false);
                            }}
                            initialFocus
                          />
                        </PopoverContent>
                      </Popover>
                    </div>

                    <div className="grid gap-2">
                      <Label>URL файла (опц.)</Label>
                      <Input value={newDoc.fileUrl ?? ""} onChange={(e) => setNewDoc((p) => ({ ...p, fileUrl: e.target.value }))} />
                    </div>

                    {(newDoc.docType === "certificate" || newDoc.docType === "declaration") ? (
                      <div className="flex items-center justify-between gap-3 rounded-lg border p-3">
                        <div className="text-sm">Использовать в актах</div>
                        <Switch checked={newDoc.useInActs} onCheckedChange={(v) => setNewDoc((p) => ({ ...p, useInActs: v }))} />
                      </div>
                    ) : null}

                    <Button
                      type="button"
                      className="w-full rounded-xl"
                      disabled={createDocument.isPending || createBinding.isPending}
                      onClick={async () => {
                        try {
                          const batchIdForBinding =
                            bindDocTarget === "batch" ? bindDocSelectedBatchId : null;
                          if (bindDocTarget === "batch" && batchIdForBinding == null) {
                            toast({
                              title: "Выберите партию",
                              description: "Чтобы привязать документ к партии, выберите конкретную партию.",
                              variant: "destructive",
                            });
                            return;
                          }
                          const created = await createDocument.mutateAsync({
                            docType: newDoc.docType,
                            scope: newDoc.scope,
                            title: newDoc.title || null,
                            docNumber: newDoc.docNumber || null,
                            docDate: newDoc.docDate || null,
                            validFrom: null,
                            validTo: null,
                            meta: {},
                            fileUrl: newDoc.fileUrl || null,
                          } as any);

                          const role = deriveBindingRole(newDoc.docType);
                          await createBinding.mutateAsync({
                            documentId: Number((created as any).id),
                            projectMaterialId: id,
                            objectId: null,
                            batchId: batchIdForBinding,
                            bindingRole: role,
                            useInActs: role === "quality" ? Boolean(newDoc.useInActs) : false,
                            isPrimary: false,
                          } as any);

                          toast({ title: "Готово", description: "Документ создан и привязан" });
                          setBindDocOpen(false);
                          setNewDoc({ docType: "certificate", scope: "project", useInActs: true });
                        } catch (e) {
                          toast({
                            title: "Ошибка",
                            description: e instanceof Error ? e.message : String(e),
                            variant: "destructive",
                          });
                        }
                      }}
                    >
                      <Plus className="h-4 w-4 mr-2" />
                      Создать и привязать
                    </Button>
                  </div>
                </ScrollArea>
              </TabsContent>
            </Tabs>
          </div>

          <DrawerFooter>
            <Button type="button" variant="outline" className="w-full rounded-xl" onClick={() => setBindDocOpen(false)} disabled={createBinding.isPending || createDocument.isPending}>
              Закрыть
            </Button>
          </DrawerFooter>
        </DrawerContent>
      </Drawer>
    </div>
  );
}

