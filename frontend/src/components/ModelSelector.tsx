import { useState, useEffect } from "react";
import { Cpu, Cloud, CheckCircle2, XCircle, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

export type ModelProvider = "groq" | "local";

interface ModelSelectorProps {
  value: ModelProvider;
  onChange: (provider: ModelProvider) => void;
  localModel?: string;
  onLocalModelChange?: (model: string) => void;
}

interface LMStudioModel {
  id: string;
}

export const ModelSelector = ({
  value,
  onChange,
  localModel = "qwen/qwen3.5-2b",
  onLocalModelChange,
}: ModelSelectorProps) => {
  const [lmStatus, setLmStatus] = useState<"checking" | "online" | "offline">("checking");
  const [availableModels, setAvailableModels] = useState<LMStudioModel[]>([]);

  // Check LM Studio status on mount
  useEffect(() => {
    checkLMStatus();
  }, []);

  const checkLMStatus = async () => {
    setLmStatus("checking");
    try {
      const resp = await fetch("http://localhost:8000/local-status/");
      const data = await resp.json();
      setLmStatus(data.online ? "online" : "offline");
      if (data.online) {
        fetchLocalModels();
      }
    } catch {
      setLmStatus("offline");
    }
  };

  const fetchLocalModels = async () => {
    try {
      const resp = await fetch("http://localhost:8000/local-models/");
      const data = await resp.json();
      setAvailableModels(data.models ?? []);
    } catch {
      setAvailableModels([]);
    }
  };

  const statusIcon = {
    checking: <Loader2 className="h-3 w-3 animate-spin text-muted-foreground" />,
    online: <CheckCircle2 className="h-3 w-3 text-emerald-500" />,
    offline: <XCircle className="h-3 w-3 text-red-500" />,
  }[lmStatus];

  const statusText = {
    checking: "Checking…",
    online: "Online",
    offline: "Offline",
  }[lmStatus];

  return (
    <div className="flex flex-col gap-3">
      <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
        AI Model
      </p>

      <div className="grid grid-cols-2 gap-2">
        {/* Groq option */}
        <button
          id="model-selector-groq"
          type="button"
          onClick={() => onChange("groq")}
          className={cn(
            "relative flex flex-col items-start gap-1.5 rounded-xl border px-4 py-3 transition-all duration-200 text-left",
            value === "groq"
              ? "border-primary bg-primary/5 shadow-sm ring-1 ring-primary/30"
              : "border-border bg-background hover:border-primary/40 hover:bg-muted/40"
          )}
        >
          <div className="flex items-center gap-2">
            <div
              className={cn(
                "flex h-6 w-6 items-center justify-center rounded-md transition-colors",
                value === "groq" ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"
              )}
            >
              <Cloud className="h-3.5 w-3.5" />
            </div>
            <span className="text-sm font-semibold">Groq</span>
          </div>
          <p className="text-[11px] text-muted-foreground leading-snug">
            llama-3.3-70b — fast cloud inference
          </p>
          {value === "groq" && (
            <span className="absolute top-2 right-2 h-2 w-2 rounded-full bg-primary" />
          )}
        </button>

        {/* Local LM Studio option */}
        <button
          id="model-selector-local"
          type="button"
          onClick={() => {
            onChange("local");
            if (lmStatus === "offline") checkLMStatus();
          }}
          className={cn(
            "relative flex flex-col items-start gap-1.5 rounded-xl border px-4 py-3 transition-all duration-200 text-left",
            value === "local"
              ? "border-primary bg-primary/5 shadow-sm ring-1 ring-primary/30"
              : "border-border bg-background hover:border-primary/40 hover:bg-muted/40"
          )}
        >
          <div className="flex items-center gap-2">
            <div
              className={cn(
                "flex h-6 w-6 items-center justify-center rounded-md transition-colors",
                value === "local" ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"
              )}
            >
              <Cpu className="h-3.5 w-3.5" />
            </div>
            <span className="text-sm font-semibold">Local</span>
          </div>
          <p className="text-[11px] text-muted-foreground leading-snug">
            LM Studio · 127.0.0.1:1234
          </p>
          <div className="flex items-center gap-1">
            {statusIcon}
            <span className="text-[10px] text-muted-foreground">{statusText}</span>
          </div>
          {value === "local" && (
            <span className="absolute top-2 right-2 h-2 w-2 rounded-full bg-primary" />
          )}
        </button>
      </div>

      {/* Local model sub-options */}
      {value === "local" && (
        <div className="pl-1 flex flex-col gap-2 animate-in fade-in slide-in-from-top-1 duration-200">
          {availableModels.length > 0 ? (
            <div className="flex flex-col gap-1">
              <label className="text-[11px] text-muted-foreground font-medium">
                Loaded model
              </label>
              <select
                id="local-model-select"
                value={localModel}
                onChange={(e) => onLocalModelChange?.(e.target.value)}
                className="w-full rounded-lg border border-border bg-background px-3 py-1.5 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary transition"
              >
                {availableModels.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.id}
                  </option>
                ))}
              </select>
            </div>
          ) : (
            <div className="rounded-lg border border-dashed border-border bg-muted/30 px-3 py-2">
              <p className="text-[11px] text-muted-foreground">
                {lmStatus === "offline"
                  ? "⚠️ LM Studio is not reachable. Make sure it's running."
                  : "Using default model: qwen/qwen3.5-2b"}
              </p>
            </div>
          )}

          {lmStatus === "offline" && (
            <button
              type="button"
              onClick={checkLMStatus}
              className="w-fit text-[11px] text-primary hover:underline"
            >
              Retry connection ↻
            </button>
          )}
        </div>
      )}
    </div>
  );
};
