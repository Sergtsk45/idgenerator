/**
 * @file: Schedule.tsx
 * @description: Страница "График работ" (плейсхолдер) и вход в будущий schedule-модуль.
 * @dependencies: client/src/components/Header.tsx, client/src/components/BottomNav.tsx, client/src/lib/i18n.ts
 * @created: 2026-01-17
 */

import { BottomNav } from "@/components/BottomNav";
import { Header } from "@/components/Header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useLanguageStore, translations } from "@/lib/i18n";
import { GanttChartSquare } from "lucide-react";

export default function Schedule() {
  const { language } = useLanguageStore();
  const t = translations[language].schedule;

  return (
    <div className="flex flex-col min-h-screen bg-background bg-grain">
      <Header title={t.title} />

      <div className="flex-1 p-4 pb-24 max-w-md mx-auto w-full">
        <Card className="glass-card">
          <CardHeader className="flex flex-row items-center gap-3">
            <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center text-primary">
              <GanttChartSquare className="h-5 w-5" />
            </div>
            <div className="min-w-0">
              <CardTitle className="text-base">{t.title}</CardTitle>
            </div>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground">
            {t.comingSoon}
          </CardContent>
        </Card>
      </div>

      <BottomNav />
    </div>
  );
}

