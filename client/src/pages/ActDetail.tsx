/**
 * @file: ActDetail.tsx
 * @description: Детальная страница акта (Task 18 placeholder — drill-down от Acts.tsx)
 * @dependencies: use-acts, OdooCard, Badge, ResponsiveShell
 * @created: 2026-03-22
 */
import { useLocation } from "wouter";
import { useAct } from "@/hooks/use-acts";
import { ResponsiveShell } from "@/components/ResponsiveShell";
import { OdooCard } from "@/components/ui/odoo-card";
import { OdooEmptyState } from "@/components/ui/odoo-empty-state";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { FileText, ArrowLeft, Download } from "lucide-react";
import { format } from "date-fns";
import { ru, enUS } from "date-fns/locale";
import { useLanguageStore } from "@/lib/i18n";

interface ActDetailProps {
  params: { id: string };
}

export default function ActDetail({ params }: ActDetailProps) {
  const { language } = useLanguageStore();
  const [, navigate] = useLocation();
  const actId = Number(params.id);
  const { data: act, isLoading } = useAct(actId);

  const statusLabel = (status: string | null | undefined) => {
    if (status === "signed") return language === "ru" ? "принято" : "accepted";
    if (status === "generated") return language === "ru" ? "в работе" : "in progress";
    return language === "ru" ? "черновик" : "draft";
  };

  const statusVariant = (status: string | null | undefined) =>
    status === "signed" ? "success" : status === "generated" ? "info" : "neutral";

  const formatDate = (d: string | null | undefined) => {
    if (!d) return "—";
    return format(new Date(d), "d MMM yyyy", { locale: language === "ru" ? ru : enUS });
  };

  return (
    <ResponsiveShell
      title={language === "ru" ? `Акт №${params.id}` : `Act #${params.id}`}
      onBack={() => navigate("/acts")}
    >
      <div className="flex-1 px-4 py-6 pb-24 w-full max-w-md lg:max-w-4xl mx-auto space-y-4">
        {isLoading ? (
          <OdooCard>
            <div className="p-4 space-y-3">
              <Skeleton className="h-5 w-32" />
              <Skeleton className="h-4 w-48" />
              <Skeleton className="h-4 w-40" />
            </div>
          </OdooCard>
        ) : !act ? (
          <OdooEmptyState
            icon={<FileText />}
            title={language === "ru" ? "Акт не найден" : "Act not found"}
            hint={language === "ru" ? "Возможно, акт был удалён." : "The act may have been deleted."}
          />
        ) : (
          <>
            <OdooCard>
              <div className="p-4 space-y-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <div className="h-10 w-10 rounded-[--o-radius-md] bg-[--p50] flex items-center justify-center text-[--p500] shrink-0">
                      <FileText className="h-5 w-5" />
                    </div>
                    <div>
                      <p className="text-[15px] font-semibold text-[--g900]">
                        {language === "ru" ? "Акт №" : "Act #"}
                        {act.actNumber ?? act.id}
                      </p>
                      <p className="text-[12px] text-[--g500]">
                        {formatDate(act.dateStart)} — {formatDate(act.dateEnd)}
                      </p>
                    </div>
                  </div>
                  <Badge variant={statusVariant(act.status)} className="capitalize shrink-0">
                    {statusLabel(act.status)}
                  </Badge>
                </div>

                {act.location && (
                  <p className="text-[13px] text-[--g600]">
                    <span className="o-overline mr-2">{language === "ru" ? "Место" : "Location"}</span>
                    {act.location}
                  </p>
                )}

                <div className="pt-1 text-[12px] text-[--g500]">
                  {act.worksData?.length || 0} {language === "ru" ? "работ включено" : "work items"}
                </div>
              </div>
            </OdooCard>

            {/* Placeholder для Task 18 — полный detail */}
            <OdooCard>
              <div className="p-4 text-center text-[13px] text-[--g400] py-8">
                {language === "ru"
                  ? "Полная детализация акта — в разработке (Задача 18)"
                  : "Full act details — coming soon (Task 18)"}
              </div>
            </OdooCard>
          </>
        )}
      </div>
    </ResponsiveShell>
  );
}
