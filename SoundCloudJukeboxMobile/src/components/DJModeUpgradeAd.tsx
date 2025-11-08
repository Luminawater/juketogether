import React from 'react';
import { View, StyleSheet, TouchableOpacity, Platform } from 'react-native';
import { Card, Text, Button, useTheme } from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';

interface DJModeUpgradeAdProps {
  onUpgrade: () => void;
}

export const DJModeUpgradeAd: React.FC<DJModeUpgradeAdProps> = ({ onUpgrade }) => {
  const theme = useTheme();

  return (
    <Card
      style={[
        styles.card,
        {
          backgroundColor: theme.colors.surface,
          borderColor: theme.colors.primary,
          borderWidth: 2,
        },
      ]}
      elevation={4}
    >
      <Card.Content style={styles.content}>
        <View style={styles.iconContainer}>
          <MaterialCommunityIcons
            name="equalizer"
            size={64}
            color={theme.colors.primary}
          />
        </View>
        
        <Text
          style={[
            styles.title,
            { color: theme.colors.onSurface },
          ]}
        >
          Want to DJ? Get PRO!
        </Text>
        
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
          style={styles.upgradeButton}
          buttonColor={theme.colors.primary}
          icon="arrow-up-circle"
          contentStyle={styles.buttonContent}
        >
          Upgrade to PRO
        </Button>
      </Card.Content>
    </Card>
  );
};

const styles = StyleSheet.create({
  card: {
    borderRadius: 16,
    margin: 16,
    ...(Platform.OS === 'web' ? {
      boxShadow: '0px 4px 16px rgba(0, 0, 0, 0.15)',
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
    backgroundColor: 'rgba(102, 126, 234, 0.1)',
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

