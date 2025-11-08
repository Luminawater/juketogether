import React from 'react';
import { View, StyleSheet, Platform, Dimensions, TouchableOpacity } from 'react-native';
import { useTheme } from 'react-native-paper';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const IS_MOBILE = SCREEN_WIDTH < 768;
const WAVEFORM_HEIGHT = IS_MOBILE ? 60 : 80;
const WAVEFORM_WIDTH = IS_MOBILE ? 200 : 280;
const BAR_COUNT = 80;

interface WaveformViewProps {
  position: number; // Current position in milliseconds
  duration: number; // Total duration in milliseconds
  waveformData?: number[]; // Optional waveform data (normalized 0-1)
  isPlaying?: boolean;
  onSeek?: (position: number) => void;
}

export const WaveformView: React.FC<WaveformViewProps> = ({
  position,
  duration,
  waveformData,
  isPlaying = false,
  onSeek,
}) => {
  const theme = useTheme();

  // Generate mock waveform data if not provided
  const generateWaveform = (): number[] => {
    if (waveformData && waveformData.length > 0) {
      return waveformData;
    }
    // Generate random waveform for visualization
    const data: number[] = [];
    for (let i = 0; i < BAR_COUNT; i++) {
      data.push(Math.random() * 0.8 + 0.1);
    }
    return data;
  };

  const waveform = generateWaveform();
  const progress = duration > 0 ? position / duration : 0;
  const progressIndex = Math.floor(progress * BAR_COUNT);
  const barWidth = WAVEFORM_WIDTH / BAR_COUNT;

  const handlePress = (event: any) => {
    if (!onSeek || duration === 0) return;
    const { locationX } = event.nativeEvent;
    const newProgress = Math.max(0, Math.min(1, locationX / WAVEFORM_WIDTH));
    const newPosition = newProgress * duration;
    onSeek(newPosition);
  };

  return (
    <TouchableOpacity
      activeOpacity={1}
      onPress={onSeek ? handlePress : undefined}
      style={[styles.container, { backgroundColor: theme.colors.surfaceVariant }]}
    >
      <View style={styles.waveform}>
        {waveform.map((amplitude, index) => {
          const barHeight = amplitude * WAVEFORM_HEIGHT;
          const isPlayed = index < progressIndex;
          const isCurrent = index === progressIndex;
          
          return (
            <View
              key={index}
              style={[
                styles.bar,
                {
                  width: barWidth - 1,
                  height: barHeight,
                  backgroundColor: isCurrent
                    ? theme.colors.primary
                    : isPlayed
                    ? theme.colors.primary
                    : theme.colors.outline,
                  opacity: isCurrent ? 1 : isPlayed ? 0.6 : 0.3,
                },
              ]}
            />
          );
        })}
      </View>
      {/* Progress line */}
      {progress > 0 && progress < 1 && (
        <View
          style={[
            styles.progressLine,
            {
              left: progress * WAVEFORM_WIDTH,
              backgroundColor: theme.colors.primary,
            },
          ]}
        />
      )}
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  container: {
    borderRadius: 8,
    overflow: 'hidden',
    padding: 4,
    height: WAVEFORM_HEIGHT,
    position: 'relative',
  },
  waveform: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    height: WAVEFORM_HEIGHT,
    width: WAVEFORM_WIDTH,
  },
  bar: {
    borderRadius: 1,
    minHeight: 2,
  },
  progressLine: {
    position: 'absolute',
    width: 2,
    height: WAVEFORM_HEIGHT,
    top: 4,
    opacity: 0.9,
  },
});

