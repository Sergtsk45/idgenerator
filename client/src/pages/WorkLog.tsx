/**
 * @file: WorkLog.tsx
 * @description: Страница «Общий журнал работ» — pill-табы + список раздела 3 (как в референсе) + таблицы разделов 1, 2, 4, 5
 * @dependencies: useSection3, usePatchMessage, useCurrentObject, useLanguageStore, BottomNav, Header
 * @created: 2026-02-23
 */

import { useState } from "react";
import { ResponsiveShell } from "@/components/ResponsiveShell";
import { useSection3 } from "@/hooks/use-section3";
import { usePatchMessage } from "@/hooks/use-messages";
import { useLanguageStore, translations } from "@/lib/i18n";
import { useCurrentObject } from "@/hooks/use-source-data";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button";
import { PillTabs } from "@/components/ui/pill-tabs";
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

        {/* ── РАЗДЕЛ 3 (список как в референсе) ──────────────────────── */}
        {activeTab === "section3" && (
          <ScrollArea className="h-full px-2 py-2">
            <div className="max-w-6xl mx-auto">
              <div className="text-center mb-4">
                <h2 className="text-lg font-bold mb-2">{t.section3.title}</h2>
                <p className="text-sm text-muted-foreground leading-tight px-2">
                  {t.section3.subtitle}
                </p>
              </div>
              <SectionActionBar actions={t.actions} sectionId="section3" />
              
              {/* Кнопка обновить */}
              <div className="flex justify-end mb-2">
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

              <div className="overflow-x-auto border-2 border-foreground">
                <table className="w-full border-collapse text-[10px]" data-testid="section3-table">
                  <thead>
                    <tr>
                      <th className="border border-foreground px-0.5 py-1 text-[8px] font-normal text-center align-top w-6 italic sticky left-0 z-10 bg-background">
                        {t.section3.rowNumber}
                      </th>
                      <th className="border border-foreground px-0.5 py-1 text-[8px] font-normal text-center align-top italic">
                        {t.section3.date}
                      </th>
                      <th className="border border-foreground px-1 py-1 text-[8px] font-normal text-center align-top italic">
                        {t.section3.workConditions}
                      </th>
                      <th className="border border-foreground px-1 py-1 text-[8px] font-normal text-center align-top italic">
                        {t.section3.workDescription}
                      </th>
                      <th className="border border-foreground px-1 py-1 text-[8px] font-normal text-center align-top italic">
                        {t.section3.representative}
                      </th>
                    </tr>
                    <tr>
                      {["1", "2", "3", "4", "5"].map((n, i) => (
                        <th key={n} className={cn("border border-foreground px-0.5 py-0.5 text-[8px] font-bold text-center", i === 0 && "sticky left-0 z-10 bg-background")}>{n}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
            {/* Загрузка */}
            {isLoading && (
              <tr>
                <td colSpan={5} className="border border-foreground px-2 py-20 text-center">
                  <Loader2 className="h-8 w-8 animate-spin text-primary/50 inline-block" />
                </td>
              </tr>
            )}

            {/* Пусто */}
            {!isLoading && rows.length === 0 && (
              <tr>
                <td colSpan={5} className="border border-foreground px-6 py-16 text-center">
                  <div className="bg-muted w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4">
                    <FileText className="h-8 w-8 text-muted-foreground" />
                  </div>
                  <h3 className="font-semibold text-lg mb-1">{t.noRecords}</h3>
                  <p className="text-sm text-muted-foreground">{t.noRecordsHint}</p>
                </td>
              </tr>
            )}

            {/* Записи */}
            {!isLoading && rows.length > 0 && rows.map((row, rowIndex) => {
              const rowDate = new Date(row.date);
              const allProcessed = row.segments.every((s) => !s.isPending);
              
              return (
                <tr key={row.date} data-testid={`worklog-row-${row.date}`}>
                  <td className="border border-foreground px-0.5 py-3 text-center align-top font-bold text-[9px] sticky left-0 z-[1] bg-background">
                    {rowIndex + 1}
                  </td>
                  <td className="border border-foreground px-1 py-3 align-top text-[9px]">
                    {formatDate(row.date)}
                  </td>
                  <td className="border border-foreground px-1 py-3 align-top text-[9px]">
                    {/* Условия производства работ */}
                    &nbsp;
                  </td>
                  <td className="border border-foreground px-1 py-3 align-top text-[9px]">
                    {/* Наименование работ */}
                    {row.segments.map((seg, segIdx) => {
                      const isEditing = editingSegment?.sourceId === seg.sourceId;

                      if (isEditing) {
                        return (
                          <div key={`${seg.sourceType}-${seg.sourceId}-${segIdx}`} className="space-y-2 mb-2">
                            <Textarea
                              value={editingSegment.text}
                              onChange={(e) =>
                                setEditingSegment({
                                  ...editingSegment,
                                  text: e.target.value,
                                })
                              }
                              className="min-h-[60px] text-[11px] rounded-xl"
                              autoFocus
                            />
                            <div className="flex gap-2">
                              <Button
                                size="sm"
                                onClick={handleSaveEdit}
                                disabled={patchMessage.isPending}
                                className="h-7 rounded-lg text-[10px]"
                              >
                                <Check className="h-3 w-3 mr-1" />
                                {language === "ru" ? "Сохранить" : "Save"}
                              </Button>
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={handleCancelEdit}
                                disabled={patchMessage.isPending}
                                className="h-7 rounded-lg text-[10px]"
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
                            "mb-1 last:mb-0",
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
                  </td>
                  <td className="border border-foreground px-1 py-3 align-top text-[9px]">
                    {/* Подпись представителя */}
                    &nbsp;
                  </td>
                </tr>
              );
            })}
                  </tbody>
                </table>
              </div>
            </div>
          </ScrollArea>
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
                <table className="w-full border-collapse text-[10px]" data-testid="section1-table">
                  <thead>
                    <tr>
                      <th className="border border-foreground px-0.5 py-1 text-[8px] font-normal text-center align-top w-6 italic sticky left-0 z-10 bg-background">
                        {t.section1.rowNumber}
                      </th>
                      <th className="border border-foreground px-1 py-1 text-[8px] font-normal text-center align-top italic">
                        {t.section1.orgName}
                      </th>
                      <th className="border border-foreground px-1 py-1 text-[8px] font-normal text-center align-top italic">
                        {t.section1.personInfo}
                      </th>
                      <th className="border border-foreground px-0.5 py-1 text-[8px] font-normal text-center align-top italic">
                        {t.section1.startDate}
                      </th>
                      <th className="border border-foreground px-0.5 py-1 text-[8px] font-normal text-center align-top italic">
                        {t.section1.endDate}
                      </th>
                      <th className="border border-foreground px-1 py-1 text-[8px] font-normal text-center align-top italic">
                        {t.section1.representative}
                      </th>
                    </tr>
                    <tr>
                      {["1", "2", "3", "4", "5", "6"].map((n, i) => (
                        <th key={n} className={cn("border border-foreground px-0.5 py-0.5 text-[8px] font-bold text-center", i === 0 && "sticky left-0 z-10 bg-background")}>{n}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {[1, 2, 3].map((i) => (
                      <tr key={i}>
                        <td className="border border-foreground px-0.5 py-3 text-center align-top font-bold text-[9px] sticky left-0 z-[1] bg-background">{i}</td>
                        {Array.from({ length: 5 }).map((_, c) => (
                          <td key={c} className="border border-foreground px-1 py-3 align-top text-[9px]">&nbsp;</td>
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
                <table className="w-full border-collapse text-[10px]" data-testid="section2-table">
                  <thead>
                    <tr>
                      <th className="border border-foreground px-0.5 py-1 text-[8px] font-normal text-center align-top w-6 italic sticky left-0 z-10 bg-background">
                        {t.section2.rowNumber}
                      </th>
                      <th className="border border-foreground px-1 py-1 text-[8px] font-normal text-center align-top italic">
                        {t.section2.journalName}
                      </th>
                      <th className="border border-foreground px-1 py-1 text-[8px] font-normal text-center align-top italic">
                        {t.section2.personInfo}
                      </th>
                      <th className="border border-foreground px-0.5 py-1 text-[8px] font-normal text-center align-top italic">
                        {t.section2.transferDate}
                      </th>
                      <th className="border border-foreground px-1 py-1 text-[8px] font-normal text-center align-top italic">
                        {t.section2.signature}
                      </th>
                    </tr>
                    <tr>
                      {["1", "2", "3", "4", "5"].map((n, i) => (
                        <th key={n} className={cn("border border-foreground px-0.5 py-0.5 text-[8px] font-bold text-center", i === 0 && "sticky left-0 z-10 bg-background")}>{n}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {[1, 2, 3].map((i) => (
                      <tr key={i}>
                        <td className="border border-foreground px-0.5 py-3 text-center align-top font-bold text-[9px] sticky left-0 z-[1] bg-background">{i}</td>
                        {Array.from({ length: 4 }).map((_, c) => (
                          <td key={c} className="border border-foreground px-1 py-3 align-top text-[9px]">&nbsp;</td>
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
                <table className="w-full border-collapse text-[10px]" data-testid="section4-table">
                  <thead>
                    <tr>
                      <th className="border border-foreground px-0.5 py-1 text-[8px] font-normal text-center align-top w-6 italic sticky left-0 z-10 bg-background">
                        {t.section4.rowNumber}
                      </th>
                      <th className="border border-foreground px-1 py-1 text-[8px] font-normal text-center align-top italic">
                        {t.section4.controlInfo}
                      </th>
                      <th className="border border-foreground px-1 py-1 text-[8px] font-normal text-center align-top italic">
                        {t.section4.defects}
                      </th>
                      <th className="border border-foreground px-0.5 py-1 text-[8px] font-normal text-center align-top italic">
                        {t.section4.defectDeadline}
                      </th>
                      <th className="border border-foreground px-1 py-1 text-[8px] font-normal text-center align-top italic">
                        {t.section4.controlSignature}
                      </th>
                      <th className="border border-foreground px-0.5 py-1 text-[8px] font-normal text-center align-top italic">
                        {t.section4.defectFixDate}
                      </th>
                      <th className="border border-foreground px-1 py-1 text-[8px] font-normal text-center align-top italic">
                        {t.section4.fixSignature}
                      </th>
                    </tr>
                    <tr>
                      {["1", "2", "3", "4", "5", "6", "7"].map((n, i) => (
                        <th key={n} className={cn("border border-foreground px-0.5 py-0.5 text-[8px] font-bold text-center", i === 0 && "sticky left-0 z-10 bg-background")}>{n}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {[1, 2, 3].map((i) => (
                      <tr key={i}>
                        <td className="border border-foreground px-0.5 py-3 text-center align-top font-bold text-[9px] sticky left-0 z-[1] bg-background">{i}</td>
                        {Array.from({ length: 6 }).map((_, c) => (
                          <td key={c} className="border border-foreground px-1 py-3 align-top text-[9px]">&nbsp;</td>
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
                      <th className="border border-foreground px-2 py-2 text-xs font-normal text-center align-top w-12 italic sticky left-0 z-10 bg-background">
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
                      {["1","2","3"].map((n, i) => (
                        <th key={n} className={cn("border border-foreground px-1 py-1 text-xs font-bold text-center", i === 0 && "sticky left-0 z-10 bg-background")}>{n}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {[1,2,3,4,5].map((i) => (
                      <tr key={i}>
                        <td className="border border-foreground px-2 py-6 text-center align-top font-bold sticky left-0 z-[1] bg-background">{i}</td>
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

    </ResponsiveShell>
  );
}
