import Tesseract from 'tesseract.js';

export interface OCRResult {
  text: string;
  confidence: number;
}

export async function processImageWithOCR(
  imageFile: File,
  onProgress?: (progress: number) => void
): Promise<OCRResult> {
  return new Promise((resolve, reject) => {
    Tesseract.recognize(imageFile, 'eng', {
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
  });
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
