/**
 * @file: AdminMaterials.tsx
 * @description: Управление глобальным справочником материалов в панели администратора
 * @dependencies: use-admin.ts, AdminLayout.tsx, shadcn/ui
 * @created: 2026-02-23
 */

import { useState, useRef } from "react";
import { AdminLayout } from "./AdminLayout";
import {
  useAdminMaterials,
  useAdminCreateMaterial,
  useAdminUpdateMaterial,
  useAdminDeleteMaterial,
  useAdminImportMaterials,
  type CatalogMaterial,
} from "@/hooks/use-admin";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Label } from "@/components/ui/label";
import { Search, Plus, Pencil, Trash2, FileUp } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { parseMaterialsExcel } from "@/lib/materialsParser";

interface MaterialForm {
  name: string;
  unit: string;
  gostTu: string;
  description: string;
}

const EMPTY_FORM: MaterialForm = { name: "", unit: "", gostTu: "", description: "" };

function MaterialDialog({
  open,
  onClose,
  initial,
  onSave,
  isLoading,
}: {
  open: boolean;
  onClose: () => void;
  initial?: MaterialForm;
  onSave: (data: MaterialForm) => Promise<void>;
  isLoading: boolean;
}) {
  const [form, setForm] = useState<MaterialForm>(initial ?? EMPTY_FORM);

  const handleChange = (key: keyof MaterialForm) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm((f) => ({ ...f, [key]: e.target.value }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await onSave(form);
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>{initial ? "Редактировать материал" : "Добавить материал"}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-3">
          <div>
            <Label className="text-xs">Наименование *</Label>
            <Input
              value={form.name}
              onChange={handleChange("name")}
              required
              placeholder="Бетон М300"
            />
          </div>
          <div>
            <Label className="text-xs">Ед. измерения</Label>
            <Input value={form.unit} onChange={handleChange("unit")} placeholder="м³" />
          </div>
          <div>
            <Label className="text-xs">ГОСТ/ТУ</Label>
            <Input value={form.gostTu} onChange={handleChange("gostTu")} placeholder="ГОСТ 26633-2015" />
          </div>
          <div>
            <Label className="text-xs">Описание</Label>
            <Input value={form.description} onChange={handleChange("description")} placeholder="..." />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>
              Отмена
            </Button>
            <Button type="submit" disabled={isLoading || !form.name.trim()}>
              {isLoading ? "Сохранение..." : "Сохранить"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export default function AdminMaterials() {
  const { data: materials, isLoading, error } = useAdminMaterials();
  const createMaterial = useAdminCreateMaterial();
  const updateMaterial = useAdminUpdateMaterial();
  const deleteMaterial = useAdminDeleteMaterial();
  const importMaterials = useAdminImportMaterials();
  const { toast } = useToast();

  const [search, setSearch] = useState("");
  const [createOpen, setCreateOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<CatalogMaterial | null>(null);
  const [isImporting, setIsImporting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const filtered = (materials ?? []).filter(
    (m) =>
      !search ||
      m.name.toLowerCase().includes(search.toLowerCase()) ||
      (m.standardRef ?? "").toLowerCase().includes(search.toLowerCase())
  );

  const handleCreate = async (form: MaterialForm) => {
    try {
      await createMaterial.mutateAsync({
        name: form.name,
        unit: form.unit || undefined,
        gostTu: form.gostTu || undefined,
      });
      toast({ title: "Материал добавлен" });
      setCreateOpen(false);
    } catch (err) {
      toast({ title: "Ошибка создания", description: String(err), variant: "destructive" });
    }
  };

  const handleUpdate = async (form: MaterialForm) => {
    if (!editTarget) return;
    try {
      await updateMaterial.mutateAsync({
        id: editTarget.id,
        name: form.name,
        unit: form.unit || undefined,
        gostTu: form.gostTu || undefined,
      });
      toast({ title: "Материал обновлён" });
      setEditTarget(null);
    } catch (err) {
      toast({ title: "Ошибка обновления", description: String(err), variant: "destructive" });
    }
  };

  const handleDelete = async (id: number) => {
    try {
      await deleteMaterial.mutateAsync(id);
      toast({ title: "Материал удалён" });
    } catch (err) {
      toast({ title: "Ошибка удаления", description: String(err), variant: "destructive" });
    }
  };

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setIsImporting(true);
    try {
      const items = await parseMaterialsExcel(file);

      const result = await importMaterials.mutateAsync({
        mode: "merge",
        items,
      });

      toast({
        title: "Импорт завершён",
        description: `Получено: ${result.received}. Создано: ${result.created}. Обновлено: ${result.updated}. Пропущено: ${result.skipped}.`,
      });
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);

      toast({
        title: "Ошибка импорта",
        description: errorMessage,
        variant: "destructive",
      });
    } finally {
      setIsImporting(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    }
  };

  return (
    <AdminLayout title="Справочник материалов">
      <div className="max-w-3xl mx-auto space-y-4">
        <div className="flex gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Поиск по названию или ГОСТ..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-8"
            />
          </div>
          <input
            ref={fileInputRef}
            type="file"
            accept=".xlsx,.xls"
            onChange={handleFileUpload}
            className="hidden"
          />
          <Button
            variant="outline"
            onClick={() => fileInputRef.current?.click()}
            disabled={isImporting}
          >
            <FileUp className="h-4 w-4 mr-1" />
            {isImporting ? "Импорт..." : "Импорт"}
          </Button>
          <Button onClick={() => setCreateOpen(true)}>
            <Plus className="h-4 w-4 mr-1" />
            Добавить
          </Button>
        </div>

        {isLoading && (
          <div className="space-y-2">
            {[...Array(5)].map((_, i) => <Skeleton key={i} className="h-16 rounded-xl" />)}
          </div>
        )}

        {error && (
          <div className="border border-destructive/30 rounded-xl p-4 text-sm text-destructive">
            Ошибка: {error.message}
          </div>
        )}

        {!isLoading && !error && filtered.length === 0 && (
          <div className="text-center py-12 text-muted-foreground text-sm">
            {search ? "Материалы не найдены" : "Каталог пуст — добавьте первый материал"}
          </div>
        )}

        <div className="space-y-2">
          {filtered.map((m) => (
            <div
              key={m.id}
              className="border rounded-xl px-4 py-3 bg-card flex items-center gap-3"
            >
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">{m.name}</p>
                <div className="flex gap-2 mt-0.5">
                  {m.baseUnit && <span className="text-xs text-muted-foreground">{m.baseUnit}</span>}
                  {m.standardRef && (
                    <span className="text-xs text-muted-foreground">{m.standardRef}</span>
                  )}
                </div>
              </div>
              <div className="flex gap-1 shrink-0">
                <Button
                  size="icon"
                  variant="ghost"
                  className="h-8 w-8"
                  onClick={() => setEditTarget(m)}
                >
                  <Pencil className="h-3.5 w-3.5" />
                </Button>
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button size="icon" variant="ghost" className="h-8 w-8 text-destructive hover:text-destructive">
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Удалить материал?</AlertDialogTitle>
                      <AlertDialogDescription>
                        «{m.name}» будет удалён из глобального каталога. Это действие нельзя отменить.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Отмена</AlertDialogCancel>
                      <AlertDialogAction
                        onClick={() => handleDelete(m.id)}
                        className="bg-destructive hover:bg-destructive/90"
                      >
                        Удалить
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </div>
            </div>
          ))}
        </div>
      </div>

      <MaterialDialog
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        onSave={handleCreate}
        isLoading={createMaterial.isPending}
      />

      {editTarget && (
        <MaterialDialog
          open
          onClose={() => setEditTarget(null)}
          initial={{
            name: editTarget.name,
            unit: editTarget.baseUnit ?? "",
            gostTu: editTarget.standardRef ?? "",
            description: "",
          }}
          onSave={handleUpdate}
          isLoading={updateMaterial.isPending}
        />
      )}
    </AdminLayout>
  );
}
