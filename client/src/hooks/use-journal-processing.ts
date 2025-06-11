import { useState, useCallback, useEffect } from "react";
import { useMutation, useQueryClient, useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import type { JournalEntryWithDetails } from "@shared/schema";

interface UploadResponse {
  id: number;
  userId: number;
  title: string;
  originalImageUrl: string;
  transcribedText: string;
  ocrConfidence: number;
  processingStatus: string;
  createdAt: string;
  updatedAt: string;
}

interface AnalysisResponse {
  themes: any[];
  sentiment: any;
  tags: any[];
  reflectionQuestions: string[];
}

export function useJournalProcessing() {
  const [currentEntry, setCurrentEntry] = useState<JournalEntryWithDetails | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [bulkProgress, setBulkProgress] = useState<{ current: number; total: number } | null>(null);
  const [pollingEntryId, setPollingEntryId] = useState<number | null>(null);
  const queryClient = useQueryClient();
  const { toast } = useToast();

  // Status polling query for active processing entries
  const { data: entryStatus } = useQuery({
    queryKey: ['/api/journal-entries', pollingEntryId, 'status'],
    queryFn: async () => {
      if (!pollingEntryId) return null;
      const response = await fetch(`/api/journal-entries/${pollingEntryId}/status`);
      if (!response.ok) throw new Error('Failed to fetch status');
      return response.json();
    },
    enabled: !!pollingEntryId,
    refetchInterval: 2000, // Poll every 2 seconds
    refetchIntervalInBackground: true
  });

  // Update current entry when status changes
  useEffect(() => {
    if (entryStatus && currentEntry && entryStatus.id === currentEntry.id) {
      setCurrentEntry(prev => prev ? {
        ...prev,
        processingStatus: entryStatus.processingStatus,
        transcribedText: entryStatus.transcribedText || prev.transcribedText,
        ocrConfidence: entryStatus.ocrConfidence || prev.ocrConfidence,
        title: entryStatus.title || prev.title,
        updatedAt: entryStatus.updatedAt || prev.updatedAt
      } : null);

      // Stop polling when processing is complete or failed
      if (entryStatus.processingStatus === 'completed' || entryStatus.processingStatus === 'failed') {
        setPollingEntryId(null);
        setIsProcessing(false);
        
        // Refresh the entries list
        queryClient.invalidateQueries({ queryKey: ['/api/journal-entries'] });
        
        if (entryStatus.processingStatus === 'completed') {
          toast({
            title: "Processing complete",
            description: "Your journal entry has been successfully processed and analyzed.",
          });
        } else {
          toast({
            title: "Processing failed",
            description: entryStatus.transcribedText || "There was an error processing your journal entry.",
            variant: "destructive",
          });
        }
      }
    }
  }, [entryStatus, currentEntry, queryClient, toast]);

  // Upload mutation
  const uploadMutation = useMutation({
    mutationFn: async ({ file, title }: { file: File; title: string }) => {
      console.log('Starting upload for file:', file.name, file.type, file.size);
      
      const formData = new FormData();
      formData.append('journal', file);
      formData.append('title', title);

      console.log('FormData created, sending request...');
      const response = await apiRequest('POST', '/api/upload', formData);
      const result = await response.json() as UploadResponse;
      console.log('Upload successful:', result);
      return result;
    },
    onSuccess: (data) => {
      const newEntry = {
        id: data.id,
        title: data.title || 'Uploaded Entry',
        originalImageUrl: data.originalImageUrl,
        transcribedText: data.transcribedText || '',
        ocrConfidence: data.ocrConfidence || 0,
        processingStatus: data.processingStatus || 'processing',
        userId: data.userId,
        createdAt: data.createdAt ? new Date(data.createdAt) : new Date(),
        updatedAt: data.updatedAt ? new Date(data.updatedAt) : new Date(),
        themes: [],
        tags: [],
        sentimentAnalysis: undefined
      } as JournalEntryWithDetails;
      
      setCurrentEntry(newEntry);
      setPollingEntryId(data.id); // Start polling for this entry
    },
    onError: (error) => {
      console.error('Upload error:', error);
      toast({
        title: "Upload failed",
        description: error instanceof Error ? error.message : "There was an error uploading your file.",
        variant: "destructive",
      });
    }
  });

  // OpenAI Vision text extraction mutation (better than Tesseract for handwriting)
  const aiTextExtractionMutation = useMutation({
    mutationFn: async (entryId: number) => {
      const response = await apiRequest('POST', `/api/journal-entries/${entryId}/extract-text`, {});
      return response.json();
    },
    onSuccess: (data) => {
      setCurrentEntry(prev => prev ? {
        ...prev,
        transcribedText: data.transcribedText,
        ocrConfidence: data.confidence,
        processingStatus: 'processing'
      } : null);
    }
  });

  // Legacy Tesseract transcription mutation
  const transcriptionMutation = useMutation({
    mutationFn: async ({ entryId, transcribedText, confidence }: { 
      entryId: number; 
      transcribedText: string; 
      confidence: number; 
    }) => {
      const response = await apiRequest('POST', `/api/journal-entries/${entryId}/transcribe`, {
        transcribedText,
        confidence
      });
      return response.json();
    },
    onSuccess: (data, variables) => {
      setCurrentEntry(prev => prev ? {
        ...prev,
        transcribedText: variables.transcribedText,
        ocrConfidence: variables.confidence,
        processingStatus: 'processing'
      } : null);
    }
  });

  // Analysis mutation
  const analysisMutation = useMutation({
    mutationFn: async (entryId: number) => {
      const response = await apiRequest('POST', `/api/journal-entries/${entryId}/analyze`, {});
      return response.json() as Promise<AnalysisResponse>;
    },
    onSuccess: (data) => {
      setCurrentEntry(prev => prev ? {
        ...prev,
        themes: data.themes,
        tags: data.tags,
        sentimentAnalysis: data.sentiment,
        processingStatus: 'completed'
      } : null);
      
      // Invalidate recent entries query to refresh the list
      queryClient.invalidateQueries({ queryKey: ['/api/journal-entries'] });
    },
    onError: (error) => {
      console.error('Analysis error:', error);
      setCurrentEntry(prev => prev ? {
        ...prev,
        processingStatus: 'failed'
      } : null);
      toast({
        title: "Analysis failed",
        description: "There was an error analyzing your journal entry.",
        variant: "destructive",
      });
    }
  });

  // Add custom tag mutation
  const addTagMutation = useMutation({
    mutationFn: async ({ entryId, tagName, category }: { 
      entryId: number; 
      tagName: string; 
      category?: string; 
    }) => {
      const response = await apiRequest('POST', `/api/journal-entries/${entryId}/tags`, {
        tagName,
        category
      });
      return response.json();
    },
    onSuccess: (newTag, variables) => {
      setCurrentEntry(prev => prev ? {
        ...prev,
        tags: [...(prev.tags || []), { ...newTag, confidence: 100, isAutoGenerated: false }]
      } : null);
    }
  });

  // Simplified upload function that relies on backend processing
  const uploadFile = useCallback(async (file: File, title = "Untitled Entry") => {
    setIsProcessing(true);
    
    try {
      // Upload file - backend handles all processing automatically
      await uploadMutation.mutateAsync({ file, title });
    } catch (error) {
      console.error('Processing error:', error);
      setIsProcessing(false);
      setPollingEntryId(null);
    }
  }, [uploadMutation]);

  // Function to update transcription
  const processTranscription = useCallback(async (transcription: string) => {
    if (!currentEntry) return;
    
    try {
      await transcriptionMutation.mutateAsync({
        entryId: currentEntry.id,
        transcribedText: transcription,
        confidence: currentEntry.ocrConfidence || 95
      });

      // Re-analyze after transcription update
      await analysisMutation.mutateAsync(currentEntry.id);
    } catch (error) {
      console.error('Transcription update error:', error);
    }
  }, [currentEntry, transcriptionMutation, analysisMutation]);

  // Function to analyze entry
  const analyzeEntry = useCallback(async () => {
    if (!currentEntry) return;
    
    try {
      await analysisMutation.mutateAsync(currentEntry.id);
    } catch (error) {
      console.error('Analysis error:', error);
    }
  }, [currentEntry, analysisMutation]);

  // Bulk upload function
  const uploadBulkFiles = useCallback(async (files: File[]) => {
    setIsProcessing(true);
    setBulkProgress({ current: 0, total: files.length });

    try {
      const formData = new FormData();
      files.forEach(file => {
        formData.append('journals', file);
      });

      console.log(`Starting bulk upload of ${files.length} files...`);
      const response = await apiRequest('POST', '/api/upload-bulk', formData);
      const result = await response.json();
      
      setBulkProgress({ current: files.length, total: files.length });

      // Invalidate cache to refresh the entries list
      queryClient.invalidateQueries({ queryKey: ["/api/journal-entries"] });
      
      toast({
        title: "Bulk upload complete",
        description: result.message || `Successfully uploaded ${files.length} files`,
      });
    } catch (error) {
      console.error('Bulk upload error:', error);
      toast({
        title: "Bulk upload failed",
        description: "Please try again",
        variant: "destructive",
      });
    } finally {
      setIsProcessing(false);
      setBulkProgress(null);
    }
  }, [toast, queryClient]);

  // Function to add custom tag
  const addCustomTag = useCallback(async (entryId: number, tagName: string, category?: string) => {
    try {
      await addTagMutation.mutateAsync({ entryId, tagName, category });
    } catch (error) {
      console.error('Add tag error:', error);
      throw error;
    }
  }, [addTagMutation]);

  return {
    currentEntry,
    isProcessing,
    bulkProgress,
    uploadFile,
    uploadBulkFiles,
    processTranscription,
    analyzeEntry,
    addCustomTag,
    isUploading: uploadMutation.isPending,
    isTranscribing: transcriptionMutation.isPending,
    isAnalyzing: analysisMutation.isPending
  };
}
