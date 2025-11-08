import { SupabaseClient } from '@supabase/supabase-js';
import { Track } from '../types';

export interface TrackNote {
  id: number;
  track_id: string;
  track_url?: string;
  room_id?: string;
  user_id: string;
  timestamp_seconds: number;
  note_text: string;
  created_at: string;
  updated_at: string;
  user_profile?: {
    username: string;
    display_name?: string;
    avatar_url?: string;
  };
}

/**
 * Format timestamp in seconds to MM:SS format
 */
export function formatTimestamp(seconds: number): string {
  const minutes = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
}

/**
 * Parse MM:SS format to seconds
 */
export function parseTimestamp(timeString: string): number | null {
  const parts = timeString.split(':');
  if (parts.length !== 2) return null;
  
  const minutes = parseInt(parts[0], 10);
  const seconds = parseInt(parts[1], 10);
  
  if (isNaN(minutes) || isNaN(seconds)) return null;
  if (minutes < 0 || seconds < 0 || seconds >= 60) return null;
  
  return minutes * 60 + seconds;
}

/**
 * Get all notes for a track
 */
export async function getTrackNotes(
  supabase: SupabaseClient,
  trackId: string,
  roomId?: string
): Promise<{ notes: TrackNote[]; error?: string }> {
  try {
    let query = supabase
      .from('track_notes')
      .select(`
        *,
        user_profiles:user_id (
          username,
          display_name,
          avatar_url
        )
      `)
      .eq('track_id', trackId)
      .order('timestamp_seconds', { ascending: true });

    if (roomId) {
      query = query.or(`room_id.is.null,room_id.eq.${roomId}`);
    } else {
      query = query.is('room_id', null);
    }

    const { data, error } = await query;

    if (error) {
      console.error('Error fetching track notes:', error);
      return { notes: [], error: error.message };
    }

    // Transform the data to include user profile
    const notes: TrackNote[] = (data || []).map((note: any) => ({
      ...note,
      user_profile: note.user_profiles ? {
        username: note.user_profiles.username,
        display_name: note.user_profiles.display_name,
        avatar_url: note.user_profiles.avatar_url,
      } : undefined,
    }));

    return { notes };
  } catch (error: any) {
    console.error('Error in getTrackNotes:', error);
    return { notes: [], error: error.message || 'Unknown error' };
  }
}

/**
 * Add a note to a track
 */
export async function addTrackNote(
  supabase: SupabaseClient,
  userId: string,
  track: Track,
  timestampSeconds: number,
  noteText: string,
  roomId?: string
): Promise<{ success: boolean; error?: string; note?: TrackNote }> {
  try {
    if (!noteText.trim()) {
      return { success: false, error: 'Note text cannot be empty' };
    }

    if (timestampSeconds < 0) {
      return { success: false, error: 'Timestamp must be positive' };
    }

    const { data, error } = await supabase
      .from('track_notes')
      .insert({
        track_id: track.id,
        track_url: track.url,
        room_id: roomId || null,
        user_id: userId,
        timestamp_seconds: timestampSeconds,
        note_text: noteText.trim(),
      })
      .select(`
        *,
        user_profiles:user_id (
          username,
          display_name,
          avatar_url
        )
      `)
      .single();

    if (error) {
      console.error('Error adding track note:', error);
      return { success: false, error: error.message };
    }

    const note: TrackNote = {
      ...data,
      user_profile: data.user_profiles ? {
        username: data.user_profiles.username,
        display_name: data.user_profiles.display_name,
        avatar_url: data.user_profiles.avatar_url,
      } : undefined,
    };

    return { success: true, note };
  } catch (error: any) {
    console.error('Error in addTrackNote:', error);
    return { success: false, error: error.message || 'Unknown error' };
  }
}

/**
 * Update a track note
 */
export async function updateTrackNote(
  supabase: SupabaseClient,
  noteId: number,
  userId: string,
  noteText: string,
  timestampSeconds?: number
): Promise<{ success: boolean; error?: string }> {
  try {
    if (!noteText.trim()) {
      return { success: false, error: 'Note text cannot be empty' };
    }

    const updateData: any = {
      note_text: noteText.trim(),
    };

    if (timestampSeconds !== undefined) {
      if (timestampSeconds < 0) {
        return { success: false, error: 'Timestamp must be positive' };
      }
      updateData.timestamp_seconds = timestampSeconds;
    }

    const { error } = await supabase
      .from('track_notes')
      .update(updateData)
      .eq('id', noteId)
      .eq('user_id', userId); // Ensure user can only update their own notes

    if (error) {
      console.error('Error updating track note:', error);
      return { success: false, error: error.message };
    }

    return { success: true };
  } catch (error: any) {
    console.error('Error in updateTrackNote:', error);
    return { success: false, error: error.message || 'Unknown error' };
  }
}

/**
 * Delete a track note
 */
export async function deleteTrackNote(
  supabase: SupabaseClient,
  noteId: number,
  userId: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const { error } = await supabase
      .from('track_notes')
      .delete()
      .eq('id', noteId)
      .eq('user_id', userId); // Ensure user can only delete their own notes

    if (error) {
      console.error('Error deleting track note:', error);
      return { success: false, error: error.message };
    }

    return { success: true };
  } catch (error: any) {
    console.error('Error in deleteTrackNote:', error);
    return { success: false, error: error.message || 'Unknown error' };
  }
}

