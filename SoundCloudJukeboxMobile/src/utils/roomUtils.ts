/**
 * Generates a shareable URL for a room
 * @param roomId - The room ID
 * @param shortCode - Optional short code for easier sharing
 * @returns A shareable URL string
 */
export const getRoomUrl = (roomId: string, shortCode?: string): string => {
  // Use short code if available, otherwise use room ID
  const identifier = shortCode || roomId;
  
  // Always use the production domain for shared room links
  // This ensures links work for anyone who receives them, regardless of environment
  const baseUrl = 'https://www.juketogether.com';
  return `${baseUrl}/room/${identifier}`;
};

/**
 * Generates a share message for a room
 * @param roomName - The name of the room
 * @param roomId - The room ID
 * @param shortCode - Optional short code
 * @returns A formatted share message
 */
export const getRoomShareMessage = (
  roomName: string,
  roomId: string,
  shortCode?: string
): string => {
  const roomUrl = getRoomUrl(roomId, shortCode);
  let message = `Join my music room "${roomName}"!\n\n`;
  
  if (shortCode) {
    message += `Room Code: ${shortCode}\n`;
  }
  
  message += `Room ID: ${roomId}\n\n`;
  message += `Join here: ${roomUrl}`;
  
  return message;
};

/**
 * Extracts URLs from text that match supported music platforms
 * Supports SoundCloud, Spotify, and YouTube URLs
 * @param text - The text to extract URLs from
 * @returns Array of extracted URLs
 */
export const extractMusicUrls = (text: string): string[] => {
  if (!text || !text.trim()) {
    return [];
  }

  // More comprehensive URL regex pattern
  // Matches:
  // 1. Full URLs with protocol (http:// or https://)
  // 2. URLs without protocol but with domain
  // 3. Spotify URIs (spotify:track:...)
  const urlPatterns = [
    // Full URLs with protocol
    /https?:\/\/(?:www\.)?(?:soundcloud\.com|open\.spotify\.com|spotify\.com|youtube\.com|youtu\.be)\/[^\s\)\]\}]*/gi,
    // URLs without protocol
    /(?:www\.)?(?:soundcloud\.com|open\.spotify\.com|spotify\.com|youtube\.com|youtu\.be)\/[^\s\)\]\}]*/gi,
    // Spotify URIs
    /spotify:[^\s\)\]\}]*/gi,
  ];
  
  const allMatches: string[] = [];
  
  // Collect all matches from different patterns
  for (const pattern of urlPatterns) {
    const matches = text.match(pattern);
    if (matches) {
      allMatches.push(...matches);
    }
  }
  
  if (allMatches.length === 0) {
    return [];
  }

  // Filter and normalize URLs, removing duplicates
  const validUrls: string[] = [];
  const seenUrls = new Set<string>();
  
  for (const match of allMatches) {
    let url = match.trim();
    
    // Remove trailing punctuation that might be part of the sentence
    url = url.replace(/[.,;:!?\)\]\}]+$/, '');
    
    // Skip if empty after trimming
    if (!url) {
      continue;
    }
    
    // Add protocol if missing (except for spotify: URIs)
    if (!url.startsWith('http://') && !url.startsWith('https://')) {
      // Check if it's a spotify: URI
      if (url.startsWith('spotify:')) {
        if (!seenUrls.has(url)) {
          validUrls.push(url);
          seenUrls.add(url);
        }
        continue;
      }
      // Otherwise add https://
      url = 'https://' + url;
    }
    
    // Validate it's a supported platform
    const normalizedUrl = url.toLowerCase();
    const isSoundCloud = normalizedUrl.includes('soundcloud.com');
    const isSpotify = normalizedUrl.includes('spotify.com') || normalizedUrl.includes('open.spotify.com') || normalizedUrl.startsWith('spotify:');
    const isYouTube = normalizedUrl.includes('youtube.com') || normalizedUrl.includes('youtu.be');
    
    if ((isSoundCloud || isSpotify || isYouTube) && !seenUrls.has(url)) {
      validUrls.push(url);
      seenUrls.add(url);
    }
  }
  
  return validUrls;
};

/**
 * Checks if a URL is a valid music platform URL
 * @param url - The URL to check
 * @returns True if the URL is from a supported platform
 */
export const isValidMusicUrl = (url: string): boolean => {
  if (!url || !url.trim()) {
    return false;
  }
  
  const normalizedUrl = url.trim().toLowerCase();
  const isSoundCloud = normalizedUrl.includes('soundcloud.com');
  const isSpotify = normalizedUrl.includes('spotify.com') || normalizedUrl.includes('open.spotify.com') || normalizedUrl.startsWith('spotify:');
  const isYouTube = normalizedUrl.includes('youtube.com') || normalizedUrl.includes('youtu.be');
  
  return isSoundCloud || isSpotify || isYouTube;
};

