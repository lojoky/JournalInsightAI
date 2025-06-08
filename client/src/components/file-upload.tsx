import { useCallback } from "react";
import { useDropzone } from "react-dropzone";
import { Card, CardContent } from "@/components/ui/card";
import { CloudUpload, FileImage } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface FileUploadProps {
  onFileUpload: (file: File, title?: string) => Promise<void>;
  isProcessing: boolean;
}

export default function FileUpload({ onFileUpload, isProcessing }: FileUploadProps) {
  const { toast } = useToast();

  const onDrop = useCallback(async (acceptedFiles: File[]) => {
    if (acceptedFiles.length === 0) return;

    const file = acceptedFiles[0];
    
    try {
      await onFileUpload(file, file.name.replace(/\.[^/.]+$/, ""));
      toast({
        title: "Upload successful",
        description: "Your journal image has been uploaded and processing has started.",
      });
    } catch (error) {
      toast({
        title: "Upload failed",
        description: "There was an error uploading your file. Please try again.",
        variant: "destructive",
      });
    }
  }, [onFileUpload, toast]);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'image/*': ['.jpeg', '.jpg', '.png', '.heic']
    },
    maxSize: 10 * 1024 * 1024, // 10MB
    disabled: isProcessing,
    multiple: false
  });

  return (
    <Card className={`journal-card transition-all duration-200 ${isDragActive ? 'drag-over' : ''}`}>
      <CardContent className="p-8">
        <div 
          {...getRootProps()} 
          className={`border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-colors duration-200 ${
            isDragActive 
              ? 'border-[#6366F1] bg-indigo-50' 
              : 'border-gray-300 hover:border-[#6366F1] hover:bg-gray-50'
          } ${isProcessing ? 'opacity-50 cursor-not-allowed' : ''}`}
        >
          <input {...getInputProps()} />
          
          <div className="space-y-4">
            <div className="w-12 h-12 bg-[#6366F1]/10 rounded-full flex items-center justify-center mx-auto">
              <CloudUpload className="text-[#6366F1] w-6 h-6" />
            </div>
            
            <div>
              <h3 className="text-lg font-semibold text-[#111827] mb-2">Upload Journal Image</h3>
              <p className="text-gray-600 mb-4">
                {isDragActive 
                  ? "Drop your journal image here" 
                  : "Drag and drop your journal image here, or click to browse"
                }
              </p>
            </div>
            
            {!isDragActive && (
              <button 
                type="button"
                className="bg-[#6366F1] text-white px-6 py-3 rounded-lg hover:bg-indigo-700 font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                disabled={isProcessing}
              >
                <FileImage className="w-4 h-4 mr-2 inline" />
                {isProcessing ? "Processing..." : "Choose File"}
              </button>
            )}
            
            <p className="text-sm text-gray-500">
              Supports JPG, PNG, HEIC up to 10MB
            </p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
