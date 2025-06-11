import { format, parse, isValid } from 'date-fns';

export interface DetectedDate {
  date: Date;
  originalText: string;
  startIndex: number;
  endIndex: number;
}

export interface SplitEntry {
  date: Date;
  content: string;
  startIndex: number;
  endIndex: number;
}

/**
 * Comprehensive date patterns to match various formats commonly found in journals
 */
const DATE_PATTERNS = [
  // Full month names with day and year
  {
    regex: /(?:^|\n)\s*(?:January|February|March|April|May|June|July|August|September|October|November|December)\s+\d{1,2},?\s+\d{4}/gi,
    formats: ['MMMM d, yyyy', 'MMMM d yyyy']
  },
  // Abbreviated month names
  {
    regex: /(?:^|\n)\s*(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\.?\s+\d{1,2},?\s+\d{4}/gi,
    formats: ['MMM d, yyyy', 'MMM d yyyy', 'MMM. d, yyyy', 'MMM. d yyyy']
  },
  // Numeric formats
  {
    regex: /(?:^|\n)\s*\d{1,2}[-\/]\d{1,2}[-\/]\d{2,4}/g,
    formats: ['M/d/yyyy', 'M/d/yy', 'M-d-yyyy', 'M-d-yy', 'MM/dd/yyyy', 'MM/dd/yy', 'MM-dd-yyyy', 'MM-dd-yy']
  },
  // ISO format
  {
    regex: /(?:^|\n)\s*\d{4}-\d{2}-\d{2}/g,
    formats: ['yyyy-MM-dd']
  },
  // Day of week with date
  {
    regex: /(?:^|\n)\s*(?:Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday),?\s+(?:January|February|March|April|May|June|July|August|September|October|November|December)\s+\d{1,2},?\s+\d{4}/gi,
    formats: ['EEEE, MMMM d, yyyy', 'EEEE MMMM d, yyyy', 'EEEE, MMMM d yyyy', 'EEEE MMMM d yyyy']
  },
  // Abbreviated day with date
  {
    regex: /(?:^|\n)\s*(?:Mon|Tue|Wed|Thu|Fri|Sat|Sun)\.?,?\s+(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\.?\s+\d{1,2},?\s+\d{4}/gi,
    formats: ['EEE, MMM d, yyyy', 'EEE MMM d, yyyy', 'EEE, MMM d yyyy', 'EEE MMM d yyyy', 'EEE., MMM. d, yyyy', 'EEE. MMM. d, yyyy']
  },
  // Simple format like "5-11-23"
  {
    regex: /(?:^|\n)\s*\d{1,2}-\d{1,2}-\d{2}/g,
    formats: ['M-d-yy', 'MM-dd-yy']
  }
];

/**
 * Extract all potential dates from text using regex patterns
 */
function extractDateMatches(text: string): Array<{ match: string; index: number; endIndex: number }> {
  const matches: Array<{ match: string; index: number; endIndex: number }> = [];
  
  for (const pattern of DATE_PATTERNS) {
    let match;
    while ((match = pattern.regex.exec(text)) !== null) {
      const matchText = match[0].trim();
      matches.push({
        match: matchText,
        index: match.index,
        endIndex: match.index + match[0].length
      });
    }
    // Reset regex state for next iteration
    pattern.regex.lastIndex = 0;
  }
  
  // Sort by position in text
  return matches.sort((a, b) => a.index - b.index);
}

/**
 * Parse a date string using multiple format attempts
 */
function parseDate(dateStr: string): Date | null {
  const cleanDateStr = dateStr.trim();
  
  // Try all possible formats
  const allFormats = DATE_PATTERNS.flatMap(pattern => pattern.formats);
  
  for (const formatStr of allFormats) {
    try {
      const parsed = parse(cleanDateStr, formatStr, new Date());
      if (isValid(parsed)) {
        return parsed;
      }
    } catch (error) {
      // Continue to next format
    }
  }
  
  // Try JavaScript's built-in Date parser as fallback
  try {
    const parsed = new Date(cleanDateStr);
    if (isValid(parsed) && parsed.getFullYear() > 1900) {
      return parsed;
    }
  } catch (error) {
    // Ignore
  }
  
  return null;
}

/**
 * Detect all valid dates in the text and return them with their positions
 */
export function detectDates(text: string): DetectedDate[] {
  const matches = extractDateMatches(text);
  const detectedDates: DetectedDate[] = [];
  
  for (const match of matches) {
    const parsedDate = parseDate(match.match);
    if (parsedDate) {
      detectedDates.push({
        date: parsedDate,
        originalText: match.match,
        startIndex: match.index,
        endIndex: match.endIndex
      });
    }
  }
  
  // Remove duplicates that are very close to each other (within 10 characters)
  const uniqueDates: DetectedDate[] = [];
  for (const date of detectedDates) {
    const isDuplicate = uniqueDates.some(existing => 
      Math.abs(existing.startIndex - date.startIndex) < 10 &&
      Math.abs(existing.date.getTime() - date.date.getTime()) < 24 * 60 * 60 * 1000 // Same day
    );
    
    if (!isDuplicate) {
      uniqueDates.push(date);
    }
  }
  
  return uniqueDates;
}

/**
 * Split journal text into multiple entries based on detected dates
 */
export function splitEntriesByDate(text: string): SplitEntry[] {
  const detectedDates = detectDates(text);
  
  // If no dates or only one date found, return the entire text as one entry
  if (detectedDates.length <= 1) {
    const date = detectedDates.length === 1 ? detectedDates[0].date : new Date();
    return [{
      date,
      content: text.trim(),
      startIndex: 0,
      endIndex: text.length
    }];
  }
  
  const entries: SplitEntry[] = [];
  
  for (let i = 0; i < detectedDates.length; i++) {
    const currentDate = detectedDates[i];
    const nextDate = detectedDates[i + 1];
    
    // Determine the content range for this entry
    const startIndex = currentDate.startIndex;
    const endIndex = nextDate ? nextDate.startIndex : text.length;
    
    const content = text.substring(startIndex, endIndex).trim();
    
    // Only add if content is substantial (more than just the date)
    if (content.length > currentDate.originalText.length + 10) {
      entries.push({
        date: currentDate.date,
        content,
        startIndex,
        endIndex
      });
    }
  }
  
  return entries;
}

/**
 * Utility function to format date for logging/debugging
 */
export function formatDateForLog(date: Date): string {
  return format(date, 'yyyy-MM-dd');
}