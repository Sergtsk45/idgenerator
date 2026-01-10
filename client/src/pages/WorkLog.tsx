import { BottomNav } from "@/components/BottomNav";
import { Header } from "@/components/Header";
import { useMessages } from "@/hooks/use-messages";
import { useLanguageStore, translations } from "@/lib/i18n";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Card, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Loader2, FileText, CheckCircle2, Clock } from "lucide-react";
import { format } from "date-fns";
import { ru, enUS } from "date-fns/locale";
import { cn } from "@/lib/utils";

export default function WorkLog() {
  const { language } = useLanguageStore();
  const t = translations[language].worklog;
  const { data: messages = [], isLoading } = useMessages();

  const sortedMessages = [...messages].sort((a, b) => {
    const dateA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
    const dateB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
    return dateB - dateA;
  });

  const formatDate = (dateStr: string | undefined) => {
    if (!dateStr) return "-";
    try {
      return format(new Date(dateStr), "dd.MM.yyyy", { 
        locale: language === 'ru' ? ru : enUS 
      });
    } catch {
      return dateStr;
    }
  };

  return (
    <div className="flex flex-col min-h-screen bg-background bg-grain">
      <Header title={t.title} />
      
      <ScrollArea className="flex-1 px-4 py-4 pb-24">
        <div className="max-w-4xl mx-auto">
          <Card className="mb-4">
            <CardHeader className="py-3 px-4">
              <div className="flex items-center justify-between gap-2 flex-wrap">
                <CardTitle className="text-base font-medium flex items-center gap-2">
                  <FileText className="h-4 w-4" />
                  {t.subtitle}
                </CardTitle>
                <Badge variant="outline" className="text-xs">
                  {t.rdStandard}
                </Badge>
              </div>
            </CardHeader>
          </Card>

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
            <div className="overflow-x-auto">
              <table className="w-full border-collapse" data-testid="worklog-table">
                <thead>
                  <tr className="bg-muted/50">
                    <th className="border border-border px-2 py-2 text-xs font-semibold text-left w-10">
                      {t.rowNumber}
                    </th>
                    <th className="border border-border px-2 py-2 text-xs font-semibold text-left w-24">
                      {t.date}
                    </th>
                    <th className="border border-border px-2 py-2 text-xs font-semibold text-left min-w-[150px]">
                      {t.workDescription}
                    </th>
                    <th className="border border-border px-2 py-2 text-xs font-semibold text-center w-16">
                      {t.quantity}
                    </th>
                    <th className="border border-border px-2 py-2 text-xs font-semibold text-center w-16">
                      {t.unit}
                    </th>
                    <th className="border border-border px-2 py-2 text-xs font-semibold text-left w-24">
                      {t.location}
                    </th>
                    <th className="border border-border px-2 py-2 text-xs font-semibold text-center w-20">
                      {t.status}
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {sortedMessages.map((msg, idx) => {
                    const data = msg.normalizedData;
                    const isPending = !msg.isProcessed;
                    return (
                      <tr 
                        key={msg.id} 
                        className={cn("hover-elevate", isPending && "opacity-70")}
                        data-testid={`worklog-row-${msg.id}`}
                      >
                        <td className="border border-border px-2 py-2 text-sm text-center text-muted-foreground">
                          {idx + 1}
                        </td>
                        <td className="border border-border px-2 py-2 text-sm">
                          {isPending 
                            ? formatDate(msg.createdAt?.toString()) 
                            : formatDate(data?.date || msg.createdAt?.toString())
                          }
                        </td>
                        <td className="border border-border px-2 py-2 text-sm">
                          {isPending ? (
                            <span className="text-muted-foreground italic">{msg.messageRaw}</span>
                          ) : (
                            <div className="flex flex-col gap-0.5">
                              {data?.workCode && (
                                <Badge variant="secondary" className="w-fit text-[10px] px-1.5 py-0">
                                  {data.workCode}
                                </Badge>
                              )}
                              <span>{data?.workDescription || msg.messageRaw}</span>
                            </div>
                          )}
                        </td>
                        <td className="border border-border px-2 py-2 text-sm text-center font-medium">
                          {isPending ? "-" : (data?.quantity ?? "-")}
                        </td>
                        <td className="border border-border px-2 py-2 text-sm text-center text-muted-foreground">
                          {isPending ? "-" : (data?.unit || "-")}
                        </td>
                        <td className="border border-border px-2 py-2 text-sm">
                          {isPending ? "-" : (data?.location || "-")}
                        </td>
                        <td className="border border-border px-2 py-2">
                          <div className="flex justify-center">
                            {msg.isProcessed ? (
                              <Badge variant="secondary" className="text-[10px] gap-1 bg-green-500/10 text-green-700 dark:text-green-400">
                                <CheckCircle2 className="h-3 w-3" />
                              </Badge>
                            ) : (
                              <Badge variant="secondary" className="text-[10px] gap-1 bg-yellow-500/10 text-yellow-700 dark:text-yellow-400">
                                <Clock className="h-3 w-3" />
                              </Badge>
                            )}
                          </div>
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

      <BottomNav />
    </div>
  );
}
