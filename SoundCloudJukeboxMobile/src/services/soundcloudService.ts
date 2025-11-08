import { API_URL } from '../config/constants';

export interface SoundCloudTrackInfo {
  title: string;
  artist: string | null;
  fullTitle: string;
  url: string;
  thumbnail: string | null;
  duration?: number | null;
}

/**
 * Fetch SoundCloud track metadata using server endpoints
 * Tries RapidAPI (via server) first, then falls back to oEmbed
 */
export const fetchSoundCloudTrackMetadata = async (
  url: string
): Promise<SoundCloudTrackInfo> => {
  // Try RapidAPI via server proxy first (150 free requests/month)
  try {
    const rapidApiResponse = await fetch(`${API_URL}/api/soundcloud-rapidapi`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ url }),
    });

    if (rapidApiResponse.ok) {
      const data = await rapidApiResponse.json();
      const parsed = parseRapidAPIResponse(data, url);
      if (parsed && parsed.title !== 'Unknown Track') {
        return parsed;
      }
    } else if (rapidApiResponse.status === 429) {
      // Rate limited, fall through to oEmbed
      console.log('RapidAPI rate limit reached, using oEmbed fallback');
    } else {
      console.log('RapidAPI failed, trying oEmbed:', rapidApiResponse.status);
    }
  } catch (error) {
    console.log('RapidAPI request failed, trying oEmbed:', error);
  }

  // Fallback to oEmbed via server proxy
  try {
    const proxyResponse = await fetch(`${API_URL}/api/soundcloud-oembed`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ url }),
    });

    if (proxyResponse.ok) {
      const data = await proxyResponse.json();
      if (data && data.title) {
        return parseOEmbedResponse(data, url);
      } else {
        // Try resolve endpoint as fallback
        return await fetchTrackMetadataViaResolve(url);
      }
    } else {
      const errorData = await proxyResponse.json().catch(() => ({}));
      console.error('oEmbed proxy error:', proxyResponse.status, errorData);
      // Try resolve endpoint as fallback
      return await fetchTrackMetadataViaResolve(url);
    }
  } catch (error) {
    console.error('Error fetching SoundCloud track metadata:', error);
    // Try resolve endpoint as fallback
    try {
      return await fetchTrackMetadataViaResolve(url);
    } catch (resolveError) {
      console.error('Resolve endpoint also failed:', resolveError);
      // Return fallback info if all methods fail
      return {
        title: 'Unknown Track',
        artist: null,
        fullTitle: 'Unknown Track',
        url: url,
        thumbnail: null,
      };
    }
  }
};

/**
 * Parse RapidAPI response into track info format
 */
function parseRapidAPIResponse(data: any, url: string): SoundCloudTrackInfo {
  // Parse RapidAPI response format
  // The response structure may vary, so we'll handle common fields
  const title = data.title || data.name || data.track_name || 'Unknown Track';
  const artist = data.artist || data.artist_name || data.user?.username || data.author || null;
  const fullTitle = artist ? `${artist} - ${title}` : title;
  const thumbnail = data.artwork_url || data.thumbnail || data.artwork || data.cover_image || null;
  const duration = data.duration ? Math.floor(data.duration / 1000) : null;

  return {
    title,
    artist,
    fullTitle,
    url: url,
    thumbnail,
    duration,
  };
}

/**
 * Parse oEmbed response into track info format
 */
function parseOEmbedResponse(data: any, url: string): SoundCloudTrackInfo {
  // Extract title from oEmbed response
  // The title is usually in the format "Artist - Track Title" or just "Track Title"
  let title = data.title || 'Unknown Track';

  // If still no title, try extracting from HTML if available
  if (title === 'Unknown Track' && data.html) {
    // Try to extract title from embed HTML
    const titleMatch = data.html.match(/title="([^"]+)"/);
    if (titleMatch) {
      title = titleMatch[1];
    }
  }

  // Try to extract artist and track separately if possible
  // oEmbed title format is usually "Artist - Track Title"
  const titleParts = title.split(' - ');
  const artist = titleParts.length > 1 ? titleParts[0] : null;
  const trackTitle = titleParts.length > 1 ? titleParts.slice(1).join(' - ') : title;

  return {
    title: trackTitle,
    artist: artist,
    fullTitle: title,
    url: url,
    thumbnail: data.thumbnail_url || null,
  };
}

/**
 * Fetch track metadata using SoundCloud /resolve endpoint (fallback)
 */
async function fetchTrackMetadataViaResolve(url: string): Promise<SoundCloudTrackInfo> {
  try {
    // Try server-side resolve endpoint (if client_id is configured)
    const resolveResponse = await fetch(`${API_URL}/api/soundcloud-resolve`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ url }),
    });

    if (resolveResponse.ok) {
      const data = await resolveResponse.json();
      if (data && data.title) {
        return {
          title: data.title,
          artist: data.user ? data.user.username : null,
          fullTitle: data.user ? `${data.user.username} - ${data.title}` : data.title,
          url: url,
          thumbnail: data.artwork_url || data.user?.avatar_url || null,
          duration: data.duration ? Math.floor(data.duration / 1000) : null,
        };
      }
    }
  } catch (error) {
    console.log('Resolve endpoint not available or failed:', error);
  }

  // If resolve fails, return fallback
  return {
    title: 'Unknown Track',
    artist: null,
    fullTitle: 'Unknown Track',
    url: url,
    thumbnail: null,
  };
}

