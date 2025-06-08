import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Edit, Copy, Download } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import type { JournalEntryWithDetails } from "@shared/schema";

interface TranscriptionResultsProps {
  entry: JournalEntryWithDetails;
  onTranscriptionUpdate: (transcription: string) => void;
}

export default function TranscriptionResults({ entry, onTranscriptionUpdate }: TranscriptionResultsProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [editedText, setEditedText] = useState(entry.transcribedText || "");
  const { toast } = useToast();

  const handleSaveEdit = () => {
    onTranscriptionUpdate(editedText);
    setIsEditing(false);
    toast({
      title: "Transcription updated",
      description: "Your changes have been saved successfully.",
    });
  };

  const handleCopyText = async () => {
    try {
      await navigator.clipboard.writeText(entry.transcribedText || "");
      toast({
        title: "Text copied",
        description: "Transcription has been copied to clipboard.",
      });
    } catch (error) {
      toast({
        title: "Copy failed",
        description: "Unable to copy text to clipboard.",
        variant: "destructive",
      });
    }
  };

  const handleDownload = () => {
    const blob = new Blob([entry.transcribedText || ""], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${entry.title}_transcription.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    
    toast({
      title: "Download started",
      description: "Transcription file is being downloaded.",
    });
  };

  return (
    <Card className="journal-card">
      <CardContent className="p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-[#111827]">Transcribed Text</h3>
          <div className="flex items-center space-x-2">
            {entry.ocrConfidence && (
              <span className="bg-[#10B981] text-white px-2 py-1 rounded text-xs font-medium">
                <Check className="w-3 h-3 mr-1 inline" />
                {entry.ocrConfidence}% Accuracy
              </span>
            )}
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setIsEditing(!isEditing)}
              className="text-gray-400 hover:text-[#6366F1]"
            >
              <Edit className="w-4 h-4" />
            </Button>
          </div>
        </div>

        <div className="space-y-4">
          <div className="flex items-start space-x-4">
            {entry.originalImageUrl && (
              <div className="flex-shrink-0">
                <img 
                  src={entry.originalImageUrl}
                  alt="Original journal entry"
                  className="w-24 h-32 rounded-lg object-cover shadow-sm"
                />
              </div>
            )}
            
            <div className="flex-1">
              {isEditing ? (
                <div className="space-y-3">
                  <Textarea
                    value={editedText}
                    onChange={(e) => setEditedText(e.target.value)}
                    className="min-h-48 resize-none"
                    placeholder="Edit the transcribed text..."
                  />
                  <div className="flex space-x-2">
                    <Button 
                      onClick={handleSaveEdit}
                      className="bg-[#6366F1] hover:bg-indigo-700"
                    >
                      Save Changes
                    </Button>
                    <Button 
                      variant="outline"
                      onClick={() => {
                        setEditedText(entry.transcribedText || "");
                        setIsEditing(false);
                      }}
                    >
                      Cancel
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="bg-gray-50 rounded-lg p-4 min-h-48">
                  <p className="text-[#111827] leading-relaxed whitespace-pre-wrap">
                    {entry.transcribedText || "No transcription available"}
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>

        {!isEditing && (
          <div className="flex items-center justify-between mt-4 pt-4 border-t">
            <div className="flex items-center space-x-2">
              <span className="text-sm text-gray-600">OCR Confidence:</span>
              <div className="flex items-center space-x-2">
                <div className="w-20 h-2 bg-gray-200 rounded-full">
                  <div 
                    className="h-2 bg-[#10B981] rounded-full transition-all duration-300"
                    style={{ width: `${entry.ocrConfidence || 0}%` }}
                  />
                </div>
                <span className="text-sm font-medium text-[#10B981]">
                  {entry.ocrConfidence || 0}%
                </span>
              </div>
            </div>
            
            <div className="flex space-x-2">
              <Button
                variant="ghost"
                size="sm"
                onClick={handleCopyText}
                className="text-gray-500 hover:text-[#111827]"
              >
                <Copy className="w-4 h-4 mr-1" />
                Copy
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={handleDownload}
                className="text-gray-500 hover:text-[#111827]"
              >
                <Download className="w-4 h-4 mr-1" />
                Export
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
