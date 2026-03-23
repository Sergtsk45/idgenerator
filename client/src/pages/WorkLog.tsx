/**
 * @file: WorkLog.tsx
 * @description: Страница «Общий журнал работ» — pill-табы + список раздела 3 (как в референсе) + таблицы разделов 1, 2, 4, 5
 * @dependencies: useSection3, usePatchMessage, useCurrentObject, useLanguageStore, BottomNav, Header
 * @created: 2026-02-23
 */

import React, { useEffect, useRef, useState } from "react";
import { ResponsiveShell } from "@/components/ResponsiveShell";
import { useSection3 } from "@/hooks/use-section3";
import { usePatchMessage } from "@/hooks/use-messages";
import { useLanguageStore, translations } from "@/lib/i18n";
import { useCurrentObject } from "@/hooks/use-source-data";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { OdooCard } from "@/components/ui/odoo-card";
import { OdooEmptyState } from "@/components/ui/odoo-empty-state";
import { PillTabs } from "@/components/ui/pill-tabs";
import { Progress } from "@/components/ui/progress";
import { Textarea } from "@/components/ui/textarea";
import {
  Loader2,
  FileText,
  RefreshCw,
  Construction,
  Pencil,
  Save,
  Search,
  Check,
  X,
  MoreVertical,
  Plus,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import { format } from "date-fns";
import { ru, enUS } from "date-fns/locale";
import { cn } from "@/lib/utils";
import { queryClient } from "@/lib/queryClient";
import { api } from "@shared/routes";

const S3_PAGE_SIZE = 15;
const TABLE_PAGE_SIZE = 10;

/* ─── вспомогательные компоненты ──────────────────────────────────── */

/** Лёгкий scroll-wrapper в стиле OdooTable, не меняет внутреннюю структуру таблицы */
function TableWrapper({ children, testId }: { children: React.ReactNode; testId?: string }) {
  return (
    <div className="relative" data-testid={testId}>
      <p className="md:hidden text-[11px] text-[--g500] text-center mb-1 select-none">← Прокрутите →</p>
      <div className="overflow-x-auto border border-[--g200] rounded-[--o-radius-lg]">
        {children}
      </div>
    </div>
  );
}

/** Кнопочная пагинация для таблиц (14.8) */
function TablePagination({
  page,
  totalPages,
  onPrev,
  onNext,
  lang,
}: {
  page: number;
  totalPages: number;
  onPrev: () => void;
  onNext: () => void;
  lang: "ru" | "en";
}) {
  if (totalPages <= 1) return null;
  return (
    <div className="flex items-center justify-between mt-2 px-1">
      <Button variant="odoo-ghost" size="compact" onClick={onPrev} disabled={page === 0}>
        <ChevronLeft className="h-4 w-4" />
        {lang === "ru" ? "Назад" : "Prev"}
      </Button>
      <span className="text-[12px] text-[--g500]">
        {page + 1} / {totalPages}
      </span>
      <Button variant="odoo-ghost" size="compact" onClick={onNext} disabled={page >= totalPages - 1}>
        {lang === "ru" ? "Далее" : "Next"}
        <ChevronRight className="h-4 w-4" />
      </Button>
    </div>
  );
}

function PlaceholderSection({ title, comingSoon }: { title: string; comingSoon: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 opacity-60">
      <div className="bg-muted w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4">
        <Construction className="h-8 w-8 text-muted-foreground" />
      </div>
      <h3 className="font-semibold text-lg mb-1">{title}</h3>
      <p className="text-sm text-muted-foreground">{comingSoon}</p>
    </div>
  );
}

function SectionActionBar({
  actions,
  sectionId,
}: {
  actions: { edit: string; save: string; search: string };
  sectionId: string;
}) {
  return (
    <div className="flex gap-2 justify-center mb-4" data-testid={`action-bar-${sectionId}`}>
      <Button variant="outline" size="sm" data-testid={`button-edit-${sectionId}`}>
        <Pencil className="h-4 w-4 mr-1" />
        {actions.edit}
      </Button>
      <Button variant="outline" size="sm" data-testid={`button-save-${sectionId}`}>
        <Save className="h-4 w-4 mr-1" />
        {actions.save}
      </Button>
      <Button variant="outline" size="sm" data-testid={`button-search-${sectionId}`}>
        <Search className="h-4 w-4 mr-1" />
        {actions.search}
      </Button>
    </div>
  );
}

/* ─── константы табов ──────────────────────────────────────────────── */

const TABS = [
  { value: "title" },
  { value: "section1" },
  { value: "section2" },
  { value: "section3" },
  { value: "section4" },
  { value: "section5" },
  { value: "section6" },
] as const;

type TabValue = (typeof TABS)[number]["value"];

/* ─── аббревиатуры табов (как в референсе: «Разд. 1») ─────────────── */
const TAB_SHORT: Record<TabValue, string> = {
  title: "Титул",
  section1: "Разд. 1",
  section2: "Разд. 2",
  section3: "Разд. 3",
  section4: "Разд. 4",
  section5: "Разд. 5",
  section6: "Разд. 6",
};

/* ─── основной компонент ───────────────────────────────────────────── */

export default function WorkLog() {
  const { language } = useLanguageStore();
  const t = translations[language].worklog;
  const locale = language === "ru" ? ru : enUS;

  const { data: currentObject } = useCurrentObject();
  const objectSubtitle = currentObject?.title
    ? `${language === "ru" ? "ОБЪЕКТ" : "OBJECT"}: ${currentObject.title}`
    : undefined;

  const [activeTab, setActiveTab] = useState<TabValue>("section3");
  const [editingSegment, setEditingSegment] = useState<{
    sourceId: number;
    text: string;
    isProcessed: boolean;
  } | null>(null);

  // 14.8 infinite scroll for section3
  const [s3Visible, setS3Visible] = useState(S3_PAGE_SIZE);
  const s3SentinelRef = useRef<HTMLDivElement>(null);

  // 14.8 pagination for tables
  const [s1Page, setS1Page] = useState(0);
  const [s2Page, setS2Page] = useState(0);
  const [s4Page, setS4Page] = useState(0);
  const [s5Page, setS5Page] = useState(0);

  const { data: rows = [], isLoading, refetch } = useSection3({ enablePolling: !editingSegment });
  const patchMessage = usePatchMessage();

  useEffect(() => {
    const el = s3SentinelRef.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting) setS3Visible((p) => Math.min(p + S3_PAGE_SIZE, rows.length));
      },
      { threshold: 0.1 },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [rows.length]);

  const formatDate = (dateStr: string | undefined) => {
    if (!dateStr) return "";
    try {
      return format(new Date(dateStr), "dd.MM.yyyy", { locale });
    } catch {
      return dateStr;
    }
  };

  /** Разбивает ISO-дату на части для отображения в list-view */
  const parseDateParts = (dateStr: string) => {
    try {
      const d = new Date(dateStr);
      return {
        day: format(d, "d", { locale }),
        weekday: format(d, "EEE", { locale }),
        month: format(d, "MMM", { locale }),
      };
    } catch {
      return { day: "—", weekday: "", month: "" };
    }
  };

  const lastEntryDate = rows.length > 0 ? formatDate(rows[rows.length - 1].date) : null;

  const handleRefresh = () => {
    queryClient.invalidateQueries({ queryKey: [api.worklog.section3.path] });
    refetch();
  };

  const handleSegmentClick = (
    sourceId: number,
    text: string,
    isProcessed: boolean,
    sourceType: string,
  ) => {
    if (sourceType !== "message") return;
    setEditingSegment({ sourceId, text, isProcessed });
  };

  const handleSaveEdit = async () => {
    if (!editingSegment) return;
    try {
      const data = editingSegment.isProcessed
        ? { normalizedData: { workDescription: editingSegment.text } }
        : { messageRaw: editingSegment.text };
      await patchMessage.mutateAsync({ id: editingSegment.sourceId, data });
      setEditingSegment(null);
    } catch (error) {
      console.error("Failed to save edit:", error);
    }
  };

  const handleCancelEdit = () => setEditingSegment(null);

  /* прогресс */
  const totalSegs = rows.reduce((acc, r) => acc + r.segments.length, 0);
  const processedSegs = rows.reduce(
    (acc, r) => acc + r.segments.filter((s) => !s.isPending).length,
    0,
  );
  const progress = totalSegs > 0 ? Math.round((processedSegs / totalSegs) * 100) : 0;

  return (
    <ResponsiveShell
      title={t.title}
      subtitle={objectSubtitle}
      showAvatar
      showObjectSelector
    >

      {/* Pill-табы */}
      <div className="sticky top-14 z-20 border-b border-[--g200] bg-white md:top-[4rem]" data-testid="worklog-tabs">
        <PillTabs
          className="px-4 py-2"
          activeTab={activeTab}
          onTabChange={(v) => setActiveTab(v as TabValue)}
          tabs={TABS.map((tab) => ({ label: TAB_SHORT[tab.value], value: tab.value }))}
        />
      </div>

      {/* Контент */}
      <div className="flex-1 pb-28 overflow-y-auto">

        {/* ── РАЗДЕЛ 3 — Odoo card list (14.4) ───────────────────────── */}
        {activeTab === "section3" && (
          <div className="px-4 py-3 space-y-3 pb-28" data-testid="section3-list">
            {/* 14.2 Info badge + 14.3 Прогресс */}
            <div className="flex items-center justify-between bg-[--p50] border border-[--p300] rounded-[--o-radius-lg] px-3 py-2">
              <div>
                <p className="o-overline text-[--p700]">{t.section3.title}</p>
                <p className="text-[11px] text-[--g500] leading-tight mt-0.5">
                  {lastEntryDate
                    ? (language === "ru" ? `Последняя запись: ${lastEntryDate}` : `Last entry: ${lastEntryDate}`)
                    : t.section3.subtitle}
                </p>
              </div>
              <div className="shrink-0 text-right">
                <p className="o-overline text-[--g500]">
                  {language === "ru" ? "ОБЩИЙ ПРОГРЕСС" : "TOTAL PROGRESS"}
                </p>
                <p className="text-[20px] font-bold text-[--p700] leading-tight">{progress}%</p>
              </div>
            </div>
            <Progress value={progress} className="h-1.5 bg-[--g200] [&>div]:bg-[--p500]" />

            {/* Кнопка обновить */}
            <div className="flex justify-end">
              <Button
                variant="odoo-ghost"
                size="compact"
                onClick={handleRefresh}
                data-testid="button-refresh-log"
              >
                <RefreshCw className="h-3.5 w-3.5 mr-1.5" />
                {t.refreshLog}
              </Button>
            </div>

            {/* Загрузка */}
            {isLoading && (
              <div className="flex justify-center py-12">
                <Loader2 className="h-8 w-8 animate-spin text-[--p400]" />
              </div>
            )}

            {/* Пусто */}
            {!isLoading && rows.length === 0 && (
              <OdooEmptyState
                icon={<FileText />}
                title={t.noRecords}
                hint={t.noRecordsHint}
              />
            )}

            {/* 14.4 Список записей */}
            {!isLoading && rows.slice(0, s3Visible).map((row) => {
              const { day, weekday, month } = parseDateParts(row.date);
              const allProcessed = row.segments.every((s) => !s.isPending);

              return (
                <div key={row.date} className="flex gap-3 items-start" data-testid={`worklog-row-${row.date}`}>
                  {/* Дата */}
                  <div className="shrink-0 w-10 pt-2 text-center">
                    <p className="text-[22px] font-bold text-[--g900] leading-none">{day}</p>
                    <p className="text-[10px] text-[--g500] capitalize">{weekday}</p>
                    <p className="text-[10px] text-[--g500] capitalize">{month}</p>
                  </div>

                  {/* Карточка */}
                  <OdooCard className="flex-1">
                    <div className="px-3 pt-2 pb-3">
                      <div className="flex items-center justify-between mb-2">
                        <Badge variant={allProcessed ? "success" : "warning"}>
                          {allProcessed
                            ? (language === "ru" ? "принято" : "accepted")
                            : (language === "ru" ? "в работе" : "in progress")}
                        </Badge>
                        <button
                          className="h-8 w-8 flex items-center justify-center rounded-full hover:bg-[--g100] transition-colors"
                          aria-label="Меню"
                          data-testid={`kebab-${row.date}`}
                        >
                          <MoreVertical className="h-4 w-4 text-[--g400]" strokeWidth={1.5} />
                        </button>
                      </div>

                      {row.segments.map((seg, segIdx) => {
                        const isEditing = editingSegment?.sourceId === seg.sourceId;
                        const key = `${seg.sourceType}-${seg.sourceId}-${segIdx}`;

                        if (isEditing) {
                          return (
                            <div key={key} className="space-y-2">
                              <Textarea
                                value={editingSegment.text}
                                onChange={(e) => setEditingSegment({ ...editingSegment, text: e.target.value })}
                                className="min-h-[60px] text-[12px]"
                                autoFocus
                              />
                              <div className="flex gap-2">
                                <Button size="compact" onClick={handleSaveEdit} disabled={patchMessage.isPending}>
                                  <Check className="h-3 w-3 mr-1" />
                                  {language === "ru" ? "Сохранить" : "Save"}
                                </Button>
                                <Button size="compact" variant="odoo-secondary" onClick={handleCancelEdit} disabled={patchMessage.isPending}>
                                  <X className="h-3 w-3 mr-1" />
                                  {language === "ru" ? "Отмена" : "Cancel"}
                                </Button>
                              </div>
                            </div>
                          );
                        }

                        return (
                          <p
                            key={key}
                            className={cn(
                              "text-[13px] text-[--g800] mb-1 last:mb-0 leading-snug",
                              seg.sourceType === "message" && "cursor-pointer hover:text-[--p600] transition-colors",
                              seg.isPending && "italic text-[--g500]",
                            )}
                            onClick={() => handleSegmentClick(seg.sourceId, seg.text, !seg.isPending, seg.sourceType)}
                          >
                            {seg.text}
                          </p>
                        );
                      })}
                    </div>
                  </OdooCard>
                </div>
              );
            })}

            {/* 14.8 Infinite scroll sentinel */}
            {!isLoading && s3Visible < rows.length && (
              <div ref={s3SentinelRef} className="flex justify-center py-3">
                <Loader2 className="h-5 w-5 animate-spin text-[--g400]" />
              </div>
            )}

            {/* 14.5 Ghost card «+ Добавить» */}
            {!isLoading && (
              <button
                className="w-full border border-dashed border-[--p300] rounded-[--o-radius-lg] py-4 text-[13px] text-[--p500] hover:bg-[--p50] transition-colors"
                data-testid="button-add-entry"
              >
                + {language === "ru" ? "Добавить новую запись" : "Add new entry"}
              </button>
            )}
          </div>
        )}


        {/* ── РАЗДЕЛ 1 (14.7: TableWrapper, шапки без изменений) ──────── */}
        {activeTab === "section1" && (
          <div className="px-4 py-3">
            <div className="max-w-6xl mx-auto space-y-3">
              <div className="text-center">
                <h2 className="text-[15px] font-bold text-[--g900] mb-1">{t.section1.title}</h2>
                <p className="text-[12px] text-[--g500] leading-tight px-2">{t.section1.subtitle}</p>
              </div>
              <SectionActionBar actions={t.actions} sectionId="section1" />
              <TableWrapper testId="section1-table-wrapper">
                <table className="w-full border-collapse text-[10px]" data-testid="section1-table">
                  <thead>
                    <tr>
                      <th className="border border-foreground px-0.5 py-1 text-[8px] font-normal text-center align-top w-6 italic sticky left-0 z-10 bg-background">{t.section1.rowNumber}</th>
                      <th className="border border-foreground px-1 py-1 text-[8px] font-normal text-center align-top italic">{t.section1.orgName}</th>
                      <th className="border border-foreground px-1 py-1 text-[8px] font-normal text-center align-top italic">{t.section1.personInfo}</th>
                      <th className="border border-foreground px-0.5 py-1 text-[8px] font-normal text-center align-top italic">{t.section1.startDate}</th>
                      <th className="border border-foreground px-0.5 py-1 text-[8px] font-normal text-center align-top italic">{t.section1.endDate}</th>
                      <th className="border border-foreground px-1 py-1 text-[8px] font-normal text-center align-top italic">{t.section1.representative}</th>
                    </tr>
                    <tr>
                      {["1", "2", "3", "4", "5", "6"].map((n, i) => (
                        <th key={n} className={cn("border border-foreground px-0.5 py-0.5 text-[8px] font-bold text-center", i === 0 && "sticky left-0 z-10 bg-background")}>{n}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {Array.from({ length: TABLE_PAGE_SIZE }, (_, i) => i + s1Page * TABLE_PAGE_SIZE + 1).map((i) => (
                      <tr key={i}>
                        <td className="border border-foreground px-0.5 py-3 text-center align-top font-bold text-[9px] sticky left-0 z-[1] bg-background">{i}</td>
                        {Array.from({ length: 5 }).map((_, c) => (
                          <td key={c} className="border border-foreground px-1 py-3 align-top text-[9px]">&nbsp;</td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </TableWrapper>
              <TablePagination page={s1Page} totalPages={3} onPrev={() => setS1Page(p => p - 1)} onNext={() => setS1Page(p => p + 1)} lang={language} />
            </div>
          </div>
        )}

        {/* ── РАЗДЕЛ 2 (14.7) ─────────────────────────────────────────── */}
        {activeTab === "section2" && (
          <div className="px-4 py-3">
            <div className="max-w-6xl mx-auto space-y-3">
              <div className="text-center">
                <h2 className="text-[15px] font-bold text-[--g900] mb-1">{t.section2.title}</h2>
                <p className="text-[12px] text-[--g500] leading-tight px-2">{t.section2.subtitle}</p>
              </div>
              <SectionActionBar actions={t.actions} sectionId="section2" />
              <TableWrapper testId="section2-table-wrapper">
                <table className="w-full border-collapse text-[10px]" data-testid="section2-table">
                  <thead>
                    <tr>
                      <th className="border border-foreground px-0.5 py-1 text-[8px] font-normal text-center align-top w-6 italic sticky left-0 z-10 bg-background">{t.section2.rowNumber}</th>
                      <th className="border border-foreground px-1 py-1 text-[8px] font-normal text-center align-top italic">{t.section2.journalName}</th>
                      <th className="border border-foreground px-1 py-1 text-[8px] font-normal text-center align-top italic">{t.section2.personInfo}</th>
                      <th className="border border-foreground px-0.5 py-1 text-[8px] font-normal text-center align-top italic">{t.section2.transferDate}</th>
                      <th className="border border-foreground px-1 py-1 text-[8px] font-normal text-center align-top italic">{t.section2.signature}</th>
                    </tr>
                    <tr>
                      {["1", "2", "3", "4", "5"].map((n, i) => (
                        <th key={n} className={cn("border border-foreground px-0.5 py-0.5 text-[8px] font-bold text-center", i === 0 && "sticky left-0 z-10 bg-background")}>{n}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {Array.from({ length: TABLE_PAGE_SIZE }, (_, i) => i + s2Page * TABLE_PAGE_SIZE + 1).map((i) => (
                      <tr key={i}>
                        <td className="border border-foreground px-0.5 py-3 text-center align-top font-bold text-[9px] sticky left-0 z-[1] bg-background">{i}</td>
                        {Array.from({ length: 4 }).map((_, c) => (
                          <td key={c} className="border border-foreground px-1 py-3 align-top text-[9px]">&nbsp;</td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </TableWrapper>
              <TablePagination page={s2Page} totalPages={3} onPrev={() => setS2Page(p => p - 1)} onNext={() => setS2Page(p => p + 1)} lang={language} />
            </div>
          </div>
        )}

        {/* ── РАЗДЕЛ 4 (14.7) ─────────────────────────────────────────── */}
        {activeTab === "section4" && (
          <div className="px-4 py-3">
            <div className="max-w-6xl mx-auto space-y-3">
              <div className="text-center">
                <h2 className="text-[15px] font-bold text-[--g900] mb-1">{t.section4.title}</h2>
                <p className="text-[12px] text-[--g500] leading-tight px-2">{t.section4.subtitle}</p>
              </div>
              <SectionActionBar actions={t.actions} sectionId="section4" />
              <TableWrapper testId="section4-table-wrapper">
                <table className="w-full border-collapse text-[10px]" data-testid="section4-table">
                  <thead>
                    <tr>
                      <th className="border border-foreground px-0.5 py-1 text-[8px] font-normal text-center align-top w-6 italic sticky left-0 z-10 bg-background">{t.section4.rowNumber}</th>
                      <th className="border border-foreground px-1 py-1 text-[8px] font-normal text-center align-top italic">{t.section4.controlInfo}</th>
                      <th className="border border-foreground px-1 py-1 text-[8px] font-normal text-center align-top italic">{t.section4.defects}</th>
                      <th className="border border-foreground px-0.5 py-1 text-[8px] font-normal text-center align-top italic">{t.section4.defectDeadline}</th>
                      <th className="border border-foreground px-1 py-1 text-[8px] font-normal text-center align-top italic">{t.section4.controlSignature}</th>
                      <th className="border border-foreground px-0.5 py-1 text-[8px] font-normal text-center align-top italic">{t.section4.defectFixDate}</th>
                      <th className="border border-foreground px-1 py-1 text-[8px] font-normal text-center align-top italic">{t.section4.fixSignature}</th>
                    </tr>
                    <tr>
                      {["1", "2", "3", "4", "5", "6", "7"].map((n, i) => (
                        <th key={n} className={cn("border border-foreground px-0.5 py-0.5 text-[8px] font-bold text-center", i === 0 && "sticky left-0 z-10 bg-background")}>{n}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {Array.from({ length: TABLE_PAGE_SIZE }, (_, i) => i + s4Page * TABLE_PAGE_SIZE + 1).map((i) => (
                      <tr key={i}>
                        <td className="border border-foreground px-0.5 py-3 text-center align-top font-bold text-[9px] sticky left-0 z-[1] bg-background">{i}</td>
                        {Array.from({ length: 6 }).map((_, c) => (
                          <td key={c} className="border border-foreground px-1 py-3 align-top text-[9px]">&nbsp;</td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </TableWrapper>
              <TablePagination page={s4Page} totalPages={3} onPrev={() => setS4Page(p => p - 1)} onNext={() => setS4Page(p => p + 1)} lang={language} />
            </div>
          </div>
        )}

        {/* ── РАЗДЕЛ 5 (14.7) ─────────────────────────────────────────── */}
        {activeTab === "section5" && (
          <div className="px-4 py-3">
            <div className="max-w-6xl mx-auto space-y-3">
              <div className="text-center">
                <h2 className="text-[15px] font-bold text-[--g900] mb-1">{t.section5.title}</h2>
                <p className="text-[12px] text-[--g500] leading-tight px-2">{t.section5.subtitle}</p>
              </div>
              <SectionActionBar actions={t.actions} sectionId="section5" />
              <TableWrapper testId="section5-table-wrapper">
                <table className="w-full border-collapse text-sm" data-testid="section5-table">
                  <thead>
                    <tr>
                      <th className="border border-foreground px-2 py-2 text-xs font-normal text-center align-top w-12 italic sticky left-0 z-10 bg-background">{t.section5.rowNumber}</th>
                      <th className="border border-foreground px-2 py-2 text-xs font-normal text-center align-top italic">{t.section5.docName}</th>
                      <th className="border border-foreground px-2 py-2 text-xs font-normal text-center align-top italic">{t.section5.signatureInfo}</th>
                    </tr>
                    <tr>
                      {["1","2","3"].map((n, i) => (
                        <th key={n} className={cn("border border-foreground px-1 py-1 text-xs font-bold text-center", i === 0 && "sticky left-0 z-10 bg-background")}>{n}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {Array.from({ length: TABLE_PAGE_SIZE }, (_, i) => i + s5Page * TABLE_PAGE_SIZE + 1).map((i) => (
                      <tr key={i}>
                        <td className="border border-foreground px-2 py-6 text-center align-top font-bold sticky left-0 z-[1] bg-background">{i}</td>
                        <td className="border border-foreground px-2 py-6 align-top">&nbsp;</td>
                        <td className="border border-foreground px-2 py-6 align-top">&nbsp;</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </TableWrapper>
              <TablePagination page={s5Page} totalPages={3} onPrev={() => setS5Page(p => p - 1)} onNext={() => setS5Page(p => p + 1)} lang={language} />
            </div>
          </div>
        )}

        {/* ── РАЗДЕЛ 6 ────────────────────────────────────────────────── */}
        {activeTab === "section6" && (
          <div className="px-4 py-4">
            <SectionActionBar actions={t.actions} sectionId="section6" />
            <PlaceholderSection title={t.tabs.section6} comingSoon={t.comingSoon} />
          </div>
        )}

        {/* ── ТИТУЛ ───────────────────────────────────────────────────── */}
        {activeTab === "title" && (
          <div className="px-4 py-4">
            <SectionActionBar actions={t.actions} sectionId="title" />
            <PlaceholderSection title={t.tabs.title} comingSoon={t.comingSoon} />
          </div>
        )}
      </div>

      {/* 14.6 FAB «+» — только на Разд. 3 */}
      {activeTab === "section3" && (
        <Button
          variant="odoo-fab"
          size="odoo-fab-size"
          className="fixed bottom-24 right-4 z-50 lg:bottom-8"
          aria-label={language === "ru" ? "Добавить запись" : "Add entry"}
          data-testid="fab-add-entry"
        >
          <Plus className="h-5 w-5" strokeWidth={2} />
        </Button>
      )}
    </ResponsiveShell>
  );
}
