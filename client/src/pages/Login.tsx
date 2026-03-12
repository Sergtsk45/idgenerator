/**
 * @file: Login.tsx
 * @description: Страница входа в систему (email/пароль или Telegram автологин)
 * @dependencies: Header, use-auth, use-toast, wouter, useTelegram
 * @created: 2026-03-01
 */

import { useState, useEffect } from "react";
import { useLocation, Link } from "wouter";
import { Header } from "@/components/Header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { useLanguageStore } from "@/lib/i18n";
import { useAuth } from "@/hooks/use-auth";
import { useTelegram } from "@/hooks/useTelegram";
import { Loader2 } from "lucide-react";

const DEV_DEFAULT_LOGIN_EMAIL = "admin@admin.com";
const DEV_DEFAULT_LOGIN_PASSWORD = "12345678";

export default function Login() {
  const { language } = useLanguageStore();
  const { toast } = useToast();
  const [, navigate] = useLocation();
  const { login, isLoading, isAuthenticated } = useAuth();
  const { isInTelegram, initData } = useTelegram();

  const [email, setEmail] = useState(import.meta.env.DEV ? DEV_DEFAULT_LOGIN_EMAIL : "");
  const [password, setPassword] = useState(import.meta.env.DEV ? DEV_DEFAULT_LOGIN_PASSWORD : "");
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Редирект после успешной аутентификации
  useEffect(() => {
    if (isAuthenticated) {
      const params = new URLSearchParams(window.location.search);
      const redirect = params.get('redirect') || '/';
      navigate(redirect);
    }
  }, [isAuthenticated, navigate]);

  // Правая информационная панель (общая для обоих состояний)
  const InfoPanel = () => (
    <div
      className="hidden lg:flex lg:flex-1 items-center justify-center bg-primary/5 border-l border-border/40 p-12"
      data-testid="auth-info-panel"
    >
      <div className="max-w-md text-center space-y-6">
        <div className="text-5xl font-bold text-primary">📋</div>
        <h2 className="text-2xl font-bold">ЖурналРабот</h2>
        <p className="text-muted-foreground leading-relaxed">
          {language === "ru"
            ? "Цифровой общий журнал работ для строительства. Записывайте работы голосом, получайте готовые акты АОСР."
            : "Digital construction worklog. Record works by voice, get ready AOSR acts."}
        </p>
        <ul className="text-left space-y-3">
          {[
            language === "ru" ? "Голосовой ввод работ с AI-распознаванием" : "Voice input with AI recognition",
            language === "ru" ? "Автоматическое формирование АОСР" : "Automatic AOSR generation",
            language === "ru" ? "График работ (диаграмма Ганта)" : "Work schedule (Gantt chart)",
            language === "ru" ? "Интеграция с Telegram" : "Telegram integration",
          ].map((feature, i) => (
            <li key={i} className="flex items-start gap-2 text-sm text-muted-foreground">
              <span className="text-primary mt-0.5">✓</span>
              <span>{feature}</span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );

  // Автологин через Telegram (показываем загрузку)
  if (isInTelegram && initData && !isAuthenticated) {
    return (
      <div className="flex min-h-screen bg-muted/30">
        {/* Левая колонка — состояние загрузки */}
        <div className="flex flex-1 flex-col items-center justify-center px-4 py-8 lg:flex-none lg:w-1/2 xl:w-2/5">
          <Header
            title={language === "ru" ? "Вход" : "Login"}
            showBack={false}
            showSearch={false}
          />
          <div className="flex-1 flex items-center justify-center">
            <div className="text-center space-y-4">
              <Loader2 className="h-8 w-8 animate-spin mx-auto text-primary" />
              <p className="text-[15px] text-muted-foreground">
                {language === "ru" ? "Вход через Telegram..." : "Logging in via Telegram..."}
              </p>
            </div>
          </div>
        </div>
        <InfoPanel />
      </div>
    );
  }

  const validateEmail = (email: string): boolean => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Валидация
    if (!email.trim()) {
      toast({
        title: language === "ru" ? "Введите email" : "Enter email",
        variant: "destructive",
      });
      return;
    }

    if (!validateEmail(email)) {
      toast({
        title: language === "ru" ? "Неверный формат email" : "Invalid email format",
        variant: "destructive",
      });
      return;
    }

    if (!password) {
      toast({
        title: language === "ru" ? "Введите пароль" : "Enter password",
        variant: "destructive",
      });
      return;
    }

    if (password.length < 8) {
      toast({
        title: language === "ru" ? "Пароль должен содержать минимум 8 символов" : "Password must be at least 8 characters",
        variant: "destructive",
      });
      return;
    }

    setIsSubmitting(true);
    try {
      await login(email.trim(), password);
      toast({
        title: language === "ru" ? "Вход выполнен" : "Logged in successfully",
      });
    } catch (error) {
      toast({
        title: language === "ru" ? "Ошибка входа" : "Login failed",
        description: error instanceof Error ? error.message : language === "ru" ? "Неверный email или пароль" : "Invalid email or password",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const title = language === "ru" ? "Вход" : "Login";

  return (
    <div className="flex min-h-screen bg-muted/30">
      {/* Левая колонка — форма (всегда видима) */}
      <div className="flex flex-1 flex-col items-center justify-center px-4 py-8 lg:flex-none lg:w-1/2 xl:w-2/5">
        <div className="w-full max-w-md">
          <Header title={title} showBack={false} showSearch={false} />

          <div className="mt-6 bg-card border border-border/60 rounded-2xl p-6 space-y-6">
            <div className="text-center space-y-2">
              <h2 className="text-[24px] font-bold">
                {language === "ru" ? "Добро пожаловать" : "Welcome"}
              </h2>
              <p className="text-[13px] text-muted-foreground">
                {language === "ru"
                  ? "Войдите в систему для продолжения"
                  : "Sign in to continue"}
              </p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <label htmlFor="email" className="text-[12px] font-medium">
                  Email
                </label>
                <Input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder={language === "ru" ? "example@mail.com" : "example@mail.com"}
                  disabled={isSubmitting || isLoading}
                  autoComplete="email"
                />
              </div>

              <div className="space-y-2">
                <label htmlFor="password" className="text-[12px] font-medium">
                  {language === "ru" ? "Пароль" : "Password"}
                </label>
                <Input
                  id="password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder={language === "ru" ? "Минимум 8 символов" : "Minimum 8 characters"}
                  disabled={isSubmitting || isLoading}
                  autoComplete="current-password"
                />
              </div>

              <Button
                type="submit"
                className="w-full"
                disabled={isSubmitting || isLoading}
              >
                {isSubmitting || isLoading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    {language === "ru" ? "Вход..." : "Logging in..."}
                  </>
                ) : (
                  language === "ru" ? "Войти" : "Sign in"
                )}
              </Button>
            </form>

            <div className="text-center">
              <p className="text-[13px] text-muted-foreground">
                {language === "ru" ? "Нет аккаунта? " : "Don't have an account? "}
                <Link href="/register">
                  <a className="text-primary font-medium hover:underline">
                    {language === "ru" ? "Зарегистрироваться" : "Sign up"}
                  </a>
                </Link>
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Правая колонка — info panel (только lg+) */}
      <InfoPanel />
    </div>
  );
}
