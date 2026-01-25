import { useState } from "react";
import { BottomNav } from "@/components/BottomNav";
import { Header } from "@/components/Header";
import { useActs, useGenerateAct } from "@/hooks/use-acts";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Checkbox } from "@/components/ui/checkbox";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { ScrollArea } from "@/components/ui/scroll-area";
import { FileText, CalendarIcon, Download, Loader2, Plus, ChevronRight, Check, FileDown } from "lucide-react";
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
import { useDefaultSchedule } from "@/hooks/use-schedules";
import { api, buildUrl } from "@shared/routes";

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
  const generateAct = useGenerateAct();
  const { toast } = useToast();
  const { data: defaultSchedule } = useDefaultSchedule();
  const scheduleId = defaultSchedule?.id;
  const [dateStart, setDateStart] = useState<Date>();
  const [dateEnd, setDateEnd] = useState<Date>();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [selectedTemplates, setSelectedTemplates] = useState<Set<string>>(new Set());
  const [isGenerating, setIsGenerating] = useState(false);

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

  const { data: templatesData, isLoading: templatesLoading } = useQuery<TemplatesResponse>({
    queryKey: ["/api/act-templates"],
  });

  const createActWithTemplates = useMutation({
    mutationFn: async (data: { dateStart: string; dateEnd: string; templateIds: string[] }) => {
      const response = await apiRequest("POST", "/api/acts/create-with-templates", data);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/acts"] });
    },
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
            ? `Создано: ${data.created}, обновлено: ${data.updated}. Пропущено (без номера): ${data.skippedNoActNumber}`
            : `Created: ${data.created}, updated: ${data.updated}. Skipped (no number): ${data.skippedNoActNumber}`,
      });
    },
  });

  const handleTemplateToggle = (templateId: string) => {
    const newSelected = new Set(selectedTemplates);
    if (newSelected.has(templateId)) {
      newSelected.delete(templateId);
    } else {
      newSelected.add(templateId);
    }
    setSelectedTemplates(newSelected);
  };

  const handleSelectAll = (category: string) => {
    if (!templatesData) return;
    const categoryTemplates = templatesData.templates.filter((t) => t.category === category);
    const allSelected = categoryTemplates.every((t) => selectedTemplates.has(t.templateId));

    const newSelected = new Set(selectedTemplates);
    if (allSelected) {
      categoryTemplates.forEach((t) => newSelected.delete(t.templateId));
    } else {
      categoryTemplates.forEach((t) => newSelected.add(t.templateId));
    }
    setSelectedTemplates(newSelected);
  };

  const handleGenerate = async () => {
    if (!dateStart || !dateEnd || selectedTemplates.size === 0) {
      toast({
        title: language === "ru" ? "Ошибка" : "Error",
        description: language === "ru" ? "Выберите период и хотя бы один шаблон" : "Select date range and at least one template",
        variant: "destructive",
      });
      return;
    }

    setIsGenerating(true);
    try {
      const act = await createActWithTemplates.mutateAsync({
        dateStart: format(dateStart, "yyyy-MM-dd"),
        dateEnd: format(dateEnd, "yyyy-MM-dd"),
        templateIds: Array.from(selectedTemplates),
      });

      const exportResult = await exportAct.mutateAsync({
        actId: act.id,
        templateIds: Array.from(selectedTemplates),
      });

      setIsDialogOpen(false);
      setSelectedTemplates(new Set());
      setDateStart(undefined);
      setDateEnd(undefined);
      setAosrForm({
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
        p2ProjectDocs: "",
        p3MaterialsText: "",
        p4AsBuiltDocs: "",
        p6NormativeRefs: "",
        p7NextWorks: "",
        additionalInfo: "",
        copiesCount: "",
        attachmentsLines: "",
        sigCustomerControl: "",
        sigBuilder: "",
        sigBuilderControl: "",
        sigDesigner: "",
        sigWorkPerformer: "",
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
    } catch (error) {
      toast({
        title: language === "ru" ? "Ошибка" : "Error",
        description: language === "ru" ? "Не удалось создать акты" : "Failed to generate acts",
        variant: "destructive",
      });
    } finally {
      setIsGenerating(false);
    }
  };

  const groupedTemplates = templatesData?.templates.reduce(
    (acc, template) => {
      if (!acc[template.category]) {
        acc[template.category] = [];
      }
      acc[template.category].push(template);
      return acc;
    },
    {} as Record<string, ActTemplate[]>
  );

  const handleDownloadAct = async (actId: number) => {
    toast({
      title: language === "ru" ? "Скачивание" : "Downloading",
      description: language === "ru" ? "Подготовка документов..." : "Preparing documents...",
    });
    try {
      const exportResult = await exportAct.mutateAsync({ actId, templateIds: [] });
      if (exportResult.files && exportResult.files.length > 0) {
        exportResult.files.forEach((file: { url: string; filename: string }) => {
          window.open(file.url, "_blank");
        });
      } else {
        throw new Error("No files");
      }
    } catch (_e) {
      toast({
        title: language === "ru" ? "Ошибка" : "Error",
        description: language === "ru" ? "Не удалось скачать акт" : "Failed to download act",
        variant: "destructive",
      });
    }
  };

  return (
    <div className="flex flex-col min-h-screen bg-background bg-grain">
      <Header title={t.title} />

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
                            {act.dateEnd
                              ? format(new Date(act.dateEnd), "MMM d, yyyy", { locale: language === "ru" ? ru : enUS })
                              : act.dateStart
                                ? format(new Date(act.dateStart), "MMM d, yyyy", { locale: language === "ru" ? ru : enUS })
                                : "No date"}
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
                        <Button variant="ghost" size="sm" className="h-8 text-xs gap-1 group-hover:text-primary" onClick={() => handleDownloadAct(act.id)} data-testid={`button-download-act-${act.id}`}>
                          {language === "ru" ? "Скачать" : "Download"} <Download className="h-3 w-3" />
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
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button className="h-14 rounded-full shadow-xl bg-primary hover:bg-primary/90 pl-5 pr-6 gap-2" data-testid="button-generate-act">
              <Plus className="h-5 w-5" />
              <span className="font-semibold">{t.generate}</span>
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-lg max-h-[90vh] rounded-2xl flex flex-col">
            <DialogHeader>
              <DialogTitle>{language === "ru" ? "Создать акты АОСР" : "Generate AOSR Acts"}</DialogTitle>
            </DialogHeader>
            <ScrollArea className="flex-1 max-h-[60vh]">
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
                            <Label>{language === "ru" ? "П.2 Проектная документация" : "P.2 Project docs"}</Label>
                            <Input
                              value={aosrForm.p2ProjectDocs}
                              onChange={(e) => setAosrForm((s) => ({ ...s, p2ProjectDocs: e.target.value }))}
                              placeholder={language === "ru" ? "Напр.: АЗП-... лист ..." : "e.g. drawing ref"}
                            />
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
            </ScrollArea>
            <div className="pt-4 border-t">
              <Button onClick={handleGenerate} className="w-full h-12 rounded-xl gap-2" disabled={!dateStart || !dateEnd || selectedTemplates.size === 0 || isGenerating} data-testid="button-submit-generate">
                {isGenerating ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    {language === "ru" ? "Создание..." : "Generating..."}
                  </>
                ) : (
                  <>
                    <FileDown className="h-4 w-4" />
                    {language === "ru" ? `Создать ${selectedTemplates.size} актов` : `Generate ${selectedTemplates.size} acts`}
                  </>
                )}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <BottomNav />
    </div>
  );
}
