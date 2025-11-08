-- Add allow_queue_removal setting to room_settings
DO $$
BEGIN
  -- Add allow_queue_removal column if it doesn't exist
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'room_settings' AND column_name = 'allow_queue_removal'
  ) THEN
    ALTER TABLE room_settings ADD COLUMN allow_queue_removal BOOLEAN DEFAULT true;
  END IF;
END $$;

