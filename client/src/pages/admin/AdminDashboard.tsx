/**
 * @file: AdminDashboard.tsx
 * @description: Системный дашборд панели администратора — статистика и обзор
 * @dependencies: use-admin.ts, AdminLayout.tsx, shadcn/ui
 * @created: 2026-02-23
 */

import { AdminLayout } from "./AdminLayout";
import { useAdminStats } from "@/hooks/use-admin";
import { Skeleton } from "@/components/ui/skeleton";
import { Users, Building2, FileText, MessageSquare, CheckCircle2, XCircle, Package } from "lucide-react";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";

interface StatCardProps {
  label: string;
  value: number | undefined;
  icon: React.ElementType;
  description?: string;
  variant?: "default" | "success" | "warning" | "error";
}

function StatCard({ label, value, icon: Icon, description, variant = "default" }: StatCardProps) {
  const colorMap = {
    default: "text-primary bg-primary/10",
    success: "text-green-600 bg-green-100 dark:bg-green-900/30",
    warning: "text-yellow-600 bg-yellow-100 dark:bg-yellow-900/30",
    error: "text-destructive bg-destructive/10",
  };

  return (
    <div className="border rounded-xl p-4 bg-card">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-xs text-muted-foreground mb-1">{label}</p>
          {value === undefined ? (
            <Skeleton className="h-7 w-16" />
          ) : (
            <p className="text-2xl font-bold">{value.toLocaleString("ru-RU")}</p>
          )}
          {description && <p className="text-xs text-muted-foreground mt-1">{description}</p>}
        </div>
        <div className={`p-2 rounded-lg ${colorMap[variant]}`}>
          <Icon className="h-5 w-5" />
        </div>
      </div>
    </div>
  );
}

export default function AdminDashboard() {
  const { data: stats, isLoading } = useAdminStats();

  return (
    <AdminLayout title="Дашборд">
      <div className="max-w-4xl mx-auto space-y-6">
        <div>
          <h2 className="text-lg font-semibold mb-4">Системная статистика</h2>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
            <StatCard
              label="Пользователей"
              value={isLoading ? undefined : stats?.totalUsers}
              icon={Users}
            />
            <StatCard
              label="Объектов"
              value={isLoading ? undefined : stats?.totalObjects}
              icon={Building2}
            />
            <StatCard
              label="Актов АОСР"
              value={isLoading ? undefined : stats?.totalActs}
              icon={FileText}
            />
            <StatCard
              label="Сообщений"
              value={isLoading ? undefined : stats?.totalMessages}
              icon={MessageSquare}
            />
            <StatCard
              label="Обработано AI"
              value={isLoading ? undefined : stats?.processedMessages}
              icon={CheckCircle2}
              variant="success"
            />
            <StatCard
              label="Не обработано"
              value={isLoading ? undefined : stats?.failedMessages}
              icon={XCircle}
              variant={stats?.failedMessages ? "warning" : "default"}
            />
            <StatCard
              label="Материалов в каталоге"
              value={isLoading ? undefined : stats?.totalMaterials}
              icon={Package}
            />
          </div>
        </div>

        {stats?.failedMessages ? (
          <div className="border border-yellow-200 dark:border-yellow-800 bg-yellow-50 dark:bg-yellow-900/20 rounded-xl p-4">
            <div className="flex items-start gap-3">
              <XCircle className="h-5 w-5 text-yellow-600 shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-medium text-yellow-800 dark:text-yellow-200">
                  Есть необработанные сообщения: {stats.failedMessages}
                </p>
                <p className="text-xs text-yellow-700 dark:text-yellow-300 mt-1">
                  AI-нормализация не выполнена для части сообщений. Перейдите в раздел "Очередь AI".
                </p>
                <Link href="/admin/messages">
                  <Button size="sm" variant="outline" className="mt-3 border-yellow-300 dark:border-yellow-700">
                    Открыть очередь AI
                  </Button>
                </Link>
              </div>
            </div>
          </div>
        ) : stats && stats.totalMessages > 0 ? (
          <div className="border border-green-200 dark:border-green-800 bg-green-50 dark:bg-green-900/20 rounded-xl p-4">
            <div className="flex items-center gap-3">
              <CheckCircle2 className="h-5 w-5 text-green-600" />
              <p className="text-sm text-green-800 dark:text-green-200">
                Все сообщения обработаны
              </p>
            </div>
          </div>
        ) : null}

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <Link href="/admin/users">
            <a className="border rounded-xl p-4 bg-card hover:bg-accent transition-colors cursor-pointer block">
              <Users className="h-6 w-6 text-primary mb-2" />
              <p className="font-medium text-sm">Управление пользователями</p>
              <p className="text-xs text-muted-foreground mt-1">
                Блокировка, назначение ролей
              </p>
            </a>
          </Link>
          <Link href="/admin/messages">
            <a className="border rounded-xl p-4 bg-card hover:bg-accent transition-colors cursor-pointer block">
              <MessageSquare className="h-6 w-6 text-primary mb-2" />
              <p className="font-medium text-sm">Очередь AI-обработки</p>
              <p className="text-xs text-muted-foreground mt-1">
                Повторная обработка необработанных сообщений
              </p>
            </a>
          </Link>
          <Link href="/admin/materials">
            <a className="border rounded-xl p-4 bg-card hover:bg-accent transition-colors cursor-pointer block">
              <Package className="h-6 w-6 text-primary mb-2" />
              <p className="font-medium text-sm">Справочник материалов</p>
              <p className="text-xs text-muted-foreground mt-1">
                Глобальный каталог: добавление, редактирование
              </p>
            </a>
          </Link>
        </div>
      </div>
    </AdminLayout>
  );
}
