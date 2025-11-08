import React from 'react';
import { View, StyleSheet, TouchableOpacity, Platform } from 'react-native';
import { Text, useTheme } from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';

interface DJModeToggleProps {
  isDJMode: boolean;
  onToggle: () => void;
  disabled?: boolean;
}

export const DJModeToggle: React.FC<DJModeToggleProps> = ({
  isDJMode,
  onToggle,
  disabled = false,
}) => {
  const theme = useTheme();

  return (
    <TouchableOpacity
      onPress={onToggle}
      disabled={disabled}
      style={[
        styles.container,
        {
          backgroundColor: isDJMode 
            ? theme.colors.primary 
            : theme.colors.surfaceVariant,
          opacity: disabled ? 0.5 : 1,
        },
      ]}
      activeOpacity={0.7}
    >
      <View style={styles.content}>
        <MaterialCommunityIcons
          name={isDJMode ? 'equalizer' : 'music-note'}
          size={16}
          color={isDJMode ? theme.colors.onPrimary : theme.colors.onSurfaceVariant}
        />
        <Text
          style={[
            styles.label,
            {
              color: isDJMode ? theme.colors.onPrimary : theme.colors.onSurfaceVariant,
            },
          ]}
        >
          {isDJMode ? 'DJ' : 'Standard'}
        </Text>
      </View>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  container: {
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 6,
    ...(Platform.OS === 'web' ? {
      boxShadow: '0px 2px 8px rgba(0, 0, 0, 0.15)',
      cursor: 'pointer',
    } : {}),
  },
  content: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  label: {
    fontSize: 12,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
});

