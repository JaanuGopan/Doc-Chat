import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { MessageCircle, Send, Trash2, FileText } from "lucide-react";
import { useState, useRef, useEffect } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { PdfViewerModal } from "@/components/PdfViewerModal";

export interface Reference {
  page: number;
  quote: string;
}

export interface Message {
  id: string;
  type: "user" | "system";
  content: string;
  references?: Reference[];
}

interface ChatPanelProps {
  messages: Message[];
  onSendMessage: (message: string) => void;
  onClearChat: () => void;
  isLoading?: boolean;
  disabled?: boolean;
  placeholder?: string;
  pdfFile?: File | null;
}

export const ChatPanel = ({
  messages,
  onSendMessage,
  onClearChat,
  isLoading = false,
  disabled = false,
  placeholder,
  pdfFile,
}: ChatPanelProps) => {
  const [inputValue, setInputValue] = useState("");
  const [viewerOpen, setViewerOpen] = useState(false);
  const [viewerPage, setViewerPage] = useState(1);
  const [viewerQuote, setViewerQuote] = useState("");
  const bottomRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to latest message
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isLoading]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (disabled || isLoading) return;
    if (inputValue.trim()) {
      onSendMessage(inputValue.trim());
      setInputValue("");
    }
  };

  const openPdfAt = (page: number, quote: string) => {
    setViewerPage(page);
    setViewerQuote(quote);
    setViewerOpen(true);
  };

  return (
    <>
      <Card className="h-full flex flex-col border-border">
        <CardHeader className="flex-shrink-0 pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base flex items-center gap-2">
              <MessageCircle className="h-5 w-5 text-primary" />
              Ask about this document
            </CardTitle>
            {messages.length > 0 && (
              <Button
                variant="ghost"
                size="sm"
                onClick={onClearChat}
                className="hover:bg-destructive/10 hover:text-destructive"
              >
                <Trash2 className="h-4 w-4 mr-1" />
                Clear
              </Button>
            )}
          </div>
          <p className="text-[13px] text-muted-foreground">
            Answers are grounded to your document. References link to exact pages.
          </p>
          {disabled && (
            <p className="text-xs text-muted-foreground mt-1">
              Upload a PDF or paste text to enable Q&amp;A.
            </p>
          )}
        </CardHeader>

        <CardContent className="flex-1 flex flex-col p-4 pt-0 min-h-0">
          <ScrollArea className="flex-1 mb-4 pr-1">
            <div className="space-y-4">
              {messages.length === 0 ? (
                <div className="text-center py-8">
                  <p className="text-[13px] text-muted-foreground mb-4">
                    No questions yet. Try asking about:
                  </p>
                  <div className="space-y-2">
                    {[
                      "What are the main findings?",
                      "How does the methodology work?",
                      "What are the key conclusions?",
                    ].map((s) => (
                      <div
                        key={s}
                        className="bg-muted rounded-md p-2 text-[13px] text-left cursor-pointer hover:bg-muted/80 transition-colors"
                        onClick={() => !disabled && onSendMessage(s)}
                      >
                        {s}
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                messages.map((message) => (
                  <div
                    key={message.id}
                    className={`flex flex-col ${message.type === "user" ? "items-end" : "items-start"}`}
                  >
                    <div
                      className={`max-w-[90%] sm:max-w-[85%] rounded-lg p-3 ${
                        message.type === "user"
                          ? "bg-black text-white"
                          : "bg-muted text-foreground"
                      }`}
                    >
                      <div className={`prose prose-sm max-w-none break-words overflow-x-auto text-[13px] [&_p]:text-[13px] [&_li]:text-[13px] [&_p]:my-1 [&_ul]:my-1 [&_h1]:text-sm [&_h2]:text-sm [&_h3]:text-sm ${message.type === "user" ? "prose-invert" : "dark:prose-invert"}`}>
                        <ReactMarkdown remarkPlugins={[remarkGfm]}>
                          {message.content}
                        </ReactMarkdown>
                      </div>
                    </div>

                    {/* References section */}
                    {message.references && message.references.length > 0 && (
                      <div className="mt-2 max-w-[90%] sm:max-w-[85%]">
                        <p className="text-[11px] text-muted-foreground mb-1 font-medium uppercase tracking-wide">
                          References
                        </p>
                        <div className="flex flex-wrap gap-1.5">
                          {message.references.map((ref, i) => (
                            <button
                              key={i}
                              onClick={() => pdfFile && openPdfAt(ref.page, ref.quote)}
                              disabled={!pdfFile}
                              title={ref.quote}
                              className={`inline-flex items-center gap-1 text-[11px] px-2 py-1 rounded border transition-colors ${
                                pdfFile
                                  ? "border-border bg-background hover:bg-muted cursor-pointer text-foreground"
                                  : "border-border bg-muted cursor-default text-muted-foreground"
                              }`}
                            >
                              <FileText className="h-3 w-3 shrink-0" />
                              <span className="font-medium">p.{ref.page}</span>
                              <span className="text-muted-foreground truncate max-w-[160px]">
                                "{ref.quote.slice(0, 50)}{ref.quote.length > 50 ? "…" : ""}"
                              </span>
                            </button>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                ))
              )}

              {isLoading && (
                <div className="flex justify-start">
                  <div className="bg-muted rounded-lg p-3">
                    <div className="flex items-center space-x-2">
                      <div className="flex space-x-1">
                        <div className="w-2 h-2 rounded-full bg-foreground/40 animate-bounce" />
                        <div className="w-2 h-2 rounded-full bg-foreground/40 animate-bounce" style={{ animationDelay: "0.1s" }} />
                        <div className="w-2 h-2 rounded-full bg-foreground/40 animate-bounce" style={{ animationDelay: "0.2s" }} />
                      </div>
                      <span className="text-[13px] text-muted-foreground">Thinking…</span>
                    </div>
                  </div>
                </div>
              )}
              <div ref={bottomRef} />
            </div>
          </ScrollArea>

          <form onSubmit={handleSubmit} className="flex gap-2">
            <Input
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              placeholder={placeholder ?? "Ask about this document…"}
              disabled={isLoading || disabled}
              className="flex-1 text-[13px]"
            />
            <Button
              type="submit"
              size="icon"
              disabled={!inputValue.trim() || isLoading || disabled}
            >
              <Send className="h-4 w-4" />
            </Button>
          </form>
        </CardContent>
      </Card>

      <PdfViewerModal
        open={viewerOpen}
        onClose={() => setViewerOpen(false)}
        file={pdfFile ?? null}
        initialPage={viewerPage}
        highlightText={viewerQuote}
      />
    </>
  );
};
