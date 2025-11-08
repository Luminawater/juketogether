import React from 'react';
import { View, StyleSheet } from 'react-native';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Text,
  useTheme,
  Divider,
} from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { clipboardHelpers } from '../utils/clipboardHelpers';
import { getRoomUrl } from '../utils/roomUtils';

interface ShareRoomDialogProps {
  visible: boolean;
  onDismiss: () => void;
  roomName: string;
  roomId: string;
  shortCode?: string;
  onCopyUrl?: () => void;
  onCopyCode?: () => void;
}

export const ShareRoomDialog: React.FC<ShareRoomDialogProps> = ({
  visible,
  onDismiss,
  roomName,
  roomId,
  shortCode,
  onCopyUrl,
  onCopyCode,
}) => {
  const theme = useTheme();
  const roomUrl = getRoomUrl(roomId, shortCode);

  const handleCopyUrl = async () => {
    const success = await clipboardHelpers.copy(roomUrl);
    if (success) {
      onCopyUrl?.();
    }
  };

  const handleCopyCode = async () => {
    if (shortCode) {
      const success = await clipboardHelpers.copy(shortCode);
      if (success) {
        onCopyCode?.();
      }
    }
  };

  return (
    <Dialog visible={visible} onDismiss={onDismiss} style={styles.dialog}>
      <DialogTitle style={{ color: theme.colors.onSurface }}>
        Share Room: {roomName}
      </DialogTitle>
      <DialogContent>
        <View style={styles.content}>
          {/* Room URL Section */}
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <MaterialCommunityIcons
                name="link-variant"
                size={20}
                color={theme.colors.primary}
                style={styles.icon}
              />
              <Text style={[styles.sectionTitle, { color: theme.colors.onSurface }]}>
                Room URL
              </Text>
            </View>
            <View style={styles.valueContainer}>
              <Text
                style={[styles.valueText, { color: theme.colors.onSurfaceVariant }]}
                numberOfLines={2}
              >
                {roomUrl}
              </Text>
            </View>
            <Button
              mode="outlined"
              onPress={handleCopyUrl}
              icon="content-copy"
              style={styles.copyButton}
            >
              Copy URL
            </Button>
          </View>

          {shortCode && (
            <>
              <Divider style={styles.divider} />
              {/* Join Code Section */}
              <View style={styles.section}>
                <View style={styles.sectionHeader}>
                  <MaterialCommunityIcons
                    name="key-variant"
                    size={20}
                    color={theme.colors.primary}
                    style={styles.icon}
                  />
                  <Text style={[styles.sectionTitle, { color: theme.colors.onSurface }]}>
                    Join Code
                  </Text>
                </View>
                <View style={styles.valueContainer}>
                  <Text
                    style={[styles.codeText, { color: theme.colors.primary }]}
                  >
                    {shortCode}
                  </Text>
                </View>
                <Button
                  mode="outlined"
                  onPress={handleCopyCode}
                  icon="content-copy"
                  style={styles.copyButton}
                >
                  Copy Code
                </Button>
              </View>
            </>
          )}
        </View>
      </DialogContent>
      <DialogActions>
        <Button onPress={onDismiss}>Close</Button>
      </DialogActions>
    </Dialog>
  );
};

const styles = StyleSheet.create({
  dialog: {
    borderRadius: 8,
  },
  content: {
    paddingVertical: 8,
  },
  section: {
    marginVertical: 8,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  icon: {
    marginRight: 8,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
  },
  valueContainer: {
    backgroundColor: 'rgba(0, 0, 0, 0.05)',
    borderRadius: 8,
    padding: 12,
    marginBottom: 12,
    minHeight: 48,
    justifyContent: 'center',
  },
  valueText: {
    fontSize: 14,
    fontFamily: 'monospace',
  },
  codeText: {
    fontSize: 24,
    fontWeight: 'bold',
    textAlign: 'center',
    letterSpacing: 4,
  },
  copyButton: {
    marginTop: 4,
  },
  divider: {
    marginVertical: 16,
  },
});

