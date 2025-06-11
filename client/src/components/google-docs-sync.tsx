import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ExternalLink, FileText, Plus, History } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface GoogleDocsSyncProps {
  entryId: number;
  entryTitle: string;
  children: React.ReactNode;
}

interface GoogleDocument {
  id: string;
  title: string;
  url: string;
}

interface GoogleDocsStatus {
  enabled: boolean;
  configured: boolean;
  needsReauth?: boolean;
}

export default function GoogleDocsSync({ entryId, entryTitle, children }: GoogleDocsSyncProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [syncMode, setSyncMode] = useState<'new' | 'append' | 'last'>('new');
  const [selectedDocumentId, setSelectedDocumentId] = useState<string>('');
  const { toast } = useToast();

  // Check Google Docs status
  const { data: googleStatus } = useQuery({
    queryKey: ['/api/integrations/google-docs'],
    queryFn: async () => {
      const response = await fetch('/api/integrations/google-docs', {
        credentials: 'include',
      });
      return response.json() as Promise<GoogleDocsStatus>;
    }
  });

  // Fetch user's Google Docs
  const { data: documents, isLoading: documentsLoading } = useQuery({
    queryKey: ['/api/google-docs/documents'],
    queryFn: async () => {
      const response = await fetch('/api/google-docs/documents', {
        credentials: 'include',
      });
      const data = await response.json();
      return data.documents as GoogleDocument[];
    },
    enabled: isOpen && googleStatus?.configured
  });

  // Sync mutation
  const syncMutation = useMutation({
    mutationFn: async (data: { entryId: number; syncMode: string; documentId?: string }) => {
      const response = await fetch('/api/google-docs/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(data),
      });
      
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message);
      }
      
      return response.json();
    },
    onSuccess: (data) => {
      toast({
        title: "Synced to Google Docs",
        description: (
          <div className="flex items-center gap-2">
            <span>Entry synced successfully</span>
            <a 
              href={data.documentUrl} 
              target="_blank" 
              rel="noopener noreferrer"
              className="text-blue-600 hover:text-blue-800 underline flex items-center gap-1"
            >
              View <ExternalLink className="w-3 h-3" />
            </a>
          </div>
        ),
      });
      setIsOpen(false);
    },
    onError: (error: Error) => {
      toast({
        title: "Sync Failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const handleSync = () => {
    const syncData = {
      entryId,
      syncMode,
      ...(syncMode === 'append' && selectedDocumentId && { documentId: selectedDocumentId })
    };
    
    syncMutation.mutate(syncData);
  };

  // Don't render if Google Docs is not configured
  if (!googleStatus?.configured) {
    return null;
  }

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        {children}
      </DialogTrigger>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <div className="w-8 h-8 bg-blue-100 rounded-lg flex items-center justify-center">
              <svg className="w-5 h-5 text-blue-600" viewBox="0 0 24 24" fill="currentColor">
                <path d="M14,2H6A2,2 0 0,0 4,4V20A2,2 0 0,0 6,22H18A2,2 0 0,0 20,20V8L14,2M18,20H6V4H13V9H18V20Z" />
              </svg>
            </div>
            Sync to Google Docs
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div>
            <Label className="text-sm font-medium">Entry to sync:</Label>
            <p className="text-sm text-gray-600 mt-1">{entryTitle}</p>
          </div>

          <div>
            <Label className="text-sm font-medium mb-3 block">Sync Options:</Label>
            <RadioGroup value={syncMode} onValueChange={(value) => setSyncMode(value as any)}>
              <div className="space-y-3">
                <div className="flex items-center space-x-2 p-3 border rounded-lg hover:bg-gray-50">
                  <RadioGroupItem value="new" id="new" />
                  <Label htmlFor="new" className="flex-1 cursor-pointer">
                    <div className="flex items-center gap-2">
                      <Plus className="w-4 h-4 text-green-600" />
                      <span className="font-medium">Create new document</span>
                    </div>
                    <p className="text-xs text-gray-500 mt-1">
                      Creates a new Google Doc specifically for this entry
                    </p>
                  </Label>
                </div>

                <div className="flex items-center space-x-2 p-3 border rounded-lg hover:bg-gray-50">
                  <RadioGroupItem value="last" id="last" />
                  <Label htmlFor="last" className="flex-1 cursor-pointer">
                    <div className="flex items-center gap-2">
                      <History className="w-4 h-4 text-blue-600" />
                      <span className="font-medium">Append to last-used document</span>
                    </div>
                    <p className="text-xs text-gray-500 mt-1">
                      Adds this entry to your most recently used journal document
                    </p>
                  </Label>
                </div>

                <div className="flex items-center space-x-2 p-3 border rounded-lg hover:bg-gray-50">
                  <RadioGroupItem value="append" id="append" />
                  <Label htmlFor="append" className="flex-1 cursor-pointer">
                    <div className="flex items-center gap-2">
                      <FileText className="w-4 h-4 text-orange-600" />
                      <span className="font-medium">Append to specific document</span>
                    </div>
                    <p className="text-xs text-gray-500 mt-1">
                      Choose an existing document to append this entry to
                    </p>
                  </Label>
                </div>
              </div>
            </RadioGroup>
          </div>

          {syncMode === 'append' && (
            <div>
              <Label className="text-sm font-medium mb-2 block">Select Document:</Label>
              <Select value={selectedDocumentId} onValueChange={setSelectedDocumentId}>
                <SelectTrigger>
                  <SelectValue placeholder="Choose a document..." />
                </SelectTrigger>
                <SelectContent>
                  {documentsLoading ? (
                    <SelectItem value="" disabled>Loading documents...</SelectItem>
                  ) : documents && documents.length > 0 ? (
                    documents.map((doc) => (
                      <SelectItem key={doc.id} value={doc.id}>
                        {doc.title}
                      </SelectItem>
                    ))
                  ) : (
                    <SelectItem value="" disabled>No documents found</SelectItem>
                  )}
                </SelectContent>
              </Select>
            </div>
          )}

          <div className="flex justify-end gap-2 pt-4">
            <Button variant="outline" onClick={() => setIsOpen(false)}>
              Cancel
            </Button>
            <Button 
              onClick={handleSync}
              disabled={syncMutation.isPending || (syncMode === 'append' && !selectedDocumentId)}
              className="bg-blue-600 hover:bg-blue-700"
            >
              {syncMutation.isPending ? 'Syncing...' : 'Sync to Google Docs'}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}