import { useState } from "react";
import { BottomNav } from "@/components/BottomNav";
import { Header } from "@/components/Header";
import { useWorks, useCreateWork } from "@/hooks/use-works";
import { WorkItemCard } from "@/components/WorkItemCard";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle, 
  DialogTrigger,
  DialogDescription
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Plus, Search, Loader2, FileUp } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { motion } from "framer-motion";
import { useLanguageStore, translations } from "@/lib/i18n";
import * as XLSX from "xlsx";

export default function Works() {
  const { language } = useLanguageStore();
  const t = translations[language].works;
  const { data: works = [], isLoading } = useWorks();
  const createWork = useCreateWork();
  const { toast } = useToast();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [isImporting, setIsImporting] = useState(false);

  const [formData, setFormData] = useState({
    code: "",
    description: "",
    unit: "m3",
    quantityTotal: "",
  });

  const handleCreate = async () => {
    try {
      await createWork.mutateAsync({
        ...formData,
        quantityTotal: formData.quantityTotal || "0",
        synonyms: [], // Empty for now
      });
      setIsDialogOpen(false);
      setFormData({ code: "", description: "", unit: "m3", quantityTotal: "" });
      toast({ 
        title: language === 'ru' ? "Успех" : "Success", 
        description: language === 'ru' ? "Работа добавлена в ВОИР" : "Work item added to BoQ" 
      });
    } catch (error) {
      toast({ 
        title: language === 'ru' ? "Ошибка" : "Error", 
        description: language === 'ru' ? "Не удалось добавить работу" : "Failed to create work item", 
        variant: "destructive" 
      });
    }
  };

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setIsImporting(true);
    try {
      // Clear existing works first (temporary debugging measure)
      const { apiRequest } = await import("@/lib/queryClient");
      try {
        await apiRequest("DELETE", "/api/works");
        console.log("Successfully cleared existing works");
      } catch (clearError) {
        console.error("Failed to clear works before import:", clearError);
        // Continue anyway
      }

      const reader = new FileReader();
      reader.onload = async (e) => {
        try {
          const data = new Uint8Array(e.target?.result as ArrayBuffer);
          const workbook = XLSX.read(data, { type: 'array' });
          const firstSheetName = workbook.SheetNames[0];
          const worksheet = workbook.Sheets[firstSheetName];
          // Header: 1 to get raw array of arrays
          const jsonRaw = XLSX.utils.sheet_to_json(worksheet, { header: 1 }) as any[][];

          console.log("Starting import of rows:", jsonRaw.length);

          let successCount = 0;
          for (const row of jsonRaw) {
            // row is an array of cells [ №, ??, Наименование, Ед. изм., Кол-во, ... ]
            const code = row[0];
            const description = row[2];
            const unit = row[3];
            const quantityTotal = row[4];

            // 1. Skip if row is empty or not an array
            if (!Array.isArray(row) || row.length < 3) continue;

            // 2. Skip technical header rows (like "1", "2", "3", "4", "5" which are column numbers)
            // A technical row usually has code "1" and description "2" or similar
            if (String(code).trim() === "1" && (String(description).trim() === "3" || String(row[1]).trim() === "2")) continue;

            // 3. Skip section headers
            // Section headers usually have a description but NO unit and NO quantity
            const hasDescription = description && String(description).trim().length > 0;
            const hasUnit = unit && String(unit).trim().length > 0;
            const hasQuantity = quantityTotal !== undefined && quantityTotal !== null && String(quantityTotal).trim().length > 0;

            // If it's a section header (starts with "Раздел" or just has description without data)
            if (hasDescription && !hasUnit && !hasQuantity) {
              console.log("Skipping section header:", description);
              continue;
            }

            // 4. Validate and import work item
            // Code must be present and numeric-ish (e.g. "1", "1.1", "3.2.1")
            const numericCode = parseFloat(String(code));
            if (code && hasDescription && hasUnit && !isNaN(numericCode)) {
              await createWork.mutateAsync({
                code: String(code),
                description: String(description),
                unit: String(unit || ""),
                quantityTotal: String(quantityTotal || "0"),
                synonyms: [],
              });
              successCount++;
            }
          }

          console.log("Import finished. Success count:", successCount);

          toast({
            title: language === 'ru' ? "Импорт завершен" : "Import Complete",
            description: language === 'ru' 
              ? `Успешно импортировано ${successCount} позиций` 
              : `Successfully imported ${successCount} items`,
          });
          event.target.value = ''; // Reset input
        } catch (error) {
          console.error("Error processing file data:", error);
          toast({
            title: language === 'ru' ? "Ошибка импорта" : "Import Error",
            description: language === 'ru' ? "Не удалось обработать данные файла" : "Failed to process file data",
            variant: "destructive",
          });
        }
      };
      reader.readAsArrayBuffer(file);
    } catch (error) {
      console.error("Error in handleFileUpload:", error);
      toast({
        title: language === 'ru' ? "Ошибка импорта" : "Import Error",
        description: language === 'ru' ? "Произошла ошибка при подготовке импорта" : "An error occurred during import preparation",
        variant: "destructive",
      });
    } finally {
      setIsImporting(false);
    }
  };

  const filteredWorks = works.filter(w => 
    w.description.toLowerCase().includes(searchTerm.toLowerCase()) || 
    w.code.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="flex flex-col min-h-screen bg-background bg-grain">
      <Header title={t.title} />
      
      <div className="flex-1 px-4 py-6 pb-24 max-w-md mx-auto w-full">
        {/* Search & Actions */}
        <div className="mb-6 sticky top-14 z-30 bg-background/95 backdrop-blur py-2 space-y-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input 
              placeholder={language === 'ru' ? "Поиск работ..." : "Search works..."} 
              className="pl-9 rounded-xl bg-secondary/50 border-transparent focus:bg-background transition-all"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
          
          <div className="flex gap-2">
            <Button 
              variant="outline" 
              className="flex-1 gap-2 rounded-xl h-11"
              disabled={isImporting}
              asChild
            >
              <label className="cursor-pointer">
                <FileUp className="h-4 w-4" />
                {isImporting ? (language === 'ru' ? "Загрузка..." : "Importing...") : (language === 'ru' ? "Импорт Excel" : "Import Excel")}
                <input type="file" accept=".xlsx, .xls, .csv" className="hidden" onChange={handleFileUpload} />
              </label>
            </Button>
          </div>
        </div>

        {/* Content */}
        {isLoading ? (
          <div className="flex flex-col items-center justify-center py-12 gap-4">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
            <p className="text-sm text-muted-foreground">{language === 'ru' ? "Загрузка ВОИР..." : "Loading BoQ..."}</p>
          </div>
        ) : (
          <div className="space-y-3">
            {filteredWorks.map((work, idx) => (
              <motion.div
                key={work.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: idx * 0.05 }}
              >
                <WorkItemCard work={work} />
              </motion.div>
            ))}
            
            {filteredWorks.length === 0 && (
              <div className="text-center py-12 text-muted-foreground">
                <p>{language === 'ru' ? "Работы не найдены." : "No work items found."}</p>
              </div>
            )}
          </div>
        )}
      </div>

      {/* FAB to Add Work */}
      <div className="fixed bottom-20 right-4 z-40 md:right-[max(1rem,calc(50vw-220px))]">
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button size="icon" className="h-14 w-14 rounded-full shadow-xl bg-primary hover:bg-primary/90 transition-transform hover:scale-105 active:scale-95">
              <Plus className="h-6 w-6" />
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-md rounded-2xl">
            <DialogHeader>
              <DialogTitle>{language === 'ru' ? "Добавить работу" : "Add Work Item"}</DialogTitle>
              <DialogDescription>{language === 'ru' ? "Добавьте новую позицию в ведомость объемов." : "Add a new item to the Bill of Quantities."}</DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="grid gap-2">
                <Label htmlFor="code">{t.code}</Label>
                <Input 
                  id="code" 
                  placeholder="e.g. 3.1.2" 
                  value={formData.code}
                  onChange={e => setFormData({...formData, code: e.target.value})}
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="desc">{t.description}</Label>
                <Input 
                  id="desc" 
                  placeholder="..." 
                  value={formData.description}
                  onChange={e => setFormData({...formData, description: e.target.value})}
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="grid gap-2">
                  <Label htmlFor="unit">{t.unit}</Label>
                  <Input 
                    id="unit" 
                    placeholder="m3" 
                    value={formData.unit}
                    onChange={e => setFormData({...formData, unit: e.target.value})}
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="qty">{t.quantity}</Label>
                  <Input 
                    id="qty" 
                    type="number" 
                    placeholder="100" 
                    value={formData.quantityTotal}
                    onChange={e => setFormData({...formData, quantityTotal: e.target.value})}
                  />
                </div>
              </div>
            </div>
            <Button 
              onClick={handleCreate} 
              disabled={createWork.isPending || !formData.code || !formData.description}
              className="w-full h-12 rounded-xl text-base"
            >
              {createWork.isPending ? (language === 'ru' ? "Добавление..." : "Adding...") : (language === 'ru' ? "Добавить" : "Add Item")}
            </Button>
          </DialogContent>
        </Dialog>
      </div>

      <BottomNav />
    </div>
  );
}
