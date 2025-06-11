import { storage } from "./storage";
import { 
  createNotionClient, 
  createJournalDatabase, 
  addJournalEntryToNotion,
  updateNotionEntry,
  findDatabaseByTitle 
} from "./notion";
import type { JournalEntryWithDetails } from "@shared/schema";
import OpenAI from "openai";
import { Client } from "@notionhq/client";

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

export async function syncJournalEntryToNotion(entry: JournalEntryWithDetails): Promise<void> {
  try {
    // Get user's Notion integration
    const integration = await storage.getUserIntegration(entry.userId, "notion");
    
    if (!integration || !integration.isEnabled || !integration.config) {
      console.log(`Notion integration not enabled for user ${entry.userId}`);
      return;
    }

    const config = integration.config as {
      integrationToken: string;
      pageId: string;
      databaseName: string;
    };

    // Create Notion client
    const notion = createNotionClient(config.integrationToken);

    // Find or create journal database
    let database = await findDatabaseByTitle(notion, config.pageId, config.databaseName);
    
    if (!database) {
      console.log(`Creating new database "${config.databaseName}" for user ${entry.userId}`);
      database = await createJournalDatabase(notion, config.pageId);
    }

    // Check if entry already exists in Notion
    const existingNotionEntry = await storage.getNotionEntryByJournalId(entry.id);

    // Prepare entry data
    const tags = entry.tags.map(tag => tag.name);
    
    // Try to extract date from journal content using AI analysis
    let entryDate = entry.createdAt.toISOString().split('T')[0]; // Default to creation date
    
    // Check if we have transcribed text to analyze for date
    if (entry.transcribedText) {
      try {
        const dateExtractionPrompt = `Extract the date mentioned in this journal entry. Look for explicit dates like "January 15", "Jan 15th", "1/15", "15th", etc. Return only the date in YYYY-MM-DD format, or "none" if no specific date is mentioned.

Journal text: "${entry.transcribedText.substring(0, 500)}"

Response (just the date or "none"):`;

        const dateResponse = await openai.chat.completions.create({
          model: 'gpt-4o',
          messages: [{ role: 'user', content: dateExtractionPrompt }],
          max_tokens: 50,
          temperature: 0
        });

        const extractedDate = dateResponse.choices[0]?.message?.content?.trim();
        
        // Validate and use extracted date if it's in correct format
        if (extractedDate && extractedDate !== "none" && /^\d{4}-\d{2}-\d{2}$/.test(extractedDate)) {
          const parsedDate = new Date(extractedDate);
          if (!isNaN(parsedDate.getTime())) {
            entryDate = extractedDate;
            console.log(`Extracted date ${extractedDate} from journal entry ${entry.id}`);
          }
        }
      } catch (dateError) {
        console.log(`Failed to extract date from entry ${entry.id}, using creation date`);
      }
    }

    // Construct the full image URL for Notion
    let imageUrl: string | undefined;
    if (entry.originalImageUrl) {
      // Get the current request protocol and host
      const baseUrl = process.env.REPLIT_DEV_DOMAIN 
        ? `https://${process.env.REPLIT_DEV_DOMAIN}` 
        : process.env.PUBLIC_URL || 'http://localhost:5000';
      
      imageUrl = `${baseUrl}${entry.originalImageUrl}`;
      console.log(`Constructed image URL for Notion: ${imageUrl}`);
    }

    const entryData = {
      title: entry.title || "Untitled Entry",
      date: entryDate,
      tags,
      content: entry.transcribedText || "",
      imageUrl,
      processingStatus: entry.processingStatus || "pending"
    };

    if (existingNotionEntry) {
      // Update existing Notion entry
      console.log(`Updating existing Notion entry for journal ${entry.id}`);
      
      await updateNotionEntry(notion, existingNotionEntry.notionPageId, {
        content: entryData.content,
        tags: entryData.tags,
        processingStatus: entryData.processingStatus
      });

      // Update sync status
      await storage.updateNotionEntry(existingNotionEntry.id, {
        syncStatus: "synced"
      });
    } else {
      // Create new Notion entry
      console.log(`Creating new Notion entry for journal ${entry.id}`);
      
      const notionPage = await addJournalEntryToNotion(notion, database.id, entryData);

      // Store the Notion entry reference
      await storage.createNotionEntry({
        journalEntryId: entry.id,
        userId: entry.userId,
        notionPageId: notionPage.id,
        notionDatabaseId: database.id,
        syncStatus: "synced"
      });
    }

    console.log(`Successfully synced journal entry ${entry.id} to Notion`);
  } catch (error) {
    console.error(`Failed to sync journal entry ${entry.id} to Notion:`, error);
    
    // Update sync status to failed if entry exists
    const existingNotionEntry = await storage.getNotionEntryByJournalId(entry.id);
    if (existingNotionEntry) {
      await storage.updateNotionEntry(existingNotionEntry.id, {
        syncStatus: "failed"
      });
    }
    
    throw error;
  }
}

export async function cleanupNotionEntriesForMerge(
  originalEntryIds: number[], 
  mergedEntry: JournalEntryWithDetails
): Promise<void> {
  try {
    console.log(`Cleaning up Notion entries for merged entry ${mergedEntry.id}`);
    
    // Get user's Notion integration
    const integration = await storage.getUserIntegration(mergedEntry.userId, "notion");
    
    if (!integration || !integration.isEnabled || !integration.config) {
      console.log(`Notion integration not enabled for user ${mergedEntry.userId}, skipping cleanup`);
      return;
    }

    const config = integration.config as {
      integrationToken: string;
      pageId: string;
      databaseName: string;
    };

    const notion = createNotionClient(config.integrationToken);

    // Delete original Notion entries
    for (const originalId of originalEntryIds) {
      try {
        const notionEntry = await storage.getNotionEntryByJournalId(originalId);
        if (notionEntry) {
          console.log(`Deleting Notion page ${notionEntry.notionPageId} for original entry ${originalId}`);
          
          // Archive/delete the Notion page
          await notion.pages.update({
            page_id: notionEntry.notionPageId,
            archived: true
          });

          // Remove the Notion entry record from our database
          await storage.updateNotionEntry(notionEntry.id, {
            syncStatus: "deleted"
          });
          
          console.log(`Successfully deleted Notion entry for journal ${originalId}`);
        }
      } catch (error) {
        console.error(`Failed to delete Notion entry for journal ${originalId}:`, error);
        // Continue with other deletions even if one fails
      }
    }

    // Create new Notion entry for the merged entry
    console.log(`Creating Notion entry for merged journal ${mergedEntry.id}`);
    await syncJournalEntryToNotion(mergedEntry);
    
    console.log(`Successfully completed Notion cleanup for merged entry ${mergedEntry.id}`);
  } catch (error) {
    console.error(`Failed to cleanup Notion entries for merge:`, error);
    // Don't throw here - we don't want to fail the merge operation if Notion sync fails
  }
}

export async function syncAllUserEntriesToNotion(userId: number): Promise<{ success: number; failed: number }> {
  let success = 0;
  let failed = 0;

  try {
    // Get all journal entries for the user
    const entries = await storage.getJournalEntriesByUser(userId, 100); // Sync up to 100 entries
    
    console.log(`Starting bulk sync of ${entries.length} entries for user ${userId}`);

    for (const entry of entries) {
      try {
        await syncJournalEntryToNotion(entry);
        success++;
      } catch (error) {
        console.error(`Failed to sync entry ${entry.id}:`, error);
        failed++;
      }
    }

    console.log(`Bulk sync completed: ${success} successful, ${failed} failed`);
  } catch (error) {
    console.error(`Bulk sync failed for user ${userId}:`, error);
    throw error;
  }

  return { success, failed };
}