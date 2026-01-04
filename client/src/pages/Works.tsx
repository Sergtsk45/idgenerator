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
import { Plus, Search, Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { motion } from "framer-motion";

export default function Works() {
  const { data: works = [], isLoading } = useWorks();
  const createWork = useCreateWork();
  const { toast } = useToast();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");

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
        quantityTotal: parseInt(formData.quantityTotal) || 0,
        synonyms: [], // Empty for now
      });
      setIsDialogOpen(false);
      setFormData({ code: "", description: "", unit: "m3", quantityTotal: "" });
      toast({ title: "Success", description: "Work item added to BoQ" });
    } catch (error) {
      toast({ title: "Error", description: "Failed to create work item", variant: "destructive" });
    }
  };

  const filteredWorks = works.filter(w => 
    w.description.toLowerCase().includes(searchTerm.toLowerCase()) || 
    w.code.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="flex flex-col min-h-screen bg-background bg-grain">
      <Header title="Bill of Quantities" />
      
      <div className="flex-1 px-4 py-6 pb-24 max-w-md mx-auto w-full">
        {/* Search & Filter */}
        <div className="mb-6 sticky top-14 z-30 bg-background/95 backdrop-blur py-2">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input 
              placeholder="Search works..." 
              className="pl-9 rounded-xl bg-secondary/50 border-transparent focus:bg-background transition-all"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
        </div>

        {/* Content */}
        {isLoading ? (
          <div className="flex flex-col items-center justify-center py-12 gap-4">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
            <p className="text-sm text-muted-foreground">Loading BoQ...</p>
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
                <p>No work items found.</p>
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
              <DialogTitle>Add Work Item</DialogTitle>
              <DialogDescription>Add a new item to the Bill of Quantities.</DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="grid gap-2">
                <Label htmlFor="code">Work Code</Label>
                <Input 
                  id="code" 
                  placeholder="e.g. 3.1.2" 
                  value={formData.code}
                  onChange={e => setFormData({...formData, code: e.target.value})}
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="desc">Description</Label>
                <Input 
                  id="desc" 
                  placeholder="Concrete works..." 
                  value={formData.description}
                  onChange={e => setFormData({...formData, description: e.target.value})}
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="grid gap-2">
                  <Label htmlFor="unit">Unit</Label>
                  <Input 
                    id="unit" 
                    placeholder="m3" 
                    value={formData.unit}
                    onChange={e => setFormData({...formData, unit: e.target.value})}
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="qty">Total Quantity</Label>
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
              {createWork.isPending ? "Adding..." : "Add Item"}
            </Button>
          </DialogContent>
        </Dialog>
      </div>

      <BottomNav />
    </div>
  );
}
