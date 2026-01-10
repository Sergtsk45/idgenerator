import { useState } from "react";
import { BottomNav } from "@/components/BottomNav";
import { Header } from "@/components/Header";
import { useWorks, useCreateWork } from "@/hooks/use-works";
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
import { useLanguageStore, translations } from "@/lib/i18n";
import { ScrollArea } from "@/components/ui/scroll-area";
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
        synonyms: [],
      });
      setIsDialogOpen(false);
      setFormData({ code: "", description: "", unit: "m3", quantityTotal: "" });
      toast({ 
        title: language === 'ru' ? "Успех" : "Success", 
        description: language === 'ru' ? "Работа добавлена в ВОР" : "Work item added to BoQ" 
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
      const { apiRequest } = await import("@/lib/queryClient");
      try {
        await apiRequest("DELETE", "/api/works");
      } catch (clearError) {
        console.error("Failed to clear works before import:", clearError);
      }

      const reader = new FileReader();
      reader.onload = async (e) => {
        try {
          const data = new Uint8Array(e.target?.result as ArrayBuffer);
          const workbook = XLSX.read(data, { type: 'array' });
          const firstSheetName = workbook.SheetNames[0];
          const worksheet = workbook.Sheets[firstSheetName];
          const jsonRaw = XLSX.utils.sheet_to_json(worksheet, { header: 1 }) as any[][];

          let successCount = 0;
          for (const row of jsonRaw) {
            if (!Array.isArray(row) || row.length < 5) continue;

            const code = row[1];
            const description = row[2];
            const unit = row[3];
            const quantityTotal = row[4];

            if (row[0] === 1 && row[1] === 2 && row[2] === 3) continue;
            if (code === null || code === undefined) continue;

            const numericCode = parseFloat(String(code));
            if (isNaN(numericCode)) continue;

            const hasDescription = description && String(description).trim().length > 0;
            if (!hasDescription) continue;

            await createWork.mutateAsync({
              code: String(code),
              description: String(description),
              unit: String(unit || ""),
              quantityTotal: String(quantityTotal || "0"),
              synonyms: [],
            });
            successCount++;
          }

          toast({
            title: language === 'ru' ? "Импорт завершен" : "Import Complete",
            description: language === 'ru' 
              ? `Успешно импортировано ${successCount} позиций` 
              : `Successfully imported ${successCount} items`,
          });
          event.target.value = '';
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
    <div className="flex flex-col min-h-screen bg-background">
      <Header title={t.title} />
      
      <div className="flex-1 px-2 py-4 pb-24">
        <div className="mb-4 sticky top-14 z-30 bg-background/95 backdrop-blur py-2 space-y-3 px-2">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input 
              placeholder={language === 'ru' ? "Поиск работ..." : "Search works..."} 
              className="pl-9 rounded-xl bg-secondary/50 border-transparent focus:bg-background transition-all"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              data-testid="input-search-works"
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
                <input 
                  type="file" 
                  accept=".xlsx, .xls, .csv" 
                  className="hidden" 
                  onChange={handleFileUpload}
                  data-testid="input-file-upload"
                />
              </label>
            </Button>
          </div>
        </div>

        {isLoading ? (
          <div className="flex flex-col items-center justify-center py-12 gap-4">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
            <p className="text-sm text-muted-foreground">{language === 'ru' ? "Загрузка ВОР..." : "Loading BoQ..."}</p>
          </div>
        ) : (
          <ScrollArea className="h-[calc(100vh-16rem)]">
            <div className="overflow-x-auto px-2">
              <table className="w-full border-collapse text-sm" style={{ borderColor: '#1e3a5f' }}>
                <thead>
                  <tr>
                    <th className="border-2 border-[#1e3a5f] bg-background p-2 text-center font-semibold w-12">{t.rowNumber}</th>
                    <th className="border-2 border-[#1e3a5f] bg-background p-2 text-center font-semibold w-16">{t.code}</th>
                    <th className="border-2 border-[#1e3a5f] bg-background p-2 text-center font-semibold">{t.description}</th>
                    <th className="border-2 border-[#1e3a5f] bg-background p-2 text-center font-semibold w-16">{t.unit}</th>
                    <th className="border-2 border-[#1e3a5f] bg-background p-2 text-center font-semibold w-20">{t.quantity}</th>
                  </tr>
                  <tr>
                    <th className="border-2 border-[#1e3a5f] bg-background p-1 text-center text-xs text-muted-foreground">1</th>
                    <th className="border-2 border-[#1e3a5f] bg-background p-1 text-center text-xs text-muted-foreground">2</th>
                    <th className="border-2 border-[#1e3a5f] bg-background p-1 text-center text-xs text-muted-foreground">3</th>
                    <th className="border-2 border-[#1e3a5f] bg-background p-1 text-center text-xs text-muted-foreground">4</th>
                    <th className="border-2 border-[#1e3a5f] bg-background p-1 text-center text-xs text-muted-foreground">5</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredWorks.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="border-2 border-[#1e3a5f] p-8 text-center text-muted-foreground">
                        {language === 'ru' ? "Работы не найдены. Импортируйте Excel файл для добавления работ." : "No work items found. Import an Excel file to add works."}
                      </td>
                    </tr>
                  ) : (
                    filteredWorks.map((work, idx) => (
                      <tr key={work.id} data-testid={`row-work-${work.id}`}>
                        <td className="border-2 border-[#1e3a5f] p-2 text-center align-top">{idx + 1}</td>
                        <td className="border-2 border-[#1e3a5f] p-2 text-center align-top">{work.code}</td>
                        <td className="border-2 border-[#1e3a5f] p-2 align-top">{work.description}</td>
                        <td className="border-2 border-[#1e3a5f] p-2 text-center align-top">{work.unit}</td>
                        <td className="border-2 border-[#1e3a5f] p-2 text-right align-top">{work.quantityTotal}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </ScrollArea>
        )}
      </div>

      <div className="fixed bottom-20 right-4 z-40 md:right-[max(1rem,calc(50vw-220px))]">
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button 
              size="icon" 
              className="h-14 w-14 rounded-full shadow-xl bg-primary hover:bg-primary/90 transition-transform hover:scale-105 active:scale-95"
              data-testid="button-add-work"
            >
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
                  data-testid="input-work-code"
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="desc">{t.description}</Label>
                <Input 
                  id="desc" 
                  placeholder="..." 
                  value={formData.description}
                  onChange={e => setFormData({...formData, description: e.target.value})}
                  data-testid="input-work-description"
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
                    data-testid="input-work-unit"
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
                    data-testid="input-work-quantity"
                  />
                </div>
              </div>
            </div>
            <Button 
              onClick={handleCreate} 
              disabled={createWork.isPending || !formData.code || !formData.description}
              className="w-full h-12 rounded-xl text-base"
              data-testid="button-submit-work"
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
