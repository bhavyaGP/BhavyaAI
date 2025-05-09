import { useState, useEffect, useRef } from "react";
import { ThemeProvider } from "@/components/theme-provider";
import { ThemeToggle } from "@/components/theme-toggle";
import { ChatMessage } from "@/components/chat-message";
import { ChatInput } from "@/components/chat-input";
import { Bot, Menu, X } from "lucide-react";
import axios from 'axios';
import { cn } from "@/lib/utils";

interface Message {
  text: string;
  isBot: boolean;
  timestamp: string;
  status?: 'sending' | 'sent' | 'error';
}

const suggestedQuestions = [
  "What can you help me with?",
  "Tell me about yourself",
  "How do I get started?",
  "What are your capabilities?"
];

function App() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const handleSendMessage = async (message: string) => {
    const newMessage: Message = {
      text: message,
      isBot: false,
      timestamp: new Date().toLocaleTimeString(),
      status: 'sending'
    };

    setMessages((prev) => [...prev, newMessage]);
    setLoading(true);
    try {
      const data = JSON.stringify({ question: message });
      
      const config = {
        method: 'post',
        maxBodyLength: Infinity,
        url: "https://bhavya-ai-uz8s.vercel.app/ask",
        headers: {
          'Content-Type': 'application/json',
        },
        data: data
      };

      const response = await axios.request(config);
      const botMessage: Message = {
        text: response.data.answer || "Sorry, I couldn't process that request.",
        isBot: true,
        timestamp: new Date().toLocaleTimeString(),
        status: 'sent'
      };

      setMessages((prev) => [...prev.slice(0, -1), { ...prev[prev.length - 1], status: 'sent' }, botMessage]);
    } catch (error) {
      const errorMessage: Message = {
        text: "Sorry, I'm having trouble connecting to the server.",
        isBot: true,
        timestamp: new Date().toLocaleTimeString(),
        status: 'error'
      };
      setMessages((prev) => [...prev.slice(0, -1), { ...prev[prev.length - 1], status: 'error' }, errorMessage]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <ThemeProvider defaultTheme="system" storageKey="chatbot-theme">
      <div className="flex flex-col min-h-screen">
        {/* Header */}
        <header className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
          <div className="container flex h-14 items-center justify-between">
            <button
              onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
              className="md:hidden mr-2 p-2 hover:bg-accent rounded-md transition-colors"
            >
              {isMobileMenuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
            </button>
            <div className="flex items-center gap-2 font-semibold mx-auto">
              <Bot className="h-6 w-6 animate-pulse" />
              <span className="text-2xl tracking-tight">BhavyaAI</span>
            </div>
            <div className="flex items-center space-x-4">
              <nav className={cn(
                "md:flex items-center space-x-4",
                isMobileMenuOpen
                  ? "absolute top-14 left-0 right-0 bg-background border-b p-4 flex flex-col space-y-4 md:space-y-0 md:relative md:top-0 md:border-none md:p-0 md:flex-row animate-in slide-in-from-top"
                  : "hidden"
              )}>
              </nav>
              <ThemeToggle />
            </div>
          </div>
        </header>

        {/* Main Content */}
        <main className="flex-1 container py-4 px-4 md:px-6 max-w-4xl mx-auto">
          <div className="flex flex-col h-[calc(100vh-8rem)]">
            {/* Chat Container */}
            <div className="flex-1 overflow-y-auto rounded-lg border bg-card shadow-lg mb-4 transition-all duration-200 ease-in-out hover:shadow-xl relative">
              <div className="absolute inset-0 bg-gradient-to-b from-primary/5 to-transparent pointer-events-none" />
              <div className="flex flex-col h-full">
                {messages.length === 0 ? (
                  <div className="flex-1 flex items-center justify-center p-8 text-center">
                    <div className="animate-in zoom-in duration-300">
                      <Bot className="h-12 w-12 mx-auto mb-4 text-muted-foreground animate-bounce" />
                      <h2 className="text-xl md:text-2xl font-semibold mb-2 bg-gradient-to-r from-primary to-primary/60 bg-clip-text text-transparent">
                        Welcome to Bhavya AI Chatbot! <span className="emoji">👾</span>
                      </h2>
                      <p className="text-muted-foreground text-sm md:text-base mb-6">
                        Start a conversation by typing a message below or try one of these suggestions:
                      </p>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                        {suggestedQuestions.map((question, index) => (
                          <button
                            key={index}
                            onClick={() => handleSendMessage(question)}
                            className="text-left p-3 rounded-lg border bg-background hover:bg-accent transition-colors text-sm"
                          >
                            {question}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="flex-1 overflow-y-auto p-4 space-y-4">
                    {messages.map((msg, index) => (
                      <div
                        key={index}
                        className={cn(
                          "animate-in slide-in-from-bottom-2 duration-300 relative",
                          "before:absolute before:left-0 before:right-0 before:h-px before:bg-gradient-to-r before:from-transparent before:via-primary/20 before:to-transparent before:-top-2",
                          "after:absolute after:left-0 after:right-0 after:h-px after:bg-gradient-to-r after:from-transparent after:via-primary/20 after:to-transparent after:-bottom-2"
                        )}
                        style={{
                          animationDelay: `${index * 150}ms`,
                          animationFillMode: 'backwards'
                        }}
                      >
                        <ChatMessage
                          message={msg.text}
                          isBot={msg.isBot}
                          timestamp={msg.timestamp}
                          status={msg.status}
                        />
                      </div>
                    ))}
                    <div ref={messagesEndRef} />
                  </div>
                )}
              </div>
            </div>

            {/* Chat Input */}
            <div className="bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 border rounded-lg p-4 transition-all duration-200 ease-in-out hover:shadow-md relative">
              <div className="absolute inset-0 bg-gradient-to-t from-primary/5 to-transparent pointer-events-none rounded-lg" />
              <ChatInput 
                onSend={handleSendMessage} 
                disabled={loading} 
              />
            </div>
          </div>
        </main>
      </div>
    </ThemeProvider>
  );
}

export default App;
