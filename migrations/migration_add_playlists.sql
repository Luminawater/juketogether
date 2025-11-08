-- Create playlists table
CREATE TABLE IF NOT EXISTS playlists (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  created_from_room_id TEXT REFERENCES rooms(id) ON DELETE SET NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create playlist_tracks table
CREATE TABLE IF NOT EXISTS playlist_tracks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  playlist_id UUID NOT NULL REFERENCES playlists(id) ON DELETE CASCADE,
  track_id TEXT NOT NULL,
  track_url TEXT NOT NULL,
  track_title TEXT,
  track_artist TEXT,
  track_thumbnail TEXT,
  platform TEXT, -- 'soundcloud', 'spotify', 'youtube'
  position INTEGER NOT NULL DEFAULT 0,
  added_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  added_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(playlist_id, position)
);

-- Add allow_playlist_additions to room_settings
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'room_settings' AND column_name = 'allow_playlist_additions'
  ) THEN
    ALTER TABLE room_settings ADD COLUMN allow_playlist_additions BOOLEAN DEFAULT false;
  END IF;
END $$;

-- Create indexes for faster lookups
CREATE INDEX IF NOT EXISTS idx_playlists_user_id ON playlists(user_id);
CREATE INDEX IF NOT EXISTS idx_playlists_created_at ON playlists(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_playlist_tracks_playlist_id ON playlist_tracks(playlist_id);
CREATE INDEX IF NOT EXISTS idx_playlist_tracks_position ON playlist_tracks(playlist_id, position);

-- Enable Row Level Security
ALTER TABLE playlists ENABLE ROW LEVEL SECURITY;
ALTER TABLE playlist_tracks ENABLE ROW LEVEL SECURITY;

-- RLS Policies for playlists
-- Users can view their own playlists
DROP POLICY IF EXISTS "Users can view their own playlists" ON playlists;
CREATE POLICY "Users can view their own playlists" ON playlists
  FOR SELECT USING (auth.uid() = user_id);

-- Users can create their own playlists
DROP POLICY IF EXISTS "Users can create their own playlists" ON playlists;
CREATE POLICY "Users can create their own playlists" ON playlists
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Users can update their own playlists
DROP POLICY IF EXISTS "Users can update their own playlists" ON playlists;
CREATE POLICY "Users can update their own playlists" ON playlists
  FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- Users can delete their own playlists
DROP POLICY IF EXISTS "Users can delete their own playlists" ON playlists;
CREATE POLICY "Users can delete their own playlists" ON playlists
  FOR DELETE USING (auth.uid() = user_id);

-- RLS Policies for playlist_tracks
-- Users can view tracks in their own playlists
DROP POLICY IF EXISTS "Users can view tracks in their own playlists" ON playlist_tracks;
CREATE POLICY "Users can view tracks in their own playlists" ON playlist_tracks
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM playlists
      WHERE playlists.id = playlist_tracks.playlist_id
      AND playlists.user_id = auth.uid()
    )
  );

-- Users can add tracks to their own playlists
DROP POLICY IF EXISTS "Users can add tracks to their own playlists" ON playlist_tracks;
CREATE POLICY "Users can add tracks to their own playlists" ON playlist_tracks
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM playlists
      WHERE playlists.id = playlist_tracks.playlist_id
      AND playlists.user_id = auth.uid()
    )
  );

-- Users can update tracks in their own playlists
DROP POLICY IF EXISTS "Users can update tracks in their own playlists" ON playlist_tracks;
CREATE POLICY "Users can update tracks in their own playlists" ON playlist_tracks
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM playlists
      WHERE playlists.id = playlist_tracks.playlist_id
      AND playlists.user_id = auth.uid()
    )
  ) WITH CHECK (
    EXISTS (
      SELECT 1 FROM playlists
      WHERE playlists.id = playlist_tracks.playlist_id
      AND playlists.user_id = auth.uid()
    )
  );

-- Users can delete tracks from their own playlists
DROP POLICY IF EXISTS "Users can delete tracks from their own playlists" ON playlist_tracks;
CREATE POLICY "Users can delete tracks from their own playlists" ON playlist_tracks
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM playlists
      WHERE playlists.id = playlist_tracks.playlist_id
      AND playlists.user_id = auth.uid()
    )
  );

-- Function to allow others to add tracks if room setting allows it
-- This will be checked in the application logic, but we add a helper function
CREATE OR REPLACE FUNCTION can_add_to_playlist(playlist_uuid UUID, user_uuid UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  playlist_owner UUID;
  room_id TEXT;
  allow_additions BOOLEAN;
BEGIN
  -- Get playlist owner
  SELECT user_id, created_from_room_id INTO playlist_owner, room_id
  FROM playlists
  WHERE id = playlist_uuid;
  
  -- If user is owner, always allow
  IF playlist_owner = user_uuid THEN
    RETURN true;
  END IF;
  
  -- If playlist was created from a room, check room setting
  IF room_id IS NOT NULL THEN
    SELECT allow_playlist_additions INTO allow_additions
    FROM room_settings
    WHERE room_id = room_id;
    
    RETURN COALESCE(allow_additions, false);
  END IF;
  
  -- Default: only owner can add
  RETURN false;
END;
$$;

