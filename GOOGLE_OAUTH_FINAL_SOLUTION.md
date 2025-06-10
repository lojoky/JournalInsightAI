# Google OAuth Setup - Final Solution

## The Problem
Your Google Docs integration is failing because the redirect URI in your Google Cloud Console doesn't match your deployed app domain.

## Exact Steps to Fix

### 1. Open Google Cloud Console
Go to: https://console.cloud.google.com/apis/credentials

### 2. Find Your OAuth Client
Look for your OAuth 2.0 Client ID in the credentials list

### 3. Add This Exact Redirect URI
```
https://journal-ai-insights.replit.app/api/auth/google/callback
```

### 4. Important Notes
- The URI must be **EXACTLY** as shown above
- No trailing slash
- Must use HTTPS
- Case sensitive
- Wait 5-10 minutes after saving for changes to propagate

## Verification
After adding the redirect URI, test the integration again. The system now includes:
- Enhanced error logging
- Proper session handling for HTTPS
- Detailed diagnostic information

## Alternative Domains
If you're using a different domain, the redirect URI format is:
```
https://YOUR-DOMAIN/api/auth/google/callback
```

Replace YOUR-DOMAIN with your actual deployed domain.

## Common Mistakes
- Using HTTP instead of HTTPS
- Adding trailing slashes
- Using the wrong domain (internal vs public)
- Not waiting for Google's changes to propagate