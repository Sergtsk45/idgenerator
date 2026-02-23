/**
 * @file: Header.tsx
 * @description: Вариативный хедер приложения с hamburger-меню (Sheet), кнопкой назад, subtitle, быстрой ссылкой на чат (молния), поиском и аватаром
 * @dependencies: lucide-react, @/components/ui/avatar, @/components/ui/button, @/components/ui/sheet, wouter
 * @created: 2026-02-23
 * @updated: 2026-02-23
 */

import { ArrowLeft, Menu, Search, Zap } from "lucide-react";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";

interface HeaderProps {
  title: string;
  subtitle?: string;
  showBack?: boolean;
  onBack?: () => void;
  showSearch?: boolean;
  showAvatar?: boolean;
  showZapLink?: boolean;
  rightAction?: React.ReactNode;
}

export function Header({
  title,
  subtitle,
  showBack = false,
  onBack,
  showSearch = true,
  showAvatar = false,
  showZapLink = true,
  rightAction,
}: HeaderProps) {
  return (
    <header className="sticky top-0 z-40 bg-background border-b border-border/50">
      <div className="max-w-md mx-auto flex h-14 items-center justify-between px-4">
        <LeftSlot showBack={showBack} onBack={onBack} />

        <div className="flex flex-col items-center flex-1 min-w-0 px-2">
          <h1 className="font-semibold text-[17px] leading-tight truncate">{title}</h1>
          {subtitle && (
            <p className="text-[10px] uppercase tracking-widest text-muted-foreground leading-none mt-0.5 truncate">
              {subtitle}
            </p>
          )}
        </div>

        <RightSlot
          rightAction={rightAction}
          showSearch={showSearch}
          showAvatar={showAvatar}
          showZapLink={showZapLink && !showBack}
        />
      </div>
    </header>
  );
}

function LeftSlot({
  showBack,
  onBack,
}: Pick<HeaderProps, "showBack" | "onBack">) {
  if (showBack) {
    return (
      <Button variant="ghost" size="icon" className="-ml-2 shrink-0" onClick={onBack}>
        <ArrowLeft className="h-5 w-5" />
        <span className="sr-only">Назад</span>
      </Button>
    );
  }

  return (
    <Sheet>
      <SheetTrigger asChild>
        <Button variant="ghost" size="icon" className="-ml-2 shrink-0">
          <Menu className="h-5 w-5" />
          <span className="sr-only">Меню</span>
        </Button>
      </SheetTrigger>
      <SheetContent side="left" className="w-64">
        <SheetHeader>
          <SheetTitle>Навигация</SheetTitle>
        </SheetHeader>
        <nav className="mt-6 flex flex-col gap-1">
          <Link href="/settings">
            <Button variant="ghost" className="w-full justify-start">
              Настройки
            </Button>
          </Link>
          <Link href="/">
            <Button variant="ghost" className="w-full justify-start">
              Журнал работ (чат)
            </Button>
          </Link>
        </nav>
      </SheetContent>
    </Sheet>
  );
}

function RightSlot({
  rightAction,
  showSearch,
  showAvatar,
  showZapLink,
}: Pick<HeaderProps, "rightAction" | "showSearch" | "showAvatar" | "showZapLink">) {
  if (rightAction !== undefined) {
    return <div className="shrink-0">{rightAction}</div>;
  }

  return (
    <div className="flex items-center gap-1 shrink-0">
      {showZapLink && (
        <Link href="/">
          <div className="w-9 h-9 rounded-full bg-primary flex items-center justify-center cursor-pointer">
            <Zap className="h-5 w-5 text-primary-foreground" fill="currentColor" />
          </div>
        </Link>
      )}
      {showSearch && (
        <Button variant="ghost" size="icon" className="-mr-1">
          <Search className="h-5 w-5" />
          <span className="sr-only">Поиск</span>
        </Button>
      )}
      {showAvatar && (
        <div className="relative ml-1">
          <Avatar className="w-8 h-8">
            <AvatarFallback className="text-xs">S</AvatarFallback>
          </Avatar>
          <span className="absolute bottom-0 right-0 w-2.5 h-2.5 bg-green-500 rounded-full border-2 border-background" />
        </div>
      )}
    </div>
  );
}
