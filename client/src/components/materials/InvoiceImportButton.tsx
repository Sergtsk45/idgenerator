/**
 * @file: InvoiceImportButton.tsx
 * @description: Кнопка загрузки PDF-счёта для распознавания и импорта материалов.
 * @dependencies: hooks/use-materials, hooks/use-toast
 * @created: 2026-03-01
 */

import { useRef, type ChangeEvent } from "react";
import { Button } from "@/components/ui/button";
import { FileUp, Loader2 } from "lucide-react";
import { useParseInvoice } from "@/hooks/use-materials";
import { useToast } from "@/hooks/use-toast";
import { useLanguageStore } from "@/lib/i18n";

interface InvoiceImportButtonProps {
  objectId: number;
  onParsed: (data: any) => void;
}

export function InvoiceImportButton({ objectId, onParsed }: InvoiceImportButtonProps) {
  const { language } = useLanguageStore();
  const { toast } = useToast();
  const fileRef = useRef<HTMLInputElement>(null);
  const parseInvoice = useParseInvoice(objectId);

  const handleFileChange = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    e.target.value = "";

    parseInvoice.mutate(file, {
      onSuccess: (data) => {
        if (data.items.length === 0) {
          toast({
            title: language === "ru" ? "Материалы не найдены" : "No materials found",
            description:
              language === "ru"
                ? "В документе не обнаружено позиций для импорта."
                : "No items found in the document.",
            variant: "destructive",
          });
          return;
        }
        onParsed(data);
      },
      onError: (err: any) => {
        toast({
          title: language === "ru" ? "Ошибка распознавания" : "Parsing error",
          description: err.message || (language === "ru" ? "Не удалось распознать файл" : "Failed to parse file"),
          variant: "destructive",
        });
      },
    });
  };

  return (
    <>
      <input
        ref={fileRef}
        type="file"
        accept=".pdf,application/pdf"
        className="hidden"
        onChange={handleFileChange}
      />
      <Button
        size="icon"
        variant="secondary"
        className="h-14 w-14 rounded-full shadow-xl bg-secondary hover:bg-secondary/90 transition-transform hover:scale-105 active:scale-95"
        disabled={parseInvoice.isPending}
        onClick={() => fileRef.current?.click()}
        title={language === "ru" ? "Импорт из счёта (PDF)" : "Import from invoice (PDF)"}
      >
        {parseInvoice.isPending ? (
          <Loader2 className="h-6 w-6 animate-spin" />
        ) : (
          <FileUp className="h-6 w-6" />
        )}
      </Button>
    </>
  );
}
