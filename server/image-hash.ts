import crypto from 'crypto';
import fs from 'fs';

/**
 * Compute a content-based hash of an image file for duplicate detection
 * Uses SHA256 hash of the raw file content for reliable duplicate detection
 */
export async function computeImageHash(imagePath: string): Promise<string> {
  try {
    // Read the image file as buffer
    const imageBuffer = await fs.promises.readFile(imagePath);
    
    // Create SHA256 hash of the file content
    const hash = crypto.createHash('sha256').update(imageBuffer).digest('hex');
    
    return hash;
  } catch (error) {
    console.error('Error computing image hash:', error);
    throw new Error('Failed to compute image hash');
  }
}

/**
 * Compute SHA256 hash of transcribed text for duplicate detection
 */
export function computeTranscriptHash(text: string): string {
  // Normalize text by removing extra whitespace and converting to lowercase
  const normalizedText = text.trim().toLowerCase().replace(/\s+/g, ' ');
  
  return crypto.createHash('sha256').update(normalizedText, 'utf8').digest('hex');
}

/**
 * Check if an image hash already exists in the database
 */
export async function checkImageHashExists(imageHash: string, storage: any): Promise<boolean> {
  try {
    const existing = await storage.getJournalEntryByImageHash(imageHash);
    return !!existing;
  } catch (error) {
    console.error('Error checking image hash:', error);
    return false;
  }
}

/**
 * Check if a transcript hash already exists in the database
 */
export async function checkTranscriptHashExists(transcriptHash: string, storage: any): Promise<boolean> {
  try {
    const existing = await storage.getJournalEntryByTranscriptHash(transcriptHash);
    return !!existing;
  } catch (error) {
    console.error('Error checking transcript hash:', error);
    return false;
  }
}

/**
 * Check if two image hashes are identical (exact match for SHA256 hashes)
 */
export function areImageHashesIdentical(hash1: string, hash2: string): boolean {
  return hash1 === hash2;
}