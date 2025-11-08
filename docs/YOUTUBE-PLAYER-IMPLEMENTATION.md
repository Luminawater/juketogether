# YouTube Player Implementation - Responsive & Supabase-Synced

## Overview

A responsive YouTube player component has been implemented that syncs with Supabase as the source of truth for playback state. The player works on both mobile (iOS/Android) and web platforms.

## Architecture

### Source of Truth: Supabase
- **Supabase Table**: `rooms` table stores:
  - `is_playing`: Boolean (play/pause state)
  - `position`: Integer (milliseconds)
  - `current_track`: JSON (current track object)
  - `queue`: JSON array (queued tracks)
  - `history`: JSON array (played tracks)

### Server (server.js)
- Listens to Socket.io events
- Updates room state in memory
- Saves to Supabase (source of truth)
- Broadcasts via Socket.io:
  - `play-track`: Play command
  - `pause-track`: Pause command
  - `seek-track`: Seek to position
  - `sync-all-users`: Sync all users to position
  - `room-state`: Full room state update

### Client (Mobile App)
- **YouTubePlayer Component**: 
  - Uses WebView with YouTube IFrame API
  - Listens to Supabase state via Socket.io
  - Reports position updates back to server
  - Syncs play/pause/seek to Supabase state

## Implementation Details

### YouTubePlayer Component (`src/components/YouTubePlayer.tsx`)

**Features:**
- ✅ Responsive design (16:9 aspect ratio)
- ✅ WebView-based YouTube embed
- ✅ YouTube IFrame API integration
- ✅ Position reporting (every second)
- ✅ Play/pause/seek control
- ✅ Syncs to Supabase position
- ✅ Handles state changes (playing/paused/ended/buffering)

**Key Functions:**
1. **Extract Video ID**: Parses YouTube URLs to get video ID
2. **WebView HTML**: Embeds YouTube IFrame API with responsive design
3. **Message Handling**: Communicates with WebView via postMessage
4. **Position Sync**: Syncs to Supabase position when it changes
5. **State Sync**: Responds to play/pause commands from Supabase

### Integration in RoomScreen

**Socket Event Handlers:**
- `seek-track`: Updates position from Supabase
- `sync-all-users`: Syncs all users to Supabase position
- `play-track`: Plays video (handled by YouTubePlayer)
- `pause-track`: Pauses video (handled by YouTubePlayer)
- `room-state`: Updates full state including position

**Position Updates:**
- YouTube player reports position every second via `onPositionUpdate`
- Position is sent to server via `sync-position` event
- Server saves to Supabase
- Other clients receive `seek-track` if position differs significantly (>5 seconds)

## How It Works

### 1. Track Loads
```
User adds YouTube URL → Server saves to Supabase → 
Socket broadcasts room-state → Client receives state → 
YouTubePlayer loads video → Syncs to Supabase position
```

### 2. Playback Control
```
Owner clicks Play → Server updates Supabase (is_playing=true) → 
Socket broadcasts play-track → All clients receive → 
YouTubePlayer plays video
```

### 3. Position Sync
```
YouTube player reports position → Client sends to server → 
Server saves to Supabase → If position differs >5s → 
Server broadcasts seek-track → Other clients sync
```

### 4. User Syncs
```
User clicks Sync → Client gets current position → 
Sends sync-all-users → Server saves to Supabase → 
Server broadcasts sync-all-users → All clients sync
```

## Responsive Design

The player maintains a 16:9 aspect ratio and is responsive:
- **Mobile**: Full width, appropriate height
- **Web**: Full width, maintains aspect ratio
- **Tablet**: Scales appropriately

## Platform Support

- ✅ **iOS**: WebView with YouTube embed
- ✅ **Android**: WebView with YouTube embed  
- ✅ **Web**: Uses existing YouTube IFrame API (separate implementation)

## Supabase as Source of Truth

All platforms (YouTube, Spotify, SoundCloud) must:
1. **Listen** to Supabase state via Socket.io
2. **Sync** local player to Supabase state
3. **Report** position updates to server (saves to Supabase)
4. **Respond** to play/pause/seek commands from Supabase

### Example Flow:
```
Supabase: { is_playing: true, position: 30000 }
    ↓
Server broadcasts: play-track, seek-track(30000)
    ↓
All clients receive events
    ↓
YouTubePlayer: plays video, seeks to 30s
SpotifyPlayer: plays track, seeks to 30s
SoundCloudPlayer: plays track, seeks to 30s
```

## Testing Checklist

- [ ] YouTube URL can be added to queue
- [ ] YouTube player loads when track is current
- [ ] Player responds to play command from Supabase
- [ ] Player responds to pause command from Supabase
- [ ] Player syncs to position from Supabase
- [ ] Position updates are sent to server
- [ ] Position is saved to Supabase
- [ ] Other users sync when position changes
- [ ] Sync button works correctly
- [ ] Player works on iOS
- [ ] Player works on Android
- [ ] Player works on Web
- [ ] Responsive design works on all screen sizes

## Files Modified

1. **`src/components/YouTubePlayer.tsx`** (NEW)
   - Responsive YouTube player component
   - WebView with YouTube IFrame API
   - Supabase state synchronization

2. **`src/screens/RoomScreen.tsx`** (MODIFIED)
   - Added YouTubePlayer import
   - Added socket event handlers for seek-track and sync-all-users
   - Integrated YouTubePlayer in render
   - Added position update handler
   - Added youtubePlayerContainer style

## Next Steps

1. Test on iOS device/simulator
2. Test on Android device/emulator
3. Test on Web browser
4. Verify Supabase synchronization
5. Test with multiple users
6. Verify position sync accuracy
7. Test error handling

## Notes

- WebView is available via Expo (react-native-webview)
- YouTube IFrame API is loaded in WebView HTML
- Position updates are debounced (only sent if >500ms difference)
- Seek operations are debounced (only sync if >2s difference)
- Supabase position is in milliseconds
- YouTube API uses seconds (converted in component)

