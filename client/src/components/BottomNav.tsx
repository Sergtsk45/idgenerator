import { Link, useLocation } from "wouter";
import { FileText, Mic, ListTodo, Settings, ClipboardList } from "lucide-react";
import { cn } from "@/lib/utils";
import { useLanguageStore, translations } from "@/lib/i18n";

export function BottomNav() {
  const [location] = useLocation();
  const { language } = useLanguageStore();
  const t = translations[language].nav;

  const navItems = [
    { href: "/", icon: Mic, label: t.home },
    { href: "/works", icon: ListTodo, label: t.works },
    { href: "/worklog", icon: ClipboardList, label: t.worklog },
    { href: "/acts", icon: FileText, label: t.acts },
    { href: "/settings", icon: Settings, label: t.settings },
  ];

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 bg-background/80 backdrop-blur-lg border-t border-border/50 pb-safe">
      <div className="flex justify-around items-center h-16 max-w-md mx-auto px-2">
        {navItems.map(({ href, icon: Icon, label }) => {
          const isActive = location === href;
          return (
            <Link key={href} href={href} className="flex-1">
              <div
                className={cn(
                  "flex flex-col items-center justify-center h-full w-full py-2 gap-1 transition-all duration-200 cursor-pointer",
                  isActive 
                    ? "text-primary scale-105" 
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                <div className={cn(
                  "p-1.5 rounded-xl transition-colors",
                  isActive && "bg-primary/10"
                )}>
                  <Icon size={24} strokeWidth={isActive ? 2.5 : 2} />
                </div>
                <span className="text-[10px] font-medium">{label}</span>
              </div>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
