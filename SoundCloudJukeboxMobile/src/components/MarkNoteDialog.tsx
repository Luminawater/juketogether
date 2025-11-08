import React, { useState, useEffect } from 'react';
import { View, StyleSheet } from 'react-native';
import {
  Dialog,
  Button,
  Text,
  TextInput,
  useTheme,
  Portal,
} from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { Track } from '../types';
import { addTrackNote, formatTimestamp } from '../services/trackNotesService';
import { SupabaseClient } from '@supabase/supabase-js';

interface MarkNoteDialogProps {
  visible: boolean;
  onDismiss: () => void;
  track: Track | null;
  currentPosition: number; // in milliseconds
  roomId?: string;
  userId?: string;
  supabase: SupabaseClient;
}

export const MarkNoteDialog: React.FC<MarkNoteDialogProps> = ({
  visible,
  onDismiss,
  track,
  currentPosition,
  roomId,
  userId,
  supabase,
}) => {
  const theme = useTheme();
  const [noteText, setNoteText] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (visible) {
      setNoteText('');
    }
  }, [visible]);

  const handleSave = async () => {
    if (!track || !userId || !noteText.trim()) return;

    setSaving(true);
    const timestampSeconds = Math.floor(currentPosition / 1000);
    const { success, error } = await addTrackNote(
      supabase,
      userId,
      track,
      timestampSeconds,
      noteText.trim(),
      roomId
    );

    setSaving(false);
    if (success) {
      setNoteText('');
      onDismiss();
    } else {
      console.error('Error adding note:', error);
    }
  };

  const currentTime = formatTimestamp(Math.floor(currentPosition / 1000));

  return (
    <Portal>
      <Dialog
        visible={visible}
        onDismiss={onDismiss}
        style={[styles.dialog, { backgroundColor: theme.colors.surface }]}
      >
        <Dialog.Title style={{ color: theme.colors.onSurface }}>
          Mark Moment
        </Dialog.Title>
        <Dialog.Content>
          <View style={styles.timeContainer}>
            <MaterialCommunityIcons
              name="clock-outline"
              size={20}
              color={theme.colors.primary}
            />
            <Text style={[styles.timeText, { color: theme.colors.onSurface }]}>
              {currentTime}
            </Text>
          </View>
          <TextInput
            label="Note"
            value={noteText}
            onChangeText={setNoteText}
            mode="outlined"
            multiline
            numberOfLines={3}
            placeholder="insane drop"
            style={styles.input}
            autoFocus
          />
        </Dialog.Content>
        <Dialog.Actions>
          <Button
            onPress={onDismiss}
            textColor={theme.colors.onSurfaceVariant}
          >
            Cancel
          </Button>
          <Button
            onPress={handleSave}
            mode="contained"
            disabled={!noteText.trim() || saving}
            loading={saving}
          >
            Save
          </Button>
        </Dialog.Actions>
      </Dialog>
    </Portal>
  );
};

const styles = StyleSheet.create({
  dialog: {
    borderRadius: 16,
  },
  timeContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 16,
  },
  timeText: {
    fontSize: 16,
    fontWeight: '600',
    fontVariant: ['tabular-nums'],
  },
  input: {
    marginTop: 8,
  },
});





