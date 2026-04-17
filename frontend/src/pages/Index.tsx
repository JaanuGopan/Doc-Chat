import { ChatPanel, Message as ChatMessage } from "@/components/ChatPanel";
import { FileUpload } from "@/components/FileUpload";
import { TextInput } from "@/components/TextInput";
import { ModelSelector, ModelProvider } from "@/components/ModelSelector";
import { Card, CardContent } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { ModeToggle } from "@/components/ModeToggle";
import { useState, useEffect } from "react";

type Source = "file" | "text";

const Index = () => {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [textContent, setTextContent] = useState("");
  const [activeSource, setActiveSource] = useState<Source>("file");
  const [pdfUrl, setPdfUrl] = useState<string | null>(null);

  // Model selection state
  const [modelProvider, setModelProvider] = useState<ModelProvider>("groq");
  const [localModel, setLocalModel] = useState("qwen/qwen3.5-2b");

  useEffect(() => {
    if (selectedFile && selectedFile.type === "application/pdf") {
      const url = URL.createObjectURL(selectedFile);
      setPdfUrl(url);
      return () => URL.revokeObjectURL(url);
    }
    setPdfUrl(null);
  }, [selectedFile]);

  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([
    {
      id: "welcome",
      type: "system",
      content:
        "Welcome to Doc-Chat! Upload a PDF or paste text to enable Q&A about your document. I'll answer using only your document.",
    },
  ]);

  const [isChatLoading, setIsChatLoading] = useState(false);

  // Ready when we have either a file or sufficient pasted text
  const isDocReady = Boolean(selectedFile) || textContent.trim().length > 0;

  const handleSendMessage = async (message: string) => {
    if (!isDocReady) return;
    setIsChatLoading(true);

    // Add user message to chat
    setChatMessages((prev) => [
      ...prev,
      { id: Date.now().toString(), type: "user", content: message },
    ]);

    try {
      const result = await askChatbot(message);
      setChatMessages((prev) => [
        ...prev,
        {
          id: (Date.now() + 1).toString(),
          type: "system" as const,
          content: result.answer || result.error || "No answer.",
          references: result.references ?? [],
        },
      ]);
    } catch (err) {
      setChatMessages((prev) => [
        ...prev,
        {
          id: (Date.now() + 1).toString(),
          type: "system",
          content: "Error contacting backend.",
        },
      ]);
    }
    setIsChatLoading(false);
  };

  const handleClearChat = () => {
    setChatMessages([]);
  };

  async function askChatbot(question: string) {
    const BACKEND_URL = "http://localhost:8000";
    const endpoint = `${BACKEND_URL}/chat/`;

    const formData = new FormData();
    if (activeSource === "file" && selectedFile) {
      formData.append("file", selectedFile);
    } else if (activeSource === "text" && textContent) {
      formData.append("text_content", textContent);
    } else if (selectedFile) {
      formData.append("file", selectedFile);
    } else if (textContent) {
      formData.append("text_content", textContent);
    }

    formData.append("question", question);
    formData.append("model_provider", modelProvider);
    formData.append("local_model", localModel);

    const response = await fetch(endpoint, {
      method: "POST",
      body: formData,
    });

    const data = await response.json();
    return data;
  }

  const providerLabel =
    modelProvider === "groq" ? "Groq (llama-3.3-70b)" : `Local · ${localModel}`;

  return (
    <div className="min-h-screen bg-background text-foreground transition-colors duration-300 relative">
      <div className="absolute top-4 right-4 md:top-8 md:right-8">
        <ModeToggle />
      </div>

      <div className="container mx-auto px-4 py-8 max-w-5xl">
        {/* Header */}
        <div className="text-center mb-10">
          <h1 className="text-3xl font-bold text-foreground mb-3">
            Doc-Chat
          </h1>
          <p className="text-lg text-muted-foreground mb-1">
            Upload a document or paste text, then ask anything.
          </p>
          <p className="text-sm text-muted-foreground">
            Powered by{" "}
            <span className="font-medium text-primary">{providerLabel}</span>
          </p>
        </div>

        {/* Main Content */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Left Column - Input sources */}
          <div className="space-y-6">
            <Card className="border-border">
              <CardContent className="p-6">
                <div className="flex flex-col gap-6">
                  <FileUpload
                    onFileSelect={setSelectedFile}
                    selectedFile={selectedFile}
                    onClearFile={() => setSelectedFile(null)}
                  />

                  <div className="text-center text-sm font-bold text-muted-foreground">OR</div>

                  <TextInput value={textContent} onChange={setTextContent} />
                </div>

                {/* Source Selection */}
                {selectedFile && textContent.trim().length > 0 && (
                  <div className="mt-6 pt-6 border-t border-border">
                    <RadioGroup
                      value={activeSource}
                      onValueChange={setActiveSource as any}
                    >
                      <div className="flex items-center space-x-6 flex-wrap">
                        <Label className="text-sm font-medium w-full mb-2">
                          Use this source:
                        </Label>
                        <div className="flex items-center space-x-2">
                          <RadioGroupItem value="file" id="source-file" />
                          <Label htmlFor="source-file" className="text-sm">
                            Uploaded file
                          </Label>
                        </div>
                        <div className="flex items-center space-x-2">
                          <RadioGroupItem value="text" id="source-text" />
                          <Label htmlFor="source-text" className="text-sm">
                            Pasted text
                          </Label>
                        </div>
                      </div>
                    </RadioGroup>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Model Selector Card */}
            <Card className="border-border">
              <CardContent className="p-6">
                <ModelSelector
                  value={modelProvider}
                  onChange={setModelProvider}
                  localModel={localModel}
                  onLocalModelChange={setLocalModel}
                />
              </CardContent>
            </Card>
          </div>

          {/* Right Column - Chat */}
          <div className="lg:col-span-1">
            <div className="h-[500px] sm:h-[600px] lg:h-[700px] w-full">
              <ChatPanel
                messages={chatMessages}
                onSendMessage={handleSendMessage}
                onClearChat={handleClearChat}
                isLoading={isChatLoading}
                disabled={!isDocReady}
                pdfFile={selectedFile}
                placeholder={
                  isDocReady
                    ? "Ask about this document…"
                    : "Upload a PDF or paste text first."
                }
              />
            </div>
          </div>
        </div>

        {/* Footer */}
        <footer className="mt-16 pt-8 border-t border-border text-center">
          <div className="flex justify-center space-x-6 text-sm text-muted-foreground">
            <a href="#" className="hover:text-primary transition-colors">
              Privacy
            </a>
            <a href="#" className="hover:text-primary transition-colors">
              Model &amp; Limitations
            </a>
          </div>
        </footer>
      </div>
    </div>
  );
};

export default Index;
