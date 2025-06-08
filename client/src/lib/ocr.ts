import Tesseract from 'tesseract.js';
import heic2any from 'heic2any';

export interface OCRResult {
  text: string;
  confidence: number;
}

export async function processImageWithOCR(
  imageFile: File,
  onProgress?: (progress: number) => void
): Promise<OCRResult> {
  return new Promise(async (resolve, reject) => {
    try {
      // Convert HEIC to supported format if needed
      const processedFile = await convertImageForOCR(imageFile);
      
      Tesseract.recognize(processedFile, 'eng', {
        logger: (m) => {
          if (m.status === 'recognizing text' && onProgress) {
            onProgress(Math.round(m.progress * 100));
          }
        }
      })
      .then(({ data: { text, confidence } }) => {
        resolve({
          text: text.trim(),
          confidence: Math.round(confidence)
        });
      })
      .catch((error) => {
        console.error('OCR Error:', error);
        reject(new Error('Failed to process image with OCR'));
      });
    } catch (error) {
      console.error('Image conversion error:', error);
      reject(new Error('Failed to convert image for OCR'));
    }
  });
}

async function convertImageForOCR(file: File): Promise<File> {
  // If it's already a supported format, return as-is
  if (file.type === 'image/jpeg' || file.type === 'image/jpg' || file.type === 'image/png') {
    return file;
  }

  // Handle HEIC files specifically
  if (file.type === 'image/heic' || file.name.toLowerCase().endsWith('.heic')) {
    try {
      console.log('Converting HEIC to JPEG for OCR processing...');
      const convertedBlob = await heic2any({
        blob: file,
        toType: 'image/jpeg',
        quality: 0.9
      }) as Blob;
      
      const convertedFile = new File([convertedBlob], file.name.replace(/\.heic$/i, '.jpg'), {
        type: 'image/jpeg',
        lastModified: Date.now()
      });
      
      console.log('HEIC conversion successful');
      return convertedFile;
    } catch (error) {
      console.error('HEIC conversion failed:', error);
      throw new Error('Failed to convert HEIC image for OCR processing');
    }
  }

  // For other unsupported formats, return original and let OCR handle it
  return file;
}

export function preprocessImageForOCR(file: File): Promise<File> {
  return new Promise((resolve) => {
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    const img = new Image();
    
    img.onload = () => {
      // Set canvas dimensions
      canvas.width = img.width;
      canvas.height = img.height;
      
      if (ctx) {
        // Draw image
        ctx.drawImage(img, 0, 0);
        
        // Apply basic preprocessing (contrast enhancement)
        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        const data = imageData.data;
        
        // Simple contrast enhancement
        const factor = 1.2;
        for (let i = 0; i < data.length; i += 4) {
          data[i] = Math.min(255, data[i] * factor);     // Red
          data[i + 1] = Math.min(255, data[i + 1] * factor); // Green
          data[i + 2] = Math.min(255, data[i + 2] * factor); // Blue
        }
        
        ctx.putImageData(imageData, 0, 0);
        
        canvas.toBlob((blob) => {
          if (blob) {
            const processedFile = new File([blob], file.name, {
              type: 'image/png',
              lastModified: Date.now()
            });
            resolve(processedFile);
          } else {
            resolve(file); // Fallback to original file
          }
        }, 'image/png');
      } else {
        resolve(file); // Fallback to original file
      }
    };
    
    img.onerror = () => {
      resolve(file); // Fallback to original file
    };
    
    img.src = URL.createObjectURL(file);
  });
}
