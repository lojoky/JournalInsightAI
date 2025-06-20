import { pgTable, text, serial, integer, boolean, timestamp, jsonb } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";
import { relations } from "drizzle-orm";

export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  username: text("username").notNull().unique(),
  password: text("password").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const journalEntries = pgTable("journal_entries", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull(),
  title: text("title").notNull(),
  originalImageUrl: text("original_image_url"),
  transcribedText: text("transcribed_text"),
  ocrConfidence: integer("ocr_confidence"), // percentage 0-100
  processingStatus: text("processing_status").notNull().default("pending"), // pending, processing, completed, failed
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const themes = pgTable("themes", {
  id: serial("id").primaryKey(),
  entryId: integer("entry_id").notNull(),
  title: text("title").notNull(),
  description: text("description"),
  confidence: integer("confidence"), // percentage 0-100
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const tags = pgTable("tags", {
  id: serial("id").primaryKey(),
  name: text("name").notNull().unique(),
  category: text("category"), // faith, career, relationships, etc.
  color: text("color").default("#6366F1"),
  isCustom: boolean("is_custom").default(false),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const entryTags = pgTable("entry_tags", {
  id: serial("id").primaryKey(),
  entryId: integer("entry_id").notNull(),
  tagId: integer("tag_id").notNull(),
  confidence: integer("confidence"), // percentage 0-100 for auto-generated tags
  isAutoGenerated: boolean("is_auto_generated").default(true),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const sentimentAnalysis = pgTable("sentiment_analysis", {
  id: serial("id").primaryKey(),
  entryId: integer("entry_id").notNull(),
  positiveScore: integer("positive_score").notNull(), // percentage 0-100
  neutralScore: integer("neutral_score").notNull(), // percentage 0-100
  concernScore: integer("concern_score").notNull(), // percentage 0-100
  overallSentiment: text("overall_sentiment").notNull(), // positive, neutral, negative
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const userIntegrations = pgTable("user_integrations", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull(),
  integrationType: text("integration_type").notNull(), // "notion", "google_docs", etc.
  isEnabled: boolean("is_enabled").notNull().default(false),
  config: jsonb("config"), // Store integration-specific configuration
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const notionEntries = pgTable("notion_entries", {
  id: serial("id").primaryKey(),
  journalEntryId: integer("journal_entry_id").notNull(),
  userId: integer("user_id").notNull(),
  notionPageId: text("notion_page_id").notNull(),
  notionDatabaseId: text("notion_database_id").notNull(),
  syncStatus: text("sync_status").notNull().default("pending"), // pending, synced, failed
  lastSyncAt: timestamp("last_sync_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// Google Docs integration removed - will be rebuilt

// Relations
export const usersRelations = relations(users, ({ many }) => ({
  journalEntries: many(journalEntries),
  userIntegrations: many(userIntegrations),
  notionEntries: many(notionEntries),
}));

export const journalEntriesRelations = relations(journalEntries, ({ one, many }) => ({
  user: one(users, {
    fields: [journalEntries.userId],
    references: [users.id],
  }),
  themes: many(themes),
  entryTags: many(entryTags),
  sentimentAnalysis: one(sentimentAnalysis),
  notionEntry: one(notionEntries),
}));

export const themesRelations = relations(themes, ({ one }) => ({
  entry: one(journalEntries, {
    fields: [themes.entryId],
    references: [journalEntries.id],
  }),
}));

export const tagsRelations = relations(tags, ({ many }) => ({
  entryTags: many(entryTags),
}));

export const entryTagsRelations = relations(entryTags, ({ one }) => ({
  entry: one(journalEntries, {
    fields: [entryTags.entryId],
    references: [journalEntries.id],
  }),
  tag: one(tags, {
    fields: [entryTags.tagId],
    references: [tags.id],
  }),
}));

export const sentimentAnalysisRelations = relations(sentimentAnalysis, ({ one }) => ({
  entry: one(journalEntries, {
    fields: [sentimentAnalysis.entryId],
    references: [journalEntries.id],
  }),
}));

export const userIntegrationsRelations = relations(userIntegrations, ({ one }) => ({
  user: one(users, {
    fields: [userIntegrations.userId],
    references: [users.id],
  }),
}));

export const notionEntriesRelations = relations(notionEntries, ({ one }) => ({
  user: one(users, {
    fields: [notionEntries.userId],
    references: [users.id],
  }),
  journalEntry: one(journalEntries, {
    fields: [notionEntries.journalEntryId],
    references: [journalEntries.id],
  }),
}));

// Google Docs relations removed

// Insert schemas
export const insertUserSchema = createInsertSchema(users).pick({
  username: true,
  password: true,
});

export const insertJournalEntrySchema = createInsertSchema(journalEntries).pick({
  userId: true,
  title: true,
  originalImageUrl: true,
  transcribedText: true,
  ocrConfidence: true,
  processingStatus: true,
});

export const insertThemeSchema = createInsertSchema(themes).pick({
  entryId: true,
  title: true,
  description: true,
  confidence: true,
});

export const insertTagSchema = createInsertSchema(tags).pick({
  name: true,
  category: true,
  color: true,
  isCustom: true,
});

export const insertEntryTagSchema = createInsertSchema(entryTags).pick({
  entryId: true,
  tagId: true,
  confidence: true,
  isAutoGenerated: true,
});

export const insertSentimentAnalysisSchema = createInsertSchema(sentimentAnalysis).pick({
  entryId: true,
  positiveScore: true,
  neutralScore: true,
  concernScore: true,
  overallSentiment: true,
});

export const insertUserIntegrationSchema = createInsertSchema(userIntegrations).pick({
  userId: true,
  integrationType: true,
  isEnabled: true,
  config: true,
});

export const insertNotionEntrySchema = createInsertSchema(notionEntries).pick({
  journalEntryId: true,
  userId: true,
  notionPageId: true,
  notionDatabaseId: true,
  syncStatus: true,
});

// Types
export type InsertUser = z.infer<typeof insertUserSchema>;
export type User = typeof users.$inferSelect;

export type InsertJournalEntry = z.infer<typeof insertJournalEntrySchema>;
export type JournalEntry = typeof journalEntries.$inferSelect;

export type InsertTheme = z.infer<typeof insertThemeSchema>;
export type Theme = typeof themes.$inferSelect;

export type InsertTag = z.infer<typeof insertTagSchema>;
export type Tag = typeof tags.$inferSelect;

export type InsertEntryTag = z.infer<typeof insertEntryTagSchema>;
export type EntryTag = typeof entryTags.$inferSelect;

export type InsertSentimentAnalysis = z.infer<typeof insertSentimentAnalysisSchema>;
export type SentimentAnalysis = typeof sentimentAnalysis.$inferSelect;

export type InsertUserIntegration = z.infer<typeof insertUserIntegrationSchema>;
export type UserIntegration = typeof userIntegrations.$inferSelect;

export type InsertNotionEntry = z.infer<typeof insertNotionEntrySchema>;
export type NotionEntry = typeof notionEntries.$inferSelect;

// Enhanced types for API responses
export type JournalEntryWithDetails = JournalEntry & {
  themes: Theme[];
  tags: (Tag & { confidence?: number; isAutoGenerated?: boolean })[];
  sentimentAnalysis?: SentimentAnalysis;
};
