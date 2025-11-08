-- Add media visibility settings to user_profiles table
ALTER TABLE user_profiles 
ADD COLUMN IF NOT EXISTS show_liked_media BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS show_disliked_media BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS show_favourite_media BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS public_playlist BOOLEAN DEFAULT false;

-- Create user_media_preferences table to store user's liked, disliked, and favourite media
CREATE TABLE IF NOT EXISTS user_media_preferences (
  id BIGSERIAL PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  track_id TEXT NOT NULL,
  track_url TEXT NOT NULL,
  track_info JSONB NOT NULL, -- Stores full track info (title, artist, thumbnail, etc.)
  preference_type TEXT NOT NULL CHECK (preference_type IN ('like', 'dislike', 'favourite')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(user_id, track_id, preference_type) -- Prevent duplicate preferences for same track
);

-- Create index for faster queries
CREATE INDEX IF NOT EXISTS idx_user_media_preferences_user_id ON user_media_preferences(user_id);
CREATE INDEX IF NOT EXISTS idx_user_media_preferences_type ON user_media_preferences(preference_type);
CREATE INDEX IF NOT EXISTS idx_user_media_preferences_user_type ON user_media_preferences(user_id, preference_type);

-- Enable RLS
ALTER TABLE user_media_preferences ENABLE ROW LEVEL SECURITY;

-- RLS Policies
-- Users can view their own preferences
CREATE POLICY "Users can view their own media preferences"
  ON user_media_preferences
  FOR SELECT
  USING (auth.uid() = user_id);

-- Users can view other users' preferences if they have public_playlist enabled and show_*_media enabled
CREATE POLICY "Users can view public media preferences"
  ON user_media_preferences
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles up
      WHERE up.id = user_media_preferences.user_id
      AND up.public_playlist = true
      AND (
        (preference_type = 'like' AND up.show_liked_media = true) OR
        (preference_type = 'dislike' AND up.show_disliked_media = true) OR
        (preference_type = 'favourite' AND up.show_favourite_media = true)
      )
    )
  );

-- Users can insert their own preferences
CREATE POLICY "Users can insert their own media preferences"
  ON user_media_preferences
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Users can update their own preferences
CREATE POLICY "Users can update their own media preferences"
  ON user_media_preferences
  FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Users can delete their own preferences
CREATE POLICY "Users can delete their own media preferences"
  ON user_media_preferences
  FOR DELETE
  USING (auth.uid() = user_id);

-- Function to automatically update updated_at timestamp
CREATE OR REPLACE FUNCTION update_user_media_preferences_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to update updated_at
CREATE TRIGGER update_user_media_preferences_updated_at
  BEFORE UPDATE ON user_media_preferences
  FOR EACH ROW
  EXECUTE FUNCTION update_user_media_preferences_updated_at();

