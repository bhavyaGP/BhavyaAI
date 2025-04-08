import { cn } from "@/lib/utils";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { ThumbsUp, ThumbsDown, Loader2 } from "lucide-react";
import { useState } from "react";
import ReactMarkdown from 'react-markdown';

interface ChatMessageProps {
  message: string;
  isBot?: boolean;
  timestamp?: string;
  status?: 'sending' | 'sent' | 'error';
}

export function ChatMessage({ message, isBot = false, timestamp, status = 'sent' }: ChatMessageProps) {
  const [reaction, setReaction] = useState<'like' | 'dislike' | null>(null);

  return (
    <div
      className={cn(
        "group flex w-full gap-3 p-4 relative",
        isBot ? "bg-muted/50" : "bg-background"
      )}
    >
      <Avatar className="h-8 w-8">
        <AvatarImage src={isBot ? "/bot-avatar.png" : "/user-avatar.png"} />
        <AvatarFallback className={cn(
          isBot ? "bg-primary/20 text-primary" : "bg-secondary/20 text-secondary"
        )}>
          {isBot ? "B" : "U"}
        </AvatarFallback>
      </Avatar>
      <div className="flex flex-col gap-2 flex-1">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium">
            {isBot ? "Chatbot" : "You"}
          </span>
          {timestamp && (
            <span className="text-xs text-muted-foreground">{timestamp}</span>
          )}
          {status === 'sending' && (
            <Loader2 className="h-3 w-3 animate-spin text-muted-foreground" />
          )}
        </div>
        <div className={cn(
          "rounded-lg p-3",
          isBot ? "bg-muted" : "bg-primary/5"
        )}>
          <div className="prose dark:prose-invert max-w-none">
            <ReactMarkdown>{message}</ReactMarkdown>
          </div>
        </div>
        {isBot && (
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