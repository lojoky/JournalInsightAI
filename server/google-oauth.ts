import { google } from 'googleapis';
import { OAuth2Client } from 'google-auth-library';

export const GOOGLE_SCOPES = [
  'https://www.googleapis.com/auth/documents',
  'https://www.googleapis.com/auth/drive.file'
];

export function createGoogleOAuthClient(): OAuth2Client {
  // Use environment variable or construct from request host
  const redirectUri = process.env.GOOGLE_REDIRECT_URI || 
    `${process.env.REPLIT_DOMAINS ? 'https://' + process.env.REPLIT_DOMAINS.split(',')[0] : 'http://localhost:5000'}/api/google/auth/callback`;
    
  return new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    redirectUri
  );
}

export function generateAuthUrl(state?: string): string {
  const oauth2Client = createGoogleOAuthClient();
  
  return oauth2Client.generateAuthUrl({
    access_type: 'offline',
    scope: GOOGLE_SCOPES,
    state: state,
    prompt: 'consent'
  });
}

export async function exchangeCodeForTokens(code: string) {
  const oauth2Client = createGoogleOAuthClient();
  
  try {
    const { tokens } = await oauth2Client.getToken(code);
    return tokens;
  } catch (error) {
    console.error('Error exchanging code for tokens:', error);
    throw new Error('Failed to exchange authorization code for tokens');
  }
}

export function createAuthorizedClient(credentials: any): OAuth2Client {
  const oauth2Client = createGoogleOAuthClient();
  oauth2Client.setCredentials(credentials);
  return oauth2Client;
}

export async function refreshAccessToken(refreshToken: string) {
  const oauth2Client = createGoogleOAuthClient();
  oauth2Client.setCredentials({ refresh_token: refreshToken });
  
  try {
    const { credentials } = await oauth2Client.refreshAccessToken();
    return credentials;
  } catch (error) {
    console.error('Error refreshing access token:', error);
    throw new Error('Failed to refresh access token');
  }
}

export async function validateTokens(credentials: any): Promise<boolean> {
  try {
    const oauth2Client = createAuthorizedClient(credentials);
    await oauth2Client.getAccessToken();
    return true;
  } catch (error) {
    console.error('Token validation failed:', error);
    return false;
  }
}