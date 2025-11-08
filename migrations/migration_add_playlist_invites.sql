-- Create playlist_invites table
CREATE TABLE IF NOT EXISTS playlist_invites (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  playlist_id UUID NOT NULL REFERENCES playlists(id) ON DELETE CASCADE,
  invited_user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  invited_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'pending', -- 'pending', 'accepted', 'declined'
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(playlist_id, invited_user_id)
);

-- Create indexes for faster lookups
CREATE INDEX IF NOT EXISTS idx_playlist_invites_playlist_id ON playlist_invites(playlist_id);
CREATE INDEX IF NOT EXISTS idx_playlist_invites_invited_user_id ON playlist_invites(invited_user_id);
CREATE INDEX IF NOT EXISTS idx_playlist_invites_status ON playlist_invites(status);

-- Enable Row Level Security
ALTER TABLE playlist_invites ENABLE ROW LEVEL SECURITY;

-- RLS Policies for playlist_invites
-- Users can view invites for playlists they own or invites sent to them
DROP POLICY IF EXISTS "Users can view their playlist invites" ON playlist_invites;
CREATE POLICY "Users can view their playlist invites" ON playlist_invites
  FOR SELECT USING (
    invited_user_id = auth.uid() OR
    invited_by = auth.uid() OR
    EXISTS (
      SELECT 1 FROM playlists
      WHERE playlists.id = playlist_invites.playlist_id
      AND playlists.user_id = auth.uid()
    )
  );

-- Users can create invites for playlists they own
DROP POLICY IF EXISTS "Users can create invites for their playlists" ON playlist_invites;
CREATE POLICY "Users can create invites for their playlists" ON playlist_invites
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM playlists
      WHERE playlists.id = playlist_invites.playlist_id
      AND playlists.user_id = auth.uid()
    )
    AND invited_by = auth.uid()
  );

-- Users can update invites sent to them (to accept/decline)
DROP POLICY IF EXISTS "Users can update their invites" ON playlist_invites;
CREATE POLICY "Users can update their invites" ON playlist_invites
  FOR UPDATE USING (
    invited_user_id = auth.uid() OR
    EXISTS (
      SELECT 1 FROM playlists
      WHERE playlists.id = playlist_invites.playlist_id
      AND playlists.user_id = auth.uid()
    )
  ) WITH CHECK (
    invited_user_id = auth.uid() OR
    EXISTS (
      SELECT 1 FROM playlists
      WHERE playlists.id = playlist_invites.playlist_id
      AND playlists.user_id = auth.uid()
    )
  );

-- Users can delete invites for playlists they own or invites sent to them
DROP POLICY IF EXISTS "Users can delete their playlist invites" ON playlist_invites;
CREATE POLICY "Users can delete their playlist invites" ON playlist_invites
  FOR DELETE USING (
    invited_user_id = auth.uid() OR
    invited_by = auth.uid() OR
    EXISTS (
      SELECT 1 FROM playlists
      WHERE playlists.id = playlist_invites.playlist_id
      AND playlists.user_id = auth.uid()
    )
  );

