/**
 * @file: SourceDocuments.tsx
 * @description: Страница реестра документов качества (/source/documents).
 * @dependencies: hooks/use-documents, components/documents/DocumentCard
 * @created: 2026-02-01
 */

import { useMemo, useState } from "react";
import { BottomNav } from "@/components/BottomNav";
import { Header } from "@/components/Header";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { useCreateDocument, useDocuments } from "@/hooks/use-documents";
import { DocumentCard } from "@/components/documents/DocumentCard";
import { FileText, Loader2, Plus, Search } from "lucide-react";

export default function SourceDocuments() {
  const { toast } = useToast();
  const createDoc = useCreateDocument();

  const [search, setSearch] = useState("");
  const [docType, setDocType] = useState<string>("");
  const [scope, setScope] = useState<string>("");
  const [dialogOpen, setDialogOpen] = useState(false);

  const docsQuery = useDocuments({ query: search, docType: docType || undefined, scope: scope || undefined });

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
      setDialogOpen(false);
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

  return (
    <div className="flex flex-col min-h-screen h-[100dvh] bg-background bg-grain">
      <Header title="Документы качества" />

      <div className="flex-1 overflow-hidden px-4 py-6 pb-24">
        <div className="mb-3 sticky top-14 z-30 bg-background/95 backdrop-blur py-2 space-y-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Поиск по документам..."
              className="pl-9 rounded-xl bg-secondary/50 border-transparent focus:bg-background transition-all"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>

          <div className="grid grid-cols-2 gap-2">
            <Select value={docType} onValueChange={setDocType}>
              <SelectTrigger className="rounded-xl">
                <SelectValue placeholder="Тип" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="">Все</SelectItem>
                <SelectItem value="certificate">certificate</SelectItem>
                <SelectItem value="declaration">declaration</SelectItem>
                <SelectItem value="passport">passport</SelectItem>
                <SelectItem value="protocol">protocol</SelectItem>
                <SelectItem value="scheme">scheme</SelectItem>
                <SelectItem value="other">other</SelectItem>
              </SelectContent>
            </Select>

            <Select value={scope} onValueChange={setScope}>
              <SelectTrigger className="rounded-xl">
                <SelectValue placeholder="Scope" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="">Все</SelectItem>
                <SelectItem value="project">project</SelectItem>
                <SelectItem value="global">global</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        {docsQuery.isLoading ? (
          <div className="flex items-center justify-center py-10 text-muted-foreground">
            <Loader2 className="h-5 w-5 animate-spin mr-2" />
            Загрузка...
          </div>
        ) : (
          <ScrollArea className="h-full">
            <div className="space-y-3 pr-2">
              {docs.length === 0 ? (
                <div className="py-12 text-center text-muted-foreground">
                  <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-muted/50">
                    <FileText className="h-8 w-8 text-muted-foreground/60" />
                  </div>
                  <div className="mb-3">Документы не найдены</div>
                  <Button onClick={() => setDialogOpen(true)} className="rounded-xl">
                    <Plus className="h-4 w-4 mr-2" />
                    Добавить документ
                  </Button>
                </div>
              ) : (
                docs.map((d) => (
                  <DocumentCard
                    key={d.id}
                    doc={{
                      id: Number(d.id),
                      docType: String(d.docType ?? ""),
                      scope: String(d.scope ?? ""),
                      title: d.title ?? null,
                      docNumber: d.docNumber ?? null,
                      docDate: d.docDate ?? null,
                      fileUrl: d.fileUrl ?? null,
                    }}
                    onOpen={d.fileUrl ? () => window.open(d.fileUrl, "_blank") : undefined}
                  />
                ))
              )}
            </div>
          </ScrollArea>
        )}
      </div>

      <div className="fixed bottom-20 right-4 z-40 md:right-[max(1rem,calc(50vw-220px))]">
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button
              size="icon"
              className="h-14 w-14 rounded-full shadow-xl bg-primary hover:bg-primary/90 transition-transform hover:scale-105 active:scale-95"
            >
              <Plus className="h-6 w-6" />
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-md rounded-2xl">
            <DialogHeader>
              <DialogTitle>Добавить документ</DialogTitle>
            </DialogHeader>

            <div className="space-y-4 py-2">
              <div className="grid gap-2">
                <Label>Тип</Label>
                <Select value={form.docType} onValueChange={(v) => setForm((p) => ({ ...p, docType: v }))}>
                  <SelectTrigger className="rounded-xl">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="certificate">certificate</SelectItem>
                    <SelectItem value="declaration">declaration</SelectItem>
                    <SelectItem value="passport">passport</SelectItem>
                    <SelectItem value="protocol">protocol</SelectItem>
                    <SelectItem value="scheme">scheme</SelectItem>
                    <SelectItem value="other">other</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="grid gap-2">
                <Label>Scope</Label>
                <Select value={form.scope} onValueChange={(v) => setForm((p) => ({ ...p, scope: v }))}>
                  <SelectTrigger className="rounded-xl">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="project">project</SelectItem>
                    <SelectItem value="global">global</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="grid gap-2">
                <Label>Название (опц.)</Label>
                <Input value={form.title} onChange={(e) => setForm((p) => ({ ...p, title: e.target.value }))} className="rounded-xl" />
              </div>
              <div className="grid gap-2">
                <Label>Номер</Label>
                <Input
                  value={form.docNumber}
                  onChange={(e) => setForm((p) => ({ ...p, docNumber: e.target.value }))}
                  className="rounded-xl"
                />
              </div>
              <div className="grid gap-2">
                <Label>Дата</Label>
                <Input
                  type="date"
                  value={form.docDate}
                  onChange={(e) => setForm((p) => ({ ...p, docDate: e.target.value }))}
                  className="rounded-xl"
                />
              </div>
              <div className="grid gap-2">
                <Label>URL файла (опц.)</Label>
                <Input
                  value={form.fileUrl}
                  onChange={(e) => setForm((p) => ({ ...p, fileUrl: e.target.value }))}
                  className="rounded-xl"
                />
              </div>
            </div>

            <Button onClick={submit} disabled={createDoc.isPending} className="w-full rounded-xl h-12 gap-2">
              {createDoc.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
              Создать
            </Button>
          </DialogContent>
        </Dialog>
      </div>

      <BottomNav />
    </div>
  );
}

