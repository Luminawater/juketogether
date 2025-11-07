-- Ensure user_follows table exists (for follower counting)
CREATE TABLE IF NOT EXISTS user_follows (
  id SERIAL PRIMARY KEY,
  follower_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  following_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(follower_id, following_id)
);

CREATE INDEX IF NOT EXISTS idx_user_follows_follower ON user_follows(follower_id);
CREATE INDEX IF NOT EXISTS idx_user_follows_following ON user_follows(following_id);

-- Enable RLS for user_follows if not already enabled
ALTER TABLE user_follows ENABLE ROW LEVEL SECURITY;

-- RLS policies for user_follows (allow reading for discovery, writing for authenticated users)
DROP POLICY IF EXISTS "Users can view all follows" ON user_follows;
CREATE POLICY "Users can view all follows" ON user_follows
  FOR SELECT USING (true);

DROP POLICY IF EXISTS "Users can manage their own follows" ON user_follows;
CREATE POLICY "Users can manage their own follows" ON user_follows
  FOR ALL USING (auth.uid() = follower_id);

-- Add discovery and filtering features
DO $$
BEGIN
  -- Add country to user_profiles (user's country preference)
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'user_profiles' AND column_name = 'country'
  ) THEN
    ALTER TABLE user_profiles ADD COLUMN country TEXT;
  END IF;
  
  -- Add country to room_settings (room's country/location)
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'room_settings' AND column_name = 'country'
  ) THEN
    ALTER TABLE room_settings ADD COLUMN country TEXT;
  END IF;
  
  -- Add total playtime tracking to room_settings (in seconds)
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'room_settings' AND column_name = 'total_playtime_seconds'
  ) THEN
    ALTER TABLE room_settings ADD COLUMN total_playtime_seconds INTEGER DEFAULT 0;
  END IF;
  
  -- Add last_active_at to track when room was last active
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'room_settings' AND column_name = 'last_active_at'
  ) THEN
    ALTER TABLE room_settings ADD COLUMN last_active_at TIMESTAMP WITH TIME ZONE DEFAULT NOW();
  END IF;
END $$;

-- Create index for faster country filtering
CREATE INDEX IF NOT EXISTS idx_room_settings_country ON room_settings(country) WHERE country IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_user_profiles_country ON user_profiles(country) WHERE country IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_room_settings_total_playtime ON room_settings(total_playtime_seconds);

-- Create function to get follower count for a user
CREATE OR REPLACE FUNCTION get_user_follower_count(user_uuid UUID)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  follower_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO follower_count
  FROM user_follows
  WHERE following_id = user_uuid;
  
  RETURN COALESCE(follower_count, 0);
END;
$$;

-- Create function to get room stats for discovery
CREATE OR REPLACE FUNCTION get_room_discovery_stats(room_id_param TEXT)
RETURNS TABLE (
  room_id TEXT,
  follower_count BIGINT,
  total_playtime_seconds INTEGER,
  user_count INTEGER
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  host_user_id UUID;
BEGIN
  -- Get host user ID from room
  SELECT host_user_id INTO host_user_id
  FROM rooms
  WHERE id = room_id_param;
  
  -- Return stats
  RETURN QUERY
  SELECT 
    room_id_param,
    COALESCE((SELECT COUNT(*) FROM user_follows WHERE following_id = host_user_id), 0)::BIGINT as follower_count,
    COALESCE((SELECT total_playtime_seconds FROM room_settings WHERE room_id = room_id_param), 0) as total_playtime_seconds,
    COALESCE((SELECT COUNT(*) FROM user_volumes WHERE room_id = room_id_param), 0)::INTEGER as user_count;
END;
$$;

