import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Brain, User, Menu, Download, LogOut } from "lucide-react";
import FileUpload from "@/components/file-upload";
import ProcessingStatus from "@/components/processing-status";
import TranscriptionResults from "@/components/transcription-results";
import AIAnalysis from "@/components/ai-analysis";
import TagSystem from "@/components/tag-system";
import RecentEntries from "@/components/recent-entries";
import ExportDialog from "@/components/export-dialog";
// Google Docs integration removed - will be rebuilt
import { useJournalProcessing } from "@/hooks/use-journal-processing";
import { useAuth } from "@/components/auth/auth-provider";

export default function Home() {
  const { user, logout } = useAuth();
  const {
    currentEntry,
    isProcessing,
    bulkProgress,
    uploadFile,
    uploadBulkFiles,
    processTranscription,
    analyzeEntry,
    addCustomTag
  } = useJournalProcessing();

  const handleLogout = () => {
    logout();
  };

  return (
    <div className="min-h-screen bg-[#F9FAFB]">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center space-x-2 sm:space-x-3">
              <div className="w-8 h-8 sm:w-10 sm:h-10 bg-[#6366F1] rounded-lg flex items-center justify-center">
                <Brain className="text-white w-4 h-4 sm:w-5 sm:h-5" />
              </div>
              <div className="hidden sm:block">
                <h1 className="text-lg sm:text-xl font-semibold text-[#111827]">JournalAI</h1>
                <p className="text-xs text-gray-500">AI-Powered Journal Processing</p>
              </div>
              <h1 className="text-lg font-semibold text-[#111827] sm:hidden">JournalAI</h1>
            </div>
            
            {/* Desktop Navigation */}
            <nav className="hidden md:flex items-center space-x-6">
              <span className="text-[#111827] hover:text-[#6366F1] font-medium">Dashboard</span>
              <a href="/entries" className="text-gray-600 hover:text-[#6366F1]">Entries</a>
              <a href="/insights" className="text-gray-600 hover:text-[#6366F1]">Insights</a>
              <a href="/settings" className="text-gray-600 hover:text-[#6366F1]">Settings</a>
            </nav>
            
            {/* Mobile & Desktop Actions */}
            <div className="flex items-center space-x-1 sm:space-x-3">
              {/* Desktop Export */}
              <div className="hidden sm:block">
                <ExportDialog>
                  <Button variant="outline" size="sm">
                    <Download className="w-4 h-4 mr-2" />
                    Export
                  </Button>
                </ExportDialog>
              </div>
              
              {/* Mobile Export */}
              <div className="block sm:hidden">
                <ExportDialog>
                  <Button variant="outline" size="sm" className="p-2">
                    <Download className="w-4 h-4" />
                  </Button>
                </ExportDialog>
              </div>
              
              {/* Mobile Menu */}
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" size="sm" className="md:hidden p-2">
                    <Menu className="w-4 h-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-48">
                  <DropdownMenuItem>
                    <a href="/entries" className="w-full">Entries</a>
                  </DropdownMenuItem>
                  <DropdownMenuItem>
                    <a href="/insights" className="w-full">Insights</a>
                  </DropdownMenuItem>
                  <DropdownMenuItem>
                    <a href="/settings" className="w-full">Settings</a>
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={handleLogout}>
                    <LogOut className="w-4 h-4 mr-2" />
                    Sign Out
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
              
              {/* Desktop User Menu */}
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" size="sm" className="hidden md:flex">
                    <User className="w-4 h-4 mr-2" />
                    <span className="hidden lg:inline">{user?.username}</span>
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem onClick={handleLogout}>
                    <LogOut className="w-4 h-4 mr-2" />
                    Sign Out
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 sm:py-8">
        {/* Page Header */}
        <div className="mb-6 sm:mb-8">
          <h2 className="text-2xl sm:text-3xl font-bold text-[#111827] mb-2">Process Journal Entry</h2>
          <p className="text-sm sm:text-base text-gray-600">Upload an image of your handwritten journal entry to extract insights and organize your thoughts.</p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-8">
          {/* Left Column: Upload and Processing */}
          <div className="space-y-6">
            <FileUpload 
              onFileUpload={uploadFile} 
              onBulkUpload={uploadBulkFiles}
              isProcessing={isProcessing} 
            />

            <ProcessingStatus 
              entry={currentEntry}
              isProcessing={isProcessing}
              bulkProgress={bulkProgress}
            />

            {currentEntry?.originalImageUrl && (
              <Card className="journal-card">
                <CardContent className="p-6">
                  <h3 className="text-lg font-semibold text-[#111827] mb-4">Uploaded Image</h3>
                  <img 
                    src={currentEntry.originalImageUrl}
                    alt="Uploaded journal entry"
                    className="w-full h-64 object-cover rounded-lg shadow-sm"
                  />
                  <div className="mt-4 flex items-center justify-between text-sm text-gray-600">
                    <span>{currentEntry.title}</span>
                    <span>Uploaded</span>
                  </div>
                </CardContent>
              </Card>
            )}
          </div>

          {/* Right Column: Results and Analysis */}
          <div className="space-y-6">
            {currentEntry?.transcribedText && (
              <TranscriptionResults 
                entry={currentEntry}
                onTranscriptionUpdate={processTranscription}
              />
            )}

            {currentEntry?.themes && currentEntry.themes.length > 0 && (
              <AIAnalysis entry={currentEntry} />
            )}

            {currentEntry && (
              <TagSystem 
                entry={currentEntry}
                onAddCustomTag={addCustomTag}
              />
            )}

            {currentEntry && (
              <Card className="journal-card">
                <CardContent className="p-4 sm:p-6">
                  <h3 className="text-lg font-semibold text-[#111827] mb-4">Actions</h3>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                    <Button className="bg-[#6366F1] text-white hover:bg-indigo-700 py-3 h-auto">
                      Save Entry
                    </Button>
                    <ExportDialog>
                      <Button variant="outline" className="py-3 h-auto">
                        Export Data
                      </Button>
                    </ExportDialog>
                  </div>
                  <div className="mt-3 sm:mt-4 grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                    <Button variant="ghost" className="text-[#8B5CF6] hover:text-purple-700 py-2 h-auto">
                      Add to Collection
                    </Button>
                    <Button variant="ghost" className="text-[#F59E0B] hover:text-yellow-700 py-2 h-auto">
                      Set Reminder
                    </Button>
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
        </div>

        {/* Recent Entries */}
        <RecentEntries />
      </main>

      {/* Footer */}
      <footer className="bg-white border-t border-gray-200 mt-12 sm:mt-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8">
          <div className="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-4 gap-6 sm:gap-8">
            <div className="col-span-2 sm:col-span-1">
              <div className="flex items-center space-x-3 mb-3 sm:mb-4">
                <div className="w-8 h-8 bg-[#6366F1] rounded-lg flex items-center justify-center">
                  <Brain className="text-white w-4 h-4" />
                </div>
                <span className="font-semibold text-[#111827]">JournalAI</span>
              </div>
              <p className="text-gray-600 text-sm">Transform your handwritten thoughts into organized digital insights with AI-powered analysis.</p>
            </div>
            <div>
              <h4 className="font-semibold text-[#111827] mb-3">Features</h4>
              <ul className="space-y-2 text-sm text-gray-600">
                <li>OCR Processing</li>
                <li>AI Theme Analysis</li>
                <li>Auto Tagging</li>
                <li>Insight Generation</li>
              </ul>
            </div>
            <div>
              <h4 className="font-semibold text-[#111827] mb-3">Support</h4>
              <ul className="space-y-2 text-sm text-gray-600">
                <li>Help Center</li>
                <li>Contact Us</li>
                <li>Privacy Policy</li>
                <li>Terms of Service</li>
              </ul>
            </div>
            <div>
              <h4 className="font-semibold text-[#111827] mb-3">Connect</h4>
              <div className="flex space-x-4">
                <a href="#" className="text-gray-400 hover:text-[#6366F1] transition-colors">Twitter</a>
                <a href="#" className="text-gray-400 hover:text-[#6366F1] transition-colors">LinkedIn</a>
                <a href="#" className="text-gray-400 hover:text-[#6366F1] transition-colors">GitHub</a>
              </div>
            </div>
          </div>
          <div className="border-t border-gray-200 mt-6 sm:mt-8 pt-4 sm:pt-6 text-center text-sm text-gray-600">
            <p>&copy; 2024 JournalAI. All rights reserved.</p>
          </div>
        </div>
      </footer>
    </div>
  );
}
