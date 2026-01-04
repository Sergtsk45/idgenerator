import { useState, useRef, useEffect } from "react";
import { BottomNav } from "@/components/BottomNav";
import { Header } from "@/components/Header";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useMessages, useCreateMessage, useProcessMessage } from "@/hooks/use-messages";
import { MessageBubble } from "@/components/MessageBubble";
import { Send, Mic, Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { motion, AnimatePresence } from "framer-motion";

export default function Home() {
  const [inputValue, setInputValue] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);
  const { data: messages = [], isLoading } = useMessages();
  const createMessage = useCreateMessage();
  const processMessage = useProcessMessage();
  const { toast } = useToast();

  const currentUser = "user_123"; // Mock user ID

  // Auto-scroll to bottom on new messages
  useEffect(() => {
    if (scrollRef.current) {
      const scrollElement = scrollRef.current.querySelector('[data-radix-scroll-area-viewport]');
      if (scrollElement) {
        scrollElement.scrollTop = scrollElement.scrollHeight;
      }
    }
  }, [messages]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputValue.trim()) return;

    try {
      const newMessage = await createMessage.mutateAsync({
        userId: currentUser,
        messageRaw: inputValue,
      });
      
      setInputValue("");
      
      // Simulate processing delay for effect
      setTimeout(() => {
        processMessage.mutate(newMessage.id);
      }, 1000);
      
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to send message",
        variant: "destructive",
      });
    }
  };

  return (
    <div className="flex flex-col min-h-screen bg-background bg-grain">
      <Header title="Daily Work Log" />
      
      <ScrollArea ref={scrollRef} className="flex-1 px-4 py-6 mb-20">
        <div className="max-w-md mx-auto min-h-[calc(100vh-12rem)] flex flex-col justify-end">
          {isLoading ? (
            <div className="flex justify-center items-center py-10">
              <Loader2 className="h-8 w-8 animate-spin text-primary/50" />
            </div>
          ) : messages.length === 0 ? (
            <div className="text-center py-20 opacity-50">
              <div className="bg-muted w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4">
                <Mic className="h-8 w-8 text-muted-foreground" />
              </div>
              <h3 className="font-semibold text-lg">No logs yet</h3>
              <p className="text-sm text-muted-foreground mt-1">Tap the microphone or type to log completed work.</p>
            </div>
          ) : (
            <AnimatePresence initial={false}>
              {messages.map((msg) => (
                <motion.div
                  key={msg.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.3 }}
                >
                  <MessageBubble message={msg} isProcessing={createMessage.isPending && !msg.isProcessed} />
                </motion.div>
              ))}
            </AnimatePresence>
          )}
        </div>
      </ScrollArea>

      <div className="fixed bottom-[4.5rem] left-0 right-0 p-4 bg-background/80 backdrop-blur-md border-t border-border/50">
        <form onSubmit={handleSubmit} className="max-w-md mx-auto flex gap-2 items-end">
          <div className="relative flex-1">
            <Textarea 
              placeholder="E.g., Poured concrete for foundation, 25m3..." 
              className="resize-none min-h-[52px] max-h-[120px] pr-10 rounded-2xl border-border/50 shadow-sm focus-visible:ring-primary/20 bg-background"
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  handleSubmit(e);
                }
              }}
            />
            <Button 
              type="button" 
              variant="ghost" 
              size="icon" 
              className="absolute right-1 bottom-1 text-muted-foreground hover:text-primary"
            >
              <Mic className="h-5 w-5" />
            </Button>
          </div>
          <Button 
            type="submit" 
            size="icon" 
            className="h-[52px] w-[52px] rounded-2xl shadow-lg shadow-primary/20"
            disabled={!inputValue.trim() || createMessage.isPending}
          >
            {createMessage.isPending ? (
              <Loader2 className="h-5 w-5 animate-spin" />
            ) : (
              <Send className="h-5 w-5" />
            )}
          </Button>
        </form>
      </div>

      <BottomNav />
    </div>
  );
}
