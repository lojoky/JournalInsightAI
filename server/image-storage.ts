import fs from 'fs';
import path from 'path';

export interface ImageData {
  data: string; // base64 encoded
  mimeType: string;
}

export function convertImageToBase64(filePath: string): ImageData {
  try {
    const imageBuffer = fs.readFileSync(filePath);
    const base64Data = imageBuffer.toString('base64');
    
    // Determine MIME type from file extension
    const ext = path.extname(filePath).toLowerCase();
    let mimeType = 'image/jpeg'; // default
    
    switch (ext) {
      case '.png':
        mimeType = 'image/png';
        break;
      case '.jpg':
      case '.jpeg':
        mimeType = 'image/jpeg';
        break;
      case '.gif':
        mimeType = 'image/gif';
        break;
      case '.webp':
        mimeType = 'image/webp';
        break;
      case '.heic':
        mimeType = 'image/heic';
        break;
    }
    
    return {
      data: base64Data,
      mimeType
    };
  } catch (error) {
    console.error('Error converting image to base64:', error);
    throw new Error('Failed to convert image to base64');
  }
}

export function convertBase64ToBuffer(base64Data: string): Buffer {
  return Buffer.from(base64Data, 'base64');
}

export function getDataUrlFromBase64(base64Data: string, mimeType: string): string {
  return `data:${mimeType};base64,${base64Data}`;
}

export function isImageSizeAcceptable(base64Data: string): boolean {
  // Check if base64 image is under 10MB (reasonable limit for database storage)
  const sizeInBytes = (base64Data.length * 3) / 4; // Approximate size after base64 decoding
  const maxSizeInBytes = 10 * 1024 * 1024; // 10MB
  return sizeInBytes <= maxSizeInBytes;
}