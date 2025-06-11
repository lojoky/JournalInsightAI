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
        cb(error as any, uploadDir);
      }
    },
    filename: (req, file, cb) => {
      const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
      cb(null, file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname));
    }
  }),
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB limit
  },
  fileFilter: (req, file, cb) => {
    const allowedTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'image/heic', 'image/heif'];
    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Only image files are allowed') as any, false);
    }
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
        return res.status(400).json({ message: "Username and password are required" });
      }

      const result = await authenticateUser(username, password);
      
      if (result.success && result.user) {
        req.session.userId = result.user.id;
        req.session.user = result.user;
        return res.json({ user: result.user });
      } else {
        return res.status(401).json({ message: result.error || "Invalid credentials" });
      }
    } catch (error) {
      console.error("Login error:", error);
      return res.status(500).json({ message: "Login failed" });
    }
  });

  app.post("/api/auth/register", async (req, res) => {
    try {
      const { username, password } = req.body;
      
      if (!username || !password) {
        return res.status(400).json({ message: "Username and password are required" });
      }

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
        return res.json({ user: result.user });
      } else {
        return res.status(400).json({ message: result.error || "Registration failed" });
      }
    } catch (error) {
      console.error("Registration error:", error);
      return res.status(500).json({ message: "Registration failed" });
    }
  });

  app.post("/api/auth/logout", (req, res) => {
    req.session.destroy((err) => {
      if (err) {
        return res.status(500).json({ message: "Logout failed" });
      }
      res.clearCookie('connect.sid');
      res.json({ message: "Logged out successfully" });
    });
  });

  app.get("/api/auth/me", (req, res) => {
    if (req.session?.userId && req.session?.user) {
      res.json({ user: req.session.user });
    } else {
      res.status(401).json({ message: "Not authenticated" });
    }
  });

  // Journal entry routes
  app.get("/api/journal-entries", requireAuth, async (req, res) => {
    try {
      const limit = parseInt(req.query.limit as string) || 10;
      const entries = await storage.getJournalEntriesByUser(req.session.userId!, limit);
      res.json(entries);
    } catch (error) {
      console.error("Get entries error:", error);
      res.status(500).json({ message: "Failed to fetch journal entries" });
    }
  });

  app.get("/api/journal-entries/:id", requireAuth, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const entry = await storage.getJournalEntry(id);
      
      if (!entry || entry.userId !== req.session.userId) {
        return res.status(404).json({ message: "Entry not found" });
      }
      
      res.json(entry);
    } catch (error) {
      console.error("Get entry error:", error);
      res.status(500).json({ message: "Failed to fetch journal entry" });
    }
  });

  app.get("/api/journal-entries/:id/status", requireAuth, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      
      const entry = await storage.getJournalEntry(id);
      if (!entry || entry.userId !== req.session.userId) {
        return res.status(404).json({ message: "Entry not found" });
      }

      res.json({
        id: entry.id,
        processingStatus: entry.processingStatus,
        transcribedText: entry.transcribedText,
        ocrConfidence: entry.ocrConfidence,
        title: entry.title,
        updatedAt: entry.updatedAt
      });
    } catch (error) {
      console.error("Status check error:", error);
      res.status(500).json({ message: "Failed to check status" });
    }
  });

  app.patch("/api/journal-entries/:id", requireAuth, async (req, res) => {
    console.log(`PATCH request received for entry ${req.params.id}`);
    console.log(`Request body:`, req.body);
    console.log(`Content-Type:`, req.headers['content-type']);
    
    try {
      const id = parseInt(req.params.id);
      const { title, transcribedText } = req.body;
      
      if (!transcribedText || typeof transcribedText !== 'string') {
        console.log(`Validation failed: transcribedText missing or invalid`);
        return res.status(400).json({ message: "Transcribed text is required" });
      }
      
      const entry = await storage.getJournalEntry(id);
      if (!entry || entry.userId !== req.session.userId) {
        console.log(`Entry not found or access denied for entry ${id}`);
        return res.status(404).json({ message: "Entry not found" });
      }

      console.log(`Updating entry ${id} with new text of length ${transcribedText.length}`);
      const updatedEntry = await storage.updateJournalEntry(id, {
        title,
        transcribedText: transcribedText.trim()
      });

      console.log(`Entry ${id} updated successfully`);
      res.json({
        message: "Entry updated successfully",
        entry: updatedEntry
      });
    } catch (error) {
      console.error("Edit entry error:", error);
      res.status(500).json({ message: "Failed to edit journal entry" });
    }
  });

  app.post("/api/journal-entries/:id/edit", requireAuth, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const { title, transcribedText } = req.body;
      
      const entry = await storage.getJournalEntry(id);
      if (!entry || entry.userId !== req.session.userId) {
        return res.status(404).json({ message: "Entry not found" });
      }

      const updatedEntry = await storage.updateJournalEntry(id, {
        title,
        transcribedText
      });

      res.json(updatedEntry);
    } catch (error) {
      console.error("Edit entry error:", error);
      res.status(500).json({ message: "Failed to edit journal entry" });
    }
  });

  app.delete("/api/journal-entries/:id", requireAuth, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      
      const entry = await storage.getJournalEntry(id);
      if (!entry || entry.userId !== req.session.userId) {
        return res.status(404).json({ message: "Entry not found" });
      }

      await storage.deleteJournalEntry(id);
      res.json({ message: "Entry deleted successfully" });
    } catch (error) {
      console.error("Delete entry error:", error);
      res.status(500).json({ message: "Failed to delete journal entry" });
    }
  });

  app.post("/api/upload", requireAuth, upload.single('journal'), async (req, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({ message: "No file uploaded" });
      }

      const userId = req.session.userId!;
      const { title } = req.body;

      // Convert absolute file path to web URL
      const filename = path.basename(req.file.path);
      const webImageUrl = `/uploads/${filename}`;

      const entry = await storage.createJournalEntry({
        userId,
        title: title || "Untitled Entry",
        originalImageUrl: webImageUrl,
        transcribedText: "",
        ocrConfidence: 0,
        processingStatus: "processing"
      });

      res.json(entry);

      // Process asynchronously
      try {
        console.log(`Starting OCR processing for entry ${entry.id}`);
        const ocrResult = await extractTextFromImage(req.file.path);
        console.log(`OCR completed for entry ${entry.id}, text length: ${ocrResult.text?.length || 0}`);
        
        if (ocrResult.text && ocrResult.text.trim().length > 0) {
          console.log(`Starting AI analysis for entry ${entry.id}`);
          const analysisResult = await analyzeJournalEntry(ocrResult.text);
          const sentimentResult = await analyzeSentiment(ocrResult.text);
          console.log(`AI analysis completed for entry ${entry.id}`);

          await storage.updateJournalEntry(entry.id, {
            title: analysisResult.title || entry.title,
            transcribedText: ocrResult.text,
            ocrConfidence: ocrResult.confidence,
            processingStatus: "completed"
          });

          // Add themes
          for (const theme of analysisResult.themes) {
            await storage.createTheme({
              entryId: entry.id,
              title: theme.title,
              description: theme.description,
              confidence: Math.round(Number(theme.confidence)) // Ensure integer 0-100
            });
          }

          // Add tags
          for (const tagName of analysisResult.tags) {
            const tag = await storage.getOrCreateTag(tagName);
            await storage.addTagToEntry({
              entryId: entry.id,
              tagId: tag.id,
              confidence: 80, // Convert 0.8 to percentage (80)
              isAutoGenerated: true
            });
          }

          // Add sentiment analysis
          await storage.createSentimentAnalysis({
            entryId: entry.id,
            positiveScore: sentimentResult.positive,
            neutralScore: sentimentResult.neutral,
            concernScore: sentimentResult.concern,
            overallSentiment: sentimentResult.overall
          });

          const completeEntry = await storage.getJournalEntry(entry.id);
          
          // Sync to Notion if enabled
          const notionIntegration = await storage.getUserIntegration(userId, "notion");
          if (notionIntegration?.isEnabled && completeEntry) {
            try {
              await syncJournalEntryToNotion(completeEntry);
            } catch (notionError) {
              console.error("Notion sync failed:", notionError);
            }
          }
        } else {
          console.log(`No text extracted from entry ${entry.id}, marking as failed`);
          await storage.updateJournalEntry(entry.id, {
            processingStatus: "failed",
            transcribedText: "No readable text found in image"
          });
        }
      } catch (processingError) {
        console.error(`Processing error for entry ${entry.id}:`, processingError);
        const errorMessage = processingError instanceof Error ? processingError.message : "Unknown processing error";
        await storage.updateJournalEntry(entry.id, {
          processingStatus: "failed",
          transcribedText: `Processing failed: ${errorMessage}`
        });
      }
    } catch (error) {
      console.error("Upload error:", error);
      res.status(500).json({ message: "Upload failed" });
    }
  });

  app.post("/api/upload-bulk", requireAuth, upload.array('journals', 10), async (req, res) => {
    try {
      if (!req.files || !Array.isArray(req.files) || req.files.length === 0) {
        return res.status(400).json({ message: "No files uploaded" });
      }

      const userId = req.session.userId!;
      const entries = [];

      for (const file of req.files) {
        // Convert absolute file path to web URL
        const filename = path.basename(file.path);
        const webImageUrl = `/uploads/${filename}`;
        
        const entry = await storage.createJournalEntry({
          userId,
          title: `Bulk Upload ${new Date().toLocaleDateString()}`,
          originalImageUrl: webImageUrl,
          transcribedText: "",
          ocrConfidence: 0,
          processingStatus: "processing"
        });
        entries.push(entry);
      }

      res.json({ entries, message: `${entries.length} files uploaded and processing started` });

      // Process each file asynchronously
      const files = req.files as Express.Multer.File[];
      for (let index = 0; index < entries.length; index++) {
        const entry = entries[index];
        try {
          const file = files[index];
          const ocrResult = await extractTextFromImage(file.path);
          
          if (ocrResult.text) {
            const analysisResult = await analyzeJournalEntry(ocrResult.text);
            const sentimentResult = await analyzeSentiment(ocrResult.text);

            await storage.updateJournalEntry(entry.id, {
              title: analysisResult.title,
              transcribedText: ocrResult.text,
              ocrConfidence: ocrResult.confidence,
              processingStatus: "completed"
            });

            // Add themes
            for (const theme of analysisResult.themes) {
              await storage.createTheme({
                entryId: entry.id,
                title: theme.title,
                description: theme.description,
                confidence: theme.confidence
              });
            }

            // Add tags
            for (const tagName of analysisResult.tags) {
              const tag = await storage.getOrCreateTag(tagName);
              await storage.addTagToEntry({
                entryId: entry.id,
                tagId: tag.id,
                confidence: 0.8,
                isAutoGenerated: true
              });
            }

            // Add sentiment analysis
            await storage.createSentimentAnalysis({
              entryId: entry.id,
              positiveScore: sentimentResult.positive,
              neutralScore: sentimentResult.neutral,
              concernScore: sentimentResult.concern,
              overallSentiment: sentimentResult.overall
            });
          } else {
            await storage.updateJournalEntry(entry.id, {
              processingStatus: "failed"
            });
          }
        } catch (processingError) {
          console.error(`Processing error for entry ${entry.id}:`, processingError);
          await storage.updateJournalEntry(entry.id, {
            processingStatus: "failed"
          });
        }
      }
    } catch (error) {
      console.error("Bulk upload error:", error);
      res.status(500).json({ message: "Bulk upload failed" });
    }
  });

  // Notion integration routes
  app.get("/api/integrations/notion", requireAuth, async (req, res) => {
    try {
      const integration = await storage.getUserIntegration(req.session.userId!, "notion");
      
      if (!integration) {
        return res.json({ enabled: false, configured: false });
      }

      res.json({
        enabled: integration.isEnabled,
        configured: !!integration.config,
        config: integration.config
      });
    } catch (error) {
      console.error("Get Notion integration error:", error);
      res.status(500).json({ message: "Failed to get Notion integration status" });
    }
  });

  app.post("/api/integrations/notion/configure", requireAuth, async (req, res) => {
    try {
      const { integrationToken, pageUrl } = req.body;
      
      if (!integrationToken || !pageUrl) {
        return res.status(400).json({ message: "Integration token and page URL are required" });
      }

      const notion = createNotionClient(integrationToken);
      const pageId = extractPageIdFromUrl(pageUrl);
      
      await createJournalDatabase(notion, pageId);

      const config = {
        integrationToken,
        pageUrl,
        pageId
      };

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

      res.json({ success: true, message: "Notion integration configured successfully" });
    } catch (error) {
      console.error("Configure Notion error:", error);
      res.status(500).json({ message: "Failed to configure Notion integration" });
    }
  });

  app.post("/api/integrations/notion/toggle", requireAuth, async (req, res) => {
    try {
      const { enabled } = req.body;
      
      const integration = await storage.getUserIntegration(req.session.userId!, "notion");
      
      if (!integration) {
        return res.status(404).json({ message: "Notion integration not found" });
      }

      await storage.updateUserIntegration(req.session.userId!, "notion", {
        isEnabled: enabled
      });

      res.json({
        enabled,
        message: enabled ? "Notion integration enabled" : "Notion integration disabled"
      });
    } catch (error) {
      console.error("Toggle Notion integration error:", error);
      res.status(500).json({ message: "Failed to toggle Notion integration" });
    }
  });

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

  // Retry failed entries
  app.post("/api/retry-failed", requireAuth, async (req, res) => {
    try {
      const result = await retryFailedEntries();
      res.json(result);
    } catch (error) {
      console.error("Retry failed entries error:", error);
      res.status(500).json({ message: "Failed to retry processing" });
    }
  });

  app.get("/api/failed-entries-count", requireAuth, async (req, res) => {
    try {
      const failedEntries = await storage.getFailedEntries();
      res.json({ count: failedEntries.length });
    } catch (error) {
      console.error("Get failed entries count error:", error);
      res.status(500).json({ message: "Failed to get failed entries count" });
    }
  });

  // Tags routes
  app.get("/api/tags", requireAuth, async (req, res) => {
    try {
      const tags = await storage.getAllTags();
      res.json(tags);
    } catch (error) {
      console.error("Get tags error:", error);
      res.status(500).json({ message: "Failed to fetch tags" });
    }
  });

  // Basic Google Docs route - placeholder for rebuild
  app.get("/api/integrations/google-docs", requireAuth, async (req, res) => {
    try {
      res.json({ 
        enabled: false, 
        configured: false,
        message: "Google Docs integration will be rebuilt"
      });
    } catch (error) {
      console.error("Get Google Docs integration error:", error);
      res.status(500).json({ message: "Failed to get Google Docs integration status" });
    }
  });

  // Health check endpoint
  app.get("/api/health", (req, res) => {
    res.json({ 
      status: "ok", 
      timestamp: new Date().toISOString()
    });
  });

  const httpServer = createServer(app);
  return httpServer;
}