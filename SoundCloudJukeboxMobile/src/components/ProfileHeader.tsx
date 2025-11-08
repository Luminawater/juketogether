import React from 'react';
import { View, StyleSheet, Platform } from 'react-native';
import { Text, Avatar, useTheme } from 'react-native-paper';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from '../context/AuthContext';
import { UserBadge } from './UserBadge';

interface ProfileHeaderProps {
  /**
   * Avatar size in pixels
   * @default 56
   */
  avatarSize?: number;
  /**
   * Custom padding top (overrides safe area insets)
   */
  paddingTop?: number;
  /**
   * Whether to use safe area insets for padding top
   * @default true
   */
  useSafeArea?: boolean;
}

export const ProfileHeader: React.FC<ProfileHeaderProps> = ({
  avatarSize = 56,
  paddingTop,
  useSafeArea = true,
}) => {
  const { user, profile, permissions } = useAuth();
  const theme = useTheme();
  const insets = useSafeAreaInsets();

  const getInitials = () => {
    if (profile?.display_name) {
      return profile.display_name
        .split(' ')
        .map((n) => n[0])
        .join('')
        .toUpperCase()
        .substring(0, 2);
    }
    if (profile?.username) {
      return profile.username.substring(0, 2).toUpperCase();
    }
    if (user?.email) {
      return user.email.substring(0, 2).toUpperCase();
    }
    return 'U';
  };

  const avatarUrl = profile?.avatar_url || user?.user_metadata?.avatar_url;

  // Calculate padding top
  const calculatedPaddingTop =
    paddingTop !== undefined
      ? paddingTop
      : useSafeArea && Platform.OS !== 'web'
      ? Math.max(insets.top + 10, 20)
      : Platform.OS === 'web'
      ? 20
      : 20;

  return (
    <View
      style={[
        styles.header,
        {
          backgroundColor: theme.colors.surface,
          paddingTop: calculatedPaddingTop,
        },
      ]}
    >
      <View style={styles.userInfo}>
        <View style={[styles.avatarContainer, { backgroundColor: '#667eea' }]}>
          {avatarUrl ? (
            <Avatar.Image
              size={avatarSize}
              source={{ uri: avatarUrl }}
              style={styles.avatar}
            />
          ) : (
            <View style={[styles.avatarInitials, { width: avatarSize, height: avatarSize }]}>
              <Text style={styles.avatarInitialsText}>{getInitials()}</Text>
            </View>
          )}
        </View>
        <View style={styles.userDetails}>
          <Text style={[styles.userEmail, { color: theme.colors.onSurface }]}>
            {user?.email}
          </Text>
          <Text style={[styles.userGreeting, { color: theme.colors.onSurfaceVariant }]}>
            Welcome back!
          </Text>
          {profile && permissions && (
            <View style={styles.userBadgesContainer}>
              <View style={styles.userBadges}>
                <View
                  style={[
                    styles.badgePill,
                    {
                      backgroundColor:
                        profile.role === 'admin'
                          ? '#f44336'
                          : profile.role === 'moderator'
                          ? '#ff9800'
                          : '#2196f3',
                    },
                  ]}
                >
                  <Text style={styles.badgeText}>
                    {profile.role === 'admin'
                      ? 'Admin'
                      : profile.role === 'moderator'
                      ? 'Moderator'
                      : 'User'}
                  </Text>
                </View>
                <View
                  style={[
                    styles.badgePill,
                    {
                      backgroundColor:
                        profile.subscription_tier === 'pro'
                          ? '#667eea'
                          : profile.subscription_tier === 'standard'
                          ? '#4caf50'
                          : '#9e9e9e',
                    },
                  ]}
                >
                  <Text style={styles.badgeText}>
                    {profile.subscription_tier === 'pro'
                      ? 'Pro'
                      : profile.subscription_tier === 'standard'
                      ? 'Standard'
                      : 'Free'}
                  </Text>
                </View>
              </View>
              {permissions.max_songs !== Infinity && (
                <Text style={[styles.songCount, { color: theme.colors.onSurfaceVariant }]}>
                  {permissions.songs_played}/{permissions.max_songs} songs played
                </Text>
              )}
            </View>
          )}
        </View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: Platform.OS === 'web' ? 20 : 16,
    paddingBottom: Platform.OS === 'web' ? 20 : 16,
    elevation: 6,
    // Web-compatible shadow
    ...(Platform.OS === 'web'
      ? {
          boxShadow: '0px 4px 12px rgba(0, 0, 0, 0.2)',
        }
      : {
          shadowColor: '#000',
          shadowOffset: { width: 0, height: 4 },
          shadowOpacity: 0.15,
          shadowRadius: 8,
        }),
  },
  userInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  avatarContainer: {
    borderRadius: 28,
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden',
  },
  avatar: {
    backgroundColor: 'transparent',
  },
  avatarInitials: {
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 28,
  },
  avatarInitialsText: {
    fontSize: 20,
    fontWeight: '600',
    color: '#FFFFFF',
    letterSpacing: 0.5,
  },
  userDetails: {
    marginLeft: Platform.OS === 'web' ? 16 : 12,
    flex: 1,
  },
  userEmail: {
    fontSize: Platform.OS === 'web' ? 16 : 15,
    fontWeight: '600',
    marginBottom: 4,
  },
  userGreeting: {
    fontSize: Platform.OS === 'web' ? 14 : 13,
    marginBottom: 8,
  },
  userBadgesContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 8,
  },
  userBadges: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  badgePill: {
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 16,
    minHeight: 24,
    justifyContent: 'center',
    alignItems: 'center',
  },
  badgeText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#FFFFFF',
    letterSpacing: 0.3,
  },
  songCount: {
    fontSize: 12,
    marginLeft: 4,
  },
});

