# YouTube Playback Status & Implementation Guide

## Current Status

### ✅ What Works
1. **YouTube URL Detection**: The app correctly identifies YouTube URLs in the queue
2. **YouTube URL Parsing**: URLs are properly extracted and normalized
3. **UI Display**: YouTube tracks show with YouTube icon and platform badge
4. **Web Version**: YouTube playback works on web using YouTube IFrame API (`public/js/modules/youtube-manager.js`)

### ❌ What Doesn't Work
1. **Mobile YouTube Playback**: YouTube videos cannot be played in the mobile app (iOS/Android)
2. **DJ Mode**: YouTube tracks cannot be loaded in DJ mode players
3. **Audio Service**: `djAudioService.ts` uses `expo-av` which cannot play YouTube URLs directly

## The Problem

YouTube doesn't provide direct streaming URLs that can be played with standard audio/video players. YouTube requires:
- **Web**: YouTube IFrame API (already implemented)
- **Mobile**: Either WebView with embed, native YouTube SDK, or external app

The current `djAudioService.ts` tries to load YouTube URLs directly with `expo-av`, which fails because:
```typescript
// This won't work for YouTube URLs
const { sound } = await Audio.Sound.createAsync(
  { uri: track.url }, // YouTube URL like "https://youtube.com/watch?v=..."
);
```

## Solutions

### Option 1: WebView with YouTube Embed (Recommended for Mobile)

**Pros:**
- Works on both iOS and Android
- No additional native dependencies
- Can control playback via JavaScript injection
- Works with Expo managed workflow

**Cons:**
- Less control than native SDK
- Requires WebView component
- May have performance overhead

**Implementation:**
1. Install `react-native-webview` (already available via Expo)
2. Create a `YouTubePlayer` component that uses WebView
3. Update `djAudioService.ts` to handle YouTube URLs differently
4. Use YouTube IFrame API within WebView for control

### Option 2: Open in YouTube App (Fallback)

**Pros:**
- Simple implementation
- Native YouTube app experience
- No additional dependencies

**Cons:**
- User leaves the app
- No synchronization with room
- Poor user experience

**Implementation:**
- Use `expo-linking` to open YouTube URLs in native app
- Show warning that playback won't be synchronized

### Option 3: Use YouTube Data API + Audio Extraction (Not Recommended)

**Pros:**
- Could extract audio-only stream
- Better control

**Cons:**
- Violates YouTube Terms of Service
- Requires API keys
- Complex implementation
- Legal issues

## Recommended Implementation Plan

### Phase 1: WebView-Based YouTube Player

1. **Create YouTube Player Component**
   ```typescript
   // src/components/YouTubePlayer.tsx
   - Uses WebView with YouTube embed
   - Handles play/pause/seek via postMessage
   - Reports position updates back to parent
   ```

2. **Update DJ Audio Service**
   ```typescript
   // src/services/djAudioService.ts
   - Detect YouTube URLs
   - Return special player type for YouTube
   - Handle YouTube playback separately
   ```

3. **Update Room Screen**
   ```typescript
   // src/screens/RoomScreen.tsx
   - Show YouTube player when track is YouTube
   - Hide standard audio player for YouTube tracks
   ```

### Phase 2: Web Support

- Web already works with YouTube IFrame API
- Ensure web version uses the existing `youtube-manager.js` logic
- May need to bridge web and mobile implementations

## Current Code Locations

### Web Implementation (Working)
- `public/js/modules/youtube-manager.js` - YouTube IFrame API integration
- `public/app.js` - Integrates YouTube manager

### Mobile Implementation (Needs Work)
- `SoundCloudJukeboxMobile/src/services/djAudioService.ts` - Audio service (doesn't handle YouTube)
- `SoundCloudJukeboxMobile/src/screens/RoomScreen.tsx` - Room screen (detects YouTube but can't play)
- `SoundCloudJukeboxMobile/src/components/DJModePlayer.tsx` - DJ player (doesn't support YouTube)
- `SoundCloudJukeboxMobile/src/components/NowPlayingCard.tsx` - Shows YouTube badge but no player

## Testing Checklist

Once implemented:
- [ ] YouTube URL can be added to queue
- [ ] YouTube track displays correctly
- [ ] YouTube video plays in mobile app
- [ ] Play/pause controls work
- [ ] Seek controls work
- [ ] Position sync works across users
- [ ] Works on iOS
- [ ] Works on Android
- [ ] Works on Web (already works)
- [ ] DJ Mode supports YouTube tracks

## Next Steps

1. **Immediate**: Document current limitations for users
2. **Short-term**: Implement WebView-based YouTube player
3. **Long-term**: Consider native YouTube SDK if needed

## User Experience Impact

**Current State:**
- Users can add YouTube links to queue
- YouTube tracks appear in queue with correct metadata
- **But**: Playback doesn't work on mobile, causing confusion

**After Implementation:**
- Seamless YouTube playback on all platforms
- Synchronized playback across users
- Full control (play/pause/seek)

## Notes

- YouTube's Terms of Service must be respected
- Consider rate limiting for YouTube API calls
- WebView approach is most compatible with Expo managed workflow
- May need to handle YouTube age-restricted videos differently

