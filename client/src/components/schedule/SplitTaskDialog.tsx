/**
 * @file: SplitTaskDialog.tsx
 * @description: Диалог для разделения задачи графика на две части (Stage 6: Split dialog UI)
 * @dependencies: shadcn/ui, hooks/use-schedules
 * @created: 2026-03-02
 */

import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { format, parseISO, addDays, differenceInCalendarDays } from "date-fns";
import { ru } from "date-fns/locale";
import { CalendarIcon, Loader2 } from "lucide-react";
import type { ScheduleTask } from "@shared/schema";

export interface SplitTaskDialogProps {
  task: ScheduleTask | null;
  open: boolean;
  onClose: () => void;
  scheduleId: number | null;
  onSplit: (data: {
    taskId: number;
    splitDate: string;
    quantityFirst?: string;
    quantitySecond?: string;
    newActNumber?: number;
    inherit?: {
      materials?: boolean;
      projectDrawings?: boolean;
      normativeRefs?: boolean;
      executiveSchemes?: boolean;
    };
  }) => Promise<void>;
  isSubmitting?: boolean;
}

export function SplitTaskDialog(props: SplitTaskDialogProps) {
  const { task, open, onClose, scheduleId, onSplit, isSubmitting } = props;

  const [splitDate, setSplitDate] = useState<Date | undefined>(undefined);
  const [quantityFirst, setQuantityFirst] = useState<string>("");
  const [quantitySecond, setQuantitySecond] = useState<string>("");
  const [newActNumber, setNewActNumber] = useState<string>("");
  const [inheritMaterials, setInheritMaterials] = useState(false);
  const [inheritProjectDrawings, setInheritProjectDrawings] = useState(false);
  const [inheritNormativeRefs, setInheritNormativeRefs] = useState(false);
  const [inheritExecutiveSchemes, setInheritExecutiveSchemes] = useState(false);

  const [errors, setErrors] = useState<Record<string, string>>({});
  const [calendarOpen, setCalendarOpen] = useState(false);

  useEffect(() => {
    if (!open || !task) {
      setSplitDate(undefined);
      setQuantityFirst("");
      setQuantitySecond("");
      setNewActNumber("");
      setInheritMaterials(false);
      setInheritProjectDrawings(false);
      setInheritNormativeRefs(false);
      setInheritExecutiveSchemes(false);
      setErrors({});
      return;
    }

    const taskStart = parseISO(task.startDate);
    const taskEnd = addDays(taskStart, task.durationDays);
    const midDate = addDays(taskStart, Math.floor(task.durationDays / 2));
    setSplitDate(midDate);

    if (task.quantity) {
      const total = parseFloat(task.quantity);
      if (!isNaN(total) && total > 0) {
        const half = total / 2;
        setQuantityFirst(half.toFixed(4));
        setQuantitySecond(half.toFixed(4));
      }
    }
  }, [open, task?.id]);

  const handleQuantityFirstChange = (value: string) => {
    setQuantityFirst(value);
    if (task?.quantity && value) {
      const first = parseFloat(value);
      const total = parseFloat(task.quantity);
      if (!isNaN(first) && !isNaN(total)) {
        const second = total - first;
        setQuantitySecond(second.toFixed(4));
      }
    }
  };

  const handleQuantitySecondChange = (value: string) => {
    setQuantitySecond(value);
    if (task?.quantity && value) {
      const second = parseFloat(value);
      const total = parseFloat(task.quantity);
      if (!isNaN(second) && !isNaN(total)) {
        const first = total - second;
        setQuantityFirst(first.toFixed(4));
      }
    }
  };

  const validate = (): boolean => {
    const newErrors: Record<string, string> = {};

    if (!task) {
      newErrors.general = "Задача не выбрана";
      setErrors(newErrors);
      return false;
    }

    if (!splitDate) {
      newErrors.splitDate = "Выберите дату разделения";
    } else {
      const taskStart = parseISO(task.startDate);
      const taskEnd = addDays(taskStart, task.durationDays);

      if (splitDate <= taskStart) {
        newErrors.splitDate = "Дата разделения должна быть после начала задачи";
      } else if (splitDate >= taskEnd) {
        newErrors.splitDate = "Дата разделения должна быть до конца задачи";
      }
    }

    if (quantityFirst) {
      const qty = parseFloat(quantityFirst);
      if (isNaN(qty) || qty <= 0) {
        newErrors.quantityFirst = "Объём должен быть положительным числом";
      }
    }

    if (quantitySecond) {
      const qty = parseFloat(quantitySecond);
      if (isNaN(qty) || qty <= 0) {
        newErrors.quantitySecond = "Объём должен быть положительным числом";
      }
    }

    if (quantityFirst && quantitySecond && task.quantity) {
      const first = parseFloat(quantityFirst);
      const second = parseFloat(quantitySecond);
      const total = parseFloat(task.quantity);
      const sum = first + second;
      if (Math.abs(sum - total) > 0.01) {
        newErrors.quantitySum = `Сумма объёмов (${sum.toFixed(2)}) должна равняться общему объёму (${total})`;
      }
    }

    if (newActNumber) {
      const actNum = parseInt(newActNumber);
      if (isNaN(actNum) || actNum <= 0) {
        newErrors.newActNumber = "Номер акта должен быть положительным числом";
      }
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async () => {
    if (!validate() || !task || !splitDate) return;

    try {
      await onSplit({
        taskId: task.id,
        splitDate: format(splitDate, "yyyy-MM-dd"),
        quantityFirst: quantityFirst || undefined,
        quantitySecond: quantitySecond || undefined,
        newActNumber: newActNumber ? parseInt(newActNumber) : undefined,
        inherit: {
          materials: inheritMaterials,
          projectDrawings: inheritProjectDrawings,
          normativeRefs: inheritNormativeRefs,
          executiveSchemes: inheritExecutiveSchemes,
        },
      });
      onClose();
    } catch (error) {
      console.error("Failed to split task:", error);
    }
  };

  if (!task) return null;

  const taskStart = parseISO(task.startDate);
  const taskEnd = addDays(taskStart, task.durationDays);
  const minDate = addDays(taskStart, 1);
  const maxDate = addDays(taskEnd, -1);

  return (
    <Dialog open={open} onOpenChange={(isOpen) => !isOpen && onClose()}>
      <DialogContent className="sm:max-w-lg lg:max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Разделить задачу</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Task Info */}
          <div className="rounded-md border p-3 bg-muted/50">
            <div className="text-sm font-medium mb-1">{task.titleOverride || "Задача"}</div>
            <div className="text-xs text-muted-foreground">
              Период: {format(taskStart, "dd.MM.yyyy", { locale: ru })} - {format(taskEnd, "dd.MM.yyyy", { locale: ru })} ({task.durationDays} дней)
            </div>
            {task.quantity && (
              <div className="text-xs text-muted-foreground">
                Объём: {task.quantity} {task.unit || ""}
              </div>
            )}
          </div>

          {/* Split Date */}
          <div className="space-y-2">
            <Label htmlFor="splitDate">Дата разделения *</Label>
            <Popover open={calendarOpen} onOpenChange={setCalendarOpen}>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  className={cn(
                    "w-full justify-start text-left font-normal",
                    !splitDate && "text-muted-foreground"
                  )}
                >
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {splitDate ? format(splitDate, "dd.MM.yyyy", { locale: ru }) : "Выберите дату"}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar
                  mode="single"
                  selected={splitDate}
                  onSelect={(date) => {
                    setSplitDate(date);
                    setCalendarOpen(false);
                  }}
                  disabled={(date) => date < minDate || date > maxDate}
                  initialFocus
                  locale={ru}
                />
              </PopoverContent>
            </Popover>
            {errors.splitDate && (
              <div className="text-sm text-destructive">{errors.splitDate}</div>
            )}
          </div>

          {/* Quantities */}
          {task.quantity && (
            <div className="space-y-2">
              <Label>Объёмы работ</Label>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label htmlFor="quantityFirst" className="text-xs">Первая часть</Label>
                  <Input
                    id="quantityFirst"
                    type="text"
                    value={quantityFirst}
                    onChange={(e) => handleQuantityFirstChange(e.target.value)}
                    placeholder="0.0000"
                  />
                  {errors.quantityFirst && (
                    <div className="text-xs text-destructive">{errors.quantityFirst}</div>
                  )}
                </div>
                <div className="space-y-1">
                  <Label htmlFor="quantitySecond" className="text-xs">Вторая часть</Label>
                  <Input
                    id="quantitySecond"
                    type="text"
                    value={quantitySecond}
                    onChange={(e) => handleQuantitySecondChange(e.target.value)}
                    placeholder="0.0000"
                  />
                  {errors.quantitySecond && (
                    <div className="text-xs text-destructive">{errors.quantitySecond}</div>
                  )}
                </div>
              </div>
              {errors.quantitySum && (
                <div className="text-sm text-destructive">{errors.quantitySum}</div>
              )}
            </div>
          )}

          {/* New Act Number */}
          <div className="space-y-2">
            <Label htmlFor="newActNumber">Номер акта для новой задачи (опционально)</Label>
            <Input
              id="newActNumber"
              type="number"
              value={newActNumber}
              onChange={(e) => setNewActNumber(e.target.value)}
              placeholder="например: 15"
            />
            {errors.newActNumber && (
              <div className="text-sm text-destructive">{errors.newActNumber}</div>
            )}
          </div>

          {/* Inherit Options */}
          <div className="space-y-3 rounded-md border p-3">
            <div className="text-sm font-medium">Наследовать во вторую задачу:</div>
            <div className="space-y-2">
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="inheritMaterials"
                  checked={inheritMaterials}
                  onCheckedChange={(checked) => setInheritMaterials(checked === true)}
                />
                <Label htmlFor="inheritMaterials" className="text-sm font-normal cursor-pointer">
                  Материалы
                </Label>
              </div>
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="inheritProjectDrawings"
                  checked={inheritProjectDrawings}
                  onCheckedChange={(checked) => setInheritProjectDrawings(checked === true)}
                />
                <Label htmlFor="inheritProjectDrawings" className="text-sm font-normal cursor-pointer">
                  Проектная документация
                </Label>
              </div>
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="inheritNormativeRefs"
                  checked={inheritNormativeRefs}
                  onCheckedChange={(checked) => setInheritNormativeRefs(checked === true)}
                />
                <Label htmlFor="inheritNormativeRefs" className="text-sm font-normal cursor-pointer">
                  Нормативные ссылки
                </Label>
              </div>
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="inheritExecutiveSchemes"
                  checked={inheritExecutiveSchemes}
                  onCheckedChange={(checked) => setInheritExecutiveSchemes(checked === true)}
                />
                <Label htmlFor="inheritExecutiveSchemes" className="text-sm font-normal cursor-pointer">
                  Исполнительные схемы
                </Label>
              </div>
            </div>
          </div>

          {errors.general && (
            <div className="text-sm text-destructive">{errors.general}</div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={isSubmitting}>
            Отмена
          </Button>
          <Button onClick={handleSubmit} disabled={isSubmitting}>
            {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Разделить
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
