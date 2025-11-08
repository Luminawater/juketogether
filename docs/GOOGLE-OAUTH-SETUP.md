# Google OAuth Setup Guide

This guide will help you configure Google OAuth authentication for the Jukebox application.

## Google OAuth Credentials

You have already created a Google OAuth client with the following credentials:

- **Client ID**: `YOUR_CLIENT_ID.apps.googleusercontent.com` (replace with your actual Client ID)
- **Client Secret**: `YOUR_CLIENT_SECRET` (replace with your actual Client Secret)
- **API Key**: `YOUR_API_KEY` (replace with your actual API Key)

## Step 1: Configure Google OAuth in Supabase

1. Go to your Supabase Dashboard: https://supabase.com/dashboard
2. Select your project: **juxebox** (smryjxchwbfpjvpecffg)
3. Navigate to **Authentication** → **Providers**
4. Find **Google** in the list and click to enable it
5. Enter your Google OAuth credentials:
   - **Client ID (for OAuth)**: `YOUR_CLIENT_ID.apps.googleusercontent.com` (replace with your actual Client ID)
   - **Client Secret (for OAuth)**: `YOUR_CLIENT_SECRET` (replace with your actual Client Secret)
6. The **Redirect URL** should be automatically set to: `https://smryjxchwbfpjvpecffg.supabase.co/auth/v1/callback`
7. Click **Save**

## Step 2: Configure Authorized Redirect URIs in Google Cloud Console

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Navigate to **APIs & Services** → **Credentials**
3. Find your OAuth 2.0 Client ID: `YOUR_CLIENT_ID.apps.googleusercontent.com` (replace with your actual Client ID)
4. Click on the client ID to edit it
5. Under **Authorized redirect URIs**, add:
   - `https://smryjxchwbfpjvpecffg.supabase.co/auth/v1/callback`
6. Under **Authorized JavaScript origins**, add:
   - `https://smryjxchwbfpjvpecffg.supabase.co`
   - Your app's web URL (e.g., `https://juketogether.com` or your Vercel deployment URL)
   - For local development: `http://localhost:8080` (if testing locally)
7. Click **Save**

## Step 3: OAuth Consent Screen (Important)

⚠️ **Note**: OAuth is limited to 100 sensitive scope logins until the OAuth consent screen is verified. This may require a verification process that can take several days.

1. Go to **APIs & Services** → **OAuth consent screen**
2. Make sure your app information is complete:
   - **App name**: `juketogether`
   - **User support email**: Your email
   - **Developer contact information**: Your email
3. Add scopes (if needed):
   - `email`
   - `profile`
   - `openid`
4. Add test users (for testing before verification)
5. Submit for verification if you need more than 100 users

## Step 4: Test Google OAuth

1. Start your app
2. Navigate to the Auth screen
3. Click "Continue with Google"
4. You should be redirected to Google's sign-in page
5. After signing in, you should be redirected back to the app

## Troubleshooting

### Error: "redirect_uri_mismatch"
- Make sure the redirect URI in Google Cloud Console exactly matches: `https://smryjxchwbfpjvpecffg.supabase.co/auth/v1/callback`
- Check for trailing slashes or typos

### Error: "access_denied"
- Check that the OAuth consent screen is properly configured
- If in testing mode, make sure your email is added as a test user

### OAuth not working on mobile
- For React Native/Expo apps, you may need to configure deep linking
- Check that your app's URL scheme is properly configured in `app.json`

## Security Notes

- **Never commit** the Client Secret to version control
- Store sensitive credentials in environment variables
- The Client Secret shown in the dialog cannot be viewed again after closing it (starting June 2025)
- Make sure you have securely stored the Client Secret

