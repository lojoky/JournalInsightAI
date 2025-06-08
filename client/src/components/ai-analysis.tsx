import { Card, CardContent } from "@/components/ui/card";
import { Lightbulb, Compass, Star } from "lucide-react";
import type { JournalEntryWithDetails } from "@shared/schema";

interface AIAnalysisProps {
  entry: JournalEntryWithDetails;
}

export default function AIAnalysis({ entry }: AIAnalysisProps) {
  const { themes, sentimentAnalysis } = entry;

  if (!themes || themes.length === 0) {
    return (
      <Card className="journal-card">
        <CardContent className="p-6">
          <h3 className="text-lg font-semibold text-[#111827] mb-4">AI-Generated Insights</h3>
          <div className="text-center py-8">
            <Lightbulb className="w-12 h-12 text-gray-300 mx-auto mb-4" />
            <p className="text-gray-500">AI analysis will appear here once processing is complete.</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="journal-card">
      <CardContent className="p-6">
        <h3 className="text-lg font-semibold text-[#111827] mb-4">AI-Generated Insights</h3>
        
        <div className="space-y-6">
          {/* Key Themes */}
          <div className="bg-purple-50 rounded-lg p-4">
            <h4 className="font-semibold text-[#8B5CF6] mb-3 flex items-center">
              <Lightbulb className="w-4 h-4 mr-2" />
              Key Themes Identified
            </h4>
            <div className="space-y-3">
              {themes.map((theme, index) => (
                <div key={theme.id} className="flex items-start space-x-2">
                  <span className="w-2 h-2 bg-[#8B5CF6] rounded-full mt-2 flex-shrink-0" />
                  <div>
                    <span className="font-medium text-[#111827]">{theme.title}</span>
                    {theme.description && (
                      <p className="text-sm text-gray-600 mt-1">{theme.description}</p>
                    )}
                    {theme.confidence && (
                      <span className="text-xs text-gray-500">Confidence: {theme.confidence}%</span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Emotional Tone */}
          {sentimentAnalysis && (
            <div className="bg-amber-50 rounded-lg p-4">
              <h4 className="font-semibold text-[#F59E0B] mb-3 flex items-center">
                <Star className="w-4 h-4 mr-2" />
                Emotional Tone
              </h4>
              <div className="grid grid-cols-3 gap-4 text-center">
                <div>
                  <div className="text-2xl font-bold text-[#10B981]">
                    {sentimentAnalysis.positiveScore}%
                  </div>
                  <div className="text-sm text-gray-600">Positive</div>
                </div>
                <div>
                  <div className="text-2xl font-bold text-gray-500">
                    {sentimentAnalysis.neutralScore}%
                  </div>
                  <div className="text-sm text-gray-600">Neutral</div>
                </div>
                <div>
                  <div className="text-2xl font-bold text-amber-600">
                    {sentimentAnalysis.concernScore}%
                  </div>
                  <div className="text-sm text-gray-600">Concern</div>
                </div>
              </div>
            </div>
          )}

          {/* Reflection Questions */}
          <div className="bg-indigo-50 rounded-lg p-4">
            <h4 className="font-semibold text-[#6366F1] mb-3 flex items-center">
              <Compass className="w-4 h-4 mr-2" />
              Reflection Questions
            </h4>
            <div className="space-y-2 text-sm text-[#111827]">
              {themes.map((theme, index) => (
                <div key={`question-${index}`}>
                  • What specific aspects of {theme.title.toLowerCase()} are most important to you?
                </div>
              ))}
              <div>• How do these themes connect to your overall personal growth?</div>
              <div>• What actions might you take based on these insights?</div>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
