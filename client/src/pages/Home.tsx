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
import { useMessages, useCreateMessage, useProcessMessage, useClearMessages } from "@/hooks/use-messages";
import { MessageBubble } from "@/components/MessageBubble";
import { KeyRound, Send, Mic, Loader2, Trash2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { motion, AnimatePresence } from "framer-motion";
import { useLanguageStore, translations } from "@/lib/i18n";
import { useCurrentObject } from "@/hooks/use-source-data";
import { useWorks } from "@/hooks/use-works";
import { useTelegram } from "@/hooks/useTelegram";
import { Link } from "wouter";
import { X, ChevronRight as ChevronRightIcon } from "lucide-react";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { getAuthToken } from "@/lib/auth";
import { useAuth } from "@/hooks/use-auth";

export default function Home() {
  const { language } = useLanguageStore();
  const t = translations[language].home;
  const { data: currentObject } = useCurrentObject();
  const objectSubtitle = currentObject?.title
    ? `${language === "ru" ? "ОБЪЕКТ" : "OBJECT"}: ${currentObject.title}`
    : undefined;
  const [inputValue, setInputValue] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);
  const { data: messages = [], isLoading, isError: isMessagesError, error: messagesError } = useMessages();
  const createMessage = useCreateMessage();
  const processMessage = useProcessMessage();
  const { toast } = useToast();
  const { user: telegramUser, isInTelegram } = useTelegram();
  const { data: works = [] } = useWorks();
  const clearMessages = useClearMessages();
  const { user: authUser } = useAuth();

  const currentUser = telegramUser?.id ? String(telegramUser.id) : "dev_user";
  const authToken = getAuthToken();

  const isAuthError =
    isMessagesError &&
    messagesError instanceof Error &&
    /(^|\s)(401|403)(\s|:)|authentication required|telegram authentication required/i.test(
      messagesError.message,
    );

  const needsAuth = !isInTelegram && !authToken && !authUser;
  const hasInvalidAuth = !isInTelegram && (!!authToken || !!authUser) && isAuthError;

  const [isClearDialogOpen, setIsClearDialogOpen] = useState(false);

  const [onboardingDismissed, setOnboardingDismissed] = useState(() =>
    localStorage.getItem("onboarding_dismissed") === "1"
  );

  const showOnboarding =
    !needsAuth &&
    !hasInvalidAuth &&
    !onboardingDismissed &&
    messages.length === 0 &&
    works.length === 0 &&
    !isLoading;

  const handleDismissOnboarding = () => {
    localStorage.setItem("onboarding_dismissed", "1");
    setOnboardingDismissed(true);
  };

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
    } catch (err) {
      const details = err instanceof Error ? err.message : "";
      const baseDescription =
        language === "ru" ? "Не удалось отправить сообщение" : "Failed to send message";
      toast({
        title: language === "ru" ? "Ошибка" : "Error",
        description: details ? `${baseDescription}. ${details}` : baseDescription,
        variant: "destructive",
      });
    }
  };

  return (
    <div className="flex flex-col min-h-screen bg-background bg-grain">
      <Header title={t.title} subtitle={objectSubtitle} showAvatar />

      {/* Browser access banner (outside Telegram) */}
      {!isInTelegram && (needsAuth || hasInvalidAuth) && (
        <div className="px-4 pt-3">
          <div className="max-w-md mx-auto">
            <Alert variant={hasInvalidAuth ? "destructive" : "default"}>
              <KeyRound className="h-4 w-4" />
              <AlertTitle>
                {language === "ru"
                  ? hasInvalidAuth
                    ? "Неверный токен"
                    : "Требуется вход"
                  : hasInvalidAuth
                    ? "Invalid token"
                    : "Authentication required"}
              </AlertTitle>
              <AlertDescription>
                <p>
                  {language === "ru"
                    ? hasInvalidAuth
                      ? "Текущий токен недействителен. Войдите снова, чтобы продолжить работу."
                      : "Чтобы работать в браузере (вне Telegram), войдите в систему."
                    : hasInvalidAuth
                      ? "Your current authentication is invalid. Please log in again."
                      : "To use the app in browser (outside Telegram), please log in."}
                </p>
                <div className="mt-3">
                  <Link href="/login">
                    <Button size="sm" variant={hasInvalidAuth ? "secondary" : "default"}>
                      {language === "ru" ? "Войти" : "Log in"}
                    </Button>
                  </Link>
                </div>
              </AlertDescription>
            </Alert>
          </div>
        </div>
      )}

      {/* Кнопка очистки истории — показывается когда есть сообщения */}
      {sortedMessages.length > 0 && !isLoading && (
        <div className="flex justify-end px-4 pt-2">
          <button
            onClick={() => setIsClearDialogOpen(true)}
            className="flex items-center gap-1 text-[11px] text-muted-foreground/60 hover:text-destructive transition-colors"
          >
            <Trash2 className="h-3 w-3" />
            {language === "ru" ? "Очистить историю" : "Clear history"}
          </button>
        </div>
      )}

      {/* Диалог подтверждения очистки */}
      <AlertDialog open={isClearDialogOpen} onOpenChange={setIsClearDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {language === "ru" ? "Очистить историю чата?" : "Clear chat history?"}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {language === "ru"
                ? "Все записи из журнала работ будут удалены безвозвратно. Акты и график работ останутся без изменений."
                : "All worklog entries will be permanently deleted. Acts and schedule will remain unchanged."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={clearMessages.isPending}>
              {language === "ru" ? "Отмена" : "Cancel"}
            </AlertDialogCancel>
            <AlertDialogAction
              disabled={clearMessages.isPending}
              className="bg-destructive hover:bg-destructive/90"
              onClick={async () => {
                try {
                  await clearMessages.mutateAsync();
                  toast({
                    title: language === "ru" ? "История очищена" : "History cleared",
                  });
                } catch {
                  toast({
                    title: language === "ru" ? "Ошибка" : "Error",
                    variant: "destructive",
                  });
                }
              }}
            >
              {clearMessages.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (language === "ru" ? "Удалить" : "Delete")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <ScrollArea ref={scrollRef} className="flex-1 px-4 py-6 mb-36">
        <div className="max-w-md mx-auto min-h-[calc(100vh-12rem)] flex flex-col justify-end">
          {showOnboarding && (
            <div className="bg-card border rounded-2xl p-4 mb-6 relative shadow-sm">
              <button
                onClick={handleDismissOnboarding}
                className="absolute top-3 right-3 text-muted-foreground/60 hover:text-muted-foreground"
                aria-label="Закрыть"
              >
                <X className="h-4 w-4" />
              </button>
              <p className="text-[13px] font-semibold text-foreground mb-3">
                {language === "ru" ? "С чего начать?" : "Getting started"}
              </p>
              <ol className="space-y-2">
                {[
                  { label: language === "ru" ? "Заполните данные объекта" : "Fill in project details", href: "/source-data" },
                  { label: language === "ru" ? "Импортируйте ВОР или Смету" : "Import BoQ or Estimate", href: "/works" },
                  { label: language === "ru" ? "Постройте график и назначьте акты" : "Build schedule and assign acts", href: "/schedule" },
                  { label: language === "ru" ? "Генерируйте АОСР и скачайте PDF" : "Generate AOSR and export PDF", href: "/acts" },
                ].map((step, i) => (
                  <li key={i}>
                    <Link href={step.href} className="flex items-center gap-2 group">
                      <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary text-[11px] font-bold">
                        {i + 1}
                      </span>
                      <span className="text-[13px] text-muted-foreground group-hover:text-foreground transition-colors flex-1">
                        {step.label}
                      </span>
                      <ChevronRightIcon className="h-3.5 w-3.5 text-muted-foreground/40 group-hover:text-primary transition-colors" />
                    </Link>
                  </li>
                ))}
              </ol>
            </div>
          )}

          {isLoading ? (
            <div className="flex justify-center items-center py-10">
              <Loader2 className="h-8 w-8 animate-spin text-primary/50" />
            </div>
          ) : !isInTelegram && (needsAuth || hasInvalidAuth) ? (
            <div className="text-center py-20 opacity-70">
              <div className="bg-muted w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4">
                <KeyRound className="h-8 w-8 text-muted-foreground" />
              </div>
              <h3 className="font-semibold text-lg">
                {language === "ru"
                  ? hasInvalidAuth
                    ? "Требуется повторный вход"
                    : "Требуется вход"
                  : hasInvalidAuth
                    ? "Re-authentication required"
                    : "Authentication required"}
              </h3>
              <p className="text-sm text-muted-foreground mt-2">
                {language === "ru"
                  ? "Откройте приложение в Telegram или настройте access-token для браузера."
                  : "Open the app in Telegram or configure an access token for browser access."}
              </p>
              <div className="mt-4">
                <Link href="/login">
                  <Button>{language === "ru" ? "Перейти к входу" : "Go to login"}</Button>
                </Link>
              </div>
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
