import React from 'react';
import { View, StyleSheet, Platform, TouchableOpacity } from 'react-native';
import { Card, Text, Title, Button, Avatar, useTheme, Switch } from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
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
  onReaction: (reactionType: ReactionType) => void;
  loadingReaction: boolean;
  hasUser: boolean;
  queueLength: number;
  autoplay: boolean;
  onToggleAutoplay: () => void;
  canToggleAutoplay: boolean;
  showMediaPlayer: boolean;
  onToggleShowMediaPlayer: () => void;
  position?: number; // Position in milliseconds
  duration?: number; // Duration in milliseconds
  onAddToPlaylist?: () => void;
  onPlayPause?: () => void;
  onPrevious?: () => void;
  onNext?: () => void;
  hasQueue?: boolean;
  onCreatePlaylist?: () => void;
  canCreatePlaylist?: boolean;
  onMark?: () => void;
  onQueueSongs?: () => void; // Handler to open queue dialog
}

export const NowPlayingCard: React.FC<NowPlayingCardProps> = ({
  currentTrack,
  isPlaying,
  trackReactions,
  canControl,
  onReaction,
  loadingReaction,
  hasUser,
  queueLength,
  autoplay,
  onToggleAutoplay,
  canToggleAutoplay,
  showMediaPlayer,
  onToggleShowMediaPlayer,
  position = 0,
  duration = 0,
  onAddToPlaylist,
  onPlayPause,
  onPrevious,
  onNext,
  hasQueue = false,
  onCreatePlaylist,
  canCreatePlaylist = false,
  onMark,
  onQueueSongs,
}) => {
  const theme = useTheme();

  // Format time helper
  const formatTime = (ms: number): string => {
    if (!ms || isNaN(ms)) return '0:00';
    const totalSeconds = Math.floor(ms / 1000);
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  };

  // Calculate progress percentage
  const progress = duration > 0 ? (position / duration) * 100 : 0;

  // Dark-themed gradient colors - subtle gradient from dark to slightly lighter dark
  const gradientColors = [
    theme.colors.surface, // Start with surface color
    `${theme.colors.primary}08`, // Very subtle primary color tint
    theme.colors.surfaceVariant || theme.colors.surface, // End with surface variant or surface
    `${theme.colors.primary}12`, // Slight accent at the end
  ];

  return (
    <View style={styles.cardWrapper}>
      <LinearGradient
        colors={gradientColors}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.gradient}
      >
        <Card style={[styles.card, styles.nowPlayingCard, { 
          backgroundColor: 'transparent',
          borderColor: Platform.OS === 'web' ? `${theme.colors.primary}40` : 'transparent',
        }]}>
          <Card.Content style={styles.content}>
        {/* Header */}
        <View style={styles.header}>
          <View style={styles.headerLeft}>
            <View style={[styles.iconContainer, { backgroundColor: `${theme.colors.primary}20` }]}>
              <MaterialCommunityIcons 
                name={isPlaying ? "play" : "music-note"} 
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
                      { backgroundColor: trackReactions.userReactions.includes('like') ? 'rgba(25, 118, 210, 0.2)' : `${theme.colors.surfaceVariant}80` }
                    ]}
                  >
                    <MaterialCommunityIcons
                      name="thumb-up"
                      size={26}
                      color={trackReactions.userReactions.includes('like') ? '#1976d2' : theme.colors.onSurfaceVariant}
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
                      { backgroundColor: trackReactions.userReactions.includes('dislike') ? 'rgba(97, 97, 97, 0.2)' : `${theme.colors.surfaceVariant}80` }
                    ]}
                  >
                    <MaterialCommunityIcons
                      name="thumb-down"
                      size={26}
                      color={trackReactions.userReactions.includes('dislike') ? '#616161' : theme.colors.onSurfaceVariant}
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
                      { backgroundColor: trackReactions.userReactions.includes('fantastic') ? 'rgba(123, 31, 162, 0.2)' : `${theme.colors.surfaceVariant}80` }
                    ]}
                  >
                    <MaterialCommunityIcons
                      name="star"
                      size={26}
                      color={trackReactions.userReactions.includes('fantastic') ? '#7b1fa2' : theme.colors.onSurfaceVariant}
                    />
                  </TouchableOpacity>
                  <Text style={[styles.reactionCount, { color: theme.colors.onSurface }]}>
                    {trackReactions.fantastic}
                  </Text>
                </View>

                {onAddToPlaylist && (
                  <View style={styles.reactionButtonGroup}>
                    <TouchableOpacity
                      onPress={onAddToPlaylist}
                      style={[
                        styles.reactionButtonTouchable,
                        { backgroundColor: `${theme.colors.surfaceVariant}80` }
                      ]}
                    >
                      <MaterialCommunityIcons
                        name="plus-circle"
                        size={26}
                        color={theme.colors.onSurfaceVariant}
                      />
                    </TouchableOpacity>
                    <Text style={[styles.reactionCount, { color: theme.colors.onSurface }]}>
                      Que
                    </Text>
                  </View>
                )}

                {onCreatePlaylist && canCreatePlaylist && (
                  <View style={styles.reactionButtonGroup}>
                    <TouchableOpacity
                      onPress={onCreatePlaylist}
                      style={[
                        styles.reactionButtonTouchable,
                        { backgroundColor: `${theme.colors.surfaceVariant}80` }
                      ]}
                    >
                      <MaterialCommunityIcons
                        name="playlist-music"
                        size={26}
                        color={theme.colors.onSurfaceVariant}
                      />
                    </TouchableOpacity>
                    <Text style={[styles.reactionCount, { color: theme.colors.onSurface }]}>
                      Playlist
                    </Text>
                  </View>
                )}

                {onMark && (
                  <View style={styles.reactionButtonGroup}>
                    <TouchableOpacity
                      onPress={onMark}
                      style={[
                        styles.reactionButtonTouchable,
                        { backgroundColor: `${theme.colors.surfaceVariant}80` }
                      ]}
                    >
                      <MaterialCommunityIcons
                        name="pin"
                        size={26}
                        color={theme.colors.onSurfaceVariant}
                      />
                    </TouchableOpacity>
                    <Text style={[styles.reactionCount, { color: theme.colors.onSurface }]}>
                      Mark
                    </Text>
                  </View>
                )}
              </View>
            )}

            {/* Mobile Playback Controls - Only on mobile devices, not web */}
            {IS_MOBILE && Platform.OS !== 'web' && onPlayPause && onPrevious && onNext && (
              <View style={[styles.mobileControlsContainer, { 
                borderTopColor: theme.colors.outline,
                borderBottomColor: theme.colors.outline,
                backgroundColor: `${theme.colors.surfaceVariant}20`
              }]}>
                <View style={styles.mobileControlsRow}>
                  <TouchableOpacity
                    onPress={onPlayPause}
                    disabled={!currentTrack || !canControl}
                    style={[
                      styles.mobileControlButton,
                      { backgroundColor: theme.colors.primary }
                    ]}
                  >
                    <MaterialCommunityIcons
                      name={isPlaying ? 'pause' : 'play'}
                      size={28}
                      color={theme.colors.onPrimary}
                    />
                  </TouchableOpacity>
                  <TouchableOpacity
                    onPress={onPrevious}
                    disabled={!currentTrack || !canControl}
                    style={[
                      styles.mobileControlButton,
                      { backgroundColor: theme.colors.surfaceVariant }
                    ]}
                  >
                    <MaterialCommunityIcons
                      name="skip-previous"
                      size={24}
                      color={theme.colors.onSurface}
                    />
                  </TouchableOpacity>
                  <TouchableOpacity
                    onPress={onNext}
                    disabled={!hasQueue || !canControl}
                    style={[
                      styles.mobileControlButton,
                      { backgroundColor: theme.colors.surfaceVariant }
                    ]}
                  >
                    <MaterialCommunityIcons
                      name="skip-next"
                      size={24}
                      color={theme.colors.onSurface}
                    />
                  </TouchableOpacity>
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

            {/* Show Mediaplayer Toggle */}
            <View style={[styles.autoplayContainer, { 
              borderTopColor: theme.colors.outline,
              borderBottomColor: theme.colors.outline,
              backgroundColor: `${theme.colors.surfaceVariant}20`
            }]}>
              <View style={styles.autoplayContent}>
                <View style={styles.autoplayLabelContainer}>
                  <MaterialCommunityIcons 
                    name={showMediaPlayer ? 'video' : 'video-off'} 
                    size={20} 
                    color={theme.colors.onSurfaceVariant} 
                  />
                  <Text style={[styles.autoplayLabel, { color: theme.colors.onSurface }]}>
                    Show Mediaplayer
                  </Text>
                </View>
                <Switch
                  value={showMediaPlayer}
                  onValueChange={onToggleShowMediaPlayer}
                  color={theme.colors.primary}
                />
              </View>
            </View>

            {/* Progress Bar and Time Display - Show for SoundCloud tracks */}
            {currentTrack?.url?.includes('soundcloud.com') && duration > 0 && (
              <View style={styles.progressContainer}>
                <View style={styles.progressBarContainer}>
                  <View 
                    style={[
                      styles.progressBar, 
                      { 
                        width: `${Math.min(100, Math.max(0, progress))}%`,
                        backgroundColor: theme.colors.primary,
                      }
                    ]} 
                  />
                </View>
                <View style={styles.timeContainer}>
                  <Text style={[styles.timeText, { color: theme.colors.onSurfaceVariant }]}>
                    {formatTime(position)}
                  </Text>
                  <Text style={[styles.timeText, { color: theme.colors.onSurfaceVariant }]}>
                    {formatTime(duration)}
                  </Text>
                </View>
              </View>
            )}

          </>
        ) : (
          <View style={styles.noTrackContainer}>
            <Text style={[styles.noTrack, { color: theme.colors.onSurfaceVariant }]}>No track playing</Text>
            {onQueueSongs && (
              <Button
                mode="contained"
                icon="playlist-plus"
                onPress={onQueueSongs}
                style={styles.queueButton}
                contentStyle={styles.queueButtonContent}
              >
                Queue songs
              </Button>
            )}
          </View>
        )}
          </Card.Content>
        </Card>
      </LinearGradient>
    </View>
  );
};

const styles = StyleSheet.create({
  cardWrapper: {
    margin: IS_MOBILE ? 12 : 16,
    marginTop: IS_MOBILE ? 12 : 16,
    borderRadius: 24,
    overflow: 'hidden',
    ...(Platform.OS === 'web' ? {
      boxShadow: '0px 8px 24px rgba(0, 0, 0, 0.25)',
      transition: 'transform 0.2s, box-shadow 0.2s',
    } : {
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 6 },
      shadowOpacity: 0.2,
      shadowRadius: 12,
      elevation: 8,
    }),
  },
  gradient: {
    borderRadius: 24,
    overflow: 'hidden',
  },
  card: {
    borderRadius: 24,
    overflow: 'hidden',
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
  noTrackContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: IS_MOBILE ? 20 : 24,
    gap: 16,
  },
  queueButton: {
    marginTop: 8,
    borderRadius: 12,
  },
  queueButtonContent: {
    paddingHorizontal: 16,
    paddingVertical: 8,
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
  progressContainer: {
    marginVertical: IS_MOBILE ? 12 : 16,
    paddingHorizontal: IS_MOBILE ? 4 : 8,
  },
  progressBarContainer: {
    width: '100%',
    height: 4,
    backgroundColor: 'rgba(0, 0, 0, 0.1)',
    borderRadius: 2,
    overflow: 'hidden',
    marginBottom: 8,
    ...(Platform.OS === 'web' ? {
      cursor: 'pointer',
    } : {}),
  },
  progressBar: {
    height: '100%',
    borderRadius: 2,
    ...(Platform.OS === 'web' ? {
      transition: 'width 0.3s ease',
    } : {}),
  },
  timeContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 4,
  },
  timeText: {
    fontSize: IS_MOBILE ? 11 : 12,
    fontWeight: '500',
    fontVariant: ['tabular-nums'],
  },
  mobileControlsContainer: {
    marginVertical: IS_MOBILE ? 12 : 16,
    paddingVertical: IS_MOBILE ? 12 : 14,
    paddingHorizontal: IS_MOBILE ? 12 : 16,
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderRadius: 12,
  },
  mobileControlsRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 12,
  },
  mobileControlButton: {
    width: 56,
    height: 56,
    borderRadius: 28,
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 2,
    ...(Platform.OS === 'web' ? {
      boxShadow: '0px 2px 8px rgba(0, 0, 0, 0.2)',
      cursor: 'pointer',
      transition: 'transform 0.2s, box-shadow 0.2s',
    } : {
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.2,
      shadowRadius: 4,
    }),
  },
});

