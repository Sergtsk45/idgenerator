/**
 * @file: MessageBubble.tsx
 * @description: Компонент пузыря сообщения пользователя с карточкой WorkMatchCard для отображения распознанной работы
 * @dependencies: shared/schema, lucide-react, date-fns, @/lib/i18n, @/lib/utils
 * @created: 2026-02-23
 */

import { Message } from "@shared/schema";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  CheckCheck,
  Loader2,
  Link2,
  Box,
  ArrowRight,
  Paperclip,
  Clock,
} from "lucide-react";
import { format } from "date-fns";
import { useLanguageStore } from "@/lib/i18n";

// ---------------------------------------------------------------------------
// WorkMatchCard
// ---------------------------------------------------------------------------

interface WorkMatchCardProps {
  data: Message["normalizedData"];
  isProcessing?: boolean;
  showActions?: boolean;
  language: string;
}

function WorkMatchCard({ data, isProcessing, showActions, language }: WorkMatchCardProps) {
  const isRu = language === "ru";

  if (isProcessing) {
    return (
      <div className="bg-white border border-l-4 border-[--g200] rounded-[--o-radius-lg] p-4 max-w-[88%] animate-pulse">
        <div className="h-3 bg-[--g200] rounded-full w-3/4 mb-2" />
        <div className="h-3 bg-[--g200] rounded-full w-1/2" />
      </div>
    );
  }

  if (!data) {
    return (
      <div className="flex justify-start pl-1">
        <span className="text-[11px] text-muted-foreground/60 italic">
          {isRu ? "Не удалось распознать работу" : "Could not identify work"}
        </span>
      </div>
    );
  }

  return (
    <div>
      {/* Лейбл над карточкой */}
      <div className="flex items-center gap-1.5 px-1 mb-1">
        <Link2 className="h-3.5 w-3.5 text-muted-foreground" />
        <span className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
          {isRu ? "РАБОТА УСПЕШНО СОПОСТАВЛЕНА" : "WORK MATCHED"}
        </span>
      </div>

      {/* Карточка */}
      <div className="bg-white border border-l-4 border-[--success] rounded-[--o-radius-lg] overflow-hidden shadow-sm max-w-[88%]">
        <div className="p-4 space-y-3">
          {/* Строка: КОД ВОР + дата */}
          <div className="flex items-start justify-between gap-2">
            <div>
              <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-0.5">
                {isRu ? "КОД ВОР" : "WORK CODE"}
              </p>
              <p className="text-[18px] font-bold leading-tight">{data.workCode}</p>
            </div>
            {data.date && (
              <span className="text-[11px] text-muted-foreground bg-muted px-2 py-0.5 rounded-full shrink-0 mt-1">
                {data.date}
              </span>
            )}
          </div>

          {/* Описание — курсив */}
          {data.workDescription && (
            <p className="text-[13px] text-muted-foreground italic leading-snug">
              «{data.workDescription}»
            </p>
          )}

          {/* Объём + Детали */}
          {(data.quantity !== undefined || data.unit) && (
            <div className="flex items-center justify-between pt-1 border-t border-border/40">
              <div className="flex items-center gap-2">
                <Box className="h-4 w-4 text-primary" />
                <span className="text-[22px] font-bold text-foreground leading-none">
                  {data.quantity}
                </span>
                <span className="text-[13px] text-muted-foreground">{data.unit}</span>
              </div>
              <button
                type="button"
                className="text-[13px] font-medium text-primary flex items-center gap-0.5"
              >
                {isRu ? "Детали" : "Details"}
                <ArrowRight className="h-3.5 w-3.5" />
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Кнопки быстрых действий */}
      {showActions && (
        <div className="flex gap-2 mt-2 pl-1">
          <Button variant="odoo-secondary" size="compact" className="gap-1.5">
            <Paperclip className="h-3.5 w-3.5" />
            {isRu ? "ФОТО/ФАЙЛ" : "PHOTO/FILE"}
          </Button>
          <Button variant="odoo-secondary" size="compact" className="gap-1.5">
            <Clock className="h-3.5 w-3.5" />
            {isRu ? "ИСТОРИЯ" : "HISTORY"}
          </Button>
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// MessageBubble
// ---------------------------------------------------------------------------

interface MessageBubbleProps {
  message: Message;
  isProcessing?: boolean;
  showActions?: boolean;
}

export function MessageBubble({ message, isProcessing, showActions }: MessageBubbleProps) {
  const { language } = useLanguageStore();
  const hasData = !!message.normalizedData;
  const isPending = !message.isProcessed;

  const time = format(new Date(message.createdAt ?? new Date()), "HH:mm");

  return (
    <div className="mb-6 space-y-2">
      {/* Bubble пользователя */}
      <div className="flex justify-end pl-12">
        <div
          className={cn(
            "bg-[--p100] text-[--g900] rounded-[16px_16px_4px_16px] px-4 py-3 max-w-[82%] shadow-sm"
          )}
        >
          <p className="text-[15px] leading-snug">{message.messageRaw}</p>
          <div className="flex justify-end items-center gap-1 mt-1">
            <span className="text-[11px] text-[--g500]">{time}</span>
            {isPending ? (
              <Loader2 className="h-3.5 w-3.5 text-[--g500] animate-spin" />
            ) : (
              <CheckCheck className="h-3.5 w-3.5 text-[--g500]" />
            )}
          </div>
        </div>
      </div>

      {/* AI-карточка */}
      {(hasData || isProcessing) && (
        <WorkMatchCard
          data={message.normalizedData}
          isProcessing={isProcessing}
          showActions={showActions}
          language={language}
        />
      )}

      {/* Ошибка распознавания — только если обработано, но данных нет */}
      {!hasData && !isProcessing && message.isProcessed && (
        <WorkMatchCard data={null} language={language} />
      )}
    </div>
  );
}
