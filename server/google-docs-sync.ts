import { storage } from "./storage";
import { 
  createGoogleClient, 
  createJournalFolder, 
  createJournalDocument,
  updateJournalDocument 
} from "./google-docs";
import type { JournalEntryWithDetails } from "@shared/schema";
import OpenAI from "openai";

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

export async function syncJournalEntryToGoogleDocs(entry: JournalEntryWithDetails): Promise<void> {
  try {
    // Get user's Google Docs integration
    const integration = await storage.getUserIntegration(entry.userId, "google_docs");
    
    if (!integration || !integration.isEnabled || !integration.config) {
      console.log(`Google Docs integration not enabled for user ${entry.userId}`);
      return;
    }

    const config = integration.config as {
      accessToken: string;
      refreshToken: string;
      folderName: string;
    };

    // Create Google client
    const auth = createGoogleClient(config.accessToken, config.refreshToken);

    // Create or find the journal folder
    const folder = await createJournalFolder(auth, config.folderName || 'Journal Entries');
    
    if (!folder || !folder.id) {
      throw new Error('Failed to create or find Google Drive folder');
    }

    // Extract date from journal content using AI analysis (same as Notion sync)
    let entryDate = entry.createdAt.toISOString().split('T')[0]; // Default to creation date
    
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

    // Check if document already exists for this entry
    const existingGoogleDoc = await storage.getGoogleDocByJournalId?.(entry.id);

    if (existingGoogleDoc && existingGoogleDoc.googleDocId) {
      // Update existing document
      console.log(`Updating existing Google Doc for journal ${entry.id}`);
      
      const updatedDoc = await updateJournalDocument(auth, existingGoogleDoc.googleDocId, entry, entryDate);
      
      // Update sync status
      await storage.updateGoogleDoc?.(existingGoogleDoc.id, {
        syncStatus: "synced"
      });
    } else {
      // Create new document
      console.log(`Creating new Google Doc for journal ${entry.id}`);
      
      const newDoc = await createJournalDocument(auth, entry, folder.id, entryDate);

      // Store the Google Doc reference
      await storage.createGoogleDoc?.({
        journalEntryId: entry.id,
        userId: entry.userId,
        googleDocId: newDoc.documentId,
        googleFolderId: folder.id,
        documentUrl: newDoc.url,
        syncStatus: "synced"
      });
    }

    console.log(`Successfully synced journal entry ${entry.id} to Google Docs`);
  } catch (error) {
    console.error(`Failed to sync journal entry ${entry.id} to Google Docs:`, error);
    
    // Update sync status to failed if entry exists
    const existingGoogleDoc = await storage.getGoogleDocByJournalId?.(entry.id);
    if (existingGoogleDoc) {
      await storage.updateGoogleDoc?.(existingGoogleDoc.id, {
        syncStatus: "failed"
      });
    }
    
    throw error;
  }
}

export async function syncAllUserEntriesToGoogleDocs(userId: number): Promise<{ success: number; failed: number }> {
  let success = 0;
  let failed = 0;

  try {
    // Get all journal entries for the user
    const entries = await storage.getJournalEntriesByUser(userId, 100); // Sync up to 100 entries
    
    console.log(`Starting bulk Google Docs sync of ${entries.length} entries for user ${userId}`);

    for (const entry of entries) {
      try {
        await syncJournalEntryToGoogleDocs(entry);
        success++;
      } catch (error) {
        console.error(`Failed to sync entry ${entry.id} to Google Docs:`, error);
        failed++;
      }
    }

    console.log(`Bulk Google Docs sync completed: ${success} successful, ${failed} failed`);
  } catch (error) {
    console.error(`Bulk Google Docs sync failed for user ${userId}:`, error);
    throw error;
  }

  return { success, failed };
}