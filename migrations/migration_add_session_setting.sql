-- Add session setting to room_settings
DO $$
BEGIN
  -- Add session_enabled column if it doesn't exist
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'room_settings' AND column_name = 'session_enabled'
  ) THEN
    ALTER TABLE room_settings ADD COLUMN session_enabled BOOLEAN DEFAULT false;
  END IF;
END $$;

