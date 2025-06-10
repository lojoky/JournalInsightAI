import { google } from 'googleapis';
import { OAuth2Client } from 'google-auth-library';
import type { JournalEntryWithDetails } from '@shared/schema';

export function createGoogleClient(accessToken: string, refreshToken: string) {
  const oauth2Client = new OAuth2Client(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    'http://localhost:5000/api/auth/google/callback' // For web applications
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

export async function findOrCreateSharedJournalDocument(
  auth: OAuth2Client,
  folderId: string,
  documentTitle: string = "My Journal"
) {
  const docs = google.docs({ version: 'v1', auth });
  const drive = google.drive({ version: 'v3', auth });
  
  try {
    // Search for existing journal document in the folder
    const existingDocs = await drive.files.list({
      q: `name='${documentTitle}' and parents in '${folderId}' and mimeType='application/vnd.google-apps.document' and trashed=false`,
      fields: 'files(id, name)'
    });
    
    if (existingDocs.data.files && existingDocs.data.files.length > 0) {
      const existingDoc = existingDocs.data.files[0];
      return {
        documentId: existingDoc.id!,
        title: existingDoc.name!,
        url: `https://docs.google.com/document/d/${existingDoc.id}/edit`,
        isNew: false
      };
    }
    
    // Create new shared document
    const doc = await docs.documents.create({
      requestBody: {
        title: documentTitle
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
    
    // Add initial content to new document
    const requests = [
      {
        insertText: {
          location: { index: 1 },
          text: `${documentTitle}\n\nThis document contains all your journal entries, automatically synchronized from your journal app.\n\n`
        }
      },
      {
        updateTextStyle: {
          range: {
            startIndex: 1,
            endIndex: documentTitle.length + 1
          },
          textStyle: {
            bold: true,
            fontSize: {
              magnitude: 20,
              unit: 'PT'
            }
          },
          fields: 'bold,fontSize'
        }
      }
    ];
    
    await docs.documents.batchUpdate({
      documentId: doc.data.documentId,
      requestBody: { requests }
    });
    
    return {
      documentId: doc.data.documentId,
      title: documentTitle,
      url: `https://docs.google.com/document/d/${doc.data.documentId}/edit`,
      isNew: true
    };
    
  } catch (error) {
    console.error('Error creating/finding shared Google Doc:', error);
    throw error;
  }
}

export async function addEntryToSharedDocument(
  auth: OAuth2Client,
  documentId: string,
  entry: JournalEntryWithDetails,
  entryDate?: string
) {
  const docs = google.docs({ version: 'v1', auth });
  
  try {
    // Get current document to find insertion point
    const doc = await docs.documents.get({ documentId });
    
    if (!doc.data.body || !doc.data.body.content) {
      throw new Error('Document content not found');
    }
    
    // Find the end of the document
    let endIndex = 1;
    for (const element of doc.data.body.content) {
      if (element.endIndex) {
        endIndex = Math.max(endIndex, element.endIndex);
      }
    }
    
    // Format the date for the entry
    const displayDate = entryDate ? new Date(entryDate).toLocaleDateString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    }) : new Date(entry.createdAt).toLocaleDateString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
    
    // Build entry content
    let entryContent = `\n${entry.title || 'Journal Entry'}\n`;
    entryContent += `${displayDate}\n\n`;
    
    if (entry.transcribedText) {
      entryContent += `${entry.transcribedText}\n\n`;
    }
    
    if (entry.themes && entry.themes.length > 0) {
      entryContent += `Key Themes:\n`;
      for (const theme of entry.themes) {
        entryContent += `• ${theme.title}: ${theme.description}\n`;
      }
      entryContent += `\n`;
    }
    
    if (entry.tags && entry.tags.length > 0) {
      entryContent += `Tags: ${entry.tags.map(tag => `#${tag.name}`).join(' ')}\n\n`;
    }
    
    entryContent += `---\n\n`;
    
    // Prepare requests
    const requests: any[] = [];
    const titleStart = endIndex - 1;
    const titleEnd = titleStart + (entry.title || 'Journal Entry').length + 1;
    
    // Insert the content
    requests.push({
      insertText: {
        location: { index: endIndex - 1 },
        text: entryContent
      }
    });
    
    // Format the title
    requests.push({
      updateTextStyle: {
        range: {
          startIndex: titleStart + 1,
          endIndex: titleEnd
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
    
    // Update the document
    await docs.documents.batchUpdate({
      documentId,
      requestBody: { requests }
    });
    
    return {
      documentId,
      url: `https://docs.google.com/document/d/${documentId}/edit`
    };
    
  } catch (error) {
    console.error('Error adding entry to shared Google Doc:', error);
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
  // Get the current host from environment or default to localhost
  const baseUrl = process.env.REPLIT_DOMAINS ? 
    `https://${process.env.REPLIT_DOMAINS.split(',')[0]}` : 
    'http://localhost:5000';
  
  const redirectUri = `${baseUrl}/api/auth/google/callback`;
  
  const oauth2Client = new OAuth2Client(
    clientId,
    clientSecret,
    redirectUri
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
  
  console.log('Generated Google auth URL with redirect:', redirectUri);
  return url;
}

export async function exchangeCodeForTokens(
  clientId: string,
  clientSecret: string,
  code: string
) {
  try {
    // Get the current host from environment or default to localhost
    const baseUrl = process.env.REPLIT_DOMAINS ? 
      `https://${process.env.REPLIT_DOMAINS.split(',')[0]}` : 
      'http://localhost:5000';
    
    const redirectUri = `${baseUrl}/api/auth/google/callback`;
    
    console.log('Token exchange parameters:', {
      clientId: clientId.substring(0, 20) + '...',
      redirectUri,
      codeLength: code.length
    });
    
    const oauth2Client = new OAuth2Client(
      clientId,
      clientSecret,
      redirectUri
    );
    
    const { tokens } = await oauth2Client.getToken(code);
    
    console.log('Token exchange successful:', {
      hasAccessToken: !!tokens.access_token,
      hasRefreshToken: !!tokens.refresh_token,
      accessTokenLength: tokens.access_token?.length,
      refreshTokenLength: tokens.refresh_token?.length,
      tokenType: tokens.token_type,
      scope: tokens.scope
    });
    
    return tokens;
  } catch (error: any) {
    console.error('Token exchange failed:', {
      error: error?.message,
      code: error?.code,
      status: error?.status,
      details: error?.response?.data || error?.response
    });
    
    // Re-throw with more context
    if (error?.message?.includes('invalid_grant')) {
      throw new Error('Authorization code expired or already used. Please restart the authorization process.');
    } else if (error?.message?.includes('redirect_uri_mismatch')) {
      const baseUrl = process.env.REPLIT_DOMAINS ? 
        `https://${process.env.REPLIT_DOMAINS.split(',')[0]}` : 
        'http://localhost:5000';
      const correctRedirectUri = `${baseUrl}/api/auth/google/callback`;
      throw new Error(`OAuth redirect URI mismatch. Add this exact URI to your Google Cloud Console: ${correctRedirectUri}`);
    } else {
      throw new Error(`Google OAuth token exchange failed: ${error?.message || 'Unknown error'}`);
    }
  }
}