import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { AlertCircle, CheckCircle, Copy, ExternalLink, ArrowRight } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

export default function GoogleSetupPage() {
  const [currentStep, setCurrentStep] = useState(1);
  const { toast } = useToast();

  const { data: diagnostics } = useQuery<{
    hasClientId: boolean;
    hasClientSecret: boolean;
    currentDomain: string;
    expectedRedirectUri: string;
    replitDomains: string | null;
    timestamp: string;
  }>({
    queryKey: ['/api/google-oauth-diagnostics'],
  });

  const redirectUri = "https://journal-ai-insights.replit.app/api/auth/google/callback";

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast({
      title: "Copied to clipboard",
      description: "Redirect URI copied successfully",
    });
  };

  const steps = [
    {
      title: "Open Google Cloud Console",
      description: "Navigate to the Google Cloud Console credentials page",
      action: (
        <Button asChild>
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
      )
    },
    {
      title: "Find Your OAuth 2.0 Client ID",
      description: "Look for your existing OAuth 2.0 Client ID in the credentials list",
      action: (
        <div className="text-sm text-gray-600">
          Look for a credential with type "OAuth 2.0 Client IDs"
        </div>
      )
    },
    {
      title: "Edit the OAuth Client",
      description: "Click on your OAuth 2.0 Client ID to edit it",
      action: (
        <div className="text-sm text-gray-600">
          Click the pencil/edit icon next to your OAuth client
        </div>
      )
    },
    {
      title: "Add the Redirect URI",
      description: "Add the exact redirect URI to the authorized redirect URIs list",
      action: (
        <div className="space-y-2">
          <div className="flex items-center gap-2 bg-gray-50 p-2 rounded border">
            <code className="flex-1 text-sm font-mono">{redirectUri}</code>
            <Button
              size="sm"
              variant="outline"
              onClick={() => copyToClipboard(redirectUri)}
            >
              <Copy className="h-4 w-4" />
            </Button>
          </div>
          <p className="text-sm text-gray-600">
            Paste this exact URI into the "Authorized redirect URIs" section
          </p>
        </div>
      )
    },
    {
      title: "Save Changes",
      description: "Save the OAuth client configuration",
      action: (
        <div className="text-sm text-gray-600">
          Click "Save" at the bottom of the form
        </div>
      )
    },
    {
      title: "Wait for Propagation",
      description: "Allow 5-10 minutes for changes to take effect",
      action: (
        <div className="text-sm text-gray-600">
          Google's servers need time to update the configuration
        </div>
      )
    }
  ];

  return (
    <div className="container mx-auto px-4 py-8 max-w-4xl">
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2">Google Docs Integration Setup</h1>
        <p className="text-gray-600">
          Follow these steps to configure Google OAuth for journal synchronization
        </p>
      </div>

      {/* Current Status */}
      <Card className="mb-8">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <AlertCircle className="h-5 w-5 text-orange-500" />
            Current Configuration Status
          </CardTitle>
        </CardHeader>
        <CardContent>
          {diagnostics && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="flex items-center gap-2">
                {diagnostics.hasClientId ? (
                  <CheckCircle className="h-5 w-5 text-green-500" />
                ) : (
                  <AlertCircle className="h-5 w-5 text-red-500" />
                )}
                <span>Google Client ID: {diagnostics.hasClientId ? 'Configured' : 'Missing'}</span>
              </div>
              <div className="flex items-center gap-2">
                {diagnostics.hasClientSecret ? (
                  <CheckCircle className="h-5 w-5 text-green-500" />
                ) : (
                  <AlertCircle className="h-5 w-5 text-red-500" />
                )}
                <span>Google Client Secret: {diagnostics.hasClientSecret ? 'Configured' : 'Missing'}</span>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Setup Steps */}
      <div className="space-y-4">
        {steps.map((step, index) => (
          <Card key={index} className={currentStep === index + 1 ? "border-blue-500" : ""}>
            <CardHeader>
              <div className="flex items-center gap-3">
                <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium ${
                  currentStep > index + 1 
                    ? "bg-green-500 text-white" 
                    : currentStep === index + 1 
                      ? "bg-blue-500 text-white" 
                      : "bg-gray-200 text-gray-600"
                }`}>
                  {currentStep > index + 1 ? "✓" : index + 1}
                </div>
                <div>
                  <CardTitle className="text-lg">{step.title}</CardTitle>
                  <CardDescription>{step.description}</CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {step.action}
              {currentStep === index + 1 && (
                <div className="mt-4">
                  <Button 
                    onClick={() => setCurrentStep(currentStep + 1)}
                    className="flex items-center gap-2"
                  >
                    Next Step
                    <ArrowRight className="h-4 w-4" />
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Common Issues */}
      <Card className="mt-8">
        <CardHeader>
          <CardTitle>Common Issues & Solutions</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div>
              <div className="flex items-center gap-2 mb-2">
                <Badge variant="destructive">Error 400: redirect_uri_mismatch</Badge>
              </div>
              <p className="text-sm text-gray-600">
                Solution: Ensure the redirect URI in your Google Cloud Console exactly matches: <code>{redirectUri}</code>
              </p>
            </div>
            <div>
              <div className="flex items-center gap-2 mb-2">
                <Badge variant="destructive">Error 500: Internal Server Error</Badge>
              </div>
              <p className="text-sm text-gray-600">
                Solution: Check that both Google Client ID and Client Secret are properly configured in your environment variables.
              </p>
            </div>
            <div>
              <div className="flex items-center gap-2 mb-2">
                <Badge variant="secondary">Authorization code missing</Badge>
              </div>
              <p className="text-sm text-gray-600">
                Solution: This usually indicates a redirect URI mismatch. Double-check the URI configuration.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Test Button */}
      <div className="mt-8 text-center">
        <Button asChild size="lg">
          <a href="/" className="flex items-center gap-2">
            Return to App & Test Integration
            <ArrowRight className="h-4 w-4" />
          </a>
        </Button>
      </div>
    </div>
  );
}