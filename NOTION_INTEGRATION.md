# Notion Integration Control Guide

## Overview
Your journal app now has comprehensive Notion integration with extensive customization options. Journal entries automatically sync to your Notion database after AI processing completes.

## Database Structure
The system creates a "Journal Entries" database with these properties:

### Core Fields
- **Title** - AI-generated entry title
- **Content** - Full transcribed text (limited to 2000 chars for Notion)
- **Summary** - Brief summary from AI theme analysis
- **Date** - Entry creation date

### Analysis Fields
- **Tags** - Multi-select with AI-detected categories (faith, career, relationships, gratitude, etc.)
- **Themes** - Multi-select with AI-identified themes from your writing
- **Sentiment** - Overall emotional tone (Very Positive, Positive, Neutral, Concern, Negative)
- **Sentiment Score** - Percentage showing positivity level
- **Reflection Questions** - AI-generated questions for deeper thinking

### Technical Fields
- **OCR Confidence** - Accuracy percentage of text extraction
- **Word Count** - Number of words in the entry
- **Entry Source** - Type classification (Handwritten, Digital, Mixed)
- **Status** - Processing status (Processed, Pending, Failed)

## Customization Options

### 1. Database Structure Customization
You can modify the database schema in `server/notion.ts`:
- Add new properties
- Change property types (text, number, select, multi-select, date, etc.)
- Modify select options and colors
- Add formulas or relations

### 2. Data Filtering and Processing
Control what data gets synced:
- Filter sensitive content before syncing
- Transform data format
- Add custom computed fields
- Set character limits for different fields

### 3. Conditional Syncing
Configure when entries sync to Notion:
- Only sync entries above certain confidence thresholds
- Filter by sentiment or tags
- Sync only completed processing status
- Set up different databases for different entry types

### 4. Custom Properties
Add business logic to the sync process:
- Calculate reading time
- Categorize by word count
- Add priority levels based on sentiment
- Create custom scoring systems

## Advanced Configuration Examples

### Adding Custom Fields
```typescript
// In notion.ts database creation
"Priority": {
  select: {
    options: [
      { name: "High", color: "red" },
      { name: "Medium", color: "yellow" },
      { name: "Low", color: "green" }
    ]
  }
},
"Reading Time": {
  number: {
    format: "number"
  }
}
```

### Custom Data Processing
```typescript
// In routes.ts sync logic
const notionData = {
  title: updatedEntry.title,
  content: updatedEntry.transcribedText,
  // Custom processing
  priority: calculatePriority(updatedEntry),
  readingTime: Math.ceil(wordCount / 200), // words per minute
  // Filter sensitive content
  content: filterSensitiveContent(updatedEntry.transcribedText)
};
```

## Current Sync Trigger
Entries automatically sync to Notion when:
1. Image is uploaded
2. Text is extracted via OCR
3. AI analysis completes successfully
4. All data is processed and entry status is "completed"

## Privacy and Security
- Only processed entries sync (never raw images)
- Content is truncated to Notion's limits
- Failed entries don't sync
- All syncing happens server-side with your credentials

## Notion Database Management
The system automatically:
- Creates the database if it doesn't exist
- Adds new tag options as they're discovered
- Maintains consistent property structure
- Handles errors gracefully without breaking the main app

Your Notion integration provides enterprise-level control over data representation while maintaining seamless automation.