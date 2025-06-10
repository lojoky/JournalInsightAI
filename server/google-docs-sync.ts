import { storage } from "./storage";
import { 
  createGoogleClient, 
  createJournalFolder, 
  findOrCreateSharedJournalDocument,
  addEntryToSharedDocument
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

    // Check if entry already exists in the shared document
    const existingGoogleDoc = await storage.getGoogleDocByJournalId(entry.id);

    if (existingGoogleDoc && existingGoogleDoc.googleDocId) {
      console.log(`Entry ${entry.id} already synced to shared Google Doc`);
      return;
    }

    // Find or create the shared journal document
    const sharedDoc = await findOrCreateSharedJournalDocument(auth, folder.id, config.folderName || 'My Journal');

    if (!sharedDoc.documentId) {
      throw new Error('Failed to create or find shared Google Doc');
    }

    // Add the entry to the shared document
    console.log(`Adding journal entry ${entry.id} to shared Google Doc`);
    
    await addEntryToSharedDocument(auth, sharedDoc.documentId, entry, entryDate);

    // Store the Google Doc reference for this entry
    await storage.createGoogleDoc({
      journalEntryId: entry.id,
      userId: entry.userId,
      documentId: sharedDoc.documentId,
      documentUrl: sharedDoc.url,
      folderId: folder.id,
      syncStatus: "synced"
    });

    console.log(`Successfully synced journal entry ${entry.id} to Google Docs`);
  } catch (error) {
    console.error(`Failed to sync journal entry ${entry.id} to Google Docs:`, error);
    
    // Update sync status to failed if entry exists
    const existingGoogleDoc = await storage.getGoogleDocByJournalId(entry.id);
    if (existingGoogleDoc) {
      await storage.updateGoogleDoc(existingGoogleDoc.id, {
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