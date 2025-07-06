import { useState, useEffect } from "react";
import { Send, Loader2, Command } from "lucide-react";
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
  "What are your capabilities?",
  "Try @reset, @summarize, or @explain [topic]"
];

const availableCommands = [
  { command: "@reset", description: "Clear conversation history" },
  { command: "@summarize", description: "Summarize our conversation" },
  { command: "@explain", description: "Get detailed explanation of any topic", usage: "@explain [topic]", examples: ["@explain machine learning", "@explain photosynthesis", "@explain blockchain"] }
];

export function ChatInput({ onSend, disabled }: ChatInputProps) {
  const [message, setMessage] = useState("");
  const [currentPlaceholder, setCurrentPlaceholder] = useState(placeholderSuggestions[0]);
  const maxLength = 1000;

  // Filter commands based on current input
  const getFilteredCommands = () => {
    if (!message.startsWith('@')) return [];
    
    const input = message.toLowerCase();
    return availableCommands.filter(cmd => 
      cmd.command.toLowerCase().startsWith(input)
    );
  };

  const filteredCommands = getFilteredCommands();
  const isCommand = message.startsWith('@');

  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentPlaceholder(prev => {
        const currentIndex = placeholderSuggestions.indexOf(prev);
        const nextIndex = (currentIndex + 1) % placeholderSuggestions.length;
        return placeholderSuggestions[nextIndex];
      });
    }, 4000);

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
    
    // Handle Tab for command completion
    if (e.key === 'Tab' && filteredCommands.length === 1) {
      e.preventDefault();
      const command = filteredCommands[0];
      if (command.command === '@explain') {
        setMessage('@explain ');
      } else {
        setMessage(command.command);
      }
    }
  };

  const handleCommandClick = (command: string) => {
    if (command === '@explain') {
      setMessage('@explain ');
    } else {
      setMessage(command);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-3">
      {/* Command Helper */}
      {isCommand && (
        <div className="animate-in slide-in-from-bottom-2 duration-200">
          <div className="bg-muted/50 border rounded-lg p-3 text-sm">
            <div className="flex items-center gap-2 font-medium text-muted-foreground mb-2">
              <Command className="h-4 w-4" />
              {filteredCommands.length === 0 ? 'No matching commands' : 
               filteredCommands.length === 1 ? 'Command Match:' : 'Available Commands:'}
            </div>
            {filteredCommands.length > 0 ? (
              <div className="space-y-2 text-xs">
                {filteredCommands.map((cmd, index) => (
                  <div key={index} className="space-y-1">
                    <div className="flex items-center justify-between group">
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => handleCommandClick(cmd.command)}
                          className="text-left hover:bg-background/50 px-1 rounded transition-colors"
                        >
                          <code className="bg-background px-1 rounded">
                            {cmd.usage || cmd.command}
                          </code>
                        </button>
                        <span className="text-muted-foreground">- {cmd.description}</span>
                      </div>
                      {filteredCommands.length === 1 && (
                        <span className="text-muted-foreground opacity-60 text-[10px]">
                          Press Tab to complete
                        </span>
                      )}
                    </div>
                    {cmd.examples && filteredCommands.length === 1 && (
                      <div className="ml-4 space-y-1">
                        <div className="text-muted-foreground text-[10px] font-medium">Examples:</div>
                        {cmd.examples.map((example, exIndex) => (
                          <button
                            key={exIndex}
                            type="button"
                            onClick={() => setMessage(example)}
                            className="block text-left hover:bg-background/50 px-1 rounded transition-colors text-[10px] text-muted-foreground"
                          >
                            {example}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-xs text-muted-foreground">
                <div className="mb-2">Available commands:</div>
                <div className="space-y-1">
                  {availableCommands.map((cmd, index) => (
                    <div key={index} className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => handleCommandClick(cmd.command)}
                        className="text-left hover:bg-background/50 px-1 rounded transition-colors"
                      >
                        <code className="bg-background px-1 rounded text-muted-foreground">
                          {cmd.usage || cmd.command}
                        </code>
                      </button>
                      <span className="text-muted-foreground">- {cmd.description}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

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
            isCommand && "border-primary/50 bg-primary/5",
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
              isCommand && "bg-primary hover:bg-primary/90",
              disabled && "opacity-50 cursor-not-allowed"
            )}
            title={isCommand ? "Execute command" : "Send message"}
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
