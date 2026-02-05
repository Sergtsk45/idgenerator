/**
 * @file: TaskMaterialsEditor.tsx
 * @description: Редактор списка материалов, привязанных к задаче графика (для п.3 АОСР и приложений).
 * @dependencies: shadcn/ui, hooks/use-task-materials (используется на странице графика)
 * @created: 2026-02-05
 */

import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export type TaskMaterialEditorItem = {
  projectMaterialId: number;
  batchId?: number | null;
  qualityDocumentId?: number | null;
  note?: string | null;
};

export type ProjectMaterialOption = {
  id: number;
  label: string;
};

export function TaskMaterialsEditor(props: {
  items: TaskMaterialEditorItem[];
  projectMaterials: ProjectMaterialOption[];
  onChange: (items: TaskMaterialEditorItem[]) => void;
  disabled?: boolean;
}) {
  const { items, projectMaterials, onChange, disabled } = props;
  const [newProjectMaterialId, setNewProjectMaterialId] = useState<string>("");
  const [newBatchId, setNewBatchId] = useState<string>("");
  const [newQualityDocumentId, setNewQualityDocumentId] = useState<string>("");
  const [newNote, setNewNote] = useState<string>("");

  const materialLabelById = useMemo(() => {
    const m = new Map<number, string>();
    projectMaterials.forEach((p) => m.set(p.id, p.label));
    return m;
  }, [projectMaterials]);

  const addItem = () => {
    const pmId = Number(newProjectMaterialId);
    if (!Number.isFinite(pmId) || pmId <= 0) return;
    const batchId = newBatchId.trim() ? Number(newBatchId) : null;
    const qualityDocumentId = newQualityDocumentId.trim() ? Number(newQualityDocumentId) : null;

    onChange([
      ...items,
      {
        projectMaterialId: pmId,
        batchId: Number.isFinite(batchId as any) && (batchId as any) > 0 ? (batchId as any) : null,
        qualityDocumentId:
          Number.isFinite(qualityDocumentId as any) && (qualityDocumentId as any) > 0 ? (qualityDocumentId as any) : null,
        note: newNote.trim() ? newNote.trim() : null,
      },
    ]);

    setNewProjectMaterialId("");
    setNewBatchId("");
    setNewQualityDocumentId("");
    setNewNote("");
  };

  const removeItem = (idx: number) => {
    const next = items.slice();
    next.splice(idx, 1);
    onChange(next);
  };

  const setNote = (idx: number, note: string) => {
    const next = items.slice();
    next[idx] = { ...next[idx], note: note.trim() ? note : null };
    onChange(next);
  };

  return (
    <div className="space-y-3">
      <div className="space-y-2">
        {items.length === 0 ? (
          <div className="text-sm text-muted-foreground">Материалы не выбраны</div>
        ) : (
          items.map((it, idx) => (
            <div key={`${it.projectMaterialId}-${idx}`} className="rounded-md border p-3 space-y-2">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="font-medium truncate">
                    {materialLabelById.get(it.projectMaterialId) ?? `Материал #${it.projectMaterialId}`}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    batchId: {it.batchId ?? "—"} • docId: {it.qualityDocumentId ?? "—"}
                  </div>
                </div>
                <Button type="button" variant="outline" size="sm" disabled={disabled} onClick={() => removeItem(idx)}>
                  Удалить
                </Button>
              </div>

              <div className="space-y-1">
                <Label className="text-xs">Примечание</Label>
                <Input
                  value={it.note ?? ""}
                  disabled={disabled}
                  onChange={(e) => setNote(idx, e.target.value)}
                  placeholder="например: применено на участке 1-2 оси А-Б"
                />
              </div>
            </div>
          ))
        )}
      </div>

      <div className="rounded-md border p-3 space-y-3">
        <div className="text-sm font-medium">Добавить материал</div>

        <div className="grid grid-cols-1 gap-3">
          <div className="space-y-1">
            <Label className="text-xs">Материал</Label>
            <Select value={newProjectMaterialId} onValueChange={setNewProjectMaterialId} disabled={disabled}>
              <SelectTrigger>
                <SelectValue placeholder="Выбрать материал" />
              </SelectTrigger>
              <SelectContent>
                {projectMaterials.map((m) => (
                  <SelectItem key={m.id} value={String(m.id)}>
                    {m.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label className="text-xs">ID партии (опц.)</Label>
              <Input
                type="number"
                value={newBatchId}
                disabled={disabled}
                onChange={(e) => setNewBatchId(e.target.value)}
                placeholder="например: 12"
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">ID документа (опц.)</Label>
              <Input
                type="number"
                value={newQualityDocumentId}
                disabled={disabled}
                onChange={(e) => setNewQualityDocumentId(e.target.value)}
                placeholder="например: 34"
              />
            </div>
          </div>

          <div className="space-y-1">
            <Label className="text-xs">Примечание (опц.)</Label>
            <Input value={newNote} disabled={disabled} onChange={(e) => setNewNote(e.target.value)} />
          </div>
        </div>

        <Button type="button" onClick={addItem} disabled={disabled || !newProjectMaterialId}>
          Добавить
        </Button>
      </div>
    </div>
  );
}

