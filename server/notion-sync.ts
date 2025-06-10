import { storage } from "./storage";
import { 
  createNotionClient, 
  createJournalDatabase, 
  addJournalEntryToNotion,
  updateNotionEntry,
  findDatabaseByTitle 
} from "./notion";
import type { JournalEntryWithDetails } from "@shared/schema";

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
    const entryData = {
      title: entry.title || "Untitled Entry",
      date: entry.createdAt.toISOString().split('T')[0], // YYYY-MM-DD format
      tags,
      content: entry.transcribedText || "",
      imageUrl: entry.originalImageUrl ? `${process.env.PUBLIC_URL || 'http://localhost:5000'}${entry.originalImageUrl}` : undefined,
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