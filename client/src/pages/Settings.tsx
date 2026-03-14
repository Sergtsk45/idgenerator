/**
 * @file: Settings.tsx
 * @description: Страница настроек приложения в стиле iOS/Android Settings, с двухколоночным layout на lg+
 * @dependencies: useLanguageStore, useAppSettings, useTelegram, Header, BottomNav, Switch, useToast
 * @created: 2026-02-23
 */

import { cn } from "@/lib/utils";
import { ChevronRight, KeyRound, Shield, Mail, User, Lock, Globe, BookOpen, Info } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { Link } from "wouter";
import { useToast } from "@/hooks/use-toast";
import { useTelegram } from "@/hooks/useTelegram";
import { useLanguageStore, translations } from "@/lib/i18n";
import { useAppSettings } from "@/lib/app-settings";
import { ResponsiveShell } from "@/components/ResponsiveShell";
import { getAuthToken } from "@/lib/auth";
import { useAuth } from "@/hooks/use-auth";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Loader2 } from "lucide-react";

export default function Settings() {
  const { language, setLanguage } = useLanguageStore();
  const { showWorkVolumes, setShowWorkVolumes } = useAppSettings();
  const { user: telegramUser, isInTelegram } = useTelegram();
  const { user: authUser, logout } = useAuth();
  const { toast } = useToast();
  const t = translations[language].settings;
  const authToken = getAuthToken();

  type Section = "profile" | "security" | "language" | "worklog" | "about" | "admin";
  const [activeSection, setActiveSection] = useState<Section>("profile");
  const [showLinkEmail, setShowLinkEmail] = useState(false);
  const [linkEmail, setLinkEmail] = useState("");
  const [linkPassword, setLinkPassword] = useState("");
  const [isLinking, setIsLinking] = useState(false);

  const fullName = authUser 
    ? authUser.displayName
    : [telegramUser?.first_name, telegramUser?.last_name].filter(Boolean).join(" ") ||
      (language === "ru" ? "Пользователь" : "User");

  const userSubtitle = authUser?.email
    ? authUser.email
    : telegramUser?.username
      ? `@${telegramUser.username}`
      : isInTelegram
        ? "Telegram"
        : language === "ru"
          ? "Dev режим"
          : "Dev mode";

  const handleSignOut = () => {
    logout();
    toast({
      title: language === "ru" ? "Выход выполнен" : "Signed out",
    });
  };

  const handleLinkEmail = async (e: React.FormEvent) => {
    e.preventDefault();

    // Валидация
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(linkEmail)) {
      toast({
        title: language === "ru" ? "Неверный формат email" : "Invalid email format",
        variant: "destructive",
      });
      return;
    }

    if (linkPassword.length < 8) {
      toast({
        title: language === "ru" ? "Пароль должен содержать минимум 8 символов" : "Password must be at least 8 characters",
        variant: "destructive",
      });
      return;
    }

    setIsLinking(true);
    try {
      const res = await fetch('/api/auth/link-email', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${getAuthToken()}`,
        },
        body: JSON.stringify({
          email: linkEmail,
          password: linkPassword,
        }),
        credentials: 'include',
      });

      if (!res.ok) {
        const error = await res.json().catch(() => ({ error: 'Failed to link email' }));
        throw new Error(error.error || 'Failed to link email');
      }
      
      toast({
        title: language === "ru" ? "Email привязан" : "Email linked",
        description: language === "ru" ? "Теперь вы можете входить через email" : "You can now sign in with email",
      });
      setShowLinkEmail(false);
      setLinkEmail("");
      setLinkPassword("");
      
      // Обновить данные пользователя
      window.location.reload();
    } catch (error) {
      toast({
        title: language === "ru" ? "Ошибка" : "Error",
        description: error instanceof Error ? error.message : language === "ru" ? "Не удалось привязать email" : "Failed to link email",
        variant: "destructive",
      });
    } finally {
      setIsLinking(false);
    }
  };

  const NAV_ITEMS: { id: Section; label: string; icon: React.ElementType; show?: boolean }[] = [
    { id: "profile", label: language === "ru" ? "Профиль" : "Profile", icon: User },
    { id: "security", label: language === "ru" ? "Безопасность" : "Security", icon: Lock, show: !!authUser },
    { id: "language", label: language === "ru" ? "Язык" : "Language", icon: Globe },
    { id: "worklog", label: language === "ru" ? "Журнал работ" : "Work Log", icon: BookOpen },
    { id: "about", label: language === "ru" ? "О приложении" : "About", icon: Info },
    { id: "admin", label: language === "ru" ? "Администрирование" : "Admin", icon: Shield, show: authUser?.role === "admin" },
  ].filter((item) => item.show !== false) as { id: Section; label: string; icon: React.ElementType }[];

  const sectionContent: Record<Section, React.ReactNode> = {
    profile: (
      <div className="space-y-0">
        <div className="mx-4 my-4 bg-card border border-border/60 rounded-2xl p-4">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 rounded-full bg-primary flex items-center justify-center shrink-0">
              <span className="text-[22px] font-bold text-primary-foreground">
                {fullName[0]?.toUpperCase() ?? "U"}
              </span>
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-semibold text-[17px] leading-tight truncate">{fullName}</p>
              <p className="text-[13px] text-muted-foreground mt-0.5 truncate">{userSubtitle}</p>
            </div>
            <div className="w-2.5 h-2.5 rounded-full bg-green-500 shrink-0" />
          </div>
        </div>
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
    ),
    security: (
      <div className="space-y-0">
        {authUser && !authUser.email && (
          <>
            <div className="px-4 pt-2 pb-1">
              <p className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">
                {language === "ru" ? "БЕЗОПАСНОСТЬ" : "SECURITY"}
              </p>
            </div>
            <div className="mx-4 bg-card border border-border/60 rounded-2xl p-4">
              {!showLinkEmail ? (
                <button
                  type="button"
                  onClick={() => setShowLinkEmail(true)}
                  className="w-full flex items-center justify-between min-h-[44px]"
                >
                  <div className="flex items-center gap-3">
                    <Mail className="h-5 w-5 text-primary" />
                    <div className="flex flex-col items-start">
                      <p className="text-[15px]">
                        {language === "ru" ? "Привязать email" : "Link email"}
                      </p>
                      <p className="text-[12px] text-muted-foreground">
                        {language === "ru" ? "Для входа через email и пароль" : "For email and password login"}
                      </p>
                    </div>
                  </div>
                  <ChevronRight className="h-4 w-4 text-muted-foreground/50" />
                </button>
              ) : (
                <form onSubmit={handleLinkEmail} className="space-y-3">
                  <div className="space-y-2">
                    <label htmlFor="linkEmail" className="text-[12px] font-medium">
                      Email
                    </label>
                    <Input
                      id="linkEmail"
                      type="email"
                      value={linkEmail}
                      onChange={(e) => setLinkEmail(e.target.value)}
                      placeholder="example@mail.com"
                      disabled={isLinking}
                      autoComplete="email"
                    />
                  </div>
                  <div className="space-y-2">
                    <label htmlFor="linkPassword" className="text-[12px] font-medium">
                      {language === "ru" ? "Пароль" : "Password"}
                    </label>
                    <Input
                      id="linkPassword"
                      type="password"
                      value={linkPassword}
                      onChange={(e) => setLinkPassword(e.target.value)}
                      placeholder={language === "ru" ? "Минимум 8 символов" : "Minimum 8 characters"}
                      disabled={isLinking}
                      autoComplete="new-password"
                    />
                  </div>
                  <div className="flex gap-2">
                    <Button type="submit" className="flex-1" disabled={isLinking}>
                      {isLinking ? (
                        <>
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          {language === "ru" ? "Привязка..." : "Linking..."}
                        </>
                      ) : (
                        language === "ru" ? "Привязать" : "Link"
                      )}
                    </Button>
                    <Button
                      type="button"
                      variant="secondary"
                      onClick={() => {
                        setShowLinkEmail(false);
                        setLinkEmail("");
                        setLinkPassword("");
                      }}
                      disabled={isLinking}
                    >
                      {language === "ru" ? "Отмена" : "Cancel"}
                    </Button>
                  </div>
                </form>
              )}
            </div>
          </>
        )}
        {authUser && authUser.email && (
          <>
            <div className="px-4 pt-2 pb-1">
              <p className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">
                {language === "ru" ? "БЕЗОПАСНОСТЬ" : "SECURITY"}
              </p>
            </div>
            <div className="mx-4 bg-card border border-border/60 rounded-2xl divide-y divide-border/40">
              <div className="flex items-center justify-between px-4 py-3.5">
                <div className="flex items-center gap-3">
                  <Mail className="h-5 w-5 text-primary" />
                  <div className="flex flex-col">
                    <p className="text-[15px]">Email</p>
                    <p className="text-[12px] text-muted-foreground">{authUser.email}</p>
                  </div>
                </div>
              </div>
            </div>
          </>
        )}
        <div className="px-4 pt-4 pb-1">
          <p className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">
            {language === "ru" ? "ДОСТУП В БРАУЗЕРЕ" : "BROWSER ACCESS"}
          </p>
        </div>
        <div className="mx-4 bg-card border border-border/60 rounded-2xl">
          <Link href="/login">
            <a className="flex items-center justify-between px-4 py-3.5 cursor-pointer min-h-[44px]">
              <div className="flex items-center gap-3">
                <KeyRound className="h-5 w-5 text-primary" />
                <div className="flex flex-col">
                  <p className="text-[15px]">
                    {language === "ru" ? "Access-token" : "Access token"}
                  </p>
                  <p className="text-[12px] text-muted-foreground">
                    {authUser || authToken
                      ? (language === "ru" ? "Выполнен вход" : "Logged in")
                      : (language === "ru" ? "Не выполнен вход" : "Not logged in")}
                  </p>
                </div>
              </div>
              <ChevronRight className="h-4 w-4 text-muted-foreground/50" />
            </a>
          </Link>
        </div>
      </div>
    ),
    language: (
      <div className="space-y-0">
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
                "flex-1 py-2 text-[14px] font-medium rounded-lg transition-colors min-h-[44px]",
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
                "flex-1 py-2 text-[14px] font-medium rounded-lg transition-colors min-h-[44px]",
                language === "en"
                  ? "bg-background text-foreground shadow-sm"
                  : "text-muted-foreground"
              )}
            >
              English
            </button>
          </div>
        </div>
      </div>
    ),
    worklog: (
      <div className="space-y-0">
        <div className="px-4 pt-4 pb-1">
          <p className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">
            {language === "ru" ? "ЖУРНАЛ РАБОТ" : "WORK LOG"}
          </p>
        </div>
        <div className="mx-4 bg-card border border-border/60 rounded-2xl divide-y divide-border/40">
          <div className="flex items-center justify-between px-4 py-3.5 gap-4 min-h-[44px]">
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
      </div>
    ),
    about: (
      <div className="space-y-0">
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
                  ? language === "ru" ? "Активно" : "Active"
                  : language === "ru" ? "Dev режим" : "Dev mode"}
              </span>
              <ChevronRight className="h-4 w-4 text-muted-foreground/50" />
            </div>
          </div>
        </div>
      </div>
    ),
    admin: (
      <div className="space-y-0">
        <div className="px-4 pt-4 pb-1">
          <p className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">
            {language === "ru" ? "АДМИНИСТРИРОВАНИЕ" : "ADMINISTRATION"}
          </p>
        </div>
        <div className="mx-4 bg-card border border-border/60 rounded-2xl">
          <Link href="/admin">
            <a className="flex items-center justify-between px-4 py-3.5 cursor-pointer min-h-[44px]">
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
      </div>
    ),
  };

  /* Mobile/small-tablet: single scroll (all sections visible)
     Desktop lg+: two-column layout (sidebar nav + scrollable content) */
  const mobileContent = (
    <div className="flex-1 pb-24">
      {sectionContent.profile}
      {authUser && sectionContent.security}
      {sectionContent.language}
      {sectionContent.worklog}
      {sectionContent.about}
      {authUser?.role === "admin" && sectionContent.admin}
      <div className="px-4 pt-4 pb-8 lg:hidden">
        <button
          type="button"
          className="w-full bg-card border border-destructive/30 rounded-2xl py-3.5 text-[15px] font-medium text-destructive text-center"
          onClick={handleSignOut}
        >
          {language === "ru" ? "Выйти из аккаунта" : "Sign out"}
        </button>
      </div>
    </div>
  );

  return (
    <ResponsiveShell className="bg-muted/30" title={t.title} showBack={false} showSearch={false}>

      {/* Mobile / small-tablet: single-scroll layout */}
      <div className="lg:hidden">
        {mobileContent}
      </div>

      {/* Desktop lg+: two-column layout */}
      <div className="hidden lg:flex flex-1 gap-0 min-h-0">
        {/* Left sidebar nav */}
        <aside className="w-64 shrink-0 border-r border-border/60 bg-card/50 flex flex-col gap-1 p-3 sticky top-0 self-start">
          {NAV_ITEMS.map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => setActiveSection(item.id)}
              className={cn(
                "flex items-center gap-2.5 rounded-lg px-3 py-2.5 text-sm transition-colors text-left min-h-[44px]",
                activeSection === item.id
                  ? "bg-primary/10 text-primary font-medium"
                  : "text-muted-foreground hover:bg-accent hover:text-foreground"
              )}
            >
              <item.icon className="h-4 w-4 shrink-0" />
              {item.label}
            </button>
          ))}
          <div className="mt-auto pt-3 border-t border-border/40">
            <button
              type="button"
              onClick={handleSignOut}
              className="w-full text-left px-3 py-2.5 rounded-lg text-sm text-destructive hover:bg-destructive/10 transition-colors min-h-[44px]"
            >
              {language === "ru" ? "Выйти из аккаунта" : "Sign out"}
            </button>
          </div>
        </aside>

        {/* Right scrollable content */}
        <main className="flex-1 overflow-y-auto pb-8">
          {sectionContent[activeSection]}
        </main>
      </div>

    </ResponsiveShell>
  );
}
