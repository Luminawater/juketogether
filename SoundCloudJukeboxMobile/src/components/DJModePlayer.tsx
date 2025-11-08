import React, { useState } from 'react';
import { View, StyleSheet, Platform, Dimensions, TouchableOpacity } from 'react-native';
import { Card, Text, Button, Avatar, useTheme, Slider, Menu, IconButton } from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { Track } from '../types';
import { WaveformView } from './WaveformView';
import { getThumbnailUrl } from '../utils/imageUtils';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const IS_MOBILE = SCREEN_WIDTH < 768;

interface DJModePlayerProps {
  playerNumber: number;
  track: Track | null;
  isPlaying: boolean;
  isActive: boolean;
  volume?: number;
  bpm?: number | null;
  position?: number;
  duration?: number;
  onPlayPause?: () => void;
  onLoadTrack?: () => void;
  onVolumeChange?: (volume: number) => void;
  onSeek?: (position: number) => void;
  onSync?: (targetPlayerIndex: number) => void;
}

export const DJModePlayer: React.FC<DJModePlayerProps> = ({
  playerNumber,
  track,
  isPlaying,
  isActive,
  volume = 0.5,
  bpm = null,
  position = 0,
  duration = 0,
  onPlayPause,
  onLoadTrack,
  onVolumeChange,
  onSeek,
  onSync,
}) => {
  const theme = useTheme();
  const [syncMenuVisible, setSyncMenuVisible] = useState(false);

  if (!isActive) {
    return (
      <Card style={[styles.card, styles.inactiveCard, { backgroundColor: theme.colors.surfaceVariant }]}>
        <Card.Content style={styles.content}>
          <View style={styles.inactiveContent}>
            <MaterialCommunityIcons 
              name="equalizer" 
              size={48} 
              color={theme.colors.onSurfaceVariant} 
            />
            <Text style={[styles.inactiveText, { color: theme.colors.onSurfaceVariant }]}>
              Player {playerNumber}
            </Text>
            <Text style={[styles.inactiveSubtext, { color: theme.colors.onSurfaceVariant }]}>
              Inactive
            </Text>
          </View>
        </Card.Content>
      </Card>
    );
  }

  return (
    <Card style={[styles.card, styles.activeCard, { 
      backgroundColor: theme.colors.surface,
      borderColor: isPlaying ? theme.colors.primary : theme.colors.outline,
    }]}>
      <Card.Content style={styles.content}>
        {/* Player Header */}
        <View style={styles.header}>
          <View style={[styles.playerBadge, { backgroundColor: `${theme.colors.primary}20` }]}>
            <MaterialCommunityIcons 
              name="equalizer" 
              size={20} 
              color={theme.colors.primary} 
            />
            <Text style={[styles.playerNumber, { color: theme.colors.primary }]}>
              {playerNumber}
            </Text>
          </View>
          {isPlaying && (
            <View style={[styles.playingBadge, { backgroundColor: `${theme.colors.primary}20` }]}>
              <View style={[styles.playingDot, { backgroundColor: theme.colors.primary }]} />
              <Text style={[styles.playingText, { color: theme.colors.primary }]}>PLAYING</Text>
            </View>
          )}
        </View>

            {/* Track Display */}
        {track ? (
          <>
            <View style={styles.trackDisplay}>
              <Avatar.Image
                size={IS_MOBILE ? 80 : 100}
                source={{ uri: getThumbnailUrl(track.info?.thumbnail, IS_MOBILE ? 80 : 100) }}
                style={[styles.trackThumbnail, isPlaying && styles.trackThumbnailPlaying]}
              />
              <View style={styles.trackInfo}>
                <Text 
                  style={[styles.trackTitle, { color: theme.colors.onSurface }]} 
                  numberOfLines={2}
                >
                  {track.info?.fullTitle || 'Unknown Track'}
                </Text>
                <View style={styles.trackMeta}>
                  <View style={[styles.platformBadge, { backgroundColor: `${theme.colors.primary}15` }]}>
                    <MaterialCommunityIcons 
                      name={
                        track.url?.includes('spotify') ? 'spotify' : 
                        track.url?.includes('youtube') ? 'youtube' : 
                        'music-note'
                      }
                      size={12}
                      color={theme.colors.primary}
                    />
                    <Text style={[styles.platformText, { color: theme.colors.primary }]}>
                      {track.url?.includes('spotify') ? 'Spotify' : 
                       track.url?.includes('youtube') ? 'YouTube' : 
                       'SoundCloud'}
                    </Text>
                  </View>
                  {bpm !== null && (
                    <View style={[styles.bpmBadge, { backgroundColor: `${theme.colors.secondary}20` }]}>
                      <MaterialCommunityIcons 
                        name="metronome"
                        size={12}
                        color={theme.colors.secondary}
                      />
                      <Text style={[styles.bpmText, { color: theme.colors.secondary }]}>
                        {Math.round(bpm)} BPM
                      </Text>
                    </View>
                  )}
                </View>
              </View>
            </View>

            {/* Waveform */}
            {duration > 0 && (
              <View style={styles.waveformContainer}>
                <WaveformView
                  position={position}
                  duration={duration}
                  isPlaying={isPlaying}
                  onSeek={onSeek}
                />
              </View>
            )}

            {/* Volume Control */}
            {onVolumeChange && (
              <View style={styles.volumeContainer}>
                <MaterialCommunityIcons 
                  name="volume-low" 
                  size={16} 
                  color={theme.colors.onSurfaceVariant} 
                />
                <Slider
                  style={styles.volumeSlider}
                  value={volume}
                  onValueChange={onVolumeChange}
                  minimumValue={0}
                  maximumValue={1}
                  thumbTintColor={theme.colors.primary}
                  minimumTrackTintColor={theme.colors.primary}
                  maximumTrackTintColor={theme.colors.surfaceVariant}
                />
                <MaterialCommunityIcons 
                  name="volume-high" 
                  size={16} 
                  color={theme.colors.onSurfaceVariant} 
                />
                <Text style={[styles.volumeText, { color: theme.colors.onSurfaceVariant }]}>
                  {Math.round(volume * 100)}%
                </Text>
              </View>
            )}

            {/* Controls */}
            <View style={styles.controls}>
              {onPlayPause && (
                <Button
                  mode={isPlaying ? "contained" : "outlined"}
                  onPress={onPlayPause}
                  icon={isPlaying ? 'pause' : 'play'}
                  style={styles.controlButton}
                  buttonColor={theme.colors.primary}
                  textColor={isPlaying ? theme.colors.onPrimary : theme.colors.primary}
                  compact
                >
                  {isPlaying ? 'Pause' : 'Play'}
                </Button>
              )}
              {onSync && (
                <Menu
                  visible={syncMenuVisible}
                  onDismiss={() => setSyncMenuVisible(false)}
                  anchor={
                    <IconButton
                      icon="sync"
                      iconColor={theme.colors.primary}
                      size={20}
                      onPress={() => setSyncMenuVisible(true)}
                    />
                  }
                >
                  {[1, 2, 3, 4].map((num) => {
                    if (num === playerNumber) return null;
                    return (
                      <Menu.Item
                        key={num}
                        onPress={() => {
                          onSync(num - 1);
                          setSyncMenuVisible(false);
                        }}
                        title={`Sync with Player ${num}`}
                      />
                    );
                  })}
                </Menu>
              )}
            </View>
          </>
        ) : (
          <View style={styles.emptyState}>
            <MaterialCommunityIcons 
              name="music-note-off" 
              size={48} 
              color={theme.colors.onSurfaceVariant} 
            />
            <Text style={[styles.emptyText, { color: theme.colors.onSurfaceVariant }]}>
              No track loaded
            </Text>
            {onLoadTrack && (
              <Button
                mode="outlined"
                onPress={onLoadTrack}
                icon="plus"
                style={styles.loadButton}
                textColor={theme.colors.primary}
                compact
              >
                Load Track
              </Button>
            )}
          </View>
        )}
      </Card.Content>
    </Card>
  );
};

const styles = StyleSheet.create({
  card: {
    margin: IS_MOBILE ? 8 : 12,
    borderRadius: 20,
    elevation: 4,
    overflow: 'hidden',
    borderWidth: 2,
    ...(Platform.OS === 'web' ? {
      boxShadow: '0px 4px 16px rgba(0, 0, 0, 0.15)',
      transition: 'transform 0.2s, box-shadow 0.2s',
    } : {
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.15,
      shadowRadius: 8,
    }),
  },
  activeCard: {
    ...(Platform.OS === 'web' ? {
      boxShadow: '0px 4px 20px rgba(102, 126, 234, 0.25)',
    } : {
      shadowColor: '#667eea',
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.25,
      shadowRadius: 10,
    }),
  },
  inactiveCard: {
    opacity: 0.6,
    borderWidth: 1,
    borderStyle: 'dashed',
  },
  content: {
    padding: IS_MOBILE ? 12 : 16,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: IS_MOBILE ? 12 : 16,
  },
  playerBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 12,
  },
  playerNumber: {
    fontSize: IS_MOBILE ? 12 : 14,
    fontWeight: '700',
  },
  playingBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 10,
  },
  playingDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  playingText: {
    fontSize: 9,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  trackDisplay: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: IS_MOBILE ? 12 : 16,
    marginBottom: IS_MOBILE ? 12 : 16,
  },
  trackThumbnail: {
    ...(Platform.OS === 'web' ? {
      boxShadow: '0px 4px 12px rgba(0, 0, 0, 0.2)',
    } : {
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.2,
      shadowRadius: 6,
    }),
  },
  trackThumbnailPlaying: {
    ...(Platform.OS === 'web' ? {
      boxShadow: '0px 4px 16px rgba(102, 126, 234, 0.4)',
    } : {
      shadowColor: '#667eea',
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.4,
      shadowRadius: 8,
    }),
  },
  trackInfo: {
    flex: 1,
  },
  trackTitle: {
    fontSize: IS_MOBILE ? 14 : 16,
    fontWeight: '600',
    marginBottom: 6,
  },
  platformBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    alignSelf: 'flex-start',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  platformText: {
    fontSize: IS_MOBILE ? 9 : 10,
    fontWeight: '600',
    textTransform: 'uppercase',
  },
  trackMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 4,
    flexWrap: 'wrap',
  },
  bpmBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  bpmText: {
    fontSize: IS_MOBILE ? 9 : 10,
    fontWeight: '600',
  },
  waveformContainer: {
    marginVertical: IS_MOBILE ? 12 : 16,
  },
  volumeContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: IS_MOBILE ? 12 : 16,
  },
  volumeSlider: {
    flex: 1,
  },
  volumeText: {
    fontSize: IS_MOBILE ? 10 : 12,
    fontWeight: '600',
    minWidth: 35,
    textAlign: 'right',
  },
  controls: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
  },
  controlButton: {
    flex: 1,
    borderRadius: 10,
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: IS_MOBILE ? 24 : 32,
    gap: 12,
  },
  emptyText: {
    fontSize: IS_MOBILE ? 12 : 14,
    fontWeight: '500',
  },
  loadButton: {
    marginTop: 8,
  },
  inactiveContent: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: IS_MOBILE ? 24 : 32,
    gap: 8,
  },
  inactiveText: {
    fontSize: IS_MOBILE ? 14 : 16,
    fontWeight: '600',
  },
  inactiveSubtext: {
    fontSize: IS_MOBILE ? 11 : 12,
  },
});

