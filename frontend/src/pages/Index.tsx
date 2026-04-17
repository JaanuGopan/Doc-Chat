import { Message as ChatMessage, ChatPanel } from "@/components/ChatPanel";
import { IngestionState, IngestionStatus } from "@/components/IngestionStatus";
import { ModelProvider } from "@/components/ModelSelector";
import { Auth } from "@/components/Auth";
import { useAuth } from "@/context/AuthContext";
import { supabase } from "@/lib/supabase";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";

type Source = "file" | "text";

const BACKEND_URL = "http://localhost:8000";

/** Simple MD5-like hash for frontend duplicate detection */
async function computeFileHash(file: File): Promise<string> {
  const buffer = await file.arrayBuffer();
  const hashBuffer = await crypto.subtle.digest('SHA-256', buffer);
  return Array.from(new Uint8Array(hashBuffer))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
}

const Index = () => {
  const { user, isLoading: isAuthLoading, signOut } = useAuth();
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [thinkingEnabled, setThinkingEnabled] = useState(false);
  const [pdfUrl, setPdfUrl] = useState<string | null>(null);

  // Persistence
  const [activeDocId, setActiveDocId] = useState<string | null>(null);
  const [userDocs, setUserDocs] = useState<any[]>([]);
  const [isDocsLoading, setIsDocsLoading] = useState(false);

  // RAG State
  const [ingestionState, setIngestionState] = useState<IngestionState>("idle");
  const [chunkCount, setChunkCount] = useState<number>(0);
  const [ingestionError, setIngestionError] = useState<string>("");

  // Model selection
  const [modelProvider, setModelProvider] = useState<ModelProvider>("groq");
  const [localModel, setLocalModel] = useState("qwen/qwen3.5-2b");

  // Fetch user documents on load
  useEffect(() => {
    if (user) {
      fetchUserDocuments();
    }
  }, [user]);

  async function fetchUserDocuments() {
    if (!user) return;
    setIsDocsLoading(true);
    try {
      const resp = await fetch(`${BACKEND_URL}/documents/${user.id}`);
      const data = await resp.json();
      if (data.documents) {
        setUserDocs(data.documents);
      }
    } catch (err) {
      console.error("Failed to fetch documents:", err);
    } finally {
      setIsDocsLoading(false);
    }
  }

  // PDF object URL
  useEffect(() => {
    if (selectedFile && selectedFile.type === "application/pdf") {
      const url = URL.createObjectURL(selectedFile);
      setPdfUrl(url);
      return () => URL.revokeObjectURL(url);
    }
    setPdfUrl(null);
  }, [selectedFile]);

  // ── Auto-ingest when file is chosen ─────────────────────────────────────────
  const isInternalChange = useRef(false);

  useEffect(() => {
    if (selectedFile && !isInternalChange.current) {
      runIngestion({ file: selectedFile });
    }
    isInternalChange.current = false;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedFile]);

  async function runIngestion({
    file,
    text,
  }: {
    file?: File;
    text?: string;
  }) {
    if (!user) return;

    setIngestionState("indexing");
    setChunkCount(0);
    setIngestionError("");
    setChatMessages([
      {
        id: "welcome",
        type: "system",
        content: "Processing document…",
      },
    ]);

    try {
      let documentId = "";
      
      // 1. Hash check (duplicate detection)
      let hash = "";
      if (file) {
        hash = await computeFileHash(file);
        const existing = userDocs.find(d => d.file_hash === hash);
        if (existing) {
          toast.success("Document already exists! Loading indexed data...");
          setActiveDocId(existing.id);
          setChunkCount(existing.chunk_count);
          setIngestionState("ready");
          setChatMessages([{ id: "ready", type: "system", content: `✅ This document is already indexed (${existing.chunk_count} chunks). Ready to chat!` }]);
          return;
        }
      }

      // 2. Upload to Supabase Storage first
      let storagePath = "";
      if (file) {
        const fileExt = file.name.split('.').pop();
        const fileName = `${Math.random()}.${fileExt}`;
        const filePath = `${user.id}/${fileName}`;
        
        const { error: uploadError } = await supabase.storage
          .from('documents')
          .upload(filePath, file);

        if (uploadError) throw uploadError;
        storagePath = filePath;
      }

      // 3. Create document record in DB
      const { data: newDoc, error: docError } = await supabase
        .from('documents')
        .insert([{
          user_id: user.id,
          filename: file ? file.name : "pasted-text",
          file_hash: hash,
          storage_path: storagePath,
          chunk_count: 0
        }])
        .select()
        .single();

      if (docError) throw docError;
      documentId = newDoc.id;
      setActiveDocId(documentId);

      // 4. Trigger backend ingestion
      const formData = new FormData();
      formData.append("user_id", user.id);
      formData.append("document_id", documentId);
      if (file) {
        formData.append("file", file);
      } else if (text) {
        formData.append("text_content", text);
        formData.append("filename", "pasted-text.txt");
      }

      const resp = await fetch(`${BACKEND_URL}/ingest/`, {
        method: "POST",
        body: formData,
      });
      const data = await resp.json();

      if (!resp.ok || data.error) {
        throw new Error(data.error ?? "Ingestion failed");
      }

      setChunkCount(data.chunk_count);
      setIngestionState("ready");
      setChatMessages([
        {
          id: "ready",
          type: "system",
          content: `✅ Document indexed into **${data.chunk_count} chunks**. Ask me anything about it!`,
        },
      ]);
      fetchUserDocuments(); // Refresh list
    } catch (err: any) {
      setIngestionState("error");
      setIngestionError(err.message ?? "Unknown error");
      setChatMessages([{ id: "error", type: "system", content: `❌ Indexing failed: ${err.message}` }]);
    }
  }

  // ── Chat ─────────────────────────────────────────────────────────────────────
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([
    {
      id: "welcome",
      type: "system",
      content: "Welcome to Doc-Chat! Click the **+** button to upload a document and start chatting.",
    },
  ]);
  const [isChatLoading, setIsChatLoading] = useState(false);

  const handleSendMessage = async (message: string) => {
    if (!activeDocId) {
      toast.error("Please select or upload a document first.");
      return;
    }
    setIsChatLoading(true);

    const userMessageId = Date.now().toString();
    setChatMessages((prev) => [
      ...prev,
      { id: userMessageId, type: "user", content: message },
    ]);

    try {
      const formData = new FormData();
      formData.append("document_id", activeDocId);
      formData.append("question", message);
      formData.append("model_provider", modelProvider);
      formData.append("local_model", localModel);
      formData.append("use_thinking", thinkingEnabled ? "true" : "false");

      const resp = await fetch(`${BACKEND_URL}/chat/`, {
        method: "POST",
        body: formData,
      });
      const result = await resp.json();

      setChatMessages((prev) => [
        ...prev,
        {
          id: (Date.now() + 1).toString(),
          type: "system" as const,
          content: result.answer || result.error || "No answer.",
          references: result.references ?? [],
        },
      ]);
    } catch {
      setChatMessages((prev) => [
        ...prev,
        { id: (Date.now() + 1).toString(), type: "system", content: "Error contacting backend." },
      ]);
    }
    setIsChatLoading(false);
  };

  const handleClearChat = () => setChatMessages([]);

  const handleRemoveFile = async () => {
    if (!activeDocId) return;
    try {
      await fetch(`${BACKEND_URL}/document/${activeDocId}`, { method: "DELETE" });
      
      const doc = userDocs.find(d => d.id === activeDocId);
      if (doc?.storage_path) {
        await supabase.storage.from('documents').remove([doc.storage_path]);
      }

      setIngestionState("idle");
      setActiveDocId(null);
      setSelectedFile(null);
      setChunkCount(0);
      setChatMessages([{ id: "welcome", type: "system", content: "Document removed. Upload a new one to continue." }]);
      fetchUserDocuments();
    } catch (err: any) {
      toast.error("Failed to remove document");
    }
  };

  const handleSelectExisting = (doc: any) => {
    setActiveDocId(doc.id);
    setChunkCount(doc.chunk_count);
    setIngestionState("ready");
    setChatMessages([{ id: "ready", type: "system", content: `✅ Document "**${doc.filename}**" loaded. Ask me anything!` }]);
    
    isInternalChange.current = true;
    setSelectedFile(null);
  };

  if (isAuthLoading) {
    return (
      <div className="h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!user) {
    return <Auth />;
  }

  return (
    <div className="min-h-screen bg-background text-foreground transition-colors duration-300 relative selection:bg-primary/20">
      <div className="container mx-auto px-4 py-8 max-w-4xl h-screen flex flex-col">
        <div className="flex-1 min-h-0 flex flex-col items-center">
            <div className="w-full max-w-3xl flex-1 min-h-0">
              <ChatPanel
                messages={chatMessages}
                onSendMessage={handleSendMessage}
                onClearChat={handleClearChat}
                isLoading={isChatLoading}
                disabled={ingestionState === "indexing"}
                pdfFile={selectedFile}
                onFileSelect={setSelectedFile}
                onRemoveFile={handleRemoveFile}
                thinkingEnabled={thinkingEnabled}
                onThinkingToggle={setThinkingEnabled}
                modelProvider={modelProvider}
                onModelProviderChange={setModelProvider}
                localModel={localModel}
                onLocalModelChange={setLocalModel}
                activeDocumentId={activeDocId}
                userDocuments={userDocs}
                onSelectDocument={handleSelectExisting}
                onSignOut={signOut}
                placeholder={
                  ingestionState === "indexing"
                    ? "Indexing document…"
                    : "Ask anything about the document…"
                }
              />
            </div>

            <div className="w-full max-w-2xl mt-4">
              <IngestionStatus
                state={ingestionState}
                chunkCount={chunkCount}
                errorMessage={ingestionError}
              />
            </div>
        </div>

        <footer className="py-4 text-center shrink-0">
          <p className="text-[11px] text-muted-foreground opacity-60 font-medium uppercase tracking-widest">
            Experimental System · RAG Pipeline v2.0
          </p>
        </footer>
      </div>
    </div>
  );
};

export default Index;
