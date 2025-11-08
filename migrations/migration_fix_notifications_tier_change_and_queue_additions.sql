-- Fix notifications type check constraint to include 'tier_change'
-- Drop the existing constraint
ALTER TABLE notifications DROP CONSTRAINT IF EXISTS notifications_type_check;

-- Recreate the constraint with 'tier_change' included
ALTER TABLE notifications ADD CONSTRAINT notifications_type_check 
  CHECK (type = ANY (ARRAY[
    'room_like'::text, 
    'room_fantastic'::text, 
    'friend_request'::text, 
    'friend_collab'::text, 
    'collab_request'::text, 
    'collab_accept'::text,
    'tier_change'::text
  ]));

-- Create queue_additions table if it doesn't exist
CREATE TABLE IF NOT EXISTS queue_additions (
  id SERIAL PRIMARY KEY,
  room_id TEXT NOT NULL REFERENCES rooms(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  host_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  
  -- Track details
  track_id TEXT NOT NULL,
  track_url TEXT,
  track_title TEXT,
  track_artist TEXT,
  platform TEXT, -- 'soundcloud', 'spotify', 'youtube'
  
  -- Addition metrics
  added_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for faster queries (IF NOT EXISTS is not supported for indexes, so we check first)
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_queue_additions_room_id') THEN
    CREATE INDEX idx_queue_additions_room_id ON queue_additions(room_id);
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_queue_additions_user_id') THEN
    CREATE INDEX idx_queue_additions_user_id ON queue_additions(user_id);
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_queue_additions_host_user_id') THEN
    CREATE INDEX idx_queue_additions_host_user_id ON queue_additions(host_user_id);
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_queue_additions_added_at') THEN
    CREATE INDEX idx_queue_additions_added_at ON queue_additions(added_at);
  END IF;
END $$;

-- Enable Row Level Security
ALTER TABLE queue_additions ENABLE ROW LEVEL SECURITY;

-- RLS Policies: Allow public read access for analytics, authenticated write
DROP POLICY IF EXISTS "Public can view queue additions" ON queue_additions;
CREATE POLICY "Public can view queue additions" ON queue_additions
  FOR SELECT
  USING (true);

DROP POLICY IF EXISTS "Authenticated users can insert queue additions" ON queue_additions;
CREATE POLICY "Authenticated users can insert queue additions" ON queue_additions
  FOR INSERT
  WITH CHECK (auth.role() = 'authenticated');

-- Grant necessary permissions
GRANT SELECT ON queue_additions TO anon, authenticated;
GRANT INSERT ON queue_additions TO authenticated;

