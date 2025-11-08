-- Add booster pack type to room_boosts table
ALTER TABLE room_boosts 
ADD COLUMN IF NOT EXISTS booster_type TEXT DEFAULT 'hour' CHECK (booster_type IN ('10min', 'hour'));

-- Create booster_pack_settings table for admin configuration
CREATE TABLE IF NOT EXISTS booster_pack_settings (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  booster_type TEXT NOT NULL UNIQUE CHECK (booster_type IN ('10min', 'hour')),
  price DECIMAL(10, 2) NOT NULL,
  duration_minutes INTEGER NOT NULL,
  display_name TEXT NOT NULL,
  description TEXT,
  enabled BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Insert default booster pack settings
INSERT INTO booster_pack_settings (booster_type, price, duration_minutes, display_name, description, enabled)
VALUES 
  ('10min', 0.50, 10, '10 Minute Boost', 'Get 10 more minutes of music playback', true),
  ('hour', 1.00, 60, '1 Hour Boost', 'Get 1 full hour of music playback', true)
ON CONFLICT (booster_type) DO NOTHING;

-- Enable RLS
ALTER TABLE booster_pack_settings ENABLE ROW LEVEL SECURITY;

-- Allow authenticated users to read booster pack settings
DROP POLICY IF EXISTS "Allow authenticated users to read booster packs" ON booster_pack_settings;
CREATE POLICY "Allow authenticated users to read booster packs" ON booster_pack_settings
  FOR SELECT USING (auth.role() = 'authenticated' AND enabled = true);

-- Allow admins to manage booster pack settings
DROP POLICY IF EXISTS "Allow admins to manage booster packs" ON booster_pack_settings;
CREATE POLICY "Allow admins to manage booster packs" ON booster_pack_settings
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

