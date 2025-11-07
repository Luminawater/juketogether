import { API_URL } from '../config/constants';

/**
 * Generates a shareable URL for a room
 * @param roomId - The room ID
 * @param shortCode - Optional short code for easier sharing
 * @returns A shareable URL string
 */
export const getRoomUrl = (roomId: string, shortCode?: string): string => {
  // Use short code if available, otherwise use room ID
  const identifier = shortCode || roomId;
  
  // For web, use the full URL format
  // For mobile apps, this will be handled by deep linking
  const baseUrl = API_URL.replace(/\/$/, ''); // Remove trailing slash if present
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

  // URL regex pattern that matches http/https URLs
  // This pattern matches URLs with or without protocol
  const urlPattern = /(https?:\/\/[^\s]+|(?:soundcloud\.com|spotify\.com|open\.spotify\.com|youtube\.com|youtu\.be|spotify:)[^\s]*)/gi;
  
  const matches = text.match(urlPattern);
  if (!matches) {
    return [];
  }

  // Filter and normalize URLs
  const validUrls: string[] = [];
  
  for (const match of matches) {
    let url = match.trim();
    
    // Remove trailing punctuation that might be part of the sentence
    url = url.replace(/[.,;:!?]+$/, '');
    
    // Add protocol if missing
    if (!url.startsWith('http://') && !url.startsWith('https://')) {
      // Check if it's a spotify: URI
      if (url.startsWith('spotify:')) {
        validUrls.push(url);
        continue;
      }
      // Otherwise add https://
      url = 'https://' + url;
    }
    
    // Validate it's a supported platform
    const isSoundCloud = url.includes('soundcloud.com');
    const isSpotify = url.includes('spotify.com') || url.includes('open.spotify.com') || url.startsWith('spotify:');
    const isYouTube = url.includes('youtube.com') || url.includes('youtu.be');
    
    if (isSoundCloud || isSpotify || isYouTube) {
      validUrls.push(url);
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

