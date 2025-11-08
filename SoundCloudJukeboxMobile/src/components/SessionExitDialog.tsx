import React from 'react';
import { View, StyleSheet, Platform } from 'react-native';
import { Dialog, Text, Button, useTheme, Portal } from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';

interface SessionExitDialogProps {
  visible: boolean;
  onOpenMiniPlayer: () => void;
  onExitRoom: () => void;
  onDismiss: () => void;
}

export const SessionExitDialog: React.FC<SessionExitDialogProps> = ({
  visible,
  onOpenMiniPlayer,
  onExitRoom,
  onDismiss,
}) => {
  const theme = useTheme();

  return (
    <Portal>
      <Dialog
        visible={visible}
        onDismiss={onDismiss}
        style={[styles.dialog, { backgroundColor: theme.colors.surface }]}
      >
        <Dialog.Title style={[styles.title, { color: theme.colors.onSurface }]}>
          Session in Progress
        </Dialog.Title>
        
        <Dialog.Content>
          <View style={styles.iconContainer}>
            <MaterialCommunityIcons
              name="music-note"
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
            A music session is currently active in this room. You can continue listening while navigating the app.
          </Text>
        </Dialog.Content>

        <Dialog.Actions style={styles.actions}>
          <Button
            onPress={onExitRoom}
            textColor={theme.colors.onSurfaceVariant}
            style={styles.exitButton}
          >
            Exit Room
          </Button>
          <Button
            mode="contained"
            onPress={onOpenMiniPlayer}
            buttonColor={theme.colors.primary}
            icon="music-circle"
            style={styles.miniPlayerButton}
          >
            Open Mini Player
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
      maxWidth: 500,
    } : {}),
  },
  title: {
    fontSize: 20,
    fontWeight: 'bold',
    textAlign: 'center',
  },
  iconContainer: {
    alignItems: 'center',
    marginBottom: 16,
    padding: 16,
  },
  description: {
    fontSize: 15,
    lineHeight: 22,
    textAlign: 'center',
    marginBottom: 8,
  },
  actions: {
    padding: 16,
    gap: 8,
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  exitButton: {
    flex: 1,
  },
  miniPlayerButton: {
    flex: 1,
    ...(Platform.OS === 'web' ? {
      cursor: 'pointer',
    } : {}),
  },
});

