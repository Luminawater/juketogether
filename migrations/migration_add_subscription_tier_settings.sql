-- Create subscription_tier_settings table to store tier configuration
CREATE TABLE IF NOT EXISTS subscription_tier_settings (
  tier TEXT PRIMARY KEY CHECK (tier IN ('free', 'standard', 'pro')),
  display_name TEXT NOT NULL,
  price DECIMAL(10, 2) NOT NULL DEFAULT 0,
  max_songs INTEGER, -- NULL means unlimited
  queue_limit INTEGER, -- NULL means unlimited
  dj_mode BOOLEAN NOT NULL DEFAULT false,
  listed_on_discovery BOOLEAN NOT NULL DEFAULT false,
  listed_on_leaderboard BOOLEAN NOT NULL DEFAULT false,
  description TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Add new columns if table already exists (for migration updates)
ALTER TABLE subscription_tier_settings 
  ADD COLUMN IF NOT EXISTS queue_limit INTEGER,
  ADD COLUMN IF NOT EXISTS dj_mode BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS listed_on_discovery BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS listed_on_leaderboard BOOLEAN NOT NULL DEFAULT false;

-- Insert default tier settings
INSERT INTO subscription_tier_settings (tier, display_name, price, max_songs, queue_limit, dj_mode, listed_on_discovery, listed_on_leaderboard, description)
VALUES 
  ('free', 'Free', 0, 1, 1, false, false, false, 'Basic access with limited features'),
  ('standard', 'Standard', 1, 10, 10, false, true, true, 'Standard access with more features'),
  ('pro', 'Pro', 5, NULL, NULL, true, true, true, 'Premium access with unlimited features')
ON CONFLICT (tier) DO UPDATE SET
  display_name = EXCLUDED.display_name,
  price = EXCLUDED.price,
  max_songs = EXCLUDED.max_songs,
  queue_limit = EXCLUDED.queue_limit,
  dj_mode = EXCLUDED.dj_mode,
  listed_on_discovery = EXCLUDED.listed_on_discovery,
  listed_on_leaderboard = EXCLUDED.listed_on_leaderboard,
  description = EXCLUDED.description,
  updated_at = NOW();

-- Enable Row Level Security (RLS)
ALTER TABLE subscription_tier_settings ENABLE ROW LEVEL SECURITY;

-- Create policies for subscription_tier_settings
-- Allow all authenticated users to read tier settings (for pricing display)
DROP POLICY IF EXISTS "Allow authenticated users to read tier settings" ON subscription_tier_settings;
CREATE POLICY "Allow authenticated users to read tier settings" ON subscription_tier_settings
  FOR SELECT USING (auth.role() = 'authenticated');

-- Only admins can update tier settings
DROP POLICY IF EXISTS "Only admins can update tier settings" ON subscription_tier_settings;
CREATE POLICY "Only admins can update tier settings" ON subscription_tier_settings
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.id = auth.uid()
      AND user_profiles.role = 'admin'
    )
  );

-- Only admins can insert tier settings
DROP POLICY IF EXISTS "Only admins can insert tier settings" ON subscription_tier_settings;
CREATE POLICY "Only admins can insert tier settings" ON subscription_tier_settings
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.id = auth.uid()
      AND user_profiles.role = 'admin'
    )
  );

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_subscription_tier_settings_tier ON subscription_tier_settings(tier);

