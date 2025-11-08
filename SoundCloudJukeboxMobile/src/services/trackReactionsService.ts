import { SupabaseClient } from '@supabase/supabase-js';

export type ReactionType = 'like' | 'dislike' | 'fantastic';

export interface TrackReaction {
  id?: number; // Optional - table may use composite primary key
  room_id: string;
  track_id: string;
  user_id: string;
  reaction_type: ReactionType;
  created_at?: string;
  updated_at?: string;
}

export interface TrackReactionCounts {
  likes: number;
  dislikes: number;
  fantastic: number;
  userReaction?: ReactionType | null;
}

/**
 * Get reaction counts for a track in a room
 */
export async function getTrackReactions(
  supabase: SupabaseClient,
  roomId: string,
  trackId: string,
  userId?: string
): Promise<TrackReactionCounts> {
  try {
    // Get all reactions for this track
    const { data: reactions, error } = await supabase
      .from('track_reactions')
      .select('*')
      .eq('room_id', roomId)
      .eq('track_id', trackId);

    if (error) {
      console.error('Error fetching track reactions:', error);
      return { likes: 0, dislikes: 0, fantastic: 0 };
    }

    // Count reactions by type
    const counts: TrackReactionCounts = {
      likes: reactions?.filter(r => r.reaction_type === 'like').length || 0,
      dislikes: reactions?.filter(r => r.reaction_type === 'dislike').length || 0,
      fantastic: reactions?.filter(r => r.reaction_type === 'fantastic').length || 0,
    };

    // Get user's reaction if userId is provided
    if (userId) {
      const userReaction = reactions?.find(r => r.user_id === userId);
      counts.userReaction = userReaction?.reaction_type || null;
    }

    return counts;
  } catch (error) {
    console.error('Error in getTrackReactions:', error);
    return { likes: 0, dislikes: 0, fantastic: 0 };
  }
}

/**
 * Add or update a reaction for a track
 */
export async function setTrackReaction(
  supabase: SupabaseClient,
  roomId: string,
  trackId: string,
  userId: string,
  reactionType: ReactionType
): Promise<{ success: boolean; error?: string }> {
  try {
    // Check if user already has a reaction for this track
    // Use composite key (room_id, track_id, user_id) instead of id
    const { data: existing, error: checkError } = await supabase
      .from('track_reactions')
      .select('reaction_type')
      .eq('room_id', roomId)
      .eq('track_id', trackId)
      .eq('user_id', userId)
      .maybeSingle();

    if (checkError && checkError.code !== 'PGRST116') {
      // PGRST116 is "not found" which is expected if no reaction exists
      console.error('Error checking existing reaction:', checkError);
      return { success: false, error: checkError.message };
    }

    if (existing) {
      // If user already has this reaction, remove it (toggle off)
      if (existing.reaction_type === reactionType) {
        const { error: deleteError } = await supabase
          .from('track_reactions')
          .delete()
          .eq('room_id', roomId)
          .eq('track_id', trackId)
          .eq('user_id', userId);

        if (deleteError) {
          console.error('Error removing reaction:', deleteError);
          return { success: false, error: deleteError.message };
        }
        return { success: true };
      } else {
        // Update to new reaction type using composite key
        const { error: updateError } = await supabase
          .from('track_reactions')
          .update({ reaction_type: reactionType, updated_at: new Date().toISOString() })
          .eq('room_id', roomId)
          .eq('track_id', trackId)
          .eq('user_id', userId);

        if (updateError) {
          console.error('Error updating reaction:', updateError);
          return { success: false, error: updateError.message };
        }
        return { success: true };
      }
    } else {
      // Insert new reaction using RPC function to bypass RLS return issues
      const { error: insertError } = await supabase
        .rpc('insert_track_reaction', {
          p_room_id: roomId,
          p_track_id: trackId,
          p_user_id: userId,
          p_reaction_type: reactionType,
        });

      if (insertError) {
        console.error('Error inserting reaction:', insertError);
        return { success: false, error: insertError.message };
      }
      return { success: true };
    }
  } catch (error: any) {
    console.error('Error in setTrackReaction:', error);
    return { success: false, error: error.message || 'Unknown error' };
  }
}

/**
 * Remove a reaction for a track
 */
export async function removeTrackReaction(
  supabase: SupabaseClient,
  roomId: string,
  trackId: string,
  userId: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const { error } = await supabase
      .from('track_reactions')
      .delete()
      .eq('room_id', roomId)
      .eq('track_id', trackId)
      .eq('user_id', userId);

    if (error) {
      console.error('Error removing reaction:', error);
      return { success: false, error: error.message };
    }

    return { success: true };
  } catch (error: any) {
    console.error('Error in removeTrackReaction:', error);
    return { success: false, error: error.message || 'Unknown error' };
  }
}

