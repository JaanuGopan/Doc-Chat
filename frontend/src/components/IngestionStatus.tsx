import { CheckCircle2, Loader2, XCircle, DatabaseZap } from "lucide-react";
import { cn } from "@/lib/utils";

export type IngestionState = "idle" | "indexing" | "ready" | "error";

interface IngestionStatusProps {
  state: IngestionState;
  chunkCount?: number;
  errorMessage?: string;
}

export const IngestionStatus = ({
  state,
  chunkCount,
  errorMessage,
}: IngestionStatusProps) => {
  if (state === "idle") return null;

  const config = {
    indexing: {
      icon: <Loader2 className="h-3.5 w-3.5 animate-spin text-amber-500" />,
      text: "Indexing document…",
      sub: "Generating embeddings and storing chunks",
      pill: "bg-amber-500/10 border-amber-500/30 text-amber-600 dark:text-amber-400",
    },
    ready: {
      icon: <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />,
      text: `Ready · ${chunkCount} chunks indexed`,
      sub: "Document is fully indexed. You can ask questions.",
      pill: "bg-emerald-500/10 border-emerald-500/30 text-emerald-600 dark:text-emerald-400",
    },
    error: {
      icon: <XCircle className="h-3.5 w-3.5 text-red-500" />,
      text: "Indexing failed",
      sub: errorMessage ?? "An error occurred during ingestion.",
      pill: "bg-red-500/10 border-red-500/30 text-red-600 dark:text-red-400",
    },
  }[state];

  return (
    <div
      className={cn(
        "flex items-start gap-2.5 rounded-xl border px-3.5 py-2.5 transition-all duration-300",
        config.pill
      )}
    >
      <div className="mt-0.5 shrink-0">{config.icon}</div>
      <div className="flex flex-col">
        <span className="text-[12px] font-semibold leading-tight">{config.text}</span>
        <span className="text-[11px] opacity-70 leading-tight mt-0.5">{config.sub}</span>
      </div>
      {state === "ready" && (
        <DatabaseZap className="ml-auto h-3.5 w-3.5 mt-0.5 shrink-0 text-emerald-500 opacity-70" />
      )}
    </div>
  );
};
