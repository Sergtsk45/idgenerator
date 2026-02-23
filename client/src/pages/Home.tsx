/**
 * @file: Home.tsx
 * @description: Главная страница — журнал работ в формате чата с AI-распознаванием записей
 * @dependencies: use-messages, MessageBubble, BottomNav, Header, @/lib/i18n, framer-motion
 * @created: 2026-02-23
 */

import { useState, useRef, useEffect } from "react";
import { BottomNav } from "@/components/BottomNav";
import { Header } from "@/components/Header";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useMessages, useCreateMessage, useProcessMessage } from "@/hooks/use-messages";
import { MessageBubble } from "@/components/MessageBubble";
import { Send, Mic, Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { motion, AnimatePresence } from "framer-motion";
import { useLanguageStore, translations } from "@/lib/i18n";
import { useCurrentObject } from "@/hooks/use-source-data";

export default function Home() {
  const { language } = useLanguageStore();
  const t = translations[language].home;
  const { data: currentObject } = useCurrentObject();
  const objectSubtitle = currentObject?.title
    ? `${language === "ru" ? "ОБЪЕКТ" : "OBJECT"}: ${currentObject.title}`
    : undefined;
  const [inputValue, setInputValue] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);
  const { data: messages = [], isLoading } = useMessages();
  const createMessage = useCreateMessage();
  const processMessage = useProcessMessage();
  const { toast } = useToast();

  const currentUser = "user_123";

  const sortedMessages = [...messages].sort((a, b) => {
    const dateA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
    const dateB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
    return dateA - dateB;
  });

  // Индекс последнего обработанного сообщения с данными
  const lastProcessedIdx = sortedMessages.reduce<number>(
    (acc, msg, idx) => (msg.isProcessed && msg.normalizedData ? idx : acc),
    -1
  );

  useEffect(() => {
    if (scrollRef.current) {
      const scrollElement = scrollRef.current.querySelector(
        "[data-radix-scroll-area-viewport]"
      );
      if (scrollElement) {
        scrollElement.scrollTop = scrollElement.scrollHeight;
      }
    }
  }, [messages]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputValue.trim()) return;

    try {
      const newMessage = await createMessage.mutateAsync({
        userId: currentUser,
        messageRaw: inputValue,
      });

      setInputValue("");

      setTimeout(() => {
        processMessage.mutate(newMessage.id);
      }, 1000);
    } catch {
      toast({
        title: language === "ru" ? "Ошибка" : "Error",
        description:
          language === "ru"
            ? "Не удалось отправить сообщение"
            : "Failed to send message",
        variant: "destructive",
      });
    }
  };

  return (
    <div className="flex flex-col min-h-screen bg-background bg-grain">
      <Header title={t.title} subtitle={objectSubtitle} showAvatar />

      <ScrollArea ref={scrollRef} className="flex-1 px-4 py-6 mb-36">
        <div className="max-w-md mx-auto min-h-[calc(100vh-12rem)] flex flex-col justify-end">
          {isLoading ? (
            <div className="flex justify-center items-center py-10">
              <Loader2 className="h-8 w-8 animate-spin text-primary/50" />
            </div>
          ) : sortedMessages.length === 0 ? (
            <div className="text-center py-20 opacity-50">
              <div className="bg-muted w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4">
                <Mic className="h-8 w-8 text-muted-foreground" />
              </div>
              <h3 className="font-semibold text-lg">{t.noMessages}</h3>
            </div>
          ) : (
            <AnimatePresence initial={false}>
              {sortedMessages.map((msg, idx) => (
                <motion.div
                  key={msg.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.3 }}
                >
                  <MessageBubble
                    message={msg}
                    isProcessing={createMessage.isPending && !msg.isProcessed}
                    showActions={idx === lastProcessedIdx}
                  />
                </motion.div>
              ))}
            </AnimatePresence>
          )}
        </div>
      </ScrollArea>

      {/* Панель ввода */}
      <div className="fixed bottom-16 left-0 right-0 bg-background border-t border-border/40 px-4 pt-3 pb-3">
        <form onSubmit={handleSubmit} className="max-w-md mx-auto space-y-2">
          <div className="flex items-end gap-2">
            {/* Поле ввода с микрофоном внутри */}
            <div className="relative flex-1">
              <Textarea
                placeholder={
                  language === "ru"
                    ? "Опишите выполненные работы..."
                    : "Describe completed works..."
                }
                className="resize-none min-h-[48px] max-h-[120px] rounded-2xl border-border/60 pr-10 py-3 text-[15px] bg-secondary/30 focus-visible:ring-primary/20"
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    handleSubmit(e);
                  }
                }}
                rows={1}
              />
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="absolute right-1 bottom-1 h-8 w-8 text-muted-foreground/60"
              >
                <Mic className="h-4 w-4" />
              </Button>
            </div>

            {/* Кнопка отправки — синяя круглая */}
            <Button
              type="submit"
              size="icon"
              className="h-11 w-11 rounded-full bg-primary hover:bg-primary/90 shadow-md shadow-primary/20 shrink-0"
              disabled={!inputValue.trim() || createMessage.isPending}
            >
              {createMessage.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Send className="h-4 w-4" />
              )}
            </Button>
          </div>

          {/* Подпись */}
          <p className="text-[10px] text-muted-foreground/60 text-center leading-snug px-2">
            {language === "ru"
              ? "ИИ автоматически распознаёт строительные термины и сопоставляет с ВОР"
              : "AI automatically recognizes construction terms and matches to BoQ"}
          </p>
        </form>
      </div>

      <BottomNav />
    </div>
  );
}
