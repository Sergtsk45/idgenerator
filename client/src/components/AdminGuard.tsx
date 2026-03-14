/**
 * @file: AdminGuard.tsx
 * @description: RBAC-guard для admin-маршрутов — проверяет роль пользователя
 * @dependencies: use-auth, AuthGuard, AccessDenied
 * @created: 2026-03-14
 */

import { Link } from "wouter";
import { Loader2 } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { AuthGuard } from "@/components/AuthGuard";
import { Button } from "@/components/ui/button";

interface AdminGuardProps {
  children: React.ReactNode;
}

function AccessDenied() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <div className="text-center max-w-sm">
        <div className="text-6xl mb-4">🔒</div>
        <h1 className="text-2xl font-bold mb-2">Доступ запрещён</h1>
        <p className="text-muted-foreground mb-6 text-sm">
          У вас нет прав для просмотра этой страницы. Требуется роль администратора.
        </p>
        <Link href="/settings">
          <Button>Настройки</Button>
        </Link>
      </div>
    </div>
  );
}

function AdminRoleCheck({ children }: AdminGuardProps) {
  const { user: authUser, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div className="flex flex-col min-h-screen items-center justify-center bg-muted/30">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (authUser?.role !== "admin") {
    return <AccessDenied />;
  }

  return <>{children}</>;
}

/**
 * RBAC guard for admin routes.
 * Wraps AuthGuard (authentication check) then verifies admin role.
 */
export function AdminGuard({ children }: AdminGuardProps) {
  return (
    <AuthGuard>
      <AdminRoleCheck>{children}</AdminRoleCheck>
    </AuthGuard>
  );
}
