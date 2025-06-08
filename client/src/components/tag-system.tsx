import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Plus, X } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import type { JournalEntryWithDetails } from "@shared/schema";

interface TagSystemProps {
  entry: JournalEntryWithDetails;
  onAddCustomTag: (entryId: number, tagName: string, category?: string) => Promise<void>;
}

const tagColors: { [key: string]: string } = {
  faith: "#6366F1",
  career: "#8B5CF6", 
  relationships: "#10B981",
  gratitude: "#F59E0B",
  reflection: "#6B7280",
  "personal-growth": "#8B5CF6",
  family: "#10B981",
  decisions: "#F59E0B",
  mindfulness: "#10B981"
};

const suggestedTags = [
  { name: "confidence", category: "emotional" },
  { name: "decision-making", category: "mental" },
  { name: "professional-development", category: "career" },
  { name: "spiritual-growth", category: "spiritual" },
  { name: "work-life-balance", category: "lifestyle" }
];

export default function TagSystem({ entry, onAddCustomTag }: TagSystemProps) {
  const [customTag, setCustomTag] = useState("");
  const [isAdding, setIsAdding] = useState(false);
  const { toast } = useToast();

  const handleAddCustomTag = async () => {
    if (!customTag.trim()) return;

    setIsAdding(true);
    try {
      await onAddCustomTag(entry.id, customTag.trim());
      setCustomTag("");
      toast({
        title: "Tag added",
        description: `"${customTag}" has been added to this entry.`,
      });
    } catch (error) {
      toast({
        title: "Failed to add tag",
        description: "There was an error adding the custom tag.",
        variant: "destructive",
      });
    } finally {
      setIsAdding(false);
    }
  };

  const handleAddSuggestedTag = async (tagName: string, category: string) => {
    try {
      await onAddCustomTag(entry.id, tagName, category);
      toast({
        title: "Tag added",
        description: `"${tagName}" has been added to this entry.`,
      });
    } catch (error) {
      toast({
        title: "Failed to add tag",
        description: "There was an error adding the suggested tag.",
        variant: "destructive",
      });
    }
  };

  const getTagColor = (tagName: string, defaultColor = "#6366F1") => {
    return tagColors[tagName] || defaultColor;
  };

  return (
    <Card className="journal-card">
      <CardContent className="p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-[#111827]">Automatic Tags</h3>
          <Button
            variant="ghost"
            size="sm"
            className="text-[#6366F1] hover:text-indigo-700"
          >
            <Plus className="w-4 h-4 mr-1" />
            Add Custom Tag
          </Button>
        </div>
        
        {/* Current Tags */}
        <div className="flex flex-wrap gap-2 mb-4">
          {entry.tags && entry.tags.length > 0 ? (
            entry.tags.map((tag) => (
              <span
                key={tag.id}
                className="text-white px-3 py-1 rounded-full text-sm font-medium flex items-center"
                style={{ backgroundColor: getTagColor(tag.name, tag.color) }}
              >
                <span className="mr-1">
                  {tag.name === "faith" && "💒"}
                  {tag.name === "career" && "💼"}
                  {tag.name === "relationships" && "👥"}
                  {tag.name === "gratitude" && "🙏"}
                  {tag.name === "reflection" && "💭"}
                  {tag.name === "personal-growth" && "📈"}
                  {tag.name === "family" && "👨‍👩‍👧‍👦"}
                  {tag.name === "decisions" && "⚖️"}
                  {tag.name === "mindfulness" && "🧘"}
                </span>
                {tag.name.charAt(0).toUpperCase() + tag.name.slice(1).replace('-', ' ')}
                {tag.confidence && (
                  <span className="ml-2 text-xs opacity-75">
                    {tag.confidence}%
                  </span>
                )}
              </span>
            ))
          ) : (
            <p className="text-gray-500 text-sm">No tags yet. Add some tags to categorize this entry.</p>
          )}
        </div>

        {/* Add Custom Tag */}
        <div className="flex items-center space-x-2 mb-4">
          <Input
            type="text"
            placeholder="Add custom tag..."
            value={customTag}
            onChange={(e) => setCustomTag(e.target.value)}
            onKeyPress={(e) => e.key === 'Enter' && handleAddCustomTag()}
            className="flex-1"
          />
          <Button
            onClick={handleAddCustomTag}
            disabled={!customTag.trim() || isAdding}
            className="bg-[#6366F1] hover:bg-indigo-700"
          >
            {isAdding ? "Adding..." : "Add"}
          </Button>
        </div>

        {/* Suggested Categories */}
        <div className="bg-gray-50 rounded-lg p-4">
          <h4 className="font-medium text-[#111827] mb-3">Suggested Categories</h4>
          <div className="flex flex-wrap gap-2">
            {suggestedTags
              .filter(suggested => !entry.tags?.some(tag => tag.name === suggested.name))
              .map((suggested) => (
                <button
                  key={suggested.name}
                  onClick={() => handleAddSuggestedTag(suggested.name, suggested.category)}
                  className="border border-gray-300 text-gray-600 px-3 py-1 rounded-full text-sm hover:bg-[#6366F1] hover:text-white hover:border-[#6366F1] transition-colors"
                >
                  + {suggested.name.charAt(0).toUpperCase() + suggested.name.slice(1).replace('-', ' ')}
                </button>
              ))}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
