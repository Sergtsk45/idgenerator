import { useState } from "react";
import { BottomNav } from "@/components/BottomNav";
import { Header } from "@/components/Header";
import { useActs, useGenerateAct } from "@/hooks/use-acts";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { FileText, CalendarIcon, Download, Loader2, Plus, ChevronRight } from "lucide-react";
import { format } from "date-fns";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import { motion } from "framer-motion";

export default function Acts() {
  const { data: acts = [], isLoading } = useActs();
  const generateAct = useGenerateAct();
  const { toast } = useToast();
  const [date, setDate] = useState<Date>();
  const [isDialogOpen, setIsDialogOpen] = useState(false);

  const handleGenerate = async () => {
    if (!date) return;
    
    try {
      // For demo, just use same day as start/end
      await generateAct.mutateAsync({
        dateStart: format(date, 'yyyy-MM-dd'),
        dateEnd: format(date, 'yyyy-MM-dd'),
      });
      setIsDialogOpen(false);
      toast({ title: "Success", description: "AOSR Act generated successfully" });
    } catch (error) {
      toast({ title: "Error", description: "Failed to generate act", variant: "destructive" });
    }
  };

  return (
    <div className="flex flex-col min-h-screen bg-background bg-grain">
      <Header title="Executive Acts" />
      
      <div className="flex-1 px-4 py-6 pb-24 max-w-md mx-auto w-full">
        {isLoading ? (
           <div className="flex justify-center py-12">
             <Loader2 className="h-8 w-8 animate-spin text-primary" />
           </div>
        ) : (
          <div className="space-y-4">
            {acts.length === 0 ? (
              <div className="text-center py-16 space-y-4">
                <div className="bg-muted/50 w-20 h-20 rounded-full flex items-center justify-center mx-auto">
                  <FileText className="h-10 w-10 text-muted-foreground/50" />
                </div>
                <div className="space-y-1">
                  <h3 className="font-semibold text-lg">No Acts Yet</h3>
                  <p className="text-sm text-muted-foreground max-w-[200px] mx-auto">Generate your first AOSR document based on logged work.</p>
                </div>
              </div>
            ) : (
              acts.map((act, idx) => (
                <motion.div
                  key={act.id}
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ delay: idx * 0.1 }}
                >
                  <Card className="overflow-hidden group hover:border-primary/50 transition-all cursor-pointer">
                    <CardHeader className="p-4 pb-2 flex flex-row items-center justify-between space-y-0">
                      <div className="flex items-center gap-3">
                        <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center text-primary">
                          <FileText className="h-5 w-5" />
                        </div>
                        <div>
                          <CardTitle className="text-base">Act #{act.id}</CardTitle>
                          <CardDescription className="text-xs">
                            {act.dateStart ? format(new Date(act.dateStart), "MMM d, yyyy") : "No date"}
                          </CardDescription>
                        </div>
                      </div>
                      <Badge variant={act.status === 'signed' ? 'default' : 'secondary'} className="capitalize">
                        {act.status}
                      </Badge>
                    </CardHeader>
                    <CardContent className="p-4 pt-2">
                      <div className="flex items-center justify-between mt-2">
                        <span className="text-xs text-muted-foreground">
                          {act.worksData?.length || 0} work items
                        </span>
                        <Button variant="ghost" size="sm" className="h-8 text-xs gap-1 group-hover:text-primary">
                          Download <Download className="h-3 w-3" />
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                </motion.div>
              ))
            )}
          </div>
        )}
      </div>

      <div className="fixed bottom-20 right-4 z-40 md:right-[max(1rem,calc(50vw-220px))]">
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button className="h-14 rounded-full shadow-xl bg-primary hover:bg-primary/90 pl-5 pr-6 gap-2">
              <Plus className="h-5 w-5" />
              <span className="font-semibold">Generate Act</span>
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-md rounded-2xl">
            <DialogHeader>
              <DialogTitle>Generate AOSR</DialogTitle>
            </DialogHeader>
            <div className="py-6 space-y-4">
              <div className="grid gap-2">
                <label className="text-sm font-medium">Select Date</label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant={"outline"}
                      className={cn(
                        "w-full justify-start text-left font-normal h-12 rounded-xl",
                        !date && "text-muted-foreground"
                      )}
                    >
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {date ? format(date, "PPP") : <span>Pick a date</span>}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar
                      mode="single"
                      selected={date}
                      onSelect={setDate}
                      initialFocus
                    />
                  </PopoverContent>
                </Popover>
              </div>
              <Button 
                onClick={handleGenerate} 
                className="w-full h-12 rounded-xl"
                disabled={!date || generateAct.isPending}
              >
                {generateAct.isPending ? "Generating..." : "Generate Document"}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <BottomNav />
    </div>
  );
}
