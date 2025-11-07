-- Analytics and Statistics Migration
-- This migration adds comprehensive analytics tracking for rooms and users

-- Room Analytics Table: Tracks metrics for each room
CREATE TABLE IF NOT EXISTS room_analytics (
  id SERIAL PRIMARY KEY,
  room_id TEXT NOT NULL REFERENCES rooms(id) ON DELETE CASCADE,
  host_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  
  -- Listener metrics
  total_listeners INTEGER DEFAULT 0, -- Total unique users who joined
  peak_listeners INTEGER DEFAULT 0, -- Maximum concurrent listeners at once
  current_listeners INTEGER DEFAULT 0, -- Current active listeners
  
  -- Activity metrics
  total_tracks_played INTEGER DEFAULT 0,
  total_play_time_seconds INTEGER DEFAULT 0, -- Total time music was played
  total_queue_additions INTEGER DEFAULT 0, -- Total tracks added to queue
  
  -- Time metrics
  first_activity_at TIMESTAMP WITH TIME ZONE,
  last_activity_at TIMESTAMP WITH TIME ZONE,
  total_active_duration_seconds INTEGER DEFAULT 0, -- Total time room was active
  
  -- Engagement metrics
  total_sessions INTEGER DEFAULT 0, -- Total join/leave sessions
  
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  UNIQUE(room_id)
);

-- User Analytics Table: Tracks metrics for each user/DJ
CREATE TABLE IF NOT EXISTS user_analytics (
  id SERIAL PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  
  -- Room creation metrics
  total_rooms_created INTEGER DEFAULT 0,
  
  -- Listener metrics (aggregated across all rooms)
  total_listeners_all_rooms INTEGER DEFAULT 0, -- Total unique listeners across all rooms
  peak_listeners_all_rooms INTEGER DEFAULT 0, -- Peak concurrent listeners across all rooms
  
  -- Activity metrics
  total_tracks_played_all_rooms INTEGER DEFAULT 0,
  total_play_time_all_rooms_seconds INTEGER DEFAULT 0,
  
  -- Engagement metrics
  total_rooms_joined INTEGER DEFAULT 0, -- Total rooms user has joined (as listener)
  total_sessions_hosted INTEGER DEFAULT 0, -- Total sessions where user was host
  
  -- Time metrics
  first_room_created_at TIMESTAMP WITH TIME ZONE,
  last_activity_at TIMESTAMP WITH TIME ZONE,
  
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  UNIQUE(user_id)
);

-- Room Sessions Table: Tracks individual user sessions in rooms
CREATE TABLE IF NOT EXISTS room_sessions (
  id SERIAL PRIMARY KEY,
  room_id TEXT NOT NULL REFERENCES rooms(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  host_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  
  -- Session details
  joined_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  left_at TIMESTAMP WITH TIME ZONE,
  duration_seconds INTEGER, -- Calculated when user leaves
  
  -- Session metrics
  tracks_played_during_session INTEGER DEFAULT 0,
  was_host BOOLEAN DEFAULT false,
  
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Track Plays Table: Tracks each track that gets played
CREATE TABLE IF NOT EXISTS track_plays (
  id SERIAL PRIMARY KEY,
  room_id TEXT NOT NULL REFERENCES rooms(id) ON DELETE CASCADE,
  host_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL, -- User who added the track
  
  -- Track details
  track_id TEXT NOT NULL,
  track_url TEXT,
  track_title TEXT,
  track_artist TEXT,
  platform TEXT, -- 'soundcloud', 'spotify', 'youtube'
  
  -- Play metrics
  played_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  duration_seconds INTEGER, -- Track duration if available
  
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for faster queries
CREATE INDEX IF NOT EXISTS idx_room_analytics_room_id ON room_analytics(room_id);
CREATE INDEX IF NOT EXISTS idx_room_analytics_host_user_id ON room_analytics(host_user_id);
CREATE INDEX IF NOT EXISTS idx_user_analytics_user_id ON user_analytics(user_id);
CREATE INDEX IF NOT EXISTS idx_room_sessions_room_id ON room_sessions(room_id);
CREATE INDEX IF NOT EXISTS idx_room_sessions_user_id ON room_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_room_sessions_host_user_id ON room_sessions(host_user_id);
CREATE INDEX IF NOT EXISTS idx_room_sessions_joined_at ON room_sessions(joined_at);
CREATE INDEX IF NOT EXISTS idx_track_plays_room_id ON track_plays(room_id);
CREATE INDEX IF NOT EXISTS idx_track_plays_host_user_id ON track_plays(host_user_id);
CREATE INDEX IF NOT EXISTS idx_track_plays_played_at ON track_plays(played_at);

-- Enable Row Level Security
ALTER TABLE room_analytics ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_analytics ENABLE ROW LEVEL SECURITY;
ALTER TABLE room_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE track_plays ENABLE ROW LEVEL SECURITY;

-- RLS Policies: Allow public read access for leaderboards, authenticated write
DROP POLICY IF EXISTS "Public can view room analytics" ON room_analytics;
CREATE POLICY "Public can view room analytics" ON room_analytics
  FOR SELECT USING (true);

DROP POLICY IF EXISTS "Authenticated users can update room analytics" ON room_analytics;
CREATE POLICY "Authenticated users can update room analytics" ON room_analytics
  FOR ALL USING (auth.role() = 'authenticated');

DROP POLICY IF EXISTS "Public can view user analytics" ON user_analytics;
CREATE POLICY "Public can view user analytics" ON user_analytics
  FOR SELECT USING (true);

DROP POLICY IF EXISTS "Users can update their own analytics" ON user_analytics;
CREATE POLICY "Users can update their own analytics" ON user_analytics
  FOR ALL USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Public can view room sessions" ON room_sessions;
CREATE POLICY "Public can view room sessions" ON room_sessions
  FOR SELECT USING (true);

DROP POLICY IF EXISTS "Authenticated users can insert room sessions" ON room_sessions;
CREATE POLICY "Authenticated users can insert room sessions" ON room_sessions
  FOR INSERT WITH CHECK (auth.role() = 'authenticated');

DROP POLICY IF EXISTS "Users can update their own sessions" ON room_sessions;
CREATE POLICY "Users can update their own sessions" ON room_sessions
  FOR UPDATE USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Public can view track plays" ON track_plays;
CREATE POLICY "Public can view track plays" ON track_plays
  FOR SELECT USING (true);

DROP POLICY IF EXISTS "Authenticated users can insert track plays" ON track_plays;
CREATE POLICY "Authenticated users can insert track plays" ON track_plays
  FOR INSERT WITH CHECK (auth.role() = 'authenticated');

-- Function to update room analytics when user joins
CREATE OR REPLACE FUNCTION update_room_analytics_on_join(
  p_room_id TEXT,
  p_host_user_id UUID,
  p_user_id UUID
) RETURNS void AS $$
BEGIN
  -- Insert or update room analytics
  INSERT INTO room_analytics (room_id, host_user_id, current_listeners, total_listeners, first_activity_at, last_activity_at)
  VALUES (p_room_id, p_host_user_id, 1, 1, NOW(), NOW())
  ON CONFLICT (room_id) DO UPDATE SET
    current_listeners = room_analytics.current_listeners + 1,
    total_listeners = GREATEST(room_analytics.total_listeners, 
      (SELECT COUNT(DISTINCT user_id) FROM room_sessions WHERE room_id = p_room_id)),
    peak_listeners = GREATEST(room_analytics.peak_listeners, 
      (SELECT COUNT(*) FROM room_sessions WHERE room_id = p_room_id AND left_at IS NULL)),
    last_activity_at = NOW(),
    updated_at = NOW();
  
  -- Update user analytics for host
  IF p_host_user_id IS NOT NULL THEN
    INSERT INTO user_analytics (user_id, total_rooms_created, last_activity_at)
    VALUES (p_host_user_id, 1, NOW())
    ON CONFLICT (user_id) DO UPDATE SET
      last_activity_at = NOW(),
      updated_at = NOW();
  END IF;
END;
$$ LANGUAGE plpgsql;

-- Function to update room analytics when user leaves
CREATE OR REPLACE FUNCTION update_room_analytics_on_leave(
  p_room_id TEXT,
  p_user_id UUID
) RETURNS void AS $$
DECLARE
  v_duration INTEGER;
BEGIN
  -- Update session with leave time and duration
  UPDATE room_sessions
  SET left_at = NOW(),
      duration_seconds = EXTRACT(EPOCH FROM (NOW() - joined_at))::INTEGER
  WHERE room_id = p_room_id 
    AND user_id = p_user_id 
    AND left_at IS NULL;
  
  -- Update room analytics
  UPDATE room_analytics
  SET current_listeners = GREATEST(0, current_listeners - 1),
      last_activity_at = NOW(),
      updated_at = NOW()
  WHERE room_id = p_room_id;
END;
$$ LANGUAGE plpgsql;

-- Function to update analytics when track is played
CREATE OR REPLACE FUNCTION update_analytics_on_track_play(
  p_room_id TEXT,
  p_host_user_id UUID,
  p_user_id UUID,
  p_track_id TEXT,
  p_track_url TEXT,
  p_track_title TEXT,
  p_track_artist TEXT,
  p_platform TEXT,
  p_duration_seconds INTEGER
) RETURNS void AS $$
BEGIN
  -- Insert track play record
  INSERT INTO track_plays (
    room_id, host_user_id, user_id, track_id, track_url, 
    track_title, track_artist, platform, duration_seconds
  )
  VALUES (
    p_room_id, p_host_user_id, p_user_id, p_track_id, p_track_url,
    p_track_title, p_track_artist, p_platform, p_duration_seconds
  );
  
  -- Update room analytics
  UPDATE room_analytics
  SET total_tracks_played = total_tracks_played + 1,
      total_play_time_seconds = total_play_time_seconds + COALESCE(p_duration_seconds, 0),
      last_activity_at = NOW(),
      updated_at = NOW()
  WHERE room_id = p_room_id;
  
  -- Update user analytics for host
  IF p_host_user_id IS NOT NULL THEN
    UPDATE user_analytics
    SET total_tracks_played_all_rooms = total_tracks_played_all_rooms + 1,
        total_play_time_all_rooms_seconds = total_play_time_all_rooms_seconds + COALESCE(p_duration_seconds, 0),
        last_activity_at = NOW(),
        updated_at = NOW()
    WHERE user_id = p_host_user_id;
  END IF;
END;
$$ LANGUAGE plpgsql;

-- View for Leaderboard: Top DJs by total listeners
CREATE OR REPLACE VIEW leaderboard_total_listeners AS
SELECT 
  ua.user_id,
  up.username,
  up.display_name,
  up.avatar_url,
  ua.total_listeners_all_rooms as total_listeners,
  ua.total_rooms_created,
  ua.total_tracks_played_all_rooms,
  ua.peak_listeners_all_rooms,
  ROUND(ua.total_play_time_all_rooms_seconds / 3600.0, 2) as total_play_time_hours
FROM user_analytics ua
LEFT JOIN user_profiles up ON ua.user_id = up.id
WHERE ua.total_listeners_all_rooms > 0
ORDER BY ua.total_listeners_all_rooms DESC
LIMIT 100;

-- View for Leaderboard: Top DJs by peak listeners
CREATE OR REPLACE VIEW leaderboard_peak_listeners AS
SELECT 
  ua.user_id,
  up.username,
  up.display_name,
  up.avatar_url,
  ua.peak_listeners_all_rooms as peak_listeners,
  ua.total_listeners_all_rooms,
  ua.total_rooms_created,
  ua.total_tracks_played_all_rooms
FROM user_analytics ua
LEFT JOIN user_profiles up ON ua.user_id = up.id
WHERE ua.peak_listeners_all_rooms > 0
ORDER BY ua.peak_listeners_all_rooms DESC
LIMIT 100;

-- View for Leaderboard: Top DJs by rooms created
CREATE OR REPLACE VIEW leaderboard_rooms_created AS
SELECT 
  ua.user_id,
  up.username,
  up.display_name,
  up.avatar_url,
  ua.total_rooms_created,
  ua.total_listeners_all_rooms,
  ua.total_tracks_played_all_rooms,
  ua.peak_listeners_all_rooms
FROM user_analytics ua
LEFT JOIN user_profiles up ON ua.user_id = up.id
WHERE ua.total_rooms_created > 0
ORDER BY ua.total_rooms_created DESC
LIMIT 100;

-- View for Leaderboard: Top DJs by tracks played
CREATE OR REPLACE VIEW leaderboard_tracks_played AS
SELECT 
  ua.user_id,
  up.username,
  up.display_name,
  up.avatar_url,
  ua.total_tracks_played_all_rooms as total_tracks_played,
  ua.total_listeners_all_rooms,
  ua.total_rooms_created,
  ROUND(ua.total_play_time_all_rooms_seconds / 3600.0, 2) as total_play_time_hours
FROM user_analytics ua
LEFT JOIN user_profiles up ON ua.user_id = up.id
WHERE ua.total_tracks_played_all_rooms > 0
ORDER BY ua.total_tracks_played_all_rooms DESC
LIMIT 100;

-- Trigger to update updated_at column
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS update_room_analytics_updated_at ON room_analytics;
CREATE TRIGGER update_room_analytics_updated_at
  BEFORE UPDATE ON room_analytics
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_user_analytics_updated_at ON user_analytics;
CREATE TRIGGER update_user_analytics_updated_at
  BEFORE UPDATE ON user_analytics
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

