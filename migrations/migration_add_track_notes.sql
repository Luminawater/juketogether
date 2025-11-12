-- Track Notes Migration
-- This migration adds the ability for users to add timestamped notes to tracks

-- Create track_notes table
CREATE TABLE IF NOT EXISTS track_notes (
  id SERIAL PRIMARY KEY,
  track_id TEXT NOT NULL, -- Track identifier (from Track.id)
  track_url TEXT, -- Track URL for reference
  room_id TEXT REFERENCES rooms(id) ON DELETE CASCADE, -- Optional: room-specific notes
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  timestamp_seconds INTEGER NOT NULL, -- Timestamp in seconds (e.g., 270 for 4:30)
  note_text TEXT NOT NULL, -- The note content
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for faster queries
CREATE INDEX IF NOT EXISTS idx_track_notes_track_id ON track_notes(track_id);
CREATE INDEX IF NOT EXISTS idx_track_notes_room_id ON track_notes(room_id);
CREATE INDEX IF NOT EXISTS idx_track_notes_user_id ON track_notes(user_id);
CREATE INDEX IF NOT EXISTS idx_track_notes_timestamp ON track_notes(timestamp_seconds);

-- Enable Row Level Security
ALTER TABLE track_notes ENABLE ROW LEVEL SECURITY;

-- RLS Policies
-- Users can view all notes for tracks (public notes)
DROP POLICY IF EXISTS "Users can view track notes" ON track_notes;
CREATE POLICY "Users can view track notes" ON track_notes
  FOR SELECT
  USING (true);

-- Users can insert their own notes
DROP POLICY IF EXISTS "Users can insert their own notes" ON track_notes;
CREATE POLICY "Users can insert their own notes" ON track_notes
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Users can update their own notes
DROP POLICY IF EXISTS "Users can update their own notes" ON track_notes;
CREATE POLICY "Users can update their own notes" ON track_notes
  FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Users can delete their own notes
DROP POLICY IF EXISTS "Users can delete their own notes" ON track_notes;
CREATE POLICY "Users can delete their own notes" ON track_notes
  FOR DELETE
  USING (auth.uid() = user_id);

-- Create function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_track_notes_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to automatically update updated_at
DROP TRIGGER IF EXISTS update_track_notes_updated_at ON track_notes;
CREATE TRIGGER update_track_notes_updated_at
  BEFORE UPDATE ON track_notes
  FOR EACH ROW
  EXECUTE FUNCTION update_track_notes_updated_at();










