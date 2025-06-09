import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Settings as SettingsIcon, Palette, Bell, Shield, HelpCircle } from "lucide-react";
import { Link } from "wouter";
import RetryFailedEntries from "@/components/retry-failed-entries";

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

        {/* Notion Integration */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center">
              <svg className="w-5 h-5 mr-2" viewBox="0 0 24 24" fill="currentColor">
                <path d="M4.459 4.208c.746.606 1.026.56 2.428.466l13.215-.793c.28 0 .047-.28-.046-.326L17.86 1.968c-.42-.326-.981-.7-2.055-.607L3.01 2.295c-.466.046-.56.28-.374.466zm.793 3.08v13.904c0 .747.373 1.027 1.214.98l14.523-.84c.841-.046.935-.56.935-1.167V6.354c0-.606-.233-.933-.748-.887l-15.177.887c-.56.047-.747.327-.747.933zm14.337.745c.093.42 0 .84-.42.888l-.7.14v10.264c-.608.327-1.168.514-1.635.514-.748 0-.935-.233-1.495-.933l-4.577-7.186v6.952L12.21 19s0 .84-1.168.84l-3.222.186c-.093-.186 0-.653.327-.746l.84-.233V9.854L7.822 9.76c-.094-.42.14-1.026.793-1.073l3.456-.233 4.764 7.279v-6.44l-1.026-.139c-.093-.514.28-.887.747-.933zM1.936 1.035l13.31-.98c1.634-.14 2.055-.047 3.082.7l4.249 2.986c.7.513.934.747.934 1.213v16.378c0 1.026-.373 1.634-1.68 1.726l-15.458.934c-.98.047-1.448-.093-1.962-.747l-3.129-4.06c-.56-.747-.793-1.306-.793-1.96V2.667c0-.839.374-1.54 1.447-1.632z"/>
              </svg>
              Notion Integration
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h4 className="text-sm font-medium text-gray-900">Sync to Notion</h4>
                <p className="text-sm text-gray-500">Store journal entries in your Notion workspace</p>
              </div>
              <Button variant="outline" size="sm">
                Configure
              </Button>
            </div>
            
            <div className="bg-blue-50 p-4 rounded-md">
              <h5 className="text-sm font-medium text-blue-900 mb-2">Setup Instructions</h5>
              <ol className="text-sm text-blue-800 space-y-1 list-decimal list-inside">
                <li>Create a new integration in your Notion workspace</li>
                <li>Copy the integration secret token</li>
                <li>Share a Notion page with your integration</li>
                <li>Add your credentials in Settings</li>
              </ol>
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