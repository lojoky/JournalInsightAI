import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ArrowLeft, BarChart3, Heart, Tag, TrendingUp, Calendar, FileText, Brain } from "lucide-react";
import { Link } from "wouter";
import type { JournalEntryWithDetails } from "@shared/schema";

export default function Insights() {
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
          <p className="text-gray-600">Loading insights...</p>
        </div>
      </div>
    );
  }

  // Calculate insights from entries
  const completedEntries = entries?.filter(e => e.processingStatus === 'completed') || [];
  const totalEntries = entries?.length || 0;
  
  // Tag frequency analysis
  const tagCounts = new Map<string, number>();
  completedEntries.forEach(entry => {
    entry.tags?.forEach(tag => {
      tagCounts.set(tag.name, (tagCounts.get(tag.name) || 0) + 1);
    });
  });
  const topTags = Array.from(tagCounts.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10);

  // Theme frequency analysis
  const themeCounts = new Map<string, { count: number; avgConfidence: number }>();
  completedEntries.forEach(entry => {
    entry.themes?.forEach(theme => {
      const existing = themeCounts.get(theme.title) || { count: 0, avgConfidence: 0 };
      const confidence = theme.confidence || 75; // fallback if null
      themeCounts.set(theme.title, {
        count: existing.count + 1,
        avgConfidence: (existing.avgConfidence * existing.count + confidence) / (existing.count + 1)
      });
    });
  });
  const topThemes = Array.from(themeCounts.entries())
    .sort((a, b) => b[1].count - a[1].count)
    .slice(0, 8);



  return (
    <div className="min-h-screen bg-[#F9FAFB]">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 sticky top-0 z-50">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center space-x-4">
              <Link href="/">
                <Button variant="ghost" size="sm">
                  <ArrowLeft className="w-4 h-4 mr-2" />
                  Back to Dashboard
                </Button>
              </Link>
              <div>
                <h1 className="text-xl font-semibold text-[#111827]">Journal Insights</h1>
                <p className="text-sm text-gray-500">Analytics from {completedEntries.length} processed entries</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {completedEntries.length === 0 ? (
          <div className="text-center py-12">
            <BarChart3 className="w-12 h-12 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">No insights available yet</h3>
            <p className="text-gray-500 mb-6">Upload and process some journal entries to see your personal insights</p>
            <Link href="/">
              <Button>Upload First Entry</Button>
            </Link>
          </div>
        ) : (
          <div className="space-y-8">
            {/* Overview Stats */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
              <Card>
                <CardContent className="p-6">
                  <div className="flex items-center">
                    <FileText className="h-8 w-8 text-[#6366F1]" />
                    <div className="ml-4">
                      <p className="text-sm font-medium text-gray-600">Total Entries</p>
                      <p className="text-2xl font-bold text-gray-900">{totalEntries}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="p-6">
                  <div className="flex items-center">
                    <TrendingUp className="h-8 w-8 text-green-500" />
                    <div className="ml-4">
                      <p className="text-sm font-medium text-gray-600">Processed</p>
                      <p className="text-2xl font-bold text-gray-900">{completedEntries.length}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="p-6">
                  <div className="flex items-center">
                    <Tag className="h-8 w-8 text-[#8B5CF6]" />
                    <div className="ml-4">
                      <p className="text-sm font-medium text-gray-600">Unique Tags</p>
                      <p className="text-2xl font-bold text-gray-900">{tagCounts.size}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="p-6">
                  <div className="flex items-center">
                    <Brain className="h-8 w-8 text-blue-500" />
                    <div className="ml-4">
                      <p className="text-sm font-medium text-gray-600">Themes</p>
                      <p className="text-2xl font-bold text-gray-900">{themeCounts.size}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>



            {/* Top Themes */}
            {topThemes.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle>Most Common Themes</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {topThemes.map(([title, data]) => (
                      <div key={title} className="border-l-4 border-[#6366F1] pl-4">
                        <div className="flex items-center justify-between">
                          <h4 className="font-medium text-gray-900">{title}</h4>
                          <div className="flex items-center gap-2">
                            <Badge variant="outline">{data.count} entries</Badge>
                            <Badge variant="outline">{Math.round(data.avgConfidence)}% confidence</Badge>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Top Tags */}
            {topTags.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center">
                    <Tag className="w-5 h-5 mr-2" />
                    Most Frequent Tags
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="flex flex-wrap gap-3">
                    {topTags.map(([tagName, count]) => (
                      <div key={tagName} className="flex items-center gap-2">
                        <Badge variant="outline" className="text-sm">
                          {tagName}
                        </Badge>
                        <span className="text-sm text-gray-500">({count})</span>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Recent Activity */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center">
                  <Calendar className="w-5 h-5 mr-2" />
                  Recent Activity
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {completedEntries.slice(-5).reverse().map((entry, index) => (
                    <div key={index} className="flex items-center justify-between py-2 border-b border-gray-100 last:border-b-0">
                      <span className="text-sm text-gray-600">{new Date(entry.createdAt).toLocaleDateString()}</span>
                      <Badge variant="default" className="text-xs">
                        {entry.title}
                      </Badge>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>
        )}
      </div>
    </div>
  );
}