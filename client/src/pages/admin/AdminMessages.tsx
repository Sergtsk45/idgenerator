/**
 * @file: AdminMessages.tsx
 * @description: Очередь AI-обработки сообщений — просмотр и повторная обработка
 * @dependencies: use-admin.ts, AdminLayout.tsx, shadcn/ui
 * @created: 2026-02-23
 */

import { AdminLayout } from "./AdminLayout";
import { useFailedMessages, useReprocessMessage } from "@/hooks/use-admin";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { RefreshCw, CheckCircle2, Clock } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

function formatDate(iso: string) {
  return new Date(iso).toLocaleString("ru-RU", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function AdminMessages() {
  const { data: messages, isLoading, error, refetch } = useFailedMessages();
  const reprocess = useReprocessMessage();
  const { toast } = useToast();

  const handleReprocess = async (id: number) => {
    try {
      await reprocess.mutateAsync(id);
      toast({ title: "Сообщение повторно обработано" });
    } catch {
      toast({ title: "Ошибка обработки", variant: "destructive" });
    }
  };

  const handleReprocessAll = async () => {
    if (!messages?.length) return;
    let success = 0;
    for (const msg of messages) {
      try {
        await reprocess.mutateAsync(msg.id);
        success++;
      } catch {
        // continue
      }
    }
    toast({ title: `Обработано: ${success} из ${messages.length}` });
  };

  return (
    <AdminLayout title="Очередь AI">
      <div className="max-w-3xl mx-auto space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="font-semibold">Необработанные сообщения</h2>
            <p className="text-xs text-muted-foreground mt-0.5">
              Сообщения, для которых AI-нормализация не выполнена
            </p>
          </div>
          <div className="flex gap-2">
            <Button size="sm" variant="outline" onClick={() => refetch()}>
              <RefreshCw className="h-3.5 w-3.5 mr-1" />
              Обновить
            </Button>
            {messages && messages.length > 0 && (
              <Button
                size="sm"
                onClick={handleReprocessAll}
                disabled={reprocess.isPending}
              >
                Обработать все ({messages.length})
              </Button>
            )}
          </div>
        </div>

        {isLoading && (
          <div className="space-y-3">
            {[...Array(3)].map((_, i) => <Skeleton key={i} className="h-24 rounded-xl" />)}
          </div>
        )}

        {error && (
          <div className="border border-destructive/30 rounded-xl p-4 text-sm text-destructive">
            Ошибка: {error.message}
          </div>
        )}

        {!isLoading && !error && messages?.length === 0 && (
          <div className="text-center py-16 space-y-2">
            <CheckCircle2 className="h-12 w-12 text-green-500 mx-auto" />
            <p className="text-sm font-medium">Все сообщения обработаны</p>
            <p className="text-xs text-muted-foreground">Очередь AI пуста</p>
          </div>
        )}

        {messages?.map((msg) => (
          <div key={msg.id} className="border rounded-xl p-4 bg-card space-y-2">
            <div className="flex items-start justify-between gap-3">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <Badge variant="outline" className="text-[10px] shrink-0">
                    <Clock className="h-2.5 w-2.5 mr-0.5" />
                    {msg.isProcessed ? "Обработано" : "Ожидает"}
                  </Badge>
                  <span className="text-xs text-muted-foreground">{formatDate(msg.createdAt)}</span>
                </div>
                <p className="text-sm line-clamp-3 break-words">{msg.messageRaw}</p>
                {msg.objectId && (
                  <p className="text-xs text-muted-foreground mt-1">Объект ID: {msg.objectId}</p>
                )}
              </div>
              <Button
                size="sm"
                variant="outline"
                onClick={() => handleReprocess(msg.id)}
                disabled={reprocess.isPending && reprocess.variables === msg.id}
                className="shrink-0"
              >
                <RefreshCw className={`h-3.5 w-3.5 mr-1 ${reprocess.isPending && reprocess.variables === msg.id ? "animate-spin" : ""}`} />
                Обработать
              </Button>
            </div>
          </div>
        ))}
      </div>
    </AdminLayout>
  );
}
