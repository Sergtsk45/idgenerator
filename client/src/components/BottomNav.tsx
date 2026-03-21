/**
 * @file: BottomNav.tsx
 * @description: Нижняя навигация приложения — 5 вкладок по дизайн-референсу (ВОР, График, Акты, ЖР, Исходные).
 *   Mobile-only компонент: скрыт на md+ через md:hidden.
 * @dependencies: wouter, lucide-react, @/lib/i18n, @/lib/utils
 * @created: 2026-02-23
 * @updated: 2026-03-13
 */

import { Link, useLocation } from "wouter";
import { cn } from "@/lib/utils";
import { useLanguageStore, translations } from "@/lib/i18n";
import {
  getNavigationItemsForSurface,
  getNavigationLabel,
  isNavigationItemActive,
  type NavigationLabels,
} from "@/lib/navigation";

export function BottomNav() {
  const [location] = useLocation();
  const { language } = useLanguageStore();
  const t: NavigationLabels = translations[language].nav;
  const navItems = getNavigationItemsForSurface("bottomNavMobile", { groups: "primary" });

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 border-t border-border/50 bg-background pb-safe md:hidden">
      <div className="flex justify-around items-stretch h-16 max-w-md mx-auto">
        {navItems.map((item) => {
          const isActive = isNavigationItemActive(item, location);
          const label = getNavigationLabel(item, t);
          const Icon = item.icon;

          if (!Icon) {
            return null;
          }

          return (
            <Link key={item.id} href={item.href} className="flex-1">
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
