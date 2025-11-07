# Spotify App Setup Guide

This guide will help you create and configure your Spotify app for the Junkbox application.

## Two Types of Spotify Integration

This app uses Spotify in two ways:

1. **Spotify OAuth for User Authentication** (via Supabase) - Users can sign in with their Spotify account
2. **Spotify Web API & Playback SDK** - For playing music and accessing Spotify's music library

## Part 1: Spotify OAuth for User Authentication (Supabase)

### Step 1: Configure Spotify OAuth in Supabase

1. Go to your Supabase Dashboard: https://supabase.com/dashboard
2. Navigate to **Authentication** → **Providers**
3. Find **Spotify** and enable it
4. Enter your Spotify credentials:
   - **Client ID**: `7093abd25f5146e9aa57daf7b8106bb8`
   - **Client Secret**: `f86ce7bf9556475c8569f0a39a655568`
5. The **Redirect URL** should be: `https://smryjxchwbfpjvpecffg.supabase.co/auth/v1/callback`

### Step 2: Configure Redirect URI in Spotify Developer Dashboard

1. Go to [Spotify Developer Dashboard](https://developer.spotify.com/dashboard)
2. Find your app (or create a new one)
3. In **Redirect URIs**, add:
   - `https://smryjxchwbfpjvpecffg.supabase.co/auth/v1/callback`

**Note**: This is the Supabase callback URL, not your app's URL. Supabase handles the OAuth flow.

## Part 2: Spotify Web API for Music Playback

### Step 1: Create Spotify App in Developer Dashboard

Go to [Spotify Developer Dashboard](https://developer.spotify.com/dashboard) and create a new app (or use the same one from Part 1) with the following details:

### App Information

- **App name**: `Junkbox`
- **App description**: `Play music together`
- **Website**: (Optional - you can leave blank or add your domain if you have one)
- **Redirect URIs**: 
  - For local development: `http://localhost:8080/spotify/callback`
  - For production/ngrok: `https://YOUR-NGROK-URL.ngrok.io/spotify/callback`
  - **Important**: You can add multiple redirect URIs. Add both localhost and your ngrok URL.
  - **Also add**: `https://smryjxchwbfpjvpecffg.supabase.co/auth/v1/callback` (for Supabase OAuth)

### Which API/SDKs are you planning to use?

Check the following:
- ✅ **Web API** - Required for fetching track metadata and controlling playback
- ✅ **Web Playback SDK** - Required for playing music in the browser

## Step 2: Get Your Credentials

After creating the app, you'll see:
- **Client ID** - Copy this (you already have: `7093abd25f5146e9aa57daf7b8106bb8`)
- **Client Secret** - Click "Show" and copy this (you already have: `f86ce7bf9556475c8569f0a39a655568`)

## Step 3: Configure Environment Variables

Create a `.env` file in the root of your project (or set environment variables) with:

```env
# Spotify Web API credentials (for music playback)
SPOTIFY_CLIENT_ID=7093abd25f5146e9aa57daf7b8106bb8
SPOTIFY_CLIENT_SECRET=f86ce7bf9556475c8569f0a39a655568
SPOTIFY_REDIRECT_URI=http://localhost:8080/spotify/callback
```

**For production/ngrok**, update `SPOTIFY_REDIRECT_URI` to match your ngrok URL:
```env
SPOTIFY_REDIRECT_URI=https://your-ngrok-url.ngrok.io/spotify/callback
```

## Step 4: Update Redirect URI in Spotify Dashboard

**Important**: The redirect URI in your Spotify app settings must **exactly match** the `SPOTIFY_REDIRECT_URI` environment variable (or the default constructed from your host).

### For Local Development:
- Add to Redirect URIs: `http://localhost:8080/spotify/callback`

### For Production/ngrok:
1. Start your server and ngrok
2. Copy your ngrok URL (e.g., `https://abc123.ngrok.io`)
3. Add to Redirect URIs in Spotify Dashboard: `https://abc123.ngrok.io/spotify/callback`
4. Update your `.env` file with the same URL

**Note**: If your ngrok URL changes, you'll need to update both the Spotify Dashboard and your `.env` file.

## Step 5: Test the Integration

### Test Spotify OAuth Sign-In (User Authentication)

1. Start your server: `npm start` or `npm run dev`
2. Open your app in the browser
3. Go to `/auth.html` or click the sign-in button
4. Click "Continue with Spotify" button
5. You should be redirected to Spotify to authorize
6. After authorization, you'll be redirected back and signed in

### Test Spotify Music Playback

1. Make sure you're signed in (via Spotify OAuth or email/password)
2. The app will automatically use Spotify Web Playback SDK when you add Spotify tracks
3. Try adding a Spotify track URL to test playback

## Troubleshooting

### "Invalid redirect URI" error (OAuth Sign-In)
- Make sure the redirect URI in Spotify Dashboard includes: `https://smryjxchwbfpjvpecffg.supabase.co/auth/v1/callback`
- This is the Supabase callback URL, not your app's URL
- Check your Supabase Dashboard → Authentication → Providers → Spotify settings

### "Invalid redirect URI" error (Music Playback)
- Make sure the redirect URI in Spotify Dashboard **exactly matches** your `SPOTIFY_REDIRECT_URI` environment variable
- Check for trailing slashes, http vs https, and port numbers
- The redirect URI must be one of the URIs you added in the Spotify Dashboard

### "Spotify credentials not configured" error
- Make sure your `.env` file exists and contains `SPOTIFY_CLIENT_ID` and `SPOTIFY_CLIENT_SECRET`
- Restart your server after adding environment variables
- For OAuth sign-in, also check Supabase Dashboard → Authentication → Providers → Spotify

### Token expires
- The app handles token refresh automatically
- If you see authentication errors, you may need to re-authenticate
- For OAuth sign-in, users will need to sign in again if their session expires

### Spotify OAuth button doesn't work
- Check browser console for errors
- Verify Supabase Spotify provider is enabled in Supabase Dashboard
- Make sure the redirect URI in Spotify Dashboard matches the Supabase callback URL

## Security Notes

- **Never commit your `.env` file** to version control
- Keep your Client Secret secure
- The redirect URI helps prevent unauthorized access - always use HTTPS in production

