import { Link } from "wouter";
import { Menu, Bell } from "lucide-react";
import { Button } from "@/components/ui/button";

export function Header({ title }: { title: string }) {
  return (
    <header className="sticky top-0 z-40 w-full bg-background/80 backdrop-blur-md border-b border-border/50">
      <div className="container max-w-md mx-auto flex h-14 items-center justify-between px-4">
        <Button variant="ghost" size="icon" className="-ml-2">
          <Menu className="h-5 w-5" />
          <span className="sr-only">Menu</span>
        </Button>
        <h1 className="font-display font-bold text-lg">{title}</h1>
        <Button variant="ghost" size="icon" className="-mr-2">
          <Bell className="h-5 w-5" />
          <span className="sr-only">Notifications</span>
        </Button>
      </div>
    </header>
  );
}
