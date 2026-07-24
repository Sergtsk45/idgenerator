/**
 * @file: SourceDocuments.tsx
 * @description: Страница реестра документов качества (/source/documents).
 * @dependencies: hooks/use-documents, components/ui, ResponsiveShell
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
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useToast } from "@/hooks/use-toast";
import { useCreateDocument, useDeleteDocument, useDocuments, useSetDocumentScope, useUpdateDocument } from "@/hooks/use-documents";
import { useCurrentObject } from "@/hooks/use-source-data";
import { ExternalLink, FileText, Globe2, Loader2, Pencil, Plus, Search, Trash2 } from "lucide-react";
import { format } from "date-fns";

const DOC_TYPES = ["certificate", "declaration", "passport", "protocol", "scheme", "other"] as const;
const PAGE_SIZE = 20;
type ViewMode = "project" | "global" | "all";
type DocScope = "project" | "global";
type DocumentForm = {
  docType: string;
  scope: DocScope;
  title: string;
  docNumber: string;
  docDate: string;
  validFrom: string;
  validTo: string;
  fileUrl: string;
};

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

function scopeLabel(scope: string): string {
  return scope === "global" ? "Глобальный" : "Проект";
}

function formatDate(value?: string | null): string {
  if (!value) return "";
  return format(new Date(value), "dd.MM.yyyy");
}

function emptyForm(scope: DocScope): DocumentForm {
  return {
    docType: "certificate",
    scope,
    title: "",
    docNumber: "",
    docDate: "",
    validFrom: "",
    validTo: "",
    fileUrl: "",
  };
}

function formFromDocument(doc: any): DocumentForm {
  return {
    docType: doc.docType ?? "certificate",
    scope: doc.scope === "global" ? "global" : "project",
    title: doc.title ?? "",
    docNumber: doc.docNumber ?? "",
    docDate: doc.docDate ?? "",
    validFrom: doc.validFrom ?? "",
    validTo: doc.validTo ?? "",
    fileUrl: doc.fileUrl ?? "",
  };
}

export default function SourceDocuments() {
  const { toast } = useToast();
  const createDoc = useCreateDocument();
  const updateDoc = useUpdateDocument();
  const deleteDoc = useDeleteDocument();
  const setDocScope = useSetDocumentScope();
  const currentObjectQuery = useCurrentObject();
  const currentObjectTitle = String((currentObjectQuery.data as any)?.title ?? "текущий объект");

  const [search, setSearch] = useState("");
  const [docType, setDocType] = useState<string>("__all__");
  const [viewMode, setViewMode] = useState<ViewMode>("project");
  const [sheetOpen, setSheetOpen] = useState(false);
  const [editingDoc, setEditingDoc] = useState<any | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<any | null>(null);
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);
  const sentinelRef = useRef<HTMLDivElement>(null);

  const docsQuery = useDocuments({
    query: search,
    docType: docType === "__all__" ? undefined : docType,
    viewMode,
  });

  // Reset visible on filter change
  useEffect(() => { setVisibleCount(PAGE_SIZE); }, [docType, viewMode, search]);

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
  }, [docsQuery.data, docType, viewMode, search]);

  const [form, setForm] = useState<DocumentForm>(() => emptyForm("project"));

  const createScope: DocScope = viewMode === "global" ? "global" : "project";

  const openCreate = () => {
    setEditingDoc(null);
    setForm(emptyForm(createScope));
    setSheetOpen(true);
  };

  const openEdit = (doc: any) => {
    setEditingDoc(doc);
    setForm(formFromDocument(doc));
    setSheetOpen(true);
  };

  const submit = async () => {
    try {
      if (editingDoc) {
        await updateDoc.mutateAsync({
          id: Number(editingDoc.id),
          patch: {
            title: form.title || null,
            docNumber: form.docNumber || null,
            docDate: form.docDate || null,
            validFrom: form.validFrom || null,
            validTo: form.validTo || null,
            fileUrl: form.fileUrl || null,
          },
        });
        toast({ title: "Сохранено", description: "Документ обновлен" });
      } else {
        const scope = viewMode === "all" ? form.scope : createScope;
        await createDoc.mutateAsync({
          docType: form.docType as any,
          scope,
          viewMode,
          title: form.title || null,
          docNumber: form.docNumber || null,
          docDate: form.docDate || null,
          validFrom: form.validFrom || null,
          validTo: form.validTo || null,
          meta: {},
          fileUrl: form.fileUrl || null,
        } as any);
        toast({ title: "Создано", description: "Документ добавлен в реестр" });
      }
      setSheetOpen(false);
      setEditingDoc(null);
      setForm(emptyForm(createScope));
    } catch (e) {
      toast({
        title: "Ошибка",
        description: e instanceof Error ? e.message : String(e),
        variant: "destructive",
      });
    }
  };

  const confirmDelete = async () => {
    if (!deleteTarget) return;
    try {
      await deleteDoc.mutateAsync(Number(deleteTarget.id));
      toast({ title: "Удалено", description: "Документ удален из реестра" });
      setDeleteTarget(null);
    } catch (e) {
      toast({
        title: "Не удалось удалить",
        description: e instanceof Error ? e.message : String(e),
        variant: "destructive",
      });
    }
  };

  const makeGlobal = async (doc: any) => {
    try {
      await setDocScope.mutateAsync({ id: Number(doc.id), scope: "global" });
      toast({ title: "Готово", description: "Документ стал глобальным" });
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
  const viewTabs = [
    { value: "project", label: "Проект" },
    { value: "global", label: "Глобальные" },
    { value: "all", label: "Все" },
  ];

  const emptyTitle =
    viewMode === "global"
      ? "Глобальных документов нет"
      : viewMode === "all"
        ? "Документы не найдены"
        : "В проекте нет документов";
  const emptyHint =
    viewMode === "global"
      ? "Добавьте общий документ, чтобы использовать его в любом объекте."
      : viewMode === "all"
        ? "Измените поиск или добавьте документ в проект или глобальный реестр."
        : "Добавьте первый документ качества для текущего объекта.";

  return (
    <ResponsiveShell className="min-h-screen h-[100dvh] bg-background bg-grain" title="Документы качества">

      <div className="flex-1 overflow-hidden flex flex-col lg:flex-row">
        {/* LEFT: document list */}
        <div className="lg:w-[420px] lg:border-r lg:border-[--g200] lg:overflow-y-auto flex-col flex-1 overflow-y-auto px-4 py-4 pb-24 lg:pb-6">

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

          <PillTabs
            tabs={viewTabs}
            activeTab={viewMode}
            onTabChange={(value) => setViewMode(value as ViewMode)}
            className="mb-3"
          />

          <div className="mb-3 text-[11px] text-[--g500] truncate">
            {viewMode === "project" ? `Проект: ${currentObjectTitle}` : viewMode === "global" ? "Глобальные видны во всех объектах" : "Проектные текущего объекта и глобальные"}
          </div>

          {/* 20.2 PillTabs по типу */}
          <PillTabs
            tabs={typeTabs}
            activeTab={docType}
            onTabChange={setDocType}
            className="mb-3"
          />

          {/* 20.5 Empty state / список */}
          {docsQuery.isLoading ? (
            <div className="flex items-center justify-center py-10 text-[--g400]">
              <Loader2 className="h-5 w-5 animate-spin mr-2" />
              Загрузка...
            </div>
          ) : docs.length === 0 ? (
            <OdooEmptyState
              icon={<FileText />}
              title={emptyTitle}
              hint={emptyHint}
              action={
                <Button variant="odoo-primary" size="compact" onClick={openCreate}>
                  <Plus className="h-4 w-4 mr-1.5" />
                  Добавить
                </Button>
              }
            />
          ) : (
            <div className="space-y-2">
              {/* 20.1 OdooCard list */}
              {docs.slice(0, visibleCount).map((d: any) => (
                <OdooCard key={d.id}>
                  <div className="p-3 flex items-start gap-3">
                    <div className="h-9 w-9 rounded-[--o-radius-sm] bg-[--p50] flex items-center justify-center text-[--p500] shrink-0">
                      <FileText className="h-4 w-4" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start gap-2">
                        <p className="text-[13px] font-medium text-[--g900] truncate">
                          {d.title ?? d.docNumber ?? `Документ #${d.id}`}
                        </p>
                        {viewMode === "all" && (
                          <Badge variant={d.scope === "global" ? "info" : "neutral"} className="shrink-0 text-[10px]">
                            {scopeLabel(d.scope)}
                          </Badge>
                        )}
                      </div>
                      <p className="text-[11px] text-[--g500] truncate">
                        {d.docNumber ? `№${d.docNumber}` : ""}
                        {d.docDate ? ` · ${formatDate(d.docDate)}` : ""}
                      </p>
                      {(d.validFrom || d.validTo) && (
                        <p className="text-[11px] text-[--g500] truncate">
                          {d.validFrom ? `с ${formatDate(d.validFrom)}` : ""}
                          {d.validTo ? ` до ${formatDate(d.validTo)}` : ""}
                        </p>
                      )}
                      <div className="mt-2 flex flex-wrap gap-1.5">
                        <Button
                          variant="outline"
                          size="compact"
                          className="h-7 px-2 text-[11px] gap-1"
                          disabled={!d.fileUrl}
                          onClick={() => d.fileUrl && window.open(d.fileUrl, "_blank", "noopener,noreferrer")}
                        >
                          <ExternalLink className="h-3.5 w-3.5" />
                          Открыть
                        </Button>
                        <Button variant="outline" size="compact" className="h-7 px-2 text-[11px] gap-1" onClick={() => openEdit(d)}>
                          <Pencil className="h-3.5 w-3.5" />
                          Редактировать
                        </Button>
                        {d.scope === "project" && (
                          <Button
                            variant="outline"
                            size="compact"
                            className="h-7 px-2 text-[11px] gap-1"
                            disabled={setDocScope.isPending}
                            onClick={() => makeGlobal(d)}
                          >
                            <Globe2 className="h-3.5 w-3.5" />
                            Сделать глобальным
                          </Button>
                        )}
                        <Button variant="outline" size="compact" className="h-7 px-2 text-[11px] gap-1 text-[--danger]" onClick={() => setDeleteTarget(d)}>
                          <Trash2 className="h-3.5 w-3.5" />
                          Удалить
                        </Button>
                      </div>
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
              <Button variant="odoo-primary" onClick={openCreate}>
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
              onClick={openCreate}
            >
              <Plus className="h-6 w-6" />
            </Button>
          </SheetTrigger>
          <SheetContent side="bottom" className="rounded-t-2xl max-h-[85vh] overflow-y-auto">
            <SheetHeader className="pb-4">
              <SheetTitle className="text-left text-[15px]">{editingDoc ? "Редактировать документ" : "Добавить документ"}</SheetTitle>
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

              {!editingDoc && viewMode === "all" && (
                <div className="grid gap-1.5">
                  <Label className="o-overline">Область</Label>
                  <Select value={form.scope} onValueChange={(v) => setForm((p) => ({ ...p, scope: v as DocScope }))}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="project">Проект</SelectItem>
                      <SelectItem value="global">Глобальный</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              )}

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
              <div className="grid grid-cols-2 gap-3">
                <div className="grid gap-1.5">
                  <Label className="o-overline">Действует с</Label>
                  <Input type="date" value={form.validFrom} onChange={(e) => setForm((p) => ({ ...p, validFrom: e.target.value }))} />
                </div>
                <div className="grid gap-1.5">
                  <Label className="o-overline">Действует до</Label>
                  <Input type="date" value={form.validTo} onChange={(e) => setForm((p) => ({ ...p, validTo: e.target.value }))} />
                </div>
              </div>
              <div className="grid gap-1.5">
                <Label className="o-overline">URL файла (опц.)</Label>
                <Input value={form.fileUrl} onChange={(e) => setForm((p) => ({ ...p, fileUrl: e.target.value }))} />
              </div>

              <Button variant="odoo-primary" onClick={submit} disabled={createDoc.isPending || updateDoc.isPending} className="w-full gap-2">
                {createDoc.isPending || updateDoc.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
                {editingDoc ? "Сохранить" : "Создать"}
              </Button>
            </div>
          </SheetContent>
        </Sheet>
      </div>

      <AlertDialog open={Boolean(deleteTarget)} onOpenChange={(open) => { if (!open) setDeleteTarget(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Удалить документ?</AlertDialogTitle>
            <AlertDialogDescription>
              Документ будет скрыт из реестра. Если он используется в актах, удаление будет отклонено.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleteDoc.isPending}>Отмена</AlertDialogCancel>
            <AlertDialogAction
              onClick={(event) => {
                event.preventDefault();
                void confirmDelete();
              }}
              disabled={deleteDoc.isPending}
            >
              {deleteDoc.isPending ? "Удаление..." : "Удалить"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

    </ResponsiveShell>
  );
}
