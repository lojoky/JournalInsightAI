import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Download, FileText, Calendar, Tag, Brain } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import type { JournalEntryWithDetails } from "@shared/schema";

interface ExportDialogProps {
  children: React.ReactNode;
}

export default function ExportDialog({ children }: ExportDialogProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [exportFormat, setExportFormat] = useState<"docx" | "html">("docx");
  const [dateRange, setDateRange] = useState<"all" | "last30" | "last90">("all");
  const [isExporting, setIsExporting] = useState(false);
  const { toast } = useToast();

  const { data: entries } = useQuery<JournalEntryWithDetails[]>({
    queryKey: ["/api/journal-entries"],
  });

  const filteredEntries = entries?.filter(entry => {
    if (dateRange === "all") return true;
    
    const entryDate = new Date(entry.createdAt);
    const now = new Date();
    const daysAgo = dateRange === "last30" ? 30 : 90;
    const cutoffDate = new Date(now.getTime() - (daysAgo * 24 * 60 * 60 * 1000));
    
    return entryDate >= cutoffDate;
  }) || [];

  const generateHTMLDocument = () => {
    const formatDate = (dateString: string) => {
      return new Date(dateString).toLocaleDateString('en-US', {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric'
      });
    };

    const html = `
<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <title>Journal Entries Export</title>
    <style>
        body {
            font-family: 'Georgia', serif;
            line-height: 1.6;
            max-width: 800px;
            margin: 0 auto;
            padding: 20px;
            color: #333;
        }
        h1 {
            color: #6366F1;
            text-align: center;
            margin-bottom: 30px;
            border-bottom: 2px solid #6366F1;
            padding-bottom: 10px;
        }
        .entry {
            margin-bottom: 40px;
            page-break-inside: avoid;
            border: 1px solid #e5e7eb;
            border-radius: 8px;
            padding: 20px;
            background: #f9fafb;
        }
        .entry-header {
            margin-bottom: 15px;
            border-bottom: 1px solid #d1d5db;
            padding-bottom: 10px;
        }
        .entry-title {
            font-size: 24px;
            font-weight: bold;
            color: #111827;
            margin-bottom: 5px;
        }
        .entry-date {
            color: #6b7280;
            font-style: italic;
        }
        .entry-content {
            margin: 15px 0;
            line-height: 1.8;
        }
        .transcribed-text {
            background: white;
            padding: 15px;
            border-left: 4px solid #6366F1;
            margin: 15px 0;
            border-radius: 4px;
        }
        .themes {
            margin: 20px 0;
        }
        .theme {
            background: #ede9fe;
            padding: 10px;
            margin: 8px 0;
            border-radius: 4px;
            border-left: 3px solid #8b5cf6;
        }
        .theme-title {
            font-weight: bold;
            color: #7c3aed;
        }
        .tags {
            margin: 15px 0;
        }
        .tag {
            display: inline-block;
            background: #e0e7ff;
            color: #3730a3;
            padding: 4px 8px;
            margin: 2px;
            border-radius: 12px;
            font-size: 12px;
        }
        .sentiment {
            background: #f0f9ff;
            padding: 10px;
            border-radius: 4px;
            margin: 10px 0;
            border-left: 3px solid #0ea5e9;
        }
        .reflection-questions {
            background: #fef3c7;
            padding: 15px;
            border-radius: 4px;
            margin: 15px 0;
        }
        .reflection-questions h4 {
            color: #92400e;
            margin-bottom: 10px;
        }
        .reflection-questions ul {
            list-style-type: none;
            padding-left: 0;
        }
        .reflection-questions li {
            margin: 8px 0;
            padding-left: 20px;
            position: relative;
        }
        .reflection-questions li:before {
            content: "💭";
            position: absolute;
            left: 0;
        }
        .export-info {
            text-align: center;
            margin: 30px 0;
            color: #6b7280;
            border-top: 1px solid #e5e7eb;
            padding-top: 20px;
        }
        @media print {
            body { margin: 0; padding: 15px; }
            .entry { page-break-inside: avoid; }
        }
    </style>
</head>
<body>
    <h1>📖 Journal Entries Collection</h1>
    <div class="export-info">
        <p>Exported on ${new Date().toLocaleDateString('en-US', { 
          weekday: 'long', 
          year: 'numeric', 
          month: 'long', 
          day: 'numeric' 
        })}</p>
        <p>Total Entries: ${filteredEntries.length}</p>
    </div>

    ${filteredEntries.map(entry => `
        <div class="entry">
            <div class="entry-header">
                <div class="entry-title">${entry.title}</div>
                <div class="entry-date">${formatDate(entry.createdAt.toString())}</div>
            </div>
            
            <div class="entry-content">
                ${entry.transcribedText ? `
                    <div class="transcribed-text">
                        <strong>📝 Transcribed Text:</strong><br>
                        ${entry.transcribedText.replace(/\n/g, '<br>')}
                    </div>
                ` : ''}
                
                ${entry.themes && entry.themes.length > 0 ? `
                    <div class="themes">
                        <h4>🧠 Key Themes:</h4>
                        ${entry.themes.map(theme => `
                            <div class="theme">
                                <div class="theme-title">${theme.title}</div>
                                <div>${theme.description}</div>
                            </div>
                        `).join('')}
                    </div>
                ` : ''}
                
                ${entry.tags && entry.tags.length > 0 ? `
                    <div class="tags">
                        <strong>🏷️ Tags:</strong><br>
                        ${entry.tags.map(tag => `<span class="tag">${tag.name}</span>`).join('')}
                    </div>
                ` : ''}
                
                ${entry.sentimentAnalysis ? `
                    <div class="sentiment">
                        <strong>💭 Emotional Tone:</strong> ${entry.sentimentAnalysis.overallSentiment}
                        <br>
                        <small>
                            Positive: ${Math.round(entry.sentimentAnalysis.positiveScore)}% | 
                            Neutral: ${Math.round(entry.sentimentAnalysis.neutralScore)}% | 
                            Concern: ${Math.round(entry.sentimentAnalysis.concernScore)}%
                        </small>
                    </div>
                ` : ''}
            </div>
        </div>
    `).join('')}
    
    <div class="export-info">
        <p><em>Generated by JournalAI - AI-Powered Journal Processing</em></p>
    </div>
</body>
</html>`;

    return html;
  };

  const handleExport = async () => {
    if (!filteredEntries.length) {
      toast({
        title: "No entries to export",
        description: "Please ensure you have journal entries in the selected date range.",
        variant: "destructive",
      });
      return;
    }

    setIsExporting(true);

    try {
      const htmlContent = generateHTMLDocument();
      
      if (exportFormat === "html") {
        // Export as HTML file
        const blob = new Blob([htmlContent], { type: 'text/html' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `journal-entries-${new Date().toISOString().split('T')[0]}.html`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
      } else {
        // Export as DOCX-compatible HTML (can be opened by Word/Google Docs)
        const docxContent = `
          <html xmlns:o='urn:schemas-microsoft-com:office:office' xmlns:w='urn:schemas-microsoft-com:office:word'>
          <head><meta charset='utf-8'><title>Journal Entries</title></head>
          <body>${htmlContent.replace(/<html>.*<body>/g, '').replace(/<\/body>.*<\/html>/g, '')}</body>
          </html>
        `;
        
        const blob = new Blob([docxContent], { 
          type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' 
        });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `journal-entries-${new Date().toISOString().split('T')[0]}.doc`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
      }

      toast({
        title: "Export successful",
        description: `Your journal entries have been exported. The file can be imported into Google Docs.`,
      });
      
      setIsOpen(false);
    } catch (error) {
      console.error('Export error:', error);
      toast({
        title: "Export failed",
        description: "There was an error exporting your journal entries.",
        variant: "destructive",
      });
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        {children}
      </DialogTrigger>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center space-x-2">
            <FileText className="w-5 h-5 text-[#6366F1]" />
            <span>Export Journal Entries</span>
          </DialogTitle>
        </DialogHeader>
        
        <div className="space-y-6">
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between text-sm">
                <span>Entries to export:</span>
                <span className="font-semibold">{filteredEntries.length}</span>
              </div>
            </CardContent>
          </Card>

          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium text-gray-700 mb-2 block">
                <Calendar className="w-4 h-4 inline mr-1" />
                Date Range
              </label>
              <Select value={dateRange} onValueChange={(value: any) => setDateRange(value)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All entries</SelectItem>
                  <SelectItem value="last30">Last 30 days</SelectItem>
                  <SelectItem value="last90">Last 90 days</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <label className="text-sm font-medium text-gray-700 mb-2 block">
                <Download className="w-4 h-4 inline mr-1" />
                Export Format
              </label>
              <Select value={exportFormat} onValueChange={(value: any) => setExportFormat(value)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="docx">Word Document (.doc)</SelectItem>
                  <SelectItem value="html">HTML Document (.html)</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="bg-blue-50 p-3 rounded-lg">
            <div className="flex items-start space-x-2">
              <Brain className="w-4 h-4 text-blue-600 mt-0.5" />
              <div className="text-xs text-blue-800">
                <strong>Google Docs Import:</strong> Download the file and upload it to Google Drive. 
                Google Docs will automatically convert it for editing.
              </div>
            </div>
          </div>

          <Button 
            onClick={handleExport}
            disabled={isExporting || filteredEntries.length === 0}
            className="w-full bg-[#6366F1] hover:bg-indigo-700"
          >
            {isExporting ? (
              "Generating..."
            ) : (
              <>
                <Download className="w-4 h-4 mr-2" />
                Export {filteredEntries.length} Entries
              </>
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}