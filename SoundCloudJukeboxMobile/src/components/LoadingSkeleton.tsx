import React from 'react';
import { View, StyleSheet, Animated, Platform } from 'react-native';
import { useTheme } from 'react-native-paper';

interface SkeletonProps {
  width?: number | string;
  height?: number;
  borderRadius?: number;
  style?: any;
}

const Skeleton: React.FC<SkeletonProps> = ({ width = '100%', height = 20, borderRadius = 4, style }) => {
  const theme = useTheme();
  const animatedValue = React.useRef(new Animated.Value(0)).current;

  React.useEffect(() => {
        Animated.loop(
      Animated.sequence([
        Animated.timing(animatedValue, {
          toValue: 1,
          duration: 1000,
          useNativeDriver: Platform.OS !== 'web',
        }),
        Animated.timing(animatedValue, {
          toValue: 0,
          duration: 1000,
          useNativeDriver: Platform.OS !== 'web',
        }),
      ])
    ).start();
  }, [animatedValue]);

  const opacity = animatedValue.interpolate({
    inputRange: [0, 1],
    outputRange: [0.3, 0.7],
  });

  return (
    <Animated.View
      style={[
        {
          width,
          height,
          borderRadius,
          backgroundColor: theme.colors.surfaceVariant,
          opacity,
        },
        style,
      ]}
    />
  );
};

export const RoomCardSkeleton: React.FC = () => {
  const theme = useTheme();
  
  return (
    <View style={[styles.card, { backgroundColor: theme.colors.surface }]}>
      <Skeleton width={60} height={60} borderRadius={8} />
      <View style={styles.cardContent}>
        <Skeleton width="70%" height={20} borderRadius={4} />
        <Skeleton width="50%" height={16} borderRadius={4} style={{ marginTop: 8 }} />
        <Skeleton width="40%" height={14} borderRadius={4} style={{ marginTop: 8 }} />
      </View>
    </View>
  );
};

export const DashboardSkeleton: React.FC = () => {
  return (
    <View style={styles.container}>
      <Skeleton width="100%" height={120} borderRadius={12} style={{ marginBottom: 16 }} />
      <Skeleton width="60%" height={24} borderRadius={4} style={{ marginBottom: 24 }} />
      {[1, 2, 3].map((i) => (
        <RoomCardSkeleton key={i} />
      ))}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    padding: 16,
  },
  card: {
    flexDirection: 'row',
    padding: 16,
    borderRadius: 12,
    marginBottom: 12,
    alignItems: 'center',
  },
  cardContent: {
    flex: 1,
    marginLeft: 12,
  },
});

