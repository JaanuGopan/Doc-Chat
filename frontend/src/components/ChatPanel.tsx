import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { MessageCircle, Send, Trash2, FileText, Plus, Upload, BrainCircuit, Settings2, History, LogOut } from "lucide-react";
import { useState, useRef, useEffect } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { PdfViewerModal } from "@/components/PdfViewerModal";
import { ModelSelector, ModelProvider } from "@/components/ModelSelector";
import { ModeToggle } from "@/components/ModeToggle";
import { supabase } from "@/lib/supabase";
import { toast } from "sonner";

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
  onFileSelect?: (file: File) => void;
  thinkingEnabled?: boolean;
  onThinkingToggle?: (enabled: boolean) => void;
  onRemoveFile?: () => void;
  modelProvider?: ModelProvider;
  onModelProviderChange?: (provider: ModelProvider) => void;
  localModel?: string;
  onLocalModelChange?: (model: string) => void;
  // New props for persistence
  activeDocumentId?: string | null;
  userDocuments?: any[];
  onSelectDocument?: (doc: any) => void;
  onSignOut?: () => void;
}

export const ChatPanel = ({
  messages,
  onSendMessage,
  onClearChat,
  isLoading = false,
  disabled = false,
  placeholder,
  pdfFile,
  onFileSelect,
  thinkingEnabled = false,
  onThinkingToggle,
  onRemoveFile,
  modelProvider = "groq",
  onModelProviderChange,
  localModel,
  onLocalModelChange,
  activeDocumentId,
  userDocuments = [],
  onSelectDocument,
  onSignOut,
}: ChatPanelProps) => {
  const [inputValue, setInputValue] = useState("");
  const [viewerOpen, setViewerOpen] = useState(false);
  const [viewerPage, setViewerPage] = useState(1);
  const [viewerQuote, setViewerQuote] = useState("");
  const [remotePdfUrl, setRemotePdfUrl] = useState<string | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to latest message
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isLoading]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (isLoading) return;
    if (inputValue.trim()) {
      onSendMessage(inputValue.trim());
      setInputValue("");
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file && onFileSelect) {
      onFileSelect(file);
      setMenuOpen(false);
    }
  };

  const activeDoc = userDocuments.find(d => d.id === activeDocumentId);

  const openPdfAt = async (page: number, quote: string) => {
    setViewerPage(page);
    setViewerQuote(quote);

    if (pdfFile) {
      setRemotePdfUrl(null);
      setViewerOpen(true);
    } else if (activeDoc?.storage_path) {
      // Get signed URL from Supabase
      const { data, error } = await supabase.storage
        .from('documents')
        .createSignedUrl(activeDoc.storage_path, 3600);
      
      if (error) {
        toast.error("Failed to fetch document download link");
        return;
      }
      setRemotePdfUrl(data.signedUrl);
      setViewerOpen(true);
    }
  };

  return (
    <>
      <Card className="h-full flex flex-col border-border glass-effect">
        <CardHeader className="flex-shrink-0 pb-3 border-b border-border/50">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base flex items-center gap-2">
              <MessageCircle className="h-5 w-5 text-primary" />
              Doc-Chat
            </CardTitle>
            <div className="flex items-center gap-1.5 md:gap-2">
              {(pdfFile || activeDoc) && (
                <Badge variant="outline" className="text-[10px] px-2 py-0.5 bg-primary/5 text-primary border-primary/20 max-w-[150px] md:max-w-[200px] flex items-center shrink-0 group hover:bg-primary/10 transition-colors cursor-default">
                  <FileText className="h-3 w-3 mr-1.5 shrink-0" />
                  <span className="truncate leading-none mr-1">{pdfFile?.name || activeDoc?.filename}</span>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onRemoveFile?.();
                    }}
                    className="ml-1 hover:bg-primary/20 rounded-full p-0.5 transition-colors"
                    title="Remove document"
                  >
                    <Plus className="h-3 w-3 rotate-45" />
                  </button>
                </Badge>
              )}

              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="ghost" size="sm" className="h-8 gap-2 px-2 hover:bg-muted text-muted-foreground hover:text-primary transition-colors" title="Document History">
                    <History className="h-4 w-4" />
                    <span className="text-[10px] font-bold uppercase tracking-wider hidden md:inline-block">History</span>
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-72 p-0" align="end">
                  <div className="p-3 border-b border-border bg-muted/30">
                    <h4 className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Indexed Documents</h4>
                  </div>
                  <ScrollArea className="h-64">
                    <div className="p-1">
                      {userDocuments.length === 0 ? (
                        <div className="p-4 text-center text-xs text-muted-foreground">No indexed documents yet</div>
                      ) : (
                        userDocuments.map((doc) => (
                          <button
                            key={doc.id}
                            onClick={() => onSelectDocument?.(doc)}
                            className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-md text-left transition-all ${
                              activeDocumentId === doc.id 
                                ? "bg-primary/10 text-primary border-primary/20" 
                                : "hover:bg-muted text-muted-foreground hover:text-foreground"
                            }`}
                          >
                            <FileText className="h-4 w-4 shrink-0" />
                            <div className="min-w-0 flex-1">
                              <p className="text-[13px] font-medium truncate">{doc.filename}</p>
                              <p className="text-[10px] opacity-60">
                                {new Date(doc.created_at).toLocaleDateString()} · {doc.chunk_count} chunks
                              </p>
                            </div>
                          </button>
                        ))
                      )}
                    </div>
                  </ScrollArea>
                </PopoverContent>
              </Popover>
              
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="ghost" size="sm" className="h-8 gap-2 px-2 hover:bg-muted text-muted-foreground hover:text-primary transition-colors" title="Settings">
                    <Settings2 className="h-4 w-4" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-80 p-4" align="end">
                  <div className="space-y-6">
                    <div>
                      <h4 className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground mb-4">Model Configuration</h4>
                      <ModelSelector
                        value={modelProvider}
                        onChange={onModelProviderChange!}
                        localModel={localModel}
                        onLocalModelChange={onLocalModelChange}
                      />
                    </div>
                    
                    <div className="pt-4 border-t border-border flex flex-col gap-2">
                      <div className="flex items-center justify-between px-1">
                        <span className="text-xs text-muted-foreground">Appearance</span>
                        <ModeToggle />
                      </div>
                      <Button 
                        variant="ghost" 
                        size="sm" 
                        onClick={onSignOut}
                        className="w-full justify-start h-9 text-destructive hover:bg-destructive/10 text-xs gap-3"
                      >
                        <LogOut className="h-4 w-4" />
                        Sign Out
                      </Button>
                    </div>
                  </div>
                </PopoverContent>
              </Popover>

              {messages.length > 0 && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={onClearChat}
                  className="h-8 hover:bg-destructive/10 hover:text-destructive text-[11px]"
                >
                  <Trash2 className="h-3.5 w-3.5 mr-1" />
                  Clear
                </Button>
              )}
            </div>
          </div>
        </CardHeader>

        <CardContent className="flex-1 flex flex-col p-4 pt-0 min-h-0 bg-muted/5">
          <ScrollArea className="flex-1 mb-4 pr-3 pt-4">
            <div className="space-y-4">
              {messages.length === 0 ? (
                <div className="text-center py-12 px-6">
                  <div className="bg-primary/10 w-12 h-12 rounded-full flex items-center justify-center mx-auto mb-4">
                    <MessageCircle className="h-6 w-6 text-primary" />
                  </div>
                  <h3 className="text-sm font-semibold mb-1">How can I help you today?</h3>
                  <p className="text-[12px] text-muted-foreground mb-6">
                    Upload a document and ask questions about its content.
                  </p>
                  <div className="grid grid-cols-1 gap-2 max-w-[280px] mx-auto">
                    {[
                      "Summarize the main points",
                      "Find key technical details",
                      "Explain the conclusions",
                    ].map((s) => (
                      <button
                        key={s}
                        className="bg-background border border-border rounded-lg p-2.5 text-[12px] text-left hover:border-primary/50 hover:bg-primary/5 transition-all"
                        onClick={() => onSendMessage(s)}
                      >
                        {s}
                      </button>
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
                      className={`max-w-[85%] rounded-2xl p-3.5 shadow-sm transition-all ${
                        message.type === "user"
                          ? "bg-black text-white rounded-tr-none"
                          : "bg-background border border-border text-foreground rounded-tl-none"
                      }`}
                    >
                      <div className={`prose prose-sm max-w-none break-words overflow-x-auto text-[13px] leading-relaxed [&_p]:my-1 [&_ul]:my-1 [&_h1]:text-sm [&_h2]:text-sm [&_h3]:text-sm ${message.type === "user" ? "prose-invert" : "dark:prose-invert"}`}>
                        <ReactMarkdown remarkPlugins={[remarkGfm]}>
                          {message.content}
                        </ReactMarkdown>
                      </div>
                    </div>

                    {message.references && message.references.length > 0 && (
                      <div className="mt-2 max-w-[85%] overflow-hidden">
                        <div className="flex flex-wrap gap-1.5">
                          {message.references.map((ref, i) => (
                            <button
                              key={i}
                              onClick={() => (pdfFile || activeDoc) && openPdfAt(ref.page, ref.quote)}
                              disabled={!pdfFile && !activeDoc}
                              className={`inline-flex items-center gap-1.5 text-[10px] px-2.5 py-1 rounded-full border transition-all ${
                                pdfFile || activeDoc
                                  ? "border-border bg-background hover:border-primary/30 hover:bg-primary/5 text-muted-foreground hover:text-primary"
                                  : "border-border bg-muted cursor-default text-muted-foreground opacity-50"
                              }`}
                            >
                              <FileText className="h-3 w-3" />
                              <span className="font-semibold">p.{ref.page}</span>
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
                  <div className="bg-background border border-border rounded-2xl rounded-tl-none p-3.5 shadow-sm">
                    <div className="flex items-center space-x-2.5">
                      <div className="flex space-x-1.5">
                        <div className="w-1.5 h-1.5 rounded-full bg-primary animate-bounce" style={{ animationDelay: "0ms" }} />
                        <div className="w-1.5 h-1.5 rounded-full bg-primary animate-bounce" style={{ animationDelay: "150ms" }} />
                        <div className="w-1.5 h-1.5 rounded-full bg-primary animate-bounce" style={{ animationDelay: "300ms" }} />
                      </div>
                      <span className="text-[12px] font-medium text-muted-foreground animate-pulse">Thinking…</span>
                    </div>
                  </div>
                </div>
              )}
              <div ref={bottomRef} className="h-2" />
            </div>
          </ScrollArea>

          <form onSubmit={handleSubmit} className="relative mt-2 flex items-center gap-2 bg-background border border-border rounded-2xl p-1.5 shadow-sm ring-offset-background focus-within:ring-2 focus-within:ring-primary/20 focus-within:border-primary/30 transition-all">
            <Popover open={menuOpen} onOpenChange={setMenuOpen}>
              <PopoverTrigger asChild>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="h-9 w-9 rounded-xl hover:bg-muted shrink-0 text-muted-foreground hover:text-primary"
                >
                  <Plus className="h-5 w-5" />
                </Button>
              </PopoverTrigger>
              <PopoverContent side="top" align="start" className="w-56 p-2 rounded-xl border-border shadow-lg">
                <div className="space-y-1">
                  <button
                    onClick={() => fileInputRef.current?.click()}
                    className="w-full flex items-center gap-2.5 px-3 py-2 text-[13px] rounded-lg hover:bg-muted transition-colors text-left"
                  >
                    <Upload className="h-4 w-4 text-primary" />
                    <span>Upload Document</span>
                  </button>
                  <div className="flex items-center justify-between px-3 py-2 rounded-lg hover:bg-muted transition-colors">
                    <div className="flex items-center gap-2.5">
                      <BrainCircuit className="h-4 w-4 text-amber-500" />
                      <span className="text-[13px]">Thinking Mode</span>
                    </div>
                    <Switch
                      checked={thinkingEnabled}
                      onCheckedChange={onThinkingToggle}
                      className="scale-90"
                    />
                  </div>
                </div>
              </PopoverContent>
            </Popover>

            <Input
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              placeholder={placeholder ?? "Type a message…"}
              className="flex-1 border-none bg-transparent focus-visible:ring-0 text-[13px] h-9 p-0 shadow-none"
            />
            
            <Button
              type="submit"
              size="icon"
              disabled={!inputValue.trim() || isLoading}
              className="h-9 w-9 rounded-xl shrink-0 shadow-none"
            >
              <Send className="h-4 w-4" />
            </Button>

            <input
              ref={fileInputRef}
              type="file"
              onChange={handleFileChange}
              className="hidden"
              accept=".pdf,.docx,.txt"
            />
          </form>
        </CardContent>
      </Card>

      <PdfViewerModal
        open={viewerOpen}
        onClose={() => setViewerOpen(false)}
        file={pdfFile || remotePdfUrl || null}
        filename={pdfFile?.name || activeDoc?.filename}
        initialPage={viewerPage}
        highlightText={viewerQuote}
      />
    </>
  );
};
