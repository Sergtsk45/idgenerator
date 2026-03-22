/**
 * @file: Works.tsx
 * @description: Страница ВОР (ведомость объёмов работ) и сметы — переключение вкладок, импорт Excel с предпросмотром,
 *   боковая панель фильтров на lg+ (tablet sidebar layout), экспорт Excel, список карточек
 * @dependencies: use-works, use-estimates, WorkItemCard, shadcn/ui, lucide-react, i18n
 * @created: 2026-02-23
 * @updated: 2026-03-13
 */

import { useEffect, useMemo, useState } from "react";
import { ResponsiveShell } from "@/components/ResponsiveShell";
import { useWorks, useImportWorks, useClearWorks } from "@/hooks/use-works";
import { useDeleteWorkCollection, useWorkCollection, useWorkCollections } from "@/hooks/use-work-collections";
import { useDeleteEstimate, useEstimate, useEstimates, useImportEstimate } from "@/hooks/use-estimates";
import { useCurrentObject } from "@/hooks/use-source-data";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
import { Search, Loader2, FileUp, Download, FileText } from "lucide-react";
import { PillTabs } from "@/components/ui/pill-tabs";
import { OdooEmptyState } from "@/components/ui/odoo-empty-state";
import { useToast } from "@/hooks/use-toast";
import { useLanguageStore, translations } from "@/lib/i18n";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { OdooTable, OdooTHead, OdooTh, OdooTBody, OdooTr, OdooTd } from "@/components/ui/odoo-table";
import { WorkItemCard } from "@/components/WorkItemCard";
import { cn } from "@/lib/utils";
import * as XLSX from "xlsx";
import { parseEstimateWorkbook } from "@/lib/estimateParser";

// Task 3.4: Import preview types
type WorksImportPreview = {
  fileName: string;
  rowCount: number;
  items: { code: string; description: string; unit: string; quantityTotal: string | null; synonyms: any[] }[];
};
type EstimateImportPreview = {
  fileName: string;
  sectionCount: number;
  positionCount: number;
  parsed: any;
};

export default function Works() {
  const { language } = useLanguageStore();
  const t = translations[language].works;
  const te: any = (translations as any)[language]?.estimate ?? {};
  const { data: currentObject } = useCurrentObject();
  const objectSubtitle = currentObject?.title
    ? `${language === "ru" ? "ОБЪЕКТ" : "OBJECT"}: ${currentObject.title}`
    : undefined;
  const { data: works = [], isLoading } = useWorks();
  const importWorks = useImportWorks();
  const clearWorks = useClearWorks();
  const workCollectionsQuery = useWorkCollections();
  const deleteWorkCollection = useDeleteWorkCollection();
  const estimatesQuery = useEstimates();
  const importEstimate = useImportEstimate();
  const deleteEstimate = useDeleteEstimate();
  const { toast } = useToast();
  const [searchTerm, setSearchTerm] = useState("");
  const [isImporting, setIsImporting] = useState(false);
  const [isImportingEstimate, setIsImportingEstimate] = useState(false);
  const [tab, setTab] = useState<"works" | "estimate">("works");
  const [selectedEstimateId, setSelectedEstimateId] = useState<number | null>(null);
  const estimateQuery = useEstimate(selectedEstimateId);
  const [isDeleteEstimateDialogOpen, setIsDeleteEstimateDialogOpen] = useState(false);
  const [pendingDeleteEstimateId, setPendingDeleteEstimateId] = useState<number | null>(null);
  const [isClearWorksDialogOpen, setIsClearWorksDialogOpen] = useState(false);
  const [estimateSearchTerm, setEstimateSearchTerm] = useState("");
  const [selectedWorkCollectionId, setSelectedWorkCollectionId] = useState<number | null>(null);
  const workCollectionQuery = useWorkCollection(selectedWorkCollectionId);
  const [isDeleteWorkCollectionDialogOpen, setIsDeleteWorkCollectionDialogOpen] = useState(false);
  const [pendingDeleteWorkCollectionId, setPendingDeleteWorkCollectionId] = useState<number | null>(null);

  // Task 3.4: Import preview state
  const [worksImportPreview, setWorksImportPreview] = useState<WorksImportPreview | null>(null);
  const [estimateImportPreview, setEstimateImportPreview] = useState<EstimateImportPreview | null>(null);

  useEffect(() => {
    const list = estimatesQuery.data ?? [];
    if (selectedEstimateId === null && list.length > 0) {
      setSelectedEstimateId(list[0].id);
    }
  }, [estimatesQuery.data, selectedEstimateId]);

  useEffect(() => {
    const list = workCollectionsQuery.data ?? [];
    if (selectedWorkCollectionId === null && list.length > 0) {
      setSelectedWorkCollectionId(list[0].id);
    }
  }, [workCollectionsQuery.data, selectedWorkCollectionId]);

  const workCollectionsList = workCollectionsQuery.data ?? [];
  const workCollectionDetails: any = workCollectionQuery.data;
  const workCollectionSections: any[] = workCollectionDetails?.sections ?? [];

  const filteredWorkCollectionSections = useMemo(() => {
    const term = searchTerm.trim().toLowerCase();
    if (!term) return workCollectionSections;
    return workCollectionSections
      .map((sec) => {
        const positions: any[] = (sec?.positions ?? []).filter(
          (p: any) =>
            String(p?.code ?? "").toLowerCase().includes(term) ||
            String(p?.description ?? "").toLowerCase().includes(term) ||
            String(p?.notes ?? "").toLowerCase().includes(term)
        );
        return { ...sec, positions };
      })
      .filter((sec) => (sec?.positions ?? []).length > 0);
  }, [workCollectionSections, searchTerm]);

  const estimatesList = estimatesQuery.data ?? [];
  const estimateDetails: any = estimateQuery.data;
  const estimateSections: any[] = estimateDetails?.sections ?? [];

  const filteredEstimateSections = useMemo(() => {
    const term = estimateSearchTerm.trim().toLowerCase();
    if (!term) return estimateSections;
    return estimateSections
      .map((sec) => {
        const positions: any[] = (sec?.positions ?? []).filter(
          (p: any) =>
            String(p?.code ?? "").toLowerCase().includes(term) ||
            String(p?.name ?? "").toLowerCase().includes(term) ||
            String(p?.notes ?? "").toLowerCase().includes(term)
        );
        return { ...sec, positions };
      })
      .filter((sec) => (sec?.positions ?? []).length > 0);
  }, [estimateSections, estimateSearchTerm]);

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

  // Task 3.4: handleFileUpload — parse then show preview, don't import yet
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

      const items: { code: string; description: string; unit: string; quantityTotal: string | null; synonyms: any[] }[] = [];
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

      // Task 3.4: Show preview instead of importing immediately
      setWorksImportPreview({ fileName: file.name, rowCount: items.length, items });
      setIsImporting(false);
      return;
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

  // Task 3.4: Confirm BoQ import after preview
  const confirmWorksImport = async () => {
    if (!worksImportPreview) return;
    setIsImporting(true);
    try {
      const result = await importWorks.mutateAsync({ mode: "merge", items: worksImportPreview.items });
      toast({
        title: language === "ru" ? "Импорт завершен" : "Import Complete",
        description:
          language === "ru"
            ? `Получено: ${result.received}. Создано: ${result.created}. Обновлено: ${result.updated}.`
            : `Received: ${result.received}. Created: ${result.created}. Updated: ${result.updated}.`,
      });
      await workCollectionsQuery.refetch();
      setWorksImportPreview(null);
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

  // Task 3.4: handleEstimateFileUpload — parse then show preview, don't import yet
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
      const sectionCount = Array.isArray(parsed?.sections) ? parsed.sections.length : 0;
      const positionCount = Array.isArray(parsed?.sections)
        ? parsed.sections.reduce((acc: number, s: any) => acc + (Array.isArray(s?.positions) ? s.positions.length : 0), 0)
        : 0;

      // Task 3.4: Show preview instead of importing immediately
      setEstimateImportPreview({ fileName: file.name, sectionCount, positionCount, parsed });
      setIsImportingEstimate(false);
      return;
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

  // Task 3.4: Confirm estimate import after preview
  const confirmEstimateImport = async () => {
    if (!estimateImportPreview) return;
    setIsImportingEstimate(true);
    try {
      const result = await importEstimate.mutateAsync(estimateImportPreview.parsed);
      toast({
        title: language === "ru" ? "Импорт сметы завершен" : "Estimate import complete",
        description:
          language === "ru"
            ? `Смета #${result.estimateId}. Разделов: ${result.sections}, позиций: ${result.positions}, ресурсов: ${result.resources}.`
            : `Estimate #${result.estimateId}. Sections: ${result.sections}, positions: ${result.positions}, resources: ${result.resources}.`,
      });
      await estimatesQuery.refetch();
      setSelectedEstimateId(result.estimateId);
      setEstimateImportPreview(null);
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

  // Task 3.8: Export BoQ to Excel
  const handleExportWorks = () => {
    if (!workCollectionDetails) return;
    const rows: any[] = [];
    for (const sec of workCollectionSections) {
      for (const p of (sec?.positions ?? [])) {
        rows.push({
          [language === "ru" ? "Раздел" : "Section"]: sec?.title ?? "",
          [language === "ru" ? "Шифр" : "Code"]: p?.code ?? "",
          [language === "ru" ? "Наименование" : "Name"]: p?.description ?? "",
          [language === "ru" ? "Ед." : "Unit"]: p?.unit ?? "",
          [language === "ru" ? "Кол-во" : "Qty"]: p?.quantityTotal ?? "",
          [language === "ru" ? "Сумма" : "Total"]: p?.totalCurrentCost ?? "",
        });
      }
    }
    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "ВОР");
    XLSX.writeFile(wb, `vor-export-${Date.now()}.xlsx`);
  };

  // Task 3.8: Export Estimate to Excel
  const handleExportEstimate = () => {
    if (!estimateDetails) return;
    const rows: any[] = [];
    for (const sec of estimateSections) {
      for (const p of (sec?.positions ?? [])) {
        rows.push({
          [language === "ru" ? "Раздел" : "Section"]: sec?.title ?? "",
          [language === "ru" ? "Шифр" : "Code"]: p?.code ?? "",
          [language === "ru" ? "Наименование" : "Name"]: p?.name ?? "",
          [language === "ru" ? "Ед." : "Unit"]: p?.unit ?? "",
          [language === "ru" ? "Кол-во" : "Qty"]: p?.quantity ?? "",
          [language === "ru" ? "Сумма" : "Total"]: p?.totalCurrentCost ?? "",
        });
      }
    }
    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Смета");
    XLSX.writeFile(wb, `estimate-export-${Date.now()}.xlsx`);
  };

  const selectedWorkCollectionMeta = useMemo(() => {
    if (!selectedWorkCollectionId) return null;
    return workCollectionsList.find((wc) => wc.id === selectedWorkCollectionId) ?? null;
  }, [workCollectionsList, selectedWorkCollectionId]);

  const selectedEstimateMeta = useMemo(() => {
    if (!selectedEstimateId) return null;
    return estimatesList.find((e) => e.id === selectedEstimateId) ?? null;
  }, [estimatesList, selectedEstimateId]);

  // 17.1 PillTabs toggle — shared between sidebar and mobile toolbar
  const tabToggle = (
    <PillTabs
      activeTab={tab}
      onTabChange={(v) => setTab(v as "works" | "estimate")}
      tabs={[
        { label: language === "ru" ? "ВОР" : "BoQ", value: "works" },
        { label: language === "ru" ? "Смета" : "Estimate", value: "estimate" },
      ]}
    />
  );


  // Works tab controls — shared between sidebar and mobile toolbar
  const worksControls = (
    <>
      {/* Поиск по ВОР */}
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

      {/* Выбор коллекции ВОР */}
      <div className="flex gap-2">
        <div className="flex-1">
          <select
            className="w-full h-10 rounded-xl border border-border bg-background px-3 text-[14px] appearance-none"
            value={selectedWorkCollectionId ?? ""}
            onChange={(e) =>
              setSelectedWorkCollectionId(e.target.value ? Number(e.target.value) : null)
            }
            disabled={workCollectionsQuery.isLoading || workCollectionsList.length === 0}
            data-testid="select-work-collection"
          >
            {workCollectionsList.length === 0 ? (
              <option value="">{language === "ru" ? "Нет коллекций ВОР" : "No work collections"}</option>
            ) : (
              workCollectionsList.map((wc) => (
                <option key={wc.id} value={wc.id}>
                  #{wc.id} — {wc.name}
                </option>
              ))
            )}
          </select>
        </div>

        <Button
          variant="outline"
          className="gap-2 rounded-xl h-10"
          disabled={isImporting}
          asChild
        >
          <label className="cursor-pointer">
            <FileUp className="h-4 w-4" />
            {isImporting
              ? language === "ru"
                ? "Импорт..."
                : "Importing..."
              : language === "ru"
                ? "Импорт ВОР"
                : "Import BoQ"}
            <input
              type="file"
              accept=".xlsx,.xls,.csv"
              className="hidden"
              onChange={handleFileUpload}
              data-testid="input-file-upload"
            />
          </label>
        </Button>

        {/* Task 3.8: Export BoQ button */}
        <Button
          variant="outline"
          className="gap-2 rounded-xl h-10"
          disabled={!workCollectionDetails}
          onClick={handleExportWorks}
          data-testid="btn-export-works"
        >
          <Download className="h-4 w-4" />
          {language === "ru" ? "Экспорт" : "Export"}
        </Button>
      </div>

      {selectedWorkCollectionMeta ? (
        <div className="text-xs text-muted-foreground">
          {selectedWorkCollectionMeta.code ? `${selectedWorkCollectionMeta.code} · ` : ""}
          {selectedWorkCollectionMeta.region ?? ""}
        </div>
      ) : null}

      {selectedWorkCollectionId ? (
        <div className="flex justify-end">
          <Button
            type="button"
            variant="outline"
            className="h-9 rounded-xl"
            disabled={deleteWorkCollection.isPending}
            onClick={async () => {
              try {
                await deleteWorkCollection.mutateAsync({ id: selectedWorkCollectionId });
                toast({
                  title: language === "ru" ? "Удалено" : "Deleted",
                  description: language === "ru" ? "Коллекция ВОР удалена" : "Work collection deleted",
                });
                await workCollectionsQuery.refetch();
                setSelectedWorkCollectionId(null);
              } catch (e) {
                const status = (e as any)?.status;
                if (status === 409) {
                  setPendingDeleteWorkCollectionId(selectedWorkCollectionId);
                  setIsDeleteWorkCollectionDialogOpen(true);
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
            {language === "ru" ? "Удалить ВОР" : "Delete BoQ"}
          </Button>
        </div>
      ) : null}
    </>
  );

  // Estimate tab controls — shared between sidebar and mobile toolbar
  const estimateControls = (
    <>
      {/* Поиск по смете */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground/60" />
        <Input
          placeholder={
            language === "ru"
              ? "Поиск по коду или названию..."
              : "Search by code or name..."
          }
          className="pl-9 rounded-xl bg-muted/50 border-transparent focus:border-border focus:bg-background h-10 text-[14px]"
          value={estimateSearchTerm}
          onChange={(e) => setEstimateSearchTerm(e.target.value)}
          data-testid="input-search-estimate"
        />
      </div>

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

        {/* Task 3.8: Export estimate button */}
        <Button
          variant="outline"
          className="gap-2 rounded-xl h-10"
          disabled={!estimateDetails}
          onClick={handleExportEstimate}
          data-testid="btn-export-estimate"
        >
          <Download className="h-4 w-4" />
          {language === "ru" ? "Экспорт" : "Export"}
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
    </>
  );

  return (
    <ResponsiveShell title={t.title} subtitle={objectSubtitle} showObjectSelector>

      {/* Task 3.4: BoQ import preview modal */}
      <AlertDialog open={worksImportPreview !== null} onOpenChange={(open) => { if (!open) setWorksImportPreview(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{language === "ru" ? "Подтверждение импорта ВОР" : "Confirm BoQ Import"}</AlertDialogTitle>
            <AlertDialogDescription>
              {language === "ru"
                ? `Файл: ${worksImportPreview?.fileName}. Найдено позиций: ${worksImportPreview?.rowCount}. Начать импорт?`
                : `File: ${worksImportPreview?.fileName}. Found positions: ${worksImportPreview?.rowCount}. Start import?`}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setWorksImportPreview(null)}>{language === "ru" ? "Отмена" : "Cancel"}</AlertDialogCancel>
            <AlertDialogAction disabled={isImporting} onClick={confirmWorksImport}>{language === "ru" ? "Импортировать" : "Import"}</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Task 3.4: Estimate import preview modal */}
      <AlertDialog open={estimateImportPreview !== null} onOpenChange={(open) => { if (!open) setEstimateImportPreview(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{language === "ru" ? "Подтверждение импорта сметы" : "Confirm Estimate Import"}</AlertDialogTitle>
            <AlertDialogDescription>
              {language === "ru"
                ? `Файл: ${estimateImportPreview?.fileName}. Разделов: ${estimateImportPreview?.sectionCount}, позиций: ${estimateImportPreview?.positionCount}. Начать импорт?`
                : `File: ${estimateImportPreview?.fileName}. Sections: ${estimateImportPreview?.sectionCount}, positions: ${estimateImportPreview?.positionCount}. Start import?`}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setEstimateImportPreview(null)}>{language === "ru" ? "Отмена" : "Cancel"}</AlertDialogCancel>
            <AlertDialogAction disabled={isImportingEstimate} onClick={confirmEstimateImport}>{language === "ru" ? "Импортировать" : "Import"}</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* AlertDialog удаления коллекции ВОР с конфликтом */}
      <AlertDialog
        open={isDeleteWorkCollectionDialogOpen}
        onOpenChange={setIsDeleteWorkCollectionDialogOpen}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {language === "ru"
                ? "Коллекция ВОР используется графиком"
                : "Work collection is used by the schedule"}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {language === "ru"
                ? "Эта коллекция ВОР выбрана как источник графика работ. Если продолжить, будут удалены все задачи графика и очищены списки работ в затронутых актах. Затем коллекция будет удалена. После этого вы сможете выбрать новый источник на вкладке «График работ»."
                : "This work collection is selected as the schedule source. If you continue, all schedule tasks will be deleted and work lists in affected acts will be cleared. Then the collection will be deleted. After that you can pick a new source on the Schedule page."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel
              onClick={() => {
                setIsDeleteWorkCollectionDialogOpen(false);
                setPendingDeleteWorkCollectionId(null);
              }}
            >
              {language === "ru" ? "Отмена" : "Cancel"}
            </AlertDialogCancel>
            <AlertDialogAction
              disabled={deleteWorkCollection.isPending || !pendingDeleteWorkCollectionId}
              onClick={async () => {
                if (!pendingDeleteWorkCollectionId) return;
                try {
                  await deleteWorkCollection.mutateAsync({
                    id: pendingDeleteWorkCollectionId,
                    resetSchedule: true,
                  });
                  toast({
                    title: language === "ru" ? "Удалено" : "Deleted",
                    description:
                      language === "ru"
                        ? "Коллекция ВОР удалена, график и акты сброшены"
                        : "Work collection deleted, schedule and acts reset",
                  });
                  await workCollectionsQuery.refetch();
                  setSelectedWorkCollectionId(null);
                  setIsDeleteWorkCollectionDialogOpen(false);
                  setPendingDeleteWorkCollectionId(null);
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
                ? "Эта смета выбрана как источник графика работ. Если продолжить, будут удалены смета, график работ и все его задачи, а также очищены списки работ в затронутых актах."
                : "This estimate is selected as the schedule source. If you continue, the estimate, the schedule and all its tasks will be deleted, and work lists in affected acts will be cleared."}
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
                        ? "Смета и график работ удалены"
                        : "Estimate and schedule deleted",
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
              {language === "ru" ? "Удалить смету и график" : "Delete estimate and schedule"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Tasks 3.1, 3.7: lg+ two-column layout */}
      <div className="flex flex-1 min-h-0">

        {/* Left sidebar — visible only on lg+ */}
        <aside
          data-testid="works-sidebar"
          className="hidden lg:flex lg:flex-col w-72 shrink-0 border-r border-border/50 bg-muted/10"
        >
          <div className="sticky top-[7rem] overflow-y-auto max-h-[calc(100vh-7rem)] p-4 space-y-4">
            {tabToggle}
            {tab === "works" ? worksControls : estimateControls}
          </div>
        </aside>

        {/* Main content */}
        <div className="flex-1 min-w-0">

          {/* Mobile/md sticky toolbar — hidden on lg+ */}
          <div className="sticky top-14 z-30 space-y-3 border-b border-border/40 bg-background/95 px-4 py-3 backdrop-blur md:top-28 lg:hidden">
            {tabToggle}
            {tab === "works" ? worksControls : estimateControls}
          </div>

          {/* Table content */}
          <div className="flex-1 px-4 py-3 pb-32 space-y-2">
            {/* TODO: For >500 rows, install @tanstack/react-virtual for row virtualization */}
            {tab === "works" ? (
              workCollectionsQuery.isLoading || workCollectionQuery.isLoading ? (
                <div className="flex flex-col items-center justify-center py-12 gap-4">
                  <Loader2 className="h-8 w-8 animate-spin text-primary" />
                  <p className="text-sm text-muted-foreground">
                    {language === "ru" ? "Загрузка ВОР..." : "Loading BoQ..."}
                  </p>
                </div>
              ) : workCollectionsList.length === 0 ? (
                /* 17.6 OdooEmptyState */
                <OdooEmptyState
                  icon={<FileText />}
                  title={language === "ru" ? "Нет ВОР" : "No BoQ"}
                  hint={language === "ru" ? "Импортируйте Excel-файл ВОР через кнопку «Импорт»" : "Import a BoQ Excel file using the Import button"}
                />
              ) : !workCollectionDetails ? (
                <OdooEmptyState
                  icon={<FileText />}
                  title={language === "ru" ? "Выберите коллекцию" : "Select a collection"}
                  hint={language === "ru" ? "Выберите коллекцию ВОР из списка слева" : "Select a work collection from the list"}
                />
              ) : filteredWorkCollectionSections.length === 0 ? (
                <OdooEmptyState
                  icon={<Search />}
                  title={language === "ru" ? "Ничего не найдено" : "No results"}
                  hint={language === "ru" ? "Попробуйте изменить поисковый запрос" : "Try adjusting your search query"}
                />
              ) : (
                <Accordion type="multiple" className="w-full">
                  {filteredWorkCollectionSections.map((sec) => {
                    const positions: any[] = sec?.positions ?? [];
                    const secKey = String(sec?.id ?? sec?.number ?? Math.random());
                    const secTitle =
                      (sec?.number ? `${sec.number}. ` : "") +
                      (sec?.title ?? (language === "ru" ? "Раздел" : "Section"));

                    return (
                      <AccordionItem key={secKey} value={secKey}>
                        <AccordionTrigger>
                          <div className="flex w-full justify-between pr-2">
                            <div className="text-left">{secTitle}</div>
                            <div className="text-xs text-muted-foreground">{positions.length}</div>
                          </div>
                        </AccordionTrigger>
                        <AccordionContent>
                          <OdooTable className="mt-1">
                            <OdooTHead>
                              <tr>
                                <OdooTh className="w-14 sticky left-0 z-10 bg-[--g100]">
                                  {language === "ru" ? "№" : "No"}
                                </OdooTh>
                                <OdooTh className="w-44">{language === "ru" ? "Шифр" : "Code"}</OdooTh>
                                <OdooTh>{language === "ru" ? "Наименование" : "Name"}</OdooTh>
                                <OdooTh className="w-16">{language === "ru" ? "Ед." : "Unit"}</OdooTh>
                                <OdooTh numeric className="w-24">{language === "ru" ? "Кол-во" : "Qty"}</OdooTh>
                                <OdooTh numeric className="w-28">{language === "ru" ? "Сумма" : "Total"}</OdooTh>
                              </tr>
                            </OdooTHead>
                            <OdooTBody>
                              {positions.length === 0 ? (
                                <tr>
                                  <OdooTd colSpan={6} className="text-center text-[--g500]">
                                    {language === "ru" ? "Нет позиций" : "No positions"}
                                  </OdooTd>
                                </tr>
                              ) : (
                                positions.map((p: any) => {
                                  const resources: any[] = p?.resources ?? [];
                                  return (
                                    <OdooTr key={String(p?.id ?? `${p?.lineNo}-${p?.code}`)}>
                                      <OdooTd className="align-top sticky left-0 z-[1] bg-white">{p?.lineNo ?? ""}</OdooTd>
                                      <OdooTd className="align-top">{p?.code ?? ""}</OdooTd>
                                      <OdooTd>
                                        <div className="font-medium text-[--g900]">{p?.description ?? ""}</div>
                                        {p?.notes ? (
                                          <div className="mt-1 text-[11px] text-[--g500] whitespace-pre-wrap">
                                            {String(p.notes)}
                                          </div>
                                        ) : null}
                                        {resources.length > 0 ? (
                                          <details className="mt-2">
                                            <summary className="cursor-pointer text-[11px] text-[--g500]">
                                              {language === "ru"
                                                ? `Ресурсы: ${resources.length}`
                                                : `Resources: ${resources.length}`}
                                            </summary>
                                            <div className="mt-2 overflow-x-auto border border-[--g200] rounded-[--o-radius-md]">
                                              <table className="w-full border-collapse text-[11px]">
                                                <thead className="bg-[--g100]">
                                                  <tr>
                                                    <th className="o-th w-16">{language === "ru" ? "Тип" : "Type"}</th>
                                                    <th className="o-th w-32">{language === "ru" ? "Код" : "Code"}</th>
                                                    <th className="o-th">{language === "ru" ? "Наименование" : "Name"}</th>
                                                    <th className="o-th w-16">{language === "ru" ? "Ед." : "Unit"}</th>
                                                    <th className="o-th text-right w-20">{language === "ru" ? "Кол-во" : "Qty"}</th>
                                                    <th className="o-th text-right w-24">{language === "ru" ? "Сумма" : "Total"}</th>
                                                  </tr>
                                                </thead>
                                                <tbody>
                                                  {resources.map((r: any, idx: number) => (
                                                    <tr key={String(r?.id ?? idx)} className="even:bg-[--g50] border-b border-[--g200]">
                                                      <td className="o-td">{r?.resourceType ?? ""}</td>
                                                      <td className="o-td">{r?.resourceCode ?? ""}</td>
                                                      <td className="o-td">{r?.name ?? ""}</td>
                                                      <td className="o-td">{r?.unit ?? ""}</td>
                                                      <td className="o-td o-numeric">{r?.quantity ?? ""}</td>
                                                      <td className="o-td o-numeric">{r?.quantityTotal ?? ""}</td>
                                                    </tr>
                                                  ))}
                                                </tbody>
                                              </table>
                                            </div>
                                          </details>
                                        ) : null}
                                      </OdooTd>
                                      <OdooTd className="align-top">{p?.unit ?? ""}</OdooTd>
                                      <OdooTd numeric className="align-top">{p?.quantityTotal ?? ""}</OdooTd>
                                      <OdooTd numeric className="align-top">{p?.totalCurrentCost ?? ""}</OdooTd>
                                    </OdooTr>
                                  );
                                })
                              )}
                            </OdooTBody>
                          </OdooTable>
                        </AccordionContent>
                      </AccordionItem>
                    );
                  })}
                </Accordion>
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
            ) : filteredEstimateSections.length === 0 ? (
              <div className="py-10 text-center text-muted-foreground">
                {language === "ru"
                  ? "По запросу ничего не найдено"
                  : "No results for this search"}
              </div>
            ) : (
              <Accordion type="multiple" className="w-full">
                {filteredEstimateSections.map((sec) => {
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
                                {/* Task 3.3: sticky first column */}
                                <th className="border p-2 text-left w-14 sticky left-0 z-10 bg-background">
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
                                      {/* Task 3.3: sticky first td */}
                                      <td className="border p-2 align-top sticky left-0 z-[1] bg-background">{p?.lineNo ?? ""}</td>
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
        </div>
      </div>

    </ResponsiveShell>
  );
}
