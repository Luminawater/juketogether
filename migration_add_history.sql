-- Migration: Add history column to rooms table
-- This migration adds the history field to store played tracks

-- Add history column to existing rooms table (if it doesn't exist)
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'rooms' AND column_name = 'history'
  ) THEN
    ALTER TABLE rooms ADD COLUMN history JSONB DEFAULT '[]'::jsonb;
    RAISE NOTICE 'Added history column to rooms table';
  ELSE
    RAISE NOTICE 'History column already exists in rooms table';
  END IF;
END $$;

