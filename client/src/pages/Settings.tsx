/**
 * @file: Settings.tsx
 * @description: Страница настроек приложения в стиле iOS/Android Settings
 * @dependencies: useLanguageStore, useAppSettings, useTelegram, Header, BottomNav, Switch, useToast
 * @created: 2026-02-23
 */

import { cn } from "@/lib/utils";
import { ChevronRight, Shield } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { Link } from "wouter";
import { useToast } from "@/hooks/use-toast";
import { useTelegram } from "@/hooks/useTelegram";
import { useLanguageStore, translations } from "@/lib/i18n";
import { useAppSettings } from "@/lib/app-settings";
import { Header } from "@/components/Header";
import { BottomNav } from "@/components/BottomNav";

export default function Settings() {
  const { language, setLanguage } = useLanguageStore();
  const { showWorkVolumes, setShowWorkVolumes } = useAppSettings();
  const { user, isInTelegram } = useTelegram();
  const { toast } = useToast();
  const t = translations[language].settings;

  const fullName =
    [user?.first_name, user?.last_name].filter(Boolean).join(" ") ||
    (language === "ru" ? "Пользователь" : "User");

  const userSubtitle = user?.username
    ? `@${user.username}`
    : isInTelegram
      ? "Telegram"
      : language === "ru"
        ? "Dev режим"
        : "Dev mode";

  const handleSignOut = () => {
    toast({
      title: language === "ru" ? "Функция недоступна" : "Not available",
      description:
        language === "ru"
          ? "Выход из аккаунта будет добавлен позже"
          : "Sign out will be added later",
    });
  };

  return (
    <div className="flex flex-col min-h-screen bg-muted/30">
      <Header title={t.title} showBack={false} showSearch={false} />

      <div className="flex-1 pb-24">
        {/* Профиль */}
        <div className="mx-4 my-4 bg-card border border-border/60 rounded-2xl p-4">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 rounded-full bg-primary flex items-center justify-center shrink-0">
              <span className="text-[22px] font-bold text-primary-foreground">
                {user?.first_name?.[0] ?? "U"}
              </span>
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-semibold text-[17px] leading-tight truncate">
                {fullName}
              </p>
              <p className="text-[13px] text-muted-foreground mt-0.5 truncate">
                {userSubtitle}
              </p>
            </div>
            <div className="w-2.5 h-2.5 rounded-full bg-green-500 shrink-0" />
          </div>
        </div>

        {/* Секция: Язык */}
        <div className="px-4 pt-2 pb-1">
          <p className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">
            {language === "ru" ? "ЯЗЫК ИНТЕРФЕЙСА" : "INTERFACE LANGUAGE"}
          </p>
        </div>
        <div className="mx-4 bg-card border border-border/60 rounded-2xl p-1">
          <div className="flex bg-muted rounded-xl p-1 gap-1">
            <button
              type="button"
              onClick={() => setLanguage("ru")}
              className={cn(
                "flex-1 py-2 text-[14px] font-medium rounded-lg transition-colors",
                language === "ru"
                  ? "bg-background text-foreground shadow-sm"
                  : "text-muted-foreground"
              )}
            >
              Русский
            </button>
            <button
              type="button"
              onClick={() => setLanguage("en")}
              className={cn(
                "flex-1 py-2 text-[14px] font-medium rounded-lg transition-colors",
                language === "en"
                  ? "bg-background text-foreground shadow-sm"
                  : "text-muted-foreground"
              )}
            >
              English
            </button>
          </div>
        </div>

        {/* Секция: Журнал работ */}
        <div className="px-4 pt-4 pb-1">
          <p className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">
            {language === "ru" ? "ЖУРНАЛ РАБОТ" : "WORK LOG"}
          </p>
        </div>
        <div className="mx-4 bg-card border border-border/60 rounded-2xl divide-y divide-border/40">
          <div className="flex items-center justify-between px-4 py-3.5 gap-4">
            <div className="flex-1 min-w-0">
              <p className="text-[15px]">{t.showWorkVolumes}</p>
              <p className="text-[12px] text-muted-foreground mt-0.5 leading-snug">
                {t.showWorkVolumesHint}
              </p>
            </div>
            <Switch
              id="show-work-volumes"
              checked={showWorkVolumes}
              onCheckedChange={setShowWorkVolumes}
            />
          </div>
        </div>

        {/* Секция: О приложении */}
        <div className="px-4 pt-4 pb-1">
          <p className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">
            {language === "ru" ? "О ПРИЛОЖЕНИИ" : "ABOUT"}
          </p>
        </div>
        <div className="mx-4 bg-card border border-border/60 rounded-2xl divide-y divide-border/40">
          <div className="flex items-center justify-between px-4 py-3.5">
            <p className="text-[15px]">{language === "ru" ? "Версия" : "Version"}</p>
            <p className="text-[14px] text-muted-foreground">1.0.0</p>
          </div>
          <div className="flex items-center justify-between px-4 py-3.5">
            <p className="text-[15px]">Telegram MiniApp</p>
            <div className="flex items-center gap-1">
              <span className="text-[13px] text-muted-foreground">
                {isInTelegram
                  ? language === "ru"
                    ? "Активно"
                    : "Active"
                  : language === "ru"
                    ? "Dev режим"
                    : "Dev mode"}
              </span>
              <ChevronRight className="h-4 w-4 text-muted-foreground/50" />
            </div>
          </div>
        </div>

        {/* Admin Panel link — visible only in dev; in prod requires server-side admin check */}
        {import.meta.env.DEV && (
          <>
            <div className="px-4 pt-4 pb-1">
              <p className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">
                {language === "ru" ? "АДМИНИСТРИРОВАНИЕ" : "ADMINISTRATION"}
              </p>
            </div>
            <div className="mx-4 bg-card border border-border/60 rounded-2xl">
              <Link href="/admin">
                <a className="flex items-center justify-between px-4 py-3.5 cursor-pointer">
                  <div className="flex items-center gap-3">
                    <Shield className="h-5 w-5 text-primary" />
                    <p className="text-[15px]">
                      {language === "ru" ? "Панель администратора" : "Admin Panel"}
                    </p>
                  </div>
                  <ChevronRight className="h-4 w-4 text-muted-foreground/50" />
                </a>
              </Link>
            </div>
          </>
        )}

        {/* Кнопка выхода */}
        <div className="px-4 pt-4 pb-8">
          <button
            type="button"
            className="w-full bg-card border border-destructive/30 rounded-2xl py-3.5 text-[15px] font-medium text-destructive text-center"
            onClick={handleSignOut}
          >
            {language === "ru" ? "Выйти из аккаунта" : "Sign out"}
          </button>
        </div>
      </div>

      <BottomNav />
    </div>
  );
}
