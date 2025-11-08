import React, { useState, useEffect } from 'react';
import { View, StyleSheet, ScrollView } from 'react-native';
import {
  Text,
  TextInput,
  IconButton,
  useTheme,
  Card,
} from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { SupabaseClient } from '@supabase/supabase-js';
import { Track } from '../types';
import {
  getTrackNotes,
  addTrackNote,
  deleteTrackNote,
  formatTimestamp,
  parseTimestamp,
  TrackNote,
} from '../services/trackNotesService';
import { Dimensions } from 'react-native';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const IS_MOBILE = SCREEN_WIDTH < 768;

interface TrackNotesProps {
  supabase: SupabaseClient;
  track: Track | null;
  roomId?: string;
  userId?: string;
  currentPosition?: number; // Current playback position in milliseconds
}

export const TrackNotes: React.FC<TrackNotesProps> = ({
  supabase,
  track,
  roomId,
  userId,
  currentPosition = 0,
}) => {
  const theme = useTheme();
  const [notes, setNotes] = useState<TrackNote[]>([]);
  const [loading, setLoading] = useState(false);
  const [showAddNote, setShowAddNote] = useState(false);
  const [noteText, setNoteText] = useState('');
  const [timestampInput, setTimestampInput] = useState('');
  const [addingNote, setAddingNote] = useState(false);

  // Load notes when track changes
  useEffect(() => {
    if (track) {
      loadNotes();
    } else {
      setNotes([]);
    }
  }, [track?.id, roomId]);

  const loadNotes = async () => {
    if (!track) return;

    setLoading(true);
    const { notes: fetchedNotes, error } = await getTrackNotes(supabase, track.id, roomId);
    if (!error) {
      setNotes(fetchedNotes);
    }
    setLoading(false);
  };

  const handleAddNote = async () => {
    if (!track || !userId || !noteText.trim()) return;

    // Parse timestamp or use current position
    let timestampSeconds: number;
    if (timestampInput.trim()) {
      const parsed = parseTimestamp(timestampInput.trim());
      if (parsed === null) {
        // Invalid format, show error or use current position
        timestampSeconds = Math.floor(currentPosition / 1000);
      } else {
        timestampSeconds = parsed;
      }
    } else {
      // Use current playback position
      timestampSeconds = Math.floor(currentPosition / 1000);
    }

    setAddingNote(true);
    const { success, error, note } = await addTrackNote(
      supabase,
      userId,
      track,
      timestampSeconds,
      noteText.trim(),
      roomId
    );

    if (success && note) {
      setNotes([...notes, note].sort((a, b) => a.timestamp_seconds - b.timestamp_seconds));
      setNoteText('');
      setTimestampInput('');
      setShowAddNote(false);
    } else {
      console.error('Error adding note:', error);
    }
    setAddingNote(false);
  };

  const handleDeleteNote = async (noteId: number) => {
    if (!userId) return;

    const { success } = await deleteTrackNote(supabase, noteId, userId);
    if (success) {
      setNotes(notes.filter(n => n.id !== noteId));
    }
  };

  const handleUseCurrentTime = () => {
    const seconds = Math.floor(currentPosition / 1000);
    setTimestampInput(formatTimestamp(seconds));
  };

  if (!track) {
    return null;
  }

  return (
    <Card style={[styles.card, { backgroundColor: theme.colors.surface }]}>
      <Card.Content style={styles.content}>
        <View style={styles.header}>
          <View style={styles.headerLeft}>
            <MaterialCommunityIcons
              name="note-text"
              size={20}
              color={theme.colors.primary}
            />
            <Text style={[styles.title, { color: theme.colors.onSurface }]}>
              Notes
            </Text>
          </View>
          {userId && (
            <IconButton
              icon={showAddNote ? 'close' : 'plus'}
              size={20}
              iconColor={theme.colors.primary}
              onPress={() => {
                setShowAddNote(!showAddNote);
                if (!showAddNote) {
                  handleUseCurrentTime();
                } else {
                  setNoteText('');
                  setTimestampInput('');
                }
              }}
            />
          )}
        </View>

        {showAddNote && userId && (
          <View style={[styles.addNoteContainer, { backgroundColor: theme.colors.surfaceVariant }]}>
            <View style={styles.timestampRow}>
              <TextInput
                label="Time (MM:SS)"
                value={timestampInput}
                onChangeText={setTimestampInput}
                mode="outlined"
                style={styles.timestampInput}
                placeholder="04:30"
                keyboardType="numeric"
                dense
              />
              <IconButton
                icon="clock-outline"
                size={20}
                iconColor={theme.colors.primary}
                onPress={handleUseCurrentTime}
                style={styles.useCurrentButton}
              />
            </View>
            <TextInput
              label="Note"
              value={noteText}
              onChangeText={setNoteText}
              mode="outlined"
              multiline
              numberOfLines={2}
              placeholder="insane drop"
              style={styles.noteInput}
              dense
            />
            <View style={styles.addNoteActions}>
              <IconButton
                icon="check"
                size={20}
                iconColor={theme.colors.primary}
                onPress={handleAddNote}
                disabled={!noteText.trim() || addingNote}
                loading={addingNote}
              />
              <IconButton
                icon="close"
                size={20}
                iconColor={theme.colors.onSurfaceVariant}
                onPress={() => {
                  setShowAddNote(false);
                  setNoteText('');
                  setTimestampInput('');
                }}
              />
            </View>
          </View>
        )}

        {notes.length > 0 ? (
          <ScrollView style={styles.notesList} nestedScrollEnabled>
            {notes.map((note) => (
              <View
                key={note.id}
                style={[
                  styles.noteItem,
                  { borderLeftColor: theme.colors.primary },
                ]}
              >
                <View style={styles.noteHeader}>
                  <Text style={[styles.noteTimestamp, { color: theme.colors.primary }]}>
                    {formatTimestamp(note.timestamp_seconds)}
                  </Text>
                  {note.user_id === userId && (
                    <IconButton
                      icon="delete-outline"
                      size={16}
                      iconColor={theme.colors.error}
                      onPress={() => handleDeleteNote(note.id)}
                      style={styles.deleteButton}
                    />
                  )}
                </View>
                <Text style={[styles.noteText, { color: theme.colors.onSurface }]}>
                  {note.note_text}
                </Text>
                {note.user_profile && (
                  <Text style={[styles.noteAuthor, { color: theme.colors.onSurfaceVariant }]}>
                    {note.user_profile.display_name || note.user_profile.username}
                  </Text>
                )}
              </View>
            ))}
          </ScrollView>
        ) : (
          <Text style={[styles.emptyText, { color: theme.colors.onSurfaceVariant }]}>
            No notes yet. Add one to mark a moment!
          </Text>
        )}
      </Card.Content>
    </Card>
  );
};

const styles = StyleSheet.create({
  card: {
    margin: IS_MOBILE ? 12 : 16,
    marginTop: IS_MOBILE ? 8 : 12,
    borderRadius: 16,
  },
  content: {
    padding: IS_MOBILE ? 12 : 16,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  title: {
    fontSize: IS_MOBILE ? 16 : 18,
    fontWeight: '600',
  },
  addNoteContainer: {
    padding: 12,
    borderRadius: 12,
    marginBottom: 12,
  },
  timestampRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
    gap: 8,
  },
  timestampInput: {
    flex: 1,
    fontSize: 14,
  },
  useCurrentButton: {
    margin: 0,
  },
  noteInput: {
    marginBottom: 8,
    fontSize: 14,
  },
  addNoteActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 4,
  },
  notesList: {
    maxHeight: IS_MOBILE ? 200 : 300,
  },
  noteItem: {
    padding: 12,
    marginBottom: 8,
    borderRadius: 8,
    borderLeftWidth: 3,
    backgroundColor: 'rgba(0, 0, 0, 0.05)',
  },
  noteHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  noteTimestamp: {
    fontSize: IS_MOBILE ? 13 : 14,
    fontWeight: '600',
    fontVariant: ['tabular-nums'],
  },
  deleteButton: {
    margin: 0,
    padding: 0,
  },
  noteText: {
    fontSize: IS_MOBILE ? 14 : 15,
    marginBottom: 4,
  },
  noteAuthor: {
    fontSize: IS_MOBILE ? 11 : 12,
    fontStyle: 'italic',
  },
  emptyText: {
    textAlign: 'center',
    fontStyle: 'italic',
    paddingVertical: 16,
    fontSize: IS_MOBILE ? 13 : 14,
  },
});

