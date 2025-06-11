import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, ExternalLink, CheckCircle, AlertCircle, Settings } from "lucide-react";
import { Link } from "wouter";
import { useToast } from "@/hooks/use-toast";

interface NotionStatus {
  enabled: boolean;
  configured: boolean;
  config?: any;
}

export default function SettingsIntegrations() {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Fetch Notion integration status
  const { data: notionStatus, isLoading: notionLoading } = useQuery({
    queryKey: ['/api/integrations/notion'],
    queryFn: async () => {
      const response = await fetch('/api/integrations/notion', {
        credentials: 'include',
      });
      return response.json() as Promise<NotionStatus>;
    }
  });

  // Notion test mutation
  const testNotionMutation = useMutation({
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
    onSuccess: () => {
      toast({
        title: "Test Successful",
        description: "Notion integration is working correctly",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Test Failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  return (
    <div className="container mx-auto p-6 max-w-4xl">
      <div className="flex items-center gap-4 mb-6">
        <Link href="/settings">
          <Button variant="ghost" size="sm">
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Settings
          </Button>
        </Link>
        <h1 className="text-2xl font-bold">Integrations</h1>
      </div>

      <div className="grid gap-6">
        {/* Notion Integration */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-gray-900 rounded-lg flex items-center justify-center">
                  <span className="text-white font-bold text-sm">N</span>
                </div>
                <div>
                  <CardTitle className="text-lg">Notion</CardTitle>
                  <p className="text-sm text-muted-foreground">
                    Sync your journal entries to Notion databases
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                {notionLoading ? (
                  <Badge variant="outline">Loading...</Badge>
                ) : notionStatus?.configured ? (
                  <Badge variant="default" className="bg-green-100 text-green-800 border-green-200">
                    <CheckCircle className="w-3 h-3 mr-1" />
                    Connected
                  </Badge>
                ) : (
                  <Badge variant="outline" className="border-red-200 text-red-600">
                    <AlertCircle className="w-3 h-3 mr-1" />
                    Not Connected
                  </Badge>
                )}
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground">
                Notion integration allows you to automatically sync your journal entries to your Notion workspace.
                Your entries will be organized in a structured database with themes, tags, and sentiment analysis.
              </p>
              
              {notionStatus?.configured ? (
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => testNotionMutation.mutate()}
                    disabled={testNotionMutation.isPending}
                  >
                    <Settings className="w-4 h-4 mr-2" />
                    {testNotionMutation.isPending ? "Testing..." : "Test Connection"}
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    asChild
                  >
                    <a href={notionStatus.config?.pageUrl} target="_blank" rel="noopener noreferrer">
                      <ExternalLink className="w-4 h-4 mr-2" />
                      View Notion Page
                    </a>
                  </Button>
                </div>
              ) : (
                <div className="bg-blue-50 dark:bg-blue-950 p-4 rounded-lg">
                  <h4 className="font-medium text-blue-900 dark:text-blue-100 mb-2">Setup Required</h4>
                  <p className="text-sm text-blue-700 dark:text-blue-300 mb-3">
                    To use Notion integration, you need to configure the connection with your Notion workspace.
                  </p>
                  <Button variant="outline" size="sm" disabled>
                    Contact Support for Setup
                  </Button>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Export Options */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Export Options</CardTitle>
            <p className="text-sm text-muted-foreground">
              Export your journal entries for use in other applications
            </p>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground">
                While direct integrations provide seamless syncing, you can always export your data
                and import it into other platforms like Google Docs, Word, or other note-taking applications.
              </p>
              
              <div className="flex gap-2">
                <Button variant="outline" size="sm" disabled>
                  Export as JSON
                </Button>
                <Button variant="outline" size="sm" disabled>
                  Export as CSV
                </Button>
                <Button variant="outline" size="sm" disabled>
                  Export as Markdown
                </Button>
              </div>
              
              <p className="text-xs text-muted-foreground">
                Export features coming soon
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}