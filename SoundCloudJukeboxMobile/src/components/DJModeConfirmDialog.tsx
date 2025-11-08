import React from 'react';
import { View, StyleSheet, ScrollView, Platform } from 'react-native';
import { Dialog, Text, Button, useTheme, Portal } from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';

interface DJModeConfirmDialogProps {
  visible: boolean;
  onConfirm: () => void;
  onDismiss: () => void;
}

export const DJModeConfirmDialog: React.FC<DJModeConfirmDialogProps> = ({
  visible,
  onConfirm,
  onDismiss,
}) => {
  const theme = useTheme();

  const features = [
    {
      icon: 'turntable',
      title: 'Multiple Players',
      description: 'Control up to 4 simultaneous audio players for seamless mixing',
    },
    {
      icon: 'waveform',
      title: 'Waveform Visualization',
      description: 'See real-time waveforms to help you sync tracks perfectly',
    },
    {
      icon: 'metronome',
      title: 'BPM Detection',
      description: 'Automatic BPM detection helps you match track tempos',
    },
    {
      icon: 'sync',
      title: 'Track Synchronization',
      description: 'Sync multiple tracks to start at the exact same time',
    },
    {
      icon: 'volume-high',
      title: 'Individual Volume Control',
      description: 'Control volume for each player independently',
    },
    {
      icon: 'music-note-multiple',
      title: 'Seamless Transitions',
      description: 'Mix between tracks smoothly with crossfading capabilities',
    },
  ];

  return (
    <Portal>
      <Dialog
        visible={visible}
        onDismiss={onDismiss}
        style={[styles.dialog, { backgroundColor: theme.colors.surface }]}
      >
        <Dialog.Title style={[styles.title, { color: theme.colors.onSurface }]}>
          Sure you want to enter DJ Mode?
        </Dialog.Title>
        
        <Dialog.Content>
          <View style={styles.iconHeader}>
            <MaterialCommunityIcons
              name="turntable"
              size={48}
              color={theme.colors.primary}
            />
          </View>
          
          <Text
            style={[
              styles.description,
              { color: theme.colors.onSurfaceVariant },
            ]}
          >
            DJ Mode gives you professional mixing capabilities with multiple players, 
            waveform visualization, and advanced synchronization features.
          </Text>

          <ScrollView
            style={styles.featuresScroll}
            showsVerticalScrollIndicator={false}
          >
            <View style={styles.featuresContainer}>
              {features.map((feature, index) => (
                <View key={index} style={styles.featureItem}>
                <MaterialCommunityIcons
                  name={feature.icon as any}
                  size={24}
                  color={theme.colors.primary}
                  style={styles.featureIcon}
                />
                <View style={styles.featureContent}>
                  <Text
                    style={[
                      styles.featureTitle,
                      { color: theme.colors.onSurface },
                    ]}
                  >
                    {feature.title}
                  </Text>
                  <Text
                    style={[
                      styles.featureDescription,
                      { color: theme.colors.onSurfaceVariant },
                    ]}
                  >
                    {feature.description}
                  </Text>
                </View>
              ))}
            </View>
          </ScrollView>
        </Dialog.Content>

        <Dialog.Actions style={styles.actions}>
          <Button
            onPress={onDismiss}
            textColor={theme.colors.onSurfaceVariant}
            style={styles.cancelButton}
          >
            Cancel
          </Button>
          <Button
            mode="contained"
            onPress={onConfirm}
            buttonColor={theme.colors.primary}
            icon="check-circle"
            style={styles.confirmButton}
          >
            Enter DJ Mode
          </Button>
        </Dialog.Actions>
      </Dialog>
    </Portal>
  );
};

const styles = StyleSheet.create({
  dialog: {
    borderRadius: 16,
    maxHeight: '80%',
    ...(Platform.OS === 'web' ? {
      maxWidth: 600,
    } : {}),
  },
  title: {
    fontSize: 22,
    fontWeight: 'bold',
    textAlign: 'center',
  },
  iconHeader: {
    alignItems: 'center',
    marginBottom: 16,
    padding: 16,
  },
  description: {
    fontSize: 15,
    lineHeight: 22,
    textAlign: 'center',
    marginBottom: 20,
  },
  featuresScroll: {
    maxHeight: 300,
  },
  featuresContainer: {
    gap: 16,
  },
  featureItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
  },
  featureIcon: {
    marginTop: 2,
  },
  featureContent: {
    flex: 1,
  },
  featureTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 4,
  },
  featureDescription: {
    fontSize: 14,
    lineHeight: 20,
  },
  actions: {
    padding: 16,
    gap: 8,
  },
  cancelButton: {
    marginRight: 8,
  },
  confirmButton: {
    ...(Platform.OS === 'web' ? {
      cursor: 'pointer',
    } : {}),
  },
});

