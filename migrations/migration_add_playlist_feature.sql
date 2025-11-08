-- Add playlist column to subscription_tier_settings table
DO $$
BEGIN
  -- Add playlist column if it doesn't exist
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'subscription_tier_settings' AND column_name = 'playlist'
  ) THEN
    ALTER TABLE subscription_tier_settings ADD COLUMN playlist BOOLEAN NOT NULL DEFAULT false;
  END IF;
END $$;

-- Update existing tiers: set playlist to false for all tiers except pro (tier 3)
UPDATE subscription_tier_settings 
SET playlist = false 
WHERE tier IN ('free', 'rookie', 'standard');

UPDATE subscription_tier_settings 
SET playlist = true 
WHERE tier = 'pro';

-- Update the INSERT statement in the original migration to include playlist
-- This ensures new installations have the correct default values
-- Note: This is handled by the application code, but we set defaults here

