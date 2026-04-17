import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent } from "@/components/ui/card";
import { Wand2 } from "lucide-react";

interface TextInputProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
}

export const TextInput = ({ value, onChange, placeholder }: TextInputProps) => {
  const [isProcessing, setIsProcessing] = useState(false);

  const cleanFormatting = () => {
    setIsProcessing(true);
    // Simulate processing delay
    setTimeout(() => {
      const cleaned = value
        .replace(/^\d+\s*/gm, '') // Remove line numbers
        .replace(/\s+/g, ' ') // Replace multiple spaces with single space
        .replace(/\n\s*\n/g, '\n\n') // Clean up excessive line breaks
        .trim();
      onChange(cleaned);
      setIsProcessing(false);
    }, 500);
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="font-medium text-foreground">Paste Text</h3>
        {value && (
          <Button
            variant="ghost"
            size="sm"
            onClick={cleanFormatting}
            disabled={isProcessing}
            className="text-primary hover:text-primary hover:bg-primary/10"
          >
            <Wand2 className="h-4 w-4 mr-2" />
            {isProcessing ? "Cleaning..." : "Clean formatting"}
          </Button>
        )}
      </div>
      
      <Card className="border-border">
        <CardContent className="p-0">
          <Textarea
            value={value}
            onChange={(e) => onChange(e.target.value)}
            placeholder={placeholder || "Paste the full paper text or key sections (Introduction, Methods, Results, Discussion)"}
            className="min-h-[200px] border-0 resize-none focus-visible:ring-0 focus-visible:ring-offset-0"
          />
        </CardContent>
      </Card>
      
      <div className="flex justify-between items-center">
        <p className="text-xs text-muted-foreground">
          {value.length > 0 && `${value.length.toLocaleString()} characters`}
        </p>
        <Button
          variant="link"
          size="sm"
          className="text-primary hover:text-primary p-0 h-auto"
        >
          Try a sample paper
        </Button>
      </div>
    </div>
  );
};