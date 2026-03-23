/**
 * @file: ActDetail.tsx
 * @description: Детальная страница акта — Accordion-секции, PDF-экспорт, предупреждения
 * @dependencies: use-acts, OdooCard, Badge, Accordion, Sheet, ResponsiveShell
 * @created: 2026-03-22
 */
import { useState } from "react";
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
} from "lucide-react";
import { format } from "date-fns";
import { ru, enUS } from "date-fns/locale";
import { useLanguageStore } from "@/lib/i18n";

interface ActDetailProps {
  params: { id: string };
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
  const actId = Number(params.id);
  const { data: act, isLoading } = useAct(actId);

  const [sheetOpen, setSheetOpen] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [exportProgress, setExportProgress] = useState(0);

  const t = (ru: string, en: string) => (language === "ru" ? ru : en);

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

  const handleExport = () => {
    setExporting(true);
    setExportProgress(0);
    const interval = setInterval(() => {
      setExportProgress((p) => {
        if (p >= 90) {
          clearInterval(interval);
          return p;
        }
        return p + 15;
      });
    }, 300);
    // Simulate completion after 2s
    setTimeout(() => {
      clearInterval(interval);
      setExportProgress(100);
      setTimeout(() => setExporting(false), 600);
    }, 2000);
  };

  if (isLoading) {
    return (
      <ResponsiveShell
        title={t(`Акт №${params.id}`, `Act #${params.id}`)}
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
  const attachments = (act as any).attachments ?? [];
  const hasDrawings = !!act.projectDrawingsAgg;
  const hasNormatives = !!act.normativeRefsAgg;
  const hasDates = !!act.dateStart && !!act.dateEnd;
  const progress = statusProgress(act.status);

  return (
    <ResponsiveShell
      title={t(`Акт №${act.actNumber ?? act.id}`, `Act #${act.actNumber ?? act.id}`)}
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
              </div>
            </AccordionTrigger>
            <AccordionContent className="px-4 pb-4 pt-1">
              <p className="text-[13px] text-[--g400] text-center py-4">
                {t("Привязка материалов — в разделе «Исходные данные»", "Material bindings are in Source Data section")}
              </p>
            </AccordionContent>
          </AccordionItem>

          {/* Документы */}
          <AccordionItem value="docs" className="bg-white border border-[--g200] rounded-[--o-radius-md] overflow-hidden">
            <AccordionTrigger className="px-4 py-3 text-[13px] font-semibold text-[--g900] hover:no-underline [&>svg]:text-[--g400]">
              <div className="flex items-center gap-2">
                <FileText className="h-4 w-4 text-[--p500]" />
                <span className="o-overline">{t("Документы", "Documents")}</span>
                {attachments.length > 0 && (
                  <span className="ml-1 text-[11px] bg-[--g200] text-[--g700] rounded-full px-1.5 py-0">{attachments.length}</span>
                )}
              </div>
            </AccordionTrigger>
            <AccordionContent className="px-4 pb-4 pt-1">
              {attachments.length === 0 ? (
                <p className="text-[13px] text-[--g400] text-center py-4">
                  {t("Нет прикреплённых документов", "No attached documents")}
                </p>
              ) : (
                <div className="space-y-2">
                  {attachments.map((a: any) => (
                    <div key={a.id} className="flex items-center gap-2 py-1.5 border-b border-[--g100] last:border-0">
                      <FileText className="h-4 w-4 text-[--g400] shrink-0" />
                      <div className="flex-1 min-w-0">
                        <p className="text-[13px] text-[--g900] truncate">{a.name}</p>
                        {a.type && <p className="text-[11px] text-[--g500]">{a.type}</p>}
                      </div>
                      {a.url && (
                        <a href={a.url} target="_blank" rel="noreferrer">
                          <Button variant="odoo-icon" size="odoo-icon-sm">
                            <Download className="h-4 w-4" />
                          </Button>
                        </a>
                      )}
                    </div>
                  ))}
                </div>
              )}
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

        {/* 18.4+18.5 — PDF export button + sheet */}
        <div className="space-y-3">
          {exporting && (
            <div className="space-y-1">
              <p className="text-[12px] text-[--g500]">{t("Генерация PDF...", "Generating PDF...")}</p>
              <Progress value={exportProgress} className="h-1.5" />
            </div>
          )}

          <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
            <SheetTrigger asChild>
              <Button variant="odoo-primary" className="w-full gap-2" disabled={exporting}>
                {exporting ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Download className="h-4 w-4" />
                )}
                {t("Экспорт PDF", "Export PDF")}
              </Button>
            </SheetTrigger>
            <SheetContent side="bottom" className="rounded-t-2xl max-h-[70vh]">
              <SheetHeader className="pb-4">
                <SheetTitle className="text-left text-[15px]">
                  {t("Выбор шаблона PDF", "Select PDF template")}
                </SheetTitle>
              </SheetHeader>
              <div className="space-y-2">
                {["КС-2 (стандарт)", "АОСР (упрощённый)", "АОСР (полный)"].map((tmpl) => (
                  <button
                    key={tmpl}
                    type="button"
                    className="w-full flex items-center justify-between px-4 py-3 bg-white border border-[--g200] rounded-[--o-radius-md] hover:bg-[--g50] transition-colors text-[13px]"
                    onClick={() => {
                      setSheetOpen(false);
                      handleExport();
                    }}
                  >
                    <span className="text-[--g900] font-medium">{tmpl}</span>
                    <Download className="h-4 w-4 text-[--g400]" />
                  </button>
                ))}
              </div>
            </SheetContent>
          </Sheet>
        </div>

      </div>
    </ResponsiveShell>
  );
}
