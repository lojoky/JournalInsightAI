import type { Express } from "express";
import express from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { 
  insertJournalEntrySchema, 
  insertThemeSchema, 
  insertTagSchema,
  insertEntryTagSchema,
  insertSentimentAnalysisSchema
} from "@shared/schema";
import { analyzeJournalEntry, analyzeSentiment, extractTextFromImage } from "./openai";
import { retryFailedEntries } from "./retry-processing";
import { setupAuth, isAuthenticated } from "./replitAuth";

import multer from "multer";
import path from "path";
import fs from "fs/promises";
import { exec } from "child_process";
import { promisify } from "util";

const execAsync = promisify(exec);

// Configure multer for file uploads
const upload = multer({
  storage: multer.diskStorage({
    destination: async (req, file, cb) => {
      const uploadDir = path.join(process.cwd(), 'uploads');
      try {
        await fs.mkdir(uploadDir, { recursive: true });
        cb(null, uploadDir);
      } catch (error) {
        cb(error as Error, uploadDir);
      }
    },
    filename: (req, file, cb) => {
      const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
      cb(null, file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname));
    }
  }),
  fileFilter: (req, file, cb) => {
    console.log('File filter check:', {
      originalname: file.originalname,
      mimetype: file.mimetype,
      fieldname: file.fieldname
    });
    
    const allowedTypes = /jpeg|jpg|png|heic|webp/;
    const allowedMimes = /image\/(jpeg|jpg|png|heic|webp)/;
    const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
    const mimetype = allowedMimes.test(file.mimetype.toLowerCase());

    console.log('Validation results:', { extname, mimetype });

    if (mimetype || extname) {
      return cb(null, true);
    } else {
      console.log('File rejected:', file.originalname, file.mimetype);
      cb(new Error('Only image files (JPEG, JPG, PNG, HEIC, WEBP) are allowed!'));
    }
  },
  limits: {
    fileSize: 10 * 1024 * 1024 // 10MB limit
  }
});

export async function registerRoutes(app: Express): Promise<Server> {
  // Serve uploaded images statically for Notion cover images
  app.use('/uploads', express.static(path.join(process.cwd(), 'uploads')));

  // Initialize Firebase Admin if configured
  if (process.env.VITE_FIREBASE_PROJECT_ID) {
    const { initializeFirebaseAdmin, authenticateFirebase } = await import("./firebaseAuth");
    initializeFirebaseAdmin();
    app.use(authenticateFirebase);
  }

  // Initialize Notion if configured
  if (process.env.NOTION_INTEGRATION_SECRET && process.env.NOTION_PAGE_URL) {
    const { initializeNotion } = await import("./notion");
    const notionInitialized = initializeNotion(
      process.env.NOTION_INTEGRATION_SECRET,
      process.env.NOTION_PAGE_URL
    );
    if (notionInitialized) {
      console.log("Notion integration initialized successfully");
    } else {
      console.log("Failed to initialize Notion integration");
    }
  }

  // Setup authentication
  await setupAuth(app);

  // Authentication routes
  app.get('/api/auth/user', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const user = await storage.getUser(userId);
      res.json(user);
    } catch (error) {
      console.error("Error fetching user:", error);
      res.status(500).json({ message: "Failed to fetch user" });
    }
  });

  // Create default tags if they don't exist
  const defaultTags = [
    { name: "faith", category: "spiritual", color: "#6366F1" },
    { name: "career", category: "professional", color: "#8B5CF6" },
    { name: "relationships", category: "personal", color: "#10B981" },
    { name: "gratitude", category: "emotional", color: "#F59E0B" },
    { name: "reflection", category: "mental", color: "#6B7280" },
    { name: "personal-growth", category: "development", color: "#8B5CF6" },
    { name: "family", category: "personal", color: "#10B981" },
    { name: "decisions", category: "mental", color: "#F59E0B" },
    { name: "mindfulness", category: "spiritual", color: "#10B981" }
  ];

  for (const tagData of defaultTags) {
    try {
      await storage.getOrCreateTag(tagData.name, tagData.category);
    } catch (error) {
      console.error(`Error creating tag ${tagData.name}:`, error);
    }
  }

  // Get all journal entries for authenticated user
  app.get("/api/journal-entries", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const limit = parseInt(req.query.limit as string) || 10;
      const entries = await storage.getJournalEntriesByUser(userId, limit);
      res.json(entries);
    } catch (error) {
      console.error("Get journal entries error:", error);
      res.status(500).json({ message: "Failed to fetch journal entries" });
    }
  });

  // Upload journal entry image
  app.post("/api/journal-entries/upload", isAuthenticated, upload.single('image'), async (req: any, res) => {
    try {
      console.log("Upload request received:");
      console.log("- Files:", req.file);
      console.log("- Body:", req.body);
      console.log("- Content-Type:", req.headers['content-type']);
      
      if (!req.file) {
        console.log("No file found in request");
        return res.status(400).json({ message: "No image file provided" });
      }

      const authenticatedUserId = req.user.claims.sub;
      if (!authenticatedUserId) {
        return res.status(401).json({ message: "User not authenticated" });
      }

      const { title = "Untitled Entry" } = req.body;
      
      // Convert HEIC to JPEG if needed for better OCR compatibility
      let processedImagePath = req.file.path;
      let conversionWarning = null;
      
      if (req.file.mimetype === 'image/heic' || req.file.originalname.toLowerCase().endsWith('.heic')) {
        const convertedPath = req.file.path.replace(/\.heic$/i, '.jpg');
        
        // Try multiple conversion methods
        let conversionSuccess = false;
        
        // Method 1: heif-convert
        try {
          await execAsync(`heif-convert "${req.file.path}" "${convertedPath}"`);
          processedImagePath = convertedPath;
          conversionSuccess = true;
          console.log('HEIC converted to JPEG successfully using heif-convert');
        } catch (error) {
          console.log('heif-convert failed, trying ImageMagick...');
        }
        
        // Method 2: ImageMagick if heif-convert failed
        if (!conversionSuccess) {
          try {
            await execAsync(`convert "${req.file.path}" "${convertedPath}"`);
            processedImagePath = convertedPath;
            conversionSuccess = true;
            console.log('HEIC converted to JPEG successfully using ImageMagick');
          } catch (error) {
            console.log('ImageMagick conversion also failed');
          }
        }
        
        if (!conversionSuccess) {
          conversionWarning = "HEIC file could not be converted. For best results, please convert to JPEG or PNG before uploading.";
          console.error('All HEIC conversion methods failed');
        }
      }

      // Create journal entry with pending status
      const entry = await storage.createJournalEntry({
        userId: authenticatedUserId,
        title,
        originalImageUrl: `/uploads/${req.file.filename}`,
        processingStatus: "pending"
      });

      res.json({
        id: entry.id,
        message: "Image uploaded successfully",
        imageUrl: entry.originalImageUrl,
        processedImagePath: processedImagePath !== req.file.path ? processedImagePath.replace(process.cwd(), '') : undefined,
        warning: conversionWarning
      });
    } catch (error) {
      console.error("Upload error:", error);
      res.status(500).json({ message: "Failed to upload image" });
    }
  });

  // Extract text using OpenAI Vision (much better for handwriting)
  app.post("/api/journal-entries/:id/extract-text", async (req, res) => {
    try {
      const entryId = parseInt(req.params.id);
      const entry = await storage.getJournalEntry(entryId);
      
      if (!entry) {
        return res.status(404).json({ message: "Journal entry not found" });
      }

      // Get the image path - use converted image if available
      const imagePath = path.join(process.cwd(), entry.originalImageUrl!);
      const convertedPath = imagePath.replace(/\.heic$/i, '.jpg');
      
      let imageToProcess = imagePath;
      try {
        await fs.access(convertedPath);
        imageToProcess = convertedPath; // Use converted image if it exists
      } catch {
        // Use original if converted doesn't exist
      }

      // Extract text using OpenAI Vision
      const result = await extractTextFromImage(imageToProcess);

      // Update entry with transcription
      const updatedEntry = await storage.updateJournalEntry(entryId, {
        transcribedText: result.text,
        ocrConfidence: result.confidence,
        processingStatus: "transcribed"
      });

      res.json({
        transcribedText: result.text,
        confidence: result.confidence,
        entry: updatedEntry
      });
    } catch (error) {
      console.error("OpenAI text extraction error:", error);
      res.status(500).json({ message: "Failed to extract text from image" });
    }
  });

  // Process OCR transcription (legacy endpoint for Tesseract)
  app.post("/api/journal-entries/:id/transcribe", async (req, res) => {
    try {
      const entryId = parseInt(req.params.id);
      const { transcribedText, confidence } = req.body;

      if (!transcribedText) {
        return res.status(400).json({ message: "Transcribed text is required" });
      }

      // Update entry with transcription
      const updatedEntry = await storage.updateJournalEntry(entryId, {
        transcribedText,
        ocrConfidence: confidence,
        processingStatus: "processing"
      });

      res.json({
        id: updatedEntry.id,
        transcribedText: updatedEntry.transcribedText,
        confidence: updatedEntry.ocrConfidence
      });
    } catch (error) {
      console.error("Transcription error:", error);
      res.status(500).json({ message: "Failed to process transcription" });
    }
  });

  // Process AI analysis
  app.post("/api/journal-entries/:id/analyze", async (req, res) => {
    try {
      const entryId = parseInt(req.params.id);
      const entry = await storage.getJournalEntry(entryId);

      if (!entry || !entry.transcribedText) {
        return res.status(400).json({ message: "Entry not found or not transcribed" });
      }

      // Perform AI analysis
      const analysis = await analyzeJournalEntry(entry.transcribedText);
      const sentiment = await analyzeSentiment(entry.transcribedText);

      // Save themes
      const themes = await Promise.all(
        analysis.themes.map(theme => 
          storage.createTheme({
            entryId,
            title: theme.title,
            description: theme.description,
            confidence: theme.confidence
          })
        )
      );

      // Save sentiment analysis
      const sentimentData = await storage.createSentimentAnalysis({
        entryId,
        positiveScore: sentiment.positive,
        neutralScore: sentiment.neutral,
        concernScore: sentiment.concern,
        overallSentiment: sentiment.overall
      });

      // Process and save tags
      const tagPromises = analysis.tags.map(async (tagName) => {
        const tag = await storage.getOrCreateTag(tagName.toLowerCase());
        await storage.addTagToEntry({
          entryId,
          tagId: tag.id,
          confidence: 85, // Default confidence for AI-generated tags
          isAutoGenerated: true
        });
        return tag;
      });

      const savedTags = await Promise.all(tagPromises);

      // Update entry status to completed and set the AI-generated title
      await storage.updateJournalEntry(entryId, {
        title: analysis.title,
        processingStatus: "completed"
      });

      // Sync to Notion if configured
      try {
        const { syncJournalToNotion, isNotionConfigured } = await import("./notion");
        if (isNotionConfigured() && process.env.NOTION_INTEGRATION_SECRET && process.env.NOTION_PAGE_URL) {
          const updatedEntry = await storage.getJournalEntry(entryId);
          if (updatedEntry && updatedEntry.transcribedText) {
            const tagNames = updatedEntry.tags?.map(tag => tag.name) || [];
            
            // Create a publicly accessible image URL
            const baseUrl = process.env.REPL_URL || `https://${process.env.REPL_SLUG}.${process.env.REPL_OWNER}.repl.co` || `http://localhost:5000`;
            const publicImageUrl = `${baseUrl}${updatedEntry.originalImageUrl}`;
            
            // Create summary from AI analysis - ensure it's always a string
            const summary: string = analysis.themes.length > 0 && analysis.themes[0].description
              ? analysis.themes[0].description 
              : `Journal entry with ${analysis.themes.length} themes identified. Sentiment: ${updatedEntry.sentimentAnalysis?.overallSentiment || 'Unknown'}`;
            
            const notionData = {
              title: updatedEntry.title,
              content: updatedEntry.transcribedText,
              summary,
              imageUrl: publicImageUrl,
              tags: tagNames,
              sentiment: updatedEntry.sentimentAnalysis?.overallSentiment,
              date: new Date(updatedEntry.createdAt).toISOString().split('T')[0]
            };
            
            await syncJournalToNotion(
              process.env.NOTION_INTEGRATION_SECRET,
              process.env.NOTION_PAGE_URL,
              notionData
            );
            console.log(`Journal entry ${entryId} synced to Notion successfully`);
          }
        }
      } catch (notionError) {
        console.error("Failed to sync to Notion:", notionError);
        // Don't fail the main request if Notion sync fails
      }

      res.json({
        themes,
        sentiment: sentimentData,
        tags: savedTags,
        reflectionQuestions: analysis.reflectionQuestions
      });
    } catch (error) {
      console.error("Analysis error:", error);
      
      // Update entry status to failed
      try {
        await storage.updateJournalEntry(parseInt(req.params.id), {
          processingStatus: "failed"
        });
      } catch (updateError) {
        console.error("Failed to update entry status:", updateError);
      }
      
      res.status(500).json({ message: "Failed to analyze journal entry" });
    }
  });



  // Get specific journal entry
  app.get("/api/journal-entries/:id", async (req, res) => {
    try {
      const entryId = parseInt(req.params.id);
      const entry = await storage.getJournalEntry(entryId);

      if (!entry) {
        return res.status(404).json({ message: "Journal entry not found" });
      }

      res.json(entry);
    } catch (error) {
      console.error("Get entry error:", error);
      res.status(500).json({ message: "Failed to fetch journal entry" });
    }
  });

  // Update transcription for journal entry
  app.patch("/api/journal-entries/:id/transcription", isAuthenticated, async (req, res) => {
    try {
      const entryId = parseInt(req.params.id);
      const { transcribedText } = req.body;
      const userId = (req as any).user?.id || (req as any).user?.claims?.sub;

      if (!transcribedText || typeof transcribedText !== 'string') {
        return res.status(400).json({ message: "Valid transcribed text is required" });
      }

      // Verify the entry belongs to the user
      const entry = await storage.getJournalEntry(entryId);
      if (!entry || entry.userId !== userId) {
        return res.status(404).json({ message: "Entry not found or access denied" });
      }

      const updatedEntry = await storage.updateJournalEntry(entryId, {
        transcribedText
      });

      res.json(updatedEntry);
    } catch (error) {
      console.error("Update transcription error:", error);
      res.status(500).json({ message: "Failed to update transcription" });
    }
  });

  // Delete journal entry
  app.delete("/api/journal-entries/:id", isAuthenticated, async (req, res) => {
    try {
      const entryId = parseInt(req.params.id);
      const userId = (req as any).user?.id || (req as any).user?.claims?.sub;

      // Verify the entry belongs to the user
      const entry = await storage.getJournalEntry(entryId);
      if (!entry || entry.userId !== userId) {
        return res.status(404).json({ message: "Entry not found or access denied" });
      }

      // Delete the entry
      await storage.deleteJournalEntry(entryId);

      res.json({ message: "Entry deleted successfully" });
    } catch (error) {
      console.error("Delete entry error:", error);
      res.status(500).json({ message: "Failed to delete entry" });
    }
  });

  // Add custom tag to entry
  app.post("/api/journal-entries/:id/tags", async (req, res) => {
    try {
      const entryId = parseInt(req.params.id);
      const { tagName, category } = req.body;

      if (!tagName) {
        return res.status(400).json({ message: "Tag name is required" });
      }

      const tag = await storage.getOrCreateTag(tagName.toLowerCase(), category, true);
      
      // Check if tag is already associated with entry
      const existingTags = await storage.getTagsByEntry(entryId);
      const tagExists = existingTags.some(t => t.id === tag.id);

      if (!tagExists) {
        await storage.addTagToEntry({
          entryId,
          tagId: tag.id,
          confidence: 100, // Manual tags have 100% confidence
          isAutoGenerated: false
        });
      }

      res.json(tag);
    } catch (error) {
      console.error("Add tag error:", error);
      res.status(500).json({ message: "Failed to add tag" });
    }
  });

  // Get all available tags
  app.get("/api/tags", async (req, res) => {
    try {
      const allTags = await storage.getAllTags();
      res.json(allTags);
    } catch (error) {
      console.error("Get tags error:", error);
      res.status(500).json({ message: "Failed to fetch tags" });
    }
  });

  // Update user Notion settings
  app.post("/api/user/notion-settings", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const { notionIntegrationSecret, notionPageUrl } = req.body;
      
      // Update user with Notion credentials
      await storage.upsertUser({
        id: userId,
        notionIntegrationSecret,
        notionPageUrl,
      });
      
      res.json({ message: "Notion settings updated successfully" });
    } catch (error) {
      console.error("Update Notion settings error:", error);
      res.status(500).json({ message: "Failed to update Notion settings" });
    }
  });

  // Retry failed entries
  app.post("/api/retry-failed-entries", isAuthenticated, async (req, res) => {
    try {
      console.log("Starting retry process for failed entries...");
      const result = await retryFailedEntries();
      
      res.json({
        message: "Retry process completed",
        ...result
      });
    } catch (error) {
      console.error("Retry failed entries error:", error);
      res.status(500).json({ message: "Failed to retry entries" });
    }
  });

  // Get failed entries count
  app.get("/api/failed-entries-count", async (req, res) => {
    try {
      const failedEntries = await storage.getFailedEntries();
      res.json({ count: failedEntries.length });
    } catch (error) {
      console.error("Get failed entries count error:", error);
      res.status(500).json({ message: "Failed to get failed entries count" });
    }
  });

  // Serve uploaded files
  const expressStatic = express.static;
  app.use('/uploads', expressStatic(path.join(process.cwd(), 'uploads')));

  const httpServer = createServer(app);
  return httpServer;
}
