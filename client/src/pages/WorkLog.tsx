import { useState } from "react";
import { BottomNav } from "@/components/BottomNav";
import { Header } from "@/components/Header";
import { useSection3 } from "@/hooks/use-section3";
import { usePatchMessage } from "@/hooks/use-messages";
import { useLanguageStore, translations } from "@/lib/i18n";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { Loader2, FileText, RefreshCw, Construction, Pencil, Save, Search, Check, X } from "lucide-react";
import { format } from "date-fns";
import { ru, enUS } from "date-fns/locale";
import { cn } from "@/lib/utils";
import { queryClient } from "@/lib/queryClient";
import { api } from "@shared/routes";

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

function SectionActionBar({ actions, sectionId }: { actions: { edit: string; save: string; search: string }; sectionId: string }) {
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

export default function WorkLog() {
  const { language } = useLanguageStore();
  const t = translations[language].worklog;
  const [activeTab, setActiveTab] = useState("section3");
  const [editingSegment, setEditingSegment] = useState<{ sourceId: number; text: string; isProcessed: boolean } | null>(null);
  const { data: rows = [], isLoading, refetch } = useSection3({ enablePolling: !editingSegment });
  const patchMessage = usePatchMessage();

  const formatDate = (dateStr: string | undefined) => {
    if (!dateStr) return "";
    try {
      return format(new Date(dateStr), "dd.MM.yyyy", { 
        locale: language === 'ru' ? ru : enUS 
      });
    } catch {
      return dateStr;
    }
  };

  const handleRefresh = () => {
    queryClient.invalidateQueries({ queryKey: [api.worklog.section3.path] });
    refetch();
  };

  const handleSegmentClick = (sourceId: number, text: string, isProcessed: boolean, sourceType: string) => {
    if (sourceType !== 'message') return; // Only allow editing messages
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

  const handleCancelEdit = () => {
    setEditingSegment(null);
  };

  return (
    <div className="flex flex-col min-h-screen bg-background bg-grain">
      <Header title={t.title} />
      
      <div className="flex-1 flex flex-col pb-20 overflow-hidden">
        <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 flex flex-col">
          <div className="py-3 border-b">
            <div 
              className="flex gap-2 overflow-x-auto px-3 pb-1 scrollbar-hide"
              style={{ scrollSnapType: 'x mandatory' }}
              data-testid="worklog-tabs"
            >
              {[
                { value: 'title', label: t.tabs.title },
                { value: 'section1', label: t.tabs.section1 },
                { value: 'section2', label: t.tabs.section2 },
                { value: 'section3', label: t.tabs.section3 },
                { value: 'section4', label: t.tabs.section4 },
                { value: 'section5', label: t.tabs.section5 },
                { value: 'section6', label: t.tabs.section6 },
              ].map((tab) => (
                <button
                  key={tab.value}
                  onClick={() => setActiveTab(tab.value)}
                  className={cn(
                    "flex-shrink-0 w-20 h-20 rounded-md border-2 flex items-center justify-center text-center text-xs font-medium transition-all",
                    "hover-elevate active-elevate-2",
                    activeTab === tab.value
                      ? "border-primary bg-primary/10 text-primary"
                      : "border-border bg-card text-muted-foreground hover:border-primary/50"
                  )}
                  style={{ scrollSnapAlign: 'start' }}
                  data-testid={`tab-${tab.value}`}
                >
                  <span className="px-1 leading-tight">{tab.label}</span>
                </button>
              ))}
              <div className="flex-shrink-0 w-4" aria-hidden="true" />
            </div>
          </div>

          <TabsContent value="title" className="flex-1 m-0 overflow-hidden">
            <ScrollArea className="h-full px-2 py-4">
              <SectionActionBar actions={t.actions} sectionId="title" />
              <PlaceholderSection title={t.tabs.title} comingSoon={t.comingSoon} />
            </ScrollArea>
          </TabsContent>

          <TabsContent value="section1" className="flex-1 m-0 overflow-hidden">
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
                        <th className="border border-foreground px-1 py-1 text-xs font-normal text-center italic">1</th>
                        <th className="border border-foreground px-1 py-1 text-xs font-normal text-center italic">2</th>
                        <th className="border border-foreground px-1 py-1 text-xs font-normal text-center italic">3</th>
                        <th className="border border-foreground px-1 py-1 text-xs font-normal text-center italic">4</th>
                        <th className="border border-foreground px-1 py-1 text-xs font-normal text-center italic">5</th>
                        <th className="border border-foreground px-1 py-1 text-xs font-normal text-center italic">6</th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr>
                        <td className="border border-foreground px-2 py-6 text-center align-top">&nbsp;</td>
                        <td className="border border-foreground px-2 py-6 align-top">&nbsp;</td>
                        <td className="border border-foreground px-2 py-6 align-top">&nbsp;</td>
                        <td className="border border-foreground px-2 py-6 align-top">&nbsp;</td>
                        <td className="border border-foreground px-2 py-6 align-top">&nbsp;</td>
                        <td className="border border-foreground px-2 py-6 align-top">&nbsp;</td>
                      </tr>
                      <tr>
                        <td className="border border-foreground px-2 py-6 text-center align-top">&nbsp;</td>
                        <td className="border border-foreground px-2 py-6 align-top">&nbsp;</td>
                        <td className="border border-foreground px-2 py-6 align-top">&nbsp;</td>
                        <td className="border border-foreground px-2 py-6 align-top">&nbsp;</td>
                        <td className="border border-foreground px-2 py-6 align-top">&nbsp;</td>
                        <td className="border border-foreground px-2 py-6 align-top">&nbsp;</td>
                      </tr>
                      <tr>
                        <td className="border border-foreground px-2 py-6 text-center align-top">&nbsp;</td>
                        <td className="border border-foreground px-2 py-6 align-top">&nbsp;</td>
                        <td className="border border-foreground px-2 py-6 align-top">&nbsp;</td>
                        <td className="border border-foreground px-2 py-6 align-top">&nbsp;</td>
                        <td className="border border-foreground px-2 py-6 align-top">&nbsp;</td>
                        <td className="border border-foreground px-2 py-6 align-top">&nbsp;</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>
            </ScrollArea>
          </TabsContent>

          <TabsContent value="section2" className="flex-1 m-0 overflow-hidden">
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
                        <th className="border border-foreground px-1 py-1 text-xs font-normal text-center italic">1</th>
                        <th className="border border-foreground px-1 py-1 text-xs font-normal text-center italic">2</th>
                        <th className="border border-foreground px-1 py-1 text-xs font-normal text-center italic">3</th>
                        <th className="border border-foreground px-1 py-1 text-xs font-normal text-center italic">4</th>
                        <th className="border border-foreground px-1 py-1 text-xs font-normal text-center italic">5</th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr>
                        <td className="border border-foreground px-2 py-6 text-center align-top">&nbsp;</td>
                        <td className="border border-foreground px-2 py-6 align-top">&nbsp;</td>
                        <td className="border border-foreground px-2 py-6 align-top">&nbsp;</td>
                        <td className="border border-foreground px-2 py-6 align-top">&nbsp;</td>
                        <td className="border border-foreground px-2 py-6 align-top">&nbsp;</td>
                      </tr>
                      <tr>
                        <td className="border border-foreground px-2 py-6 text-center align-top">&nbsp;</td>
                        <td className="border border-foreground px-2 py-6 align-top">&nbsp;</td>
                        <td className="border border-foreground px-2 py-6 align-top">&nbsp;</td>
                        <td className="border border-foreground px-2 py-6 align-top">&nbsp;</td>
                        <td className="border border-foreground px-2 py-6 align-top">&nbsp;</td>
                      </tr>
                      <tr>
                        <td className="border border-foreground px-2 py-6 text-center align-top">&nbsp;</td>
                        <td className="border border-foreground px-2 py-6 align-top">&nbsp;</td>
                        <td className="border border-foreground px-2 py-6 align-top">&nbsp;</td>
                        <td className="border border-foreground px-2 py-6 align-top">&nbsp;</td>
                        <td className="border border-foreground px-2 py-6 align-top">&nbsp;</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>
            </ScrollArea>
          </TabsContent>

          <TabsContent value="section3" className="flex-1 m-0 overflow-hidden">
            <ScrollArea className="h-full px-2 py-2">
              <div className="max-w-6xl mx-auto">
                <div className="text-center mb-2">
                  <h2 className="text-lg font-bold mb-2">{t.section3.title}</h2>
                  <p className="text-sm text-muted-foreground leading-tight px-2">
                    {t.section3.subtitle}
                  </p>
                </div>

                <SectionActionBar actions={t.actions} sectionId="section3" />

                <div className="flex justify-end mb-3">
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

                {isLoading ? (
                  <div className="flex justify-center items-center py-20">
                    <Loader2 className="h-8 w-8 animate-spin text-primary/50" />
                  </div>
                ) : rows.length === 0 ? (
                  <div className="text-center py-16 opacity-60">
                    <div className="bg-muted w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4">
                      <FileText className="h-8 w-8 text-muted-foreground" />
                    </div>
                    <h3 className="font-semibold text-lg mb-1">{t.noRecords}</h3>
                    <p className="text-sm text-muted-foreground">{t.noRecordsHint}</p>
                  </div>
                ) : (
                  <div className="overflow-x-auto border-2 border-foreground">
                    <table className="w-full border-collapse text-sm" data-testid="worklog-table">
                      <thead>
                        <tr>
                          <th className="border border-foreground px-2 py-2 text-xs font-normal text-center align-top w-12 italic">
                            {t.section3.rowNumber}
                          </th>
                          <th className="border border-foreground px-2 py-2 text-xs font-normal text-center align-top w-24 italic">
                            {t.section3.date}
                          </th>
                          <th className="border border-foreground px-2 py-2 text-xs font-normal text-center align-top w-20 italic">
                            {t.section3.workConditions}
                          </th>
                          <th className="border border-foreground px-2 py-2 text-xs font-normal text-center align-top italic">
                            {t.section3.workDescription}
                          </th>
                          <th className="border border-foreground px-2 py-2 text-xs font-normal text-center align-top italic w-36">
                            {t.section3.representative}
                          </th>
                        </tr>
                        <tr>
                          <th className="border border-foreground px-1 py-1 text-xs font-normal text-center italic">1</th>
                          <th className="border border-foreground px-1 py-1 text-xs font-normal text-center italic">2</th>
                          <th className="border border-foreground px-1 py-1 text-xs font-normal text-center italic">3</th>
                          <th className="border border-foreground px-1 py-1 text-xs font-normal text-center italic">4</th>
                          <th className="border border-foreground px-1 py-1 text-xs font-normal text-center italic">5</th>
                        </tr>
                      </thead>
                      <tbody>
                        {rows.map((row, idx) => (
                          <tr
                            key={row.date}
                            className="hover:bg-muted/30 transition-colors"
                            data-testid={`worklog-row-${row.date}`}
                          >
                            <td className="border border-foreground px-2 py-3 text-center align-top">
                              {idx + 1}
                            </td>
                            <td className="border border-foreground px-2 py-3 text-center align-top whitespace-nowrap">
                              {formatDate(row.date)}
                            </td>
                            <td className="border border-foreground px-2 py-3 text-center align-top">
                              {row.workConditions}
                            </td>
                            <td className="border border-foreground px-3 py-3 align-top">
                              {row.segments.map((seg, segIdx) => {
                                const isEditing = editingSegment?.sourceId === seg.sourceId;
                                
                                if (isEditing) {
                                  return (
                                    <div key={`${seg.sourceType}-${seg.sourceId}-${segIdx}`} className="space-y-2 mb-2">
                                      <Textarea
                                        value={editingSegment.text}
                                        onChange={(e) => setEditingSegment({ ...editingSegment, text: e.target.value })}
                                        className="min-h-[60px] text-sm"
                                        autoFocus
                                      />
                                      <div className="flex gap-2">
                                        <Button
                                          size="sm"
                                          onClick={handleSaveEdit}
                                          disabled={patchMessage.isPending}
                                          className="h-7"
                                        >
                                          <Check className="h-3 w-3 mr-1" />
                                          Сохранить
                                        </Button>
                                        <Button
                                          size="sm"
                                          variant="outline"
                                          onClick={handleCancelEdit}
                                          disabled={patchMessage.isPending}
                                          className="h-7"
                                        >
                                          <X className="h-3 w-3 mr-1" />
                                          Отмена
                                        </Button>
                                      </div>
                                    </div>
                                  );
                                }
                                
                                return (
                                  <div
                                    key={`${seg.sourceType}-${seg.sourceId}-${segIdx}`}
                                    className={cn(
                                      "mb-1 last:mb-0",
                                      seg.sourceType === 'message' &&
                                        "text-primary/70 cursor-pointer hover:bg-primary/5 rounded px-1 py-0.5 transition-colors",
                                      seg.isPending && "italic text-muted-foreground"
                                    )}
                                    onClick={() => handleSegmentClick(seg.sourceId, seg.text, !seg.isPending, seg.sourceType)}
                                  >
                                    {seg.text}
                                  </div>
                                );
                              })}
                            </td>
                            <td className="border border-foreground px-2 py-3 text-center align-top">
                              {row.representative}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </ScrollArea>
          </TabsContent>

          <TabsContent value="section4" className="flex-1 m-0 overflow-hidden">
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
                          <div className="writing-vertical-rl transform rotate-180 h-32 flex items-center justify-center">
                            {t.section4.defectDeadline}
                          </div>
                        </th>
                        <th className="border border-foreground px-2 py-2 text-xs font-normal text-center align-top italic">
                          {t.section4.controlSignature}
                        </th>
                        <th className="border border-foreground px-1 py-2 text-xs font-normal text-center align-top w-12 italic">
                          <div className="writing-vertical-rl transform rotate-180 h-32 flex items-center justify-center">
                            {t.section4.defectFixDate}
                          </div>
                        </th>
                        <th className="border border-foreground px-2 py-2 text-xs font-normal text-center align-top italic">
                          {t.section4.fixSignature}
                        </th>
                      </tr>
                      <tr>
                        <th className="border border-foreground px-1 py-1 text-xs font-normal text-center italic">1</th>
                        <th className="border border-foreground px-1 py-1 text-xs font-normal text-center italic">2</th>
                        <th className="border border-foreground px-1 py-1 text-xs font-normal text-center italic">3</th>
                        <th className="border border-foreground px-1 py-1 text-xs font-normal text-center italic">4</th>
                        <th className="border border-foreground px-1 py-1 text-xs font-normal text-center italic">5</th>
                        <th className="border border-foreground px-1 py-1 text-xs font-normal text-center italic">6</th>
                        <th className="border border-foreground px-1 py-1 text-xs font-normal text-center italic">7</th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr>
                        <td className="border border-foreground px-2 py-6 text-center align-top">&nbsp;</td>
                        <td className="border border-foreground px-2 py-6 align-top">&nbsp;</td>
                        <td className="border border-foreground px-2 py-6 align-top">&nbsp;</td>
                        <td className="border border-foreground px-2 py-6 align-top">&nbsp;</td>
                        <td className="border border-foreground px-2 py-6 align-top">&nbsp;</td>
                        <td className="border border-foreground px-2 py-6 align-top">&nbsp;</td>
                        <td className="border border-foreground px-2 py-6 align-top">&nbsp;</td>
                      </tr>
                      <tr>
                        <td className="border border-foreground px-2 py-6 text-center align-top">&nbsp;</td>
                        <td className="border border-foreground px-2 py-6 align-top">&nbsp;</td>
                        <td className="border border-foreground px-2 py-6 align-top">&nbsp;</td>
                        <td className="border border-foreground px-2 py-6 align-top">&nbsp;</td>
                        <td className="border border-foreground px-2 py-6 align-top">&nbsp;</td>
                        <td className="border border-foreground px-2 py-6 align-top">&nbsp;</td>
                        <td className="border border-foreground px-2 py-6 align-top">&nbsp;</td>
                      </tr>
                      <tr>
                        <td className="border border-foreground px-2 py-6 text-center align-top">&nbsp;</td>
                        <td className="border border-foreground px-2 py-6 align-top">&nbsp;</td>
                        <td className="border border-foreground px-2 py-6 align-top">&nbsp;</td>
                        <td className="border border-foreground px-2 py-6 align-top">&nbsp;</td>
                        <td className="border border-foreground px-2 py-6 align-top">&nbsp;</td>
                        <td className="border border-foreground px-2 py-6 align-top">&nbsp;</td>
                        <td className="border border-foreground px-2 py-6 align-top">&nbsp;</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>
            </ScrollArea>
          </TabsContent>

          <TabsContent value="section5" className="flex-1 m-0 overflow-hidden">
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
                        <th className="border border-foreground px-1 py-1 text-xs font-bold text-center">1</th>
                        <th className="border border-foreground px-1 py-1 text-xs font-bold text-center">2</th>
                        <th className="border border-foreground px-1 py-1 text-xs font-bold text-center">3</th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr>
                        <td className="border border-foreground px-2 py-6 text-center align-top font-bold">1</td>
                        <td className="border border-foreground px-2 py-6 align-top">&nbsp;</td>
                        <td className="border border-foreground px-2 py-6 align-top">&nbsp;</td>
                      </tr>
                      <tr>
                        <td className="border border-foreground px-2 py-6 text-center align-top font-bold">2</td>
                        <td className="border border-foreground px-2 py-6 align-top">&nbsp;</td>
                        <td className="border border-foreground px-2 py-6 align-top">&nbsp;</td>
                      </tr>
                      <tr>
                        <td className="border border-foreground px-2 py-6 text-center align-top font-bold">3</td>
                        <td className="border border-foreground px-2 py-6 align-top">&nbsp;</td>
                        <td className="border border-foreground px-2 py-6 align-top">&nbsp;</td>
                      </tr>
                      <tr>
                        <td className="border border-foreground px-2 py-6 text-center align-top font-bold">4</td>
                        <td className="border border-foreground px-2 py-6 align-top">&nbsp;</td>
                        <td className="border border-foreground px-2 py-6 align-top">&nbsp;</td>
                      </tr>
                      <tr>
                        <td className="border border-foreground px-2 py-6 text-center align-top font-bold">5</td>
                        <td className="border border-foreground px-2 py-6 align-top">&nbsp;</td>
                        <td className="border border-foreground px-2 py-6 align-top">&nbsp;</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>
            </ScrollArea>
          </TabsContent>

          <TabsContent value="section6" className="flex-1 m-0 overflow-hidden">
            <ScrollArea className="h-full px-2 py-4">
              <SectionActionBar actions={t.actions} sectionId="section6" />
              <PlaceholderSection title={t.tabs.section6} comingSoon={t.comingSoon} />
            </ScrollArea>
          </TabsContent>
        </Tabs>
      </div>

      <BottomNav />
    </div>
  );
}
