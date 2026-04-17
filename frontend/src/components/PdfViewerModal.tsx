import { useState, useCallback, useRef, useEffect } from "react";
import { Document, Page, pdfjs } from "react-pdf";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { ChevronLeft, ChevronRight } from "lucide-react";
import "react-pdf/dist/Page/TextLayer.css";
import "react-pdf/dist/Page/AnnotationLayer.css";
import workerUrl from "pdfjs-dist/build/pdf.worker.min.mjs?url";

// Use local bundled worker — avoids CDN CORS issues
pdfjs.GlobalWorkerOptions.workerSrc = workerUrl;

interface BBox {
  left: number;
  top: number;
  width: number;
  height: number;
}

interface PdfViewerModalProps {
  open: boolean;
  onClose: () => void;
  file: File | null;
  initialPage?: number;
  highlightText?: string;
}

export const PdfViewerModal = ({
  open,
  onClose,
  file,
  initialPage = 1,
  highlightText = "",
}: PdfViewerModalProps) => {
  const [numPages, setNumPages] = useState<number>(0);
  const [pageNumber, setPageNumber] = useState<number>(initialPage);
  const containerRef = useRef<HTMLDivElement>(null);
  const [containerWidth, setContainerWidth] = useState(600);
  const [highlights, setHighlights] = useState<BBox[]>([]);
  const [pageSize, setPageSize] = useState<{ width: number; height: number } | null>(null);

  // Jump to the referenced page whenever a new reference is clicked
  useEffect(() => {
    setPageNumber(initialPage);
  }, [initialPage, highlightText]);

  // Measure container to set PDF width correctly
  useEffect(() => {
    if (!containerRef.current) return;
    const ro = new ResizeObserver((entries) => {
      for (const entry of entries) {
        setContainerWidth(Math.min(entry.contentRect.width - 32, 650));
      }
    });
    ro.observe(containerRef.current);
    return () => ro.disconnect();
  }, []);

  // Compute bounding boxes whenever page or quote changes
  useEffect(() => {
    setHighlights([]);
    setPageSize(null);
    if (!file || !highlightText.trim()) return;

    let cancelled = false;

    (async () => {
      try {
        const arrayBuffer = await file.arrayBuffer();
        const loadingTask = pdfjs.getDocument({ data: arrayBuffer });
        const pdfDoc = await loadingTask.promise;
        if (cancelled) return;

        const page = await pdfDoc.getPage(pageNumber);
        if (cancelled) return;

        // Use scale=1 to get raw PDF units; we'll scale to pixels later
        const baseViewport = page.getViewport({ scale: 1 });
        const scale = containerWidth / baseViewport.width;
        const viewport = page.getViewport({ scale });

        if (cancelled) return;

        const textContent = await page.getTextContent();
        if (cancelled) return;

        // Build the full page text from items so we can do substring matching
        const items = textContent.items as Array<{
          str: string;
          transform: number[];
          width: number;
          height: number;
        }>;

        // Needle: first 120 chars of the quote, cleaned up
        const needle = highlightText.slice(0, 120).trim().toLowerCase();
        if (!needle) return;

        // Tokenise needle into words for fuzzy span-level match
        const needleWords = needle.split(/\s+/).filter(Boolean);

        const foundBoxes: BBox[] = [];

        for (let i = 0; i < items.length; i++) {
          const item = items[i];
          const itemText = item.str.toLowerCase().trim();
          if (!itemText) continue;

          // Check if this item (or a multi-item window) contains part of the needle
          // Strategy: build a running window of up to 8 consecutive spans and look
          // for overlap with the needle's first 2-3 words.
          const windowText = items
            .slice(i, i + 8)
            .map((x) => x.str)
            .join(" ")
            .toLowerCase();

          const matchesFirst = needleWords.slice(0, 3).every((w) => windowText.includes(w));
          if (!matchesFirst) continue;

          // For every item in the window that contains at least one needle word, add a box
          for (let j = i; j < Math.min(i + 8, items.length); j++) {
            const span = items[j];
            const spanLower = span.str.toLowerCase();
            const hasMatch = needleWords.some((w) => spanLower.includes(w));
            if (!hasMatch) continue;

            // Convert PDF transform → pixel rect
            // transform = [scaleX, skewX, skewY, scaleY, tx, ty]  (PDF user-space)
            const [, , , , tx, ty] = span.transform;

            // pdfjs viewport.convertToViewportPoint maps PDF coords to CSS coords
            const [px, py] = viewport.convertToViewportPoint(tx, ty);

            const spanWidthPx = span.width * scale;
            // Height: use the font size (abs of scaleY) * scale, or item.height
            const spanHeightPx = (span.height || Math.abs(span.transform[3])) * scale;

            foundBoxes.push({
              left: px,
              top: py - spanHeightPx,   // pdfjs y is baseline; shift up by height
              width: spanWidthPx,
              height: spanHeightPx * 1.15, // slight padding
            });
          }

          // Only highlight the first matching window
          if (foundBoxes.length > 0) break;
        }

        if (!cancelled) {
          setHighlights(foundBoxes);
          setPageSize({ width: viewport.width, height: viewport.height });
        }
      } catch (err) {
        if (!cancelled) console.error("BBox extraction failed:", err);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [file, pageNumber, highlightText, containerWidth]);

  const handleLoadSuccess = useCallback(({ numPages }: { numPages: number }) => {
    setNumPages(numPages);
  }, []);

  if (!file) return null;

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent
        className="max-w-3xl h-[90vh] flex flex-col p-0 gap-0"
        style={{ ["--dialog-close-display" as string]: "none" }}
      >
        {/* Header with page controls */}
        <DialogHeader className="flex-shrink-0 flex flex-row items-center justify-between px-4 py-3 border-b border-border">
          <DialogTitle className="text-sm font-semibold truncate max-w-xs">
            {file.name}
          </DialogTitle>
          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground whitespace-nowrap">
              Page {pageNumber} of {numPages}
            </span>
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7"
              disabled={pageNumber <= 1}
              onClick={() => setPageNumber((p) => Math.max(1, p - 1))}
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7"
              disabled={pageNumber >= numPages}
              onClick={() => setPageNumber((p) => Math.min(numPages, p + 1))}
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </DialogHeader>

        <div
          ref={containerRef}
          className="flex-1 overflow-auto flex justify-center bg-muted/40 p-4"
        >
          {/* Wrapper for Page + highlight overlays */}
          <div className="relative" style={pageSize ? { width: pageSize.width, height: pageSize.height } : {}}>
            <Document
              file={file}
              onLoadSuccess={handleLoadSuccess}
              loading={
                <div className="flex items-center justify-center h-40 text-sm text-muted-foreground">
                  Loading PDF…
                </div>
              }
              error={
                <div className="flex items-center justify-center h-40 text-sm text-destructive">
                  Failed to load PDF.
                </div>
              }
            >
              <Page
                pageNumber={pageNumber}
                width={containerWidth}
                renderAnnotationLayer={false}
              />
            </Document>

            {/* Bounding-box highlight overlays */}
            {highlights.map((box, i) => (
              <div
                key={i}
                style={{
                  position: "absolute",
                  left: box.left,
                  top: box.top,
                  width: box.width,
                  height: box.height,
                  backgroundColor: "rgba(253, 224, 71, 0.45)",
                  border: "1.5px solid rgba(234, 179, 8, 0.9)",
                  borderRadius: "3px",
                  pointerEvents: "none",
                  mixBlendMode: "multiply",
                  animation: "bbox-pulse 1.8s ease-in-out infinite",
                }}
              />
            ))}
          </div>
        </div>
      </DialogContent>

      {/* Keyframe animation injected via a style tag */}
      <style>{`
        @keyframes bbox-pulse {
          0%, 100% { opacity: 1; }
          50%       { opacity: 0.55; }
        }
      `}</style>
    </Dialog>
  );
};
