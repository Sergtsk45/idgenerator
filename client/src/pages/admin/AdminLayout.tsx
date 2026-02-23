/**
 * @file: AdminLayout.tsx
 * @description: Layout панели администратора с боковой навигацией
 * @dependencies: wouter, lucide-react, shadcn/ui
 * @created: 2026-02-23
 */

import { Link, useLocation } from "wouter";
import { Shield, Users, BarChart3, MessageSquare, Package, ChevronLeft } from "lucide-react";
import { cn } from "@/lib/utils";

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

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Top bar */}
      <header className="border-b bg-card px-4 py-3 flex items-center gap-3 sticky top-0 z-10">
        <a href="/" className="text-muted-foreground hover:text-foreground transition-colors">
          <ChevronLeft className="h-5 w-5" />
        </a>
        <Shield className="h-5 w-5 text-primary" />
        <span className="font-semibold text-sm">Admin Panel</span>
        <span className="text-muted-foreground mx-1">/</span>
        <span className="text-sm text-muted-foreground">{title}</span>
      </header>

      <div className="flex flex-1">
        {/* Sidebar */}
        <nav className="w-56 border-r bg-card/50 flex flex-col gap-1 p-3 shrink-0 hidden sm:flex">
          {NAV_ITEMS.map((item) => {
            const active = item.exact ? location === item.href : location.startsWith(item.href);
            return (
              <Link key={item.href} href={item.href}>
                <a
                  className={cn(
                    "flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm transition-colors",
                    active
                      ? "bg-primary/10 text-primary font-medium"
                      : "text-muted-foreground hover:bg-accent hover:text-foreground"
                  )}
                >
                  <item.icon className="h-4 w-4 shrink-0" />
                  {item.label}
                </a>
              </Link>
            );
          })}
        </nav>

        {/* Mobile bottom nav */}
        <div className="sm:hidden fixed bottom-0 left-0 right-0 border-t bg-card z-10 flex">
          {NAV_ITEMS.map((item) => {
            const active = item.exact ? location === item.href : location.startsWith(item.href);
            return (
              <Link key={item.href} href={item.href}>
                <a
                  className={cn(
                    "flex flex-1 flex-col items-center gap-0.5 py-2 text-[10px]",
                    active ? "text-primary" : "text-muted-foreground"
                  )}
                >
                  <item.icon className="h-5 w-5" />
                  {item.label.split(" ")[0]}
                </a>
              </Link>
            );
          })}
        </div>

        {/* Main content */}
        <main className="flex-1 p-4 sm:p-6 pb-20 sm:pb-6 overflow-auto">
          {children}
        </main>
      </div>
    </div>
  );
}
