import { Work } from "@shared/schema";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";

interface WorkItemCardProps {
  work: Work;
  onClick?: () => void;
}

export function WorkItemCard({ work, onClick }: WorkItemCardProps) {
  // Mock progress for now - could be calculated from completed acts
  const progress = Math.random() * 100;

  return (
    <Card 
      onClick={onClick}
      className="overflow-hidden border-border/50 hover:border-primary/50 transition-all active:scale-[0.98] cursor-pointer"
    >
      <CardContent className="p-4">
        <div className="flex justify-between items-start mb-2 gap-2">
          <div>
            <Badge variant="outline" className="mb-2 font-mono text-xs text-muted-foreground bg-muted/50">
              {work.code}
            </Badge>
            <h3 className="font-semibold text-sm leading-tight text-balance">{work.description}</h3>
          </div>
          <div className="text-right shrink-0">
            <span className="text-sm font-bold block">{Number(work.quantityTotal || 0).toLocaleString()}</span>
            <span className="text-xs text-muted-foreground">{work.unit}</span>
          </div>
        </div>
        
        <div className="mt-4 space-y-1">
          <div className="flex justify-between text-xs text-muted-foreground">
            <span>Progress</span>
            <span>{Math.round(progress)}%</span>
          </div>
          <Progress value={progress} className="h-1.5" />
        </div>
      </CardContent>
    </Card>
  );
}
