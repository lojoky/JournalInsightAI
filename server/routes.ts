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

  // Basic Google Docs route - just for testing integration status
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