-- Create queue_additions table to track when users add tracks to queues
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

-- Create indexes for faster queries
CREATE INDEX IF NOT EXISTS idx_queue_additions_room_id ON queue_additions(room_id);
CREATE INDEX IF NOT EXISTS idx_queue_additions_user_id ON queue_additions(user_id);
CREATE INDEX IF NOT EXISTS idx_queue_additions_host_user_id ON queue_additions(host_user_id);
CREATE INDEX IF NOT EXISTS idx_queue_additions_added_at ON queue_additions(added_at);

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

