/**
 * @file: Works.tsx
 * @description: Страница ВОР (ведомость объёмов работ) и сметы — переключение вкладок, импорт Excel, список карточек
 * @dependencies: use-works, use-estimates, WorkItemCard, shadcn/ui, lucide-react, i18n
 * @created: 2026-02-23
 */

import { useEffect, useMemo, useState } from "react";
import { BottomNav } from "@/components/BottomNav";
import { Header } from "@/components/Header";
import { useWorks, useCreateWork, useImportWorks, useClearWorks } from "@/hooks/use-works";
import { useDeleteEstimate, useEstimate, useEstimates, useImportEstimate } from "@/hooks/use-estimates";
import { useCurrentObject } from "@/hooks/use-source-data";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Label } from "@/components/ui/label";
import { Plus, Search, Loader2, FileUp } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useLanguageStore, translations } from "@/lib/i18n";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { WorkItemCard } from "@/components/WorkItemCard";
import { cn } from "@/lib/utils";
import * as XLSX from "xlsx";
import { parseEstimateWorkbook } from "@/lib/estimateParser";

export default function Works() {
  const { language } = useLanguageStore();
  const t = translations[language].works;
  const te: any = (translations as any)[language]?.estimate ?? {};
  const { data: currentObject } = useCurrentObject();
  const objectSubtitle = currentObject?.title
    ? `${language === "ru" ? "ОБЪЕКТ" : "OBJECT"}: ${currentObject.title}`
    : undefined;
  const { data: works = [], isLoading } = useWorks();
  const createWork = useCreateWork();
  const importWorks = useImportWorks();
  const clearWorks = useClearWorks();
  const estimatesQuery = useEstimates();
  const importEstimate = useImportEstimate();
  const deleteEstimate = useDeleteEstimate();
  const { toast } = useToast();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [isImporting, setIsImporting] = useState(false);
  const [isImportingEstimate, setIsImportingEstimate] = useState(false);
  const [tab, setTab] = useState<"works" | "estimate">("works");
  const [selectedEstimateId, setSelectedEstimateId] = useState<number | null>(null);
  const estimateQuery = useEstimate(selectedEstimateId);
  const [isDeleteEstimateDialogOpen, setIsDeleteEstimateDialogOpen] = useState(false);
  const [pendingDeleteEstimateId, setPendingDeleteEstimateId] = useState<number | null>(null);
  const [isClearWorksDialogOpen, setIsClearWorksDialogOpen] = useState(false);

  const [formData, setFormData] = useState({
    code: "",
    description: "",
    unit: "m3",
    quantityTotal: "",
  });

  useEffect(() => {
    const list = estimatesQuery.data ?? [];
    if (selectedEstimateId === null && list.length > 0) {
      setSelectedEstimateId(list[0].id);
    }
  }, [estimatesQuery.data, selectedEstimateId]);

  const estimatesList = estimatesQuery.data ?? [];
  const estimateDetails: any = estimateQuery.data;
  const estimateSections: any[] = estimateDetails?.sections ?? [];

  const handleCreate = async () => {
    try {
      await createWork.mutateAsync({
        ...formData,
        quantityTotal: formData.quantityTotal || "0",
        synonyms: [],
      });
      setIsDialogOpen(false);
      setFormData({ code: "", description: "", unit: "m3", quantityTotal: "" });
      toast({
        title: language === "ru" ? "Успех" : "Success",
        description: language === "ru" ? "Работа добавлена в ВОР" : "Work item added to BoQ",
      });
    } catch (error) {
      toast({
        title: language === "ru" ? "Ошибка" : "Error",
        description: language === "ru" ? "Не удалось добавить работу" : "Failed to create work item",
        variant: "destructive",
      });
    }
  };

  const readFileAsArrayBuffer = (file: File): Promise<ArrayBuffer> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onerror = () => reject(reader.error);
      reader.onload = () => resolve(reader.result as ArrayBuffer);
      reader.readAsArrayBuffer(file);
    });
  };

  const isValidWorkCode = (code: string): boolean => {
    return /^\d+(?:\.\d+)*$/.test(code.trim());
  };

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setIsImporting(true);
    try {
      const buffer = await readFileAsArrayBuffer(file);
      const data = new Uint8Array(buffer);

      let workbook;
      try {
        workbook = XLSX.read(data, { type: "array" });
      } catch (parseError) {
        throw new Error(
          language === "ru"
            ? "Не удалось прочитать Excel файл. Убедитесь, что файл не поврежден и имеет формат .xlsx или .xls"
            : "Failed to read Excel file. Make sure the file is not corrupted and is in .xlsx or .xls format"
        );
      }

      if (!workbook.SheetNames || workbook.SheetNames.length === 0) {
        throw new Error(
          language === "ru" ? "Файл не содержит листов" : "File contains no sheets"
        );
      }

      const firstSheetName = workbook.SheetNames[0];
      const worksheet = workbook.Sheets[firstSheetName];

      if (!worksheet) {
        throw new Error(
          language === "ru"
            ? "Не удалось прочитать первый лист файла"
            : "Failed to read the first sheet of the file"
        );
      }

      const jsonRaw = XLSX.utils.sheet_to_json(worksheet, { header: 1 }) as any[][];

      const items = [];
      let skippedCount = 0;
      for (const row of jsonRaw) {
        if (!Array.isArray(row) || row.length < 5) {
          skippedCount++;
          continue;
        }

        const codeRaw = row[1];
        const descriptionRaw = row[2];
        const unitRaw = row[3];
        const quantityRaw = row[4];

        if (row[0] === 1 && row[1] === 2 && row[2] === 3) {
          skippedCount++;
          continue;
        }

        const code = String(codeRaw ?? "").trim();
        const description = String(descriptionRaw ?? "").trim();
        const unit = String(unitRaw ?? "").trim();
        const quantityRawStr = String(quantityRaw ?? "0").trim();

        if (!code || !isValidWorkCode(code)) {
          skippedCount++;
          continue;
        }
        if (!description) {
          skippedCount++;
          continue;
        }
        if (!unit) {
          skippedCount++;
          continue;
        }

        const quantityTotal =
          quantityRawStr === "" || quantityRawStr === "0" ? null : quantityRawStr;

        items.push({ code, description, unit, quantityTotal, synonyms: [] });
      }

      if (items.length === 0) {
        toast({
          title: language === "ru" ? "Импорт" : "Import",
          description:
            language === "ru"
              ? "В файле не найдено подходящих строк для импорта."
              : "No valid rows found to import.",
          variant: "destructive",
        });
        return;
      }

      const result = await importWorks.mutateAsync({ mode: "merge", items });

      toast({
        title: language === "ru" ? "Импорт завершен" : "Import Complete",
        description:
          language === "ru"
            ? `Получено: ${result.received}. Создано: ${result.created}. Обновлено: ${result.updated}.`
            : `Received: ${result.received}. Created: ${result.created}. Updated: ${result.updated}.`,
      });
      event.target.value = "";
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : (error as any)?.message || String(error);

      toast({
        title: language === "ru" ? "Ошибка импорта" : "Import Error",
        description:
          language === "ru"
            ? `Произошла ошибка при импорте: ${errorMessage}`
            : `An error occurred during import: ${errorMessage}`,
        variant: "destructive",
      });
    } finally {
      setIsImporting(false);
    }
  };

  const handleEstimateFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setIsImportingEstimate(true);
    try {
      const buffer = await readFileAsArrayBuffer(file);
      const data = new Uint8Array(buffer);

      let workbook: XLSX.WorkBook;
      try {
        workbook = XLSX.read(data, { type: "array" });
      } catch {
        throw new Error(
          language === "ru"
            ? "Не удалось прочитать Excel файл сметы. Проверьте формат (.xlsx/.xls) и целостность."
            : "Failed to read estimate Excel file. Check format (.xlsx/.xls) and file integrity."
        );
      }

      const parsed = parseEstimateWorkbook(workbook, { fileName: file.name });
      const result = await importEstimate.mutateAsync(parsed);

      toast({
        title: language === "ru" ? "Импорт сметы завершен" : "Estimate import complete",
        description:
          language === "ru"
            ? `Смета #${result.estimateId}. Разделов: ${result.sections}, позиций: ${result.positions}, ресурсов: ${result.resources}.`
            : `Estimate #${result.estimateId}. Sections: ${result.sections}, positions: ${result.positions}, resources: ${result.resources}.`,
      });

      await estimatesQuery.refetch();
      setSelectedEstimateId(result.estimateId);
      event.target.value = "";
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      toast({
        title: language === "ru" ? "Ошибка импорта сметы" : "Estimate import error",
        description: msg,
        variant: "destructive",
      });
    } finally {
      setIsImportingEstimate(false);
    }
  };

  const selectedEstimateMeta = useMemo(() => {
    if (!selectedEstimateId) return null;
    return estimatesList.find((e) => e.id === selectedEstimateId) ?? null;
  }, [estimatesList, selectedEstimateId]);

  const filteredWorks = works.filter(
    (w) =>
      w.description.toLowerCase().includes(searchTerm.toLowerCase()) ||
      w.code.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="flex flex-col min-h-screen bg-background">
      <Header title={t.title} subtitle={objectSubtitle} />

      {/* Sticky toolbar */}
      <div className="sticky top-14 z-30 bg-background/95 backdrop-blur border-b border-border/40 px-4 py-3 space-y-3">
        {/* Segmented control */}
        <div className="flex rounded-xl gap-2">
          <Button
            type="button"
            variant="outline"
            className={cn(
              "flex-1 h-10 px-3 text-[13px] font-medium rounded-xl transition-colors",
              tab === "works"
                ? "bg-primary/10 text-primary border-primary/60 hover:bg-primary/15"
                : "bg-transparent text-primary/80 border-primary/30 hover:bg-primary/5 hover:border-primary/50 hover:text-primary"
            )}
            onClick={() => setTab("works")}
          >
            {language === "ru" ? "Ведомость (ВОР)" : "BoQ"}
          </Button>
          <Button
            type="button"
            variant="outline"
            className={cn(
              "flex-1 h-10 px-3 text-[13px] font-medium rounded-xl transition-colors",
              tab === "estimate"
                ? "bg-primary/10 text-primary border-primary/60 hover:bg-primary/15"
                : "bg-transparent text-primary/80 border-primary/30 hover:bg-primary/5 hover:border-primary/50 hover:text-primary"
            )}
            onClick={() => setTab("estimate")}
          >
            {language === "ru" ? "Смета (ЛС)" : "Estimate"}
          </Button>
        </div>

        {tab === "works" ? (
          <>
            {/* Поиск */}
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground/60" />
              <Input
                placeholder={
                  language === "ru"
                    ? "Поиск по коду или названию..."
                    : "Search by code or name..."
                }
                className="pl-9 rounded-xl bg-muted/50 border-transparent focus:border-border focus:bg-background h-10 text-[14px]"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                data-testid="input-search-works"
              />
            </div>

            {/* Зона импорта Excel */}
            <div className="rounded-2xl border-2 border-dashed border-border/60 bg-muted/20 p-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
                  <FileUp className="h-5 w-5 text-primary" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-[14px] font-medium">
                    {language === "ru" ? "Импортировать Excel ВОР" : "Import Excel BoQ"}
                  </p>
                  <p className="text-[11px] text-muted-foreground">
                    {language === "ru" ? "Формат .xlsx или .xls" : ".xlsx or .xls format"}
                  </p>
                </div>
                <div className="flex gap-2 shrink-0">
                  <Button
                    variant="default"
                    size="sm"
                    className="rounded-xl h-9"
                    disabled={isImporting}
                    asChild
                  >
                    <label className="cursor-pointer">
                      {isImporting ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : null}
                      {isImporting
                        ? language === "ru"
                          ? "Загрузка..."
                          : "Importing..."
                        : language === "ru"
                          ? "Выбрать файл"
                          : "Choose file"}
                      <input
                        type="file"
                        accept=".xlsx,.xls,.csv"
                        className="hidden"
                        onChange={handleFileUpload}
                        data-testid="input-file-upload"
                      />
                    </label>
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    className="rounded-xl h-9 text-destructive border-destructive/30 hover:bg-destructive/10"
                    disabled={clearWorks.isPending}
                    onClick={() => setIsClearWorksDialogOpen(true)}
                  >
                    {language === "ru" ? "Очистить" : "Clear"}
                  </Button>
                </div>
              </div>
            </div>

            {/* AlertDialog очистки ВОР */}
            <AlertDialog open={isClearWorksDialogOpen} onOpenChange={setIsClearWorksDialogOpen}>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>
                    {language === "ru" ? "Очистить ВОР?" : "Clear BoQ?"}
                  </AlertDialogTitle>
                  <AlertDialogDescription>
                    {language === "ru"
                      ? "Это удалит все позиции ВОР (справочник работ). Также будут удалены задачи графика работ, если график использует ВОР как источник, и очищены списки работ в затронутых актах. После этого вы сможете импортировать новый ВОР или выбрать другой источник на вкладке «График работ»."
                      : "This will delete all BoQ items. It will also delete schedule tasks if the schedule uses BoQ as the source and clear work lists in affected acts. After that, you can import a new BoQ or select another source on the Schedule page."}
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel disabled={clearWorks.isPending}>
                    {language === "ru" ? "Отмена" : "Cancel"}
                  </AlertDialogCancel>
                  <AlertDialogAction
                    disabled={clearWorks.isPending}
                    onClick={async () => {
                      try {
                        await clearWorks.mutateAsync({ resetSchedule: true });
                        toast({
                          title: language === "ru" ? "Готово" : "Done",
                          description: language === "ru" ? "ВОР очищен" : "BoQ cleared",
                        });
                        setSearchTerm("");
                      } catch (e) {
                        toast({
                          title: language === "ru" ? "Ошибка" : "Error",
                          description: e instanceof Error ? e.message : String(e),
                          variant: "destructive",
                        });
                      }
                    }}
                  >
                    {language === "ru" ? "Очистить и сбросить" : "Clear and reset"}
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </>
        ) : (
          <>
            {/* Выбор сметы */}
            <div className="flex gap-2">
              <div className="flex-1">
                <select
                  className="w-full h-10 rounded-xl border border-border bg-background px-3 text-[14px] appearance-none"
                  value={selectedEstimateId ?? ""}
                  onChange={(e) =>
                    setSelectedEstimateId(e.target.value ? Number(e.target.value) : null)
                  }
                  disabled={estimatesQuery.isLoading || estimatesList.length === 0}
                  data-testid="select-estimate"
                >
                  {estimatesList.length === 0 ? (
                    <option value="">{language === "ru" ? "Нет смет" : "No estimates"}</option>
                  ) : (
                    estimatesList.map((e) => (
                      <option key={e.id} value={e.id}>
                        #{e.id} — {e.name}
                      </option>
                    ))
                  )}
                </select>
              </div>

              <Button
                variant="outline"
                className="gap-2 rounded-xl h-10"
                disabled={isImportingEstimate}
                asChild
              >
                <label className="cursor-pointer">
                  <FileUp className="h-4 w-4" />
                  {isImportingEstimate
                    ? te?.importing ?? (language === "ru" ? "Импорт..." : "Importing...")
                    : te?.import ?? (language === "ru" ? "Импорт сметы" : "Import estimate")}
                  <input
                    type="file"
                    accept=".xlsx, .xls"
                    className="hidden"
                    onChange={handleEstimateFileUpload}
                    data-testid="input-estimate-file-upload"
                  />
                </label>
              </Button>
            </div>

            {selectedEstimateMeta ? (
              <div className="text-xs text-muted-foreground">
                {selectedEstimateMeta.code ? `${selectedEstimateMeta.code} · ` : ""}
                {selectedEstimateMeta.pricingQuarter ? `${selectedEstimateMeta.pricingQuarter} · ` : ""}
                {selectedEstimateMeta.region ?? ""}
              </div>
            ) : null}

            {selectedEstimateId ? (
              <div className="flex justify-end">
                <Button
                  type="button"
                  variant="outline"
                  className="h-9 rounded-xl"
                  disabled={deleteEstimate.isPending}
                  onClick={async () => {
                    try {
                      await deleteEstimate.mutateAsync({ id: selectedEstimateId });
                      toast({
                        title: language === "ru" ? "Удалено" : "Deleted",
                        description:
                          te?.deleted ?? (language === "ru" ? "Смета удалена" : "Estimate deleted"),
                      });
                      await estimatesQuery.refetch();
                      setSelectedEstimateId(null);
                    } catch (e) {
                      const status = (e as any)?.status;
                      if (status === 409) {
                        setPendingDeleteEstimateId(selectedEstimateId);
                        setIsDeleteEstimateDialogOpen(true);
                        return;
                      }
                      toast({
                        title: language === "ru" ? "Ошибка" : "Error",
                        description: e instanceof Error ? e.message : String(e),
                        variant: "destructive",
                      });
                    }
                  }}
                >
                  {te?.delete ?? (language === "ru" ? "Удалить смету" : "Delete estimate")}
                </Button>
              </div>
            ) : null}

            {/* AlertDialog удаления сметы с конфликтом */}
            <AlertDialog
              open={isDeleteEstimateDialogOpen}
              onOpenChange={setIsDeleteEstimateDialogOpen}
            >
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>
                    {language === "ru"
                      ? "Смета используется графиком"
                      : "Estimate is used by the schedule"}
                  </AlertDialogTitle>
                  <AlertDialogDescription>
                    {language === "ru"
                      ? "Эта смета выбрана как источник графика работ. Если продолжить, будут удалены все задачи графика и очищены списки работ в затронутых актах. Затем смета будет удалена. После этого вы сможете выбрать новый источник на вкладке «График работ»."
                      : "This estimate is selected as the schedule source. If you continue, all schedule tasks will be deleted and work lists in affected acts will be cleared. Then the estimate will be deleted. After that you can pick a new source on the Schedule page."}
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel
                    onClick={() => {
                      setIsDeleteEstimateDialogOpen(false);
                      setPendingDeleteEstimateId(null);
                    }}
                  >
                    {language === "ru" ? "Отмена" : "Cancel"}
                  </AlertDialogCancel>
                  <AlertDialogAction
                    disabled={deleteEstimate.isPending || !pendingDeleteEstimateId}
                    onClick={async () => {
                      if (!pendingDeleteEstimateId) return;
                      try {
                        await deleteEstimate.mutateAsync({
                          id: pendingDeleteEstimateId,
                          resetSchedule: true,
                        });
                        toast({
                          title: language === "ru" ? "Удалено" : "Deleted",
                          description:
                            language === "ru"
                              ? "Смета удалена, график и акты сброшены"
                              : "Estimate deleted, schedule and acts reset",
                        });
                        await estimatesQuery.refetch();
                        setSelectedEstimateId(null);
                        setIsDeleteEstimateDialogOpen(false);
                        setPendingDeleteEstimateId(null);
                      } catch (e) {
                        toast({
                          title: language === "ru" ? "Ошибка" : "Error",
                          description: e instanceof Error ? e.message : String(e),
                          variant: "destructive",
                        });
                      }
                    }}
                  >
                    {language === "ru" ? "Удалить и сбросить" : "Delete and reset"}
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </>
        )}
      </div>

      {/* Контент страницы */}
      <div className="flex-1 px-4 py-3 pb-32 space-y-2">
        {tab === "works" ? (
          isLoading ? (
            <div className="flex flex-col items-center justify-center py-12 gap-4">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
              <p className="text-sm text-muted-foreground">
                {language === "ru" ? "Загрузка ВОР..." : "Loading BoQ..."}
              </p>
            </div>
          ) : filteredWorks.length === 0 ? (
            <div className="py-12 text-center text-muted-foreground">
              <FileUp className="h-10 w-10 mx-auto mb-3 opacity-30" />
              <p className="text-[14px]">
                {language === "ru"
                  ? "Работы не найдены. Импортируйте Excel файл."
                  : "No works found. Import an Excel file."}
              </p>
            </div>
          ) : (
            filteredWorks.map((work) => (
              <WorkItemCard key={work.id} work={work} />
            ))
          )
        ) : estimatesQuery.isLoading || estimateQuery.isLoading ? (
          <div className="flex flex-col items-center justify-center py-12 gap-4">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
            <p className="text-sm text-muted-foreground">
              {te?.loading ?? (language === "ru" ? "Загрузка сметы..." : "Loading estimate...")}
            </p>
          </div>
        ) : estimatesList.length === 0 ? (
          <div className="py-10 text-center text-muted-foreground">
            {te?.noEstimates ??
              (language === "ru"
                ? "Сметы не найдены. Импортируйте Excel-файл сметы (ЛСР)."
                : "No estimates found. Import an estimate Excel file (LSR).")}
          </div>
        ) : !estimateDetails ? (
          <div className="py-10 text-center text-muted-foreground">
            {te?.selectEstimate ?? (language === "ru" ? "Выберите смету" : "Select an estimate")}
          </div>
        ) : (
          <Accordion type="multiple" className="w-full">
            {estimateSections.map((sec) => {
              const positions: any[] = sec?.positions ?? [];
              const secKey = String(sec?.id ?? sec?.number ?? Math.random());
              const secTitle =
                (sec?.number ? `${sec.number}. ` : "") +
                (sec?.title ?? te?.section ?? (language === "ru" ? "Раздел" : "Section"));

              return (
                <AccordionItem key={secKey} value={secKey}>
                  <AccordionTrigger>
                    <div className="flex w-full justify-between pr-2">
                      <div className="text-left">{secTitle}</div>
                      <div className="text-xs text-muted-foreground">{positions.length}</div>
                    </div>
                  </AccordionTrigger>
                  <AccordionContent>
                    <div className="overflow-x-auto">
                      <table className="w-full border-collapse text-xs">
                        <thead>
                          <tr>
                            <th className="border p-2 text-left w-14">
                              {language === "ru" ? "№" : "No"}
                            </th>
                            <th className="border p-2 text-left w-44">
                              {language === "ru" ? "Шифр" : "Code"}
                            </th>
                            <th className="border p-2 text-left">
                              {language === "ru" ? "Наименование" : "Name"}
                            </th>
                            <th className="border p-2 text-left w-16">
                              {language === "ru" ? "Ед." : "Unit"}
                            </th>
                            <th className="border p-2 text-right w-24">
                              {language === "ru" ? "Кол-во" : "Qty"}
                            </th>
                            <th className="border p-2 text-right w-28">
                              {language === "ru" ? "Сумма" : "Total"}
                            </th>
                          </tr>
                        </thead>
                        <tbody>
                          {positions.length === 0 ? (
                            <tr>
                              <td
                                colSpan={6}
                                className="border p-4 text-center text-muted-foreground"
                              >
                                {te?.noPositions ??
                                  (language === "ru" ? "Нет позиций" : "No positions")}
                              </td>
                            </tr>
                          ) : (
                            positions.map((p: any) => {
                              const resources: any[] = p?.resources ?? [];
                              return (
                                <tr key={String(p?.id ?? `${p?.lineNo}-${p?.code}`)}>
                                  <td className="border p-2 align-top">{p?.lineNo ?? ""}</td>
                                  <td className="border p-2 align-top">{p?.code ?? ""}</td>
                                  <td className="border p-2">
                                    <div className="font-medium">{p?.name ?? ""}</div>
                                    {p?.notes ? (
                                      <div className="mt-1 text-[11px] text-muted-foreground whitespace-pre-wrap">
                                        {String(p.notes)}
                                      </div>
                                    ) : null}
                                    {resources.length > 0 ? (
                                      <details className="mt-2">
                                        <summary className="cursor-pointer text-[11px] text-muted-foreground">
                                          {language === "ru"
                                            ? `${te?.resources ?? "Ресурсы"}: ${resources.length}`
                                            : `${te?.resources ?? "Resources"}: ${resources.length}`}
                                        </summary>
                                        <div className="mt-2 overflow-x-auto">
                                          <table className="w-full border-collapse text-[11px]">
                                            <thead>
                                              <tr>
                                                <th className="border p-1 text-left w-16">
                                                  {language === "ru" ? "Тип" : "Type"}
                                                </th>
                                                <th className="border p-1 text-left w-32">
                                                  {language === "ru" ? "Код" : "Code"}
                                                </th>
                                                <th className="border p-1 text-left">
                                                  {language === "ru" ? "Наименование" : "Name"}
                                                </th>
                                                <th className="border p-1 text-left w-16">
                                                  {language === "ru" ? "Ед." : "Unit"}
                                                </th>
                                                <th className="border p-1 text-right w-20">
                                                  {language === "ru" ? "Кол-во" : "Qty"}
                                                </th>
                                                <th className="border p-1 text-right w-24">
                                                  {language === "ru" ? "Сумма" : "Total"}
                                                </th>
                                              </tr>
                                            </thead>
                                            <tbody>
                                              {resources.map((r: any, idx: number) => (
                                                <tr key={String(r?.id ?? idx)}>
                                                  <td className="border p-1">{r?.resourceType ?? ""}</td>
                                                  <td className="border p-1">{r?.resourceCode ?? ""}</td>
                                                  <td className="border p-1">{r?.name ?? ""}</td>
                                                  <td className="border p-1">{r?.unit ?? ""}</td>
                                                  <td className="border p-1 text-right">{r?.quantity ?? ""}</td>
                                                  <td className="border p-1 text-right">{r?.quantityTotal ?? ""}</td>
                                                </tr>
                                              ))}
                                            </tbody>
                                          </table>
                                        </div>
                                      </details>
                                    ) : null}
                                  </td>
                                  <td className="border p-2 align-top">{p?.unit ?? ""}</td>
                                  <td className="border p-2 text-right align-top">{p?.quantity ?? ""}</td>
                                  <td className="border p-2 text-right align-top">{p?.totalCurrentCost ?? ""}</td>
                                </tr>
                              );
                            })
                          )}
                        </tbody>
                      </table>
                    </div>
                  </AccordionContent>
                </AccordionItem>
              );
            })}
          </Accordion>
        )}
      </div>

      {/* FAB — добавить работу вручную */}
      {tab === "works" ? (
        <div className="fixed bottom-20 right-4 z-40 md:right-[max(1rem,calc(50vw-220px))]">
          <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
            <DialogTrigger asChild>
              <Button
                size="icon"
                className="h-14 w-14 rounded-full shadow-xl bg-primary hover:bg-primary/90"
                data-testid="button-add-work"
              >
                <Plus className="h-6 w-6" />
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-md rounded-2xl">
              <DialogHeader>
                <DialogTitle>
                  {language === "ru" ? "Добавить работу" : "Add Work Item"}
                </DialogTitle>
                <DialogDescription>
                  {language === "ru"
                    ? "Добавьте новую позицию в ведомость объемов."
                    : "Add a new item to the Bill of Quantities."}
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <div className="grid gap-2">
                  <Label htmlFor="code">{t.code}</Label>
                  <Input
                    id="code"
                    placeholder="e.g. 3.1.2"
                    value={formData.code}
                    onChange={(e) => setFormData({ ...formData, code: e.target.value })}
                    data-testid="input-work-code"
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="desc">{t.description}</Label>
                  <Input
                    id="desc"
                    placeholder="..."
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    data-testid="input-work-description"
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="grid gap-2">
                    <Label htmlFor="unit">{t.unit}</Label>
                    <Input
                      id="unit"
                      placeholder="m3"
                      value={formData.unit}
                      onChange={(e) => setFormData({ ...formData, unit: e.target.value })}
                      data-testid="input-work-unit"
                    />
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="qty">{t.quantity}</Label>
                    <Input
                      id="qty"
                      type="number"
                      placeholder="100"
                      value={formData.quantityTotal}
                      onChange={(e) =>
                        setFormData({ ...formData, quantityTotal: e.target.value })
                      }
                      data-testid="input-work-quantity"
                    />
                  </div>
                </div>
              </div>
              <Button
                onClick={handleCreate}
                disabled={createWork.isPending || !formData.code || !formData.description}
                className="w-full h-12 rounded-xl text-base"
                data-testid="button-submit-work"
              >
                {createWork.isPending
                  ? language === "ru"
                    ? "Добавление..."
                    : "Adding..."
                  : language === "ru"
                    ? "Добавить"
                    : "Add Item"}
              </Button>
            </DialogContent>
          </Dialog>
        </div>
      ) : null}

      <BottomNav />
    </div>
  );
}
