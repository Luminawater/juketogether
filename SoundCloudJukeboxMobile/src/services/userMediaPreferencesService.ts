import { SupabaseClient } from '@supabase/supabase-js';
import { Track } from '../types';

export type MediaPreferenceType = 'like' | 'dislike' | 'favourite';

export interface UserMediaPreference {
  id?: number;
  user_id: string;
  track_id: string;
  track_url: string;
  track_info: Track['info'];
  preference_type: MediaPreferenceType;
  created_at?: string;
  updated_at?: string;
}

/**
 * Save or update a media preference for a user
 * When a user likes/dislikes/favourites a track, it's saved to their preferences
 */
export async function saveMediaPreference(
  supabase: SupabaseClient,
  userId: string,
  track: Track,
  preferenceType: MediaPreferenceType
): Promise<{ success: boolean; error?: string }> {
  try {
    // Check if user already has this preference for this track
    const { data: existing, error: checkError } = await supabase
      .from('user_media_preferences')
      .select('id, preference_type')
      .eq('user_id', userId)
      .eq('track_id', track.id)
      .eq('preference_type', preferenceType)
      .maybeSingle();

    if (checkError && checkError.code !== 'PGRST116') {
      console.error('Error checking existing preference:', checkError);
      return { success: false, error: checkError.message };
    }

    if (existing) {
      // Preference already exists, remove it (toggle off)
      const { error: deleteError } = await supabase
        .from('user_media_preferences')
        .delete()
        .eq('id', existing.id);

      if (deleteError) {
        console.error('Error removing preference:', deleteError);
        return { success: false, error: deleteError.message };
      }
      return { success: true };
    } else {
      // Remove any other preference types for this track (user can only have one preference type per track)
      // But actually, we want to allow multiple types (like and favourite can coexist)
      // So we only remove the opposite types if needed
      if (preferenceType === 'like') {
        // Remove dislike if it exists
        await supabase
          .from('user_media_preferences')
          .delete()
          .eq('user_id', userId)
          .eq('track_id', track.id)
          .eq('preference_type', 'dislike');
      } else if (preferenceType === 'dislike') {
        // Remove like if it exists
        await supabase
          .from('user_media_preferences')
          .delete()
          .eq('user_id', userId)
          .eq('track_id', track.id)
          .eq('preference_type', 'like');
      }
      // Note: 'favourite' can coexist with 'like' or 'dislike'

      // Insert new preference
      const { error: insertError } = await supabase
        .from('user_media_preferences')
        .insert({
          user_id: userId,
          track_id: track.id,
          track_url: track.url,
          track_info: track.info,
          preference_type: preferenceType,
        });

      if (insertError) {
        console.error('Error inserting preference:', insertError);
        return { success: false, error: insertError.message };
      }
      return { success: true };
    }
  } catch (error: any) {
    console.error('Error in saveMediaPreference:', error);
    return { success: false, error: error.message || 'Unknown error' };
  }
}

/**
 * Get user's media preferences by type
 */
export async function getUserMediaPreferences(
  supabase: SupabaseClient,
  userId: string,
  preferenceType: MediaPreferenceType
): Promise<UserMediaPreference[]> {
  try {
    const { data, error } = await supabase
      .from('user_media_preferences')
      .select('*')
      .eq('user_id', userId)
      .eq('preference_type', preferenceType)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching media preferences:', error);
      return [];
    }

    return (data || []) as UserMediaPreference[];
  } catch (error) {
    console.error('Error in getUserMediaPreferences:', error);
    return [];
  }
}

/**
 * Check if user has a specific preference for a track
 */
export async function hasMediaPreference(
  supabase: SupabaseClient,
  userId: string,
  trackId: string,
  preferenceType: MediaPreferenceType
): Promise<boolean> {
  try {
    const { data, error } = await supabase
      .from('user_media_preferences')
      .select('id')
      .eq('user_id', userId)
      .eq('track_id', trackId)
      .eq('preference_type', preferenceType)
      .maybeSingle();

    if (error && error.code !== 'PGRST116') {
      console.error('Error checking media preference:', error);
      return false;
    }

    return !!data;
  } catch (error) {
    console.error('Error in hasMediaPreference:', error);
    return false;
  }
}

/**
 * Remove a media preference
 */
export async function removeMediaPreference(
  supabase: SupabaseClient,
  userId: string,
  trackId: string,
  preferenceType: MediaPreferenceType
): Promise<{ success: boolean; error?: string }> {
  try {
    const { error } = await supabase
      .from('user_media_preferences')
      .delete()
      .eq('user_id', userId)
      .eq('track_id', trackId)
      .eq('preference_type', preferenceType);

    if (error) {
      console.error('Error removing preference:', error);
      return { success: false, error: error.message };
    }

    return { success: true };
  } catch (error: any) {
    console.error('Error in removeMediaPreference:', error);
    return { success: false, error: error.message || 'Unknown error' };
  }
}

