import { useCallback } from "react";
import { useDropzone } from "react-dropzone";
import { Card, CardContent } from "@/components/ui/card";
import { CloudUpload, FileImage } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface FileUploadProps {
  onFileUpload: (file: File, title?: string) => Promise<void>;
  onBulkUpload: (files: File[]) => Promise<void>;
  isProcessing: boolean;
}

export default function FileUpload({ onFileUpload, onBulkUpload, isProcessing }: FileUploadProps) {
  const { toast } = useToast();

  const onDrop = useCallback(async (acceptedFiles: File[]) => {
    console.log('Files dropped:', acceptedFiles);
    if (acceptedFiles.length === 0) {
      console.log('No files accepted');
      return;
    }

    try {
      if (acceptedFiles.length === 1) {
        // Single file upload
        const file = acceptedFiles[0];
        console.log('Processing single file:', file.name, file.type, file.size);
        await onFileUpload(file, file.name.replace(/\.[^/.]+$/, ""));
        toast({
          title: "Upload successful",
          description: "Your journal image has been uploaded and processing has started.",
        });
      } else {
        // Bulk upload
        console.log('Processing bulk upload:', acceptedFiles.length, 'files');
        await onBulkUpload(acceptedFiles);
        toast({
          title: "Bulk upload successful",
          description: `${acceptedFiles.length} images uploaded and will be processed sequentially.`,
        });
      }
    } catch (error) {
      console.error('File upload error:', error);
      toast({
        title: "Upload failed",
        description: error instanceof Error ? error.message : "There was an error uploading your files. Please try again.",
        variant: "destructive",
      });
    }
  }, [onFileUpload, onBulkUpload, toast]);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'image/*': ['.jpeg', '.jpg', '.png', '.heic']
    },
    maxSize: 10 * 1024 * 1024, // 10MB
    disabled: isProcessing,
    multiple: true
  });

  return (
    <Card className={`journal-card transition-all duration-200 ${isDragActive ? 'drag-over' : ''}`}>
      <CardContent className="p-4 sm:p-8">
        <div 
          {...getRootProps()} 
          className={`border-2 border-dashed rounded-lg p-4 sm:p-8 text-center cursor-pointer transition-colors duration-200 ${
            isDragActive 
              ? 'border-[#6366F1] bg-indigo-50' 
              : 'border-gray-300 hover:border-[#6366F1] hover:bg-gray-50'
          } ${isProcessing ? 'opacity-50 cursor-not-allowed' : ''}`}
        >
          <input {...getInputProps()} />
          
          <div className="space-y-3 sm:space-y-4">
            <div className="w-10 h-10 sm:w-12 sm:h-12 bg-[#6366F1]/10 rounded-full flex items-center justify-center mx-auto">
              <CloudUpload className="text-[#6366F1] w-5 h-5 sm:w-6 sm:h-6" />
            </div>
            
            <div>
              <h3 className="text-base sm:text-lg font-semibold text-[#111827] mb-2">Upload Journal Images</h3>
              <p className="text-sm sm:text-base text-gray-600 mb-3 sm:mb-4">
                {isDragActive 
                  ? "Drop your journal images here" 
                  : "Drag and drop your journal images here, or click to browse"
                }
              </p>
              <p className="text-xs sm:text-sm text-gray-500 hidden sm:block">
                Select multiple images for bulk processing or single images for immediate analysis
              </p>
              <p className="text-xs text-gray-500 sm:hidden">
                Multiple images supported
              </p>
            </div>
            
            {!isDragActive && (
              <button 
                type="button"
                className="bg-[#6366F1] text-white px-4 py-2 sm:px-6 sm:py-3 rounded-lg hover:bg-indigo-700 font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed text-sm sm:text-base"
                disabled={isProcessing}
              >
                <FileImage className="w-4 h-4 mr-2 inline" />
                {isProcessing ? "Processing..." : "Choose Files"}
              </button>
            )}
            
            <p className="text-xs sm:text-sm text-gray-500">
              Supports JPG, PNG, HEIC up to 10MB
            </p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
