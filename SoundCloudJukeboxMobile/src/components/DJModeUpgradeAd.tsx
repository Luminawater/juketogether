import React, { useEffect, useRef } from 'react';
import { View, StyleSheet, TouchableOpacity, Platform, Animated } from 'react-native';
import { Card, Text, Button, useTheme } from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';

interface DJModeUpgradeAdProps {
  onUpgrade: () => void;
}

export const DJModeUpgradeAd: React.FC<DJModeUpgradeAdProps> = ({ onUpgrade }) => {
  const theme = useTheme();
  const glowAnimation = useRef(new Animated.Value(0)).current;
  const iconGlowAnimation = useRef(new Animated.Value(0)).current;
  const titleGlowAnimation = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    // Create pulsing glow animation for the card
    const glowLoop = Animated.loop(
      Animated.sequence([
        Animated.timing(glowAnimation, {
          toValue: 1,
          duration: 2000,
          useNativeDriver: false,
        }),
        Animated.timing(glowAnimation, {
          toValue: 0,
          duration: 2000,
          useNativeDriver: false,
        }),
      ])
    );

    // Create pulsing glow animation for the icon
    const iconGlowLoop = Animated.loop(
      Animated.sequence([
        Animated.timing(iconGlowAnimation, {
          toValue: 1,
          duration: 1500,
          useNativeDriver: false,
        }),
        Animated.timing(iconGlowAnimation, {
          toValue: 0,
          duration: 1500,
          useNativeDriver: false,
        }),
      ])
    );

    // Create pulsing glow animation for the title
    const titleGlowLoop = Animated.loop(
      Animated.sequence([
        Animated.timing(titleGlowAnimation, {
          toValue: 1,
          duration: 1800,
          useNativeDriver: false,
        }),
        Animated.timing(titleGlowAnimation, {
          toValue: 0,
          duration: 1800,
          useNativeDriver: false,
        }),
      ])
    );

    glowLoop.start();
    iconGlowLoop.start();
    titleGlowLoop.start();

    return () => {
      glowLoop.stop();
      iconGlowLoop.stop();
      titleGlowLoop.stop();
    };
  }, []);

  const cardGlowOpacity = glowAnimation.interpolate({
    inputRange: [0, 1],
    outputRange: [0.3, 0.8],
  });

  const cardGlowScale = glowAnimation.interpolate({
    inputRange: [0, 1],
    outputRange: [1, 1.02],
  });

  const iconGlowOpacity = iconGlowAnimation.interpolate({
    inputRange: [0, 1],
    outputRange: [0.5, 1],
  });

  const iconGlowScale = iconGlowAnimation.interpolate({
    inputRange: [0, 1],
    outputRange: [1, 1.1],
  });

  const titleGlowOpacity = titleGlowAnimation.interpolate({
    inputRange: [0, 1],
    outputRange: [0.6, 1],
  });

  const primaryColor = theme.colors.primary;
  
  // Extract RGB values from hex or rgb color
  const getRgbValues = (color: string): [number, number, number] => {
    // Handle hex colors (#667eea or #667EEA)
    if (color.startsWith('#')) {
      const hex = color.slice(1);
      const r = parseInt(hex.substring(0, 2), 16);
      const g = parseInt(hex.substring(2, 4), 16);
      const b = parseInt(hex.substring(4, 6), 16);
      return [r, g, b];
    }
    // Handle rgb/rgba colors (rgb(102, 126, 234))
    const rgbMatch = color.match(/\d+/g);
    if (rgbMatch && rgbMatch.length >= 3) {
      return [
        parseInt(rgbMatch[0], 10),
        parseInt(rgbMatch[1], 10),
        parseInt(rgbMatch[2], 10),
      ];
    }
    // Default fallback
    return [102, 126, 234];
  };

  const [primaryR, primaryG, primaryB] = getRgbValues(primaryColor);

  return (
    <Animated.View
      style={[
        styles.cardWrapper,
        {
          transform: [{ scale: cardGlowScale }],
        },
      ]}
    >
      <Animated.View
        style={[
          styles.glowLayer,
          {
            opacity: cardGlowOpacity,
            shadowColor: primaryColor,
            ...(Platform.OS === 'web' ? {
              boxShadow: `0 0 40px rgba(${primaryR}, ${primaryG}, ${primaryB}, 0.8), 0 0 80px rgba(${primaryR}, ${primaryG}, ${primaryB}, 0.4)`,
            } : {}),
          },
        ]}
      />
      <Card
        style={[
          styles.card,
          {
            backgroundColor: theme.colors.surface,
            borderColor: primaryColor,
            borderWidth: 2,
            shadowColor: primaryColor,
            ...(Platform.OS === 'web' ? {
              boxShadow: `0 0 20px rgba(${primaryR}, ${primaryG}, ${primaryB}, 0.6), 0 0 40px rgba(${primaryR}, ${primaryG}, ${primaryB}, 0.3), 0 8px 32px rgba(0, 0, 0, 0.2)`,
            } : {}),
          },
        ]}
        elevation={8}
      >
        <Card.Content style={styles.content}>
          <Animated.View
            style={[
              styles.iconContainer,
              {
                transform: [{ scale: iconGlowScale }],
                opacity: iconGlowOpacity,
                backgroundColor: `rgba(${primaryR}, ${primaryG}, ${primaryB}, 0.15)`,
                shadowColor: primaryColor,
                ...(Platform.OS === 'web' ? {
                  boxShadow: `0 0 30px rgba(${primaryR}, ${primaryG}, ${primaryB}, 0.8)`,
                } : {}),
              },
            ]}
          >
            <MaterialCommunityIcons
              name="equalizer"
              size={64}
              color={primaryColor}
            />
          </Animated.View>
          
          <Animated.Text
            style={[
              styles.title,
              {
                color: theme.colors.onSurface,
                opacity: titleGlowOpacity,
                textShadowColor: primaryColor,
                textShadowOffset: { width: 0, height: 0 },
                textShadowRadius: 20,
                ...(Platform.OS === 'web' ? {
                  textShadow: `0 0 20px rgba(${primaryR}, ${primaryG}, ${primaryB}, 0.8), 0 0 40px rgba(${primaryR}, ${primaryG}, ${primaryB}, 0.4)`,
                  filter: `drop-shadow(0 0 10px rgba(${primaryR}, ${primaryG}, ${primaryB}, 0.6))`,
                } : {}),
              },
            ]}
          >
            Want to DJ? Get PRO!
          </Animated.Text>
        
        <Text
          style={[
            styles.description,
            { color: theme.colors.onSurfaceVariant },
          ]}
        >
          Unlock DJ Mode with PRO subscription and mix tracks like a professional DJ
        </Text>

        <View style={styles.featuresContainer}>
          <View style={styles.featureRow}>
            <MaterialCommunityIcons
              name="check-circle"
              size={20}
              color={theme.colors.primary}
            />
            <Text style={[styles.featureText, { color: theme.colors.onSurface }]}>
              Multiple simultaneous players
            </Text>
          </View>
          <View style={styles.featureRow}>
            <MaterialCommunityIcons
              name="check-circle"
              size={20}
              color={theme.colors.primary}
            />
            <Text style={[styles.featureText, { color: theme.colors.onSurface }]}>
              Real-time waveform visualization
            </Text>
          </View>
          <View style={styles.featureRow}>
            <MaterialCommunityIcons
              name="check-circle"
              size={20}
              color={theme.colors.primary}
            />
            <Text style={[styles.featureText, { color: theme.colors.onSurface }]}>
              BPM detection and sync
            </Text>
          </View>
          <View style={styles.featureRow}>
            <MaterialCommunityIcons
              name="check-circle"
              size={20}
              color={theme.colors.primary}
            />
            <Text style={[styles.featureText, { color: theme.colors.onSurface }]}>
              Seamless track transitions
            </Text>
          </View>
        </View>

        <Button
          mode="contained"
          onPress={onUpgrade}
          style={[
            styles.upgradeButton,
            {
              shadowColor: primaryColor,
              ...(Platform.OS === 'web' ? {
                boxShadow: `0 0 15px rgba(${primaryR}, ${primaryG}, ${primaryB}, 0.5), 0 4px 12px rgba(0, 0, 0, 0.15)`,
              } : {}),
            },
          ]}
          buttonColor={primaryColor}
          icon="arrow-up-circle"
          contentStyle={styles.buttonContent}
        >
          Upgrade to PRO
        </Button>
      </Card.Content>
    </Card>
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  cardWrapper: {
    position: 'relative',
    margin: 16,
  },
  glowLayer: {
    position: 'absolute',
    top: -10,
    left: -10,
    right: -10,
    bottom: -10,
    borderRadius: 26,
    backgroundColor: 'transparent',
    ...(Platform.OS !== 'web' ? {
      shadowOffset: { width: 0, height: 0 },
      shadowRadius: 40,
      shadowOpacity: 0.8,
      elevation: 20,
    } : {}),
  },
  card: {
    borderRadius: 16,
    position: 'relative',
    zIndex: 1,
    ...(Platform.OS !== 'web' ? {
      shadowOffset: { width: 0, height: 8 },
      shadowRadius: 24,
      shadowOpacity: 0.3,
    } : {}),
  },
  content: {
    padding: 24,
    alignItems: 'center',
  },
  iconContainer: {
    marginBottom: 16,
    padding: 16,
    borderRadius: 50,
    ...(Platform.OS !== 'web' ? {
      shadowOffset: { width: 0, height: 0 },
      shadowRadius: 20,
      shadowOpacity: 0.8,
      elevation: 15,
    } : {}),
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 12,
    textAlign: 'center',
  },
  description: {
    fontSize: 16,
    textAlign: 'center',
    marginBottom: 24,
    lineHeight: 22,
  },
  featuresContainer: {
    width: '100%',
    marginBottom: 24,
    gap: 12,
  },
  featureRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  featureText: {
    fontSize: 15,
    flex: 1,
  },
  upgradeButton: {
    width: '100%',
    borderRadius: 12,
    ...(Platform.OS === 'web' ? {
      cursor: 'pointer',
    } : {}),
  },
  buttonContent: {
    paddingVertical: 8,
  },
});

