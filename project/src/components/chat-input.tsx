import { useState, useEffect } from "react";
import { Send, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

interface ChatInputProps {
  onSend: (message: string) => void;
  disabled?: boolean;
}

const placeholderSuggestions = [
  "What can you help me with?",
  "Tell me about yourself",
  "How do I get started?",
  "What are your capabilities?"
];

export function ChatInput({ onSend, disabled }: ChatInputProps) {
  const [message, setMessage] = useState("");
  const [currentPlaceholder, setCurrentPlaceholder] = useState(placeholderSuggestions[0]);
  const maxLength = 1000;

  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentPlaceholder(prev => {
        const currentIndex = placeholderSuggestions.indexOf(prev);
        const nextIndex = (currentIndex + 1) % placeholderSuggestions.length;
        return placeholderSuggestions[nextIndex];
      });
    }, 3000);

    return () => clearInterval(interval);
  }, []);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (message.trim() && !disabled) {
      onSend(message);
      setMessage("");
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit(e);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-2">
      <div className="relative">
        <Textarea
          value={message}
          onChange={(e) => {
            setMessage(e.target.value);
          }}
          onKeyDown={handleKeyDown}
          placeholder={currentPlaceholder}
          className={cn(
            "min-h-[60px] pr-20 resize-none",
            "transition-all duration-200",
            "focus:ring-2 focus:ring-primary/20",
            disabled && "opacity-50 cursor-not-allowed"
          )}
          disabled={disabled}
          maxLength={maxLength}
        />
        <div className="absolute bottom-2 right-2 flex items-center gap-2">
          <span className={cn(
            "text-xs min-w-[48px] text-right",
            message.length > maxLength * 0.9 ? "text-destructive" : "text-muted-foreground"
          )}>
            {message.length}/{maxLength}
          </span>
          <Button
            type="submit"
            size="icon"
            disabled={disabled || !message.trim() || message.length > maxLength}
            className={cn(
              "h-8 w-8 flex-shrink-0",
              "transition-all duration-200",
              "hover:scale-110 active:scale-95",
              disabled && "opacity-50 cursor-not-allowed"
            )}
          >
            {disabled ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Send className="h-4 w-4" />
            )}
            <span className="sr-only">Send message</span>
          </Button>
        </div>
      </div>
    </form>
  );
}