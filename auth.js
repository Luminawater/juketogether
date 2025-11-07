// Supabase Authentication Module
const { createClient } = require('@supabase/supabase-js');

// Initialize Supabase client
const supabaseUrl = process.env.SUPABASE_URL || 'https://smryjxchwbfpjvpecffg.supabase.co';
const supabaseKey = process.env.SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNtcnlqeGNod2JmcGp2cGVjZmZnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjI1MzcxOTAsImV4cCI6MjA3ODExMzE5MH0.M1jQK3TSWMaAspSOkR-x8FkIi_EECgSZjTpb9lks0hQ';

const supabase = createClient(supabaseUrl, supabaseKey);

// Authentication middleware for Socket.io
function authenticateSocket(socket, next) {
  const token = socket.handshake.auth?.token;

  if (!token) {
    // Allow anonymous users for backward compatibility
    socket.isAuthenticated = false;
    socket.userId = socket.id; // Use socket ID as user ID for anonymous users
    socket.userProfile = null;
    return next();
  }

  // Verify the JWT token
  supabase.auth.getUser(token).then(({ data: { user }, error }) => {
    if (error || !user) {
      socket.isAuthenticated = false;
      socket.userId = socket.id;
      socket.userProfile = null;
      return next();
    }

    socket.isAuthenticated = true;
    socket.userId = user.id;
    socket.userProfile = {
      id: user.id,
      username: user.user_metadata?.username,
      displayName: user.user_metadata?.full_name,
      avatarUrl: user.user_metadata?.avatar_url
    };

    next();
  }).catch(() => {
    socket.isAuthenticated = false;
    socket.userId = socket.id;
    socket.userProfile = null;
    next();
  });
}

// Get user profile
async function getUserProfile(userId) {
  try {
    const { data, error } = await supabase
      .from('user_profiles')
      .select('*')
      .eq('id', userId)
      .single();

    if (error && error.code !== 'PGRST116') { // PGRST116 = no rows returned
      console.error('Error fetching user profile:', error);
      return null;
    }

    return data;
  } catch (error) {
    console.error('Error in getUserProfile:', error);
    return null;
  }
}

// Update user profile
async function updateUserProfile(userId, updates) {
  try {
    const { data, error } = await supabase
      .from('user_profiles')
      .upsert({
        id: userId,
        ...updates,
        updated_at: new Date().toISOString()
      })
      .select()
      .single();

    if (error) {
      console.error('Error updating user profile:', error);
      return null;
    }

    return data;
  } catch (error) {
    console.error('Error in updateUserProfile:', error);
    return null;
  }
}

// Create user profile if it doesn't exist
async function ensureUserProfile(userId, userMetadata) {
  try {
    let profile = await getUserProfile(userId);

    if (!profile) {
      // Create new profile
      const username = userMetadata?.username || `user_${userId.substring(0, 8)}`;
      const displayName = userMetadata?.full_name || username;

      profile = await updateUserProfile(userId, {
        username,
        display_name: displayName,
        avatar_url: userMetadata?.avatar_url
      });
    }

    return profile;
  } catch (error) {
    console.error('Error ensuring user profile:', error);
    return null;
  }
}

module.exports = {
  supabase,
  authenticateSocket,
  getUserProfile,
  updateUserProfile,
  ensureUserProfile
};