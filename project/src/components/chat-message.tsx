import { cn } from "@/lib/utils";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

interface ChatMessageProps {
  message: string;
  isBot?: boolean;
  timestamp?: string;
}

export function ChatMessage({ message, isBot = false, timestamp }: ChatMessageProps) {
  return (
    <div
      className={cn(
        "flex w-full gap-3 p-4",
        isBot ? "bg-muted/50" : "bg-background"
      )}
    >
      <Avatar className="h-8 w-8">
        <AvatarImage src={isBot ? "/bot-avatar.png" : "/user-avatar.png"} />
        <AvatarFallback>{isBot ? "B" : "U"}</AvatarFallback>
      </Avatar>
      <div className="flex flex-col gap-2">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium">
            {isBot ? "Chatbot" : "You"}
          </span>
          {timestamp && (
            <span className="text-xs text-muted-foreground">{timestamp}</span>
          )}
        </div>
        <p className="text-sm text-foreground">{message}</p>
      </div>
    </div>
  );
}