-- Create rooms table to store room state
CREATE TABLE IF NOT EXISTS rooms (
  id TEXT PRIMARY KEY,
  queue JSONB DEFAULT '[]'::jsonb,
  history JSONB DEFAULT '[]'::jsonb,
  current_track JSONB,
  is_playing BOOLEAN DEFAULT false,
  position INTEGER DEFAULT 0,
  last_broadcast_position INTEGER DEFAULT 0,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create user_profiles table to store user information
CREATE TABLE IF NOT EXISTS user_profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  username TEXT UNIQUE NOT NULL,
  display_name TEXT,
  avatar_url TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create user_volumes table to store user volume preferences per room
CREATE TABLE IF NOT EXISTS user_volumes (
  id SERIAL PRIMARY KEY,
  room_id TEXT NOT NULL REFERENCES rooms(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  volume INTEGER DEFAULT 50,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(room_id, user_id)
);

-- Create chat_messages table for real-time chat
CREATE TABLE IF NOT EXISTS chat_messages (
  id SERIAL PRIMARY KEY,
  room_id TEXT NOT NULL REFERENCES rooms(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  message TEXT NOT NULL,
  message_type TEXT DEFAULT 'text', -- 'text', 'emoji', 'track_reaction'
  track_id TEXT, -- For track reactions
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create room_settings table for customization
CREATE TABLE IF NOT EXISTS room_settings (
  room_id TEXT PRIMARY KEY REFERENCES rooms(id) ON DELETE CASCADE,
  name TEXT,
  description TEXT,
  theme TEXT DEFAULT 'default',
  max_users INTEGER DEFAULT 50,
  is_private BOOLEAN DEFAULT false,
  password_hash TEXT,
  allow_chat BOOLEAN DEFAULT true,
  allow_anonymous BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_rooms_updated_at ON rooms(updated_at);
CREATE INDEX IF NOT EXISTS idx_user_volumes_room_id ON user_volumes(room_id);
CREATE INDEX IF NOT EXISTS idx_chat_messages_room_id ON chat_messages(room_id);
CREATE INDEX IF NOT EXISTS idx_chat_messages_created_at ON chat_messages(created_at);

-- Enable Row Level Security (RLS)
ALTER TABLE rooms ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_volumes ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE chat_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE room_settings ENABLE ROW LEVEL SECURITY;

-- Create policies for authenticated users
-- Rooms: Allow all operations for public access
DROP POLICY IF EXISTS "Allow all operations on rooms" ON rooms;
CREATE POLICY "Allow all operations on rooms" ON rooms
  FOR ALL USING (true) WITH CHECK (true);

-- User profiles: Users can only access their own profile
DROP POLICY IF EXISTS "Users can view their own profile" ON user_profiles;
CREATE POLICY "Users can view their own profile" ON user_profiles
  FOR SELECT USING (auth.uid() = id);

DROP POLICY IF EXISTS "Users can update their own profile" ON user_profiles;
CREATE POLICY "Users can update their own profile" ON user_profiles
  FOR UPDATE USING (auth.uid() = id) WITH CHECK (auth.uid() = id);

DROP POLICY IF EXISTS "Users can insert their own profile" ON user_profiles;
CREATE POLICY "Users can insert their own profile" ON user_profiles
  FOR INSERT WITH CHECK (auth.uid() = id);

-- User volumes: Users can only access their own volumes
DROP POLICY IF EXISTS "Users can manage their own volumes" ON user_volumes;
CREATE POLICY "Users can manage their own volumes" ON user_volumes
  FOR ALL USING (auth.uid() = user_id);

-- Chat messages: Allow all authenticated users to read/write in rooms they're in
DROP POLICY IF EXISTS "Users can read chat messages in accessible rooms" ON chat_messages;
CREATE POLICY "Users can read chat messages in accessible rooms" ON chat_messages
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM room_settings rs
      WHERE rs.room_id = chat_messages.room_id
      AND (NOT rs.is_private OR rs.is_private = false)
    ) OR auth.uid() IS NOT NULL
  );

DROP POLICY IF EXISTS "Users can send chat messages" ON chat_messages;
CREATE POLICY "Users can send chat messages" ON chat_messages
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Room settings: Allow all operations for room management
DROP POLICY IF EXISTS "Allow all operations on room_settings" ON room_settings;
CREATE POLICY "Allow all operations on room_settings" ON room_settings
  FOR ALL USING (true) WITH CHECK (true);

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ language 'plpgsql';

-- Trigger to auto-update updated_at
-- Drop existing triggers if they exist, then create new ones
DROP TRIGGER IF EXISTS update_rooms_updated_at ON rooms;
CREATE TRIGGER update_rooms_updated_at BEFORE UPDATE ON rooms
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_user_volumes_updated_at ON user_volumes;
CREATE TRIGGER update_user_volumes_updated_at BEFORE UPDATE ON user_volumes
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_user_profiles_updated_at ON user_profiles;
CREATE TRIGGER update_user_profiles_updated_at BEFORE UPDATE ON user_profiles
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_room_settings_updated_at ON room_settings;
CREATE TRIGGER update_room_settings_updated_at BEFORE UPDATE ON room_settings
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Add history column to existing rooms table (if it doesn't exist)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'rooms' AND column_name = 'history'
  ) THEN
    ALTER TABLE rooms ADD COLUMN history JSONB DEFAULT '[]'::jsonb;
  END IF;
END $$;

-- Add host_user_id column to existing rooms table (if it doesn't exist)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'rooms' AND column_name = 'host_user_id'
  ) THEN
    ALTER TABLE rooms ADD COLUMN host_user_id UUID REFERENCES auth.users(id);
  END IF;
END $$;

-- Create function to handle user profile creation on signup
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO user_profiles (id, username, display_name)
  VALUES (NEW.id, NEW.raw_user_meta_data->>'username', NEW.raw_user_meta_data->>'full_name');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger to automatically create user profile
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();

