/**
 * @file: Objects.tsx
 * @description: Страница управления объектами строительства (список, создание, удаление)
 * @dependencies: use-objects, useCurrentObject, Header, BottomNav
 * @created: 2026-03-07
 */

import { useState } from "react";
import { Check, Loader2, MapPin, Pencil, Plus, Search, Trash2 } from "lucide-react";
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
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { ResponsiveShell } from "@/components/ResponsiveShell";
import { ObjectCreateDialog } from "@/components/ObjectCreateDialog";
import { useToast } from "@/hooks/use-toast";
import { useObjects, useDeleteObject, useSelectObject, useUpdateObject } from "@/hooks/use-objects";
import { useCurrentObject } from "@/hooks/use-source-data";
import { useTelegramHaptic } from "@/hooks/use-telegram-haptic";

interface EditDialogState {
  open: boolean;
  objectId: number;
  title: string;
  address: string;
  city: string;
}

export function Objects() {
  const { toast } = useToast();
  const haptic = useTelegramHaptic();

  const objectsQuery = useObjects();
  const currentObjectQuery = useCurrentObject();
  const deleteObject = useDeleteObject();
  const selectObject = useSelectObject();
  const updateObject = useUpdateObject();

  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [deleteConfirmId, setDeleteConfirmId] = useState<number | null>(null);
  const [search, setSearch] = useState("");
  const [editState, setEditState] = useState<EditDialogState>({
    open: false,
    objectId: 0,
    title: "",
    address: "",
    city: "",
  });

  const objects = objectsQuery.data ?? [];
  const currentId = currentObjectQuery.data?.id;

  const filteredObjects = objects.filter((obj) =>
    !search ||
    obj.title.toLowerCase().includes(search.toLowerCase()) ||
    (obj.address && obj.address.toLowerCase().includes(search.toLowerCase()))
  );

  const handleSelect = async (objectId: number) => {
    if (objectId === currentId) return;
    haptic.selectionChanged();
    try {
      await selectObject.mutateAsync(objectId);
      toast({ title: "Объект выбран" });
    } catch (err) {
      toast({
        title: "Ошибка",
        description: err instanceof Error ? err.message : "Не удалось выбрать объект",
        variant: "destructive",
      });
    }
  };

  const handleDelete = async () => {
    if (deleteConfirmId == null) return;
    try {
      await deleteObject.mutateAsync(deleteConfirmId);
      toast({ title: "Объект удалён" });
    } catch (err) {
      toast({
        title: "Ошибка",
        description: err instanceof Error ? err.message : "Не удалось удалить объект",
        variant: "destructive",
      });
    } finally {
      setDeleteConfirmId(null);
    }
  };

  const openEdit = (obj: { id: number; title: string; address: string | null; city: string | null }) => {
    setEditState({
      open: true,
      objectId: obj.id,
      title: obj.title,
      address: obj.address ?? "",
      city: obj.city ?? "",
    });
  };

  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editState.title.trim()) return;
    try {
      await updateObject.mutateAsync({
        objectId: editState.objectId,
        data: {
          title: editState.title.trim(),
          address: editState.address.trim() || null,
          city: editState.city.trim() || null,
        },
      });
      toast({ title: "Объект обновлён" });
      setEditState((p) => ({ ...p, open: false }));
    } catch (err) {
      toast({
        title: "Ошибка",
        description: err instanceof Error ? err.message : "Не удалось обновить объект",
        variant: "destructive",
      });
    }
  };

  return (
    <ResponsiveShell
      className="min-h-screen h-[100dvh] bg-background"
      title="Мои объекты"
      showSearch={false}
    >

      <div className="flex-1 overflow-y-auto pb-24">
        <div className="max-w-md lg:max-w-4xl mx-auto px-4 pt-4">
          <div className="flex items-center justify-between mb-4">
            <p className="text-sm text-muted-foreground">
              {objects.length > 0
                ? `${objects.length} ${objects.length === 1 ? "объект" : objects.length < 5 ? "объекта" : "объектов"}`
                : ""}
            </p>
            <Button
              size="sm"
              className="rounded-xl gap-2"
              onClick={() => setCreateDialogOpen(true)}
            >
              <Plus className="h-4 w-4" />
              Новый объект
            </Button>
          </div>

          {objects.length > 3 && (
            <div className="relative mb-4">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Поиск объекта..."
                className="pl-9 rounded-xl"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
          )}

          {objectsQuery.isLoading ? (
            <div className="space-y-3">
              <Skeleton className="h-24 rounded-xl" />
              <Skeleton className="h-24 rounded-xl" />
            </div>
          ) : objects.length === 0 ? (
            <div className="text-center py-16 text-muted-foreground">
              <p className="text-base mb-2">Нет объектов</p>
              <p className="text-sm">Создайте первый объект строительства</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-3" data-testid="objects-grid">
              {filteredObjects.map((obj) => {
                const isActive = obj.id === currentId;
                return (
                  <Card
                    key={obj.id}
                    className={`rounded-xl transition-colors ${isActive ? "border-primary/40 bg-primary/5" : ""}`}
                  >
                    <CardContent className="p-4">
                      <div className="flex items-start gap-3">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-medium truncate">{obj.title}</span>
                            {isActive && (
                              <Badge variant="secondary" className="text-xs shrink-0 gap-1">
                                <Check className="h-3 w-3" />
                                Текущий
                              </Badge>
                            )}
                          </div>
                          {(obj.city || obj.address) && (
                            <div className="flex items-center gap-1 mt-1 text-xs text-muted-foreground">
                              <MapPin className="h-3 w-3 shrink-0" />
                              <span className="truncate">
                                {[obj.city, obj.address].filter(Boolean).join(", ")}
                              </span>
                            </div>
                          )}
                        </div>
                      </div>

                      <div className="flex gap-2 mt-3">
                        {!isActive && (
                          <Button
                            variant="outline"
                            size="sm"
                            className="rounded-xl flex-1"
                            onClick={() => handleSelect(obj.id)}
                            disabled={selectObject.isPending}
                          >
                            {selectObject.isPending ? (
                              <Loader2 className="h-3 w-3 animate-spin mr-1" />
                            ) : null}
                            Выбрать
                          </Button>
                        )}
                        <Button
                          variant="outline"
                          size="sm"
                          className="rounded-xl gap-1"
                          onClick={() => openEdit(obj)}
                        >
                          <Pencil className="h-3 w-3" />
                          Изм.
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          className="rounded-xl gap-1 text-destructive hover:text-destructive"
                          onClick={() => setDeleteConfirmId(obj.id)}
                          disabled={objects.length === 1}
                          title={objects.length === 1 ? "Нельзя удалить единственный объект" : undefined}
                        >
                          <Trash2 className="h-3 w-3" />
                          Удалить
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </div>
      </div>

      <ObjectCreateDialog open={createDialogOpen} onOpenChange={setCreateDialogOpen} />

      <Dialog open={editState.open} onOpenChange={(v) => setEditState((p) => ({ ...p, open: v }))}>
        <DialogContent className="sm:max-w-md rounded-2xl">
          <DialogHeader>
            <DialogTitle>Редактировать объект</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleUpdate} className="space-y-4 py-2">
            <div className="grid gap-2">
              <Label htmlFor="edit-title">Название *</Label>
              <Input
                id="edit-title"
                value={editState.title}
                onChange={(e) => setEditState((p) => ({ ...p, title: e.target.value }))}
                className="rounded-xl"
                required
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="edit-city">Город</Label>
              <Input
                id="edit-city"
                value={editState.city}
                onChange={(e) => setEditState((p) => ({ ...p, city: e.target.value }))}
                className="rounded-xl"
                placeholder="Москва"
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="edit-address">Адрес</Label>
              <Input
                id="edit-address"
                value={editState.address}
                onChange={(e) => setEditState((p) => ({ ...p, address: e.target.value }))}
                className="rounded-xl"
                placeholder="Адрес объекта"
              />
            </div>
            <div className="flex gap-2 pt-2">
              <Button
                type="button"
                variant="outline"
                className="flex-1 rounded-xl"
                onClick={() => setEditState((p) => ({ ...p, open: false }))}
              >
                Отмена
              </Button>
              <Button
                type="submit"
                className="flex-1 rounded-xl"
                disabled={updateObject.isPending || !editState.title.trim()}
              >
                {updateObject.isPending && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
                Сохранить
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      <AlertDialog open={deleteConfirmId != null} onOpenChange={(v) => !v && setDeleteConfirmId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Удалить объект?</AlertDialogTitle>
            <AlertDialogDescription>
              Все данные объекта будут удалены без возможности восстановления.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Отмена</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive hover:bg-destructive/90"
              onClick={handleDelete}
              disabled={deleteObject.isPending}
            >
              {deleteObject.isPending && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
              Удалить
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

    </ResponsiveShell>
  );
}

export default Objects;
