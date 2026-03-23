/**
 * @file: not-found.tsx
 * @description: Tablet-adaptive 404 страница
 * @dependencies: wouter, Button
 * @created: 2026-03-14
 */

import { Link } from "wouter";
import { Button } from "@/components/ui/button";

export default function NotFound() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <div className="text-center max-w-sm w-full">
        <p className="text-8xl font-bold text-muted-foreground/30 mb-4 leading-none">404</p>
        <h1 className="text-2xl font-bold text-foreground mb-2">Страница не найдена</h1>
        <p className="text-muted-foreground text-sm mb-8">
          Страница, которую вы ищете, не существует или была удалена.
        </p>
        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <Link href="/">
            <Button className="w-full sm:w-auto">На главную</Button>
          </Link>
          <Button
            variant="outline"
            className="w-full sm:w-auto"
            onClick={() => window.history.back()}
          >
            Назад
          </Button>
        </div>
      </div>
    </div>
  );
}
