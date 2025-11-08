import React from 'react';
import { View, StyleSheet, Platform, TouchableOpacity } from 'react-native';
import { Card, Text, Title, Button, Avatar, useTheme, Switch } from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { Track } from '../types';
import { TrackReactionCounts, ReactionType } from '../services/trackReactionsService';
import { Dimensions } from 'react-native';
import { getThumbnailUrl } from '../utils/imageUtils';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const IS_MOBILE = SCREEN_WIDTH < 768;

interface NowPlayingCardProps {
  currentTrack: Track | null;
  isPlaying: boolean;
  trackReactions: TrackReactionCounts;
  canControl: boolean;
  onPlayPause: () => void;
  onNext: () => void;
  onSync: () => void;
  onReaction: (reactionType: ReactionType) => void;
  loadingReaction: boolean;
  hasUser: boolean;
  queueLength: number;
  autoplay: boolean;
  onToggleAutoplay: () => void;
  canToggleAutoplay: boolean;
}

export const NowPlayingCard: React.FC<NowPlayingCardProps> = ({
  currentTrack,
  isPlaying,
  trackReactions,
  canControl,
  onPlayPause,
  onNext,
  onSync,
  onReaction,
  loadingReaction,
  hasUser,
  queueLength,
  autoplay,
  onToggleAutoplay,
  canToggleAutoplay,
}) => {
  const theme = useTheme();

  return (
    <Card style={[styles.card, styles.nowPlayingCard, { 
      backgroundColor: theme.colors.surface,
      borderColor: Platform.OS === 'web' ? `${theme.colors.primary}40` : 'transparent',
    }]}>
      <Card.Content style={styles.content}>
        {/* Header */}
        <View style={styles.header}>
          <View style={styles.headerLeft}>
            <View style={[styles.iconContainer, { backgroundColor: `${theme.colors.primary}20` }]}>
              <MaterialCommunityIcons 
                name="music-note" 
                size={24} 
                color={theme.colors.primary} 
              />
            </View>
            <Title style={[styles.title, { color: theme.colors.onSurface }]}>Now Playing</Title>
          </View>
          {isPlaying && (
            <View style={[styles.liveIndicator, { backgroundColor: `${theme.colors.primary}20` }]}>
              <View style={[styles.liveDot, { backgroundColor: theme.colors.primary }]} />
              <Text style={[styles.liveText, { color: theme.colors.primary }]}>LIVE</Text>
            </View>
          )}
        </View>

        {currentTrack ? (
          <>
            {/* Track Info */}
            <View style={styles.trackInfo}>
              <View style={styles.thumbnailContainer}>
                <View style={[styles.thumbnailWrapper, isPlaying && styles.thumbnailWrapperPlaying]}>
                  <Avatar.Image
                    size={IS_MOBILE ? 100 : 120}
                    source={{ 
                      uri: getThumbnailUrl(currentTrack.info?.thumbnail, IS_MOBILE ? 100 : 120)
                    }}
                    style={styles.trackThumbnail}
                  />
                  {isPlaying && (
                    <View style={styles.playingIndicator}>
                      <View style={[styles.pulseRing, { borderColor: theme.colors.primary }]} />
                      <View style={[styles.pulseRing, styles.pulseRing2, { borderColor: theme.colors.primary }]} />
                    </View>
                  )}
                </View>
              </View>
              <View style={styles.trackDetails}>
                <Text style={[styles.trackTitle, { color: theme.colors.onSurface }]} numberOfLines={2}>
                  {currentTrack.info?.fullTitle || 'Unknown Track'}
                </Text>
                <View style={[styles.platformBadge, { backgroundColor: `${theme.colors.primary}15` }]}>
                  <MaterialCommunityIcons 
                    name={
                      currentTrack.url?.includes('spotify') ? 'spotify' : 
                      currentTrack.url?.includes('youtube') ? 'youtube' : 
                      'music-note'
                    }
                    size={16}
                    color={theme.colors.primary}
                  />
                  <Text style={[styles.trackPlatform, { color: theme.colors.primary }]}>
                    {currentTrack.url?.includes('spotify') ? 'Spotify' : 
                     currentTrack.url?.includes('youtube') ? 'YouTube' : 
                     'SoundCloud'}
                  </Text>
                </View>
              </View>
            </View>

            {/* Track Reactions */}
            {hasUser && (
              <View style={[styles.reactionsContainer, { 
                borderTopColor: theme.colors.outline,
                borderBottomColor: theme.colors.outline,
                backgroundColor: `${theme.colors.surfaceVariant}40`
              }]}>
                <View style={styles.reactionButtonGroup}>
                  <TouchableOpacity
                    onPress={() => onReaction('like')}
                    disabled={loadingReaction}
                    style={[
                      styles.reactionButtonTouchable,
                      { backgroundColor: trackReactions.userReaction === 'like' ? 'rgba(76, 175, 80, 0.2)' : `${theme.colors.surfaceVariant}80` }
                    ]}
                  >
                    <MaterialCommunityIcons
                      name="thumb-up"
                      size={26}
                      color={trackReactions.userReaction === 'like' ? '#4caf50' : theme.colors.onSurfaceVariant}
                    />
                  </TouchableOpacity>
                  <Text style={[styles.reactionCount, { color: theme.colors.onSurface }]}>
                    {trackReactions.likes}
                  </Text>
                </View>

                <View style={styles.reactionButtonGroup}>
                  <TouchableOpacity
                    onPress={() => onReaction('dislike')}
                    disabled={loadingReaction}
                    style={[
                      styles.reactionButtonTouchable,
                      { backgroundColor: trackReactions.userReaction === 'dislike' ? 'rgba(244, 67, 54, 0.2)' : `${theme.colors.surfaceVariant}80` }
                    ]}
                  >
                    <MaterialCommunityIcons
                      name="thumb-down"
                      size={26}
                      color={trackReactions.userReaction === 'dislike' ? '#f44336' : theme.colors.onSurfaceVariant}
                    />
                  </TouchableOpacity>
                  <Text style={[styles.reactionCount, { color: theme.colors.onSurface }]}>
                    {trackReactions.dislikes}
                  </Text>
                </View>

                <View style={styles.reactionButtonGroup}>
                  <TouchableOpacity
                    onPress={() => onReaction('fantastic')}
                    disabled={loadingReaction}
                    style={[
                      styles.reactionButtonTouchable,
                      { backgroundColor: trackReactions.userReaction === 'fantastic' ? 'rgba(255, 152, 0, 0.2)' : `${theme.colors.surfaceVariant}80` }
                    ]}
                  >
                    <MaterialCommunityIcons
                      name="star"
                      size={26}
                      color={trackReactions.userReaction === 'fantastic' ? '#ff9800' : theme.colors.onSurfaceVariant}
                    />
                  </TouchableOpacity>
                  <Text style={[styles.reactionCount, { color: theme.colors.onSurface }]}>
                    {trackReactions.fantastic}
                  </Text>
                </View>
              </View>
            )}

            {/* Autoplay Toggle */}
            {canToggleAutoplay && (
              <View style={[styles.autoplayContainer, { 
                borderTopColor: theme.colors.outline,
                borderBottomColor: theme.colors.outline,
                backgroundColor: `${theme.colors.surfaceVariant}20`
              }]}>
                <View style={styles.autoplayContent}>
                  <View style={styles.autoplayLabelContainer}>
                    <MaterialCommunityIcons 
                      name={autoplay ? 'play-circle' : 'play-circle-outline'} 
                      size={20} 
                      color={theme.colors.onSurfaceVariant} 
                    />
                    <Text style={[styles.autoplayLabel, { color: theme.colors.onSurface }]}>
                      Autoplay
                    </Text>
                  </View>
                  <Switch
                    value={autoplay}
                    onValueChange={onToggleAutoplay}
                    color={theme.colors.primary}
                  />
                </View>
              </View>
            )}

            {/* Playback Controls */}
            <View style={styles.controls}>
              <Button
                mode="contained"
                onPress={onPlayPause}
                style={[styles.controlButton, styles.primaryControlButton]}
                contentStyle={styles.controlButtonContent}
                disabled={!canControl}
                icon={isPlaying ? 'pause' : 'play'}
                buttonColor={theme.colors.primary}
                textColor={theme.colors.onPrimary}
              >
                {isPlaying ? 'Pause' : 'Play'}
              </Button>
              <Button
                mode="outlined"
                onPress={onNext}
                style={[styles.controlButton, { borderColor: theme.colors.primary }]}
                contentStyle={styles.controlButtonContent}
                disabled={queueLength === 0 || !canControl}
                icon="skip-next"
                textColor={theme.colors.primary}
              >
                Next
              </Button>
              <Button
                mode="outlined"
                onPress={onSync}
                style={[styles.controlButton, { borderColor: theme.colors.primary }]}
                contentStyle={styles.controlButtonContent}
                icon="sync"
                textColor={theme.colors.primary}
              >
                Sync
              </Button>
            </View>
            {!canControl && (
              <View style={[styles.permissionNoticeContainer, { backgroundColor: `${theme.colors.error}15` }]}>
                <MaterialCommunityIcons name="alert-circle" size={16} color={theme.colors.error} />
                <Text style={[styles.permissionNotice, { color: theme.colors.error }]}>
                  Only room owner and admins can control playback
                </Text>
              </View>
            )}
          </>
        ) : (
          <Text style={[styles.noTrack, { color: theme.colors.onSurfaceVariant }]}>No track playing</Text>
        )}
      </Card.Content>
    </Card>
  );
};

const styles = StyleSheet.create({
  card: {
    margin: IS_MOBILE ? 12 : 16,
    marginTop: IS_MOBILE ? 12 : 16,
    borderRadius: 24,
    elevation: 8,
    overflow: 'hidden',
    ...(Platform.OS === 'web' ? {
      boxShadow: '0px 8px 24px rgba(0, 0, 0, 0.25)',
      transition: 'transform 0.2s, box-shadow 0.2s',
    } : {
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 6 },
      shadowOpacity: 0.2,
      shadowRadius: 12,
    }),
  },
  nowPlayingCard: {
    borderWidth: Platform.OS === 'web' ? 1 : 0,
    ...(Platform.OS === 'web' ? {
      boxShadow: '0px 8px 32px rgba(102, 126, 234, 0.3)',
    } : {
      shadowColor: '#667eea',
      shadowOffset: { width: 0, height: 8 },
      shadowOpacity: 0.3,
      shadowRadius: 16,
    }),
  },
  content: {
    padding: IS_MOBILE ? 14 : 16,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: IS_MOBILE ? 12 : 14,
    gap: 8,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
  },
  iconContainer: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  liveIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 12,
  },
  liveDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  liveText: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 1,
  },
  title: {
    fontSize: IS_MOBILE ? 20 : 24,
    fontWeight: '700',
    letterSpacing: -0.5,
  },
  trackInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: IS_MOBILE ? 12 : 16,
  },
  thumbnailContainer: {
    position: 'relative',
    alignItems: 'center',
    justifyContent: 'center',
  },
  thumbnailWrapper: {
    position: 'relative',
    ...(Platform.OS === 'web' ? {
      transition: 'transform 0.3s ease',
    } : {}),
  },
  thumbnailWrapperPlaying: {
    // Animation handled via pulse rings
  },
  trackThumbnail: {
    ...(Platform.OS === 'web' ? {
      boxShadow: '0px 8px 24px rgba(102, 126, 234, 0.4)',
    } : {
      shadowColor: '#667eea',
      shadowOffset: { width: 0, height: 8 },
      shadowOpacity: 0.4,
      shadowRadius: 12,
    }),
  },
  playingIndicator: {
    position: 'absolute',
    top: '50%',
    left: '50%',
    transform: [{ translateX: -20 }, { translateY: -20 }],
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  pulseRing: {
    position: 'absolute',
    width: 40,
    height: 40,
    borderRadius: 20,
    borderWidth: 2,
    opacity: 0.6,
  },
  pulseRing2: {
    width: 50,
    height: 50,
    borderRadius: 25,
    opacity: 0.3,
  },
  trackDetails: {
    marginLeft: IS_MOBILE ? 16 : 20,
    flex: 1,
  },
  trackTitle: {
    fontSize: IS_MOBILE ? 18 : 22,
    fontWeight: '700',
    letterSpacing: -0.3,
    marginBottom: 6,
  },
  platformBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    alignSelf: 'flex-start',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    marginTop: 8,
  },
  trackPlatform: {
    fontSize: IS_MOBILE ? 11 : 12,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  noTrack: {
    textAlign: 'center',
    fontStyle: 'italic',
    paddingVertical: IS_MOBILE ? 20 : 20,
  },
  controls: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: IS_MOBILE ? 8 : 10,
    marginTop: IS_MOBILE ? 12 : 14,
    flexWrap: 'wrap',
  },
  controlButton: {
    flex: IS_MOBILE ? 0 : 1,
    minWidth: IS_MOBILE ? 100 : 120,
    maxWidth: IS_MOBILE ? 130 : 160,
    borderRadius: 12,
    ...(Platform.OS === 'web' ? {
      transition: 'transform 0.2s, box-shadow 0.2s',
    } : {}),
  },
  primaryControlButton: {
    ...(Platform.OS === 'web' ? {
      boxShadow: '0px 4px 12px rgba(102, 126, 234, 0.4)',
    } : {}),
  },
  controlButtonContent: {
    paddingVertical: IS_MOBILE ? 6 : 8,
  },
  permissionNoticeContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    padding: 10,
    borderRadius: 12,
    marginTop: 8,
  },
  permissionNotice: {
    fontSize: IS_MOBILE ? 11 : 12,
    flex: 1,
    fontWeight: '500',
  },
  reactionsContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: IS_MOBILE ? 16 : 24,
    marginVertical: IS_MOBILE ? 12 : 16,
    paddingVertical: IS_MOBILE ? 12 : 16,
    paddingHorizontal: IS_MOBILE ? 10 : 14,
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderRadius: 16,
  },
  reactionButtonGroup: {
    flexDirection: 'column',
    alignItems: 'center',
    gap: IS_MOBILE ? 6 : 8,
  },
  reactionButtonTouchable: {
    padding: IS_MOBILE ? 10 : 12,
    borderRadius: 16,
    ...(Platform.OS === 'web' ? {
      cursor: 'pointer',
      transition: 'background-color 0.2s, transform 0.2s',
    } : {}),
  },
  reactionCount: {
    fontSize: IS_MOBILE ? 12 : 13,
    fontWeight: '600',
  },
  autoplayContainer: {
    marginVertical: IS_MOBILE ? 12 : 16,
    paddingVertical: IS_MOBILE ? 12 : 14,
    paddingHorizontal: IS_MOBILE ? 12 : 16,
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderRadius: 12,
  },
  autoplayContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  autoplayLabelContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  autoplayLabel: {
    fontSize: IS_MOBILE ? 14 : 16,
    fontWeight: '500',
  },
});

