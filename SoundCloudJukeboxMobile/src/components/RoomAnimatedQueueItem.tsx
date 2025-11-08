import React, { useRef } from 'react';
import { View, StyleSheet, TouchableOpacity, Animated, Platform } from 'react-native';
import { Text, Avatar, IconButton, useTheme } from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { Track } from '../types';
import { getThumbnailUrl } from '../utils/imageUtils';
import { Dimensions } from 'react-native';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const IS_MOBILE = SCREEN_WIDTH < 768;

interface AnimatedQueueItemProps {
  track: Track;
  index: number;
  canRemove: boolean;
  isRemoving: boolean;
  theme: any;
  user: any;
  onRemove: (trackId: string) => void;
}

export const AnimatedQueueItem: React.FC<AnimatedQueueItemProps> = ({
  track,
  index,
  canRemove,
  isRemoving,
  theme,
  user,
  onRemove,
}) => {
  const animatedValue = useRef(new Animated.Value(1)).current;
  const slideAnim = useRef(new Animated.Value(0)).current;

  React.useEffect(() => {
    if (isRemoving) {
      Animated.parallel([
        Animated.timing(animatedValue, {
          toValue: 0,
          duration: 300,
          useNativeDriver: Platform.OS !== 'web',
        }),
        Animated.timing(slideAnim, {
          toValue: 100, // Slide to the right (where the remove button is)
          duration: 300,
          useNativeDriver: Platform.OS !== 'web',
        }),
      ]).start();
    } else {
      // Reset when item is added
      animatedValue.setValue(1);
      slideAnim.setValue(0);
    }
  }, [isRemoving, animatedValue, slideAnim]);

  return (
    <Animated.View
      style={[
        styles.queueItem, 
        { 
          backgroundColor: index === 0 
            ? `${theme.colors.primary}15` 
            : theme.colors.surfaceVariant,
          borderLeftColor: theme.colors.primary,
          borderLeftWidth: index === 0 ? 4 : 0,
          opacity: animatedValue,
          transform: [{ translateX: slideAnim }],
        }
      ]}
    >
      <TouchableOpacity
        activeOpacity={0.8}
        style={styles.queueItemContent}
      >
        <View style={[
          styles.queueItemNumber, 
          { 
            backgroundColor: index === 0 
              ? theme.colors.primary 
              : `${theme.colors.primary}20` 
          }
        ]}>
          <Text style={[
            styles.queueNumber, 
            { 
              color: index === 0 
                ? theme.colors.onPrimary 
                : theme.colors.primary 
            }
          ]}>
            {index + 1}
          </Text>
          {index === 0 && (
            <View style={[styles.nextIndicator, { backgroundColor: theme.colors.onPrimary }]} />
          )}
        </View>
        <Avatar.Image
          size={IS_MOBILE ? 60 : 64}
          source={{ uri: getThumbnailUrl(track.info?.thumbnail, IS_MOBILE ? 60 : 64) }}
          style={styles.queueItemThumbnail}
        />
        <View style={styles.queueItemDetails}>
          <Text 
            style={[styles.queueItemTitle, { color: theme.colors.onSurface }]}
            numberOfLines={1}
          >
            {track.info?.fullTitle || 'Unknown Track'}
          </Text>
          <View style={styles.queueItemMeta}>
            <MaterialCommunityIcons 
              name="account" 
              size={14} 
              color={theme.colors.onSurfaceVariant} 
            />
            <Text 
              style={[styles.queueItemDescription, { color: theme.colors.onSurfaceVariant }]}
              numberOfLines={1}
            >
              {track.addedBy === user?.id ? 'You' : 'Someone'}
            </Text>
            {index === 0 && (
              <>
                <View style={[styles.metaDivider, { backgroundColor: theme.colors.onSurfaceVariant }]} />
                <MaterialCommunityIcons 
                  name="arrow-right" 
                  size={14} 
                  color={theme.colors.primary} 
                />
                <Text style={[styles.nextLabel, { color: theme.colors.primary }]}>
                  Next
                </Text>
              </>
            )}
          </View>
        </View>
      </TouchableOpacity>
      {canRemove && (
        <IconButton
          icon="delete-outline"
          size={20}
          iconColor={theme.colors.error}
          onPress={() => onRemove(track.id)}
          style={styles.queueItemRemoveButton}
        />
      )}
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  queueItem: {
    marginVertical: IS_MOBILE ? 8 : 10,
    marginHorizontal: IS_MOBILE ? 4 : 8,
    borderRadius: 16,
    padding: IS_MOBILE ? 14 : 16,
    flexDirection: 'row',
    alignItems: 'center',
    ...(Platform.OS === 'web' ? {
      cursor: 'pointer',
      transition: 'all 0.2s ease',
      ':hover': {
        transform: 'translateY(-2px)',
        boxShadow: '0px 6px 20px rgba(0, 0, 0, 0.2)',
      },
    } : {}),
  },
  queueItemContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: IS_MOBILE ? 12 : 16,
    flex: 1,
  },
  queueItemNumber: {
    width: IS_MOBILE ? 36 : 40,
    height: IS_MOBILE ? 36 : 40,
    borderRadius: IS_MOBILE ? 18 : 20,
    justifyContent: 'center',
    alignItems: 'center',
    position: 'relative',
  },
  nextIndicator: {
    position: 'absolute',
    bottom: -2,
    right: -2,
    width: 12,
    height: 12,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  queueNumber: {
    fontSize: IS_MOBILE ? 13 : 15,
    fontWeight: '700',
  },
  queueItemThumbnail: {
    borderRadius: 12,
    ...(Platform.OS === 'web' ? {
      boxShadow: '0px 4px 12px rgba(0, 0, 0, 0.25)',
    } : {
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.25,
      shadowRadius: 6,
      elevation: 3,
    }),
  },
  queueItemDetails: {
    flex: 1,
    marginLeft: 8,
    justifyContent: 'center',
  },
  queueItemTitle: {
    fontSize: IS_MOBILE ? 15 : 17,
    fontWeight: '600',
    marginBottom: 8,
    letterSpacing: -0.2,
  },
  queueItemMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flexWrap: 'wrap',
  },
  queueItemDescription: {
    fontSize: IS_MOBILE ? 12 : 13,
    fontWeight: '500',
  },
  queueItemRemoveButton: {
    margin: 0,
    marginLeft: 8,
  },
  metaDivider: {
    width: 1,
    height: 12,
    opacity: 0.3,
  },
  nextLabel: {
    fontSize: IS_MOBILE ? 11 : 12,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
});

