import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Calendar, FileText, Tag, Download } from "lucide-react";
import { Link } from "wouter";
import ExportDialog from "@/components/export-dialog";
import type { JournalEntryWithDetails } from "@shared/schema";

export default function Entries() {
  const { data: entries, isLoading } = useQuery({
    queryKey: ['/api/journal-entries'],
    queryFn: async () => {
      const response = await fetch('/api/journal-entries');
      return response.json() as Promise<JournalEntryWithDetails[]>;
    }
  });

  if (isLoading) {
    return (
      <div className="min-h-screen bg-[#F9FAFB] flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#6366F1] mx-auto mb-4"></div>
          <p className="text-gray-600">Loading entries...</p>
        </div>
      </div>
    );
  }

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
                <h1 className="text-xl font-semibold text-[#111827]">Journal Entries</h1>
                <p className="text-sm text-gray-500">{entries?.length || 0} entries</p>
              </div>
            </div>
            <ExportDialog>
              <Button className="bg-[#6366F1] hover:bg-indigo-700">
                <Download className="w-4 h-4 mr-2" />
                Export All
              </Button>
            </ExportDialog>
          </div>
        </div>
      </div>

      {/* Entries List */}
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {!entries || entries.length === 0 ? (
          <div className="text-center py-12">
            <FileText className="w-12 h-12 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">No entries yet</h3>
            <p className="text-gray-500 mb-6">Start by uploading your first journal image</p>
            <Link href="/">
              <Button>Upload First Entry</Button>
            </Link>
          </div>
        ) : (
          <div className="space-y-6">
            {entries.map((entry) => (
              <Link key={entry.id} href={`/entry/${entry.id}`}>
                <Card className="hover:shadow-md transition-shadow cursor-pointer">
                  <CardHeader>
                    <div className="flex items-start justify-between">
                      <div>
                        <CardTitle className="text-lg">{entry.title}</CardTitle>
                        <div className="flex items-center text-sm text-gray-500 mt-1">
                          <Calendar className="w-4 h-4 mr-1" />
                          {new Date(entry.createdAt).toLocaleDateString('en-US', {
                            year: 'numeric',
                            month: 'long',
                            day: 'numeric'
                          })}
                        </div>
                      </div>
                      <Badge 
                        variant={entry.processingStatus === 'completed' ? 'default' : 'secondary'}
                        className={entry.processingStatus === 'completed' ? 'bg-green-100 text-green-800' : ''}
                      >
                        {entry.processingStatus}
                      </Badge>
                    </div>
                  </CardHeader>
                  <CardContent>
                    {entry.transcribedText && (
                      <p className="text-gray-700 text-sm mb-4 line-clamp-3">
                        {entry.transcribedText.substring(0, 200)}
                        {entry.transcribedText.length > 200 ? '...' : ''}
                      </p>
                    )}
                    
                    {entry.tags && entry.tags.length > 0 && (
                      <div className="flex items-center gap-2 flex-wrap">
                        <Tag className="w-4 h-4 text-gray-400" />
                        {entry.tags.slice(0, 3).map((tag, index) => (
                          <Badge key={index} variant="outline" className="text-xs">
                            {tag.name}
                          </Badge>
                        ))}
                        {entry.tags.length > 3 && (
                          <Badge variant="outline" className="text-xs">
                            +{entry.tags.length - 3} more
                          </Badge>
                        )}
                      </div>
                    )}
                  </CardContent>
                </Card>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}