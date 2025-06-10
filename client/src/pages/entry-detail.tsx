import { useQuery } from "@tanstack/react-query";
import { useRoute } from "wouter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Calendar, Image as ImageIcon, Brain, Heart, Tag, MessageSquare } from "lucide-react";
import { Link } from "wouter";
import type { JournalEntryWithDetails } from "@shared/schema";

export default function EntryDetail() {
  const [match, params] = useRoute("/entry/:id");
  const entryId = params?.id;

  const { data: entry, isLoading } = useQuery({
    queryKey: ['/api/journal-entries', entryId],
    queryFn: async () => {
      const response = await fetch(`/api/journal-entries/${entryId}`);
      return response.json() as Promise<JournalEntryWithDetails>;
    },
    enabled: !!entryId
  });

  if (isLoading) {
    return (
      <div className="min-h-screen bg-[#F9FAFB] flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#6366F1] mx-auto mb-4"></div>
          <p className="text-gray-600">Loading entry...</p>
        </div>
      </div>
    );
  }

  if (!entry) {
    return (
      <div className="min-h-screen bg-[#F9FAFB] flex items-center justify-center">
        <div className="text-center">
          <h2 className="text-xl font-semibold text-gray-900 mb-2">Entry not found</h2>
          <p className="text-gray-500 mb-6">The journal entry you're looking for doesn't exist.</p>
          <Link href="/entries">
            <Button>Back to Entries</Button>
          </Link>
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
              <Link href="/entries">
                <Button variant="ghost" size="sm">
                  <ArrowLeft className="w-4 h-4 mr-2" />
                  Back to Entries
                </Button>
              </Link>
              <div>
                <h1 className="text-xl font-semibold text-[#111827]">{entry.title}</h1>
                <div className="flex items-center text-sm text-gray-500">
                  <Calendar className="w-4 h-4 mr-1" />
                  {new Date(entry.createdAt).toLocaleDateString('en-US', {
                    year: 'numeric',
                    month: 'long',
                    day: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit'
                  })}
                </div>
              </div>
            </div>
            <Badge 
              variant={entry.processingStatus === 'completed' ? 'default' : 'secondary'}
              className={entry.processingStatus === 'completed' ? 'bg-green-100 text-green-800' : ''}
            >
              {entry.processingStatus}
            </Badge>
          </div>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
        {/* Original Image */}
        {entry.originalImageUrl && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center">
                <ImageIcon className="w-5 h-5 mr-2" />
                Original Image
              </CardTitle>
            </CardHeader>
            <CardContent>
              <img 
                src={entry.originalImageUrl} 
                alt={entry.title}
                className="max-w-full h-auto rounded-lg border"
              />
            </CardContent>
          </Card>
        )}

        {/* Transcribed Text */}
        {entry.transcribedText && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                <div className="flex items-center">
                  <MessageSquare className="w-5 h-5 mr-2" />
                  Extracted Text
                </div>
                {entry.ocrConfidence && (
                  <Badge variant="outline">
                    {entry.ocrConfidence}% confidence
                  </Badge>
                )}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="bg-gray-50 p-4 rounded-lg">
                <p className="text-gray-800 whitespace-pre-wrap leading-relaxed">
                  {entry.transcribedText}
                </p>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Themes */}
        {entry.themes && entry.themes.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center">
                <Brain className="w-5 h-5 mr-2" />
                Identified Themes
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {entry.themes.map((theme, index) => (
                  <div key={index} className="border-l-4 border-[#6366F1] pl-4">
                    <h4 className="font-medium text-gray-900">{theme.title}</h4>
                    <p className="text-sm text-gray-600 mt-1">{theme.description}</p>
                    <Badge variant="outline" className="mt-2">
                      {theme.confidence}% confidence
                    </Badge>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Sentiment Analysis */}
        {entry.sentimentAnalysis && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center">
                <Heart className="w-5 h-5 mr-2" />
                Emotional Analysis
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium">Overall Sentiment</span>
                  <Badge 
                    variant={entry.sentimentAnalysis.overallSentiment === 'positive' ? 'default' : 
                           entry.sentimentAnalysis.overallSentiment === 'negative' ? 'destructive' : 'secondary'}
                  >
                    {entry.sentimentAnalysis.overallSentiment}
                  </Badge>
                </div>
                
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-sm">Positive</span>
                    <span className="text-sm font-medium">{entry.sentimentAnalysis.positiveScore}%</span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-2">
                    <div 
                      className="bg-green-500 h-2 rounded-full" 
                      style={{ width: `${entry.sentimentAnalysis.positiveScore}%` }}
                    ></div>
                  </div>
                </div>

                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-sm">Neutral</span>
                    <span className="text-sm font-medium">{entry.sentimentAnalysis.neutralScore}%</span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-2">
                    <div 
                      className="bg-gray-500 h-2 rounded-full" 
                      style={{ width: `${entry.sentimentAnalysis.neutralScore}%` }}
                    ></div>
                  </div>
                </div>

                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-sm">Concern</span>
                    <span className="text-sm font-medium">{entry.sentimentAnalysis.concernScore}%</span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-2">
                    <div 
                      className="bg-red-500 h-2 rounded-full" 
                      style={{ width: `${entry.sentimentAnalysis.concernScore}%` }}
                    ></div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Tags */}
        {entry.tags && entry.tags.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center">
                <Tag className="w-5 h-5 mr-2" />
                Tags
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex flex-wrap gap-2">
                {entry.tags.map((tag, index) => (
                  <Badge 
                    key={index} 
                    variant="outline"
                    className={tag.isAutoGenerated ? 'border-[#6366F1] text-[#6366F1]' : 'border-gray-300'}
                  >
                    {tag.name}
                    {tag.confidence && (
                      <span className="ml-1 text-xs opacity-70">
                        {tag.confidence}%
                      </span>
                    )}
                  </Badge>
                ))}
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}