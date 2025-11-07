-- Add room admins table
CREATE TABLE IF NOT EXISTS room_admins (
  id SERIAL PRIMARY KEY,
  room_id TEXT NOT NULL REFERENCES rooms(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  added_by UUID REFERENCES auth.users(id),
  added_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(room_id, user_id)
);

-- Add friends table
CREATE TABLE IF NOT EXISTS friends (
  id SERIAL PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  friend_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'pending', -- 'pending', 'accepted', 'blocked'
  requested_by UUID NOT NULL REFERENCES auth.users(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(user_id, friend_id)
);

-- Add room permissions to room_settings
DO $$
BEGIN
  -- Add allow_controls column if it doesn't exist
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'room_settings' AND column_name = 'allow_controls'
  ) THEN
    ALTER TABLE room_settings ADD COLUMN allow_controls BOOLEAN DEFAULT true;
  END IF;
  
  -- Add is_private column if it doesn't exist (might already exist)
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'room_settings' AND column_name = 'is_private'
  ) THEN
    ALTER TABLE room_settings ADD COLUMN is_private BOOLEAN DEFAULT false;
  END IF;
END $$;

-- Create indexes for faster lookups
CREATE INDEX IF NOT EXISTS idx_room_admins_room_id ON room_admins(room_id);
CREATE INDEX IF NOT EXISTS idx_room_admins_user_id ON room_admins(user_id);
CREATE INDEX IF NOT EXISTS idx_friends_user_id ON friends(user_id);
CREATE INDEX IF NOT EXISTS idx_friends_friend_id ON friends(friend_id);
CREATE INDEX IF NOT EXISTS idx_friends_status ON friends(status);

-- Enable Row Level Security
ALTER TABLE room_admins ENABLE ROW LEVEL SECURITY;
ALTER TABLE friends ENABLE ROW LEVEL SECURITY;

-- Room admins policies: Users can view admins in rooms they're in, only room owner can add/remove
DROP POLICY IF EXISTS "Users can view room admins" ON room_admins;
CREATE POLICY "Users can view room admins" ON room_admins
  FOR SELECT USING (true);

DROP POLICY IF EXISTS "Room owner can manage admins" ON room_admins;
CREATE POLICY "Room owner can manage admins" ON room_admins
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM rooms r
      WHERE r.id = room_admins.room_id
      AND r.host_user_id = auth.uid()
    )
  );

-- Friends policies: Users can view their own friend relationships
DROP POLICY IF EXISTS "Users can view their own friends" ON friends;
CREATE POLICY "Users can view their own friends" ON friends
  FOR SELECT USING (auth.uid() = user_id OR auth.uid() = friend_id);

DROP POLICY IF EXISTS "Users can manage their own friend requests" ON friends;
CREATE POLICY "Users can manage their own friend requests" ON friends
  FOR ALL USING (auth.uid() = user_id OR auth.uid() = friend_id);

-- Trigger to update updated_at for friends
DROP TRIGGER IF EXISTS update_friends_updated_at ON friends;
CREATE TRIGGER update_friends_updated_at BEFORE UPDATE ON friends
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

