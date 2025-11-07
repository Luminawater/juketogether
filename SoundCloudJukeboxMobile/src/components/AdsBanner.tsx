import React, { useState, useEffect } from 'react';
import { View, StyleSheet, TouchableOpacity, Platform, Linking } from 'react-native';
import { Card, Text, useTheme } from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { Dimensions } from 'react-native';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const IS_MOBILE = SCREEN_WIDTH < 768;

interface Ad {
  id: string;
  title: string;
  description: string;
  url?: string;
  icon?: string;
  color?: string;
}

// Sample ads - in production, these would come from an API or database
const ADS: Ad[] = [
  {
    id: '1',
    title: 'Upgrade to PRO',
    description: 'Remove ads and unlock premium features',
    url: '/upgrade',
    icon: 'crown',
    color: '#667eea',
  },
  {
    id: '2',
    title: 'Premium Music Experience',
    description: 'Get unlimited songs and exclusive features',
    url: '/upgrade',
    icon: 'music-note',
    color: '#4caf50',
  },
  {
    id: '3',
    title: 'Support the Platform',
    description: 'Go PRO to support development and remove ads',
    url: '/upgrade',
    icon: 'heart',
    color: '#f44336',
  },
];

const ROTATION_INTERVAL = 5000; // 5 seconds

interface AdsBannerProps {
  onUpgradePress?: () => void;
}

const AdsBanner: React.FC<AdsBannerProps> = ({ onUpgradePress }) => {
  const theme = useTheme();
  const [currentAdIndex, setCurrentAdIndex] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentAdIndex((prev) => (prev + 1) % ADS.length);
    }, ROTATION_INTERVAL);

    return () => clearInterval(interval);
  }, []);

  const currentAd = ADS[currentAdIndex];

  const handlePress = () => {
    if (onUpgradePress) {
      onUpgradePress();
    } else if (currentAd.url) {
      // Handle navigation or external link
      if (currentAd.url.startsWith('http')) {
        Linking.openURL(currentAd.url).catch((err) =>
          console.error('Failed to open URL:', err)
        );
      }
    }
  };

  return (
    <Card
      style={[
        styles.banner,
        {
          backgroundColor: currentAd.color
            ? `${currentAd.color}15`
            : theme.colors.surfaceVariant,
          borderColor: currentAd.color || theme.colors.primary,
        },
      ]}
    >
      <TouchableOpacity
        activeOpacity={0.7}
        onPress={handlePress}
        style={styles.bannerContent}
      >
        <View style={styles.bannerLeft}>
          {currentAd.icon && (
            <View
              style={[
                styles.iconContainer,
                {
                  backgroundColor: currentAd.color
                    ? `${currentAd.color}30`
                    : `${theme.colors.primary}30`,
                },
              ]}
            >
              <MaterialCommunityIcons
                name={currentAd.icon as any}
                size={IS_MOBILE ? 20 : 24}
                color={currentAd.color || theme.colors.primary}
              />
            </View>
          )}
          <View style={styles.textContainer}>
            <Text
              style={[
                styles.adTitle,
                {
                  color: currentAd.color || theme.colors.primary,
                },
              ]}
              numberOfLines={1}
            >
              {currentAd.title}
            </Text>
            <Text
              style={[
                styles.adDescription,
                { color: theme.colors.onSurfaceVariant },
              ]}
              numberOfLines={1}
            >
              {currentAd.description}
            </Text>
          </View>
        </View>
        <View style={styles.bannerRight}>
          <MaterialCommunityIcons
            name="chevron-right"
            size={IS_MOBILE ? 20 : 24}
            color={currentAd.color || theme.colors.primary}
          />
          {/* Ad indicator dots */}
          <View style={styles.dotsContainer}>
            {ADS.map((_, index) => (
              <View
                key={index}
                style={[
                  styles.dot,
                  {
                    backgroundColor:
                      index === currentAdIndex
                        ? currentAd.color || theme.colors.primary
                        : theme.colors.onSurfaceVariant + '40',
                  },
                ]}
              />
            ))}
          </View>
        </View>
      </TouchableOpacity>
    </Card>
  );
};

const styles = StyleSheet.create({
  banner: {
    margin: IS_MOBILE ? 12 : 16,
    marginTop: IS_MOBILE ? 12 : 16,
    borderRadius: 16,
    borderWidth: 1,
    overflow: 'hidden',
    ...(Platform.OS === 'web' ? {
      boxShadow: '0px 4px 12px rgba(0, 0, 0, 0.15)',
      cursor: 'pointer',
      transition: 'transform 0.2s, box-shadow 0.2s',
    } : {
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.1,
      shadowRadius: 4,
      elevation: 3,
    }),
  },
  bannerContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: IS_MOBILE ? 12 : 16,
    paddingVertical: IS_MOBILE ? 14 : 18,
  },
  bannerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    gap: IS_MOBILE ? 10 : 12,
  },
  iconContainer: {
    width: IS_MOBILE ? 36 : 40,
    height: IS_MOBILE ? 36 : 40,
    borderRadius: IS_MOBILE ? 18 : 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  textContainer: {
    flex: 1,
    gap: 4,
  },
  adTitle: {
    fontSize: IS_MOBILE ? 14 : 16,
    fontWeight: '700',
    letterSpacing: -0.3,
  },
  adDescription: {
    fontSize: IS_MOBILE ? 11 : 12,
    marginTop: 2,
  },
  bannerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: IS_MOBILE ? 8 : 10,
  },
  dotsContainer: {
    flexDirection: 'row',
    gap: 4,
    alignItems: 'center',
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
});

export default AdsBanner;

