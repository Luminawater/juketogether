import React, { useState } from 'react';
import { View, StyleSheet, Animated, PanResponder, Dimensions, Platform } from 'react-native';
import { Card, Button, Text, IconButton, useTheme } from 'react-native-paper';
import { Track } from '../types';

interface FloatingPlayerProps {
  currentTrack: Track | null;
  isPlaying: boolean;
  onPlayPause: () => void;
  onNext: () => void;
  onClose?: () => void;
  minimized?: boolean;
  onToggleMinimize?: () => void;
}

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');
const IS_MOBILE = SCREEN_WIDTH < 768;
const PLAYER_WIDTH = IS_MOBILE ? Math.min(SCREEN_WIDTH - 32, 300) : 300;
const MINIMIZED_WIDTH = IS_MOBILE ? Math.min(SCREEN_WIDTH - 32, 250) : 250;

export const FloatingPlayer: React.FC<FloatingPlayerProps> = ({
  currentTrack,
  isPlaying,
  onPlayPause,
  onNext,
  onClose,
  minimized = false,
  onToggleMinimize,
}) => {
  const theme = useTheme();
  const [pan] = useState(new Animated.ValueXY());
  const [position, setPosition] = useState({ x: SCREEN_WIDTH - 80, y: SCREEN_HEIGHT - 200 });

  const panResponder = PanResponder.create({
    onStartShouldSetPanResponder: () => true,
    onMoveShouldSetPanResponder: () => true,
    onPanResponderGrant: () => {
      pan.setOffset({
        x: position.x,
        y: position.y,
      });
    },
    onPanResponderMove: Animated.event(
      [null, { dx: pan.x, dy: pan.y }],
      { useNativeDriver: false }
    ),
    onPanResponderRelease: (evt, gestureState) => {
      pan.flattenOffset();
      const newX = Math.max(0, Math.min(SCREEN_WIDTH - 80, position.x + gestureState.dx));
      const newY = Math.max(0, Math.min(SCREEN_HEIGHT - 200, position.y + gestureState.dy));
      setPosition({ x: newX, y: newY });
      pan.setValue({ x: 0, y: 0 });
    },
  });

  if (!currentTrack) {
    return null;
  }

  if (minimized) {
    return (
      <Animated.View
        style={[
          styles.minimizedContainer,
          {
            transform: [{ translateX: pan.x }, { translateY: pan.y }],
            left: position.x,
            top: position.y,
          },
        ]}
        {...panResponder.panHandlers}
      >
        <Card style={[styles.minimizedCard, { backgroundColor: theme.colors.surface }]}>
          <Card.Content style={styles.minimizedContent}>
            <View style={styles.minimizedTrackInfo}>
              <Text numberOfLines={1} style={[styles.minimizedTrackTitle, { color: theme.colors.onSurface }]}>
                {currentTrack.info?.fullTitle || currentTrack.info?.title || 'Unknown Track'}
              </Text>
            </View>
            <View style={styles.minimizedControls}>
              <IconButton
                icon={isPlaying ? 'pause' : 'play'}
                size={24}
                onPress={onPlayPause}
                iconColor={theme.colors.primary}
              />
              {onToggleMinimize && (
                <IconButton
                  icon="chevron-up"
                  size={24}
                  onPress={onToggleMinimize}
                  iconColor={theme.colors.onSurface}
                />
              )}
              {onClose && (
                <IconButton
                  icon="close"
                  size={24}
                  onPress={onClose}
                  iconColor={theme.colors.onSurface}
                />
              )}
            </View>
          </Card.Content>
        </Card>
      </Animated.View>
    );
  }

  return (
    <Animated.View
      style={[
        styles.container,
        {
          transform: [{ translateX: pan.x }, { translateY: pan.y }],
          left: position.x,
          top: position.y,
        },
      ]}
      {...panResponder.panHandlers}
    >
      <Card style={[styles.card, { backgroundColor: theme.colors.surface }]}>
        <Card.Content>
          <View style={styles.header}>
            <Text style={[styles.title, { color: theme.colors.onSurface }]}>Now Playing</Text>
            <View style={styles.headerButtons}>
              {onToggleMinimize && (
                <IconButton
                  icon="chevron-down"
                  size={20}
                  onPress={onToggleMinimize}
                  iconColor={theme.colors.onSurface}
                />
              )}
              {onClose && (
                <IconButton
                  icon="close"
                  size={20}
                  onPress={onClose}
                  iconColor={theme.colors.onSurface}
                />
              )}
            </View>
          </View>

          <View style={styles.trackInfo}>
            <Text style={[styles.trackTitle, { color: theme.colors.onSurface }]} numberOfLines={2}>
              {currentTrack.info?.fullTitle || currentTrack.info?.title || 'Unknown Track'}
            </Text>
            <Text style={[styles.trackPlatform, { color: theme.colors.onSurfaceVariant }]}>
              {currentTrack.platform === 'spotify' ? '🎵 Spotify' : '🎵 SoundCloud'}
            </Text>
          </View>

          <View style={styles.controls}>
            <Button
              mode="contained"
              onPress={onPlayPause}
              icon={isPlaying ? 'pause' : 'play-arrow'}
              style={styles.controlButton}
            >
              {isPlaying ? 'Pause' : 'Play'}
            </Button>
            <Button
              mode="outlined"
              onPress={onNext}
              icon="skip-next"
              style={styles.controlButton}
            >
              Next
            </Button>
          </View>
        </Card.Content>
      </Card>
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    width: PLAYER_WIDTH,
    zIndex: 1000,
    elevation: 10,
    ...(Platform.OS === 'web' ? {
      boxShadow: '0px 4px 12px rgba(0, 0, 0, 0.3)',
    } : {}),
  },
  minimizedContainer: {
    position: 'absolute',
    width: MINIMIZED_WIDTH,
    zIndex: 1000,
    elevation: 10,
    ...(Platform.OS === 'web' ? {
      boxShadow: '0px 4px 12px rgba(0, 0, 0, 0.3)',
    } : {}),
  },
  card: {
    elevation: 8,
    borderRadius: 16,
    ...(Platform.OS === 'web' ? {
      boxShadow: '0px 4px 12px rgba(0, 0, 0, 0.3)',
    } : {}),
  },
  minimizedCard: {
    elevation: 8,
    borderRadius: 12,
    ...(Platform.OS === 'web' ? {
      boxShadow: '0px 4px 12px rgba(0, 0, 0, 0.3)',
    } : {}),
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: IS_MOBILE ? 10 : 12,
  },
  title: {
    fontSize: IS_MOBILE ? 14 : 16,
    fontWeight: 'bold',
  },
  headerButtons: {
    flexDirection: 'row',
  },
  trackInfo: {
    marginBottom: IS_MOBILE ? 12 : 16,
  },
  trackTitle: {
    fontSize: IS_MOBILE ? 13 : 14,
    fontWeight: '600',
    marginBottom: 4,
  },
  trackPlatform: {
    fontSize: IS_MOBILE ? 11 : 12,
  },
  controls: {
    flexDirection: 'row',
    gap: IS_MOBILE ? 6 : 8,
  },
  controlButton: {
    flex: 1,
    minHeight: 44, // iOS/Android minimum touch target
  },
  minimizedContent: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 4,
  },
  minimizedTrackInfo: {
    flex: 1,
    marginRight: 8,
  },
  minimizedTrackTitle: {
    fontSize: IS_MOBILE ? 11 : 12,
    fontWeight: '600',
  },
  minimizedControls: {
    flexDirection: 'row',
  },
});

