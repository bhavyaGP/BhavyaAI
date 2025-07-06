import { cn } from "@/lib/utils";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { ThumbsUp, ThumbsDown, Loader2, Command } from "lucide-react";
import { useState } from "react";

interface ChatMessageProps {
  message: string;
  isBot?: boolean;
  timestamp?: string;
  status?: 'sending' | 'sent' | 'error';
  isCommand?: boolean;
}

export function ChatMessage({ message, isBot = false, timestamp, status = 'sent', isCommand = false }: ChatMessageProps) {
  const [reaction, setReaction] = useState<'like' | 'dislike' | null>(null);

  return (
    <div
      className={cn(
        "group flex w-full gap-3 p-4 relative",
        isBot ? "bg-muted/50" : "bg-background",
        isCommand && "bg-primary/5 border-l-4 border-primary"
      )}
    >
      <Avatar className="h-8 w-8">
        <AvatarFallback className={cn(
          isBot ? "bg-primary/20 text-primary" : "bg-secondary/20 text-secondary",
          isCommand && "bg-primary text-primary-foreground"
        )}>
          {isCommand ? <Command className="h-4 w-4" /> : (isBot ? "B" : "U")}
        </AvatarFallback>
      </Avatar>
      <div className="flex flex-col gap-2 flex-1">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium">
            {isCommand ? "Command" : (isBot ? "BhavyaAI" : "You")}
          </span>
          {timestamp && (
            <span className="text-xs text-muted-foreground">{timestamp}</span>
          )}
          {status === 'sending' && (
            <Loader2 className="h-3 w-3 animate-spin text-muted-foreground" />
          )}
          {status === 'error' && (
            <span className="text-xs text-destructive">Failed</span>
          )}
        </div>
        <div className={cn(
          "rounded-lg p-3",
          isBot ? "bg-muted" : "bg-primary/5",
          isCommand && "bg-primary/10 border border-primary/20"
        )}>
          <div className="whitespace-pre-wrap break-words">
            {message}
          </div>
        </div>
        {isBot && !isCommand && (
          <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
            <button
              onClick={() => setReaction(reaction === 'like' ? null : 'like')}
              className={cn(
                "p-1 rounded-full transition-colors",
                reaction === 'like' ? "text-primary" : "text-muted-foreground hover:text-primary"
              )}
            >
              <ThumbsUp className="h-4 w-4" />
            </button>
            <button
              onClick={() => setReaction(reaction === 'dislike' ? null : 'dislike')}
              className={cn(
                "p-1 rounded-full transition-colors",
                reaction === 'dislike' ? "text-destructive" : "text-muted-foreground hover:text-destructive"
              )}
            >
              <ThumbsDown className="h-4 w-4" />
            </button>
          </div>
        )}
      </div>
    </div>
  );
}