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
    <nav className="fixed bottom-0 left-0 right-0 z-50 bg-white border-t border-[--g200] shadow-[0_-1px_3px_rgba(0,0,0,0.05)] pb-safe lg:hidden">
      <div className="flex justify-around items-stretch h-14 max-w-md mx-auto">
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
                  "flex flex-col items-center justify-center h-full w-full gap-1 transition-colors duration-[--duration-fast] cursor-pointer",
                  isActive ? "text-[--p700]" : "text-[--g500]"
                )}
              >
                <Icon size={22} strokeWidth={isActive ? 2 : 1.5} />
                <span className={cn("text-[10px] leading-none", isActive ? "font-semibold" : "font-medium")}>
                  {label}
                </span>
              </div>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
