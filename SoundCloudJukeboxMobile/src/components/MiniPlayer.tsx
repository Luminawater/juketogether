import React, { useState } from 'react';
import { View, StyleSheet, Platform, Dimensions, TouchableOpacity, Animated } from 'react-native';
import { Card, Text, IconButton, useTheme, Avatar } from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { Track } from '../types';
import { getThumbnailUrl } from '../utils/imageUtils';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');
const IS_MOBILE = SCREEN_WIDTH < 768;

interface MiniPlayerProps {
  currentTrack: Track | null;
  isPlaying: boolean;
  roomName: string;
  onPlayPause: () => void;
  onExpand: () => void;
  onClose: () => void;
  position?: 'left' | 'right';
  onPrevious?: () => void;
  onNext?: () => void;
  hasQueue?: boolean;
  canControl?: boolean;
}

export const MiniPlayer: React.FC<MiniPlayerProps> = ({
  currentTrack,
  isPlaying,
  roomName,
  onPlayPause,
  onExpand,
  onClose,
  position = 'right',
  onPrevious,
  onNext,
  hasQueue = false,
  canControl = true,
}) => {
  const theme = useTheme();
  const [isExpanded, setIsExpanded] = useState(false);

  const handleExpand = () => {
    setIsExpanded(true);
    onExpand();
  };

  if (!currentTrack) {
    return null;
  }

  return (
    <View style={[styles.container, position === 'left' && styles.containerLeft]}>
      <Card
        style={[
          styles.card,
          {
            backgroundColor: theme.colors.surface,
            borderColor: theme.colors.primary,
            borderWidth: 2,
          },
        ]}
        elevation={8}
      >
        <Card.Content style={styles.content}>
          <TouchableOpacity
            style={styles.trackInfo}
            onPress={handleExpand}
            activeOpacity={0.7}
          >
            <Avatar.Image
              size={IS_MOBILE ? 48 : 56}
              source={{
                uri: getThumbnailUrl(currentTrack.info?.thumbnail, IS_MOBILE ? 48 : 56),
              }}
              style={styles.thumbnail}
            />
            <View style={styles.textContainer}>
              <Text
                style={[styles.trackTitle, { color: theme.colors.onSurface }]}
                numberOfLines={1}
              >
                {currentTrack.info?.fullTitle || 'Unknown Track'}
              </Text>
              <Text
                style={[styles.roomName, { color: theme.colors.onSurfaceVariant }]}
                numberOfLines={1}
              >
                {roomName}
              </Text>
            </View>
          </TouchableOpacity>

          <View style={styles.controls}>
            {onPrevious && (
              <IconButton
                icon="skip-previous"
                size={IS_MOBILE ? 20 : 24}
                iconColor={theme.colors.onSurface}
                onPress={onPrevious}
                disabled={!currentTrack || !canControl}
                style={styles.controlButton}
              />
            )}
            <IconButton
              icon={isPlaying ? 'pause' : 'play'}
              size={IS_MOBILE ? 24 : 28}
              iconColor={theme.colors.primary}
              onPress={onPlayPause}
              disabled={!currentTrack || !canControl}
              style={styles.playButton}
            />
            {onNext && (
              <IconButton
                icon="skip-next"
                size={IS_MOBILE ? 20 : 24}
                iconColor={theme.colors.onSurface}
                onPress={onNext}
                disabled={!hasQueue || !canControl}
                style={styles.controlButton}
              />
            )}
            <IconButton
              icon="close"
              size={IS_MOBILE ? 20 : 24}
              iconColor={theme.colors.onSurfaceVariant}
              onPress={onClose}
              style={styles.closeButton}
            />
          </View>
        </Card.Content>
      </Card>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    bottom: IS_MOBILE ? 16 : 24,
    right: IS_MOBILE ? 16 : 24,
    zIndex: 1000,
    ...(Platform.OS === 'web' ? {
      position: 'fixed',
    } : {}),
  },
  containerLeft: {
    right: undefined,
    left: IS_MOBILE ? 16 : 24,
  },
  card: {
    borderRadius: 16,
    minWidth: IS_MOBILE ? 280 : 320,
    maxWidth: IS_MOBILE ? SCREEN_WIDTH - 32 : 400,
    ...(Platform.OS === 'web' ? {
      boxShadow: '0px 8px 24px rgba(0, 0, 0, 0.3)',
    } : {
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.3,
      shadowRadius: 8,
    }),
  },
  content: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: IS_MOBILE ? 8 : 12,
    gap: 8,
  },
  trackInfo: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  thumbnail: {
    ...(Platform.OS === 'web' ? {
      boxShadow: '0px 2px 8px rgba(0, 0, 0, 0.2)',
    } : {
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.2,
      shadowRadius: 4,
    }),
  },
  textContainer: {
    flex: 1,
    gap: 4,
  },
  trackTitle: {
    fontSize: IS_MOBILE ? 13 : 15,
    fontWeight: '600',
  },
  roomName: {
    fontSize: IS_MOBILE ? 11 : 12,
  },
  controls: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  playButton: {
    margin: 0,
  },
  controlButton: {
    margin: 0,
  },
  closeButton: {
    margin: 0,
  },
});

