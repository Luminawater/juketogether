export type UserRole = 'guest' | 'user' | 'moderator' | 'admin';
export type SubscriptionTier = 'free' | 'rookie' | 'standard' | 'pro';

export interface User {
  id: string;
  email: string;
  avatar_url?: string;
  display_name?: string;
}

export interface UserProfile {
  id: string;
  username?: string;
  display_name?: string;
  dj_name?: string;
  avatar_url?: string;
  role: UserRole;
  subscription_tier: SubscriptionTier;
  songs_played_count: number;
  country?: string;
  show_in_leaderboard?: boolean;
  show_in_discovery?: boolean;
  is_private_account?: boolean;
  created_at: string;
  updated_at: string;
}

export interface UserPermissions {
  role: UserRole;
  tier: SubscriptionTier;
  songs_played: number;
  max_songs: number;
}

export interface Room {
  id: string;
  name: string;
  description?: string;
  type: 'public' | 'private';
  created_by: string;
  created_at: string;
  short_code?: string;
  user_count?: number;
  country?: string;
  follower_count?: number;
  total_playtime_seconds?: number;
}

export interface Track {
  id: string;
  url: string;
  info: TrackInfo;
  addedBy: string;
  addedAt: number;
  platform: 'soundcloud' | 'spotify';
}

export interface TrackInfo {
  title: string;
  artist: string;
  fullTitle: string;
  url: string;
  thumbnail?: string;
  duration?: number;
}

export interface RoomState {
  queue: Track[];
  currentTrack: Track | null;
  isPlaying: boolean;
  position: number;
  history: Track[];
}

export interface UserVolume {
  userId: string;
  volume: number;
}



