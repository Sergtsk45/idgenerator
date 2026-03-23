/**
 * @file: SourceDocuments.tsx
 * @description: Страница реестра документов качества (/source/documents).
 * @dependencies: hooks/use-documents, components/documents/DocumentCard
 * @created: 2026-02-01
 */

import { useMemo, useRef, useState, useEffect } from "react";
import { ResponsiveShell } from "@/components/ResponsiveShell";
import { Button } from "@/components/ui/button";
import { OdooCard } from "@/components/ui/odoo-card";
import { OdooEmptyState } from "@/components/ui/odoo-empty-state";
import { Badge } from "@/components/ui/badge";
import { PillTabs } from "@/components/ui/pill-tabs";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { useCreateDocument, useDocuments } from "@/hooks/use-documents";
import { FileText, Loader2, Plus, Search } from "lucide-react";
import { format } from "date-fns";

const DOC_TYPES = ["certificate", "declaration", "passport", "protocol", "scheme", "other"] as const;
const PAGE_SIZE = 20;

function docTypeBadgeVariant(type: string): "info" | "success" | "neutral" | "warning" {
  if (type === "certificate") return "success";
  if (type === "declaration") return "info";
  if (type === "passport") return "neutral";
  return "neutral";
}

function docTypeLabel(type: string): string {
  const map: Record<string, string> = {
    certificate: "Серт.",
    declaration: "Декл.",
    passport: "Паспорт",
    protocol: "Прот.",
    scheme: "Схема",
    other: "Прочее",
  };
  return map[type] ?? type;
}

export default function SourceDocuments() {
  const { toast } = useToast();
  const createDoc = useCreateDocument();

  const [search, setSearch] = useState("");
  const [docType, setDocType] = useState<string>("__all__");
  const [scope, setScope] = useState<string>("__all__");
  const [sheetOpen, setSheetOpen] = useState(false);
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);
  const sentinelRef = useRef<HTMLDivElement>(null);

  const docsQuery = useDocuments({
    query: search,
    docType: docType === "__all__" ? undefined : docType,
    scope: scope === "__all__" ? undefined : scope,
  });

  // Reset visible on filter change
  useEffect(() => { setVisibleCount(PAGE_SIZE); }, [docType, scope, search]);

  // Infinite scroll
  useEffect(() => {
    const el = sentinelRef.current;
    if (!el) return;
    const obs = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting) setVisibleCount((c) => c + PAGE_SIZE); },
      { rootMargin: "120px" }
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, []);

  const [form, setForm] = useState({
    docType: "certificate",
    scope: "project",
    title: "",
    docNumber: "",
    docDate: "",
    fileUrl: "",
  });

  const submit = async () => {
    try {
      await createDoc.mutateAsync({
        docType: form.docType as any,
        scope: form.scope as any,
        title: form.title || null,
        docNumber: form.docNumber || null,
        docDate: form.docDate || null,
        validFrom: null,
        validTo: null,
        meta: {},
        fileUrl: form.fileUrl || null,
      } as any);
      toast({ title: "Создано", description: "Документ добавлен в реестр" });
      setSheetOpen(false);
      setForm({ docType: "certificate", scope: "project", title: "", docNumber: "", docDate: "", fileUrl: "" });
    } catch (e) {
      toast({
        title: "Ошибка",
        description: e instanceof Error ? e.message : String(e),
        variant: "destructive",
      });
    }
  };

  const docs = useMemo(() => (docsQuery.data ?? []) as any[], [docsQuery.data]);

  const typeTabs = [
    { value: "__all__", label: "Все" },
    ...DOC_TYPES.map((t) => ({ value: t, label: docTypeLabel(t) })),
  ];

  return (
    <ResponsiveShell className="min-h-screen h-[100dvh] bg-background bg-grain" title="Документы качества">

      <div className="flex-1 overflow-hidden flex flex-col lg:flex-row">
        {/* LEFT: document list */}
        <div className="lg:w-[420px] lg:border-r lg:border-[--g200] lg:overflow-y-auto flex-col flex-1 overflow-hidden px-4 py-4 pb-24 lg:pb-6">

          {/* Поиск */}
          <div className="relative mb-3">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[--g400]" />
            <Input
              placeholder="Поиск по документам..."
              className="pl-9 h-10 text-[14px]"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>

          {/* 20.2 PillTabs по типу */}
          <PillTabs
            tabs={typeTabs}
            activeTab={docType}
            onTabChange={setDocType}
            className="mb-3"
          />

          {/* Scope select (compact) */}
          <div className="flex items-center gap-2 mb-3">
            <p className="o-overline shrink-0">Scope:</p>
            <Select value={scope} onValueChange={setScope}>
              <SelectTrigger className="h-8 text-[12px] rounded-full border-[--g300] w-auto min-w-[100px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__all__">Все</SelectItem>
                <SelectItem value="project">project</SelectItem>
                <SelectItem value="global">global</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* 20.5 Empty state / список */}
          {docsQuery.isLoading ? (
            <div className="flex items-center justify-center py-10 text-[--g400]">
              <Loader2 className="h-5 w-5 animate-spin mr-2" />
              Загрузка...
            </div>
          ) : docs.length === 0 ? (
            <OdooEmptyState
              icon={<FileText />}
              title="Документы не найдены"
              hint="Добавьте первый документ качества."
              action={
                <Button variant="odoo-primary" size="compact" onClick={() => setSheetOpen(true)}>
                  <Plus className="h-4 w-4 mr-1.5" />
                  Добавить
                </Button>
              }
            />
          ) : (
            <div className="space-y-2">
              {/* 20.1 OdooCard list */}
              {docs.slice(0, visibleCount).map((d: any) => (
                <OdooCard
                  key={d.id}
                  hoverable={!!d.fileUrl}
                  onClick={d.fileUrl ? () => window.open(d.fileUrl, "_blank") : undefined}
                >
                  <div className="p-3 flex items-center gap-3">
                    <div className="h-9 w-9 rounded-[--o-radius-sm] bg-[--p50] flex items-center justify-center text-[--p500] shrink-0">
                      <FileText className="h-4 w-4" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-[13px] font-medium text-[--g900] truncate">
                        {d.title ?? d.docNumber ?? `Документ #${d.id}`}
                      </p>
                      <p className="text-[11px] text-[--g500]">
                        {d.docNumber ? `№${d.docNumber}` : ""}
                        {d.docDate ? ` · ${format(new Date(d.docDate), "dd.MM.yyyy")}` : ""}
                      </p>
                    </div>
                    <Badge variant={docTypeBadgeVariant(d.docType ?? "")} className="shrink-0 text-[10px]">
                      {docTypeLabel(d.docType ?? "other")}
                    </Badge>
                  </div>
                </OdooCard>
              ))}
              {/* 20.3 Infinite scroll sentinel */}
              {visibleCount < docs.length && (
                <div ref={sentinelRef} className="h-8 flex items-center justify-center">
                  <span className="text-[11px] text-[--g400]">Загрузка...</span>
                </div>
              )}
            </div>
          )}
        </div>

        {/* RIGHT: info panel (lg+ only) */}
        <div className="hidden lg:flex flex-1 flex-col p-8 items-center justify-center" data-testid="documents-import-area">
          <OdooEmptyState
            icon={<FileText />}
            title="Реестр документов качества"
            hint="Добавляйте сертификаты, декларации и другие документы, затем привязывайте их к материалам."
            action={
              <Button variant="odoo-primary" onClick={() => setSheetOpen(true)}>
                <Plus className="h-4 w-4 mr-2" />
                Добавить документ
              </Button>
            }
          />
        </div>
      </div>

      {/* FAB + 20.4 Sheet с формой */}
      <div className="fixed bottom-20 right-4 z-40 md:bottom-6">
        <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
          <SheetTrigger asChild>
            <Button
              variant="odoo-fab"
              size="odoo-fab-size"
              aria-label="Добавить документ"
            >
              <Plus className="h-6 w-6" />
            </Button>
          </SheetTrigger>
          <SheetContent side="bottom" className="rounded-t-2xl max-h-[85vh] overflow-y-auto">
            <SheetHeader className="pb-4">
              <SheetTitle className="text-left text-[15px]">Добавить документ</SheetTitle>
            </SheetHeader>

            <div className="space-y-4 pb-6">
              <div className="grid gap-1.5">
                <Label className="o-overline">Тип</Label>
                <Select value={form.docType} onValueChange={(v) => setForm((p) => ({ ...p, docType: v }))}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {DOC_TYPES.map((t) => (
                      <SelectItem key={t} value={t}>{t}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="grid gap-1.5">
                <Label className="o-overline">Scope</Label>
                <Select value={form.scope} onValueChange={(v) => setForm((p) => ({ ...p, scope: v }))}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="project">project</SelectItem>
                    <SelectItem value="global">global</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="grid gap-1.5">
                <Label className="o-overline">Название (опц.)</Label>
                <Input value={form.title} onChange={(e) => setForm((p) => ({ ...p, title: e.target.value }))} />
              </div>
              <div className="grid gap-1.5">
                <Label className="o-overline">Номер</Label>
                <Input value={form.docNumber} onChange={(e) => setForm((p) => ({ ...p, docNumber: e.target.value }))} />
              </div>
              <div className="grid gap-1.5">
                <Label className="o-overline">Дата</Label>
                <Input type="date" value={form.docDate} onChange={(e) => setForm((p) => ({ ...p, docDate: e.target.value }))} />
              </div>
              <div className="grid gap-1.5">
                <Label className="o-overline">URL файла (опц.)</Label>
                <Input value={form.fileUrl} onChange={(e) => setForm((p) => ({ ...p, fileUrl: e.target.value }))} />
              </div>

              <Button variant="odoo-primary" onClick={submit} disabled={createDoc.isPending} className="w-full gap-2">
                {createDoc.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
                Создать
              </Button>
            </div>
          </SheetContent>
        </Sheet>
      </div>

    </ResponsiveShell>
  );
}

