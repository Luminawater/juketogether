-- Add short_code column to rooms table for easy room joining
DO $$
BEGIN
  -- Add short_code column if it doesn't exist
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'rooms' AND column_name = 'short_code'
  ) THEN
    ALTER TABLE rooms ADD COLUMN short_code TEXT UNIQUE;
  END IF;
END $$;

-- Create index for faster lookups by short_code
CREATE INDEX IF NOT EXISTS idx_rooms_short_code ON rooms(short_code);

-- Create a function to generate a unique short code
CREATE OR REPLACE FUNCTION generate_short_code()
RETURNS TEXT AS $$
DECLARE
  chars TEXT := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; -- Excludes 0, O, 1, I for clarity
  result TEXT := '';
  i INTEGER;
  code_length INTEGER := 5;
BEGIN
  -- Generate a random 5-character code
  FOR i IN 1..code_length LOOP
    result := result || substr(chars, floor(random() * length(chars) + 1)::INTEGER, 1);
  END LOOP;
  
  -- Check if code already exists, regenerate if needed (up to 10 attempts)
  WHILE EXISTS (SELECT 1 FROM rooms WHERE short_code = result) LOOP
    result := '';
    FOR i IN 1..code_length LOOP
      result := result || substr(chars, floor(random() * length(chars) + 1)::INTEGER, 1);
    END LOOP;
  END LOOP;
  
  RETURN result;
END;
$$ LANGUAGE plpgsql;

