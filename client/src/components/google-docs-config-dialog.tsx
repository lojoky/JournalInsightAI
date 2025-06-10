import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { AlertCircle, CheckCircle, Settings, ExternalLink, TestTube, FileText } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

const googleDocsConfigSchema = z.object({
  authCode: z.string().min(1, "Authorization code is required"),
  folderName: z.string().optional().default("Journal Entries"),
});

type GoogleDocsConfigData = z.infer<typeof googleDocsConfigSchema>;

interface GoogleDocsConfigDialogProps {
  children: React.ReactNode;
}

export default function GoogleDocsConfigDialog({ children }: GoogleDocsConfigDialogProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [authUrl, setAuthUrl] = useState<string | null>(null);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Get current Google Docs integration status
  const { data: googleDocsConfig, isLoading } = useQuery({
    queryKey: ['/api/integrations/google-docs'],
    enabled: isOpen,
  });

  const form = useForm<GoogleDocsConfigData>({
    resolver: zodResolver(googleDocsConfigSchema),
    defaultValues: {
      authCode: "",
      folderName: "Journal Entries",
    },
  });

  // Get authorization URL
  const getAuthUrlMutation = useMutation({
    mutationFn: async () => {
      const response = await fetch('/api/integrations/google-docs/auth-url', {
        method: 'POST',
        credentials: 'include',
      });
      
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message);
      }
      
      return response.json();
    },
    onSuccess: (result) => {
      setAuthUrl(result.authUrl);
      toast({
        title: "Authorization URL Generated",
        description: "Click the link below to authorize Google Docs access",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Failed to Generate Auth URL",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Configure Google Docs integration
  const configureMutation = useMutation({
    mutationFn: async (data: GoogleDocsConfigData) => {
      const response = await fetch('/api/integrations/google-docs/configure', {
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
    onSuccess: () => {
      toast({
        title: "Success!",
        description: "Google Docs integration configured successfully",
      });
      queryClient.invalidateQueries({ queryKey: ['/api/integrations/google-docs'] });
      setIsOpen(false);
      setAuthUrl(null);
      form.reset();
    },
    onError: (error: Error) => {
      toast({
        title: "Configuration Failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Toggle integration on/off
  const toggleMutation = useMutation({
    mutationFn: async (enabled: boolean) => {
      const response = await fetch('/api/integrations/google-docs/toggle', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ enabled }),
      });
      
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message);
      }
      
      return response.json();
    },
    onSuccess: (result) => {
      toast({
        title: result.enabled ? "Integration Enabled" : "Integration Disabled",
        description: result.message,
      });
      queryClient.invalidateQueries({ queryKey: ['/api/integrations/google-docs'] });
    },
    onError: (error: Error) => {
      toast({
        title: "Toggle Failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Bulk sync all entries
  const syncAllMutation = useMutation({
    mutationFn: async () => {
      const response = await fetch('/api/integrations/google-docs/sync-all', {
        method: 'POST',
        credentials: 'include',
      });
      
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message);
      }
      
      return response.json();
    },
    onSuccess: (result) => {
      toast({
        title: "Sync Completed",
        description: result.message,
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Sync Failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const onSubmit = (data: GoogleDocsConfigData) => {
    configureMutation.mutate(data);
  };

  const handleToggle = (enabled: boolean) => {
    toggleMutation.mutate(enabled);
  };

  const handleGetAuthUrl = () => {
    getAuthUrlMutation.mutate();
  };

  // Listen for OAuth callback messages
  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      if (event.data.type === 'GOOGLE_AUTH_SUCCESS' && event.data.code) {
        form.setValue('authCode', event.data.code);
        setAuthUrl(null);
        toast({
          title: "Authorization Successful",
          description: "You can now complete the configuration below",
        });
      }
    };

    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, [form, toast]);

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        {children}
      </DialogTrigger>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            Google Docs Integration
          </DialogTitle>
          <DialogDescription>
            Automatically add all journal entries to a single shared Google Doc in your Drive folder
          </DialogDescription>
        </DialogHeader>

        {isLoading ? (
          <div className="flex items-center justify-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#6366F1]"></div>
          </div>
        ) : (
          <div className="space-y-6">
            {/* Current Status */}
            {googleDocsConfig?.configured && (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-sm">
                    {googleDocsConfig.enabled ? (
                      <CheckCircle className="h-4 w-4 text-green-500" />
                    ) : (
                      <AlertCircle className="h-4 w-4 text-orange-500" />
                    )}
                    Current Status
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex items-center justify-between">
                    <span className="text-sm">Integration Status</span>
                    <div className="flex items-center gap-2">
                      <Switch
                        checked={googleDocsConfig.enabled}
                        onCheckedChange={handleToggle}
                        disabled={toggleMutation.isPending}
                      />
                      <span className="text-sm">
                        {googleDocsConfig.enabled ? "Enabled" : "Disabled"}
                      </span>
                    </div>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm">Folder Name</span>
                    <span className="text-sm font-medium">
                      {googleDocsConfig.config?.folderName || "Journal Entries"}
                    </span>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => syncAllMutation.mutate()}
                    disabled={syncAllMutation.isPending || !googleDocsConfig.enabled}
                    className="w-full"
                  >
                    {syncAllMutation.isPending ? "Syncing..." : "Sync All Entries"}
                  </Button>
                </CardContent>
              </Card>
            )}

            {/* Configuration Form */}
            <Card>
              <CardHeader>
                <CardTitle>
                  {googleDocsConfig?.configured ? "Update Configuration" : "Setup Integration"}
                </CardTitle>
                <CardDescription>
                  Connect your Google account to automatically create Google Docs for journal entries
                </CardDescription>
              </CardHeader>
              <CardContent>
                {!authUrl ? (
                  <div className="space-y-4">
                    <p className="text-sm text-gray-600">
                      First, get authorization to access your Google Drive:
                    </p>
                    <Button
                      onClick={handleGetAuthUrl}
                      disabled={getAuthUrlMutation.isPending}
                      className="w-full"
                    >
                      {getAuthUrlMutation.isPending ? "Generating..." : "Get Authorization URL"}
                    </Button>
                  </div>
                ) : (
                  <div className="space-y-4">
                    <div className="p-4 bg-blue-50 rounded-lg space-y-2">
                      <p className="text-sm font-medium">Step 1: Authorize Access</p>
                      <button
                        onClick={() => window.open(authUrl, 'google-auth', 'width=500,height=600')}
                        className="text-blue-600 hover:underline inline-flex items-center gap-1 text-sm bg-blue-100 px-3 py-2 rounded border border-blue-200 hover:bg-blue-200 transition-colors"
                      >
                        Authorize Google Docs Access
                        <ExternalLink className="h-3 w-3" />
                      </button>
                    </div>
                    
                    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                      <div className="space-y-2">
                        <Label htmlFor="authCode">Step 2: Enter Authorization Code</Label>
                        <Input
                          id="authCode"
                          placeholder="Paste authorization code here"
                          {...form.register("authCode")}
                        />
                        {form.formState.errors.authCode && (
                          <p className="text-sm text-red-600">
                            {form.formState.errors.authCode.message}
                          </p>
                        )}
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="folderName">Google Drive Folder Name (Optional)</Label>
                        <Input
                          id="folderName"
                          placeholder="Journal Entries"
                          {...form.register("folderName")}
                        />
                        <p className="text-xs text-gray-500">
                          Name for the folder where your shared journal document will be stored
                        </p>
                      </div>

                      <Button
                        type="submit"
                        className="w-full"
                        disabled={configureMutation.isPending}
                      >
                        {configureMutation.isPending
                          ? "Configuring..."
                          : googleDocsConfig?.configured
                          ? "Update Configuration"
                          : "Configure Integration"}
                      </Button>
                    </form>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Setup Instructions */}
            <Card>
              <CardHeader>
                <CardTitle className="text-sm">How It Works</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3 text-sm">
                <div>
                  <strong>Single Shared Document:</strong>
                  <p className="text-gray-600 ml-4">
                    All journal entries are added to one shared Google Doc for easy access and reading
                  </p>
                </div>
                <div>
                  <strong>Organized Storage:</strong>
                  <p className="text-gray-600 ml-4">
                    The shared document is stored in a dedicated folder in your Google Drive
                  </p>
                </div>
                <div>
                  <strong>Rich Formatting:</strong>
                  <p className="text-gray-600 ml-4">
                    Each entry includes titles, dates, transcribed text, themes, and tags with proper formatting
                  </p>
                </div>
                <div>
                  <strong>Date Extraction:</strong>
                  <p className="text-gray-600 ml-4">
                    Uses AI to extract actual journal dates from content when available
                  </p>
                </div>
              </CardContent>
            </Card>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}