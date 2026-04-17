import { useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Upload, File as FileIcon, X, Eye } from "lucide-react";
import { cn } from "@/lib/utils";

interface FileUploadProps {
  onFileSelect: (file: File) => void;
  selectedFile: File | null;
  onClearFile: () => void;
}

export const FileUpload = ({ onFileSelect, selectedFile, onClearFile }: FileUploadProps) => {
  const [isDragOver, setIsDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [pdfUrl, setPdfUrl] = useState<string | null>(null);

  useEffect(() => {
    if (selectedFile && selectedFile.type === "application/pdf") {
      const url = URL.createObjectURL(selectedFile);
      setPdfUrl(url);
      return () => URL.revokeObjectURL(url);
    }
    setPdfUrl(null);
  }, [selectedFile]);

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    
    const files = Array.from(e.dataTransfer.files);
    const validFile = files.find(file => 
      file.type === 'application/pdf' || 
      file.type === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' ||
      file.type === 'text/plain'
    );
    
    if (validFile) {
      onFileSelect(validFile);
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      onFileSelect(file);
    }
  };

  return (
    <div className="space-y-3">
      <h3 className="font-medium text-foreground">Document Upload</h3>
      
      {selectedFile ? (
        <Card className="border-primary/20 bg-primary/5">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <FileIcon className="h-5 w-5 text-primary" />
                <div>
                  <p className="font-medium text-sm">{selectedFile.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {(selectedFile.size / 1024 / 1024).toFixed(2)} MB
                  </p>
                </div>
              </div>
              <div className="flex gap-1">
                {pdfUrl && (
                  <Dialog>
                    <DialogTrigger asChild>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-8 w-8 p-0 hover:bg-primary/10 hover:text-primary relative"
                        title="View PDF"
                      >
                        <Eye className="h-4 w-4" />
                      </Button>
                    </DialogTrigger>
                    <DialogContent className="max-w-4xl h-[85vh] flex flex-col p-4 pt-10">
                      <DialogHeader className="hidden">
                        <DialogTitle>PDF Viewer</DialogTitle>
                      </DialogHeader>
                      <iframe src={pdfUrl} className="w-full h-full border-none rounded-md" title="PDF Viewer" />
                    </DialogContent>
                  </Dialog>
                )}
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={onClearFile}
                  className="h-8 w-8 p-0 hover:bg-destructive/10 hover:text-destructive"
                  title="Remove file"
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      ) : (
        <Card
          className={cn(
            "border-dashed border-2 transition-all duration-200 cursor-pointer",
            isDragOver 
              ? "border-primary bg-primary/5 shadow-glow" 
              : "border-border hover:border-primary/50 hover:bg-accent/20"
          )}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          onClick={() => fileInputRef.current?.click()}
        >
          <CardContent className="p-8 text-center">
            <Upload className={cn(
              "h-8 w-8 mx-auto mb-4 transition-colors",
              isDragOver ? "text-primary" : "text-muted-foreground"
            )} />
            <p className="font-medium mb-2">
              {isDragOver ? "Drop your file here" : "Choose PDF / DOCX"}
            </p>
            <p className="text-sm text-muted-foreground mb-4">
              Or drag and drop your document here
            </p>
            <p className="text-xs text-muted-foreground">
              Max 10MB • PDF, DOCX, TXT supported
            </p>
          </CardContent>
        </Card>
      )}
      
      <p className="text-xs text-muted-foreground">
        Figures and references are ignored for summarization
      </p>
      
      <input
        ref={fileInputRef}
        type="file"
        className="hidden"
        accept=".pdf,.docx,.txt"
        onChange={handleFileSelect}
      />
    </div>
  );
};