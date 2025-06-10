import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { AlertCircle, CheckCircle, Settings, ExternalLink, TestTube } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

const notionConfigSchema = z.object({
  integrationToken: z.string().min(1, "Integration token is required"),
  pageUrl: z.string().url("Please enter a valid Notion page URL"),
  databaseName: z.string().optional().default("Journal Entries"),
});

type NotionConfigData = z.infer<typeof notionConfigSchema>;

interface NotionConfigDialogProps {
  children: React.ReactNode;
}

export default function NotionConfigDialog({ children }: NotionConfigDialogProps) {
  const [isOpen, setIsOpen] = useState(false);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Get current Notion integration status
  const { data: notionConfig, isLoading } = useQuery({
    queryKey: ['/api/integrations/notion'],
    enabled: isOpen,
  });

  const form = useForm<NotionConfigData>({
    resolver: zodResolver(notionConfigSchema),
    defaultValues: {
      integrationToken: "",
      pageUrl: "",
      databaseName: "Journal Entries",
    },
  });

  // Configure Notion integration
  const configureMutation = useMutation({
    mutationFn: async (data: NotionConfigData) => {
      const response = await fetch('/api/integrations/notion/configure', {
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
        description: "Notion integration configured successfully",
      });
      queryClient.invalidateQueries({ queryKey: ['/api/integrations/notion'] });
      setIsOpen(false);
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
      const response = await fetch('/api/integrations/notion/toggle', {
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
      queryClient.invalidateQueries({ queryKey: ['/api/integrations/notion'] });
    },
    onError: (error: Error) => {
      toast({
        title: "Toggle Failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Test connection
  const testMutation = useMutation({
    mutationFn: async () => {
      const response = await fetch('/api/integrations/notion/test', {
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
        title: "Connection Test Successful",
        description: `Found ${result.databaseCount} database(s) in your workspace`,
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Connection Test Failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const onSubmit = (data: NotionConfigData) => {
    configureMutation.mutate(data);
  };

  const handleToggle = (enabled: boolean) => {
    toggleMutation.mutate(enabled);
  };

  const handleTest = () => {
    testMutation.mutate();
  };

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        {children}
      </DialogTrigger>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Settings className="h-5 w-5" />
            Notion Integration
          </DialogTitle>
          <DialogDescription>
            Automatically sync your journal entries to your personal Notion workspace
          </DialogDescription>
        </DialogHeader>

        {isLoading ? (
          <div className="flex items-center justify-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#6366F1]"></div>
          </div>
        ) : (
          <div className="space-y-6">
            {/* Current Status */}
            {notionConfig?.configured && (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-sm">
                    {notionConfig.enabled ? (
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
                        checked={notionConfig.enabled}
                        onCheckedChange={handleToggle}
                        disabled={toggleMutation.isPending}
                      />
                      <span className="text-sm">
                        {notionConfig.enabled ? "Enabled" : "Disabled"}
                      </span>
                    </div>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm">Database Name</span>
                    <span className="text-sm font-medium">
                      {notionConfig.config?.databaseName || "Journal Entries"}
                    </span>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleTest}
                    disabled={testMutation.isPending}
                    className="w-full"
                  >
                    <TestTube className="h-4 w-4 mr-2" />
                    {testMutation.isPending ? "Testing..." : "Test Connection"}
                  </Button>
                </CardContent>
              </Card>
            )}

            {/* Configuration Form */}
            <Card>
              <CardHeader>
                <CardTitle>
                  {notionConfig?.configured ? "Update Configuration" : "Setup Integration"}
                </CardTitle>
                <CardDescription>
                  Connect your personal Notion workspace to automatically sync journal entries
                </CardDescription>
              </CardHeader>
              <CardContent>
                <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="integrationToken">Integration Token</Label>
                    <Input
                      id="integrationToken"
                      type="password"
                      placeholder="secret_..."
                      {...form.register("integrationToken")}
                    />
                    {form.formState.errors.integrationToken && (
                      <p className="text-sm text-red-600">
                        {form.formState.errors.integrationToken.message}
                      </p>
                    )}
                    <p className="text-xs text-gray-500">
                      Create an integration at{" "}
                      <a
                        href="https://www.notion.so/my-integrations"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-[#6366F1] hover:underline inline-flex items-center gap-1"
                      >
                        notion.so/my-integrations
                        <ExternalLink className="h-3 w-3" />
                      </a>
                    </p>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="pageUrl">Notion Page URL</Label>
                    <Input
                      id="pageUrl"
                      type="url"
                      placeholder="https://www.notion.so/your-page-id"
                      {...form.register("pageUrl")}
                    />
                    {form.formState.errors.pageUrl && (
                      <p className="text-sm text-red-600">
                        {form.formState.errors.pageUrl.message}
                      </p>
                    )}
                    <p className="text-xs text-gray-500">
                      URL of the Notion page where the journal database will be created
                    </p>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="databaseName">Database Name (Optional)</Label>
                    <Input
                      id="databaseName"
                      placeholder="Journal Entries"
                      {...form.register("databaseName")}
                    />
                    <p className="text-xs text-gray-500">
                      Name for the database that will store your journal entries
                    </p>
                  </div>

                  <Button
                    type="submit"
                    className="w-full"
                    disabled={configureMutation.isPending}
                  >
                    {configureMutation.isPending
                      ? "Configuring..."
                      : notionConfig?.configured
                      ? "Update Configuration"
                      : "Configure Integration"}
                  </Button>
                </form>
              </CardContent>
            </Card>

            {/* Setup Instructions */}
            <Card>
              <CardHeader>
                <CardTitle className="text-sm">Setup Instructions</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3 text-sm">
                <div>
                  <strong>1. Create Notion Integration:</strong>
                  <p className="text-gray-600 ml-4">
                    Go to notion.so/my-integrations and create a new integration for your workspace
                  </p>
                </div>
                <div>
                  <strong>2. Get Integration Token:</strong>
                  <p className="text-gray-600 ml-4">
                    Copy the "Internal Integration Token" from your integration settings
                  </p>
                </div>
                <div>
                  <strong>3. Share Page with Integration:</strong>
                  <p className="text-gray-600 ml-4">
                    Share your target Notion page with the integration you created
                  </p>
                </div>
                <div>
                  <strong>4. Copy Page URL:</strong>
                  <p className="text-gray-600 ml-4">
                    Get the full URL of the page where you want journal entries to be stored
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