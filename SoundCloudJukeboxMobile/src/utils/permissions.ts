import { UserRole, SubscriptionTier, UserPermissions } from '../types';

/**
 * Check if a user has a specific role or higher
 * Role hierarchy: admin > moderator > user > guest
 */
export function hasRole(userRole: UserRole, requiredRole: UserRole): boolean {
  const roleHierarchy: Record<UserRole, number> = {
    guest: 0,
    user: 1,
    moderator: 2,
    admin: 3,
  };

  return roleHierarchy[userRole] >= roleHierarchy[requiredRole];
}

/**
 * Check if a user has a specific tier or higher
 * Tier hierarchy: pro > standard > free
 */
export function hasTier(userTier: SubscriptionTier, requiredTier: SubscriptionTier): boolean {
  const tierHierarchy: Record<SubscriptionTier, number> = {
    free: 0,
    standard: 1,
    pro: 2,
  };

  return tierHierarchy[userTier] >= tierHierarchy[requiredTier];
}

/**
 * Get the maximum number of songs for a tier
 */
export function getMaxSongsForTier(tier: SubscriptionTier): number {
  switch (tier) {
    case 'free':
      return 1;
    case 'standard':
      return 10;
    case 'pro':
      return Infinity;
    default:
      return 0;
  }
}

/**
 * Check if user can play more songs based on their permissions
 * Moderators and admins have unlimited songs (treated as pro tier)
 */
export function canPlaySong(permissions: UserPermissions): boolean {
  // Moderators and admins have unlimited songs
  if (permissions.role === 'moderator' || permissions.role === 'admin') {
    return true;
  }
  return permissions.songs_played < permissions.max_songs;
}

/**
 * Get remaining songs user can play
 */
export function getRemainingSongs(permissions: UserPermissions): number {
  if (permissions.max_songs === Infinity) {
    return Infinity;
  }
  return Math.max(0, permissions.max_songs - permissions.songs_played);
}

/**
 * Get role display name
 */
export function getRoleDisplayName(role: UserRole): string {
  const displayNames: Record<UserRole, string> = {
    guest: 'Guest',
    user: 'User',
    moderator: 'Moderator',
    admin: 'Admin',
  };
  return displayNames[role] || 'User';
}

/**
 * Get tier display name
 */
export function getTierDisplayName(tier: SubscriptionTier): string {
  const displayNames: Record<SubscriptionTier, string> = {
    free: 'Free',
    standard: 'Standard',
    pro: 'Pro',
  };
  return displayNames[tier] || 'Free';
}

/**
 * Get tier color for UI
 */
export function getTierColor(tier: SubscriptionTier): string {
  const colors: Record<SubscriptionTier, string> = {
    free: '#9e9e9e',
    rookie: '#64b5f6',
    standard: '#4caf50',
    pro: '#667eea',
  };
  return colors[tier] || '#9e9e9e';
}

/**
 * Get faded dark header color based on subscription tier
 * Returns subtle dark colors with a slight tint based on tier
 */
export function getTierHeaderColor(tier: SubscriptionTier): string {
  const colors: Record<SubscriptionTier, string> = {
    free: '#2a2a2a',      // Neutral dark gray
    rookie: '#2a2d35',     // Dark with subtle blue tint
    standard: '#2a322a',   // Dark with subtle green tint
    pro: '#2a2a35',        // Dark with subtle purple/blue tint
  };
  return colors[tier] || '#2a2a2a';
}

/**
 * Get role color for UI
 */
export function getRoleColor(role: UserRole): string {
  const colors: Record<UserRole, string> = {
    guest: '#9e9e9e',
    user: '#2196f3',
    moderator: '#ff9800',
    admin: '#f44336',
  };
  return colors[role] || '#9e9e9e';
}

