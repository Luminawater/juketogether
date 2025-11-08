import { Track, SubscriptionTier } from '../types';
import { TrackReactionCounts } from '../services/trackReactionsService';

export interface RoomUser {
  userId: string;
  userProfile?: {
    username?: string;
    display_name?: string;
    avatar_url?: string;
  };
  isOwner?: boolean;
  isAdmin?: boolean;
  volume?: number;
}

export interface Friend {
  id: string;
  user_id: string;
  friend_id: string;
  username?: string;
  status: 'pending' | 'accepted' | 'blocked';
}

export interface RoomSettings {
  isPrivate: boolean;
  allowControls: boolean;
  allowQueue: boolean;
  allowQueueRemoval: boolean;
  djMode: boolean;
  djPlayers: number;
  admins: string[];
  allowPlaylistAdditions: boolean;
  sessionEnabled: boolean;
  autoplay: boolean;
}

export interface BlockedInfo {
  reason: string;
  blockedAt: number;
  songsPlayed: number;
  userId: string;
  isOwner: boolean;
}

export interface ActiveBoost {
  id: string;
  expiresAt: string;
  minutesRemaining: number;
  purchasedBy: string;
}

export interface TierSettings {
  queueLimit: number | null;
  djMode: boolean;
  ads: boolean;
}

