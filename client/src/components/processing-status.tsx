import { Card, CardContent } from "@/components/ui/card";
import { Check, Loader2, Clock } from "lucide-react";
import type { JournalEntryWithDetails } from "@shared/schema";

interface ProcessingStatusProps {
  entry: JournalEntryWithDetails | null;
  isProcessing: boolean;
}

interface ProcessingStep {
  id: string;
  label: string;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
}

const steps: ProcessingStep[] = [
  {
    id: "upload",
    label: "Image Upload",
    description: "Successfully uploaded journal image",
    icon: Check
  },
  {
    id: "ocr",
    label: "OCR Processing",
    description: "Extracting text from handwritten content...",
    icon: Loader2
  },
  {
    id: "analysis",
    label: "AI Analysis",
    description: "Analyzing themes and generating insights...",
    icon: Loader2
  }
];

export default function ProcessingStatus({ entry, isProcessing }: ProcessingStatusProps) {
  const getStepStatus = (stepId: string) => {
    if (!entry) {
      return stepId === "upload" ? "pending" : "waiting";
    }

    switch (stepId) {
      case "upload":
        return entry.originalImageUrl ? "completed" : "pending";
      case "ocr":
        if (entry.processingStatus === "failed") return "failed";
        if (entry.transcribedText && entry.transcribedText.length > 0) return "completed";
        if (entry.processingStatus === "processing") return "processing";
        return "waiting";
      case "analysis":
        if (entry.processingStatus === "failed") return "failed";
        if (entry.processingStatus === "completed" && entry.themes && entry.themes.length > 0) return "completed";
        if (entry.transcribedText && entry.transcribedText.length > 0 && entry.processingStatus === "processing") return "processing";
        if (entry.transcribedText && entry.transcribedText.length > 0) return "processing";
        return "waiting";
      default:
        return "waiting";
    }
  };

  const getStepIcon = (step: ProcessingStep, status: string) => {
    const IconComponent = step.icon;
    
    switch (status) {
      case "completed":
        return <Check className="text-white w-4 h-4" />;
      case "processing":
        return <Loader2 className="text-white w-4 h-4 animate-spin" />;
      case "failed":
        return <span className="text-white w-4 h-4">✕</span>;
      default:
        return <Clock className="text-gray-400 w-4 h-4" />;
    }
  };

  const getStepBackground = (status: string) => {
    switch (status) {
      case "completed":
        return "bg-[#10B981]";
      case "processing":
        return "bg-[#6366F1] animate-pulse";
      case "failed":
        return "bg-red-500";
      default:
        return "bg-gray-200";
    }
  };

  const getStepDescription = (step: ProcessingStep, status: string) => {
    if (status === "completed" && step.id === "upload" && entry) {
      return `Successfully uploaded ${entry.title}`;
    }
    return step.description;
  };

  return (
    <Card className="journal-card">
      <CardContent className="p-6">
        <h3 className="text-lg font-semibold text-[#111827] mb-4">Processing Status</h3>
        
        <div className="space-y-4">
          {steps.map((step) => {
            const status = getStepStatus(step.id);
            const isActive = status === "processing";
            const isCompleted = status === "completed";
            const isWaiting = status === "waiting";

            return (
              <div key={step.id} className="flex items-center space-x-3">
                <div className={`w-8 h-8 rounded-full flex items-center justify-center ${getStepBackground(status)}`}>
                  {getStepIcon(step, status)}
                </div>
                <div className="flex-1">
                  <p className={`font-medium ${isWaiting ? 'text-gray-400' : 'text-[#111827]'}`}>
                    {step.label}
                  </p>
                  <p className={`text-sm ${isWaiting ? 'text-gray-400' : 'text-gray-600'}`}>
                    {getStepDescription(step, status)}
                  </p>
                </div>
                {isCompleted && (
                  <div className="text-[#10B981] text-sm font-medium">
                    Complete
                  </div>
                )}
                {isActive && (
                  <div className="text-[#6366F1] text-sm font-medium">
                    Processing...
                  </div>
                )}
                {status === "failed" && (
                  <div className="text-red-500 text-sm font-medium">
                    Failed
                  </div>
                )}
                {isWaiting && (
                  <div className="text-gray-400 text-sm font-medium">
                    Waiting...
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
