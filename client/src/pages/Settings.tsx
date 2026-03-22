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
import { OdooCard } from "@/components/ui/odoo-card";
import { PillTabs } from "@/components/ui/pill-tabs";
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
      <div className="space-y-3 p-4">
        {/* 21.1 OdooCard вместо bg-card */}
        <OdooCard>
          <div className="p-4 flex items-center gap-4">
            <div className="w-12 h-12 rounded-[--o-radius-md] bg-[--p500] flex items-center justify-center shrink-0">
              <span className="text-[20px] font-bold text-white">
                {fullName[0]?.toUpperCase() ?? "U"}
              </span>
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-semibold text-[15px] text-[--g900] leading-tight truncate">{fullName}</p>
              <p className="text-[12px] text-[--g500] mt-0.5 truncate">{userSubtitle}</p>
            </div>
            <div className="w-2 h-2 rounded-full bg-[--success] shrink-0" />
          </div>
        </OdooCard>
        {/* 21.2 Odoo-button для выхода */}
        <Button
          variant="odoo-ghost"
          className="w-full text-[--danger] border border-[--danger]/30 hover:bg-[--danger]/5"
          onClick={handleSignOut}
        >
          {language === "ru" ? "Выйти из аккаунта" : "Sign out"}
        </Button>
      </div>
    ),
    security: (
      <div className="space-y-3 p-4">
        {authUser && !authUser.email && (
          <>
            <p className="o-overline">{language === "ru" ? "Безопасность" : "Security"}</p>
            <OdooCard>
              <div className="p-4">
                {!showLinkEmail ? (
                  <button
                    type="button"
                    onClick={() => setShowLinkEmail(true)}
                    className="w-full flex items-center justify-between min-h-[44px]"
                  >
                    <div className="flex items-center gap-3">
                      <Mail className="h-5 w-5 text-[--p500]" />
                      <div className="flex flex-col items-start">
                        <p className="text-[14px] text-[--g900]">{language === "ru" ? "Привязать email" : "Link email"}</p>
                        <p className="text-[12px] text-[--g500]">{language === "ru" ? "Для входа через email и пароль" : "For email and password login"}</p>
                      </div>
                    </div>
                    <ChevronRight className="h-4 w-4 text-[--g400]" />
                  </button>
                ) : (
                  <form onSubmit={handleLinkEmail} className="space-y-3">
                    <div className="space-y-1.5">
                      <label htmlFor="linkEmail" className="o-overline">Email</label>
                      <Input id="linkEmail" type="email" value={linkEmail} onChange={(e) => setLinkEmail(e.target.value)} placeholder="example@mail.com" disabled={isLinking} autoComplete="email" />
                    </div>
                    <div className="space-y-1.5">
                      <label htmlFor="linkPassword" className="o-overline">{language === "ru" ? "Пароль" : "Password"}</label>
                      <Input id="linkPassword" type="password" value={linkPassword} onChange={(e) => setLinkPassword(e.target.value)} placeholder={language === "ru" ? "Минимум 8 символов" : "Minimum 8 characters"} disabled={isLinking} autoComplete="new-password" />
                    </div>
                    <div className="flex gap-2">
                      <Button type="submit" variant="odoo-primary" className="flex-1" disabled={isLinking}>
                        {isLinking ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />{language === "ru" ? "Привязка..." : "Linking..."}</> : language === "ru" ? "Привязать" : "Link"}
                      </Button>
                      <Button type="button" variant="odoo-secondary" onClick={() => { setShowLinkEmail(false); setLinkEmail(""); setLinkPassword(""); }} disabled={isLinking}>
                        {language === "ru" ? "Отмена" : "Cancel"}
                      </Button>
                    </div>
                  </form>
                )}
              </div>
            </OdooCard>
          </>
        )}
        {authUser && authUser.email && (
          <>
            <p className="o-overline">{language === "ru" ? "Безопасность" : "Security"}</p>
            <OdooCard>
              <div className="p-4 flex items-center gap-3">
                <Mail className="h-5 w-5 text-[--p500]" />
                <div>
                  <p className="text-[14px] text-[--g900]">Email</p>
                  <p className="text-[12px] text-[--g500]">{authUser.email}</p>
                </div>
              </div>
            </OdooCard>
          </>
        )}
        <p className="o-overline pt-2">{language === "ru" ? "Доступ в браузере" : "Browser access"}</p>
        <OdooCard hoverable>
          <Link href="/login">
            <a className="flex items-center justify-between px-4 py-3.5 cursor-pointer min-h-[44px]">
              <div className="flex items-center gap-3">
                <KeyRound className="h-5 w-5 text-[--p500]" />
                <div>
                  <p className="text-[14px] text-[--g900]">{language === "ru" ? "Access-token" : "Access token"}</p>
                  <p className="text-[12px] text-[--g500]">
                    {authUser || authToken ? (language === "ru" ? "Выполнен вход" : "Logged in") : (language === "ru" ? "Не выполнен вход" : "Not logged in")}
                  </p>
                </div>
              </div>
              <ChevronRight className="h-4 w-4 text-[--g400]" />
            </a>
          </Link>
        </OdooCard>
      </div>
    ),
    language: (
      <div className="space-y-3 p-4">
        {/* 21.3 overline разделитель */}
        <p className="o-overline">{language === "ru" ? "Язык интерфейса" : "Interface language"}</p>
        {/* 21.2 PillTabs для выбора языка */}
        <PillTabs
          tabs={[
            { value: "ru", label: "Русский" },
            { value: "en", label: "English" },
          ]}
          activeTab={language}
          onTabChange={(v) => setLanguage(v as "ru" | "en")}
        />
      </div>
    ),
    worklog: (
      <div className="space-y-3 p-4">
        <p className="o-overline">{language === "ru" ? "Журнал работ" : "Work log"}</p>
        <OdooCard>
          <div className="p-4 flex items-center justify-between gap-4 min-h-[44px]">
            <div className="flex-1 min-w-0">
              <p className="text-[14px] text-[--g900]">{t.showWorkVolumes}</p>
              <p className="text-[12px] text-[--g500] mt-0.5 leading-snug">{t.showWorkVolumesHint}</p>
            </div>
            {/* 21.4 Switch — оставить shadcn */}
            <Switch id="show-work-volumes" checked={showWorkVolumes} onCheckedChange={setShowWorkVolumes} />
          </div>
        </OdooCard>
      </div>
    ),
    about: (
      <div className="space-y-3 p-4">
        <p className="o-overline">{language === "ru" ? "О приложении" : "About"}</p>
        <OdooCard>
          <div className="divide-y divide-[--g100]">
            <div className="flex items-center justify-between px-4 py-3.5">
              <p className="text-[14px] text-[--g900]">{language === "ru" ? "Версия" : "Version"}</p>
              <p className="text-[13px] text-[--g500] font-mono tabular-nums">1.0.0</p>
            </div>
            <div className="flex items-center justify-between px-4 py-3.5">
              <p className="text-[14px] text-[--g900]">Telegram MiniApp</p>
              <span className="text-[12px] text-[--g500]">
                {isInTelegram ? (language === "ru" ? "Активно" : "Active") : (language === "ru" ? "Dev режим" : "Dev mode")}
              </span>
            </div>
          </div>
        </OdooCard>
      </div>
    ),
    admin: (
      <div className="space-y-3 p-4">
        <p className="o-overline">{language === "ru" ? "Администрирование" : "Administration"}</p>
        <OdooCard hoverable>
          <Link href="/admin">
            <a className="flex items-center justify-between px-4 py-3.5 cursor-pointer min-h-[44px]">
              <div className="flex items-center gap-3">
                <Shield className="h-5 w-5 text-[--p500]" />
                <p className="text-[14px] text-[--g900]">{language === "ru" ? "Панель администратора" : "Admin Panel"}</p>
              </div>
              <ChevronRight className="h-4 w-4 text-[--g400]" />
            </a>
          </Link>
        </OdooCard>
      </div>
    ),
  };

  const mobileContent = (
    <div className="flex-1 pb-24">
      {sectionContent.profile}
      {authUser && sectionContent.security}
      {sectionContent.language}
      {sectionContent.worklog}
      {sectionContent.about}
      {authUser?.role === "admin" && sectionContent.admin}
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
        {/* Left sidebar nav — Odoo-style */}
        <aside className="w-56 shrink-0 border-r border-[--g200] bg-white flex flex-col gap-0.5 p-3 sticky top-0 self-start">
          <p className="o-overline px-3 pb-2">{language === "ru" ? "Настройки" : "Settings"}</p>
          {NAV_ITEMS.map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => setActiveSection(item.id)}
              className={cn(
                "flex items-center gap-2.5 rounded-[--o-radius-sm] px-3 py-2.5 text-[13px] transition-colors text-left min-h-[44px]",
                activeSection === item.id
                  ? "bg-[--p50] text-[--p700] font-semibold"
                  : "text-[--g700] hover:bg-[--g100]"
              )}
            >
              <item.icon className="h-4 w-4 shrink-0" strokeWidth={1.5} />
              {item.label}
            </button>
          ))}
          <div className="mt-auto pt-3 border-t border-[--g100]">
            <button
              type="button"
              onClick={handleSignOut}
              className="w-full text-left px-3 py-2.5 rounded-[--o-radius-sm] text-[13px] text-[--danger] hover:bg-[--danger]/5 transition-colors min-h-[44px]"
            >
              {language === "ru" ? "Выйти" : "Sign out"}
            </button>
          </div>
        </aside>

        {/* Right scrollable content */}
        <main className="flex-1 overflow-y-auto pb-8 bg-[--g50]">
          {sectionContent[activeSection]}
        </main>
      </div>

    </ResponsiveShell>
  );
}
