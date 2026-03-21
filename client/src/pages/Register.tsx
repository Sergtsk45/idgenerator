/**
 * @file: Register.tsx
 * @description: Страница регистрации нового пользователя
 * @dependencies: Header, use-auth, use-toast, wouter
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
import { Loader2 } from "lucide-react";

export default function Register() {
  const { language } = useLanguageStore();
  const { toast } = useToast();
  const [, navigate] = useLocation();
  const { register, isLoading, isAuthenticated } = useAuth();

  const [displayName, setDisplayName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Редирект после успешной регистрации
  useEffect(() => {
    if (isAuthenticated) {
      navigate('/');
    }
  }, [isAuthenticated, navigate]);

  const validateEmail = (email: string): boolean => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Валидация имени
    if (!displayName.trim()) {
      toast({
        title: language === "ru" ? "Введите имя" : "Enter name",
        variant: "destructive",
      });
      return;
    }

    if (displayName.trim().length < 2) {
      toast({
        title: language === "ru" ? "Имя должно содержать минимум 2 символа" : "Name must be at least 2 characters",
        variant: "destructive",
      });
      return;
    }

    // Валидация email
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

    // Валидация пароля
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

    // Валидация подтверждения пароля
    if (password !== confirmPassword) {
      toast({
        title: language === "ru" ? "Пароли не совпадают" : "Passwords do not match",
        variant: "destructive",
      });
      return;
    }

    setIsSubmitting(true);
    try {
      await register(displayName.trim(), email.trim(), password);
      toast({
        title: language === "ru" ? "Регистрация успешна" : "Registration successful",
        description: language === "ru" ? "Добро пожаловать!" : "Welcome!",
      });
    } catch (error) {
      toast({
        title: language === "ru" ? "Ошибка регистрации" : "Registration failed",
        description: error instanceof Error ? error.message : language === "ru" ? "Попробуйте другой email" : "Try another email",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const title = language === "ru" ? "Регистрация" : "Sign up";

  return (
    <div className="flex min-h-screen bg-muted/30">
      {/* Левая колонка — форма (всегда видима) */}
      <div className="flex flex-1 flex-col items-center justify-center px-4 py-8 lg:flex-none lg:w-1/2 xl:w-2/5">
        <div className="w-full max-w-md">
          <Header title={title} showBack showSearch={false} />

          <div className="mt-6 bg-card border border-border/60 rounded-2xl p-6 space-y-6">
            <div className="text-center space-y-2">
              <h2 className="text-[24px] font-bold">
                {language === "ru" ? "Создать аккаунт" : "Create account"}
              </h2>
              <p className="text-[13px] text-muted-foreground">
                {language === "ru"
                  ? "Заполните данные для регистрации"
                  : "Fill in the details to register"}
              </p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <label htmlFor="displayName" className="text-[12px] font-medium">
                  {language === "ru" ? "Имя" : "Name"}
                </label>
                <Input
                  id="displayName"
                  type="text"
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  placeholder={language === "ru" ? "Ваше имя" : "Your name"}
                  disabled={isSubmitting || isLoading}
                  autoComplete="name"
                />
              </div>

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
                  autoComplete="new-password"
                />
              </div>

              <div className="space-y-2">
                <label htmlFor="confirmPassword" className="text-[12px] font-medium">
                  {language === "ru" ? "Подтверждение пароля" : "Confirm password"}
                </label>
                <Input
                  id="confirmPassword"
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder={language === "ru" ? "Повторите пароль" : "Repeat password"}
                  disabled={isSubmitting || isLoading}
                  autoComplete="new-password"
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
                    {language === "ru" ? "Регистрация..." : "Signing up..."}
                  </>
                ) : (
                  language === "ru" ? "Зарегистрироваться" : "Sign up"
                )}
              </Button>
            </form>

            <div className="text-center">
              <p className="text-[13px] text-muted-foreground">
                {language === "ru" ? "Уже есть аккаунт? " : "Already have an account? "}
                <Link href="/login">
                  <a className="text-primary font-medium hover:underline">
                    {language === "ru" ? "Войти" : "Sign in"}
                  </a>
                </Link>
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Правая колонка — info panel (только lg+) */}
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
    </div>
  );
}
