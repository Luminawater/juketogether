-- Add autoplay setting to room_settings
DO $$
BEGIN
  -- Add autoplay column if it doesn't exist
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'room_settings' AND column_name = 'autoplay'
  ) THEN
    ALTER TABLE room_settings ADD COLUMN autoplay BOOLEAN DEFAULT true;
  END IF;
END $$;

