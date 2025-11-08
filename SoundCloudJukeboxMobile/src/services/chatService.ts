import { SupabaseClient, RealtimeChannel } from '@supabase/supabase-js';

// Export RealtimeChannel type for use in components
export type { RealtimeChannel };

export interface ChatMessage {
  id: number;
  room_id: string;
  user_id: string;
  message: string;
  message_type: 'text' | 'emoji' | 'track_reaction';
  track_id?: string | null;
  created_at: string;
  user_profiles?: {
    username?: string;
    display_name?: string;
    avatar_url?: string;
  };
}

export interface ChatMessageWithProfile extends ChatMessage {
  username?: string;
  displayName?: string;
  avatarUrl?: string;
}

/**
 * Load recent chat messages for a room
 */
export async function loadChatMessages(
  supabase: SupabaseClient,
  roomId: string,
  limit: number = 50
): Promise<ChatMessageWithProfile[]> {
  try {
    const { data, error } = await supabase
      .from('chat_messages')
      .select(`
        id,
        room_id,
        user_id,
        message,
        message_type,
        track_id,
        created_at,
        user_profiles!inner(username, display_name, avatar_url)
      `)
      .eq('room_id', roomId)
      .order('created_at', { ascending: false })
      .limit(limit);

    if (error) {
      console.error('Error loading chat messages:', error);
      // If the relationship error persists, try without the join as fallback
      if (error.code === 'PGRST200' && error.message?.includes('relationship')) {
        console.warn('Falling back to query without user_profiles join');
        const { data: fallbackData, error: fallbackError } = await supabase
          .from('chat_messages')
          .select('id, room_id, user_id, message, message_type, track_id, created_at')
          .eq('room_id', roomId)
          .order('created_at', { ascending: false })
          .limit(limit);
        
        if (fallbackError) {
          console.error('Fallback query also failed:', fallbackError);
          return [];
        }
        
        // Return messages without profile data
        return (fallbackData || []).reverse().map((msg: any) => ({
          id: msg.id,
          room_id: msg.room_id,
          user_id: msg.user_id,
          message: msg.message,
          message_type: msg.message_type,
          track_id: msg.track_id,
          created_at: msg.created_at,
          username: undefined,
          displayName: undefined,
          avatarUrl: undefined,
        }));
      }
      return [];
    }

    // Reverse to get chronological order (oldest first)
    return (data || []).reverse().map((msg: any) => ({
      id: msg.id,
      room_id: msg.room_id,
      user_id: msg.user_id,
      message: msg.message,
      message_type: msg.message_type,
      track_id: msg.track_id,
      created_at: msg.created_at,
      username: msg.user_profiles?.username,
      displayName: msg.user_profiles?.display_name || msg.user_profiles?.username,
      avatarUrl: msg.user_profiles?.avatar_url,
    }));
  } catch (error) {
    console.error('Error in loadChatMessages:', error);
    return [];
  }
}

/**
 * Send a chat message
 */
export async function sendChatMessage(
  supabase: SupabaseClient,
  roomId: string,
  userId: string,
  message: string,
  messageType: 'text' | 'emoji' | 'track_reaction' = 'text',
  trackId?: string | null
): Promise<{ success: boolean; error?: string }> {
  try {
    if (!message.trim()) {
      return { success: false, error: 'Message cannot be empty' };
    }

    const { error } = await supabase
      .from('chat_messages')
      .insert({
        room_id: roomId,
        user_id: userId,
        message: message.trim(),
        message_type: messageType,
        track_id: trackId || null,
      });

    if (error) {
      console.error('Error sending chat message:', error);
      return { success: false, error: error.message };
    }

    return { success: true };
  } catch (error: any) {
    console.error('Error in sendChatMessage:', error);
    return { success: false, error: error.message || 'Unknown error' };
  }
}

/**
 * Subscribe to real-time chat messages for a room
 */
export function subscribeToChatMessages(
  supabase: SupabaseClient,
  roomId: string,
  onMessage: (message: ChatMessageWithProfile) => void,
  onError?: (error: Error) => void
): RealtimeChannel {
  const channel = supabase
    .channel(`chat:${roomId}`)
    .on(
      'postgres_changes',
      {
        event: 'INSERT',
        schema: 'public',
        table: 'chat_messages',
        filter: `room_id=eq.${roomId}`,
      },
      async (payload) => {
        try {
          // Fetch user profile for the new message
          const { data: profileData } = await supabase
            .from('user_profiles')
            .select('username, display_name, avatar_url')
            .eq('id', payload.new.user_id)
            .single();

          const message: ChatMessageWithProfile = {
            id: payload.new.id,
            room_id: payload.new.room_id,
            user_id: payload.new.user_id,
            message: payload.new.message,
            message_type: payload.new.message_type,
            track_id: payload.new.track_id,
            created_at: payload.new.created_at,
            username: profileData?.username,
            displayName: profileData?.display_name || profileData?.username,
            avatarUrl: profileData?.avatar_url,
          };

          onMessage(message);
        } catch (error) {
          console.error('Error processing real-time message:', error);
          if (onError) {
            onError(error as Error);
          }
        }
      }
    )
    .subscribe();

  return channel;
}

/**
 * Unsubscribe from chat messages
 */
export function unsubscribeFromChatMessages(
  supabase: SupabaseClient,
  channel: RealtimeChannel
) {
  supabase.removeChannel(channel);
}

