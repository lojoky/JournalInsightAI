import { google } from 'googleapis';
import { OAuth2Client } from 'google-auth-library';
import type { JournalEntryWithDetails } from '@shared/schema';

export function createGoogleClient(accessToken: string, refreshToken: string) {
  const oauth2Client = new OAuth2Client(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    'urn:ietf:wg:oauth:2.0:oob' // For installed applications
  );
  
  oauth2Client.setCredentials({
    access_token: accessToken,
    refresh_token: refreshToken
  });
  
  return oauth2Client;
}

export async function createJournalFolder(auth: OAuth2Client, folderName: string = 'Journal Entries') {
  const drive = google.drive({ version: 'v3', auth });
  
  try {
    // Check if folder already exists
    const existingFolders = await drive.files.list({
      q: `name='${folderName}' and mimeType='application/vnd.google-apps.folder' and trashed=false`,
      fields: 'files(id, name)'
    });
    
    if (existingFolders.data.files && existingFolders.data.files.length > 0) {
      return existingFolders.data.files[0];
    }
    
    // Create new folder
    const folderMetadata = {
      name: folderName,
      mimeType: 'application/vnd.google-apps.folder'
    };
    
    const folder = await drive.files.create({
      requestBody: folderMetadata,
      fields: 'id, name'
    });
    
    return folder.data;
  } catch (error) {
    console.error('Error creating/finding Google Drive folder:', error);
    throw error;
  }
}

export async function createJournalDocument(
  auth: OAuth2Client,
  entry: JournalEntryWithDetails,
  folderId: string,
  entryDate?: string
) {
  const docs = google.docs({ version: 'v1', auth });
  const drive = google.drive({ version: 'v3', auth });
  
  try {
    // Format the date for the document title
    const displayDate = entryDate ? new Date(entryDate).toLocaleDateString() : new Date(entry.createdAt).toLocaleDateString();
    const docTitle = `${entry.title || 'Journal Entry'} - ${displayDate}`;
    
    // Create the document
    const doc = await docs.documents.create({
      requestBody: {
        title: docTitle
      }
    });
    
    if (!doc.data.documentId) {
      throw new Error('Failed to create document');
    }
    
    // Move document to the journal folder
    await drive.files.update({
      fileId: doc.data.documentId,
      addParents: folderId,
      removeParents: 'root',
      fields: 'id, parents'
    });
    
    // Prepare content for the document
    const requests: any[] = [];
    let insertIndex = 1;
    
    // Add title
    requests.push({
      insertText: {
        location: { index: insertIndex },
        text: `${entry.title || 'Journal Entry'}\n\n`
      }
    });
    insertIndex += (entry.title || 'Journal Entry').length + 2;
    
    // Add date
    const dateText = `Date: ${displayDate}\n\n`;
    requests.push({
      insertText: {
        location: { index: insertIndex },
        text: dateText
      }
    });
    insertIndex += dateText.length;
    
    // Add tags if available
    if (entry.tags && entry.tags.length > 0) {
      const tagsText = `Tags: ${entry.tags.map(tag => tag.name).join(', ')}\n\n`;
      requests.push({
        insertText: {
          location: { index: insertIndex },
          text: tagsText
        }
      });
      insertIndex += tagsText.length;
    }
    
    // Add main content
    if (entry.transcribedText) {
      const contentText = `${entry.transcribedText}\n\n`;
      requests.push({
        insertText: {
          location: { index: insertIndex },
          text: contentText
        }
      });
      insertIndex += contentText.length;
    }
    
    // Add themes if available
    if (entry.themes && entry.themes.length > 0) {
      const themesHeader = "Key Themes:\n";
      requests.push({
        insertText: {
          location: { index: insertIndex },
          text: themesHeader
        }
      });
      insertIndex += themesHeader.length;
      
      for (const theme of entry.themes) {
        const themeText = `• ${theme.title}: ${theme.description}\n`;
        requests.push({
          insertText: {
            location: { index: insertIndex },
            text: themeText
          }
        });
        insertIndex += themeText.length;
      }
      
      requests.push({
        insertText: {
          location: { index: insertIndex },
          text: "\n"
        }
      });
      insertIndex += 1;
    }
    
    // Add image reference if available
    if (entry.originalImageUrl) {
      const imageText = `\nOriginal Image: ${entry.originalImageUrl}\n`;
      requests.push({
        insertText: {
          location: { index: insertIndex },
          text: imageText
        }
      });
      insertIndex += imageText.length;
    }
    
    // Apply formatting
    const titleEndIndex = (entry.title || 'Journal Entry').length + 1;
    requests.push({
      updateTextStyle: {
        range: {
          startIndex: 1,
          endIndex: titleEndIndex
        },
        textStyle: {
          bold: true,
          fontSize: {
            magnitude: 16,
            unit: 'PT'
          }
        },
        fields: 'bold,fontSize'
      }
    });
    
    // Update the document with content
    if (requests.length > 0) {
      await docs.documents.batchUpdate({
        documentId: doc.data.documentId,
        requestBody: {
          requests: requests
        }
      });
    }
    
    return {
      documentId: doc.data.documentId,
      title: docTitle,
      url: `https://docs.google.com/document/d/${doc.data.documentId}/edit`
    };
    
  } catch (error) {
    console.error('Error creating Google Doc:', error);
    throw error;
  }
}

export async function updateJournalDocument(
  auth: OAuth2Client,
  documentId: string,
  entry: JournalEntryWithDetails,
  entryDate?: string
) {
  const docs = google.docs({ version: 'v1', auth });
  
  try {
    // Get the current document to find where to insert new content
    const doc = await docs.documents.get({
      documentId: documentId
    });
    
    if (!doc.data.body || !doc.data.body.content) {
      throw new Error('Document content not found');
    }
    
    // Find the end of the document
    const endIndex = doc.data.body.content[doc.data.body.content.length - 1]?.endIndex || 1;
    
    // Prepare update requests
    const requests: any[] = [];
    
    // Add updated content
    const updateText = `\n--- Updated ${new Date().toLocaleDateString()} ---\n`;
    requests.push({
      insertText: {
        location: { index: endIndex - 1 },
        text: updateText
      }
    });
    
    if (entry.transcribedText) {
      requests.push({
        insertText: {
          location: { index: endIndex - 1 + updateText.length },
          text: `${entry.transcribedText}\n`
        }
      });
    }
    
    // Update the document
    if (requests.length > 0) {
      await docs.documents.batchUpdate({
        documentId: documentId,
        requestBody: {
          requests: requests
        }
      });
    }
    
    return {
      documentId: documentId,
      url: `https://docs.google.com/document/d/${documentId}/edit`
    };
    
  } catch (error) {
    console.error('Error updating Google Doc:', error);
    throw error;
  }
}

export async function getAuthUrl(clientId: string, clientSecret: string) {
  const oauth2Client = new OAuth2Client(
    clientId,
    clientSecret,
    'urn:ietf:wg:oauth:2.0:oob'
  );
  
  const scopes = [
    'https://www.googleapis.com/auth/documents',
    'https://www.googleapis.com/auth/drive.file'
  ];
  
  const url = oauth2Client.generateAuthUrl({
    access_type: 'offline',
    scope: scopes,
    prompt: 'consent'
  });
  
  return url;
}

export async function exchangeCodeForTokens(
  clientId: string,
  clientSecret: string,
  code: string
) {
  const oauth2Client = new OAuth2Client(
    clientId,
    clientSecret,
    'urn:ietf:wg:oauth:2.0:oob'
  );
  
  const { tokens } = await oauth2Client.getToken(code);
  return tokens;
}