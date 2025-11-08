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

/**
 * Known URL format templates for music platforms
 * Used as blueprints for converting malformed URLs
 */
export const URL_FORMAT_TEMPLATES = {
  youtube: [
    'https://www.youtube.com/watch?v={id}',
    'https://youtube.com/watch?v={id}',
    'https://youtu.be/{id}',
    'https://www.youtu.be/{id}',
    'https://m.youtube.com/watch?v={id}',
    'https://youtube.com/embed/{id}',
    'https://www.youtube.com/embed/{id}',
  ],
  spotify: [
    'https://open.spotify.com/track/{id}',
    'https://open.spotify.com/album/{id}',
    'https://open.spotify.com/playlist/{id}',
    'https://spotify.com/track/{id}',
    'spotify:track:{id}',
    'spotify:album:{id}',
    'spotify:playlist:{id}',
  ],
  soundcloud: [
    'https://soundcloud.com/{user}/{track}',
    'https://www.soundcloud.com/{user}/{track}',
    'https://m.soundcloud.com/{user}/{track}',
  ],
};

/**
 * Extracts ID from various URL formats
 */
const extractIdFromUrl = (url: string, platform: 'youtube' | 'spotify' | 'soundcloud'): string | null => {
  const normalized = url.toLowerCase().trim();
  
  if (platform === 'youtube') {
    // Extract from youtube.com/watch?v=ID
    const watchMatch = normalized.match(/[?&]v=([a-z0-9_-]{11})/i);
    if (watchMatch) return watchMatch[1];
    
    // Extract from youtu.be/ID
    const shortMatch = normalized.match(/youtu\.be\/([a-z0-9_-]{11})/i);
    if (shortMatch) return shortMatch[1];
    
    // Extract from /embed/ID
    const embedMatch = normalized.match(/\/embed\/([a-z0-9_-]{11})/i);
    if (embedMatch) return embedMatch[1];
    
    // Try to find 11-character alphanumeric string (YouTube ID format)
    const idMatch = normalized.match(/([a-z0-9_-]{11})/i);
    if (idMatch) return idMatch[1];
  }
  
  if (platform === 'spotify') {
    // Extract from spotify:track:ID or spotify:album:ID
    const uriMatch = normalized.match(/spotify:(track|album|playlist):([a-z0-9]+)/i);
    if (uriMatch) return uriMatch[2];
    
    // Extract from open.spotify.com/track/ID
    const urlMatch = normalized.match(/\/(track|album|playlist)\/([a-z0-9]+)/i);
    if (urlMatch) return urlMatch[2];
    
    // Try to find alphanumeric string that looks like Spotify ID (22 chars)
    const idMatch = normalized.match(/([a-z0-9]{22})/i);
    if (idMatch) return idMatch[1];
  }
  
  if (platform === 'soundcloud') {
    // Extract user and track from soundcloud.com/user/track
    const pathMatch = normalized.match(/soundcloud\.com\/([^\/]+)\/([^\/\?]+)/i);
    if (pathMatch) return `${pathMatch[1]}/${pathMatch[2]}`;
    
    // Try to extract just the path part
    const pathOnly = normalized.match(/soundcloud\.com\/(.+)/i);
    if (pathOnly) return pathOnly[1].split('?')[0].split('#')[0];
  }
  
  return null;
};

/**
 * Attempts to convert a malformed URL to a valid format
 * @param url - The URL to convert
 * @param attempts - Number of conversion attempts (1-3)
 * @returns Converted URL or null if conversion failed
 */
export const convertUrlFormat = (
  url: string,
  attempts: number = 3
): { url: string; platform: 'youtube' | 'spotify' | 'soundcloud' } | null => {
  if (!url || !url.trim()) {
    return null;
  }
  
  const normalized = url.trim().toLowerCase();
  
  // Detect platform
  let platform: 'youtube' | 'spotify' | 'soundcloud' | null = null;
  if (normalized.includes('youtube') || normalized.includes('youtu.be')) {
    platform = 'youtube';
  } else if (normalized.includes('spotify') || normalized.startsWith('spotify:')) {
    platform = 'spotify';
  } else if (normalized.includes('soundcloud')) {
    platform = 'soundcloud';
  }
  
  if (!platform) {
    return null;
  }
  
  // Try to extract ID
  const id = extractIdFromUrl(url, platform);
  if (!id) {
    return null;
  }
  
  // Convert based on platform
  if (platform === 'youtube') {
    // Use standard format: https://www.youtube.com/watch?v=ID
    return { url: `https://www.youtube.com/watch?v=${id}`, platform: 'youtube' };
  }
  
  if (platform === 'spotify') {
    // Determine type (track, album, playlist)
    let type = 'track';
    if (normalized.includes('album')) type = 'album';
    else if (normalized.includes('playlist')) type = 'playlist';
    
    // Use standard format: https://open.spotify.com/type/ID
    return { url: `https://open.spotify.com/${type}/${id}`, platform: 'spotify' };
  }
  
  if (platform === 'soundcloud') {
    // SoundCloud URLs are more complex, try to preserve the path
    if (id.includes('/')) {
      return { url: `https://soundcloud.com/${id}`, platform: 'soundcloud' };
    }
  }
  
  return null;
};

/**
 * Smart URL extraction with format conversion attempts
 * Extracts URLs from text and attempts to fix malformed ones
 * @param text - The text to extract URLs from
 * @param maxAttempts - Maximum conversion attempts per URL (1-3)
 * @returns Array of extracted and converted URLs
 */
export const extractMusicUrlsSmart = (
  text: string,
  maxAttempts: number = 3
): string[] => {
  if (!text || !text.trim()) {
    return [];
  }
  
  // First, try standard extraction
  let urls = extractMusicUrls(text);
  
  // If no URLs found, try to find potential URLs in the text
  if (urls.length === 0) {
    // Look for potential YouTube IDs (11 characters)
    const youtubeIdMatch = text.match(/([a-z0-9_-]{11})/gi);
    if (youtubeIdMatch) {
      for (const id of youtubeIdMatch) {
        urls.push(`https://www.youtube.com/watch?v=${id}`);
      }
    }
    
    // Look for potential Spotify IDs (22 characters)
    const spotifyIdMatch = text.match(/([a-z0-9]{22})/gi);
    if (spotifyIdMatch) {
      for (const id of spotifyIdMatch) {
        urls.push(`https://open.spotify.com/track/${id}`);
      }
    }
    
    // Look for domain mentions
    const domainPatterns = [
      /(?:^|\s)(soundcloud\.com\/[^\s]+)/gi,
      /(?:^|\s)(youtube\.com\/[^\s]+)/gi,
      /(?:^|\s)(youtu\.be\/[^\s]+)/gi,
      /(?:^|\s)(open\.spotify\.com\/[^\s]+)/gi,
      /(?:^|\s)(spotify\.com\/[^\s]+)/gi,
    ];
    
    for (const pattern of domainPatterns) {
      const matches = text.match(pattern);
      if (matches) {
        for (const match of matches) {
          const url = match.trim();
          if (!urls.includes(url) && !urls.includes(`https://${url}`)) {
            urls.push(`https://${url}`);
          }
        }
      }
    }
  }
  
  // Try to convert malformed URLs
  const convertedUrls: string[] = [];
  for (const url of urls) {
    if (isValidMusicUrl(url)) {
      convertedUrls.push(url);
    } else {
      // Try conversion
      const converted = convertUrlFormat(url, maxAttempts);
      if (converted) {
        convertedUrls.push(converted.url);
      }
    }
  }
  
  // Remove duplicates
  return Array.from(new Set(convertedUrls));
};

