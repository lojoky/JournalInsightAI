import type { Express, Request, Response, NextFunction } from "express";
import express from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { authenticateUser, createUser, validateUsername, validatePassword } from "./auth";
import type { AuthenticatedRequest } from "./types";
import { 
  createNotionClient, 
  extractPageIdFromUrl, 
  createJournalDatabase, 
  addJournalEntryToNotion,
  getNotionDatabases 
} from "./notion";
import { syncJournalEntryToNotion, syncAllUserEntriesToNotion } from "./notion-sync";
// Google Docs integration removed - will be rebuilt
import { 
  insertJournalEntrySchema, 
  insertThemeSchema, 
  insertTagSchema,
  insertEntryTagSchema,
  insertSentimentAnalysisSchema
} from "@shared/schema";
import { analyzeJournalEntry, analyzeSentiment, extractTextFromImage } from "./openai";
import { retryFailedEntries } from "./retry-processing";
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

// Authentication middleware
function requireAuth(req: Request, res: Response, next: NextFunction) {
  console.log("Auth check:", {
    hasSession: !!req.session,
    userId: req.session?.userId,
    sessionId: req.session?.id,
    path: req.path
  });
  
  if (!req.session?.userId) {
    console.log("Authentication failed - no session or userId");
    return res.status(401).json({ 
      message: "Authentication required",
      hasSession: !!req.session,
      sessionExists: req.session?.id ? true : false
    });
  }
  next();
}

export async function registerRoutes(app: Express): Promise<Server> {
  // Authentication routes
  app.post("/api/auth/login", async (req, res) => {
    try {
      const { username, password } = req.body;
      
      if (!username || !password) {
        return res.status(400).json({ message: "Username and password required" });
      }
      
      const result = await authenticateUser(username, password);
      
      if (result.success && result.user) {
        req.session.userId = result.user.id;
        req.session.user = result.user;
        
        res.json({
          success: true,
          user: {
            id: result.user.id,
            username: result.user.username,
            createdAt: result.user.createdAt
          }
        });
      } else {
        res.status(401).json({ success: false, message: result.error });
      }
    } catch (error) {
      console.error("Login error:", error);
      res.status(500).json({ message: "Login failed" });
    }
  });

  app.post("/api/auth/signup", async (req, res) => {
    try {
      const { username, password } = req.body;
      
      if (!username || !password) {
        return res.status(400).json({ message: "Username and password required" });
      }
      
      // Validate input
      const usernameValidation = validateUsername(username);
      if (!usernameValidation.valid) {
        return res.status(400).json({ message: usernameValidation.error });
      }
      
      const passwordValidation = validatePassword(password);
      if (!passwordValidation.valid) {
        return res.status(400).json({ message: passwordValidation.error });
      }
      
      const result = await createUser(username, password);
      
      if (result.success && result.user) {
        req.session.userId = result.user.id;
        req.session.user = result.user;
        
        res.json({
          success: true,
          user: {
            id: result.user.id,
            username: result.user.username,
            createdAt: result.user.createdAt
          }
        });
      } else {
        res.status(400).json({ success: false, message: result.error });
      }
    } catch (error) {
      console.error("Signup error:", error);
      res.status(500).json({ message: "Signup failed" });
    }
  });

  app.post("/api/auth/logout", (req, res) => {
    req.session.destroy((err) => {
      if (err) {
        console.error("Logout error:", err);
        return res.status(500).json({ message: "Logout failed" });
      }
      res.clearCookie('connect.sid');
      res.json({ success: true });
    });
  });

  app.get("/api/auth/me", (req, res) => {
    if (req.session?.userId && req.session?.user) {
      res.json({
        user: {
          id: req.session.user.id,
          username: req.session.user.username,
          createdAt: req.session.user.createdAt
        }
      });
    } else {
      res.status(401).json({ message: "Not authenticated" });
    }
  });
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

  // Upload journal entry image - protected route
  app.post("/api/journal-entries/upload", requireAuth, upload.single('image'), async (req, res) => {
    try {
      console.log("Upload request received:");
      console.log("- Files:", req.file);
      console.log("- Body:", req.body);
      console.log("- Content-Type:", req.headers['content-type']);
      
      if (!req.file) {
        console.log("No file found in request");
        return res.status(400).json({ message: "No image file provided" });
      }

      if (!defaultUser) {
        return res.status(500).json({ message: "Default user not found" });
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
        userId: req.session.userId!,
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
  app.post("/api/journal-entries/:id/extract-text", requireAuth, async (req, res) => {
    try {
      const entryId = parseInt(req.params.id);
      const entry = await storage.getJournalEntry(entryId);
      
      if (!entry) {
        return res.status(404).json({ message: "Journal entry not found" });
      }

      // Check if user owns this entry
      if (entry.userId !== req.session.userId) {
        return res.status(403).json({ message: "Access denied" });
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
  app.post("/api/journal-entries/:id/transcribe", requireAuth, async (req, res) => {
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
  app.post("/api/journal-entries/:id/analyze", requireAuth, async (req, res) => {
    try {
      const entryId = parseInt(req.params.id);
      const entry = await storage.getJournalEntry(entryId);

      if (!entry || !entry.transcribedText) {
        return res.status(400).json({ message: "Entry not found or not transcribed" });
      }

      // Check if user owns this entry
      if (entry.userId !== req.session.userId) {
        return res.status(403).json({ message: "Access denied" });
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

      // Sync to integrations if enabled
      try {
        const completeEntry = await storage.getJournalEntry(entryId);
        if (completeEntry) {
          // Sync to Notion
          try {
            await syncJournalEntryToNotion(completeEntry);
          } catch (notionError) {
            console.error("Notion sync failed:", notionError);
          }
          
          // Sync to Google Docs
          try {
            await syncJournalEntryToGoogleDocs(completeEntry);
          } catch (googleDocsError) {
            console.error("Google Docs sync failed:", googleDocsError);
          }
        }
      } catch (syncError) {
        console.error("Integration sync failed:", syncError);
        // Don't fail the main request if sync fails
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

  // Get journal entries - protected route
  app.get("/api/journal-entries", requireAuth, async (req, res) => {
    try {
      const limit = parseInt(req.query.limit as string) || 10;
      console.log(`Fetching journal entries for user ${req.session.userId} with limit ${limit}`);
      
      const entries = await storage.getJournalEntriesByUser(req.session.userId!, limit);
      console.log(`Found ${entries.length} entries for user ${req.session.userId}`);
      
      res.json(entries);
    } catch (error) {
      console.error("Get entries error:", error);
      res.status(500).json({ message: "Failed to fetch journal entries" });
    }
  });

  // Get specific journal entry - protected route
  app.get("/api/journal-entries/:id", requireAuth, async (req, res) => {
    try {
      const entryId = parseInt(req.params.id);
      const entry = await storage.getJournalEntry(entryId);

      if (!entry) {
        return res.status(404).json({ message: "Journal entry not found" });
      }

      // Check if user owns this entry
      if (entry.userId !== req.session.userId) {
        return res.status(403).json({ message: "Access denied" });
      }

      res.json(entry);
    } catch (error) {
      console.error("Get entry error:", error);
      res.status(500).json({ message: "Failed to fetch journal entry" });
    }
  });

  // Update journal entry - protected route
  app.patch("/api/journal-entries/:id", requireAuth, async (req, res) => {
    try {
      const entryId = parseInt(req.params.id);
      const { transcribedText } = req.body;
      
      if (!transcribedText || typeof transcribedText !== 'string') {
        return res.status(400).json({ message: "Transcribed text is required" });
      }
      
      // Check if entry exists and belongs to current user
      const existingEntry = await storage.getJournalEntry(entryId);
      if (!existingEntry) {
        return res.status(404).json({ message: "Entry not found" });
      }
      
      if (existingEntry.userId !== req.session.userId) {
        return res.status(403).json({ message: "Access denied" });
      }
      
      // Update the entry
      const updatedEntry = await storage.updateJournalEntry(entryId, {
        transcribedText: transcribedText.trim()
      });
      
      res.json({
        message: "Entry updated successfully",
        entry: updatedEntry
      });
    } catch (error) {
      console.error("Update journal entry error:", error);
      res.status(500).json({ message: "Failed to update journal entry" });
    }
  });

  // Delete journal entry - protected route
  app.delete("/api/journal-entries/:id", requireAuth, async (req, res) => {
    try {
      const entryId = parseInt(req.params.id);
      
      // Check if entry exists and belongs to current user
      const existingEntry = await storage.getJournalEntry(entryId);
      if (!existingEntry) {
        return res.status(404).json({ message: "Entry not found" });
      }
      
      if (existingEntry.userId !== req.session.userId) {
        return res.status(403).json({ message: "Access denied" });
      }
      
      // Delete the entry (this will cascade delete related data due to foreign key constraints)
      await storage.deleteJournalEntry(entryId);
      
      res.json({
        message: "Entry deleted successfully"
      });
    } catch (error) {
      console.error("Delete journal entry error:", error);
      res.status(500).json({ message: "Failed to delete journal entry" });
    }
  });

  // Add custom tag to entry - protected route
  app.post("/api/journal-entries/:id/tags", requireAuth, async (req, res) => {
    try {
      const entryId = parseInt(req.params.id);
      const { tagName, category } = req.body;

      if (!tagName) {
        return res.status(400).json({ message: "Tag name is required" });
      }

      // Verify user owns the entry
      const entry = await storage.getJournalEntry(entryId);
      if (!entry || entry.userId !== req.session.userId) {
        return res.status(403).json({ message: "Access denied" });
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

  // Notion Integration Routes
  
  // Get user's Notion integration configuration
  app.get("/api/integrations/notion", requireAuth, async (req, res) => {
    try {
      const integration = await storage.getUserIntegration(req.session.userId!, "notion");
      
      if (!integration) {
        return res.json({ 
          enabled: false, 
          configured: false 
        });
      }

      res.json({
        enabled: integration.isEnabled,
        configured: !!integration.config,
        config: integration.config ? {
          hasToken: !!(integration.config as any).integrationToken,
          hasPageUrl: !!(integration.config as any).pageUrl,
          databaseName: (integration.config as any).databaseName || "Journal Entries"
        } : null
      });
    } catch (error) {
      console.error("Get Notion integration error:", error);
      res.status(500).json({ message: "Failed to fetch Notion integration" });
    }
  });

  // Configure user's Notion integration
  app.post("/api/integrations/notion/configure", requireAuth, async (req, res) => {
    try {
      const { integrationToken, pageUrl, databaseName }: {
        integrationToken: string;
        pageUrl: string;
        databaseName?: string;
      } = req.body;

      if (!integrationToken || !pageUrl) {
        return res.status(400).json({ 
          message: "Integration token and page URL are required" 
        });
      }

      // Test the Notion connection
      try {
        const notion = createNotionClient(integrationToken);
        const pageId = extractPageIdFromUrl(pageUrl);
        
        // Try to list databases to verify access
        await getNotionDatabases(notion, pageId);
        
        const config = {
          integrationToken,
          pageUrl,
          pageId,
          databaseName: databaseName || "Journal Entries"
        };

        // Check if integration exists
        const existingIntegration = await storage.getUserIntegration(req.session.userId!, "notion");
        
        if (existingIntegration) {
          await storage.updateUserIntegration(req.session.userId!, "notion", {
            config,
            isEnabled: true
          });
        } else {
          await storage.createUserIntegration({
            userId: req.session.userId!,
            integrationType: "notion",
            isEnabled: true,
            config
          });
        }

        res.json({ 
          success: true, 
          message: "Notion integration configured successfully" 
        });
      } catch (notionError) {
        console.error("Notion connection error:", notionError);
        res.status(400).json({ 
          message: "Failed to connect to Notion. Please check your integration token and page URL." 
        });
      }
    } catch (error) {
      console.error("Configure Notion integration error:", error);
      res.status(500).json({ message: "Failed to configure Notion integration" });
    }
  });

  // Toggle Notion integration on/off
  app.post("/api/integrations/notion/toggle", requireAuth, async (req, res) => {
    try {
      const { enabled } = req.body;
      
      const integration = await storage.getUserIntegration(req.session.userId!, "notion");
      if (!integration) {
        return res.status(404).json({ message: "Notion integration not configured" });
      }

      await storage.updateUserIntegration(req.session.userId!, "notion", {
        isEnabled: enabled
      });

      res.json({ 
        success: true, 
        enabled,
        message: `Notion integration ${enabled ? 'enabled' : 'disabled'}` 
      });
    } catch (error) {
      console.error("Toggle Notion integration error:", error);
      res.status(500).json({ message: "Failed to toggle Notion integration" });
    }
  });

  // Test Notion connection
  app.post("/api/integrations/notion/test", requireAuth, async (req, res) => {
    try {
      const integration = await storage.getUserIntegration(req.session.userId!, "notion");
      
      if (!integration || !integration.config) {
        return res.status(404).json({ message: "Notion integration not configured" });
      }

      const config = integration.config as { integrationToken: string; pageId: string };
      const notion = createNotionClient(config.integrationToken);
      const databases = await getNotionDatabases(notion, config.pageId);
      
      res.json({ 
        success: true, 
        message: "Connection successful",
        databaseCount: databases.length
      });
    } catch (error) {
      console.error("Test Notion connection error:", error);
      res.status(400).json({ 
        message: "Connection failed. Please check your configuration." 
      });
    }
  });

  // Bulk sync all entries to Notion
  app.post("/api/integrations/notion/sync-all", requireAuth, async (req, res) => {
    try {
      const integration = await storage.getUserIntegration(req.session.userId!, "notion");
      
      if (!integration || !integration.isEnabled) {
        return res.status(400).json({ message: "Notion integration not enabled" });
      }

      const result = await syncAllUserEntriesToNotion(req.session.userId!);
      
      res.json({ 
        message: `Sync completed: ${result.success} successful, ${result.failed} failed`,
        successCount: result.success,
        failedCount: result.failed
      });
    } catch (error) {
      console.error("Bulk sync error:", error);
      res.status(500).json({ 
        message: "Bulk sync failed. Please try again." 
      });
    }
  });

  // Google Docs integration routes
  app.get("/api/integrations/google-docs", requireAuth, async (req, res) => {
    try {
      const integration = await storage.getUserIntegration(req.session.userId!, "google_docs");
      
      if (!integration) {
        return res.json({ enabled: false, configured: false });
      }

      // Get the user's Google Doc URL if they have any entries synced
      let documentUrl = null;
      if (integration.isEnabled) {
        const googleDocs = await storage.getGoogleDocsByUser(req.session.userId!);
        if (googleDocs.length > 0) {
          documentUrl = googleDocs[0].documentUrl;
        }
      }

      res.json({
        enabled: integration.isEnabled,
        configured: !!integration.config,
        config: integration.config,
        documentUrl
      });
    } catch (error) {
      console.error("Get Google Docs integration error:", error);
      res.status(500).json({ message: "Failed to get Google Docs integration status" });
    }
  });

  // Authentication test endpoint (public for debugging)
  app.get("/api/auth-test", async (req, res) => {
    try {
      const authTest = {
        hasSession: !!req.session,
        sessionId: req.session?.id,
        userId: req.session?.userId,
        isAuthenticated: !!req.session?.userId,
        timestamp: new Date().toISOString(),
        environment: process.env.NODE_ENV,
        domain: req.get('host')
      };
      
      console.log("Auth test results:", authTest);
      res.json(authTest);
    } catch (error) {
      console.error("Auth test error:", error);
      res.status(500).json({ message: "Auth test failed" });
    }
  });

  // Google OAuth diagnostics endpoint (public for debugging)
  app.get("/api/google-oauth-diagnostics", async (req, res) => {
    try {
      console.log("Diagnostics endpoint hit");
      res.setHeader('Content-Type', 'application/json');
      
      const diagnostics = {
        hasClientId: !!process.env.GOOGLE_CLIENT_ID,
        hasClientSecret: !!process.env.GOOGLE_CLIENT_SECRET,
        currentDomain: req.get('host'),
        expectedRedirectUri: `https://journal-ai-insights.replit.app/api/auth/google/callback`,
        replitDomains: process.env.REPLIT_DOMAINS || null,
        timestamp: new Date().toISOString(),
      };
      
      console.log("Google OAuth diagnostics:", diagnostics);
      res.json(diagnostics);
    } catch (error) {
      console.error("Google diagnostics error:", error);
      res.status(500).json({ message: "Failed to get diagnostics" });
    }
  });

  // Test token exchange endpoint (for debugging)
  app.post("/api/integrations/google-docs/test-token-exchange", requireAuth, async (req, res) => {
    try {
      const { authCode } = req.body;
      
      if (!authCode) {
        return res.status(400).json({ message: "Authorization code is required" });
      }
      
      console.log("Testing token exchange with code:", authCode.substring(0, 20) + "...");
      
      const tokens = await exchangeCodeForTokens(
        process.env.GOOGLE_CLIENT_ID!,
        process.env.GOOGLE_CLIENT_SECRET!,
        authCode
      );
      
      res.json({
        success: true,
        hasAccessToken: !!tokens.access_token,
        hasRefreshToken: !!tokens.refresh_token,
        tokenType: tokens.token_type,
        scope: tokens.scope
      });
    } catch (error: any) {
      console.error("Test token exchange failed:", error);
      res.status(500).json({ 
        success: false,
        error: error?.message || 'Unknown error',
        details: error?.response?.data
      });
    }
  });

  app.post("/api/integrations/google-docs/auth-url", requireAuth, async (req, res) => {
    try {
      console.log("Generating Google OAuth URL...");
      console.log("Current host:", req.get('host'));
      console.log("Protocol:", req.protocol);
      console.log("REPLIT_DOMAINS:", process.env.REPLIT_DOMAINS);
      
      if (!process.env.GOOGLE_CLIENT_ID || !process.env.GOOGLE_CLIENT_SECRET) {
        console.error("Missing Google OAuth credentials");
        return res.status(500).json({ message: "Google OAuth credentials not configured. Please add GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET to your environment variables." });
      }

      const authUrl = await getAuthUrl(process.env.GOOGLE_CLIENT_ID, process.env.GOOGLE_CLIENT_SECRET);
      console.log("Successfully generated Google auth URL");
      
      res.json({ authUrl });
    } catch (error) {
      console.error("Generate Google auth URL error:", error);
      res.status(500).json({ message: "Failed to generate authorization URL" });
    }
  });

  // Google OAuth callback route
  app.get("/api/auth/google/callback", async (req, res) => {
    try {
      console.log("Google OAuth callback received");
      const { code, error, error_description } = req.query;
      
      if (error) {
        console.error("Google OAuth error:", error, error_description);
        return res.status(400).send(`
          <html>
            <head><title>Google Authorization Error</title></head>
            <body>
              <h1>Authorization Failed</h1>
              <p>Error: ${error}</p>
              <p>Description: ${error_description || 'Unknown error'}</p>
              <p>Please close this window and try again.</p>
            </body>
          </html>
        `);
      }
      
      if (!code) {
        console.error("Missing authorization code in callback");
        return res.status(400).send(`
          <html>
            <head><title>Google Authorization Error</title></head>
            <body>
              <h1>Authorization Failed</h1>
              <p>Missing authorization code. Please try the authentication process again.</p>
            </body>
          </html>
        `);
      }

      console.log("Storing Google auth code in session");
      // Store the code in a temporary session for the configuration step
      if (req.session) {
        req.session.googleAuthCode = code as string;
      }

      // Redirect back to the app with success indication
      res.send(`
        <html>
          <head><title>Google Authorization Complete</title></head>
          <body>
            <h1>Authorization Successful!</h1>
            <p>You can close this window and return to the application to complete the setup.</p>
            <script>
              // Post message to parent window if opened in popup
              if (window.opener) {
                window.opener.postMessage({ type: 'GOOGLE_AUTH_SUCCESS', code: '${code}' }, '*');
                window.close();
              }
            </script>
          </body>
        </html>
      `);
    } catch (error) {
      console.error("Google OAuth callback error:", error);
      res.status(500).send("Authorization failed");
    }
  });

  // Temporary bypass for debugging in production
  app.post("/api/integrations/google-docs/configure-debug", async (req, res) => {
    try {
      console.log("=== DEBUG GOOGLE DOCS CONFIGURATION ===");
      console.log("Environment:", process.env.NODE_ENV);
      console.log("Request body:", req.body);
      console.log("Headers:", req.headers);
      
      const { authCode, folderName, userId } = req.body;
      
      if (!authCode) {
        return res.status(400).json({ message: "Authorization code is required" });
      }
      
      if (!userId) {
        return res.status(400).json({ message: "User ID is required for debug mode" });
      }

      console.log("Testing token exchange...");
      const tokens = await exchangeCodeForTokens(
        process.env.GOOGLE_CLIENT_ID!,
        process.env.GOOGLE_CLIENT_SECRET!,
        authCode
      );

      console.log("Token exchange successful:", {
        hasAccessToken: !!tokens.access_token,
        hasRefreshToken: !!tokens.refresh_token
      });

      res.json({
        success: true,
        message: "Debug configuration successful",
        tokens: {
          hasAccessToken: !!tokens.access_token,
          hasRefreshToken: !!tokens.refresh_token
        }
      });
    } catch (error: any) {
      console.error("Debug configuration failed:", error);
      res.status(500).json({
        success: false,
        message: error.message,
        error: error.name
      });
    }
  });

  app.post("/api/integrations/google-docs/configure", requireAuth, async (req, res) => {
    try {
      console.log("=== GOOGLE DOCS CONFIGURATION ATTEMPT ===");
      console.log("User ID:", req.session.userId);
      console.log("Session data:", { 
        hasSession: !!req.session,
        sessionId: req.session?.id,
        userId: req.session?.userId 
      });
      console.log("Request headers:", {
        contentType: req.get('Content-Type'),
        userAgent: req.get('User-Agent'),
        origin: req.get('Origin')
      });
      console.log("Timestamp:", new Date().toISOString());
      
      const { authCode, folderName } = req.body;
      console.log("Request body raw:", req.body);
      console.log("Request data:", { 
        hasAuthCode: !!authCode, 
        authCodeLength: authCode?.length || 0,
        authCodePreview: authCode ? authCode.substring(0, 20) + "..." : "none",
        folderName: folderName || "default" 
      });

      // Validate environment variables
      const hasClientId = !!process.env.GOOGLE_CLIENT_ID;
      const hasClientSecret = !!process.env.GOOGLE_CLIENT_SECRET;
      console.log("Environment check:", { hasClientId, hasClientSecret });

      if (!authCode) {
        console.error("ERROR: Missing authorization code");
        return res.status(400).json({ message: "Authorization code is required" });
      }

      if (!hasClientId || !hasClientSecret) {
        console.error("ERROR: Missing Google OAuth credentials in environment");
        return res.status(500).json({ message: "Google OAuth credentials not configured on server" });
      }

      console.log("Starting token exchange...");
      console.log("Auth code preview:", authCode.substring(0, 20) + "...");
      
      const tokens = await exchangeCodeForTokens(
        process.env.GOOGLE_CLIENT_ID!,
        process.env.GOOGLE_CLIENT_SECRET!,
        authCode
      );

      console.log("Token exchange completed:", { 
        hasAccessToken: !!tokens.access_token, 
        hasRefreshToken: !!tokens.refresh_token,
        tokenType: tokens.token_type,
        scope: tokens.scope
      });

      if (!tokens.access_token || !tokens.refresh_token) {
        console.error("ERROR: Token exchange succeeded but tokens are missing");
        return res.status(400).json({ 
          message: "Token exchange failed - received incomplete tokens. Please restart the authorization process." 
        });
      }

      const config = {
        accessToken: tokens.access_token,
        refreshToken: tokens.refresh_token,
        folderName: folderName || "Journal Entries"
      };

      console.log("Storing integration in database...");
      const existingIntegration = await storage.getUserIntegration(req.session.userId!, "google_docs");

      if (existingIntegration) {
        console.log("Updating existing Google Docs integration");
        await storage.updateUserIntegration(req.session.userId!, "google_docs", {
          config,
          isEnabled: true
        });
      } else {
        console.log("Creating new Google Docs integration");
        await storage.createUserIntegration({
          userId: req.session.userId!,
          integrationType: "google_docs",
          config,
          isEnabled: true
        });
      }

      console.log("SUCCESS: Google Docs integration configured successfully");
      console.log("=== END CONFIGURATION ===");
      
      res.json({
        success: true,
        message: "Google Docs integration configured successfully"
      });
    } catch (error: any) {
      console.error("=== GOOGLE DOCS CONFIGURATION FAILED ===");
      console.error("Error type:", error?.constructor?.name);
      console.error("Error message:", error?.message);
      console.error("Error code:", error?.code);
      console.error("Error response:", error?.response?.data);
      console.error("Full error:", error);
      console.error("=== END ERROR ===");
      
      // Provide specific error messages based on error type
      let errorMessage = "Failed to configure Google Docs integration";
      
      if (error?.message?.includes("invalid_grant")) {
        errorMessage = "Authorization code expired or already used. Please restart the authorization process.";
      } else if (error?.message?.includes("redirect_uri_mismatch")) {
        errorMessage = "OAuth redirect URI configuration error. The redirect URI must be configured in Google Cloud Console.";
      } else if (error?.message?.includes("invalid_client")) {
        errorMessage = "Invalid Google OAuth client credentials. Please check the client ID and secret configuration.";
      } else if (error?.code === "ENOTFOUND" || error?.code === "ECONNREFUSED") {
        errorMessage = "Network error connecting to Google's servers. Please check your internet connection and try again.";
      }
      
      res.status(500).json({ 
        message: errorMessage,
        errorType: error?.constructor?.name,
        timestamp: new Date().toISOString()
      });
    }
  });

  app.post("/api/integrations/google-docs/toggle", requireAuth, async (req, res) => {
    try {
      const { enabled } = req.body;
      
      const integration = await storage.getUserIntegration(req.session.userId!, "google_docs");
      
      if (!integration) {
        return res.status(404).json({ message: "Google Docs integration not found" });
      }

      await storage.updateUserIntegration(req.session.userId!, "google_docs", {
        isEnabled: enabled
      });

      res.json({
        enabled,
        message: enabled ? "Google Docs integration enabled" : "Google Docs integration disabled"
      });
    } catch (error) {
      console.error("Toggle Google Docs integration error:", error);
      res.status(500).json({ message: "Failed to toggle Google Docs integration" });
    }
  });

  app.post("/api/integrations/google-docs/sync-all", requireAuth, async (req, res) => {
    try {
      const integration = await storage.getUserIntegration(req.session.userId!, "google_docs");
      
      if (!integration || !integration.isEnabled) {
        return res.status(400).json({ message: "Google Docs integration not enabled" });
      }

      const result = await syncAllUserEntriesToGoogleDocs(req.session.userId!);
      
      res.json({ 
        message: `Sync completed: ${result.success} successful, ${result.failed} failed`,
        successCount: result.success,
        failedCount: result.failed
      });
    } catch (error) {
      console.error("Bulk Google Docs sync error:", error);
      res.status(500).json({ 
        message: "Bulk sync failed. Please try again." 
      });
    }
  });

  // Retry failed entries
  app.post("/api/retry-failed-entries", async (req, res) => {
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
