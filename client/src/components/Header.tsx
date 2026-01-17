import { useLocation } from "wouter";
import { Menu, Bell, Settings } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useLanguageStore, translations } from "@/lib/i18n";

export function Header({ title }: { title: string }) {
  const [, setLocation] = useLocation();
  const { language } = useLanguageStore();
  const settingsLabel = translations[language].settings.title;

  return (
    <header className="sticky top-0 z-40 w-full bg-background/80 backdrop-blur-md border-b border-border/50">
      <div className="container max-w-md mx-auto flex h-14 items-center justify-between px-4">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" className="-ml-2">
              <Menu className="h-5 w-5" />
              <span className="sr-only">Menu</span>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="w-56">
            <DropdownMenuItem onSelect={() => setLocation("/settings")}>
              <Settings className="h-4 w-4" />
              {settingsLabel}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
        <h1 className="font-display font-bold text-lg">{title}</h1>
        <Button variant="ghost" size="icon" className="-mr-2">
          <Bell className="h-5 w-5" />
          <span className="sr-only">Notifications</span>
        </Button>
      </div>
    </header>
  );
}
