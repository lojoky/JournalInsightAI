import { google } from 'googleapis';
import { OAuth2Client } from 'google-auth-library';
import { createAuthorizedClient } from './google-oauth';
import type { JournalEntryWithDetails } from '@shared/schema';

export interface GoogleDocumentInfo {
  id: string;
  title: string;
  url: string;
}

export async function createGoogleDoc(
  credentials: any,
  title: string
): Promise<GoogleDocumentInfo> {
  const auth = createAuthorizedClient(credentials);
  const docs = google.docs({ version: 'v1', auth });
  const drive = google.drive({ version: 'v3', auth });

  try {
    // Create the document
    const createResponse = await docs.documents.create({
      requestBody: {
        title: title,
      },
    });

    const documentId = createResponse.data.documentId!;
    
    // Get the document URL from Drive API
    const driveResponse = await drive.files.get({
      fileId: documentId,
      fields: 'webViewLink',
    });

    return {
      id: documentId,
      title: title,
      url: driveResponse.data.webViewLink!,
    };
  } catch (error) {
    console.error('Error creating Google Doc:', error);
    throw new Error('Failed to create Google Doc');
  }
}

export async function appendToGoogleDoc(
  credentials: any,
  documentId: string,
  entry: JournalEntryWithDetails
): Promise<void> {
  const auth = createAuthorizedClient(credentials);
  const docs = google.docs({ version: 'v1', auth });

  try {
    // Get current document to find the end
    const doc = await docs.documents.get({
      documentId: documentId,
    });

    const endIndex = doc.data.body?.content?.reduce((max, element) => {
      return Math.max(max, element.endIndex || 0);
    }, 0) || 1;

    // Format the journal entry
    const entryDate = new Date(entry.createdAt).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });

    const tags = entry.tags?.map(tag => tag.name).join(', ') || '';
    const themes = entry.themes?.map(theme => theme.title).join(', ') || '';
    
    // Prepare the requests for batch update
    const requests = [];

    // Add title as heading
    requests.push({
      insertText: {
        location: { index: endIndex - 1 },
        text: `\n\n${entry.title}\n`,
      },
    });

    // Add date
    requests.push({
      insertText: {
        location: { index: endIndex - 1 },
        text: `${entryDate}\n\n`,
      },
    });

    // Add transcript
    if (entry.transcribedText) {
      requests.push({
        insertText: {
          location: { index: endIndex - 1 },
          text: `${entry.transcribedText}\n\n`,
        },
      });
    }

    // Add tags if available
    if (tags) {
      requests.push({
        insertText: {
          location: { index: endIndex - 1 },
          text: `Tags: ${tags}\n`,
        },
      });
    }

    // Add key takeaways from themes
    if (entry.themes && entry.themes.length > 0) {
      requests.push({
        insertText: {
          location: { index: endIndex - 1 },
          text: `Key Takeaways:\n`,
        },
      });

      for (const theme of entry.themes) {
        requests.push({
          insertText: {
            location: { index: endIndex - 1 },
            text: `– ${theme.description}\n`,
          },
        });
      }
    }

    // Execute batch update
    await docs.documents.batchUpdate({
      documentId: documentId,
      requestBody: {
        requests: requests,
      },
    });

  } catch (error) {
    console.error('Error appending to Google Doc:', error);
    throw new Error('Failed to append to Google Doc');
  }
}

export async function listUserGoogleDocs(credentials: any): Promise<GoogleDocumentInfo[]> {
  const auth = createAuthorizedClient(credentials);
  const drive = google.drive({ version: 'v3', auth });

  try {
    const response = await drive.files.list({
      q: "mimeType='application/vnd.google-apps.document' and trashed=false",
      fields: 'files(id,name,webViewLink)',
      orderBy: 'modifiedTime desc',
      pageSize: 20,
    });

    return response.data.files?.map(file => ({
      id: file.id!,
      title: file.name!,
      url: file.webViewLink!,
    })) || [];
  } catch (error) {
    console.error('Error listing Google Docs:', error);
    throw new Error('Failed to list Google Docs');
  }
}

export async function getGoogleDocInfo(
  credentials: any,
  documentId: string
): Promise<GoogleDocumentInfo> {
  const auth = createAuthorizedClient(credentials);
  const drive = google.drive({ version: 'v3', auth });

  try {
    const response = await drive.files.get({
      fileId: documentId,
      fields: 'id,name,webViewLink',
    });

    return {
      id: response.data.id!,
      title: response.data.name!,
      url: response.data.webViewLink!,
    };
  } catch (error) {
    console.error('Error getting Google Doc info:', error);
    throw new Error('Failed to get Google Doc information');
  }
}

export function formatJournalEntryForGoogleDocs(entry: JournalEntryWithDetails): string {
  const entryDate = new Date(entry.createdAt).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  });

  const tags = entry.tags?.map(tag => tag.name).join(', ') || '';
  const themes = entry.themes?.map(theme => theme.description).join('\n– ') || '';

  let formatted = `${entry.title}\n${entryDate}\n\n`;
  
  if (entry.transcribedText) {
    formatted += `${entry.transcribedText}\n\n`;
  }

  if (tags) {
    formatted += `Tags: ${tags}\n`;
  }

  if (themes) {
    formatted += `Key Takeaways:\n– ${themes}\n`;
  }

  return formatted;
}