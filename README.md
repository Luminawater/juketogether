# SoundCloud Jukebox

## What We're Building

We're creating a collaborative SoundCloud listening room for people who are in different locations but want to listen to music together in real-time.

**The Problem:**
- You and your friend(s) are in different places
- You want to share and listen to SoundCloud tracks together
- You want everyone to hear the same song at the same time, synchronized

**The Solution:**
A web app where:
- Multiple users can join the same "room" via a shared link
- Anyone can paste a SoundCloud link and add it to a shared queue
- When a track plays, everyone in the room hears it at the same time
- Play, pause, and skip controls are synchronized for all users
- Perfect for long-distance listening parties, DJ sessions, or just hanging out with friends

**Use Cases:**
- 🎧 Long-distance listening parties
- 🎵 Collaborative DJ sessions
- 👥 Group music discovery
- 🎪 Virtual hangouts with synchronized music

## Features

- 🎵 Real-time synchronized playback
- 👥 Multiple users in the same room
- 📋 Shared queue management
- 🎛️ Play/pause controls synchronized across all users
- ⏭️ Skip to next track
- 🔗 Add any SoundCloud track or playlist URL

## Setup

1. **Install dependencies:**
   ```bash
   npm install
   ```

2. **Start the app (simple - one command):**
   ```bash
   # Windows PowerShell (recommended)
   .\start.ps1
   
   # Windows CMD
   start.bat
   ```
   
   This starts the server (with auto-reload) and ngrok in one window!
   **Changes to code will automatically reload - no server restart needed!**
   
   **Or start manually:**
   ```bash
   # Terminal 1: Start server (with auto-reload)
   npm run dev
   # or
   npm start
   
   # Terminal 2: Start ngrok
   npx --yes ngrok http 8080
   ```
   
   The server will run on `http://localhost:8080`

3. **Expose to the internet:**
   
   **Option 1: Using ngrok (recommended - NO PASSWORD!):**
   ```bash
   # First time setup (one-time):
   .\setup-ngrok.ps1
   
   # Or manually:
   # 1. Sign up at https://dashboard.ngrok.com/signup
   # 2. Get authtoken from https://dashboard.ngrok.com/get-started/your-authtoken
   # 3. Run: npx --yes ngrok config add-authtoken YOUR_TOKEN
   # 4. Run: npx --yes ngrok http 8080
   ```
   ✅ **No password required!** Free account needed (one-time setup)
   
   **Option 2: Using localtunnel (no account, but shows password page):**
   ```bash
   npx --yes localtunnel --port 3001
   ```
   ⚠️ **Note:** Visitors will see a password page (once per IP every 7 days)
   - Password is your public IP: `curl https://loca.lt/mytunnelpassword`
   - Share both URL and password with visitors
   - Or use browser extension "ModHeader" to bypass (see BYPASS-INSTRUCTIONS.md)
   
   **Option 3: Using cloudflared (may not work on corporate networks):**
   ```bash
   npx --yes cloudflared tunnel --url http://localhost:8080
   ```
   
   **Quick scripts:**
   ```bash
   # Windows PowerShell
   .\expose.ps1
   
   # Windows CMD
   expose.bat
   ```

4. **Copy the public URL** shown in the terminal and share it with others to let them join!

## Usage

1. Open the app in your browser (via ngrok URL)
2. Paste a SoundCloud track or playlist URL in the input field
3. Click "Add to Queue" or press Enter
4. The track will be added to the queue and play for everyone in the room
5. All users can control playback (play/pause/next) and it syncs in real-time

## Room System

- By default, everyone joins the same room (`default-room`)
- To create separate rooms, add `?room=your-room-name` to the URL
- Example: `https://your-ngrok-url.ngrok.io?room=party-room`

## Technical Details

- **Backend**: Node.js with Express and Socket.io
- **Frontend**: Vanilla JavaScript with SoundCloud Widget API
- **Real-time sync**: WebSocket connections via Socket.io
- **No SoundCloud API key required**: Uses SoundCloud's public embed widget

## Notes

- The app uses SoundCloud's embed widget
- **Public tracks**: Work automatically
- **Private/shared tracks**: May work if the track owner has enabled embedding. If a private track doesn't play, the owner needs to enable "Allow embedding" in their SoundCloud track settings
- Playlists are supported but will play the first track
- All users in a room share the same queue and playback state
- Rooms are cleaned up automatically after 5 minutes of being empty

## Troubleshooting

### App Issues
- If tracks don't play, make sure they're publicly available on SoundCloud
- If sync is off, check your internet connection
- Clear browser cache if the widget doesn't load

### Tunnel/Network Issues
- **Certificate verification error with cloudflared?** (Corporate network/proxy)
  - Use localtunnel instead: `npx --yes localtunnel --port 3000`
  - Or try cloudflared with verification disabled: `.\expose-cloudflared-skip-verify.ps1`
  - Get localtunnel password: `curl https://loca.lt/mytunnelpassword`
  
- **Localtunnel requires password?**
  - This is normal. Get your password with: `curl https://loca.lt/mytunnelpassword`
  - Share both the URL and password with visitors
  
- **Alternative: Use ngrok** (requires free account at https://ngrok.com)
  ```bash
  npx --yes ngrok http 3000
  ```

## License

MIT

