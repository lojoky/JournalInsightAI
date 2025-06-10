import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { AlertCircle, CheckCircle, Copy, ExternalLink } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

export default function GoogleOAuthTroubleshoot() {
  const [showDetails, setShowDetails] = useState(false);
  const { toast } = useToast();

  const { data: diagnostics, isLoading } = useQuery<{
    hasClientId: boolean;
    hasClientSecret: boolean;
    currentDomain: string;
    expectedRedirectUri: string;
    replitDomains: string | null;
    timestamp: string;
  }>({
    queryKey: ['/api/google-oauth-diagnostics'],
    refetchInterval: 0
  });

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast({
      title: "Copied to clipboard",
      description: "Redirect URI copied successfully",
    });
  };

  if (isLoading) {
    return <div>Loading diagnostics...</div>;
  }

  const redirectUri = "https://journal-ai-insights.replit.app/api/auth/google/callback";

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <AlertCircle className="h-5 w-5 text-orange-500" />
            Google OAuth Setup Required
          </CardTitle>
          <CardDescription>
            Your Google Cloud Console needs to be configured with the correct redirect URI
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="bg-gray-50 p-4 rounded-lg">
            <h4 className="font-medium mb-2">Required Redirect URI:</h4>
            <div className="flex items-center gap-2 bg-white p-2 rounded border">
              <code className="flex-1 text-sm font-mono">{redirectUri}</code>
              <Button
                size="sm"
                variant="outline"
                onClick={() => copyToClipboard(redirectUri)}
              >
                <Copy className="h-4 w-4" />
              </Button>
            </div>
          </div>

          <div className="space-y-2">
            <h4 className="font-medium">Setup Steps:</h4>
            <ol className="list-decimal list-inside space-y-1 text-sm">
              <li>Go to Google Cloud Console</li>
              <li>Navigate to APIs & Services → Credentials</li>
              <li>Find your OAuth 2.0 Client ID</li>
              <li>Add the redirect URI above to "Authorized redirect URIs"</li>
              <li>Save the changes</li>
              <li>Wait 5-10 minutes for changes to propagate</li>
            </ol>
          </div>

          <div className="flex gap-2">
            <Button 
              asChild 
              variant="outline"
              size="sm"
            >
              <a 
                href="https://console.cloud.google.com/apis/credentials" 
                target="_blank" 
                rel="noopener noreferrer"
                className="flex items-center gap-2"
              >
                <ExternalLink className="h-4 w-4" />
                Open Google Cloud Console
              </a>
            </Button>
            <Button 
              variant="ghost" 
              size="sm"
              onClick={() => setShowDetails(!showDetails)}
            >
              {showDetails ? 'Hide' : 'Show'} Technical Details
            </Button>
          </div>

          {showDetails && diagnostics && (
            <div className="mt-4 p-4 bg-gray-50 rounded-lg">
              <h4 className="font-medium mb-2">Configuration Status:</h4>
              <div className="space-y-2 text-sm">
                <div className="flex items-center gap-2">
                  {diagnostics.hasClientId ? (
                    <CheckCircle className="h-4 w-4 text-green-500" />
                  ) : (
                    <AlertCircle className="h-4 w-4 text-red-500" />
                  )}
                  <span>Google Client ID: {diagnostics.hasClientId ? 'Configured' : 'Missing'}</span>
                </div>
                <div className="flex items-center gap-2">
                  {diagnostics.hasClientSecret ? (
                    <CheckCircle className="h-4 w-4 text-green-500" />
                  ) : (
                    <AlertCircle className="h-4 w-4 text-red-500" />
                  )}
                  <span>Google Client Secret: {diagnostics.hasClientSecret ? 'Configured' : 'Missing'}</span>
                </div>
                <div className="mt-3">
                  <strong>Current Domain:</strong> {diagnostics.currentDomain}
                </div>
                <div>
                  <strong>Expected Redirect URI:</strong> {diagnostics.expectedRedirectUri}
                </div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Common Issues</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3 text-sm">
            <div>
              <Badge variant="destructive">Error 400: redirect_uri_mismatch</Badge>
              <p className="mt-1">The redirect URI in your Google Cloud Console doesn't match your app's domain.</p>
            </div>
            <div>
              <Badge variant="destructive">Error 500: Internal Server Error</Badge>
              <p className="mt-1">Usually caused by missing OAuth credentials or redirect URI configuration.</p>
            </div>
            <div>
              <Badge variant="secondary">Authorization code missing</Badge>
              <p className="mt-1">Google isn't returning the authorization code, often due to redirect URI issues.</p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}