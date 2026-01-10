import { useState } from "react";
import { BottomNav } from "@/components/BottomNav";
import { Header } from "@/components/Header";
import { useMessages } from "@/hooks/use-messages";
import { useLanguageStore, translations } from "@/lib/i18n";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Loader2, FileText, RefreshCw, Construction } from "lucide-react";
import { format } from "date-fns";
import { ru, enUS } from "date-fns/locale";
import { cn } from "@/lib/utils";
import { queryClient } from "@/lib/queryClient";

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

export default function WorkLog() {
  const { language } = useLanguageStore();
  const t = translations[language].worklog;
  const [activeTab, setActiveTab] = useState("section3");
  const { data: messages = [], isLoading, refetch } = useMessages();

  const sortedMessages = [...messages].sort((a, b) => {
    const dateA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
    const dateB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
    return dateA - dateB;
  });

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
    queryClient.invalidateQueries({ queryKey: ['/api/messages'] });
    refetch();
  };

  const buildWorkDescription = (msg: typeof messages[0]) => {
    const data = msg.normalizedData;
    if (!msg.isProcessed || !data) {
      return msg.messageRaw || "";
    }
    
    let description = data.workDescription || msg.messageRaw || "";
    
    const materials: string[] = [];
    if (data.materials && Array.isArray(data.materials)) {
      materials.push(...data.materials);
    }
    
    if (materials.length > 0) {
      description += ` — ${materials.join("; ")}`;
    }
    
    return description;
  };

  return (
    <div className="flex flex-col min-h-screen bg-background bg-grain">
      <Header title={t.title} />
      
      <div className="flex-1 flex flex-col pb-20 overflow-hidden">
        <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 flex flex-col">
          <div className="px-2 pt-2 border-b overflow-x-auto">
            <TabsList className="w-full justify-start gap-0 h-auto p-0 bg-transparent" data-testid="worklog-tabs">
              <TabsTrigger 
                value="title" 
                className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent px-3 py-2 text-xs"
                data-testid="tab-title"
              >
                {t.tabs.title}
              </TabsTrigger>
              <TabsTrigger 
                value="section1" 
                className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent px-3 py-2 text-xs"
                data-testid="tab-section1"
              >
                {t.tabs.section1}
              </TabsTrigger>
              <TabsTrigger 
                value="section2" 
                className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent px-3 py-2 text-xs"
                data-testid="tab-section2"
              >
                {t.tabs.section2}
              </TabsTrigger>
              <TabsTrigger 
                value="section3" 
                className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent px-3 py-2 text-xs"
                data-testid="tab-section3"
              >
                {t.tabs.section3}
              </TabsTrigger>
              <TabsTrigger 
                value="section4" 
                className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent px-3 py-2 text-xs"
                data-testid="tab-section4"
              >
                {t.tabs.section4}
              </TabsTrigger>
              <TabsTrigger 
                value="section5" 
                className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent px-3 py-2 text-xs"
                data-testid="tab-section5"
              >
                {t.tabs.section5}
              </TabsTrigger>
              <TabsTrigger 
                value="section6" 
                className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent px-3 py-2 text-xs"
                data-testid="tab-section6"
              >
                {t.tabs.section6}
              </TabsTrigger>
            </TabsList>
          </div>

          <TabsContent value="title" className="flex-1 m-0 overflow-hidden">
            <ScrollArea className="h-full px-2 py-4">
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
            <ScrollArea className="h-full px-2 py-4">
              <PlaceholderSection title={t.tabs.section2} comingSoon={t.comingSoon} />
            </ScrollArea>
          </TabsContent>

          <TabsContent value="section3" className="flex-1 m-0 overflow-hidden">
            <ScrollArea className="h-full px-2 py-2">
              <div className="max-w-6xl mx-auto">
                <div className="flex items-center justify-between mb-3 px-2">
                  <p className="text-sm text-muted-foreground leading-tight max-w-[70%]">
                    {t.section3.subtitle}
                  </p>
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
                ) : sortedMessages.length === 0 ? (
                  <div className="text-center py-16 opacity-60">
                    <div className="bg-muted w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4">
                      <FileText className="h-8 w-8 text-muted-foreground" />
                    </div>
                    <h3 className="font-semibold text-lg mb-1">{t.noRecords}</h3>
                    <p className="text-sm text-muted-foreground">{t.noRecordsHint}</p>
                  </div>
                ) : (
                  <div className="overflow-x-auto border border-blue-400 rounded-sm">
                    <table className="w-full border-collapse text-sm" data-testid="worklog-table">
                      <thead>
                        <tr className="bg-blue-50 dark:bg-blue-950/30">
                          <th className="border border-blue-300 dark:border-blue-700 px-2 py-2 text-xs font-normal text-center align-top w-12">
                            {t.section3.rowNumber}
                          </th>
                          <th className="border border-blue-300 dark:border-blue-700 px-2 py-2 text-xs font-normal text-center align-top w-24">
                            {t.section3.date}
                          </th>
                          <th className="border border-blue-300 dark:border-blue-700 px-2 py-2 text-xs font-normal text-center align-top w-20">
                            {t.section3.workConditions}
                          </th>
                          <th className="border border-blue-300 dark:border-blue-700 px-2 py-2 text-xs font-normal text-center italic">
                            {t.section3.workDescription}
                          </th>
                          <th className="border border-blue-300 dark:border-blue-700 px-2 py-2 text-xs font-normal text-center italic w-36">
                            {t.section3.representative}
                          </th>
                        </tr>
                        <tr className="bg-blue-50 dark:bg-blue-950/30">
                          <th className="border border-blue-300 dark:border-blue-700 px-1 py-1 text-xs font-normal text-center">
                            1
                          </th>
                          <th className="border border-blue-300 dark:border-blue-700 px-1 py-1 text-xs font-normal text-center">
                            2
                          </th>
                          <th className="border border-blue-300 dark:border-blue-700 px-1 py-1 text-xs font-normal text-center">
                            3
                          </th>
                          <th className="border border-blue-300 dark:border-blue-700 px-1 py-1 text-xs font-normal text-center">
                            4
                          </th>
                          <th className="border border-blue-300 dark:border-blue-700 px-1 py-1 text-xs font-normal text-center">
                            5
                          </th>
                        </tr>
                      </thead>
                      <tbody>
                        {sortedMessages.map((msg, idx) => {
                          const isPending = !msg.isProcessed;
                          const data = msg.normalizedData;
                          return (
                            <tr 
                              key={msg.id} 
                              className={cn(
                                "hover:bg-muted/30 transition-colors",
                                isPending && "opacity-70 bg-yellow-50/30 dark:bg-yellow-900/10"
                              )}
                              data-testid={`worklog-row-${msg.id}`}
                            >
                              <td className="border border-blue-300 dark:border-blue-700 px-2 py-3 text-center align-top">
                                {idx + 1}
                              </td>
                              <td className="border border-blue-300 dark:border-blue-700 px-2 py-3 text-center align-top whitespace-nowrap">
                                {formatDate(data?.date || msg.createdAt?.toString())}
                              </td>
                              <td className="border border-blue-300 dark:border-blue-700 px-2 py-3 text-center align-top">
                                {data?.workConditions || ""}
                              </td>
                              <td className="border border-blue-300 dark:border-blue-700 px-3 py-3 align-top">
                                <div className={cn(isPending && "italic text-muted-foreground")}>
                                  {buildWorkDescription(msg)}
                                </div>
                              </td>
                              <td className="border border-blue-300 dark:border-blue-700 px-2 py-3 text-center align-top">
                                {data?.representative || ""}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </ScrollArea>
          </TabsContent>

          <TabsContent value="section4" className="flex-1 m-0 overflow-hidden">
            <ScrollArea className="h-full px-2 py-4">
              <PlaceholderSection title={t.tabs.section4} comingSoon={t.comingSoon} />
            </ScrollArea>
          </TabsContent>

          <TabsContent value="section5" className="flex-1 m-0 overflow-hidden">
            <ScrollArea className="h-full px-2 py-4">
              <PlaceholderSection title={t.tabs.section5} comingSoon={t.comingSoon} />
            </ScrollArea>
          </TabsContent>

          <TabsContent value="section6" className="flex-1 m-0 overflow-hidden">
            <ScrollArea className="h-full px-2 py-4">
              <PlaceholderSection title={t.tabs.section6} comingSoon={t.comingSoon} />
            </ScrollArea>
          </TabsContent>
        </Tabs>
      </div>

      <BottomNav />
    </div>
  );
}
