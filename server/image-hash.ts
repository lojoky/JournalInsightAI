import Jimp from 'jimp';
import crypto from 'crypto';

/**
 * Compute a perceptual hash (pHash) of an image for duplicate detection
 * This creates a hash that remains similar even with minor image variations
 */
export async function computeImageHash(imagePath: string): Promise<string> {
  try {
    // Load and process the image
    const image = await Jimp.read(imagePath);
    
    // Resize to 32x32 for consistent hashing
    image.resize(32, 32);
    
    // Convert to grayscale
    image.greyscale();
    
    // Get pixel data
    const pixels: number[] = [];
    for (let y = 0; y < 32; y++) {
      for (let x = 0; x < 32; x++) {
        const pixel = Jimp.intToRGBA(image.getPixelColor(x, y));
        pixels.push(pixel.r); // Use red channel (same as others due to grayscale)
      }
    }
    
    // Compute average pixel value
    const average = pixels.reduce((sum, pixel) => sum + pixel, 0) / pixels.length;
    
    // Create binary hash based on average
    let hash = '';
    for (const pixel of pixels) {
      hash += pixel >= average ? '1' : '0';
    }
    
    // Convert binary string to hexadecimal for storage efficiency
    const hexHash = BigInt('0b' + hash).toString(16).padStart(256, '0');
    
    return hexHash;
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
 * Hamming distance between two binary strings (for image hash comparison)
 * Lower distance means more similar images
 */
export function calculateHammingDistance(hash1: string, hash2: string): number {
  if (hash1.length !== hash2.length) {
    throw new Error('Hashes must be the same length');
  }
  
  let distance = 0;
  for (let i = 0; i < hash1.length; i++) {
    if (hash1[i] !== hash2[i]) {
      distance++;
    }
  }
  
  return distance;
}

/**
 * Check if two image hashes are similar (within threshold)
 * Threshold of 10-15 is typically good for detecting similar images
 */
export function areImageHashesSimilar(hash1: string, hash2: string, threshold: number = 12): boolean {
  try {
    // Convert hex hashes back to binary for comparison
    const binary1 = BigInt('0x' + hash1).toString(2).padStart(1024, '0');
    const binary2 = BigInt('0x' + hash2).toString(2).padStart(1024, '0');
    
    const distance = calculateHammingDistance(binary1, binary2);
    return distance <= threshold;
  } catch (error) {
    console.error('Error comparing image hashes:', error);
    return false;
  }
}