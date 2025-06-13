import { useQuery } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Bookmark, Clock } from "lucide-react";
import { Link } from "wouter";
import { useAuth } from "@/components/auth/auth-provider";
import type { JournalEntryWithDetails } from "@shared/schema";

export default function RecentEntries() {
  const { user } = useAuth();
  
  const { data: entries, isLoading, error } = useQuery<JournalEntryWithDetails[]>({
    queryKey: ["/api/journal-entries", user?.id],
    queryFn: async () => {
      const response = await fetch('/api/journal-entries?limit=6');
      return response.json() as Promise<JournalEntryWithDetails[]>;
    },
    enabled: !!user?.id,
    staleTime: 0
  });

  if (isLoading) {
    return (
      <div className="mt-12">
        <h3 className="text-2xl font-bold text-[#111827] mb-6">Recent Entries</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {[1, 2, 3].map((i) => (
            <Card key={i} className="journal-card animate-pulse">
              <CardContent className="p-6">
                <div className="h-4 bg-gray-200 rounded mb-2" />
                <div className="h-32 bg-gray-200 rounded mb-3" />
                <div className="h-3 bg-gray-200 rounded mb-2" />
                <div className="h-3 bg-gray-200 rounded w-2/3" />
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="mt-12">
        <h3 className="text-2xl font-bold text-[#111827] mb-6">Recent Entries</h3>
        <Card className="journal-card">
          <CardContent className="p-6 text-center">
            <p className="text-gray-500">Unable to load recent entries.</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!entries || entries.length === 0) {
    return (
      <div className="mt-12">
        <h3 className="text-2xl font-bold text-[#111827] mb-6">Recent Entries</h3>
        <Card className="journal-card">
          <CardContent className="p-6 text-center">
            <p className="text-gray-500">No journal entries yet. Upload your first entry to get started!</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const formatDate = (date: string | Date) => {
    const dateObj = typeof date === 'string' ? new Date(date) : date;
    return dateObj.toLocaleDateString('en-US', {
      month: 'long',
      day: 'numeric',
      year: 'numeric'
    });
  };

  const getWordCount = (text?: string) => {
    if (!text) return 0;
    return text.trim().split(/\s+/).length;
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "completed":
        return "bg-[#10B981]";
      case "processing":
        return "bg-[#F59E0B]";
      case "failed":
        return "bg-red-500";
      default:
        return "bg-gray-400";
    }
  };

  const getStatusText = (status: string) => {
    switch (status) {
      case "completed":
        return "Analyzed";
      case "processing":
        return "Processing";
      case "failed":
        return "Failed";
      default:
        return "Pending";
    }
  };

  return (
    <div className="mt-8 sm:mt-12">
      <div className="flex items-center justify-between mb-4 sm:mb-6">
        <h3 className="text-xl sm:text-2xl font-bold text-[#111827]">Recent Entries</h3>
        <Link href="/entries">
          <span className="text-[#6366F1] hover:text-indigo-700 font-medium cursor-pointer text-sm sm:text-base">
            View All
          </span>
        </Link>
      </div>
      
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
        {entries.map((entry) => (
          <Link key={entry.id} href={`/entry/${entry.id}`}>
            <Card className="journal-card hover:shadow-md transition-shadow cursor-pointer">
              <CardContent className="p-4 sm:p-6">
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex items-center space-x-2">
                      {entry.originalImageUrl && (
                        <img
                          src={entry.originalImageUrl}
                          alt="Entry thumbnail"
                          className="w-8 h-8 rounded object-cover"
                        />
                      )}
                      <div>
                        <h4 className="font-medium text-[#111827] truncate max-w-32">
                          {entry.title}
                        </h4>
                        <p className="text-xs text-gray-500">
                          {formatDate(entry.createdAt)}
                        </p>
                      </div>
                    </div>
                    <Bookmark className="w-4 h-4 text-gray-300 hover:text-[#F59E0B] cursor-pointer" />
                  </div>
                  
                  {entry.transcribedText && (
                    <p className="text-sm text-gray-600 mb-4 line-clamp-3">
                      {entry.transcribedText.slice(0, 150)}
                      {entry.transcribedText.length > 150 ? "..." : ""}
                    </p>
                  )}
                  
                  {entry.tags && entry.tags.length > 0 && (
                    <div className="flex flex-wrap gap-1 mb-4">
                      {entry.tags.slice(0, 3).map((tag) => (
                        <span
                          key={tag.id}
                          className="px-2 py-1 text-xs font-medium rounded"
                          style={{
                            backgroundColor: `${tag.color || '#6366F1'}10`,
                            color: tag.color || '#6366F1'
                          }}
                        >
                          {tag.name}
                        </span>
                      ))}
                      {entry.tags.length > 3 && (
                        <span className="px-2 py-1 bg-gray-100 text-gray-600 text-xs font-medium rounded">
                          +{entry.tags.length - 3}
                        </span>
                      )}
                    </div>
                  )}
                  
                  <div className="flex items-center justify-between text-xs text-gray-500">
                    <span>{getWordCount(entry.transcribedText || '')} words</span>
                    <span className="flex items-center space-x-1">
                      <div className={`w-2 h-2 rounded-full ${getStatusColor(entry.processingStatus)}`} />
                      <span>{getStatusText(entry.processingStatus)}</span>
                    </span>
                  </div>
                </CardContent>
              </Card>
            </Link>
        ))}
      </div>
    </div>
  );
}
