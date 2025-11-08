import { SupabaseClient } from '@supabase/supabase-js';
import { Track } from '../types';
import { saveMediaPreference, removeMediaPreference } from './userMediaPreferencesService';

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
  userReactions: ReactionType[];
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
      return { likes: 0, dislikes: 0, fantastic: 0, userReactions: [] };
    }

    // Count reactions by type
    const counts: TrackReactionCounts = {
      likes: reactions?.filter(r => r.reaction_type === 'like').length || 0,
      dislikes: reactions?.filter(r => r.reaction_type === 'dislike').length || 0,
      fantastic: reactions?.filter(r => r.reaction_type === 'fantastic').length || 0,
      userReactions: [],
    };

    // Get user's reactions if userId is provided
    if (userId) {
      const userReactions = reactions?.filter(r => r.user_id === userId) || [];
      counts.userReactions = userReactions.map(r => r.reaction_type);
    }

    return counts;
  } catch (error) {
    console.error('Error in getTrackReactions:', error);
    return { likes: 0, dislikes: 0, fantastic: 0, userReactions: [] };
  }
}

/**
 * Add or update a reaction for a track
 * Also saves the media to user's preferences if track is provided
 */
export async function setTrackReaction(
  supabase: SupabaseClient,
  roomId: string,
  trackId: string,
  userId: string,
  reactionType: ReactionType,
  track?: Track | null
): Promise<{ success: boolean; error?: string; reactions?: TrackReactionCounts }> {
  try {
    // Get current reaction counts first
    const { data: currentReactions, error: fetchError } = await supabase
      .from('track_reactions')
      .select('reaction_type')
      .eq('room_id', roomId)
      .eq('track_id', trackId);

    if (fetchError) {
      console.error('Error fetching current reactions:', fetchError);
      return { success: false, error: fetchError.message };
    }

    // Count current reactions
    const currentCounts = {
      likes: currentReactions?.filter(r => r.reaction_type === 'like').length || 0,
      dislikes: currentReactions?.filter(r => r.reaction_type === 'dislike').length || 0,
      fantastic: currentReactions?.filter(r => r.reaction_type === 'fantastic').length || 0,
      userReactions: currentReactions?.filter(r => r.user_id === userId).map(r => r.reaction_type) || [],
    };

    // Check if user already has this specific reaction for this track
    const { data: existingReaction, error: checkError } = await supabase
      .from('track_reactions')
      .select('id, reaction_type')
      .eq('room_id', roomId)
      .eq('track_id', trackId)
      .eq('user_id', userId)
      .eq('reaction_type', reactionType)
      .maybeSingle();

    if (checkError && checkError.code !== 'PGRST116') {
      console.error('Error checking existing reaction:', checkError);
      return { success: false, error: checkError.message };
    }

    let newCounts: TrackReactionCounts;

    // If user already has this reaction, remove it (toggle off)
    if (existingReaction) {
      const { error: deleteError } = await supabase
        .from('track_reactions')
        .delete()
        .eq('id', existingReaction.id);

      if (deleteError) {
        console.error('Error removing reaction:', deleteError);
        return { success: false, error: deleteError.message };
      }

      // Also remove from user media preferences (toggle off)
      if (track) {
        const preferenceType = reactionType === 'fantastic' ? 'favourite' : reactionType;
        await removeMediaPreference(supabase, userId, track.id, preferenceType as 'like' | 'dislike' | 'favourite');
      }

      // Calculate new counts after removal
      newCounts = {
        likes: currentCounts.likes - (reactionType === 'like' ? 1 : 0),
        dislikes: currentCounts.dislikes - (reactionType === 'dislike' ? 1 : 0),
        fantastic: currentCounts.fantastic - (reactionType === 'fantastic' ? 1 : 0),
        userReactions: currentCounts.userReactions.filter(r => r !== reactionType),
      };

      return { success: true, reactions: newCounts };
    }

    // Handle mutually exclusive reactions (like/dislike)
    if (reactionType === 'like' || reactionType === 'dislike') {
      const oppositeType = reactionType === 'like' ? 'dislike' : 'like';

      // Remove any existing opposite reaction
      const { data: oppositeReaction } = await supabase
        .from('track_reactions')
        .select('id')
        .eq('room_id', roomId)
        .eq('track_id', trackId)
        .eq('user_id', userId)
        .eq('reaction_type', oppositeType)
        .maybeSingle();

      if (oppositeReaction) {
        await supabase
          .from('track_reactions')
          .delete()
          .eq('id', oppositeReaction.id);

        // Also remove the opposite preference
        if (track) {
          await removeMediaPreference(supabase, userId, track.id, oppositeType as 'like' | 'dislike');
        }
      }
    }

    // Insert new reaction
    const { error: insertError } = await supabase
      .from('track_reactions')
      .insert({
        room_id: roomId,
        track_id: trackId,
        user_id: userId,
        reaction_type: reactionType,
      });

    if (insertError) {
      console.error('Error inserting reaction:', insertError);
      return { success: false, error: insertError.message };
    }

    // Also save to user media preferences
    if (track) {
      const preferenceType = reactionType === 'fantastic' ? 'favourite' : reactionType;
      await saveMediaPreference(supabase, userId, track, preferenceType as 'like' | 'dislike' | 'favourite');
    }

    // Calculate new counts after addition
    let updatedUserReactions = [...currentCounts.userReactions];

    // Handle mutually exclusive like/dislike reactions
    if (reactionType === 'like') {
      updatedUserReactions = updatedUserReactions.filter(r => r !== 'dislike'); // Remove dislike if present
    } else if (reactionType === 'dislike') {
      updatedUserReactions = updatedUserReactions.filter(r => r !== 'like'); // Remove like if present
    }
    // Add the new reaction if not already present
    if (!updatedUserReactions.includes(reactionType)) {
      updatedUserReactions.push(reactionType);
    }

    newCounts = {
      likes: currentCounts.likes + (reactionType === 'like' ? 1 : 0),
      dislikes: currentCounts.dislikes + (reactionType === 'dislike' ? 1 : 0),
      fantastic: currentCounts.fantastic + (reactionType === 'fantastic' ? 1 : 0),
      userReactions: updatedUserReactions,
    };

    return { success: true, reactions: newCounts };
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

