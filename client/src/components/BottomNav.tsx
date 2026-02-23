/**
 * @file: BottomNav.tsx
 * @description: Нижняя навигация приложения — 5 вкладок по дизайн-референсу (ВОР, График, Акты, ЖР, Исходные)
 * @dependencies: wouter, lucide-react, @/lib/i18n, @/lib/utils
 * @created: 2026-02-23
 */

import { Link, useLocation } from "wouter";
import { CalendarRange, ClipboardList, FileCheck, FolderOpen, MessageSquare } from "lucide-react";
import { cn } from "@/lib/utils";
import { useLanguageStore, translations } from "@/lib/i18n";

interface NavItem {
  href: string;
  icon: React.ElementType;
  label: string;
}

export function BottomNav() {
  const [location] = useLocation();
  const { language } = useLanguageStore();
  const t = translations[language].nav;

  const navItems: NavItem[] = [
    { href: "/works", icon: ClipboardList, label: t.works },
    { href: "/schedule", icon: CalendarRange, label: t.schedule },
    { href: "/acts", icon: FileCheck, label: t.acts },
    { href: "/worklog", icon: MessageSquare, label: t.worklog },
    { href: "/source-data", icon: FolderOpen, label: t.sourceData },
  ];

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 bg-background border-t border-border/50 pb-safe">
      <div className="flex justify-around items-stretch h-16 max-w-md mx-auto">
        {navItems.map(({ href, icon: Icon, label }) => {
          const isActive = location === href;
          return (
            <Link key={href} href={href} className="flex-1">
              <div
                className={cn(
                  "flex flex-col items-center justify-center h-full w-full gap-1 transition-colors duration-150 cursor-pointer",
                  isActive ? "text-primary" : "text-muted-foreground"
                )}
              >
                <Icon size={22} strokeWidth={isActive ? 2 : 1.5} />
                <span className="text-[10px] font-medium leading-none">{label}</span>
              </div>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
