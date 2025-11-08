import React from 'react';
import { View, StyleSheet, Platform, Animated } from 'react-native';
import { FAB, useTheme } from 'react-native-paper';
import { LinearGradient } from 'expo-linear-gradient';

interface AnimatedFABProps {
  isPlaying: boolean;
  sessionEnabled: boolean;
  hasQueue: boolean;
  pulseAnim: Animated.Value;
  colorAnim: Animated.Value;
  onPress: () => void;
  miniPlayerVisible: boolean;
  theme: any;
}

export const AnimatedFAB: React.FC<AnimatedFABProps> = ({
  isPlaying,
  sessionEnabled,
  hasQueue,
  pulseAnim,
  colorAnim,
  onPress,
  miniPlayerVisible,
  theme,
}) => {
  // Determine icon based on state
  const getIcon = () => {
    if (!sessionEnabled || !hasQueue) {
      return 'music-note';
    }
    return 'play';
  };

  // Gradient colors for border and background
  const defaultBorderColors = ['#4c63d2', '#667eea', '#9b59b6']; // Blue to purple gradient
  const playingBorderColors = [theme.colors.primary, '#9b59b6', '#e74c3c']; // Primary to purple to red gradient
  const defaultBgColors = ['#4c63d2', '#667eea']; // Background gradient
  const playingBgColors = [theme.colors.primary, '#9b59b6']; // Playing background gradient
  
  // Animated gradient colors - ensure proper typing for LinearGradient
  const [borderGradientColors, setBorderGradientColors] = React.useState<[string, string, string]>(defaultBorderColors as [string, string, string]);
  const [bgGradientColors, setBgGradientColors] = React.useState<[string, string]>(defaultBgColors as [string, string]);
  const [glowOpacity, setGlowOpacity] = React.useState(0.5);

  // Start pulse animation when playing
  React.useEffect(() => {
    if (isPlaying) {
      // Pulse animation - subtle scale to avoid jumping
      // Use a safe easing function that works on all platforms
      // Animated.Easing.ease doesn't exist, use quad instead
      const easing = Animated.Easing?.inOut && Animated.Easing?.quad 
        ? Animated.Easing.inOut(Animated.Easing.quad)
        : undefined;
      Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, {
            toValue: 1.03,
            duration: 1200,
            easing: easing,
            useNativeDriver: Platform.OS !== 'web',
          }),
          Animated.timing(pulseAnim, {
            toValue: 1,
            duration: 1200,
            easing: easing,
            useNativeDriver: Platform.OS !== 'web',
          }),
        ])
      ).start();

      // Color animation for gradient border and background
      const colorListener = colorAnim.addListener(({ value }) => {
        // Interpolate border gradient colors
        const borderColor1 = interpolateColor(
          value,
          [0, 1],
          defaultBorderColors[0],
          playingBorderColors[0]
        );
        const borderColor2 = interpolateColor(
          value,
          [0, 1],
          defaultBorderColors[1],
          playingBorderColors[1]
        );
        const borderColor3 = interpolateColor(
          value,
          [0, 1],
          defaultBorderColors[2],
          playingBorderColors[2]
        );
        setBorderGradientColors([borderColor1, borderColor2, borderColor3] as [string, string, string]);
        
        // Interpolate background gradient colors
        const bgColor1 = interpolateColor(
          value,
          [0, 1],
          defaultBgColors[0],
          playingBgColors[0]
        );
        const bgColor2 = interpolateColor(
          value,
          [0, 1],
          defaultBgColors[1],
          playingBgColors[1]
        );
        setBgGradientColors([bgColor1, bgColor2] as [string, string]);
        
        // Animate glow opacity
        setGlowOpacity(0.5 + value * 0.5); // 0.5 to 1.0
      });

      Animated.loop(
        Animated.sequence([
          Animated.timing(colorAnim, {
            toValue: 1,
            duration: 1000,
            useNativeDriver: false,
          }),
          Animated.timing(colorAnim, {
            toValue: 0,
            duration: 1000,
            useNativeDriver: false,
          }),
        ])
      ).start();

      return () => {
        colorAnim.removeListener(colorListener);
      };
    } else {
      // Reset animations when not playing
      pulseAnim.setValue(1);
      colorAnim.setValue(0);
      setBorderGradientColors(defaultBorderColors as [string, string, string]);
      setBgGradientColors(defaultBgColors as [string, string]);
      setGlowOpacity(0.5);
    }
  }, [isPlaying, pulseAnim, colorAnim, theme.colors.primary]);

  // Helper function to interpolate colors
  const interpolateColor = (value: number, inputRange: number[], color1: string, color2: string): string => {
    const ratio = (value - inputRange[0]) / (inputRange[1] - inputRange[0]);
    const clampedRatio = Math.max(0, Math.min(1, ratio));
    
    // Convert hex to RGB
    const hex1 = color1.replace('#', '');
    const hex2 = color2.replace('#', '');
    const r1 = parseInt(hex1.substring(0, 2), 16);
    const g1 = parseInt(hex1.substring(2, 4), 16);
    const b1 = parseInt(hex1.substring(4, 6), 16);
    const r2 = parseInt(hex2.substring(0, 2), 16);
    const g2 = parseInt(hex2.substring(2, 4), 16);
    const b2 = parseInt(hex2.substring(4, 6), 16);
    
    // Interpolate
    const r = Math.round(r1 + (r2 - r1) * clampedRatio);
    const g = Math.round(g1 + (g2 - g1) * clampedRatio);
    const b = Math.round(b1 + (b2 - b1) * clampedRatio);
    
    // Convert back to hex
    return `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`;
  };

  const animatedScaleStyle = {
    transform: [{ scale: pulseAnim }],
  };

  // Get RGB values for glow effect
  const getRgbValues = (hex: string): [number, number, number] => {
    const hexColor = hex.replace('#', '');
    const r = parseInt(hexColor.substring(0, 2), 16);
    const g = parseInt(hexColor.substring(2, 4), 16);
    const b = parseInt(hexColor.substring(4, 6), 16);
    return [r, g, b];
  };

  const [primaryR, primaryG, primaryB] = getRgbValues(borderGradientColors[0]);
  const [secondaryR, secondaryG, secondaryB] = getRgbValues(borderGradientColors[1]);

  return (
    <Animated.View style={[animatedScaleStyle, styles.fabAnimatedContainer]}>
      {/* Outer glow layer */}
      <Animated.View
        style={[
          styles.fabGlowLayer,
          {
            opacity: glowOpacity,
            ...(Platform.OS === 'web' ? {
              boxShadow: `0 0 20px rgba(${primaryR}, ${primaryG}, ${primaryB}, ${glowOpacity * 0.8}), 0 0 40px rgba(${secondaryR}, ${secondaryG}, ${secondaryB}, ${glowOpacity * 0.6}), 0 0 60px rgba(${primaryR}, ${primaryG}, ${primaryB}, ${glowOpacity * 0.4})`,
            } : {
              shadowColor: `rgb(${primaryR}, ${primaryG}, ${primaryB})`,
              shadowOffset: { width: 0, height: 0 },
              shadowRadius: 30,
              shadowOpacity: glowOpacity * 0.8,
              elevation: 20,
            }),
          },
        ]}
      />
      
      {/* Gradient border wrapper */}
      <View style={styles.fabGradientWrapper}>
        <LinearGradient
          colors={borderGradientColors}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.fabBorderGradient}
        >
          {/* Inner background gradient */}
          <LinearGradient
            colors={bgGradientColors}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.fabInnerGradient}
          >
            <FAB
              icon={getIcon()}
              style={[
                styles.fab,
                {
                  backgroundColor: 'transparent',
                },
              ]}
              onPress={onPress}
              label={miniPlayerVisible ? 'Hide' : 'Player'}
              color={theme.colors.onPrimary}
            />
          </LinearGradient>
        </LinearGradient>
      </View>
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  fabAnimatedContainer: {
    position: 'relative',
    // Prevent layout shifts during scale animation
    alignSelf: 'flex-start',
  },
  fab: {
    backgroundColor: 'transparent',
  },
  fabGlowLayer: {
    position: 'absolute',
    top: -8,
    left: -8,
    right: -8,
    bottom: -8,
    borderRadius: 36, // Slightly larger than FAB
    backgroundColor: 'transparent',
    zIndex: -1,
  },
  fabGradientWrapper: {
    borderRadius: 28,
    overflow: 'hidden',
    padding: 2, // This creates the border width
  },
  fabBorderGradient: {
    borderRadius: 28,
    padding: 0,
  },
  fabInnerGradient: {
    borderRadius: 26, // Slightly smaller to show the border
    overflow: 'hidden',
  },
});

