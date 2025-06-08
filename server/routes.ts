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
import { analyzeJournalEntry, analyzeSentiment } from "./openai";
import multer from "multer";
import path from "path";
import fs from "fs/promises";

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
    const allowedTypes = /jpeg|jpg|png|heic/;
    const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
    const mimetype = allowedTypes.test(file.mimetype);

    if (mimetype && extname) {
      return cb(null, true);
    } else {
      cb(new Error('Only image files (JPEG, JPG, PNG, HEIC) are allowed!'));
    }
  },
  limits: {
    fileSize: 10 * 1024 * 1024 // 10MB limit
  }
});

export async function registerRoutes(app: Express): Promise<Server> {
  // Create default user for demo purposes
  let defaultUser: any = null;
  try {
    defaultUser = await storage.getUserByUsername("demo");
    if (!defaultUser) {
      defaultUser = await storage.createUser({
        username: "demo",
        password: "demo"
      });
    }
  } catch (error) {
    console.error("Error creating default user:", error);
  }

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

  // Upload journal entry image
  app.post("/api/journal-entries/upload", upload.single('image'), async (req, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({ message: "No image file provided" });
      }

      if (!defaultUser) {
        return res.status(500).json({ message: "Default user not found" });
      }

      const { title = "Untitled Entry" } = req.body;
      
      // Create journal entry with pending status
      const entry = await storage.createJournalEntry({
        userId: defaultUser.id,
        title,
        originalImageUrl: `/uploads/${req.file.filename}`,
        processingStatus: "pending"
      });

      res.json({
        id: entry.id,
        message: "Image uploaded successfully",
        imageUrl: entry.originalImageUrl
      });
    } catch (error) {
      console.error("Upload error:", error);
      res.status(500).json({ message: "Failed to upload image" });
    }
  });

  // Process OCR transcription
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

      // Update entry status to completed
      await storage.updateJournalEntry(entryId, {
        processingStatus: "completed"
      });

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

  // Get journal entries
  app.get("/api/journal-entries", async (req, res) => {
    try {
      if (!defaultUser) {
        return res.status(500).json({ message: "Default user not found" });
      }

      const limit = parseInt(req.query.limit as string) || 10;
      const entries = await storage.getJournalEntriesByUser(defaultUser.id, limit);
      
      res.json(entries);
    } catch (error) {
      console.error("Get entries error:", error);
      res.status(500).json({ message: "Failed to fetch journal entries" });
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

  // Serve uploaded files
  const expressStatic = express.static;
  app.use('/uploads', expressStatic(path.join(process.cwd(), 'uploads')));

  const httpServer = createServer(app);
  return httpServer;
}
