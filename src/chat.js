// Chat functionality module
const { supabase } = require('./auth');

// Load recent chat messages for a room
async function loadChatMessages(roomId, limit = 50) {
  try {
    const { data, error } = await supabase
      .from('chat_messages')
      .select(`
        id,
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
      return [];
    }

    // Reverse to get chronological order
    return data.reverse().map(msg => ({
      id: msg.id,
      userId: msg.user_profiles?.id,
      username: msg.user_profiles?.username,
      displayName: msg.user_profiles?.display_name || msg.user_profiles?.username,
      avatarUrl: msg.user_profiles?.avatar_url,
      message: msg.message,
      messageType: msg.message_type,
      trackId: msg.track_id,
      timestamp: msg.created_at
    }));
  } catch (error) {
    console.error('Error in loadChatMessages:', error);
    return [];
  }
}

// Save a chat message
async function saveChatMessage(roomId, userId, message, messageType = 'text', trackId = null) {
  try {
    const { data, error } = await supabase
      .from('chat_messages')
      .insert({
        room_id: roomId,
        user_id: userId,
        message,
        message_type: messageType,
        track_id: trackId
      })
      .select()
      .single();

    if (error) {
      console.error('Error saving chat message:', error);
      return null;
    }

    return data;
  } catch (error) {
    console.error('Error in saveChatMessage:', error);
    return null;
  }
}

// Get room settings
async function getRoomSettings(roomId) {
  try {
    const { data, error } = await supabase
      .from('room_settings')
      .select('*')
      .eq('room_id', roomId)
      .single();

    if (error && error.code !== 'PGRST116') { // No rows returned
      console.error('Error loading room settings:', error);
      return null;
    }

    return data;
  } catch (error) {
    console.error('Error in getRoomSettings:', error);
    return null;
  }
}

// Update room settings
async function updateRoomSettings(roomId, settings) {
  try {
    const { data, error } = await supabase
      .from('room_settings')
      .upsert({
        room_id: roomId,
        ...settings,
        updated_at: new Date().toISOString()
      })
      .select()
      .single();

    if (error) {
      console.error('Error updating room settings:', error);
      return null;
    }

    return data;
  } catch (error) {
    console.error('Error in updateRoomSettings:', error);
    return null;
  }
}

module.exports = {
  loadChatMessages,
  saveChatMessage,
  getRoomSettings,
  updateRoomSettings
};