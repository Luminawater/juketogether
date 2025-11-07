-- Add privacy settings to user_profiles table
ALTER TABLE user_profiles 
ADD COLUMN IF NOT EXISTS show_in_leaderboard BOOLEAN DEFAULT true,
ADD COLUMN IF NOT EXISTS show_in_discovery BOOLEAN DEFAULT true;

-- Update leaderboard views to respect privacy settings
DROP VIEW IF EXISTS leaderboard_total_listeners;
CREATE OR REPLACE VIEW leaderboard_total_listeners AS
SELECT 
  ua.user_id,
  up.username,
  up.display_name,
  up.avatar_url,
  ua.total_listeners_all_rooms as total_listeners,
  ua.total_rooms_created,
  ua.total_tracks_played_all_rooms,
  ua.peak_listeners_all_rooms,
  ROUND(ua.total_play_time_all_rooms_seconds / 3600.0, 2) as total_play_time_hours
FROM user_analytics ua
LEFT JOIN user_profiles up ON ua.user_id = up.id
WHERE ua.total_listeners_all_rooms > 0
  AND (up.show_in_leaderboard IS NULL OR up.show_in_leaderboard = true)
ORDER BY ua.total_listeners_all_rooms DESC
LIMIT 100;

DROP VIEW IF EXISTS leaderboard_peak_listeners;
CREATE OR REPLACE VIEW leaderboard_peak_listeners AS
SELECT 
  ua.user_id,
  up.username,
  up.display_name,
  up.avatar_url,
  ua.peak_listeners_all_rooms as peak_listeners,
  ua.total_listeners_all_rooms,
  ua.total_rooms_created,
  ua.total_tracks_played_all_rooms
FROM user_analytics ua
LEFT JOIN user_profiles up ON ua.user_id = up.id
WHERE ua.peak_listeners_all_rooms > 0
  AND (up.show_in_leaderboard IS NULL OR up.show_in_leaderboard = true)
ORDER BY ua.peak_listeners_all_rooms DESC
LIMIT 100;

DROP VIEW IF EXISTS leaderboard_rooms_created;
CREATE OR REPLACE VIEW leaderboard_rooms_created AS
SELECT 
  ua.user_id,
  up.username,
  up.display_name,
  up.avatar_url,
  ua.total_rooms_created,
  ua.total_listeners_all_rooms,
  ua.total_tracks_played_all_rooms,
  ua.peak_listeners_all_rooms
FROM user_analytics ua
LEFT JOIN user_profiles up ON ua.user_id = up.id
WHERE ua.total_rooms_created > 0
  AND (up.show_in_leaderboard IS NULL OR up.show_in_leaderboard = true)
ORDER BY ua.total_rooms_created DESC
LIMIT 100;

DROP VIEW IF EXISTS leaderboard_tracks_played;
CREATE OR REPLACE VIEW leaderboard_tracks_played AS
SELECT 
  ua.user_id,
  up.username,
  up.display_name,
  up.avatar_url,
  ua.total_tracks_played_all_rooms as total_tracks_played,
  ua.total_listeners_all_rooms,
  ua.total_rooms_created,
  ROUND(ua.total_play_time_all_rooms_seconds / 3600.0, 2) as total_play_time_hours
FROM user_analytics ua
LEFT JOIN user_profiles up ON ua.user_id = up.id
WHERE ua.total_tracks_played_all_rooms > 0
  AND (up.show_in_leaderboard IS NULL OR up.show_in_leaderboard = true)
ORDER BY ua.total_tracks_played_all_rooms DESC
LIMIT 100;

