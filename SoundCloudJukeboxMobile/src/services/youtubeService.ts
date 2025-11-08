import { API_URL } from '../config/constants';

export interface YouTubeTrackInfo {
  title: string;
  artist: string | null;
  fullTitle: string;
  url: string;
  thumbnail: string | null;
  duration?: number | null;
  videoId?: string | null;
}

/**
 * Extract video ID from various YouTube URL formats
 */
function extractVideoId(url: string): string | null {
  const patterns = [
    /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([^&\n?#]+)/,
    /youtube\.com\/.*[?&]v=([^&\n?#]+)/,
  ];

  for (const pattern of patterns) {
    const match = url.match(pattern);
    if (match && match[1]) {
      return match[1];
    }
  }

  return null;
}

/**
 * Normalize YouTube URL to standard format
 */
function normalizeYouTubeUrl(url: string): string {
  const videoId = extractVideoId(url);
  if (videoId) {
    return `https://www.youtube.com/watch?v=${videoId}`;
  }
  return url;
}

/**
 * Fetch YouTube track metadata using oEmbed API
 * oEmbed is free and doesn't require API keys
 */
export const fetchYouTubeTrackMetadata = async (
  url: string
): Promise<YouTubeTrackInfo> => {
  try {
    // Normalize URL first
    const normalizedUrl = normalizeYouTubeUrl(url);
    const videoId = extractVideoId(normalizedUrl);

    if (!videoId) {
      throw new Error('Invalid YouTube URL');
    }

    // Use YouTube oEmbed API (free, no API key required)
    const oembedUrl = `https://www.youtube.com/oembed?url=${encodeURIComponent(normalizedUrl)}&format=json`;
    
    const response = await fetch(oembedUrl);
    
    if (!response.ok) {
      throw new Error(`YouTube oEmbed API error: ${response.status}`);
    }

    const data = await response.json();
    
    // Extract title and author from oEmbed response
    const title = data.title || 'Unknown Track';
    const artist = data.author_name || null;
    const fullTitle = artist ? `${artist} - ${title}` : title;
    const thumbnail = data.thumbnail_url || (videoId ? `https://img.youtube.com/vi/${videoId}/hqdefault.jpg` : null);

    return {
      title,
      artist,
      fullTitle,
      url: normalizedUrl,
      thumbnail,
      videoId,
      duration: null, // oEmbed doesn't provide duration
    };
  } catch (error) {
    console.error('Error fetching YouTube track metadata:', error);
    
    // Fallback: return basic info with video ID
    const normalizedUrl = normalizeYouTubeUrl(url);
    const videoId = extractVideoId(normalizedUrl);
    
    return {
      title: 'Unknown Track',
      artist: null,
      fullTitle: 'Unknown Track',
      url: normalizedUrl,
      thumbnail: videoId ? `https://img.youtube.com/vi/${videoId}/hqdefault.jpg` : null,
      videoId,
      duration: null,
    };
  }
};

