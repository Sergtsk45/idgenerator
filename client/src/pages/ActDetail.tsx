/**
 * @file: ActDetail.tsx
 * @description: Детальная страница акта — Accordion-секции, PDF-экспорт, предупреждения
 * @dependencies: use-acts, OdooCard, Badge, Accordion, Sheet, ResponsiveShell
 * @created: 2026-03-22
 */
import { useMemo, useRef, useState } from "react";
import { useLocation } from "wouter";
import { useAct } from "@/hooks/use-acts";
import { ResponsiveShell } from "@/components/ResponsiveShell";
import { OdooCard } from "@/components/ui/odoo-card";
import { OdooEmptyState } from "@/components/ui/odoo-empty-state";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Progress } from "@/components/ui/progress";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import {
  AlertTriangle,
  FileText,
  Download,
  Package,
  Users,
  Hammer,
  ClipboardList,
  BookOpen,
  Loader2,
  CheckCircle2,
  Plus,
  Trash2,
  RotateCcw,
} from "lucide-react";
import { format } from "date-fns";
import { ru, enUS } from "date-fns/locale";
import { useLanguageStore } from "@/lib/i18n";
import { useMutation, useQuery } from "@tanstack/react-query";
import { ApiError, apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { openPdfDownload } from "@/lib/pdf-download";
import {
  useActDocumentAttachments,
  useActMaterialUsages,
  useReplaceActDocumentAttachments,
  useResetActDocumentAttachments,
} from "@/hooks/use-act-materials";
import { useUploadDocumentFile } from "@/hooks/use-documents";
import { api, buildUrl } from "@shared/routes";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Checkbox } from "@/components/ui/checkbox";

interface ActDetailProps {
  params: { id: string };
}

interface ActTemplate {
  id: number;
  templateId: string;
  code: string;
  category: string;
  title: string;
  titleEn: string | null;
}

interface TemplatesResponse {
  templates: ActTemplate[];
}

const STATUS_STEPS = ["draft", "generated", "signed"] as const;

function statusProgress(status: string | null | undefined): number {
  if (status === "signed") return 100;
  if (status === "generated") return 66;
  return 33;
}

export default function ActDetail({ params }: ActDetailProps) {
  const { language } = useLanguageStore();
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const actId = Number(params.id);
  const { data: act, isLoading } = useAct(actId);
  const { data: materialUsages = [], isLoading: materialsLoading } = useActMaterialUsages(actId);
  const { data: documentAttachments = [], isLoading: documentsLoading, refetch: refetchAttachments } =
    useActDocumentAttachments(actId);
  const replaceAttachments = useReplaceActDocumentAttachments(actId);
  const resetAttachments = useResetActDocumentAttachments(actId);
  const uploadDocumentFile = useUploadDocumentFile();
  const { data: templatesData, isLoading: templatesLoading } = useQuery<TemplatesResponse>({
    queryKey: ["/api/act-templates"],
  });

  const [sheetOpen, setSheetOpen] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [exportProgress, setExportProgress] = useState(0);
  const [addDocsOpen, setAddDocsOpen] = useState(false);
  const [pendingAddDocIds, setPendingAddDocIds] = useState<number[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploadTargetDocId, setUploadTargetDocId] = useState<number | null>(null);

  const t = (ru: string, en: string) => (language === "ru" ? ru : en);

  const attachedDocIds = useMemo(
    () => new Set(documentAttachments.map((a: any) => Number(a.documentId))),
    [documentAttachments],
  );

  const candidateDocsFromUsages = useMemo(() => {
    const map = new Map<number, { id: number; title: string; docType?: string; docNumber?: string; fileUrl?: string | null }>();
    for (const usage of materialUsages as any[]) {
      const doc = usage.qualityDocument;
      if (!doc?.id) continue;
      const id = Number(doc.id);
      if (!Number.isFinite(id) || attachedDocIds.has(id) || map.has(id)) continue;
      map.set(id, {
        id,
        title: String(doc.title ?? "").trim() || `Документ #${id}`,
        docType: doc.docType,
        docNumber: doc.docNumber,
        fileUrl: doc.fileUrl,
      });
    }
    return Array.from(map.values());
  }, [materialUsages, attachedDocIds]);

  const missingPdfCount = useMemo(
    () => documentAttachments.filter((a: any) => !a.document?.fileUrl).length,
    [documentAttachments],
  );

  const persistAttachmentIds = async (documentIds: number[]) => {
    await replaceAttachments.mutateAsync({
      items: documentIds.map((documentId, orderIndex) => ({ documentId, orderIndex })),
      markManual: true,
    });
  };

  const handleRemoveAttachment = async (documentId: number) => {
    try {
      const next = documentAttachments
        .map((a: any) => Number(a.documentId))
        .filter((id: number) => id !== documentId);
      await persistAttachmentIds(next);
      toast({ title: t("Документ убран из приложений", "Document removed from attachments") });
    } catch (err: any) {
      toast({
        title: t("Не удалось обновить приложения", "Failed to update attachments"),
        description: err?.message,
        variant: "destructive",
      });
    }
  };

  const handleConfirmAddDocs = async () => {
    if (pendingAddDocIds.length === 0) return;
    try {
      const next = [
        ...documentAttachments.map((a: any) => Number(a.documentId)),
        ...pendingAddDocIds,
      ];
      await persistAttachmentIds(Array.from(new Set(next)));
      setAddDocsOpen(false);
      setPendingAddDocIds([]);
      toast({ title: t("Приложения обновлены", "Attachments updated") });
    } catch (err: any) {
      toast({
        title: t("Не удалось добавить документы", "Failed to add documents"),
        description: err?.message,
        variant: "destructive",
      });
    }
  };

  const handleResetAttachments = async () => {
    try {
      await resetAttachments.mutateAsync();
      toast({ title: t("Приложения сброшены к материалам", "Attachments reset from materials") });
    } catch (err: any) {
      toast({
        title: t("Не удалось сбросить приложения", "Failed to reset attachments"),
        description: err?.message,
        variant: "destructive",
      });
    }
  };

  const handleAttachmentRowClick = (documentId: number, hasFile: boolean) => {
    if (hasFile) return;
    setUploadTargetDocId(documentId);
    fileInputRef.current?.click();
  };

  const handleUploadSelectedFile = async (file: File | null) => {
    if (!file || uploadTargetDocId == null) return;
    try {
      await uploadDocumentFile.mutateAsync({ id: uploadTargetDocId, file });
      await refetchAttachments();
      toast({ title: t("PDF загружен", "PDF uploaded") });
    } catch (err: any) {
      toast({
        title: t("Не удалось загрузить PDF", "Failed to upload PDF"),
        description: err?.message,
        variant: "destructive",
      });
    } finally {
      setUploadTargetDocId(null);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const statusLabel = (status: string | null | undefined) => {
    if (status === "signed") return t("принято", "accepted");
    if (status === "generated") return t("в работе", "in progress");
    return t("черновик", "draft");
  };

  const statusVariant = (status: string | null | undefined) =>
    status === "signed" ? "success" : status === "generated" ? "info" : "neutral";

  const formatDate = (d: string | null | undefined) => {
    if (!d) return "—";
    return format(new Date(d), "d MMM yyyy", { locale: language === "ru" ? ru : enUS });
  };

  const exportAct = useMutation({
    mutationFn: async (templateIds: string[]) => {
      const response = await apiRequest("POST", `/api/acts/${actId}/export`, { templateIds });
      return response.json();
    },
  });

  const exportAttachments = useMutation({
    mutationFn: async () => {
      const url = buildUrl(api.acts.exportAttachments.path, { id: actId });
      const response = await apiRequest(api.acts.exportAttachments.method, url);
      return api.acts.exportAttachments.responses[200].parse(await response.json());
    },
  });

  const currentTemplate = useMemo(() => {
    if (!act || !templatesData?.templates) return null;
    const actTemplateId = Number((act as any).actTemplateId ?? 0);
    if (!actTemplateId) return null;
    return templatesData.templates.find((tpl) => tpl.id === actTemplateId) ?? null;
  }, [act, templatesData]);

  const handleExport = async (templateIds: string[]) => {
    setExporting(true);
    setExportProgress(10);
    const progressTimer = setInterval(() => {
      setExportProgress((p) => (p < 85 ? p + 15 : p));
    }, 600);

    try {
      const exportResult = await exportAct.mutateAsync(templateIds);
      setExportProgress(100);
      if (exportResult.files && exportResult.files.length > 0) {
        toast({
          title: t("Успех", "Success"),
          description: t(`Создано ${exportResult.files.length} PDF-документов`, `Generated ${exportResult.files.length} PDF documents`),
          duration: 1800,
        });
        exportResult.files.forEach((file: { url: string; filename: string }) => openPdfDownload(file.url, file.filename));
      }
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : undefined;
      toast({
        title: t("Ошибка", "Error"),
        description: msg || t("Не удалось экспортировать акт", "Failed to export act"),
        variant: "destructive",
      });
    } finally {
      clearInterval(progressTimer);
      setExporting(false);
      setExportProgress(0);
    }
  };

  const handleAttachmentsExport = async () => {
    try {
      const result = await exportAttachments.mutateAsync();
      toast({
        title: t("Приложения экспортированы", "Attachments exported"),
        description: t(
          `Документов в пакете: ${result.documentsCount}`,
          `Documents in package: ${result.documentsCount}`,
        ),
        duration: 1800,
      });
      openPdfDownload(result.url, result.filename);
    } catch (error: unknown) {
      const problemResponse =
        error instanceof ApiError && error.status === 422
          ? api.acts.exportAttachments.responses[422].safeParse(error.data)
          : null;
      if (problemResponse?.success) {
        toast({
          title: t("Не удалось экспортировать приложения", "Failed to export attachments"),
          description: (
            <div className="space-y-1">
              <p>{problemResponse.data.message}</p>
              <ul className="list-disc pl-4">
                {problemResponse.data.problems.map((problem) => (
                  <li key={`${problem.documentId}-${problem.reason}`}>{problem.title}</li>
                ))}
              </ul>
            </div>
          ),
          variant: "destructive",
        });
        return;
      }

      const payload =
        error instanceof ApiError && error.data && typeof error.data === "object"
          ? (error.data as { message?: unknown })
          : null;
      const message =
        typeof payload?.message === "string"
          ? payload.message
          : error instanceof Error
            ? error.message
            : t("Не удалось экспортировать приложения", "Failed to export attachments");
      toast({
        title: t("Ошибка", "Error"),
        description: message,
        variant: "destructive",
      });
    }
  };

  if (isLoading) {
    return (
      <ResponsiveShell
        title={t(`Акт №${params.id}`, `Act #${params.id}`)}
        showBack
        onBack={() => navigate("/acts")}
      >
        <div className="flex-1 px-4 py-6 pb-24 w-full max-w-md lg:max-w-3xl mx-auto space-y-4">
          <OdooCard>
            <div className="p-4 space-y-3">
              <Skeleton className="h-5 w-32" />
              <Skeleton className="h-3 w-full" />
              <Skeleton className="h-4 w-48" />
            </div>
          </OdooCard>
          <OdooCard>
            <div className="p-4 space-y-3">
              <Skeleton className="h-4 w-40" />
              <Skeleton className="h-4 w-56" />
              <Skeleton className="h-4 w-36" />
            </div>
          </OdooCard>
        </div>
      </ResponsiveShell>
    );
  }

  if (!act) {
    return (
      <ResponsiveShell
        title={t("Акт", "Act")}
        showBack
        onBack={() => navigate("/acts")}
      >
        <div className="flex-1 flex items-center justify-center p-8">
          <OdooEmptyState
            icon={<FileText />}
            title={t("Акт не найден", "Act not found")}
            hint={t("Возможно, акт был удалён.", "The act may have been deleted.")}
          />
        </div>
      </ResponsiveShell>
    );
  }

  const works = (act.worksData ?? []) as any[];
  const hasDrawings = !!act.projectDrawingsAgg;
  const hasNormatives = !!act.normativeRefsAgg;
  const hasDates = !!act.dateStart && !!act.dateEnd;
  const progress = statusProgress(act.status);

  return (
    <ResponsiveShell
      title={t(`Акт №${act.actNumber ?? act.id}`, `Act #${act.actNumber ?? act.id}`)}
      showBack
      onBack={() => navigate("/acts")}
    >
      <div className="flex-1 px-4 py-6 pb-24 w-full max-w-md lg:max-w-3xl mx-auto space-y-4">

        {/* 18.2 — Status badge + progress bar */}
        <OdooCard>
          <div className="p-4 space-y-3">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-[--o-radius-md] bg-[--p50] flex items-center justify-center text-[--p500] shrink-0">
                  <FileText className="h-5 w-5" />
                </div>
                <div>
                  <p className="text-[15px] font-semibold text-[--g900]">
                    {t(`Акт №${act.actNumber ?? act.id}`, `Act #${act.actNumber ?? act.id}`)}
                  </p>
                  <p className="text-[12px] text-[--g500]">
                    {formatDate(act.dateStart)} — {formatDate(act.dateEnd)}
                  </p>
                </div>
              </div>
              <Badge variant={statusVariant(act.status)} className="capitalize shrink-0">
                {statusLabel(act.status)}
              </Badge>
            </div>

            {/* Progress steps */}
            <div className="space-y-1.5">
              <Progress value={progress} className="h-1.5" />
              <div className="flex justify-between text-[11px] text-[--g500]">
                {STATUS_STEPS.map((s) => (
                  <span
                    key={s}
                    className={act.status === s ? "text-[--p500] font-semibold" : ""}
                  >
                    {s === "draft" ? t("Черновик", "Draft") : s === "generated" ? t("В работе", "In progress") : t("Принято", "Accepted")}
                  </span>
                ))}
              </div>
            </div>
          </div>
        </OdooCard>

        {/* 18.7 — Warning blocks */}
        {!hasDates && (
          <div className="flex items-start gap-2 bg-amber-50 border border-amber-200 rounded-[--o-radius-md] px-3 py-2.5">
            <AlertTriangle className="h-4 w-4 text-amber-500 shrink-0 mt-0.5" />
            <p className="text-[13px] text-amber-700">
              {t("Не указаны даты акта. Укажите период выполнения работ.", "Act dates are missing. Set the work period.")}
            </p>
          </div>
        )}
        {!hasDrawings && (
          <div className="flex items-start gap-2 bg-amber-50 border border-amber-200 rounded-[--o-radius-md] px-3 py-2.5">
            <AlertTriangle className="h-4 w-4 text-amber-500 shrink-0 mt-0.5" />
            <p className="text-[13px] text-amber-700">
              {t("Отсутствуют ссылки на проектные чертежи.", "Project drawings references are missing.")}
            </p>
          </div>
        )}

        {/* 18.3 — Accordion sections */}
        <Accordion type="multiple" defaultValue={["main", "works"]} className="space-y-2">

          {/* Основные данные */}
          <AccordionItem value="main" className="bg-white border border-[--g200] rounded-[--o-radius-md] overflow-hidden">
            <AccordionTrigger className="px-4 py-3 text-[13px] font-semibold text-[--g900] hover:no-underline [&>svg]:text-[--g400]">
              <div className="flex items-center gap-2">
                <ClipboardList className="h-4 w-4 text-[--p500]" />
                <span className="o-overline">{t("Основные данные", "Main data")}</span>
              </div>
            </AccordionTrigger>
            <AccordionContent className="px-4 pb-4 pt-1 space-y-2">
              <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-[13px]">
                <div>
                  <p className="o-overline mb-0.5">{t("Начало", "Start")}</p>
                  <p className="text-[--g900]">{formatDate(act.dateStart)}</p>
                </div>
                <div>
                  <p className="o-overline mb-0.5">{t("Конец", "End")}</p>
                  <p className="text-[--g900]">{formatDate(act.dateEnd)}</p>
                </div>
                {act.location && (
                  <div className="col-span-2">
                    <p className="o-overline mb-0.5">{t("Место выполнения", "Location")}</p>
                    <p className="text-[--g900]">{act.location}</p>
                  </div>
                )}
                <div className="col-span-2">
                  <p className="o-overline mb-0.5">{t("Создан", "Created")}</p>
                  <p className="text-[--g900]">
                    {act.createdAt ? formatDate(String(act.createdAt).slice(0, 10)) : "—"}
                  </p>
                </div>
              </div>

              {/* Чертежи */}
              {hasDrawings && (
                <div className="pt-1">
                  <p className="o-overline mb-1">{t("Проектные чертежи", "Project drawings")}</p>
                  <p className="text-[13px] text-[--g700] whitespace-pre-wrap">{act.projectDrawingsAgg}</p>
                </div>
              )}
            </AccordionContent>
          </AccordionItem>

          {/* Работы */}
          <AccordionItem value="works" className="bg-white border border-[--g200] rounded-[--o-radius-md] overflow-hidden">
            <AccordionTrigger className="px-4 py-3 text-[13px] font-semibold text-[--g900] hover:no-underline [&>svg]:text-[--g400]">
              <div className="flex items-center gap-2">
                <Hammer className="h-4 w-4 text-[--p500]" />
                <span className="o-overline">{t("Работы", "Works")}</span>
                {works.length > 0 && (
                  <span className="ml-1 text-[11px] bg-[--g200] text-[--g700] rounded-full px-1.5 py-0">{works.length}</span>
                )}
              </div>
            </AccordionTrigger>
            <AccordionContent className="px-4 pb-4 pt-1">
              {works.length === 0 ? (
                <p className="text-[13px] text-[--g400] text-center py-4">
                  {t("Нет работ в акте", "No works in this act")}
                </p>
              ) : (
                <div className="space-y-2">
                  {works.map((w: any, i: number) => (
                    <div key={i} className="flex items-start gap-2 py-1.5 border-b border-[--g100] last:border-0">
                      <CheckCircle2 className="h-4 w-4 text-[--success] shrink-0 mt-0.5" />
                      <div className="flex-1 min-w-0">
                        <p className="text-[13px] text-[--g900] truncate">{w.workName ?? w.name ?? `Работа #${i + 1}`}</p>
                        {w.quantity != null && (
                          <p className="text-[11px] text-[--g500]">
                            {w.quantity} {w.unit ?? ""}
                          </p>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </AccordionContent>
          </AccordionItem>

          {/* Материалы */}
          <AccordionItem value="materials" className="bg-white border border-[--g200] rounded-[--o-radius-md] overflow-hidden">
            <AccordionTrigger className="px-4 py-3 text-[13px] font-semibold text-[--g900] hover:no-underline [&>svg]:text-[--g400]">
              <div className="flex items-center gap-2">
                <Package className="h-4 w-4 text-[--p500]" />
                <span className="o-overline">{t("Материалы", "Materials")}</span>
                {materialUsages.length > 0 && (
                  <span className="ml-1 text-[11px] bg-[--g200] text-[--g700] rounded-full px-1.5 py-0">{materialUsages.length}</span>
                )}
              </div>
            </AccordionTrigger>
            <AccordionContent className="px-4 pb-4 pt-1">
              {materialsLoading ? (
                <div className="flex items-center justify-center py-4 text-[--g500]">
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  {t("Загрузка...", "Loading...")}
                </div>
              ) : materialUsages.length === 0 ? (
                <p className="text-[13px] text-[--g400] text-center py-4">
                  {t("Нет материалов в акте", "No materials in this act")}
                </p>
              ) : (
                <div className="space-y-2">
                  {materialUsages.map((usage: any) => {
                    const document = usage.qualityDocument;
                    const materialName =
                      String(usage.projectMaterial?.nameOverride ?? "").trim() ||
                      String(usage.catalogMaterial?.name ?? "").trim() ||
                      `Материал #${usage.projectMaterialId}`;
                    const documentLabel = document
                      ? [
                          String(document.docType ?? t("Документ", "Document")),
                          document.docNumber ? `№${String(document.docNumber)}` : "",
                          String(document.title ?? "").trim(),
                        ].filter(Boolean).join(" · ")
                      : t("не указан", "not specified");
                    return (
                      <div key={usage.id} className="py-2 border-b border-[--g100] last:border-0 space-y-1">
                        <p className="text-[13px] font-medium text-[--g900]">{materialName}</p>
                        <p className="text-[11px] text-[--g500]">
                          {t("Партия", "Batch")}: {usage.batch?.batchNumber ?? usage.batchId ?? "—"}
                        </p>
                        <div className="flex items-center justify-between gap-2">
                          <p className="text-[11px] text-[--g500]">
                            {t("Документ качества", "Quality document")}: {documentLabel}
                          </p>
                          {document?.fileUrl && (
                            <a
                              href={document.fileUrl}
                              target="_blank"
                              rel="noreferrer"
                              className="text-[11px] text-[--p500] hover:underline shrink-0"
                            >
                              {t("открыть", "open")}
                            </a>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </AccordionContent>
          </AccordionItem>

          {/* Документы / приложения */}
          <AccordionItem value="docs" className="bg-white border border-[--g200] rounded-[--o-radius-md] overflow-hidden">
            <AccordionTrigger className="px-4 py-3 text-[13px] font-semibold text-[--g900] hover:no-underline [&>svg]:text-[--g400]">
              <div className="flex items-center gap-2">
                <FileText className="h-4 w-4 text-[--p500]" />
                <span className="o-overline">{t("Документы", "Documents")}</span>
                {documentAttachments.length > 0 && (
                  <span className="ml-1 text-[11px] bg-[--g200] text-[--g700] rounded-full px-1.5 py-0">{documentAttachments.length}</span>
                )}
                {(act as any)?.attachmentsManual && (
                  <span className="ml-1 text-[10px] bg-amber-100 text-amber-800 rounded px-1.5 py-0">
                    {t("вручную", "manual")}
                  </span>
                )}
              </div>
            </AccordionTrigger>
            <AccordionContent className="px-4 pb-4 pt-1 space-y-3">
              <input
                ref={fileInputRef}
                type="file"
                accept="application/pdf,.pdf"
                className="hidden"
                onChange={(e) => handleUploadSelectedFile(e.target.files?.[0] ?? null)}
              />
              {documentsLoading ? (
                <div className="flex items-center justify-center py-4 text-[--g500]">
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  {t("Загрузка...", "Loading...")}
                </div>
              ) : documentAttachments.length === 0 ? (
                <p className="text-[13px] text-[--g400] text-center py-2">
                  {t("Нет прикреплённых документов", "No attached documents")}
                </p>
              ) : (
                <div className="space-y-2">
                  {documentAttachments.map((a: any) => {
                    const document = a.document;
                    const documentId = Number(a.documentId);
                    const hasFile = Boolean(document?.fileUrl);
                    return (
                      <div
                        key={a.id}
                        className={`flex items-center gap-2 py-1.5 border-b border-[--g100] last:border-0 ${
                          !hasFile ? "cursor-pointer hover:bg-[--g50] rounded px-1 -mx-1" : ""
                        }`}
                        onClick={() => handleAttachmentRowClick(documentId, hasFile)}
                        title={
                          !hasFile
                            ? t("Нажмите, чтобы загрузить PDF", "Click to upload PDF")
                            : undefined
                        }
                      >
                        <FileText className="h-4 w-4 text-[--g400] shrink-0" />
                        <div className="flex-1 min-w-0">
                          <p className="text-[13px] text-[--g900] truncate">
                            {document?.title || document?.docNumber || t("Документ качества", "Quality document")}
                          </p>
                          <p className="text-[11px] text-[--g500]">
                            {[document?.docType, document?.docNumber ? `№${document.docNumber}` : ""]
                              .filter(Boolean)
                              .join(" · ")}
                            {!hasFile && (
                              <span className="ml-2 text-amber-700">
                                {t("нет PDF — нажмите, чтобы загрузить", "no PDF — click to upload")}
                              </span>
                            )}
                          </p>
                        </div>
                        {hasFile && (
                          <a
                            href={document.fileUrl}
                            target="_blank"
                            rel="noreferrer"
                            onClick={(e) => e.stopPropagation()}
                          >
                            <Button variant="odoo-icon" size="odoo-icon-sm">
                              <Download className="h-4 w-4" />
                            </Button>
                          </a>
                        )}
                        <Button
                          variant="odoo-icon"
                          size="odoo-icon-sm"
                          onClick={(e) => {
                            e.stopPropagation();
                            void handleRemoveAttachment(documentId);
                          }}
                          aria-label={t("Убрать", "Remove")}
                        >
                          <Trash2 className="h-4 w-4 text-[--g500]" />
                        </Button>
                      </div>
                    );
                  })}
                </div>
              )}

              {missingPdfCount > 0 && (
                <p className="text-[11px] text-amber-700">
                  {t(
                    `Без PDF: ${missingPdfCount}. Экспорт приложений потребует файлы.`,
                    `Missing PDF: ${missingPdfCount}. Attachments export needs files.`,
                  )}
                </p>
              )}

              <div className="flex flex-wrap gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  className="gap-1"
                  disabled={candidateDocsFromUsages.length === 0 || replaceAttachments.isPending}
                  onClick={() => {
                    setPendingAddDocIds([]);
                    setAddDocsOpen(true);
                  }}
                >
                  <Plus className="h-3.5 w-3.5" />
                  {t("Добавить", "Add")}
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="gap-1"
                  disabled={resetAttachments.isPending}
                  onClick={() => void handleResetAttachments()}
                >
                  {resetAttachments.isPending ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <RotateCcw className="h-3.5 w-3.5" />
                  )}
                  {t("Сбросить к материалам", "Reset from materials")}
                </Button>
              </div>
            </AccordionContent>
          </AccordionItem>

          {/* Нормативы */}
          {hasNormatives && (
            <AccordionItem value="normatives" className="bg-white border border-[--g200] rounded-[--o-radius-md] overflow-hidden">
              <AccordionTrigger className="px-4 py-3 text-[13px] font-semibold text-[--g900] hover:no-underline [&>svg]:text-[--g400]">
                <div className="flex items-center gap-2">
                  <BookOpen className="h-4 w-4 text-[--p500]" />
                  <span className="o-overline">{t("Нормативы", "Normatives")}</span>
                </div>
              </AccordionTrigger>
              <AccordionContent className="px-4 pb-4 pt-1">
                <p className="text-[13px] text-[--g700] whitespace-pre-wrap">{act.normativeRefsAgg}</p>
              </AccordionContent>
            </AccordionItem>
          )}
        </Accordion>

        <Dialog open={addDocsOpen} onOpenChange={setAddDocsOpen}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>{t("Добавить в приложения", "Add to attachments")}</DialogTitle>
            </DialogHeader>
            {candidateDocsFromUsages.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                {t(
                  "Нет документов из материалов акта, которых ещё нет в приложениях",
                  "No material quality docs left to add",
                )}
              </p>
            ) : (
              <div className="max-h-[320px] overflow-y-auto border rounded-lg divide-y">
                {candidateDocsFromUsages.map((doc) => {
                  const checked = pendingAddDocIds.includes(doc.id);
                  return (
                    <label
                      key={doc.id}
                      className="flex items-start gap-3 px-3 py-2.5 cursor-pointer hover:bg-accent"
                    >
                      <Checkbox
                        checked={checked}
                        onCheckedChange={(value) => {
                          setPendingAddDocIds((prev) =>
                            value ? Array.from(new Set([...prev, doc.id])) : prev.filter((id) => id !== doc.id),
                          );
                        }}
                        className="mt-0.5"
                      />
                      <span className="text-sm flex-1 min-w-0 break-words">
                        {[doc.docType, doc.docNumber ? `№${doc.docNumber}` : "", doc.title]
                          .filter(Boolean)
                          .join(" · ")}
                        {!doc.fileUrl && (
                          <span className="ml-2 text-[11px] text-amber-700">
                            {t("нет PDF", "no PDF")}
                          </span>
                        )}
                      </span>
                    </label>
                  );
                })}
              </div>
            )}
            <DialogFooter className="gap-2">
              <Button variant="outline" onClick={() => setAddDocsOpen(false)}>
                {t("Отмена", "Cancel")}
              </Button>
              <Button
                onClick={() => void handleConfirmAddDocs()}
                disabled={pendingAddDocIds.length === 0 || replaceAttachments.isPending}
              >
                {replaceAttachments.isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  t(`Добавить (${pendingAddDocIds.length})`, `Add (${pendingAddDocIds.length})`)
                )}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* 18.4+18.5 — Separate act and attachments exports */}
        <div className="space-y-3">
          {exporting && (
            <div className="space-y-1">
              <p className="text-[12px] text-[--g500]">{t("Генерация PDF...", "Generating PDF...")}</p>
              <Progress value={exportProgress} className="h-1.5" />
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
              <SheetTrigger asChild>
                <Button variant="odoo-primary" className="w-full gap-2" disabled={exporting}>
                  {exporting ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Download className="h-4 w-4" />
                  )}
                  {t("Экспорт акта", "Export act")}
                </Button>
              </SheetTrigger>
              <SheetContent side="bottom" className="rounded-t-2xl max-h-[70vh]">
                <SheetHeader className="pb-4">
                  <SheetTitle className="text-left text-[15px]">
                    {t("Выбор шаблона PDF", "Select PDF template")}
                  </SheetTitle>
                </SheetHeader>
                <div className="space-y-2">
                  {currentTemplate && (
                    <button
                      type="button"
                      className="w-full flex items-center justify-between px-4 py-3 bg-[--p50] border border-[--p200] rounded-[--o-radius-md] hover:bg-[--p100] transition-colors text-[13px]"
                      onClick={async () => {
                        setSheetOpen(false);
                        await handleExport([]);
                      }}
                    >
                      <span className="text-[--g900] font-medium">
                        {t("По шаблону акта", "Use act template")}: {language === "ru" ? currentTemplate.title : (currentTemplate.titleEn ?? currentTemplate.title)}
                      </span>
                      <Download className="h-4 w-4 text-[--g500]" />
                    </button>
                  )}

                  {templatesLoading ? (
                    <div className="flex items-center justify-center py-6 text-[--g500]">
                      <Loader2 className="h-4 w-4 animate-spin mr-2" />
                      {t("Загрузка шаблонов...", "Loading templates...")}
                    </div>
                  ) : (
                    (templatesData?.templates ?? []).map((template) => (
                      <button
                        key={template.templateId}
                        type="button"
                        className="w-full flex items-center justify-between px-4 py-3 bg-white border border-[--g200] rounded-[--o-radius-md] hover:bg-[--g50] transition-colors text-[13px]"
                        onClick={async () => {
                          setSheetOpen(false);
                          await handleExport([template.templateId]);
                        }}
                      >
                        <span className="text-[--g900] font-medium">
                          {template.code} — {language === "ru" ? template.title : (template.titleEn ?? template.title)}
                        </span>
                        <Download className="h-4 w-4 text-[--g400]" />
                      </button>
                    ))
                  )}
                </div>
              </SheetContent>
            </Sheet>

            <Button
              variant="odoo-secondary"
              className="w-full gap-2"
              disabled={documentsLoading || documentAttachments.length === 0 || exportAttachments.isPending}
              onClick={handleAttachmentsExport}
            >
              {exportAttachments.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Download className="h-4 w-4" />
              )}
              {documentsLoading
                ? t("Загрузка документов...", "Loading documents...")
                : documentAttachments.length === 0
                  ? t("Нет документов для экспорта", "No documents to export")
                  : t("Экспорт приложений", "Export attachments")}
            </Button>
          </div>
        </div>

      </div>
    </ResponsiveShell>
  );
}
