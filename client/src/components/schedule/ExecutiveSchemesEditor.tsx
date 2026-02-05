/**
 * @file: ExecutiveSchemesEditor.tsx
 * @description: Редактор списка исполнительных схем (текст + ссылка), привязанных к задаче графика.
 * @dependencies: shadcn/ui
 * @created: 2026-02-05
 */

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export type ExecutiveSchemeItem = { title: string; fileUrl?: string };

export function ExecutiveSchemesEditor(props: {
  items: ExecutiveSchemeItem[];
  onChange: (items: ExecutiveSchemeItem[]) => void;
  disabled?: boolean;
}) {
  const { items, onChange, disabled } = props;

  const add = () => onChange([...(items ?? []), { title: "", fileUrl: "" }]);
  const remove = (idx: number) => {
    const next = (items ?? []).slice();
    next.splice(idx, 1);
    onChange(next);
  };
  const setTitle = (idx: number, v: string) => {
    const next = (items ?? []).slice();
    next[idx] = { ...next[idx], title: v };
    onChange(next);
  };
  const setUrl = (idx: number, v: string) => {
    const next = (items ?? []).slice();
    next[idx] = { ...next[idx], fileUrl: v };
    onChange(next);
  };

  return (
    <div className="space-y-3">
      {items.length === 0 ? <div className="text-sm text-muted-foreground">Схемы не указаны</div> : null}

      <div className="space-y-3">
        {items.map((it, idx) => (
          <div key={idx} className="rounded-md border p-3 space-y-2">
            <div className="flex items-center justify-between gap-3">
              <div className="text-sm font-medium">Схема {idx + 1}</div>
              <Button type="button" size="sm" variant="outline" disabled={disabled} onClick={() => remove(idx)}>
                Удалить
              </Button>
            </div>

            <div className="space-y-1">
              <Label className="text-xs">Название</Label>
              <Input
                value={it.title ?? ""}
                disabled={disabled}
                onChange={(e) => setTitle(idx, e.target.value)}
                placeholder="например: ИС-001 Схема армирования"
              />
            </div>

            <div className="space-y-1">
              <Label className="text-xs">Ссылка на файл (опц.)</Label>
              <Input
                value={it.fileUrl ?? ""}
                disabled={disabled}
                onChange={(e) => setUrl(idx, e.target.value)}
                placeholder="https://..."
              />
            </div>
          </div>
        ))}
      </div>

      <Button type="button" variant="outline" disabled={disabled} onClick={add}>
        + Добавить схему
      </Button>
    </div>
  );
}

