/**
 * @file: AdminLayout.tsx
 * @description: Layout панели администратора с боковой навигацией, гамбургером на планшете
 * @dependencies: wouter, lucide-react, shadcn/ui, Sheet
 * @created: 2026-02-23
 */

import { useState } from "react";
import { Link, useLocation } from "wouter";
import { Shield, Users, BarChart3, MessageSquare, Package, ChevronLeft, Menu } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";

const NAV_ITEMS = [
  { href: "/admin", label: "Дашборд", icon: BarChart3, exact: true },
  { href: "/admin/users", label: "Пользователи", icon: Users },
  { href: "/admin/messages", label: "Очередь AI", icon: MessageSquare },
  { href: "/admin/materials", label: "Справочник материалов", icon: Package },
];

interface AdminLayoutProps {
  children: React.ReactNode;
  title: string;
}

export function AdminLayout({ children, title }: AdminLayoutProps) {
  const [location] = useLocation();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const backUrl = location === "/admin" ? "/settings" : "/admin";

  const navItems = NAV_ITEMS.map((item) => {
    const active = item.exact ? location === item.href : location.startsWith(item.href);
    return { ...item, active };
  });

  const sidebarNav = (
    <nav className="flex flex-col gap-1 p-3">
      {navItems.map((item) => (
        <Link key={item.href} href={item.href}>
          <a
            onClick={() => setSidebarOpen(false)}
            className={cn(
              "flex items-center gap-2.5 rounded-lg px-3 py-2.5 text-sm transition-colors min-h-[44px]",
              item.active
                ? "bg-primary/10 text-primary font-medium"
                : "text-muted-foreground hover:bg-accent hover:text-foreground"
            )}
          >
            <item.icon className="h-4 w-4 shrink-0" />
            {item.label}
          </a>
        </Link>
      ))}
    </nav>
  );

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Top bar */}
      <header className="border-b bg-card px-4 py-3 flex items-center gap-3 sticky top-0 z-10">
        <a href={backUrl} className="text-muted-foreground hover:text-foreground transition-colors p-1 -ml-1 min-h-[44px] min-w-[44px] flex items-center justify-center">
          <ChevronLeft className="h-5 w-5" />
        </a>
        {/* Hamburger: shown only on md breakpoint (tablet 768-1023px) */}
        <button
          type="button"
          onClick={() => setSidebarOpen(true)}
          className="hidden md:flex lg:hidden items-center justify-center min-h-[44px] min-w-[44px] text-muted-foreground hover:text-foreground transition-colors"
          aria-label={sidebarOpen ? "Закрыть меню" : "Открыть меню"}
        >
          <Menu className="h-5 w-5" />
        </button>
        <Shield className="h-5 w-5 text-primary" />
        <span className="font-semibold text-sm">Admin Panel</span>
        <span className="text-muted-foreground mx-1">/</span>
        <span className="text-sm text-muted-foreground">{title}</span>
      </header>

      <div className="flex flex-1">
        {/* Desktop sidebar: always visible on lg+ */}
        <aside className="w-56 border-r bg-card/50 shrink-0 hidden lg:flex flex-col">
          {sidebarNav}
        </aside>

        {/* Tablet overlay sidebar via Sheet (md breakpoint only) */}
        <Sheet open={sidebarOpen} onOpenChange={setSidebarOpen}>
          <SheetContent side="left" className="w-64 p-0">
            <SheetHeader className="px-4 py-3 border-b">
              <SheetTitle className="flex items-center gap-2 text-sm font-semibold">
                <Shield className="h-4 w-4 text-primary" />
                Admin Panel
              </SheetTitle>
            </SheetHeader>
            {sidebarNav}
          </SheetContent>
        </Sheet>

        {/* Mobile bottom nav */}
        <div className="md:hidden fixed bottom-0 left-0 right-0 border-t bg-card z-10 flex">
          {navItems.map((item) => (
            <div key={item.href} className="flex-1">
              <Link href={item.href}>
                <a
                  className={cn(
                    "flex flex-col items-center gap-0.5 py-2 text-[10px] w-full min-h-[44px] justify-center",
                    item.active ? "text-primary" : "text-muted-foreground"
                  )}
                >
                  <item.icon className="h-5 w-5" />
                  {item.label.split(" ")[0]}
                </a>
              </Link>
            </div>
          ))}
        </div>

        {/* Main content */}
        <main className="flex-1 p-4 sm:p-6 pb-20 md:pb-6 overflow-auto">
          {children}
        </main>
      </div>
    </div>
  );
}
