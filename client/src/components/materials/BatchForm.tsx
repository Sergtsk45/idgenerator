/**
 * @file: BatchForm.tsx
 * @description: Мини-форма партии/поставки для мастера добавления и редактирования партии.
 * @dependencies: components/ui/input, components/ui/label, components/ui/button
 * @created: 2026-02-01
 */

import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { formatIsoToDmy, normalizeDmyInput, parseDmyToIso } from "@/lib/dateFormat";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { CalendarIcon } from "lucide-react";
import { format } from "date-fns";

export type BatchDraft = {
  supplierName?: string;
  plant?: string;
  batchNumber?: string;
  deliveryDate?: string; // YYYY-MM-DD
  quantity?: string; // numeric string
  unit?: string;
  notes?: string;
};

export function BatchForm(props: {
  value: BatchDraft;
  onChange: (next: BatchDraft) => void;
  onSubmit?: () => void;
  submitLabel?: string;
  disabled?: boolean;
}) {
  const v = props.value;
  const set = (patch: Partial<BatchDraft>) => props.onChange({ ...v, ...patch });

  const [deliveryDateText, setDeliveryDateText] = useState<string>(formatIsoToDmy(v.deliveryDate) ?? "");
  const [deliveryCalendarOpen, setDeliveryCalendarOpen] = useState(false);

  const selectedDeliveryDate = useMemo(() => {
    if (!v.deliveryDate) return undefined;
    const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(v.deliveryDate);
    if (!m) return undefined;
    const y = Number(m[1]);
    const mo = Number(m[2]);
    const d = Number(m[3]);
    if (!Number.isFinite(y) || !Number.isFinite(mo) || !Number.isFinite(d)) return undefined;
    // Use noon local time to avoid DST edge cases around midnight
    return new Date(y, mo - 1, d, 12, 0, 0, 0);
  }, [v.deliveryDate]);

  useEffect(() => {
    setDeliveryDateText(formatIsoToDmy(v.deliveryDate) ?? "");
  }, [v.deliveryDate]);

  return (
    <div className="grid gap-4">
      <div className="grid gap-2">
        <Label>Поставщик</Label>
        <Input value={v.supplierName ?? ""} onChange={(e) => set({ supplierName: e.target.value })} disabled={props.disabled} />
      </div>

      <div className="grid gap-2">
        <Label>Завод изготовитель</Label>
        <Input value={v.plant ?? ""} onChange={(e) => set({ plant: e.target.value })} disabled={props.disabled} />
      </div>

      <div className="grid gap-2">
        <Label>№ партии</Label>
        <Input value={v.batchNumber ?? ""} onChange={(e) => set({ batchNumber: e.target.value })} disabled={props.disabled} />
      </div>

      <div className="grid gap-2">
        <Label>Дата поставки</Label>
        <Popover
          open={deliveryCalendarOpen}
          onOpenChange={(next) => {
            if (props.disabled) return;
            setDeliveryCalendarOpen(next);
          }}
        >
          <div className="relative">
            <Input
              type="text"
              inputMode="numeric"
              placeholder="дд/мм/гггг"
              value={deliveryDateText}
              className="pr-10"
              onChange={(e) => {
                const nextText = normalizeDmyInput(e.target.value);
                setDeliveryDateText(nextText);

                if (!nextText) {
                  set({ deliveryDate: undefined });
                  return;
                }

                const iso = parseDmyToIso(nextText);
                if (iso) {
                  set({ deliveryDate: iso });
                  return;
                }

                if (nextText.length === 10) {
                  set({ deliveryDate: undefined });
                }
              }}
              disabled={props.disabled}
            />

            <PopoverTrigger asChild>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="absolute right-1 top-1/2 -translate-y-1/2 h-8 w-8"
                disabled={props.disabled}
                title="Выбрать дату"
              >
                <CalendarIcon className="h-4 w-4" />
              </Button>
            </PopoverTrigger>
          </div>

          <PopoverContent className="w-auto p-0" align="start">
            <Calendar
              mode="single"
              selected={selectedDeliveryDate}
              onSelect={(d) => {
                if (!d) return;
                const iso = format(d, "yyyy-MM-dd");
                set({ deliveryDate: iso });
                setDeliveryDateText(formatIsoToDmy(iso) ?? "");
                setDeliveryCalendarOpen(false);
              }}
              initialFocus
            />
          </PopoverContent>
        </Popover>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="grid gap-2">
          <Label>Количество</Label>
          <Input value={v.quantity ?? ""} onChange={(e) => set({ quantity: e.target.value })} disabled={props.disabled} />
        </div>
        <div className="grid gap-2">
          <Label>Ед.</Label>
          <Input value={v.unit ?? ""} onChange={(e) => set({ unit: e.target.value })} disabled={props.disabled} />
        </div>
      </div>

      <div className="grid gap-2">
        <Label>Примечание</Label>
        <Input value={v.notes ?? ""} onChange={(e) => set({ notes: e.target.value })} disabled={props.disabled} />
      </div>

      {props.onSubmit && (
        <Button type="button" onClick={props.onSubmit} disabled={props.disabled}>
          {props.submitLabel ?? "Сохранить партию"}
        </Button>
      )}
    </div>
  );
}

