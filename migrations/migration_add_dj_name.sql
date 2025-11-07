-- Add DJ name field to user_profiles table
ALTER TABLE user_profiles 
ADD COLUMN IF NOT EXISTS dj_name TEXT;

-- Add comment to explain the field
COMMENT ON COLUMN user_profiles.dj_name IS 'DJ name or stage name for the user';

