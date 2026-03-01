/**
 * @file: AuthGuard.tsx
 * @description: Компонент защиты маршрутов, требующих аутентификации
 * @dependencies: use-auth, wouter, Loader2
 * @created: 2026-03-01
 */

import { useEffect } from "react";
import { useLocation } from "wouter";
import { useAuth } from "@/hooks/use-auth";
import { Loader2 } from "lucide-react";

interface AuthGuardProps {
  children: React.ReactNode;
  fallback?: React.ReactNode;
}

/**
 * Компонент для защиты маршрутов, требующих аутентификации.
 * Если пользователь не аутентифицирован, перенаправляет на /login
 */
export function AuthGuard({ children, fallback }: AuthGuardProps) {
  const { isAuthenticated, isLoading } = useAuth();
  const [location, navigate] = useLocation();

  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      const redirect = encodeURIComponent(location);
      navigate(`/login?redirect=${redirect}`);
    }
  }, [isLoading, isAuthenticated, location, navigate]);

  if (isLoading) {
    return (
      fallback || (
        <div className="flex flex-col min-h-screen items-center justify-center bg-muted/30">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      )
    );
  }

  if (!isAuthenticated) {
    return null;
  }

  return <>{children}</>;
}
