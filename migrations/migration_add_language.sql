-- Add language field to user_profiles table
ALTER TABLE user_profiles 
ADD COLUMN IF NOT EXISTS language TEXT DEFAULT 'en';

-- Add comment to explain the field
COMMENT ON COLUMN user_profiles.language IS 'User preferred language code (e.g., en, es, fr). Defaults to en (English).';

