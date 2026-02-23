/**
 * @file: WorkLog.tsx
 * @description: Страница «Общий журнал работ» — pill-табы + список раздела 3 (как в референсе) + таблицы разделов 1, 2, 4, 5
 * @dependencies: useSection3, usePatchMessage, useCurrentObject, useLanguageStore, BottomNav, Header
 * @created: 2026-02-23
 */

import { useState } from "react";
import { BottomNav } from "@/components/BottomNav";
import { Header } from "@/components/Header";
import { useSection3 } from "@/hooks/use-section3";
import { usePatchMessage } from "@/hooks/use-messages";
import { useLanguageStore, translations } from "@/lib/i18n";
import { useCurrentObject } from "@/hooks/use-source-data";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button";
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
  Zap,
} from "lucide-react";
import { format } from "date-fns";
import { ru, enUS } from "date-fns/locale";
import { cn } from "@/lib/utils";
import { queryClient } from "@/lib/queryClient";
import { api } from "@shared/routes";

/* ─── вспомогательные компоненты ──────────────────────────────────── */

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

  const { data: rows = [], isLoading, refetch } = useSection3({ enablePolling: !editingSegment });
  const patchMessage = usePatchMessage();

  const formatDate = (dateStr: string | undefined) => {
    if (!dateStr) return "";
    try {
      return format(new Date(dateStr), "dd.MM.yyyy", { locale });
    } catch {
      return dateStr;
    }
  };

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
    <div className="flex flex-col min-h-screen bg-background">
      <Header title={t.title} subtitle={objectSubtitle} showAvatar />

      {/* Pill-табы (как в референсе) */}
      <div
        className="flex gap-2 overflow-x-auto px-4 py-3 border-b border-border/40 scrollbar-hide bg-background sticky top-14 z-20"
        data-testid="worklog-tabs"
      >
        {TABS.map((tab) => (
          <button
            key={tab.value}
            onClick={() => setActiveTab(tab.value)}
            className={cn(
              "shrink-0 px-4 py-1.5 rounded-full text-[13px] font-medium transition-colors whitespace-nowrap",
              activeTab === tab.value
                ? "bg-primary text-white"
                : "bg-muted/60 text-muted-foreground hover:text-foreground",
            )}
            data-testid={`tab-${tab.value}`}
          >
            {TAB_SHORT[tab.value]}
          </button>
        ))}
      </div>

      {/* Контент */}
      <div className="flex-1 pb-28 overflow-y-auto">

        {/* ── РАЗДЕЛ 3 (список как в референсе) ──────────────────────── */}
        {activeTab === "section3" && (
          <>
            {/* Info-badge */}
            <div className="flex items-center justify-between px-4 py-2 bg-primary/5 border-b border-primary/10">
              <div className="flex items-center gap-2">
                <div className="w-5 h-5 rounded-full bg-primary/20 flex items-center justify-center">
                  <span className="text-[10px] text-primary font-bold">i</span>
                </div>
                <span className="text-[11px] font-semibold uppercase tracking-wider text-primary">
                  {t.section3.title}
                </span>
              </div>
              {rows.length > 0 && (
                <span className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground bg-muted px-2 py-0.5 rounded-full">
                  {format(
                    new Date(rows[rows.length - 1].date),
                    language === "ru" ? "LLLL yyyy" : "MMM yyyy",
                    { locale },
                  ).toUpperCase()}
                </span>
              )}
            </div>

            {/* Кнопка обновить */}
            <div className="flex justify-end px-4 py-2">
              <Button
                variant="outline"
                size="sm"
                onClick={handleRefresh}
                className="shrink-0"
                data-testid="button-refresh-log"
              >
                <RefreshCw className="h-4 w-4 mr-2" />
                {t.refreshLog}
              </Button>
            </div>

            {/* Загрузка */}
            {isLoading && (
              <div className="flex justify-center items-center py-20">
                <Loader2 className="h-8 w-8 animate-spin text-primary/50" />
              </div>
            )}

            {/* Пусто */}
            {!isLoading && rows.length === 0 && (
              <div className="text-center py-16 opacity-60 px-6">
                <div className="bg-muted w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4">
                  <FileText className="h-8 w-8 text-muted-foreground" />
                </div>
                <h3 className="font-semibold text-lg mb-1">{t.noRecords}</h3>
                <p className="text-sm text-muted-foreground">{t.noRecordsHint}</p>
              </div>
            )}

            {/* Список записей */}
            {!isLoading && rows.length > 0 && (
              <div>
                {rows.map((row) => {
                  const rowDate = new Date(row.date);
                  const allProcessed = row.segments.every((s) => !s.isPending);
                  const statusLabel = allProcessed
                    ? language === "ru" ? "ПРИНЯТО" : "ACCEPTED"
                    : language === "ru" ? "В РАБОТЕ" : "IN PROGRESS";
                  const statusClass = allProcessed
                    ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300"
                    : "border-border text-muted-foreground bg-muted/40";

                  return (
                    <div
                      key={row.date}
                      className="border-b border-border/40 last:border-b-0 px-4 py-3"
                      data-testid={`worklog-row-${row.date}`}
                    >
                      <div className="flex items-start gap-3">
                        {/* Дата */}
                        <div className="w-10 shrink-0 text-center">
                          <div className="text-[15px] font-bold leading-tight">
                            {format(rowDate, "d", { locale })}
                          </div>
                          <div className="text-[11px] text-muted-foreground uppercase">
                            {format(rowDate, "EEE", { locale })}
                          </div>
                          <div className="text-[11px] text-muted-foreground">
                            {format(rowDate, "LLL", { locale })}
                          </div>
                        </div>

                        {/* Основной контент */}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between mb-1.5">
                            <span
                              className={cn(
                                "text-[10px] font-medium uppercase px-2 py-0.5 rounded border",
                                statusClass,
                              )}
                            >
                              {statusLabel}
                            </span>
                            <button type="button" className="text-muted-foreground/60 p-0.5">
                              <MoreVertical className="h-4 w-4" />
                            </button>
                          </div>

                          {/* Сегменты */}
                          <div className="space-y-1">
                            {row.segments.map((seg, segIdx) => {
                              const isEditing = editingSegment?.sourceId === seg.sourceId;

                              if (isEditing) {
                                return (
                                  <div
                                    key={`${seg.sourceType}-${seg.sourceId}-${segIdx}`}
                                    className="space-y-2"
                                  >
                                    <Textarea
                                      value={editingSegment.text}
                                      onChange={(e) =>
                                        setEditingSegment({
                                          ...editingSegment,
                                          text: e.target.value,
                                        })
                                      }
                                      className="min-h-[60px] text-[13px] rounded-xl"
                                      autoFocus
                                    />
                                    <div className="flex gap-2">
                                      <Button
                                        size="sm"
                                        onClick={handleSaveEdit}
                                        disabled={patchMessage.isPending}
                                        className="h-7 rounded-lg"
                                      >
                                        <Check className="h-3 w-3 mr-1" />
                                        {language === "ru" ? "Сохранить" : "Save"}
                                      </Button>
                                      <Button
                                        size="sm"
                                        variant="outline"
                                        onClick={handleCancelEdit}
                                        disabled={patchMessage.isPending}
                                        className="h-7 rounded-lg"
                                      >
                                        <X className="h-3 w-3 mr-1" />
                                        {language === "ru" ? "Отмена" : "Cancel"}
                                      </Button>
                                    </div>
                                  </div>
                                );
                              }

                              return (
                                <p
                                  key={`${seg.sourceType}-${seg.sourceId}-${segIdx}`}
                                  className={cn(
                                    "text-[13px] leading-snug",
                                    seg.sourceType === "message" &&
                                      "cursor-pointer hover:text-primary transition-colors",
                                    seg.isPending && "italic text-muted-foreground",
                                  )}
                                  onClick={() =>
                                    handleSegmentClick(
                                      seg.sourceId,
                                      seg.text,
                                      !seg.isPending,
                                      seg.sourceType,
                                    )
                                  }
                                >
                                  {seg.text}
                                </p>
                              );
                            })}
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {/* Добавить новую запись */}
            <div className="mx-4 my-3 border border-dashed border-primary/30 rounded-2xl p-4 bg-primary/[0.02]">
              <div className="flex items-start gap-3">
                <div className="w-8 h-8 rounded-full border-2 border-primary/30 flex items-center justify-center shrink-0">
                  <Plus className="h-4 w-4 text-primary/50" />
                </div>
                <div>
                  <p className="text-[14px] font-medium text-primary/70">
                    {language === "ru" ? "Добавить новую запись" : "Add new entry"}
                  </p>
                  <p className="text-[11px] text-muted-foreground mt-0.5 leading-snug">
                    {language === "ru"
                      ? "Вы можете внести сведения за прошедшие даты или обновить данные из чат-бота Telegram."
                      : "You can add entries for past dates or update data from the Telegram chatbot."}
                  </p>
                </div>
              </div>
            </div>

            {/* Общий прогресс */}
            <div className="flex items-center justify-between mx-4 my-3 px-4 py-3 bg-card border border-border/60 rounded-2xl">
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
                  {language === "ru" ? "ОБЩИЙ ПРОГРЕСС" : "OVERALL PROGRESS"}
                </p>
                <p className="text-[32px] font-bold leading-tight">{progress}%</p>
              </div>
              <div className="w-11 h-11 rounded-xl bg-muted flex items-center justify-center">
                <Zap className="h-5 w-5 text-primary" />
              </div>
            </div>
          </>
        )}

        {/* ── ТИТУЛ ───────────────────────────────────────────────────── */}
        {activeTab === "title" && (
          <ScrollArea className="h-full px-2 py-4">
            <SectionActionBar actions={t.actions} sectionId="title" />
            <PlaceholderSection title={t.tabs.title} comingSoon={t.comingSoon} />
          </ScrollArea>
        )}

        {/* ── РАЗДЕЛ 1 ────────────────────────────────────────────────── */}
        {activeTab === "section1" && (
          <ScrollArea className="h-full px-2 py-2">
            <div className="max-w-6xl mx-auto">
              <div className="text-center mb-4">
                <h2 className="text-lg font-bold mb-2">{t.section1.title}</h2>
                <p className="text-sm text-muted-foreground leading-tight px-2">
                  {t.section1.subtitle}
                </p>
              </div>
              <SectionActionBar actions={t.actions} sectionId="section1" />
              <div className="overflow-x-auto border-2 border-foreground">
                <table className="w-full border-collapse text-sm" data-testid="section1-table">
                  <thead>
                    <tr>
                      <th className="border border-foreground px-2 py-2 text-xs font-normal text-center align-top w-12 italic">
                        {t.section1.rowNumber}
                      </th>
                      <th className="border border-foreground px-2 py-2 text-xs font-normal text-center align-top italic">
                        {t.section1.orgName}
                      </th>
                      <th className="border border-foreground px-2 py-2 text-xs font-normal text-center align-top italic">
                        {t.section1.personInfo}
                      </th>
                      <th className="border border-foreground px-2 py-2 text-xs font-normal text-center align-top italic">
                        {t.section1.startDate}
                      </th>
                      <th className="border border-foreground px-2 py-2 text-xs font-normal text-center align-top italic">
                        {t.section1.endDate}
                      </th>
                      <th className="border border-foreground px-2 py-2 text-xs font-normal text-center align-top italic">
                        {t.section1.representative}
                      </th>
                    </tr>
                    <tr>
                      {["1","2","3","4","5","6"].map((n) => (
                        <th key={n} className="border border-foreground px-1 py-1 text-xs font-normal text-center italic">{n}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {[0,1,2].map((i) => (
                      <tr key={i}>
                        {Array.from({ length: 6 }).map((_, c) => (
                          <td key={c} className="border border-foreground px-2 py-6 align-top">&nbsp;</td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </ScrollArea>
        )}

        {/* ── РАЗДЕЛ 2 ────────────────────────────────────────────────── */}
        {activeTab === "section2" && (
          <ScrollArea className="h-full px-2 py-2">
            <div className="max-w-6xl mx-auto">
              <div className="text-center mb-4">
                <h2 className="text-lg font-bold mb-2">{t.section2.title}</h2>
                <p className="text-sm text-muted-foreground leading-tight px-2">
                  {t.section2.subtitle}
                </p>
              </div>
              <SectionActionBar actions={t.actions} sectionId="section2" />
              <div className="overflow-x-auto border-2 border-foreground">
                <table className="w-full border-collapse text-sm" data-testid="section2-table">
                  <thead>
                    <tr>
                      <th className="border border-foreground px-2 py-2 text-xs font-normal text-center align-top w-12 italic">
                        {t.section2.rowNumber}
                      </th>
                      <th className="border border-foreground px-2 py-2 text-xs font-normal text-center align-top italic">
                        {t.section2.journalName}
                      </th>
                      <th className="border border-foreground px-2 py-2 text-xs font-normal text-center align-top italic">
                        {t.section2.personInfo}
                      </th>
                      <th className="border border-foreground px-2 py-2 text-xs font-normal text-center align-top italic">
                        {t.section2.transferDate}
                      </th>
                      <th className="border border-foreground px-2 py-2 text-xs font-normal text-center align-top italic">
                        {t.section2.signature}
                      </th>
                    </tr>
                    <tr>
                      {["1","2","3","4","5"].map((n) => (
                        <th key={n} className="border border-foreground px-1 py-1 text-xs font-normal text-center italic">{n}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {[0,1,2].map((i) => (
                      <tr key={i}>
                        {Array.from({ length: 5 }).map((_, c) => (
                          <td key={c} className="border border-foreground px-2 py-6 align-top">&nbsp;</td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </ScrollArea>
        )}

        {/* ── РАЗДЕЛ 4 ────────────────────────────────────────────────── */}
        {activeTab === "section4" && (
          <ScrollArea className="h-full px-2 py-2">
            <div className="max-w-6xl mx-auto">
              <div className="text-center mb-4">
                <h2 className="text-lg font-bold mb-2">{t.section4.title}</h2>
                <p className="text-sm text-muted-foreground leading-tight px-2">
                  {t.section4.subtitle}
                </p>
              </div>
              <SectionActionBar actions={t.actions} sectionId="section4" />
              <div className="overflow-x-auto border-2 border-foreground">
                <table className="w-full border-collapse text-sm" data-testid="section4-table">
                  <thead>
                    <tr>
                      <th className="border border-foreground px-2 py-2 text-xs font-normal text-center align-top w-10 italic">
                        {t.section4.rowNumber}
                      </th>
                      <th className="border border-foreground px-2 py-2 text-xs font-normal text-center align-top italic">
                        {t.section4.controlInfo}
                      </th>
                      <th className="border border-foreground px-2 py-2 text-xs font-normal text-center align-top italic">
                        {t.section4.defects}
                      </th>
                      <th className="border border-foreground px-1 py-2 text-xs font-normal text-center align-top w-12 italic">
                        {t.section4.defectDeadline}
                      </th>
                      <th className="border border-foreground px-2 py-2 text-xs font-normal text-center align-top italic">
                        {t.section4.controlSignature}
                      </th>
                      <th className="border border-foreground px-1 py-2 text-xs font-normal text-center align-top w-12 italic">
                        {t.section4.defectFixDate}
                      </th>
                      <th className="border border-foreground px-2 py-2 text-xs font-normal text-center align-top italic">
                        {t.section4.fixSignature}
                      </th>
                    </tr>
                    <tr>
                      {["1","2","3","4","5","6","7"].map((n) => (
                        <th key={n} className="border border-foreground px-1 py-1 text-xs font-normal text-center italic">{n}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {[0,1,2].map((i) => (
                      <tr key={i}>
                        {Array.from({ length: 7 }).map((_, c) => (
                          <td key={c} className="border border-foreground px-2 py-6 align-top">&nbsp;</td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </ScrollArea>
        )}

        {/* ── РАЗДЕЛ 5 ────────────────────────────────────────────────── */}
        {activeTab === "section5" && (
          <ScrollArea className="h-full px-2 py-2">
            <div className="max-w-6xl mx-auto">
              <div className="text-center mb-4">
                <h2 className="text-lg font-bold mb-2">{t.section5.title}</h2>
                <p className="text-sm text-muted-foreground leading-tight px-2">
                  {t.section5.subtitle}
                </p>
              </div>
              <SectionActionBar actions={t.actions} sectionId="section5" />
              <div className="overflow-x-auto border-2 border-foreground">
                <table className="w-full border-collapse text-sm" data-testid="section5-table">
                  <thead>
                    <tr>
                      <th className="border border-foreground px-2 py-2 text-xs font-normal text-center align-top w-12 italic">
                        {t.section5.rowNumber}
                      </th>
                      <th className="border border-foreground px-2 py-2 text-xs font-normal text-center align-top italic">
                        {t.section5.docName}
                      </th>
                      <th className="border border-foreground px-2 py-2 text-xs font-normal text-center align-top italic">
                        {t.section5.signatureInfo}
                      </th>
                    </tr>
                    <tr>
                      {["1","2","3"].map((n) => (
                        <th key={n} className="border border-foreground px-1 py-1 text-xs font-bold text-center">{n}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {[1,2,3,4,5].map((i) => (
                      <tr key={i}>
                        <td className="border border-foreground px-2 py-6 text-center align-top font-bold">{i}</td>
                        <td className="border border-foreground px-2 py-6 align-top">&nbsp;</td>
                        <td className="border border-foreground px-2 py-6 align-top">&nbsp;</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </ScrollArea>
        )}

        {/* ── РАЗДЕЛ 6 ────────────────────────────────────────────────── */}
        {activeTab === "section6" && (
          <ScrollArea className="h-full px-2 py-4">
            <SectionActionBar actions={t.actions} sectionId="section6" />
            <PlaceholderSection title={t.tabs.section6} comingSoon={t.comingSoon} />
          </ScrollArea>
        )}
      </div>

      <BottomNav />
    </div>
  );
}
