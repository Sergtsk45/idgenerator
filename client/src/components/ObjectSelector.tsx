/**
 * @file: ObjectSelector.tsx
 * @description: Компонент выбора текущего объекта строительства (Sheet/dropdown)
 * @dependencies: use-objects, useCurrentObject, shadcn/ui Sheet
 * @created: 2026-03-07
 */

import { useState } from "react";
import { Check, ChevronRight, Loader2, Plus, Search, Settings } from "lucide-react";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { useToast } from "@/hooks/use-toast";
import { useObjects, useSelectObject } from "@/hooks/use-objects";
import { useCurrentObject } from "@/hooks/use-source-data";
import { useTelegramHaptic } from "@/hooks/use-telegram-haptic";
import { useTariff } from "@/hooks/use-tariff";
import { ObjectCreateDialog } from "./ObjectCreateDialog";

interface ObjectSelectorProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function ObjectSelector({ open, onOpenChange }: ObjectSelectorProps) {
  const { toast } = useToast();
  const haptic = useTelegramHaptic();
  const { getQuotaLimit } = useTariff();

  const objectsQuery = useObjects();
  const currentObjectQuery = useCurrentObject();
  const selectObject = useSelectObject();

  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [search, setSearch] = useState("");

  const objects = objectsQuery.data ?? [];
  const currentId = currentObjectQuery.data?.id;
  const quotaLimit = getQuotaLimit("objects");
  const canAddMore = objects.length < quotaLimit;

  const filteredObjects = objects.filter((obj) =>
    !search ||
    obj.title.toLowerCase().includes(search.toLowerCase()) ||
    (obj.address && obj.address.toLowerCase().includes(search.toLowerCase()))
  );

  const handleSelect = async (objectId: number) => {
    if (objectId === currentId) {
      onOpenChange(false);
      return;
    }
    haptic.selectionChanged();
    try {
      await selectObject.mutateAsync(objectId);
      onOpenChange(false);
    } catch (err) {
      toast({
        title: "Ошибка",
        description: err instanceof Error ? err.message : "Не удалось выбрать объект",
        variant: "destructive",
      });
    }
  };

  return (
    <>
      <Sheet open={open} onOpenChange={(v) => { if (!v) setSearch(""); onOpenChange(v); }}>
        <SheetContent side="bottom" className="rounded-t-2xl max-h-[80vh] flex flex-col">
          <SheetHeader className="pb-2">
            <SheetTitle>Выбор объекта</SheetTitle>
          </SheetHeader>

          <div className="relative pb-3">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Поиск объекта..."
              className="pl-9 rounded-xl"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              data-testid="object-selector-search"
            />
          </div>

          <div className="flex-1 overflow-y-auto -mx-6 px-6">
            {objectsQuery.isLoading ? (
              <div className="space-y-3 py-2">
                <Skeleton className="h-14 rounded-xl" />
                <Skeleton className="h-14 rounded-xl" />
              </div>
            ) : (
              <ul className="space-y-2 py-2">
                {filteredObjects.map((obj) => {
                  const isActive = obj.id === currentId;
                  return (
                    <li key={obj.id}>
                      <button
                        type="button"
                        className={`w-full flex items-center gap-3 rounded-xl px-4 py-3 text-left transition-colors ${
                          isActive
                            ? "bg-primary/10 border border-primary/30"
                            : "hover:bg-muted/60 border border-transparent"
                        }`}
                        onClick={() => handleSelect(obj.id)}
                        disabled={selectObject.isPending}
                      >
                        <div className="flex-1 min-w-0">
                          <div className="font-medium truncate">{obj.title}</div>
                          {obj.address && (
                            <div className="text-xs text-muted-foreground truncate mt-0.5">
                              {obj.address}
                            </div>
                          )}
                        </div>
                        {isActive && (
                          <Check className="h-4 w-4 text-primary shrink-0" />
                        )}
                        {selectObject.isPending && !isActive && (
                          <Loader2 className="h-4 w-4 animate-spin shrink-0 text-muted-foreground" />
                        )}
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>

          <div className="pt-3 space-y-2 border-t border-border/50 mt-2">
            {canAddMore && (
              <Button
                variant="outline"
                className="w-full rounded-xl justify-start gap-2"
                onClick={() => setCreateDialogOpen(true)}
              >
                <Plus className="h-4 w-4" />
                Добавить объект
              </Button>
            )}
            <Link href="/objects" onClick={() => onOpenChange(false)}>
              <Button
                variant="ghost"
                className="w-full rounded-xl justify-between gap-2"
              >
                <div className="flex items-center gap-2">
                  <Settings className="h-4 w-4" />
                  Управление объектами
                </div>
                <ChevronRight className="h-4 w-4 text-muted-foreground" />
              </Button>
            </Link>
          </div>
        </SheetContent>
      </Sheet>

      <ObjectCreateDialog
        open={createDialogOpen}
        onOpenChange={(v) => {
          setCreateDialogOpen(v);
          if (!v) onOpenChange(false);
        }}
      />
    </>
  );
}
