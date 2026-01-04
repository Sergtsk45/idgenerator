import { Message } from "@shared/schema";
import { cn } from "@/lib/utils";
import { Bot, User, CheckCheck, Loader2, AlertCircle } from "lucide-react";
import { format } from "date-fns";
import { Badge } from "@/components/ui/badge";

interface MessageBubbleProps {
  message: Message;
  isProcessing?: boolean;
}

export function MessageBubble({ message, isProcessing }: MessageBubbleProps) {
  const hasData = !!message.normalizedData;
  const isPending = !message.isProcessed;

  return (
    <div className="space-y-2 mb-6">
      {/* User Message */}
      <div className="flex justify-end pl-8">
        <div className="bg-primary/10 text-primary-foreground p-3 rounded-2xl rounded-tr-sm max-w-[85%] shadow-sm">
          <p className="text-sm text-foreground">{message.messageRaw}</p>
          <div className="flex justify-end items-center gap-1 mt-1 text-[10px] text-muted-foreground/70">
            <span>{format(new Date(message.createdAt || new Date()), "HH:mm")}</span>
            {isPending ? (
              <Loader2 className="h-3 w-3 animate-spin" />
            ) : (
              <CheckCheck className="h-3 w-3 text-green-500" />
            )}
          </div>
        </div>
      </div>

      {/* System Response / Processed Data */}
      {(hasData || isProcessing) && (
        <div className="flex justify-start pr-8">
          <div className="flex gap-2 max-w-[90%]">
            <div className="h-8 w-8 rounded-full bg-secondary flex items-center justify-center shrink-0 border border-border">
              <Bot className="h-4 w-4 text-secondary-foreground" />
            </div>
            
            <div className="space-y-2">
              <div className="bg-card border border-border/50 p-3 rounded-2xl rounded-tl-sm shadow-sm">
                {isProcessing ? (
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Analyzing work log...
                  </div>
                ) : hasData ? (
                  <div className="space-y-2">
                    <div className="flex items-center justify-between gap-4">
                      <span className="text-xs font-semibold text-primary uppercase tracking-wider">Matched Work</span>
                      <Badge variant="outline" className="text-[10px] h-5">{message.normalizedData?.workCode}</Badge>
                    </div>
                    <p className="text-sm font-medium">{message.normalizedData?.workDescription}</p>
                    
                    <div className="grid grid-cols-2 gap-2 mt-2 pt-2 border-t border-border/50">
                      <div>
                        <span className="text-[10px] text-muted-foreground block">Quantity</span>
                        <span className="text-sm font-mono">
                          {message.normalizedData?.quantity} {message.normalizedData?.unit}
                        </span>
                      </div>
                      <div>
                        <span className="text-[10px] text-muted-foreground block">Date</span>
                        <span className="text-sm font-mono">{message.normalizedData?.date || "Today"}</span>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="flex items-center gap-2 text-sm text-destructive">
                    <AlertCircle className="h-4 w-4" />
                    Could not identify work item.
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
