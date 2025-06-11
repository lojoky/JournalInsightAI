# Google OAuth Setup Instructions

## Current Issue
The Google Docs integration is failing with a 500 error due to a redirect URI mismatch in your Google Cloud Console configuration.

## Solution
Add this exact redirect URI to your Google Cloud Console:

```
https://journal-ai-insights.replit.app/api/auth/google/callback
```

## Steps to Fix:

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Navigate to **APIs & Services** > **Credentials**
3. Find your OAuth 2.0 Client ID
4. Click to edit it
5. In the "Authorized redirect URIs" section, add:
   ```
   https://journal-ai-insights.replit.app/api/auth/google/callback
   ```
6. Save the changes

## Why This Happens
Replit generates dynamic domains for deployments. When your app domain changes, the OAuth redirect URI must be updated in Google Cloud Console to match the new domain.

## After Fixing
Once you've added the correct redirect URI, the Google Docs integration will work properly and you'll be able to sync your journal entries to Google Docs.