-- Create unique partial index to ensure only one favourites playlist per user
-- This ensures case-insensitive uniqueness for the favourites playlist
CREATE UNIQUE INDEX IF NOT EXISTS idx_playlists_user_favourites_unique 
ON playlists (user_id, LOWER(name)) 
WHERE LOWER(name) = 'favourites';

-- Create function to create default favourites playlist for new users
CREATE OR REPLACE FUNCTION create_default_favourites_playlist()
RETURNS TRIGGER AS $$
BEGIN
  -- Create a default "favourites" playlist for the new user
  -- Only create if it doesn't already exist (to handle edge cases)
  IF NOT EXISTS (
    SELECT 1 FROM playlists 
    WHERE user_id = NEW.id 
    AND LOWER(name) = 'favourites'
  ) THEN
    INSERT INTO playlists (user_id, name, description)
    VALUES (NEW.id, 'favourites', 'Your favourite tracks');
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger to automatically create favourites playlist when user profile is created
DROP TRIGGER IF EXISTS on_user_profile_created_favourites ON user_profiles;
CREATE TRIGGER on_user_profile_created_favourites
  AFTER INSERT ON user_profiles
  FOR EACH ROW EXECUTE FUNCTION create_default_favourites_playlist();

-- Update handle_new_user function to also create favourites playlist
-- This ensures it works for users created via the auth trigger
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO user_profiles (id, username, display_name)
  VALUES (NEW.id, NEW.raw_user_meta_data->>'username', NEW.raw_user_meta_data->>'full_name')
  ON CONFLICT (id) DO NOTHING;
  
  -- Create default favourites playlist
  IF NOT EXISTS (
    SELECT 1 FROM playlists 
    WHERE user_id = NEW.id 
    AND LOWER(name) = 'favourites'
  ) THEN
    INSERT INTO playlists (user_id, name, description)
    VALUES (NEW.id, 'favourites', 'Your favourite tracks');
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create favourites playlist for existing users who don't have one
-- This is a one-time migration for existing users
INSERT INTO playlists (user_id, name, description)
SELECT 
  up.id,
  'favourites',
  'Your favourite tracks'
FROM user_profiles up
WHERE NOT EXISTS (
  SELECT 1 
  FROM playlists p 
  WHERE p.user_id = up.id 
  AND LOWER(p.name) = 'favourites'
);

