import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Settings as SettingsIcon, Palette, Bell, Shield, HelpCircle, Zap } from "lucide-react";
import { Link } from "wouter";
import RetryFailedEntries from "@/components/retry-failed-entries";
import NotionConfigDialog from "@/components/notion-config-dialog";
// Google Docs integration removed - will be rebuilt

export default function Settings() {
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
                <p className="text-sm text-gray-500">Manage your journal preferences</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
        {/* Processing Status */}
        <RetryFailedEntries />

        {/* Integrations */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center">
              <Zap className="w-5 h-5 mr-2" />
              Integrations
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h4 className="text-sm font-medium text-gray-900">Notion</h4>
                <p className="text-sm text-gray-500">Automatically sync journal entries to your Notion workspace</p>
              </div>
              <NotionConfigDialog>
                <Button variant="outline" size="sm">
                  Configure
                </Button>
              </NotionConfigDialog>
            </div>
            <div className="flex items-center justify-between">
              <div>
                <h4 className="text-sm font-medium text-gray-900">Google Docs</h4>
                <p className="text-sm text-gray-500">Add all journal entries to a single shared Google Doc in your Drive folder</p>
              </div>
              <GoogleDocsConfigDialog>
                <Button variant="outline" size="sm">
                  Configure
                </Button>
              </GoogleDocsConfigDialog>
            </div>
          </CardContent>
        </Card>

        {/* General Settings */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center">
              <SettingsIcon className="w-5 h-5 mr-2" />
              General Settings
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h4 className="text-sm font-medium text-gray-900">OCR Method</h4>
                <p className="text-sm text-gray-500">Choose between OpenAI Vision or traditional OCR</p>
              </div>
              <Button variant="outline" size="sm">
                OpenAI Vision (Recommended)
              </Button>
            </div>
            
            <div className="flex items-center justify-between">
              <div>
                <h4 className="text-sm font-medium text-gray-900">Auto-tagging</h4>
                <p className="text-sm text-gray-500">Automatically generate tags from content</p>
              </div>
              <Button variant="outline" size="sm">
                Enabled
              </Button>
            </div>

            <div className="flex items-center justify-between">
              <div>
                <h4 className="text-sm font-medium text-gray-900">Processing Language</h4>
                <p className="text-sm text-gray-500">Language for text analysis</p>
              </div>
              <Button variant="outline" size="sm">
                English
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Theme Settings */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center">
              <Palette className="w-5 h-5 mr-2" />
              Appearance
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h4 className="text-sm font-medium text-gray-900">Theme</h4>
                <p className="text-sm text-gray-500">Choose your preferred theme</p>
              </div>
              <Button variant="outline" size="sm">
                Light Mode
              </Button>
            </div>
            
            <div className="flex items-center justify-between">
              <div>
                <h4 className="text-sm font-medium text-gray-900">Color Scheme</h4>
                <p className="text-sm text-gray-500">Primary color for the interface</p>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-6 h-6 rounded-full bg-[#6366F1] border-2 border-gray-300"></div>
                <span className="text-sm">Indigo</span>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Privacy & Security */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center">
              <Shield className="w-5 h-5 mr-2" />
              Privacy & Security
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h4 className="text-sm font-medium text-gray-900">Data Retention</h4>
                <p className="text-sm text-gray-500">How long to keep your journal entries</p>
              </div>
              <Button variant="outline" size="sm">
                Forever
              </Button>
            </div>
            
            <div className="flex items-center justify-between">
              <div>
                <h4 className="text-sm font-medium text-gray-900">Image Storage</h4>
                <p className="text-sm text-gray-500">Where your uploaded images are stored</p>
              </div>
              <Button variant="outline" size="sm">
                Local Server
              </Button>
            </div>

            <div className="flex items-center justify-between">
              <div>
                <h4 className="text-sm font-medium text-gray-900">AI Processing</h4>
                <p className="text-sm text-gray-500">Enable AI analysis of journal content</p>
              </div>
              <Button variant="outline" size="sm">
                Enabled
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Notifications */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center">
              <Bell className="w-5 h-5 mr-2" />
              Notifications
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h4 className="text-sm font-medium text-gray-900">Processing Updates</h4>
                <p className="text-sm text-gray-500">Get notified when entries are processed</p>
              </div>
              <Button variant="outline" size="sm">
                Enabled
              </Button>
            </div>
            
            <div className="flex items-center justify-between">
              <div>
                <h4 className="text-sm font-medium text-gray-900">Weekly Insights</h4>
                <p className="text-sm text-gray-500">Receive weekly journal insights</p>
              </div>
              <Button variant="outline" size="sm">
                Disabled
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Help & Support */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center">
              <HelpCircle className="w-5 h-5 mr-2" />
              Help & Support
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <h4 className="text-sm font-medium text-gray-900">Getting Started</h4>
              <p className="text-sm text-gray-600">
                Upload journal images and let AI extract insights from your handwritten content.
                For best results, use well-lit photos with clear handwriting.
              </p>
            </div>
            
            <div className="space-y-2">
              <h4 className="text-sm font-medium text-gray-900">Supported Formats</h4>
              <p className="text-sm text-gray-600">
                JPEG, PNG, and HEIC images are supported. HEIC files are automatically converted for processing.
              </p>
            </div>

            <div className="space-y-2">
              <h4 className="text-sm font-medium text-gray-900">AI Features</h4>
              <p className="text-sm text-gray-600">
                Text extraction uses OpenAI Vision for superior handwriting recognition.
                Analysis includes theme identification, sentiment analysis, and automatic tagging.
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}