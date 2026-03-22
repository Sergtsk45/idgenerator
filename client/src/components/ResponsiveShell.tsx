/**
 * @file: ResponsiveShell.tsx
 * @description: Responsive shell wrapper — adapts layout for mobile (sm/md) and tablet/desktop (lg+).
 *   Mobile: standard flex-col with BottomNav space.
 *   lg+: full-width content, no BottomNav padding. Sidebar visible on lg+.
 *   Uses CSS shell tokens (--shell-content-max-width, --shell-content-padding-x/y).
 * @dependencies: Header, BottomNav, @/lib/navigation, @/lib/i18n, wouter
 * @created: 2026-03-10
 * @updated: 2026-03-13
 */

import { type ReactNode } from "react";
import { Link, useLocation } from "wouter";
import { BottomNav } from "@/components/BottomNav";
import { Header } from "@/components/Header";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useLanguageStore, translations } from "@/lib/i18n";
import {
  getNavigationItemsForSurface,
  getNavigationLabel,
  getQuickActionForSurface,
  isNavigationItemActive,
  type NavigationItem,
  type NavigationLabels,
} from "@/lib/navigation";

type HeaderProps = Parameters<typeof Header>[0];

interface ResponsiveShellProps extends HeaderProps {
  children: ReactNode;
  className?: string;
}

export function ResponsiveShell({
  children,
  className,
  ...headerProps
}: ResponsiveShellProps) {
  return (
    <div className={cn("flex min-h-screen flex-col bg-background", className)}>
      <div className="flex min-h-screen flex-1 flex-col lg:flex-row">
        <ShellSidebar />

        <div className="flex min-w-0 flex-1 flex-col">
          <Header {...headerProps} />
          <ShellTopNav />
          {children}
        </div>
      </div>

      <BottomNav />
    </div>
  );
}

function ShellTopNav() {
  const [location] = useLocation();
  const { language } = useLanguageStore();
  const labels: NavigationLabels = translations[language].nav;
  const shellT = translations[language].shell;
  const primaryItems = getNavigationItemsForSurface("shellPrimaryMdUp", { groups: "primary" });
  const secondaryItems = getNavigationItemsForSurface("shellSecondaryMdUp", { groups: "secondary" });
  const quickAction = getQuickActionForSurface("shellQuickActionMdUp");

  return (
    // 22.2 Odoo-style top nav: white bg, border-[--g200]
    <div className="sticky top-14 z-30 hidden border-b border-[--g200] bg-white md:block">
      <div className="flex h-12 items-center gap-3 px-4">
        <nav aria-label={shellT.primaryNavigation} className="min-w-0 flex-1 overflow-x-auto">
          <div className="flex min-w-max items-center gap-1">
            {primaryItems.map((item) => (
              <ShellTextLink
                key={item.id}
                item={item}
                pathname={location}
                label={getNavigationLabel(item, labels)}
              />
            ))}
          </div>
        </nav>

        <div className="hidden items-center gap-1 md:flex lg:hidden">
          {secondaryItems.map((item) => (
            <ShellCompactLink
              key={item.id}
              item={item}
              pathname={location}
              label={getNavigationLabel(item, labels)}
            />
          ))}

          {quickAction ? (
            <ShellCompactLink
              item={quickAction}
              pathname={location}
              label={getNavigationLabel(quickAction, labels)}
            />
          ) : null}
        </div>
      </div>
    </div>
  );
}

function ShellSidebar() {
  const [location] = useLocation();
  const { language } = useLanguageStore();
  const labels: NavigationLabels = translations[language].nav;
  const shellT = translations[language].shell;
  const secondaryItems = getNavigationItemsForSurface("shellSecondaryMdUp", { groups: "secondary" });
  const quickAction = getQuickActionForSurface("shellQuickActionMdUp");

  return (
    // 22.2 Odoo-style sidebar: w-[220px], bg-white, border-[--g200]
    <aside className="hidden w-[220px] shrink-0 border-r border-[--g200] bg-white lg:flex lg:flex-col">
      <div className="sticky top-0 flex h-screen flex-col px-3 py-6">
        <div className="mb-5 px-2">
          <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-[--g500]">
            {shellT.navigation}
          </p>
        </div>

        {quickAction ? (
          <Button
            asChild
            variant={isNavigationItemActive(quickAction, location) ? "odoo-primary" : "odoo-secondary"}
            className="mb-5 h-9 w-full justify-start gap-2.5 px-3"
          >
            <Link href={quickAction.href}>
              {quickAction.icon ? <quickAction.icon className="h-4 w-4" strokeWidth={1.5} /> : null}
              {getNavigationLabel(quickAction, labels)}
            </Link>
          </Button>
        ) : null}

        <nav aria-label={shellT.secondaryNavigation} className="space-y-0.5">
          {secondaryItems.map((item) => (
            <ShellSidebarLink
              key={item.id}
              item={item}
              pathname={location}
              label={getNavigationLabel(item, labels)}
            />
          ))}
        </nav>
      </div>
    </aside>
  );
}

function ShellTextLink({
  item,
  pathname,
  label,
}: {
  item: NavigationItem;
  pathname: string;
  label: string;
}) {
  const isActive = isNavigationItemActive(item, pathname);

  return (
    <Link href={item.href}>
      <a
        className={cn(
          "inline-flex h-8 items-center rounded-[--o-radius-sm] px-3 text-[13px] font-medium transition-colors",
          isActive
            ? "bg-[--p50] text-[--p700] font-semibold"
            : "text-[--g700] hover:bg-[--g100] hover:text-[--g900]"
        )}
      >
        {label}
      </a>
    </Link>
  );
}

function ShellCompactLink({
  item,
  pathname,
  label,
}: {
  item: NavigationItem;
  pathname: string;
  label: string;
}) {
  const isActive = isNavigationItemActive(item, pathname);
  const Icon = item.icon;

  return (
    <Link href={item.href}>
      <a
        className={cn(
          "inline-flex h-8 items-center gap-1.5 rounded-[--o-radius-sm] px-3 text-[13px] font-medium transition-colors",
          isActive
            ? "bg-[--p50] text-[--p700] font-semibold"
            : "text-[--g700] hover:bg-[--g100] hover:text-[--g900]"
        )}
      >
        {Icon ? <Icon className="h-4 w-4" strokeWidth={1.5} /> : null}
        {label}
      </a>
    </Link>
  );
}

function ShellSidebarLink({
  item,
  pathname,
  label,
}: {
  item: NavigationItem;
  pathname: string;
  label: string;
}) {
  const isActive = isNavigationItemActive(item, pathname);
  const Icon = item.icon;

  return (
    <Link href={item.href}>
      <a
        className={cn(
          "flex h-10 w-full items-center gap-2.5 rounded-[--o-radius-sm] px-3 text-[13px] font-medium transition-colors",
          isActive
            ? "bg-[--p50] text-[--p700] font-semibold"
            : "text-[--g700] hover:bg-[--g100] hover:text-[--g900]"
        )}
      >
        {Icon ? <Icon className="h-4 w-4 shrink-0" strokeWidth={1.5} /> : null}
        {label}
      </a>
    </Link>
  );
}
