-- Add queue and DJ mode settings to room_settings
DO $$
BEGIN
  -- Add allow_queue column if it doesn't exist
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'room_settings' AND column_name = 'allow_queue'
  ) THEN
    ALTER TABLE room_settings ADD COLUMN allow_queue BOOLEAN DEFAULT true;
  END IF;
  
  -- Add dj_mode column if it doesn't exist
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'room_settings' AND column_name = 'dj_mode'
  ) THEN
    ALTER TABLE room_settings ADD COLUMN dj_mode BOOLEAN DEFAULT false;
  END IF;
  
  -- Add dj_players column if it doesn't exist (tracks number of active DJ players, max 3)
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'room_settings' AND column_name = 'dj_players'
  ) THEN
    ALTER TABLE room_settings ADD COLUMN dj_players INTEGER DEFAULT 0 CHECK (dj_players >= 0 AND dj_players <= 3);
  END IF;
END $$;

