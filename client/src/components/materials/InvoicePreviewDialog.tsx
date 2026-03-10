/**
 * @file: InvoicePreviewDialog.tsx
 * @description: Диалог предпросмотра и выборочного импорта материалов из распознанного PDF-счета.
 * @dependencies: hooks/use-materials, components/ui/*, @shared/routes
 * @created: 2026-03-01
 */

import { useState, useMemo, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Loader2, CheckCircle2, Edit2 } from "lucide-react";
import { useBulkCreateMaterials, useSubmitCorrections } from "@/hooks/use-materials";
import { useToast } from "@/hooks/use-toast";
import { useLanguageStore } from "@/lib/i18n";
import { cn } from "@/lib/utils";
import { z } from "zod";
import { api } from "@shared/routes";

type ParsedInvoiceData = z.infer<typeof api.projectMaterials.parseInvoice.responses[200]>;

type Phase = "preview" | "importing" | "result";

interface InvoicePreviewDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  objectId: number;
  parsedData: ParsedInvoiceData | null;
}

type ParsedItem = { name: string; unit?: string; qty?: string };

function computeCorrections(
  parsedItems: ParsedItem[],
  editedItems: Map<number, { name: string; unit: string; qty: string }>,
  selectedItems: Set<number>
): Array<{ itemIndex: number; fieldName: "name" | "unit" | "qty"; originalValue: string; correctedValue: string }> {
  const corrections: Array<{ itemIndex: number; fieldName: "name" | "unit" | "qty"; originalValue: string; correctedValue: string }> = [];

  selectedItems.forEach((idx) => {
    const edited = editedItems.get(idx);
    if (!edited) return;

    const original = parsedItems[idx];
    if (!original) return;

    const fields: Array<{ key: "name" | "unit" | "qty"; orig: string }> = [
      { key: "name", orig: original.name ?? "" },
      { key: "unit", orig: original.unit ?? "" },
      { key: "qty", orig: original.qty ?? "" },
    ];

    for (const { key, orig } of fields) {
      const corrected = edited[key]?.trim() ?? "";
      if (orig.trim() !== corrected && corrected.length > 0) {
        corrections.push({
          itemIndex: idx,
          fieldName: key,
          originalValue: orig.trim(),
          correctedValue: corrected,
        });
      }
    }
  });

  return corrections;
}

export function InvoicePreviewDialog({
  open,
  onOpenChange,
  objectId,
  parsedData,
}: InvoicePreviewDialogProps) {
  const { language } = useLanguageStore();
  const { toast } = useToast();
  const bulkCreate = useBulkCreateMaterials(objectId);
  const submitCorrections = useSubmitCorrections();

  const [phase, setPhase] = useState<Phase>("preview");
  const [selectedItems, setSelectedItems] = useState<Set<number>>(new Set());
  const [editedItems, setEditedItems] = useState<Map<number, { name: string; unit: string; qty: string }>>(
    new Map()
  );
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [result, setResult] = useState<{ created: number; skipped: number; batchesCreated: number } | null>(null);

  const items = parsedData?.items ?? [];

  useEffect(() => {
    if (open && items.length > 0 && selectedItems.size === 0) {
      setSelectedItems(new Set(items.map((_, i) => i)));
    }
  }, [open, items.length, selectedItems.size]);

  const allSelected = selectedItems.size === items.length && items.length > 0;
  const selectedCount = selectedItems.size;

  const handleToggleAll = () => {
    if (allSelected) {
      setSelectedItems(new Set());
    } else {
      setSelectedItems(new Set(items.map((_, i) => i)));
    }
  };

  const handleToggleItem = (index: number) => {
    const newSet = new Set(selectedItems);
    if (newSet.has(index)) {
      newSet.delete(index);
    } else {
      newSet.add(index);
    }
    setSelectedItems(newSet);
  };

  const handleEditItem = (index: number, field: "name" | "unit" | "qty", value: string) => {
    const current = editedItems.get(index) ?? {
      name: items[index].name,
      unit: items[index].unit ?? "",
      qty: items[index].qty ?? "",
    };
    setEditedItems(new Map(editedItems.set(index, { ...current, [field]: value })));
  };

  const getItemData = (index: number) => {
    const edited = editedItems.get(index);
    return {
      name: edited?.name ?? items[index].name,
      unit: edited?.unit ?? items[index].unit ?? "",
      qty: edited?.qty ?? items[index].qty ?? "",
    };
  };

  const handleImport = async () => {
    if (selectedCount === 0) return;

    setPhase("importing");

    const itemsToCreate = Array.from(selectedItems)
      .map((idx) => {
        const data = getItemData(idx);
        return {
          nameOverride: data.name.trim(),
          baseUnitOverride: data.unit.trim() || undefined,
          qty: data.qty.trim() || undefined,
        };
      })
      .filter((item) => item.nameOverride.length > 0);

    try {
      const res = await bulkCreate.mutateAsync({
        items: itemsToCreate,
        supplierName: parsedData?.supplier_name,
        deliveryDate: parsedData?.invoice_date,
      });
      setResult({ created: res.created, skipped: res.skipped, batchesCreated: res.batchesCreated });

      const corrections = computeCorrections(items, editedItems, selectedItems);
      if (corrections.length > 0) {
        submitCorrections.mutate({
          objectId,
          invoiceNumber: parsedData?.invoice_number,
          supplierName: parsedData?.supplier_name,
          corrections,
        });
      }

      setPhase("result");
    } catch (err: any) {
      toast({
        title: language === "ru" ? "Ошибка импорта" : "Import error",
        description: err.message || (language === "ru" ? "Не удалось импортировать материалы" : "Failed to import materials"),
        variant: "destructive",
      });
      setPhase("preview");
    }
  };

  const handleClose = () => {
    onOpenChange(false);
    setTimeout(() => {
      setPhase("preview");
      setSelectedItems(new Set());
      setEditedItems(new Map());
      setEditingIndex(null);
      setResult(null);
    }, 200);
  };

  if (!parsedData) return null;

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="text-xl">
            {phase === "result"
              ? language === "ru"
                ? "Результат импорта"
                : "Import result"
              : language === "ru"
              ? "Импорт из счёта"
              : "Import from invoice"}
          </DialogTitle>
          {phase === "preview" && (parsedData.invoice_number || parsedData.supplier_name) && (
            <div className="text-sm text-muted-foreground pt-1 space-y-1">
              {parsedData.invoice_number && (
                <div>
                  {language === "ru" ? "Счёт" : "Invoice"} №{parsedData.invoice_number}
                  {parsedData.invoice_date && ` ${language === "ru" ? "от" : "dated"} ${parsedData.invoice_date}`}
                </div>
              )}
              {parsedData.supplier_name && (
                <div>
                  {language === "ru" ? "Поставщик" : "Supplier"}: {parsedData.supplier_name}
                </div>
              )}
            </div>
          )}
        </DialogHeader>

        {phase === "preview" && (
          <div className="min-h-0 flex flex-1 flex-col overflow-hidden">
            {items.length > 0 && (
              <div className="shrink-0 flex items-center gap-2 py-2 border-b">
                <Checkbox
                  id="select-all"
                  checked={allSelected}
                  onCheckedChange={handleToggleAll}
                />
                <label
                  htmlFor="select-all"
                  className="text-sm font-medium cursor-pointer select-none"
                >
                  {language === "ru" ? "Выделить все" : "Select all"} ({items.length}{" "}
                  {language === "ru" ? "позиций" : "items"})
                </label>
              </div>
            )}

            <div className="min-h-0 flex-1 overflow-y-auto -mx-6 px-6">
              <div className="space-y-3 py-2">
                {items.map((item, idx) => {
                  const isSelected = selectedItems.has(idx);
                  const data = getItemData(idx);
                  const isEditing = editingIndex === idx;

                  return (
                    <div
                      key={idx}
                      className={cn(
                        "border rounded-lg p-3 transition-colors",
                        isSelected ? "bg-primary/5 border-primary/30" : "bg-muted/30"
                      )}
                    >
                      <div className="flex items-start gap-3">
                        <Checkbox
                          id={`item-${idx}`}
                          checked={isSelected}
                          onCheckedChange={() => handleToggleItem(idx)}
                          className="mt-1"
                        />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-start gap-2 mb-2">
                            <div className="flex-1">
                              {isEditing ? (
                                <Input
                                  value={data.name}
                                  onChange={(e) => handleEditItem(idx, "name", e.target.value)}
                                  onBlur={() => setEditingIndex(null)}
                                  autoFocus
                                  className="h-8 text-sm"
                                />
                              ) : (
                                <div
                                  className="font-medium text-sm cursor-text group flex items-center gap-1"
                                  onClick={() => setEditingIndex(idx)}
                                >
                                  <span className="break-words">
                                    {idx + 1}. {data.name}
                                  </span>
                                  <Edit2 className="h-3 w-3 opacity-0 group-hover:opacity-50 transition-opacity" />
                                </div>
                              )}
                            </div>
                          </div>
                            <div className="flex items-center gap-3 text-xs text-muted-foreground flex-wrap">
                            <div className="flex items-center gap-1">
                              <span>{language === "ru" ? "Ед." : "Unit"}:</span>
                              <Input
                                value={data.unit}
                                onChange={(e) => handleEditItem(idx, "unit", e.target.value)}
                                placeholder="-"
                                className="h-6 w-16 px-1 text-xs"
                              />
                            </div>
                            <div className="flex items-center gap-1">
                              <span>{language === "ru" ? "Кол-во" : "Qty"}:</span>
                              <Input
                                value={data.qty}
                                onChange={(e) => handleEditItem(idx, "qty", e.target.value)}
                                placeholder="-"
                                className="h-6 w-20 px-1 text-xs"
                              />
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            <DialogFooter className="shrink-0 gap-2 pt-2">
              <Button variant="outline" onClick={handleClose}>
                {language === "ru" ? "Отмена" : "Cancel"}
              </Button>
              <Button
                onClick={handleImport}
                disabled={selectedCount === 0 || bulkCreate.isPending}
              >
                {language === "ru" ? "Импортировать" : "Import"} ({selectedCount})
              </Button>
            </DialogFooter>
          </div>
        )}

        {phase === "importing" && (
          <div className="flex flex-col items-center justify-center py-12 gap-4">
            <Loader2 className="h-12 w-12 animate-spin text-primary" />
            <p className="text-sm text-muted-foreground">
              {language === "ru" ? "Импорт материалов..." : "Importing materials..."}
            </p>
          </div>
        )}

        {phase === "result" && result && (
          <>
            <div className="flex flex-col items-center justify-center py-8 gap-4">
              <CheckCircle2 className="h-16 w-16 text-green-500" />
              <div className="text-center space-y-2">
                <p className="text-lg font-medium">
                  {language === "ru" ? "Импорт завершён" : "Import completed"}
                </p>
                <div className="flex gap-4 text-sm">
                  <Badge variant="default" className="bg-green-500">
                    {language === "ru" ? "Создано" : "Created"}: {result.created}
                  </Badge>
                  {result.skipped > 0 && (
                    <Badge variant="secondary">
                      {language === "ru" ? "Пропущено дубликатов" : "Skipped duplicates"}:{" "}
                      {result.skipped}
                    </Badge>
                  )}
                  {result.batchesCreated > 0 && (
                    <Badge variant="outline">
                      {language === "ru" ? "Партий создано" : "Batches created"}:{" "}
                      {result.batchesCreated}
                    </Badge>
                  )}
                </div>
              </div>
            </div>
            <DialogFooter>
              <Button onClick={handleClose} className="w-full">
                {language === "ru" ? "Закрыть" : "Close"}
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
