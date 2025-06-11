import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, ExternalLink, CheckCircle, AlertCircle, Settings } from "lucide-react";
import { Link } from "wouter";
import { useToast } from "@/hooks/use-toast";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";

interface GoogleDocsStatus {
  enabled: boolean;
  configured: boolean;
  needsReauth?: boolean;
}

interface NotionStatus {
  enabled: boolean;
  configured: boolean;
  config?: any;
}

export default function SettingsIntegrations() {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Fetch Google Docs integration status
  const { data: googleDocsStatus, isLoading: googleLoading } = useQuery({
    queryKey: ['/api/integrations/google-docs'],
    queryFn: async () => {
      const response = await fetch('/api/integrations/google-docs', {
        credentials: 'include',
      });
      return response.json() as Promise<GoogleDocsStatus>;
    },
    refetchOnWindowFocus: true,
    refetchInterval: 5000, // Check every 5 seconds for connection status updates
  });

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

  // Google Docs connect mutation
  const connectGoogleMutation = useMutation({
    mutationFn: async () => {
      const response = await fetch('/api/google/auth', {
        credentials: 'include',
      });
      const data = await response.json();
      if (data.authUrl) {
        window.location.href = data.authUrl;
      }
      return data;
    },
    onError: (error: Error) => {
      toast({
        title: "Connection Failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Google Docs disconnect mutation
  const disconnectGoogleMutation = useMutation({
    mutationFn: async () => {
      const response = await fetch('/api/integrations/google-docs', {
        method: 'DELETE',
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
        title: "Disconnected",
        description: "Google Docs integration has been disconnected",
      });
      queryClient.invalidateQueries({ queryKey: ['/api/integrations/google-docs'] });
    },
    onError: (error: Error) => {
      toast({
        title: "Disconnect Failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const handleGoogleConnect = () => {
    connectGoogleMutation.mutate();
  };

  const handleGoogleDisconnect = () => {
    disconnectGoogleMutation.mutate();
  };

  return (
    <div className="min-h-screen bg-[#F9FAFB]">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 sticky top-0 z-50">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center space-x-4">
              <Link href="/">
                <Button variant="ghost" size="sm">
                  <ArrowLeft className="w-4 h-4 mr-2" />
                  Back to Dashboard
                </Button>
              </Link>
              <div>
                <h1 className="text-xl font-semibold text-[#111827]">Settings</h1>
                <p className="text-sm text-gray-500">Manage your integrations</p>
              </div>
            </div>
            <div className="flex items-center">
              <Settings className="w-5 h-5 text-gray-400" />
            </div>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="space-y-6">
          {/* Google Docs Integration */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    <div className="w-8 h-8 bg-blue-100 rounded-lg flex items-center justify-center">
                      <svg className="w-5 h-5 text-blue-600" viewBox="0 0 24 24" fill="currentColor">
                        <path d="M14,2H6A2,2 0 0,0 4,4V20A2,2 0 0,0 6,22H18A2,2 0 0,0 20,20V8L14,2M18,20H6V4H13V9H18V20Z" />
                      </svg>
                    </div>
                    Google Docs
                    {googleLoading ? (
                      <Badge variant="secondary">Loading...</Badge>
                    ) : googleDocsStatus?.configured ? (
                      <Badge variant="default" className="bg-green-100 text-green-800">
                        <CheckCircle className="w-3 h-3 mr-1" />
                        Connected
                      </Badge>
                    ) : googleDocsStatus?.needsReauth ? (
                      <Badge variant="destructive">
                        <AlertCircle className="w-3 h-3 mr-1" />
                        Needs Reauth
                      </Badge>
                    ) : (
                      <Badge variant="secondary">Not Connected</Badge>
                    )}
                  </CardTitle>
                  <p className="text-sm text-gray-500 mt-1">
                    Sync your journal entries to Google Docs for backup and collaboration
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  {googleDocsStatus?.configured ? (
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button variant="outline" size="sm">
                          Disconnect
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Disconnect Google Docs</AlertDialogTitle>
                          <AlertDialogDescription>
                            This will remove your Google Docs integration. You'll need to reconnect to sync future entries.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Cancel</AlertDialogCancel>
                          <AlertDialogAction
                            onClick={handleGoogleDisconnect}
                            className="bg-red-600 hover:bg-red-700"
                          >
                            Disconnect
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  ) : (
                    <Button 
                      onClick={handleGoogleConnect}
                      disabled={connectGoogleMutation.isPending}
                      className="bg-blue-600 hover:bg-blue-700"
                    >
                      {connectGoogleMutation.isPending ? 'Connecting...' : 'Connect Google Docs'}
                    </Button>
                  )}
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="text-sm text-gray-600">
                  <p className="font-medium mb-2">Features:</p>
                  <ul className="space-y-1 ml-4">
                    <li>• Create new documents for journal entries</li>
                    <li>• Append entries to existing documents</li>
                    <li>• Automatic formatting with titles, dates, and tags</li>
                    <li>• Secure OAuth authentication</li>
                  </ul>
                </div>
                
                {googleDocsStatus?.configured && (
                  <div className="bg-green-50 p-3 rounded-lg">
                    <p className="text-sm text-green-800">
                      ✓ Google Docs is connected and ready to use. You can now sync journal entries when uploading or editing.
                    </p>
                  </div>
                )}

                {googleDocsStatus?.needsReauth && (
                  <div className="bg-yellow-50 p-3 rounded-lg">
                    <p className="text-sm text-yellow-800">
                      ⚠ Your Google authentication has expired. Please reconnect to continue syncing entries.
                    </p>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Notion Integration */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    <div className="w-8 h-8 bg-gray-100 rounded-lg flex items-center justify-center">
                      <svg className="w-5 h-5 text-gray-600" viewBox="0 0 24 24" fill="currentColor">
                        <path d="M4,4H20A2,2 0 0,1 22,6V18A2,2 0 0,1 20,20H4A2,2 0 0,1 2,18V6A2,2 0 0,1 4,4M4,6V18H20V6H4Z" />
                      </svg>
                    </div>
                    Notion
                    {notionLoading ? (
                      <Badge variant="secondary">Loading...</Badge>
                    ) : notionStatus?.configured ? (
                      <Badge variant="default" className="bg-green-100 text-green-800">
                        <CheckCircle className="w-3 h-3 mr-1" />
                        Connected
                      </Badge>
                    ) : (
                      <Badge variant="secondary">Not Connected</Badge>
                    )}
                  </CardTitle>
                  <p className="text-sm text-gray-500 mt-1">
                    Automatically sync entries to your Notion workspace
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <Link href="/settings/notion">
                    <Button variant="outline" size="sm">
                      {notionStatus?.configured ? 'Manage' : 'Set Up'}
                    </Button>
                  </Link>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="text-sm text-gray-600">
                  <p className="font-medium mb-2">Features:</p>
                  <ul className="space-y-1 ml-4">
                    <li>• Automatic database creation and management</li>
                    <li>• Rich formatting with images and text blocks</li>
                    <li>• Tag and sentiment analysis integration</li>
                    <li>• Real-time synchronization</li>
                  </ul>
                </div>

                {notionStatus?.configured && (
                  <div className="bg-green-50 p-3 rounded-lg">
                    <p className="text-sm text-green-800">
                      ✓ Notion is connected and automatically syncing your journal entries.
                    </p>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}