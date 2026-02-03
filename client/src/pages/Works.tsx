import { useEffect, useMemo, useState } from "react";
import { BottomNav } from "@/components/BottomNav";
import { Header } from "@/components/Header";
import { useWorks, useCreateWork, useImportWorks } from "@/hooks/use-works";
import { useDeleteEstimate, useEstimate, useEstimates, useImportEstimate } from "@/hooks/use-estimates";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle, 
  DialogTrigger,
  DialogDescription
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
import { ScrollArea } from "@/components/ui/scroll-area";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import * as XLSX from "xlsx";
import { parseEstimateWorkbook } from "@/lib/estimateParser";

export default function Works() {
  const { language } = useLanguageStore();
  const t = translations[language].works;
  const te: any = (translations as any)[language]?.estimate ?? {};
  const { data: works = [], isLoading } = useWorks();
  const createWork = useCreateWork();
  const importWorks = useImportWorks();
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
        title: language === 'ru' ? "Успех" : "Success", 
        description: language === 'ru' ? "Работа добавлена в ВОР" : "Work item added to BoQ" 
      });
    } catch (error) {
      toast({ 
        title: language === 'ru' ? "Ошибка" : "Error", 
        description: language === 'ru' ? "Не удалось добавить работу" : "Failed to create work item", 
        variant: "destructive" 
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
    // Accept: 1, 3.1, 3.1.1, etc.
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
          language === "ru"
            ? "Файл не содержит листов"
            : "File contains no sheets"
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

      // Header: 1 to get raw array of arrays
      const jsonRaw = XLSX.utils.sheet_to_json(worksheet, { header: 1 }) as any[][];
      console.log("Starting import of rows:", jsonRaw.length);

      const items = [];
      let skippedCount = 0;
      for (const row of jsonRaw) {
        if (!Array.isArray(row) || row.length < 5) {
          skippedCount++;
          continue;
        }

        const codeRaw = row[1]; // № в ЛСР
        const descriptionRaw = row[2];
        const unitRaw = row[3];
        const quantityRaw = row[4];

        // Skip technical header row (contains column numbers like 1, 2, 3...)
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
          // unit is required (notNull in schema)
          console.warn(`Skipping row with empty unit. Code: ${code}, Description: ${description}`);
          skippedCount++;
          continue;
        }

        // Convert quantityTotal to number or null for numeric field
        const quantityTotal = quantityRawStr === "" || quantityRawStr === "0" 
          ? null 
          : quantityRawStr;

        items.push({
          code,
          description,
          unit,
          quantityTotal,
          synonyms: [],
        });
      }

      console.log(`Import parsing complete. Valid items: ${items.length}, Skipped rows: ${skippedCount}`);

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

      // Safe default: merge (no delete)
      const result = await importWorks.mutateAsync({ mode: "merge", items });

      toast({
        title: language === "ru" ? "Импорт завершен" : "Import Complete",
        description:
          language === "ru"
            ? `Получено: ${result.received}. Создано: ${result.created}. Обновлено: ${result.updated}.`
            : `Received: ${result.received}. Created: ${result.created}. Updated: ${result.updated}.`,
      });
      event.target.value = ""; // Reset input
    } catch (error) {
      console.error("Error in handleFileUpload:", error);
      const errorMessage = error instanceof Error 
        ? error.message 
        : (error as any)?.message || String(error);
      
      toast({
        title: language === 'ru' ? "Ошибка импорта" : "Import Error",
        description: language === 'ru' 
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

  const filteredWorks = works.filter(w => 
    w.description.toLowerCase().includes(searchTerm.toLowerCase()) || 
    w.code.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="flex flex-col min-h-screen bg-background">
      <Header title={t.title} />
      
      <div className="flex-1 px-2 py-4 pb-24">
        <div className="mb-4 sticky top-14 z-30 bg-background/95 backdrop-blur py-2 space-y-3 px-2">
          {/* Top banners: Works / Estimate */}
          <div className="flex gap-2">
            <Button
              type="button"
              className="flex-1 rounded-xl h-10"
              variant={tab === "works" ? "default" : "outline"}
              onClick={() => setTab("works")}
            >
              {te?.tabWorks ?? (language === "ru" ? "Работы (ВОР)" : "Works (BoQ)")}
            </Button>
            <Button
              type="button"
              className="flex-1 rounded-xl h-10"
              variant={tab === "estimate" ? "default" : "outline"}
              onClick={() => setTab("estimate")}
            >
              {te?.tabEstimate ?? (language === "ru" ? "Смета" : "Estimate")}
            </Button>
          </div>

          {tab === "works" ? (
            <>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder={language === "ru" ? "Поиск работ..." : "Search works..."}
                  className="pl-9 rounded-xl bg-secondary/50 border-transparent focus:bg-background transition-all"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  data-testid="input-search-works"
                />
              </div>

              <div className="flex gap-2">
                <Button variant="outline" className="flex-1 gap-2 rounded-xl h-11" disabled={isImporting} asChild>
                  <label className="cursor-pointer">
                    <FileUp className="h-4 w-4" />
                    {isImporting
                      ? language === "ru"
                        ? "Загрузка..."
                        : "Importing..."
                      : language === "ru"
                        ? "Импорт Excel"
                        : "Import Excel"}
                    <input
                      type="file"
                      accept=".xlsx, .xls, .csv"
                      className="hidden"
                      onChange={handleFileUpload}
                      data-testid="input-file-upload"
                    />
                  </label>
                </Button>
              </div>
            </>
          ) : (
            <>
              <div className="flex gap-2">
                <div className="flex-1">
                  <select
                    className="w-full h-11 rounded-xl border border-border bg-background px-3 text-sm"
                    value={selectedEstimateId ?? ""}
                    onChange={(e) => setSelectedEstimateId(e.target.value ? Number(e.target.value) : null)}
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
                  className="gap-2 rounded-xl h-11"
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
                      description: te?.deleted ?? (language === "ru" ? "Смета удалена" : "Estimate deleted"),
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

              <AlertDialog open={isDeleteEstimateDialogOpen} onOpenChange={setIsDeleteEstimateDialogOpen}>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>
                      {language === "ru" ? "Смета используется графиком" : "Estimate is used by the schedule"}
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
                          await deleteEstimate.mutateAsync({ id: pendingDeleteEstimateId, resetSchedule: true });
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

        {tab === "works" ? (
          isLoading ? (
            <div className="flex flex-col items-center justify-center py-12 gap-4">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
              <p className="text-sm text-muted-foreground">
                {language === "ru" ? "Загрузка ВОР..." : "Loading BoQ..."}
              </p>
            </div>
          ) : (
            <ScrollArea className="h-[calc(100vh-16rem)]">
              <div className="overflow-x-auto px-2">
                <table className="w-full border-collapse text-sm" style={{ borderColor: "#1e3a5f" }}>
                  <thead>
                    <tr>
                      <th className="border-2 border-[#1e3a5f] bg-background p-2 text-center font-semibold w-12">
                        {t.rowNumber}
                      </th>
                      <th className="border-2 border-[#1e3a5f] bg-background p-2 text-center font-semibold w-16">
                        {t.code}
                      </th>
                      <th className="border-2 border-[#1e3a5f] bg-background p-2 text-center font-semibold">
                        {t.description}
                      </th>
                      <th className="border-2 border-[#1e3a5f] bg-background p-2 text-center font-semibold w-16">
                        {t.unit}
                      </th>
                      <th className="border-2 border-[#1e3a5f] bg-background p-2 text-center font-semibold w-20">
                        {t.quantity}
                      </th>
                    </tr>
                    <tr>
                      <th className="border-2 border-[#1e3a5f] bg-background p-1 text-center text-xs text-muted-foreground">
                        1
                      </th>
                      <th className="border-2 border-[#1e3a5f] bg-background p-1 text-center text-xs text-muted-foreground">
                        2
                      </th>
                      <th className="border-2 border-[#1e3a5f] bg-background p-1 text-center text-xs text-muted-foreground">
                        3
                      </th>
                      <th className="border-2 border-[#1e3a5f] bg-background p-1 text-center text-xs text-muted-foreground">
                        4
                      </th>
                      <th className="border-2 border-[#1e3a5f] bg-background p-1 text-center text-xs text-muted-foreground">
                        5
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredWorks.length === 0 ? (
                      <tr>
                        <td colSpan={5} className="border-2 border-[#1e3a5f] p-8 text-center text-muted-foreground">
                          {language === "ru"
                            ? "Работы не найдены. Импортируйте Excel файл для добавления работ."
                            : "No work items found. Import an Excel file to add works."}
                        </td>
                      </tr>
                    ) : (
                      filteredWorks.map((work, idx) => (
                        <tr key={work.id} data-testid={`row-work-${work.id}`}>
                          <td className="border-2 border-[#1e3a5f] p-2 text-center align-top">{idx + 1}</td>
                          <td className="border-2 border-[#1e3a5f] p-2 text-center align-top">{work.code}</td>
                          <td className="border-2 border-[#1e3a5f] p-2 align-top">{work.description}</td>
                          <td className="border-2 border-[#1e3a5f] p-2 text-center align-top">{work.unit}</td>
                          <td className="border-2 border-[#1e3a5f] p-2 text-right align-top">{work.quantityTotal}</td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </ScrollArea>
          )
        ) : estimatesQuery.isLoading || estimateQuery.isLoading ? (
          <div className="flex flex-col items-center justify-center py-12 gap-4">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
            <p className="text-sm text-muted-foreground">
              {te?.loading ?? (language === "ru" ? "Загрузка сметы..." : "Loading estimate...")}
            </p>
          </div>
        ) : estimatesList.length === 0 ? (
          <div className="px-2 py-10 text-center text-muted-foreground">
            {te?.noEstimates ??
              (language === "ru"
                ? "Сметы не найдены. Импортируйте Excel-файл сметы (ЛСР)."
                : "No estimates found. Import an estimate Excel file (LSR).")}
          </div>
        ) : !estimateDetails ? (
          <div className="px-2 py-10 text-center text-muted-foreground">
            {te?.selectEstimate ?? (language === "ru" ? "Выберите смету" : "Select an estimate")}
          </div>
        ) : (
          <ScrollArea className="h-[calc(100vh-16rem)]">
            <div className="px-2 space-y-3">
              <Accordion type="multiple" className="w-full">
                {estimateSections.map((sec) => {
                  const positions: any[] = sec?.positions ?? [];
                  const secKey = String(sec?.id ?? sec?.number ?? Math.random());
                  const secTitle =
                    (sec?.number ? `${sec.number}. ` : "") + (sec?.title ?? te?.section ?? (language === "ru" ? "Раздел" : "Section"));

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
                                <th className="border p-2 text-left w-14">{language === "ru" ? "№" : "No"}</th>
                                <th className="border p-2 text-left w-44">{language === "ru" ? "Шифр" : "Code"}</th>
                                <th className="border p-2 text-left">{language === "ru" ? "Наименование" : "Name"}</th>
                                <th className="border p-2 text-left w-16">{language === "ru" ? "Ед." : "Unit"}</th>
                                <th className="border p-2 text-right w-24">{language === "ru" ? "Кол-во" : "Qty"}</th>
                                <th className="border p-2 text-right w-28">{language === "ru" ? "Сумма" : "Total"}</th>
                              </tr>
                            </thead>
                            <tbody>
                              {positions.length === 0 ? (
                                <tr>
                                  <td colSpan={6} className="border p-4 text-center text-muted-foreground">
                                    {te?.noPositions ?? (language === "ru" ? "Нет позиций" : "No positions")}
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
                                                    <th className="border p-1 text-left w-16">{language === "ru" ? "Тип" : "Type"}</th>
                                                    <th className="border p-1 text-left w-32">{language === "ru" ? "Код" : "Code"}</th>
                                                    <th className="border p-1 text-left">{language === "ru" ? "Наименование" : "Name"}</th>
                                                    <th className="border p-1 text-left w-16">{language === "ru" ? "Ед." : "Unit"}</th>
                                                    <th className="border p-1 text-right w-20">{language === "ru" ? "Кол-во" : "Qty"}</th>
                                                    <th className="border p-1 text-right w-24">{language === "ru" ? "Сумма" : "Total"}</th>
                                                  </tr>
                                                </thead>
                                                <tbody>
                                                  {resources.map((r: any, idx: number) => (
                                                    <tr key={`${String(r?.id ?? idx)}`}>
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
            </div>
          </ScrollArea>
        )}
      </div>

      {tab === "works" ? (
        <div className="fixed bottom-20 right-4 z-40 md:right-[max(1rem,calc(50vw-220px))]">
          <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
            <DialogTrigger asChild>
              <Button
                size="icon"
                className="h-14 w-14 rounded-full shadow-xl bg-primary hover:bg-primary/90 transition-transform hover:scale-105 active:scale-95"
                data-testid="button-add-work"
              >
                <Plus className="h-6 w-6" />
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-md rounded-2xl">
              <DialogHeader>
                <DialogTitle>{language === "ru" ? "Добавить работу" : "Add Work Item"}</DialogTitle>
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
                      onChange={(e) => setFormData({ ...formData, quantityTotal: e.target.value })}
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
