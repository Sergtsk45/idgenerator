import { useEffect, useMemo, useState } from "react";
import { BottomNav } from "@/components/BottomNav";
import { Header } from "@/components/Header";
import { useActs } from "@/hooks/use-acts";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Checkbox } from "@/components/ui/checkbox";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { FileText, CalendarIcon, Download, Loader2, ChevronRight, Check, FileDown } from "lucide-react";
import { format } from "date-fns";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import { motion } from "framer-motion";
import { useLanguageStore, translations } from "@/lib/i18n";
import { ru, enUS } from "date-fns/locale";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useDefaultSchedule } from "@/hooks/use-schedules";
import { api, buildUrl } from "@shared/routes";
import { useCurrentObject } from "@/hooks/use-source-data";
import { useProjectMaterials } from "@/hooks/use-materials";

interface ActTemplate {
  id: number;
  templateId: string;
  code: string;
  category: string;
  title: string;
  titleEn: string | null;
  description: string | null;
  normativeRef: string | null;
  isActive: boolean | null;
}

interface Category {
  name: string;
  nameEn: string;
}

interface TemplatesResponse {
  templates: ActTemplate[];
  categories: Record<string, Category>;
}

export default function Acts() {
  const { language } = useLanguageStore();
  const t = translations[language].acts;
  const { data: acts = [], isLoading } = useActs();
  const { toast } = useToast();
  const { data: defaultSchedule } = useDefaultSchedule();
  const scheduleId = defaultSchedule?.id;
  const currentObject = useCurrentObject();
  const objectId = currentObject.data?.id;
  const projectMaterialsQuery = useProjectMaterials(objectId);
  // Legacy UI state (kept temporarily for backward compatibility of layout)
  const [dateStart, setDateStart] = useState<Date>();
  const [dateEnd, setDateEnd] = useState<Date>();
  const [selectedTemplates, setSelectedTemplates] = useState<Set<string>>(new Set());
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [exportActId, setExportActId] = useState<number | null>(null);
  const [exportingActId, setExportingActId] = useState<number | null>(null);

  // Эталонный АОСР (005_АОСР 4): данные, которые пойдут в formData при экспорте PDF
  const [aosrForm, setAosrForm] = useState({
    actNumber: "",
    actDate: "",

    objectName: "",
    objectAddress: "",
    objectFullName: "",

    developerOrgFull: "",
    builderOrgFull: "",
    designerOrgFull: "",

    repCustomerControlLine: "",
    repCustomerControlOrder: "",
    repBuilderLine: "",
    repBuilderOrder: "",
    repBuilderControlLine: "",
    repBuilderControlOrder: "",
    repDesignerLine: "",
    repDesignerOrder: "",
    repWorkPerformerLine: "",
    repWorkPerformerOrder: "",

    p1Works: "",
    p2ProjectDocs: "",
    p3MaterialsText: "",
    p4AsBuiltDocs: "",
    p6NormativeRefs: "",
    p7NextWorks: "",
    additionalInfo: "",
    copiesCount: "",

    // Каждая строка = один пункт приложения (нумерацию выставит сервер)
    attachmentsLines: "",

    // Подписи (ФИО с инициалами)
    sigCustomerControl: "",
    sigBuilder: "",
    sigBuilderControl: "",
    sigDesigner: "",
    sigWorkPerformer: "",
  });

  // Материалы для п.3 АОСР (на уровне БД: act_material_usages)
  const [p3Materials, setP3Materials] = useState<
    Array<{ projectMaterialId: number; title: string; qualityDocumentId: number | null; qualityLabel?: string }>
  >([]);
  const [isP3PickerOpen, setIsP3PickerOpen] = useState(false);
  const [p3PickerSearch, setP3PickerSearch] = useState("");
  const [docPickerForMaterialId, setDocPickerForMaterialId] = useState<number | null>(null);
  const [docPickerLoading, setDocPickerLoading] = useState(false);
  const [docPickerOptions, setDocPickerOptions] = useState<Array<{ id: number; label: string }>>([]);

  const derivedAttachments = useMemo(() => {
    const ids = new Set<number>();
    const lines: string[] = [];
    for (const m of p3Materials) {
      if (m.qualityDocumentId == null) continue;
      if (ids.has(m.qualityDocumentId)) continue;
      ids.add(m.qualityDocumentId);
      lines.push(m.qualityLabel ? m.qualityLabel : `Документ #${m.qualityDocumentId}`);
    }
    return lines;
  }, [p3Materials]);

  useEffect(() => {
    const materialId = docPickerForMaterialId;
    if (!materialId) return;

    let cancelled = false;
    const run = async () => {
      setDocPickerLoading(true);
      try {
        const url = buildUrl(api.projectMaterials.get.path, { id: materialId });
        const res = await fetch(url, { credentials: "include" });
        if (!res.ok) throw new Error("Failed to load material details");
        const data: any = await res.json();

        const bindings: any[] = Array.isArray(data?.bindings) ? data.bindings : [];
        const docs: any[] = Array.isArray(data?.documents) ? data.documents : [];

        const qualityDocIds = new Set<number>(
          bindings.filter((b) => b?.bindingRole === "quality").map((b) => Number(b?.documentId)).filter((x) => Number.isFinite(x) && x > 0),
        );

        const options = docs
          .filter((d) => qualityDocIds.has(Number(d?.id)))
          .map((d) => {
            const type = String(d?.docType ?? "document");
            const num = d?.docNumber ? ` №${String(d.docNumber)}` : "";
            const dt = d?.docDate ? ` от ${String(d.docDate)}` : "";
            return { id: Number(d.id), label: `${type}${num}${dt}`.trim() };
          });

        if (!cancelled) setDocPickerOptions(options);
      } catch {
        if (!cancelled) setDocPickerOptions([]);
      } finally {
        if (!cancelled) setDocPickerLoading(false);
      }
    };

    run();
    return () => {
      cancelled = true;
    };
  }, [docPickerForMaterialId]);

  const { data: templatesData, isLoading: templatesLoading } = useQuery<TemplatesResponse>({
    queryKey: ["/api/act-templates"],
  });

  const exportAct = useMutation({
    mutationFn: async (data: { actId: number; templateIds: string[] }) => {
      const attachments = aosrForm.attachmentsLines
        .split("\n")
        .map((l) => l.trim())
        .filter(Boolean);

      const response = await apiRequest("POST", `/api/acts/${data.actId}/export`, {
        templateIds: data.templateIds,
        formData: {
          actNumber: aosrForm.actNumber || undefined,
          actDate: aosrForm.actDate || undefined,
          objectName: aosrForm.objectName || undefined,
          objectAddress: aosrForm.objectAddress || undefined,
          objectFullName: aosrForm.objectFullName || undefined,

          developerOrgFull: aosrForm.developerOrgFull || undefined,
          builderOrgFull: aosrForm.builderOrgFull || undefined,
          designerOrgFull: aosrForm.designerOrgFull || undefined,

          repCustomerControlLine: aosrForm.repCustomerControlLine || undefined,
          repCustomerControlOrder: aosrForm.repCustomerControlOrder || undefined,
          repBuilderLine: aosrForm.repBuilderLine || undefined,
          repBuilderOrder: aosrForm.repBuilderOrder || undefined,
          repBuilderControlLine: aosrForm.repBuilderControlLine || undefined,
          repBuilderControlOrder: aosrForm.repBuilderControlOrder || undefined,
          repDesignerLine: aosrForm.repDesignerLine || undefined,
          repDesignerOrder: aosrForm.repDesignerOrder || undefined,
          repWorkPerformerLine: aosrForm.repWorkPerformerLine || undefined,
          repWorkPerformerOrder: aosrForm.repWorkPerformerOrder || undefined,

          p1Works: aosrForm.p1Works || undefined,
          p2ProjectDocs: aosrForm.p2ProjectDocs || undefined,
          p3MaterialsText: aosrForm.p3MaterialsText || undefined,
          p4AsBuiltDocs: aosrForm.p4AsBuiltDocs || undefined,
          p6NormativeRefs: aosrForm.p6NormativeRefs || undefined,
          p7NextWorks: aosrForm.p7NextWorks || undefined,
          additionalInfo: aosrForm.additionalInfo || undefined,
          copiesCount: aosrForm.copiesCount || undefined,

          attachments,

          sigCustomerControl: aosrForm.sigCustomerControl || undefined,
          sigBuilder: aosrForm.sigBuilder || undefined,
          sigBuilderControl: aosrForm.sigBuilderControl || undefined,
          sigDesigner: aosrForm.sigDesigner || undefined,
          sigWorkPerformer: aosrForm.sigWorkPerformer || undefined,
        },
      });
      return response.json();
    },
  });

  const generateActsFromSchedule = useMutation({
    mutationFn: async () => {
      if (!scheduleId) throw new Error("Schedule id is required");
      const url = buildUrl(api.schedules.generateActs.path, { id: scheduleId });
      const res = await fetch(url, {
        method: api.schedules.generateActs.method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
        credentials: "include",
      });
      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(errorData.message || "Failed to generate acts from schedule");
      }
      return api.schedules.generateActs.responses[200].parse(await res.json());
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: [api.acts.list.path] });
      toast({
        title: language === "ru" ? "Акты обновлены" : "Acts updated",
        description:
          language === "ru"
            ? `Создано: ${data.created}, обновлено: ${data.updated}, удалено: ${data.deletedActNumbers?.length ?? 0}. Предупреждений: ${data.warnings?.length ?? 0}`
            : `Created: ${data.created}, updated: ${data.updated}, deleted: ${data.deletedActNumbers?.length ?? 0}. Warnings: ${data.warnings?.length ?? 0}`,
      });
    },
  });

  const openExportDialog = (actId: number) => {
    setExportActId(actId);
    setIsDialogOpen(true);
  };

  const handleDownloadAct = async (actId: number) => {
    setExportingActId(actId);
    try {
      const exportResult = await exportAct.mutateAsync({
        actId,
        templateIds: [],
      });
      if (exportResult.files && exportResult.files.length > 0) {
        toast({
          title: language === "ru" ? "Успех" : "Success",
          description: language === "ru" ? `Создано ${exportResult.files.length} PDF-документов` : `Generated ${exportResult.files.length} PDF documents`,
        });
        exportResult.files.forEach((file: { url: string; filename: string }) => {
          window.open(file.url, "_blank");
        });
      }
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : undefined;
      toast({
        title: language === "ru" ? "Ошибка" : "Error",
        description: msg || (language === "ru" ? "Не удалось экспортировать акт" : "Failed to export act"),
        variant: "destructive",
      });
    } finally {
      setExportingActId(null);
    }
  };

  const handleExport = async () => {
    if (!exportActId) return;
    setIsGenerating(true);
    try {
      const exportResult = await exportAct.mutateAsync({
        actId: exportActId,
        templateIds: [],
      });

      setIsDialogOpen(false);
      setExportActId(null);

      if (exportResult.files && exportResult.files.length > 0) {
        toast({
          title: language === "ru" ? "Успех" : "Success",
          description: language === "ru" ? `Создано ${exportResult.files.length} PDF-документов` : `Generated ${exportResult.files.length} PDF documents`,
        });

        exportResult.files.forEach((file: { url: string; filename: string }) => {
          window.open(file.url, "_blank");
        });
      }
    } catch (error: any) {
      toast({
        title: language === "ru" ? "Ошибка" : "Error",
        description: error?.message || (language === "ru" ? "Не удалось экспортировать акт" : "Failed to export act"),
        variant: "destructive",
      });
    } finally {
      setIsGenerating(false);
    }
  };

  const templatesById = useMemo(() => {
    const m = new Map<number, ActTemplate>();
    (templatesData?.templates ?? []).forEach((tpl) => m.set(tpl.id, tpl));
    return m;
  }, [templatesData]);

  // Legacy template selection helpers (UI will be removed in next cleanup)
  const groupedTemplates = useMemo(() => {
    const acc: Record<string, ActTemplate[]> = {};
    for (const template of templatesData?.templates ?? []) {
      if (!acc[template.category]) acc[template.category] = [];
      acc[template.category].push(template);
    }
    return acc;
  }, [templatesData]);

  const handleTemplateToggle = (templateId: string) => {
    const next = new Set(selectedTemplates);
    if (next.has(templateId)) next.delete(templateId);
    else next.add(templateId);
    setSelectedTemplates(next);
  };

  const handleSelectAll = (category: string) => {
    const templates = groupedTemplates[category] ?? [];
    if (templates.length === 0) return;
    const allSelected = templates.every((t) => selectedTemplates.has(t.templateId));
    const next = new Set(selectedTemplates);
    if (allSelected) templates.forEach((t) => next.delete(t.templateId));
    else templates.forEach((t) => next.add(t.templateId));
    setSelectedTemplates(next);
  };

  const handleGenerate = handleExport;

  return (
    <div className="flex flex-col min-h-screen bg-background bg-grain">
      <Header
        title={t.title}
        subtitle={
          currentObject.data?.title
            ? `${language === "ru" ? "ОБЪЕКТ" : "OBJECT"}: ${currentObject.data.title}`
            : undefined
        }
      />

      <div className="flex-1 px-4 py-6 pb-24 max-w-md mx-auto w-full">
        <div className="mb-3">
          <Button
            variant="outline"
            className="w-full h-11 rounded-xl"
            disabled={!scheduleId || generateActsFromSchedule.isPending}
            onClick={async () => {
              toast({
                title: language === "ru" ? "Синхронизация" : "Sync",
                description: language === "ru" ? "Формирование актов из графика..." : "Generating acts from schedule...",
              });
              await generateActsFromSchedule.mutateAsync();
            }}
          >
            {generateActsFromSchedule.isPending ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
                {language === "ru" ? "Формирование..." : "Generating..."}
              </>
            ) : (
              <>{language === "ru" ? "Сформировать/обновить из графика" : "Generate/update from schedule"}</>
            )}
          </Button>
        </div>

        {isLoading ? (
          <div className="flex justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        ) : (
          <div className="space-y-4">
            {acts.length === 0 ? (
              <div className="text-center py-16 space-y-4">
                <div className="bg-muted/50 w-20 h-20 rounded-full flex items-center justify-center mx-auto">
                  <FileText className="h-10 w-10 text-muted-foreground/50" />
                </div>
                <div className="space-y-1">
                  <h3 className="font-semibold text-lg">{language === "ru" ? "Нет актов" : "No Acts Yet"}</h3>
                  <p className="text-sm text-muted-foreground max-w-[200px] mx-auto">
                    {language === "ru" ? "Создайте первый АОСР на основе шаблонов." : "Generate your first AOSR document from templates."}
                  </p>
                </div>
              </div>
            ) : (
              acts.map((act, idx) => (
                <motion.div key={act.id} initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: idx * 0.1 }}>
                  <Card className="overflow-hidden group hover:border-primary/50 transition-all cursor-pointer" data-testid={`card-act-${act.id}`}>
                    <CardHeader className="p-4 pb-2 flex flex-row items-center justify-between gap-2 space-y-0">
                      <div className="flex items-center gap-3">
                        <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center text-primary">
                          <FileText className="h-5 w-5" />
                        </div>
                        <div>
                          <CardTitle className="text-base">
                            {language === "ru" ? "Акт №" : "Act #"}
                            {act.actNumber ?? act.id}
                          </CardTitle>
                          <CardDescription className="text-xs">
                            <div>
                              {act.dateEnd
                                ? format(new Date(act.dateEnd), "MMM d, yyyy", { locale: language === "ru" ? ru : enUS })
                                : act.dateStart
                                  ? format(new Date(act.dateStart), "MMM d, yyyy", { locale: language === "ru" ? ru : enUS })
                                  : language === "ru"
                                    ? "Без даты"
                                    : "No date"}
                            </div>
                            <div className="text-muted-foreground">
                              {(() => {
                                const tpl = templatesById.get(Number((act as any).actTemplateId ?? -1));
                                if (!tpl) return language === "ru" ? "Тип: не выбран" : "Type: not set";
                                const title = language === "ru" ? tpl.title : tpl.titleEn ?? tpl.title;
                                return `Тип: ${tpl.code} — ${title}`;
                              })()}
                            </div>
                          </CardDescription>
                        </div>
                      </div>
                      <Badge variant={act.status === "signed" ? "default" : "secondary"} className="capitalize">
                        {act.status}
                      </Badge>
                    </CardHeader>
                    <CardContent className="p-4 pt-2">
                      <div className="flex items-center justify-between mt-2">
                        <span className="text-xs text-muted-foreground">
                          {act.worksData?.length || 0} {language === "ru" ? "работ" : "work items"}
                        </span>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-8 text-xs gap-1 group-hover:text-primary"
                          onClick={() => handleDownloadAct(act.id)}
                          disabled={exportingActId !== null}
                          data-testid={`button-download-act-${act.id}`}
                        >
                          {exportingActId === act.id ? (
                            <Loader2 className="h-3 w-3 animate-spin" />
                          ) : (
                            <>
                              {language === "ru" ? "Скачать" : "Download"} <Download className="h-3 w-3" />
                            </>
                          )}
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                </motion.div>
              ))
            )}
          </div>
        )}
      </div>

      <div className="fixed bottom-20 right-4 z-40 md:right-[max(1rem,calc(50vw-220px))]">
        <Dialog
          open={isDialogOpen}
          onOpenChange={(open) => {
            setIsDialogOpen(open);
            if (!open) setExportActId(null);
          }}
        >
          <DialogContent className="sm:max-w-lg max-h-[90vh] rounded-2xl flex flex-col overflow-hidden">
            <DialogHeader>
              <DialogTitle>{language === "ru" ? "Экспорт АОСР" : "Export AOSR"}</DialogTitle>
            </DialogHeader>
            <div className="flex-1 min-h-0 overflow-y-auto">
              <div className="py-4 space-y-4 pr-4">
                <div className="grid gap-4 grid-cols-2">
                  <div className="grid gap-2">
                    <label className="text-sm font-medium">{language === "ru" ? "Дата начала" : "Start Date"}</label>
                    <Popover>
                      <PopoverTrigger asChild>
                        <Button variant={"outline"} className={cn("w-full justify-start text-left font-normal h-10 rounded-xl text-sm", !dateStart && "text-muted-foreground")} data-testid="button-date-start">
                          <CalendarIcon className="mr-2 h-4 w-4" />
                          {dateStart ? format(dateStart, "dd.MM.yy", { locale: language === "ru" ? ru : enUS }) : <span>{language === "ru" ? "Выбрать" : "Select"}</span>}
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0 z-[100]" align="start">
                        <Calendar mode="single" selected={dateStart} onSelect={setDateStart} initialFocus locale={language === "ru" ? ru : enUS} />
                      </PopoverContent>
                    </Popover>
                  </div>
                  <div className="grid gap-2">
                    <label className="text-sm font-medium">{language === "ru" ? "Дата окончания" : "End Date"}</label>
                    <Popover>
                      <PopoverTrigger asChild>
                        <Button variant={"outline"} className={cn("w-full justify-start text-left font-normal h-10 rounded-xl text-sm", !dateEnd && "text-muted-foreground")} data-testid="button-date-end">
                          <CalendarIcon className="mr-2 h-4 w-4" />
                          {dateEnd ? format(dateEnd, "dd.MM.yy", { locale: language === "ru" ? ru : enUS }) : <span>{language === "ru" ? "Выбрать" : "Select"}</span>}
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0 z-[100]" align="start">
                        <Calendar mode="single" selected={dateEnd} onSelect={setDateEnd} initialFocus locale={language === "ru" ? ru : enUS} />
                      </PopoverContent>
                    </Popover>
                  </div>
                </div>

                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <label className="text-sm font-medium">{language === "ru" ? "Выберите шаблоны актов" : "Select Act Templates"}</label>
                    <Badge variant="secondary" className="text-xs">
                      {selectedTemplates.size} {language === "ru" ? "выбрано" : "selected"}
                    </Badge>
                  </div>

                  {templatesLoading ? (
                    <div className="flex justify-center py-8">
                      <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                    </div>
                  ) : (
                    <Accordion type="multiple" className="w-full">
                      {groupedTemplates &&
                        Object.entries(groupedTemplates).map(([category, templates]) => {
                          const categoryInfo = templatesData?.categories[category];
                          const categoryName = language === "ru" ? categoryInfo?.name : categoryInfo?.nameEn || category;
                          const allSelected = templates.every((t) => selectedTemplates.has(t.templateId));
                          const someSelected = templates.some((t) => selectedTemplates.has(t.templateId));

                          return (
                            <AccordionItem key={category} value={category} className="border rounded-lg mb-2 px-3">
                              <AccordionTrigger className="py-3 hover:no-underline">
                                <div className="flex items-center gap-3 flex-1">
                                  <Checkbox
                                    checked={allSelected}
                                    className={cn(someSelected && !allSelected && "data-[state=checked]:bg-primary/50")}
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      handleSelectAll(category);
                                    }}
                                    data-testid={`checkbox-category-${category}`}
                                  />
                                  <span className="text-sm font-medium">{categoryName}</span>
                                  <Badge variant="outline" className="ml-auto mr-2 text-xs">
                                    {templates.filter((t) => selectedTemplates.has(t.templateId)).length}/{templates.length}
                                  </Badge>
                                </div>
                              </AccordionTrigger>
                              <AccordionContent className="pb-3">
                                <div className="space-y-2 pl-7">
                                  {templates.map((template) => (
                                    <label key={template.templateId} className="flex items-start gap-3 cursor-pointer py-1.5 hover:bg-muted/50 rounded-md px-2 -mx-2">
                                      <Checkbox
                                        checked={selectedTemplates.has(template.templateId)}
                                        onCheckedChange={() => handleTemplateToggle(template.templateId)}
                                        className="mt-0.5"
                                        data-testid={`checkbox-template-${template.templateId}`}
                                      />
                                      <div className="flex-1 min-w-0">
                                        <div className="flex items-center gap-2">
                                          <span className="text-xs text-muted-foreground font-mono">{template.code}</span>
                                          <span className="text-sm">{language === "ru" ? template.title : template.titleEn || template.title}</span>
                                        </div>
                                        {template.normativeRef && <p className="text-xs text-muted-foreground mt-0.5">{template.normativeRef}</p>}
                                      </div>
                                    </label>
                                  ))}
                                </div>
                              </AccordionContent>
                            </AccordionItem>
                          );
                        })}
                    </Accordion>
                  )}
                </div>

                <Accordion type="single" collapsible className="w-full">
                  <AccordionItem value="aosrForm" className="border rounded-lg px-3">
                    <AccordionTrigger className="py-3 hover:no-underline">
                      <span className="text-sm font-medium">
                        {language === "ru" ? "Данные для АОСР (эталон 005_АОСР 4)" : "AOSR form data (reference template)"}
                      </span>
                    </AccordionTrigger>
                    <AccordionContent className="pb-4">
                      <div className="space-y-4">
                        <div className="grid gap-3 grid-cols-2">
                          <div className="grid gap-1.5">
                            <Label>№ акта</Label>
                            <Input
                              value={aosrForm.actNumber}
                              onChange={(e) => setAosrForm((s) => ({ ...s, actNumber: e.target.value }))}
                              placeholder={language === "ru" ? "Например: 4" : "e.g. 4"}
                            />
                          </div>
                          <div className="grid gap-1.5">
                            <Label>Дата акта</Label>
                            <Input
                              value={aosrForm.actDate}
                              onChange={(e) => setAosrForm((s) => ({ ...s, actDate: e.target.value }))}
                              placeholder={language === "ru" ? "YYYY-MM-DD" : "YYYY-MM-DD"}
                            />
                          </div>
                        </div>

                        <div className="grid gap-3">
                          <div className="grid gap-1.5">
                            <Label>{language === "ru" ? "Объект (полная строка)" : "Object (full line)"}</Label>
                            <Textarea
                              value={aosrForm.objectFullName}
                              onChange={(e) => setAosrForm((s) => ({ ...s, objectFullName: e.target.value }))}
                              placeholder={language === "ru" ? "Строительство ... по адресу: ..." : "Construction ... at address ..."}
                              className="min-h-[72px]"
                            />
                          </div>
                          <div className="grid gap-3 grid-cols-2">
                            <div className="grid gap-1.5">
                              <Label>{language === "ru" ? "Объект (кратко)" : "Object name"}</Label>
                              <Input
                                value={aosrForm.objectName}
                                onChange={(e) => setAosrForm((s) => ({ ...s, objectName: e.target.value }))}
                                placeholder={language === "ru" ? "Наименование" : "Name"}
                              />
                            </div>
                            <div className="grid gap-1.5">
                              <Label>{language === "ru" ? "Адрес объекта" : "Object address"}</Label>
                              <Input
                                value={aosrForm.objectAddress}
                                onChange={(e) => setAosrForm((s) => ({ ...s, objectAddress: e.target.value }))}
                                placeholder={language === "ru" ? "Адрес" : "Address"}
                              />
                            </div>
                          </div>
                        </div>

                        <div className="grid gap-3">
                          <div className="grid gap-1.5">
                            <Label>{language === "ru" ? "Застройщик/техзаказчик (реквизиты одной строкой)" : "Developer/customer (one line)"}</Label>
                            <Textarea
                              value={aosrForm.developerOrgFull}
                              onChange={(e) => setAosrForm((s) => ({ ...s, developerOrgFull: e.target.value }))}
                              className="min-h-[60px]"
                            />
                          </div>
                          <div className="grid gap-1.5">
                            <Label>{language === "ru" ? "Лицо, осуществляющее строительство (реквизиты)" : "Builder org (details)"}</Label>
                            <Textarea
                              value={aosrForm.builderOrgFull}
                              onChange={(e) => setAosrForm((s) => ({ ...s, builderOrgFull: e.target.value }))}
                              className="min-h-[60px]"
                            />
                          </div>
                          <div className="grid gap-1.5">
                            <Label>{language === "ru" ? "Проектировщик (реквизиты)" : "Designer org (details)"}</Label>
                            <Textarea
                              value={aosrForm.designerOrgFull}
                              onChange={(e) => setAosrForm((s) => ({ ...s, designerOrgFull: e.target.value }))}
                              className="min-h-[60px]"
                            />
                          </div>
                        </div>

                        <div className="grid gap-3">
                          <div className="grid gap-1.5">
                            <Label>{language === "ru" ? "Представитель заказчика по стройконтролю (строка)" : "Customer control rep (line)"}</Label>
                            <Input
                              value={aosrForm.repCustomerControlLine}
                              onChange={(e) => setAosrForm((s) => ({ ...s, repCustomerControlLine: e.target.value }))}
                              placeholder={language === "ru" ? "инженер ... Фамилия И.О." : "position ... Name I.O."}
                            />
                          </div>
                          <div className="grid gap-1.5">
                            <Label>{language === "ru" ? "Основание/приказ" : "Order/basis"}</Label>
                            <Input
                              value={aosrForm.repCustomerControlOrder}
                              onChange={(e) => setAosrForm((s) => ({ ...s, repCustomerControlOrder: e.target.value }))}
                              placeholder={language === "ru" ? "приказ № ... от ..." : "order # ..."}
                            />
                          </div>

                          <div className="grid gap-1.5">
                            <Label>{language === "ru" ? "Представитель строителя (строка)" : "Builder rep (line)"}</Label>
                            <Input
                              value={aosrForm.repBuilderLine}
                              onChange={(e) => setAosrForm((s) => ({ ...s, repBuilderLine: e.target.value }))}
                            />
                          </div>
                          <div className="grid gap-1.5">
                            <Label>{language === "ru" ? "Основание/приказ" : "Order/basis"}</Label>
                            <Input
                              value={aosrForm.repBuilderOrder}
                              onChange={(e) => setAosrForm((s) => ({ ...s, repBuilderOrder: e.target.value }))}
                            />
                          </div>

                          <div className="grid gap-1.5">
                            <Label>{language === "ru" ? "Строитель по стройконтролю (строка)" : "Builder control rep (line)"}</Label>
                            <Input
                              value={aosrForm.repBuilderControlLine}
                              onChange={(e) => setAosrForm((s) => ({ ...s, repBuilderControlLine: e.target.value }))}
                            />
                          </div>
                          <div className="grid gap-1.5">
                            <Label>{language === "ru" ? "Основание/приказ" : "Order/basis"}</Label>
                            <Input
                              value={aosrForm.repBuilderControlOrder}
                              onChange={(e) => setAosrForm((s) => ({ ...s, repBuilderControlOrder: e.target.value }))}
                            />
                          </div>

                          <div className="grid gap-1.5">
                            <Label>{language === "ru" ? "Представитель проектировщика (строка)" : "Designer rep (line)"}</Label>
                            <Input
                              value={aosrForm.repDesignerLine}
                              onChange={(e) => setAosrForm((s) => ({ ...s, repDesignerLine: e.target.value }))}
                            />
                          </div>
                          <div className="grid gap-1.5">
                            <Label>{language === "ru" ? "Основание/приказ" : "Order/basis"}</Label>
                            <Input
                              value={aosrForm.repDesignerOrder}
                              onChange={(e) => setAosrForm((s) => ({ ...s, repDesignerOrder: e.target.value }))}
                            />
                          </div>

                          <div className="grid gap-1.5">
                            <Label>{language === "ru" ? "Лицо, выполнившее работы (строка)" : "Work performer rep (line)"}</Label>
                            <Input
                              value={aosrForm.repWorkPerformerLine}
                              onChange={(e) => setAosrForm((s) => ({ ...s, repWorkPerformerLine: e.target.value }))}
                            />
                          </div>
                          <div className="grid gap-1.5">
                            <Label>{language === "ru" ? "Основание/приказ" : "Order/basis"}</Label>
                            <Input
                              value={aosrForm.repWorkPerformerOrder}
                              onChange={(e) => setAosrForm((s) => ({ ...s, repWorkPerformerOrder: e.target.value }))}
                            />
                          </div>
                        </div>

                        <div className="grid gap-3">
                          <div className="grid gap-1.5">
                            <Label>{language === "ru" ? "П.1 Предъявленные работы (оставьте пустым — авто из графика)" : "P.1 Works performed (leave empty for auto from schedule)"}</Label>
                            <Textarea
                              value={aosrForm.p1Works}
                              onChange={(e) => setAosrForm((s) => ({ ...s, p1Works: e.target.value }))}
                              className="min-h-[72px]"
                              placeholder={language === "ru" ? "Автозаполнение из графика работ" : "Auto-filled from work schedule"}
                            />
                          </div>
                          <div className="grid gap-1.5">
                            <Label>{language === "ru" ? "П.2 Проектная документация" : "P.2 Project docs"}</Label>
                            <Input
                              value={aosrForm.p2ProjectDocs}
                              onChange={(e) => setAosrForm((s) => ({ ...s, p2ProjectDocs: e.target.value }))}
                              placeholder={language === "ru" ? "Напр.: АЗП-... лист ..." : "e.g. drawing ref"}
                            />
                          </div>

                          <div className="rounded-xl border p-3 space-y-3">
                            <div className="flex items-start justify-between gap-3">
                              <div>
                                <div className="text-sm font-medium">
                                  {language === "ru" ? "Материалы для п.3 (из модуля материалов)" : "P.3 materials (from Materials module)"}
                                </div>
                                <div className="text-xs text-muted-foreground">
                                  {language === "ru"
                                    ? "Если список заполнен — оставьте поле “П.3 Материалы” пустым: сервер соберёт текст автоматически."
                                    : "If selected, keep “P.3 Materials” empty: server will build text automatically."}
                                </div>
                              </div>
                              <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                className="rounded-xl"
                                onClick={() => setIsP3PickerOpen(true)}
                                disabled={!objectId}
                              >
                                {language === "ru" ? "Выбрать" : "Pick"}
                              </Button>
                            </div>

                            {p3Materials.length === 0 ? (
                              <div className="text-xs text-muted-foreground">
                                {language === "ru" ? "Материалы не выбраны." : "No materials selected."}
                              </div>
                            ) : (
                              <div className="space-y-2">
                                {p3Materials.map((m, idx) => (
                                  <div key={m.projectMaterialId} className="rounded-lg border p-2">
                                    <div className="flex items-start justify-between gap-2">
                                      <div className="min-w-0">
                                        <div className="text-sm font-medium truncate">
                                          {idx + 1}. {m.title}
                                        </div>
                                        <div className="text-xs text-muted-foreground truncate">
                                          {m.qualityLabel ? `Документ: ${m.qualityLabel}` : "Документ: не выбран"}
                                        </div>
                                      </div>
                                      <div className="flex gap-2 shrink-0">
                                        <Button
                                          type="button"
                                          variant="secondary"
                                          size="sm"
                                          className="rounded-xl"
                                          onClick={() => setDocPickerForMaterialId(m.projectMaterialId)}
                                        >
                                          {language === "ru" ? "Документ" : "Doc"}
                                        </Button>
                                        <Button
                                          type="button"
                                          variant="outline"
                                          size="sm"
                                          className="rounded-xl"
                                          onClick={() =>
                                            setP3Materials((prev) => prev.filter((x) => x.projectMaterialId !== m.projectMaterialId))
                                          }
                                        >
                                          {language === "ru" ? "Убрать" : "Remove"}
                                        </Button>
                                      </div>
                                    </div>
                                  </div>
                                ))}
                              </div>
                            )}

                            {derivedAttachments.length > 0 ? (
                              <div className="text-xs text-muted-foreground">
                                {language === "ru" ? "Приложения (авто из выбранных документов):" : "Attachments (auto from selected docs):"}{" "}
                                {derivedAttachments.join("; ")}
                              </div>
                            ) : null}
                          </div>

                          <div className="grid gap-1.5">
                            <Label>{language === "ru" ? "П.3 Материалы (как в эталоне, текстом)" : "P.3 Materials (text)"}</Label>
                            <Textarea
                              value={aosrForm.p3MaterialsText}
                              onChange={(e) => setAosrForm((s) => ({ ...s, p3MaterialsText: e.target.value }))}
                              className="min-h-[88px]"
                              placeholder={language === "ru" ? "ФБС ... — паспорт ...; ..." : "Material — doc; ..."}
                            />
                          </div>
                          <div className="grid gap-1.5">
                            <Label>{language === "ru" ? "П.4 Исполнительные документы" : "P.4 As-built docs"}</Label>
                            <Textarea
                              value={aosrForm.p4AsBuiltDocs}
                              onChange={(e) => setAosrForm((s) => ({ ...s, p4AsBuiltDocs: e.target.value }))}
                              className="min-h-[72px]"
                            />
                          </div>
                          <div className="grid gap-1.5">
                            <Label>{language === "ru" ? "П.6 Соответствие (НД/разделам ПД)" : "P.6 Normative refs"}</Label>
                            <Input
                              value={aosrForm.p6NormativeRefs}
                              onChange={(e) => setAosrForm((s) => ({ ...s, p6NormativeRefs: e.target.value }))}
                            />
                          </div>
                          <div className="grid gap-1.5">
                            <Label>{language === "ru" ? "П.7 Последующие работы" : "P.7 Next works"}</Label>
                            <Input
                              value={aosrForm.p7NextWorks}
                              onChange={(e) => setAosrForm((s) => ({ ...s, p7NextWorks: e.target.value }))}
                            />
                          </div>
                        </div>

                        <div className="grid gap-3 grid-cols-2">
                          <div className="grid gap-1.5">
                            <Label>{language === "ru" ? "Экземпляров" : "Copies count"}</Label>
                            <Input
                              value={aosrForm.copiesCount}
                              onChange={(e) => setAosrForm((s) => ({ ...s, copiesCount: e.target.value }))}
                              placeholder={language === "ru" ? "Напр.: 3" : "e.g. 3"}
                            />
                          </div>
                          <div className="grid gap-1.5">
                            <Label>{language === "ru" ? "Доп. сведения" : "Additional info"}</Label>
                            <Input
                              value={aosrForm.additionalInfo}
                              onChange={(e) => setAosrForm((s) => ({ ...s, additionalInfo: e.target.value }))}
                            />
                          </div>
                        </div>

                        <div className="grid gap-1.5">
                          <Label>{language === "ru" ? "Приложения (каждая строка — отдельный пункт)" : "Attachments (one per line)"}</Label>
                          <Textarea
                            value={aosrForm.attachmentsLines}
                            onChange={(e) => setAosrForm((s) => ({ ...s, attachmentsLines: e.target.value }))}
                            className="min-h-[100px]"
                            placeholder={language === "ru" ? "паспорт ...\nпротокол ...\nсертификат ..." : "doc...\ndoc..."}
                          />
                        </div>

                        <div className="grid gap-3">
                          <div className="grid gap-1.5">
                            <Label>{language === "ru" ? "Подпись: заказчик (Фамилия И.О.)" : "Signature: customer (Name I.O.)"}</Label>
                            <Input
                              value={aosrForm.sigCustomerControl}
                              onChange={(e) => setAosrForm((s) => ({ ...s, sigCustomerControl: e.target.value }))}
                            />
                          </div>
                          <div className="grid gap-1.5">
                            <Label>{language === "ru" ? "Подпись: строитель (Фамилия И.О.)" : "Signature: builder"}</Label>
                            <Input
                              value={aosrForm.sigBuilder}
                              onChange={(e) => setAosrForm((s) => ({ ...s, sigBuilder: e.target.value }))}
                            />
                          </div>
                          <div className="grid gap-1.5">
                            <Label>{language === "ru" ? "Подпись: стройконтроль строителя" : "Signature: builder control"}</Label>
                            <Input
                              value={aosrForm.sigBuilderControl}
                              onChange={(e) => setAosrForm((s) => ({ ...s, sigBuilderControl: e.target.value }))}
                            />
                          </div>
                          <div className="grid gap-1.5">
                            <Label>{language === "ru" ? "Подпись: проектировщик" : "Signature: designer"}</Label>
                            <Input
                              value={aosrForm.sigDesigner}
                              onChange={(e) => setAosrForm((s) => ({ ...s, sigDesigner: e.target.value }))}
                            />
                          </div>
                          <div className="grid gap-1.5">
                            <Label>{language === "ru" ? "Подпись: выполнивший работы" : "Signature: work performer"}</Label>
                            <Input
                              value={aosrForm.sigWorkPerformer}
                              onChange={(e) => setAosrForm((s) => ({ ...s, sigWorkPerformer: e.target.value }))}
                            />
                          </div>
                        </div>
                      </div>
                    </AccordionContent>
                  </AccordionItem>
                </Accordion>
              </div>
            </div>
            <div className="pt-4 border-t">
              <Button
                onClick={handleExport}
                className="w-full h-12 rounded-xl gap-2"
                disabled={!exportActId || isGenerating || exportAct.isPending}
                data-testid="button-submit-export"
              >
                {isGenerating ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    {language === "ru" ? "Экспорт..." : "Exporting..."}
                  </>
                ) : (
                  <>
                    <FileDown className="h-4 w-4" />
                    {language === "ru" ? "Скачать PDF" : "Download PDF"}
                  </>
                )}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {/* Материалы для п.3 (picker) */}
      <Dialog open={isP3PickerOpen} onOpenChange={setIsP3PickerOpen}>
        <DialogContent className="sm:max-w-lg rounded-2xl">
          <DialogHeader>
            <DialogTitle>{language === "ru" ? "Выбрать материалы" : "Select materials"}</DialogTitle>
          </DialogHeader>

          <div className="space-y-3">
            <Input
              placeholder={language === "ru" ? "Поиск..." : "Search..."}
              value={p3PickerSearch}
              onChange={(e) => setP3PickerSearch(e.target.value)}
            />

            <ScrollArea className="h-[50vh] pr-2">
              <div className="space-y-2">
                {projectMaterialsQuery.isLoading ? (
                  <div className="flex items-center justify-center py-6 text-muted-foreground">
                    <Loader2 className="h-5 w-5 animate-spin mr-2" />
                    {language === "ru" ? "Загрузка..." : "Loading..."}
                  </div>
                ) : (
                  ((projectMaterialsQuery.data ?? []) as any[])
                    .filter((m) => {
                      const q = p3PickerSearch.trim().toLowerCase();
                      if (!q) return true;
                      const title = String(m.nameOverride ?? `Материал #${m.id}`).toLowerCase();
                      return title.includes(q);
                    })
                    .map((m) => {
                      const id = Number(m.id);
                      const title = String(m.nameOverride ?? `Материал #${m.id}`);
                      const checked = p3Materials.some((x) => x.projectMaterialId === id);
                      return (
                        <label key={id} className="flex items-start gap-3 rounded-lg border p-3 cursor-pointer">
                          <Checkbox
                            checked={checked}
                            onCheckedChange={(v) => {
                              const next = Boolean(v);
                              setP3Materials((prev) => {
                                if (next) {
                                  if (prev.some((x) => x.projectMaterialId === id)) return prev;
                                  return [...prev, { projectMaterialId: id, title, qualityDocumentId: null }];
                                }
                                return prev.filter((x) => x.projectMaterialId !== id);
                              });
                            }}
                          />
                          <div className="min-w-0">
                            <div className="font-medium text-sm truncate">{title}</div>
                            <div className="text-xs text-muted-foreground">
                              {m.hasUseInActsQualityDoc ? (language === "ru" ? "Готово для актов" : "Ready") : (language === "ru" ? "Нет документа для актов" : "No quality doc")}
                            </div>
                          </div>
                        </label>
                      );
                    })
                )}
              </div>
            </ScrollArea>
          </div>

          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setIsP3PickerOpen(false)}>
              {language === "ru" ? "Готово" : "Done"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Выбор документа качества для выбранного материала */}
      <Dialog
        open={docPickerForMaterialId != null}
        onOpenChange={(v) => {
          if (!v) setDocPickerForMaterialId(null);
        }}
      >
        <DialogContent className="sm:max-w-md rounded-2xl">
          <DialogHeader>
            <DialogTitle>{language === "ru" ? "Документ качества" : "Quality document"}</DialogTitle>
          </DialogHeader>

          {docPickerLoading ? (
            <div className="flex items-center justify-center py-8 text-muted-foreground">
              <Loader2 className="h-5 w-5 animate-spin mr-2" />
              {language === "ru" ? "Загрузка..." : "Loading..."}
            </div>
          ) : (
            <div className="space-y-2">
              <Button
                variant="outline"
                className="w-full justify-start"
                onClick={() => {
                  const mid = docPickerForMaterialId;
                  if (!mid) return;
                  setP3Materials((prev) =>
                    prev.map((m) => (m.projectMaterialId === mid ? { ...m, qualityDocumentId: null, qualityLabel: undefined } : m))
                  );
                  setDocPickerForMaterialId(null);
                }}
              >
                {language === "ru" ? "Не указывать документ" : "No document"}
              </Button>

              {docPickerOptions.length === 0 ? (
                <div className="text-sm text-muted-foreground">{language === "ru" ? "Нет доступных документов." : "No documents found."}</div>
              ) : (
                docPickerOptions.map((opt) => (
                  <Button
                    key={opt.id}
                    variant="secondary"
                    className="w-full justify-start"
                    onClick={() => {
                      const mid = docPickerForMaterialId;
                      if (!mid) return;
                      setP3Materials((prev) =>
                        prev.map((m) =>
                          m.projectMaterialId === mid ? { ...m, qualityDocumentId: opt.id, qualityLabel: opt.label } : m
                        )
                      );
                      setDocPickerForMaterialId(null);
                    }}
                  >
                    {opt.label}
                  </Button>
                ))
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>

      <BottomNav />
    </div>
  );
}
