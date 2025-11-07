import { API_URL } from '../config/constants';
import { useAuth } from '../context/AuthContext';

export interface SpotifyPlaylist {
  id: string;
  name: string;
  description?: string;
  images?: Array<{ url: string }>;
  owner?: {
    display_name?: string;
  };
  tracks?: {
    total: number;
  };
  external_urls?: {
    spotify: string;
  };
}

export interface SpotifyTrack {
  id: string;
  name: string;
  artists: Array<{ name: string }>;
  album?: {
    name: string;
    images?: Array<{ url: string }>;
  };
  duration_ms?: number;
  external_urls?: {
    spotify: string;
  };
}

export interface SpotifyPlaylistTracks {
  items: Array<{
    track: SpotifyTrack;
  }>;
  total: number;
}

/**
 * Check if user is logged in with Spotify
 */
export const isSpotifyUser = (user: any): boolean => {
  if (!user) return false;
  // Check if user signed in with Spotify provider
  return user.app_metadata?.provider === 'spotify' || 
         user.identities?.some((identity: any) => identity.provider === 'spotify') ||
         false;
};

/**
 * Get user's Spotify access token from Supabase session
 * Note: This requires the token to be stored in user metadata or session
 */
export const getSpotifyAccessToken = async (session: any): Promise<string | null> => {
  if (!session) return null;
  
  // Try to get token from session provider_token
  // Supabase stores provider tokens in session.provider_token for OAuth providers
  if (session.provider_token) {
    return session.provider_token;
  }
  
  // Try to get from user metadata
  if (session.user?.user_metadata?.spotify_access_token) {
    return session.user.user_metadata.spotify_access_token;
  }
  
  // If not available, we'll need to request it via API
  // The API endpoint will handle token refresh if needed
  return null;
};

/**
 * Fetch user's Spotify playlists
 */
export const fetchUserPlaylists = async (session: any): Promise<SpotifyPlaylist[]> => {
  try {
    if (!session?.access_token) {
      throw new Error('No session token available');
    }

    const response = await fetch(`${API_URL}/api/spotify/playlists`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${session.access_token}`,
      },
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      if (response.status === 401 || response.status === 403) {
        throw new Error(errorData.error || 'Spotify authentication required. Please sign in with Spotify.');
      }
      throw new Error(errorData.error || `Failed to fetch playlists: ${response.status}`);
    }

    const data = await response.json();
    return data.playlists || [];
  } catch (error: any) {
    console.error('Error fetching Spotify playlists:', error);
    throw error;
  }
};

/**
 * Fetch tracks from a Spotify playlist
 */
export const fetchPlaylistTracks = async (
  playlistId: string,
  session: any
): Promise<SpotifyTrack[]> => {
  try {
    if (!session?.access_token) {
      throw new Error('No session token available');
    }

    const response = await fetch(`${API_URL}/api/spotify/playlists/${playlistId}/tracks`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${session.access_token}`,
      },
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      if (response.status === 401 || response.status === 403) {
        throw new Error(errorData.error || 'Spotify authentication required. Please sign in with Spotify.');
      }
      throw new Error(errorData.error || `Failed to fetch playlist tracks: ${response.status}`);
    }

    const data = await response.json();
    return data.tracks || [];
  } catch (error: any) {
    console.error('Error fetching playlist tracks:', error);
    throw error;
  }
};

/**
 * Convert Spotify track to queue track format
 */
export const spotifyTrackToQueueTrack = (track: SpotifyTrack, addedBy: string) => {
  const trackUrl = track.external_urls?.spotify || `https://open.spotify.com/track/${track.id}`;
  
  return {
    id: `spotify-${track.id}`,
    url: trackUrl,
    info: {
      title: track.name,
      artist: track.artists.map(a => a.name).join(', '),
      fullTitle: `${track.artists.map(a => a.name).join(', ')} - ${track.name}`,
      url: trackUrl,
      thumbnail: track.album?.images?.[0]?.url || null,
      duration: track.duration_ms ? Math.floor(track.duration_ms / 1000) : undefined,
    },
    addedBy,
    addedAt: Date.now(),
    platform: 'spotify' as const,
  };
};

