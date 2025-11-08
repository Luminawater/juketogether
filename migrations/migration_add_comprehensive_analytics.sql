-- Comprehensive Analytics Migration
-- This migration adds app-level visitor tracking, platform metrics, user events, error logs, and daily aggregations

-- App Visits Table: Tracks all app visits (authenticated and anonymous)
CREATE TABLE IF NOT EXISTS app_visits (
  id SERIAL PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL, -- NULL for anonymous visitors
  session_id TEXT NOT NULL, -- Unique session identifier (can be generated client-side)
  visitor_id TEXT, -- Persistent visitor identifier (stored in localStorage/cookies)
  
  -- Platform metrics
  platform TEXT, -- 'web', 'ios', 'android'
  device_type TEXT, -- 'mobile', 'tablet', 'desktop'
  browser TEXT, -- 'chrome', 'safari', 'firefox', etc.
  browser_version TEXT,
  os TEXT, -- 'ios', 'android', 'windows', 'macos', 'linux'
  os_version TEXT,
  screen_width INTEGER,
  screen_height INTEGER,
  
  -- Geographic metrics
  country_code TEXT, -- ISO 3166-1 alpha-2 country code
  timezone TEXT, -- User's timezone
  language TEXT, -- Browser language preference
  
  -- Visit details
  first_visit_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(), -- First time this visitor_id was seen
  visit_started_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  visit_ended_at TIMESTAMP WITH TIME ZONE,
  session_duration_seconds INTEGER, -- Calculated when visit ends
  
  -- Engagement metrics
  pages_viewed INTEGER DEFAULT 1,
  rooms_joined INTEGER DEFAULT 0,
  tracks_played INTEGER DEFAULT 0,
  authenticated BOOLEAN DEFAULT false, -- Whether user was logged in during visit
  
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- User Events Table: Tracks feature usage and user actions
CREATE TABLE IF NOT EXISTS user_events (
  id SERIAL PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL, -- NULL for anonymous users
  session_id TEXT NOT NULL,
  visitor_id TEXT, -- For tracking anonymous users across sessions
  
  -- Event details
  event_type TEXT NOT NULL, -- 'page_view', 'feature_used', 'button_click', 'search', 'share', etc.
  event_category TEXT, -- 'navigation', 'music', 'social', 'subscription', etc.
  event_name TEXT NOT NULL, -- Specific event name (e.g., 'room_created', 'track_added', 'subscription_purchased')
  
  -- Event data (JSONB for flexibility)
  event_data JSONB, -- Additional event-specific data
  
  -- Context
  page_path TEXT, -- Current page/screen
  referrer TEXT, -- Where user came from
  room_id TEXT REFERENCES rooms(id) ON DELETE SET NULL, -- If event is room-related
  
  -- Platform context
  platform TEXT,
  device_type TEXT,
  
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Error Logs Table: Tracks errors and exceptions
CREATE TABLE IF NOT EXISTS error_logs (
  id SERIAL PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  session_id TEXT,
  visitor_id TEXT,
  
  -- Error details
  error_type TEXT NOT NULL, -- 'client_error', 'server_error', 'api_error', 'database_error'
  error_message TEXT NOT NULL,
  error_stack TEXT, -- Stack trace if available
  error_code TEXT, -- Error code if applicable
  
  -- Context
  page_path TEXT,
  user_agent TEXT,
  platform TEXT,
  device_type TEXT,
  browser TEXT,
  
  -- Request context (for API errors)
  request_url TEXT,
  request_method TEXT,
  request_body JSONB,
  response_status INTEGER,
  
  -- Additional data
  metadata JSONB, -- Additional error context
  
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Daily Analytics Aggregation Table: Pre-aggregated daily metrics for faster reporting
CREATE TABLE IF NOT EXISTS daily_analytics (
  id SERIAL PRIMARY KEY,
  date DATE NOT NULL UNIQUE,
  
  -- Visitor metrics
  total_visits INTEGER DEFAULT 0,
  unique_visitors INTEGER DEFAULT 0, -- Based on visitor_id
  unique_authenticated_users INTEGER DEFAULT 0, -- Based on user_id
  new_visitors INTEGER DEFAULT 0, -- First-time visitors
  returning_visitors INTEGER DEFAULT 0,
  
  -- Platform breakdown
  visits_web INTEGER DEFAULT 0,
  visits_ios INTEGER DEFAULT 0,
  visits_android INTEGER DEFAULT 0,
  
  -- Engagement metrics
  total_sessions INTEGER DEFAULT 0,
  avg_session_duration_seconds INTEGER DEFAULT 0,
  total_pages_viewed INTEGER DEFAULT 0,
  rooms_created INTEGER DEFAULT 0,
  rooms_joined INTEGER DEFAULT 0,
  tracks_played INTEGER DEFAULT 0,
  
  -- User metrics
  new_signups INTEGER DEFAULT 0,
  active_users INTEGER DEFAULT 0, -- Users who performed any action
  peak_concurrent_users INTEGER DEFAULT 0,
  
  -- Conversion metrics
  subscription_purchases INTEGER DEFAULT 0,
  subscription_revenue DECIMAL(10, 2) DEFAULT 0,
  
  -- Geographic breakdown (stored as JSONB for flexibility)
  visits_by_country JSONB DEFAULT '{}'::jsonb, -- { "US": 100, "GB": 50, ... }
  
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Platform Analytics Table: Aggregated platform/device metrics
CREATE TABLE IF NOT EXISTS platform_analytics (
  id SERIAL PRIMARY KEY,
  date DATE NOT NULL,
  platform TEXT NOT NULL, -- 'web', 'ios', 'android'
  device_type TEXT DEFAULT '', -- 'mobile', 'tablet', 'desktop' (empty string instead of NULL)
  browser TEXT DEFAULT '', -- Empty string instead of NULL
  os TEXT DEFAULT '', -- Empty string instead of NULL
  
  -- Metrics
  visits INTEGER DEFAULT 0,
  unique_visitors INTEGER DEFAULT 0,
  sessions INTEGER DEFAULT 0,
  avg_session_duration_seconds INTEGER DEFAULT 0,
  
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  UNIQUE(date, platform, device_type, browser, os)
);

-- Feature Usage Table: Tracks which features are used most
CREATE TABLE IF NOT EXISTS feature_usage (
  id SERIAL PRIMARY KEY,
  date DATE NOT NULL,
  feature_name TEXT NOT NULL, -- 'room_creation', 'track_search', 'playlist_creation', etc.
  event_category TEXT,
  
  -- Usage metrics
  usage_count INTEGER DEFAULT 0,
  unique_users INTEGER DEFAULT 0,
  
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  UNIQUE(date, feature_name)
);

-- Create indexes for faster queries
CREATE INDEX IF NOT EXISTS idx_app_visits_user_id ON app_visits(user_id);
CREATE INDEX IF NOT EXISTS idx_app_visits_visitor_id ON app_visits(visitor_id);
CREATE INDEX IF NOT EXISTS idx_app_visits_session_id ON app_visits(session_id);
CREATE INDEX IF NOT EXISTS idx_app_visits_visit_started_at ON app_visits(visit_started_at);
CREATE INDEX IF NOT EXISTS idx_app_visits_platform ON app_visits(platform);
CREATE INDEX IF NOT EXISTS idx_app_visits_country_code ON app_visits(country_code);

CREATE INDEX IF NOT EXISTS idx_user_events_user_id ON user_events(user_id);
CREATE INDEX IF NOT EXISTS idx_user_events_session_id ON user_events(session_id);
CREATE INDEX IF NOT EXISTS idx_user_events_event_type ON user_events(event_type);
CREATE INDEX IF NOT EXISTS idx_user_events_event_category ON user_events(event_category);
CREATE INDEX IF NOT EXISTS idx_user_events_event_name ON user_events(event_name);
CREATE INDEX IF NOT EXISTS idx_user_events_created_at ON user_events(created_at);
CREATE INDEX IF NOT EXISTS idx_user_events_room_id ON user_events(room_id);

CREATE INDEX IF NOT EXISTS idx_error_logs_user_id ON error_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_error_logs_error_type ON error_logs(error_type);
CREATE INDEX IF NOT EXISTS idx_error_logs_created_at ON error_logs(created_at);

CREATE INDEX IF NOT EXISTS idx_daily_analytics_date ON daily_analytics(date);
CREATE INDEX IF NOT EXISTS idx_platform_analytics_date ON platform_analytics(date);
CREATE INDEX IF NOT EXISTS idx_feature_usage_date ON feature_usage(date);
CREATE INDEX IF NOT EXISTS idx_feature_usage_feature_name ON feature_usage(feature_name);

-- Enable Row Level Security
ALTER TABLE app_visits ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE error_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE daily_analytics ENABLE ROW LEVEL SECURITY;
ALTER TABLE platform_analytics ENABLE ROW LEVEL SECURITY;
ALTER TABLE feature_usage ENABLE ROW LEVEL SECURITY;

-- RLS Policies: Allow authenticated users to insert their own data, admins can view all
-- App Visits
DROP POLICY IF EXISTS "Users can insert their own visits" ON app_visits;
CREATE POLICY "Users can insert their own visits" ON app_visits
  FOR INSERT WITH CHECK (auth.role() = 'authenticated' OR auth.role() = 'anon');

DROP POLICY IF EXISTS "Users can view their own visits" ON app_visits;
CREATE POLICY "Users can view their own visits" ON app_visits
  FOR SELECT USING (auth.uid() = user_id OR auth.role() = 'service_role');

DROP POLICY IF EXISTS "Admins can view all visits" ON app_visits;
CREATE POLICY "Admins can view all visits" ON app_visits
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM user_profiles 
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

-- User Events
DROP POLICY IF EXISTS "Users can insert their own events" ON user_events;
CREATE POLICY "Users can insert their own events" ON user_events
  FOR INSERT WITH CHECK (auth.role() = 'authenticated' OR auth.role() = 'anon');

DROP POLICY IF EXISTS "Users can view their own events" ON user_events;
CREATE POLICY "Users can view their own events" ON user_events
  FOR SELECT USING (auth.uid() = user_id OR auth.role() = 'service_role');

DROP POLICY IF EXISTS "Admins can view all events" ON user_events;
CREATE POLICY "Admins can view all events" ON user_events
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM user_profiles 
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

-- Error Logs
DROP POLICY IF EXISTS "Users can insert error logs" ON error_logs;
CREATE POLICY "Users can insert error logs" ON error_logs
  FOR INSERT WITH CHECK (auth.role() = 'authenticated' OR auth.role() = 'anon');

DROP POLICY IF EXISTS "Admins can view error logs" ON error_logs;
CREATE POLICY "Admins can view error logs" ON error_logs
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM user_profiles 
      WHERE id = auth.uid() AND role = 'admin'
    ) OR auth.role() = 'service_role'
  );

-- Daily Analytics (read-only for admins)
DROP POLICY IF EXISTS "Admins can view daily analytics" ON daily_analytics;
CREATE POLICY "Admins can view daily analytics" ON daily_analytics
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM user_profiles 
      WHERE id = auth.uid() AND role = 'admin'
    ) OR auth.role() = 'service_role'
  );

-- Platform Analytics (read-only for admins)
DROP POLICY IF EXISTS "Admins can view platform analytics" ON platform_analytics;
CREATE POLICY "Admins can view platform analytics" ON platform_analytics
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM user_profiles 
      WHERE id = auth.uid() AND role = 'admin'
    ) OR auth.role() = 'service_role'
  );

-- Feature Usage (read-only for admins)
DROP POLICY IF EXISTS "Admins can view feature usage" ON feature_usage;
CREATE POLICY "Admins can view feature usage" ON feature_usage
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM user_profiles 
      WHERE id = auth.uid() AND role = 'admin'
    ) OR auth.role() = 'service_role'
  );

-- Function to track app visit start
CREATE OR REPLACE FUNCTION track_app_visit(
  p_user_id UUID,
  p_session_id TEXT,
  p_visitor_id TEXT,
  p_platform TEXT,
  p_device_type TEXT,
  p_browser TEXT,
  p_browser_version TEXT,
  p_os TEXT,
  p_os_version TEXT,
  p_screen_width INTEGER,
  p_screen_height INTEGER,
  p_country_code TEXT,
  p_timezone TEXT,
  p_language TEXT
) RETURNS INTEGER AS $$
DECLARE
  v_visit_id INTEGER;
  v_is_new_visitor BOOLEAN;
BEGIN
  -- Check if this is a new visitor (first visit ever)
  SELECT COUNT(*) = 0 INTO v_is_new_visitor
  FROM app_visits
  WHERE visitor_id = p_visitor_id;
  
  -- Insert visit record
  INSERT INTO app_visits (
    user_id, session_id, visitor_id,
    platform, device_type, browser, browser_version, os, os_version,
    screen_width, screen_height,
    country_code, timezone, language,
    authenticated, first_visit_at
  )
  VALUES (
    p_user_id, p_session_id, p_visitor_id,
    p_platform, p_device_type, p_browser, p_browser_version, p_os, p_os_version,
    p_screen_width, p_screen_height,
    p_country_code, p_timezone, p_language,
    (p_user_id IS NOT NULL),
    CASE WHEN v_is_new_visitor THEN NOW() ELSE NULL END
  )
  RETURNING id INTO v_visit_id;
  
  RETURN v_visit_id;
END;
$$ LANGUAGE plpgsql;

-- Function to track app visit end
CREATE OR REPLACE FUNCTION end_app_visit(
  p_session_id TEXT,
  p_pages_viewed INTEGER,
  p_rooms_joined INTEGER,
  p_tracks_played INTEGER
) RETURNS void AS $$
BEGIN
  UPDATE app_visits
  SET visit_ended_at = NOW(),
      session_duration_seconds = EXTRACT(EPOCH FROM (NOW() - visit_started_at))::INTEGER,
      pages_viewed = GREATEST(pages_viewed, p_pages_viewed),
      rooms_joined = p_rooms_joined,
      tracks_played = p_tracks_played,
      updated_at = NOW()
  WHERE session_id = p_session_id AND visit_ended_at IS NULL;
END;
$$ LANGUAGE plpgsql;

-- Function to track user event
CREATE OR REPLACE FUNCTION track_user_event(
  p_user_id UUID,
  p_session_id TEXT,
  p_visitor_id TEXT,
  p_event_type TEXT,
  p_event_category TEXT,
  p_event_name TEXT,
  p_event_data JSONB,
  p_page_path TEXT,
  p_referrer TEXT,
  p_room_id TEXT,
  p_platform TEXT,
  p_device_type TEXT
) RETURNS void AS $$
BEGIN
  INSERT INTO user_events (
    user_id, session_id, visitor_id,
    event_type, event_category, event_name, event_data,
    page_path, referrer, room_id,
    platform, device_type
  )
  VALUES (
    p_user_id, p_session_id, p_visitor_id,
    p_event_type, p_event_category, p_event_name, p_event_data,
    p_page_path, p_referrer, p_room_id,
    p_platform, p_device_type
  );
END;
$$ LANGUAGE plpgsql;

-- Function to log error
CREATE OR REPLACE FUNCTION log_error(
  p_user_id UUID,
  p_session_id TEXT,
  p_visitor_id TEXT,
  p_error_type TEXT,
  p_error_message TEXT,
  p_error_stack TEXT,
  p_error_code TEXT,
  p_page_path TEXT,
  p_user_agent TEXT,
  p_platform TEXT,
  p_device_type TEXT,
  p_browser TEXT,
  p_request_url TEXT,
  p_request_method TEXT,
  p_request_body JSONB,
  p_response_status INTEGER,
  p_metadata JSONB
) RETURNS void AS $$
BEGIN
  INSERT INTO error_logs (
    user_id, session_id, visitor_id,
    error_type, error_message, error_stack, error_code,
    page_path, user_agent, platform, device_type, browser,
    request_url, request_method, request_body, response_status,
    metadata
  )
  VALUES (
    p_user_id, p_session_id, p_visitor_id,
    p_error_type, p_error_message, p_error_stack, p_error_code,
    p_page_path, p_user_agent, p_platform, p_device_type, p_browser,
    p_request_url, p_request_method, p_request_body, p_response_status,
    p_metadata
  );
END;
$$ LANGUAGE plpgsql;

-- Function to aggregate daily analytics (should be run daily via cron)
CREATE OR REPLACE FUNCTION aggregate_daily_analytics(p_date DATE DEFAULT CURRENT_DATE - INTERVAL '1 day')
RETURNS void AS $$
BEGIN
  INSERT INTO daily_analytics (
    date,
    total_visits,
    unique_visitors,
    unique_authenticated_users,
    new_visitors,
    returning_visitors,
    visits_web,
    visits_ios,
    visits_android,
    total_sessions,
    avg_session_duration_seconds,
    total_pages_viewed,
    rooms_created,
    rooms_joined,
    tracks_played,
    new_signups,
    active_users,
    peak_concurrent_users,
    visits_by_country
  )
  SELECT
    p_date,
    COUNT(*) as total_visits,
    COUNT(DISTINCT visitor_id) as unique_visitors,
    COUNT(DISTINCT user_id) FILTER (WHERE user_id IS NOT NULL) as unique_authenticated_users,
    COUNT(*) FILTER (WHERE first_visit_at::date = p_date) as new_visitors,
    COUNT(*) FILTER (WHERE first_visit_at::date < p_date) as returning_visitors,
    COUNT(*) FILTER (WHERE platform = 'web') as visits_web,
    COUNT(*) FILTER (WHERE platform = 'ios') as visits_ios,
    COUNT(*) FILTER (WHERE platform = 'android') as visits_android,
    COUNT(DISTINCT session_id) as total_sessions,
    AVG(session_duration_seconds)::INTEGER as avg_session_duration_seconds,
    SUM(pages_viewed) as total_pages_viewed,
    (SELECT COUNT(*) FROM rooms WHERE created_at::date = p_date) as rooms_created,
    SUM(rooms_joined) as rooms_joined,
    SUM(tracks_played) as tracks_played,
    (SELECT COUNT(*) FROM auth.users WHERE created_at::date = p_date) as new_signups,
    COUNT(DISTINCT user_id) FILTER (WHERE user_id IS NOT NULL AND (rooms_joined > 0 OR tracks_played > 0)) as active_users,
    (SELECT MAX(current_listeners) FROM room_analytics WHERE last_activity_at::date = p_date) as peak_concurrent_users,
    jsonb_object_agg(country_code, visit_count) FILTER (WHERE country_code IS NOT NULL) as visits_by_country
  FROM (
    SELECT 
      visitor_id,
      user_id,
      session_id,
      platform,
      session_duration_seconds,
      pages_viewed,
      rooms_joined,
      tracks_played,
      first_visit_at,
      country_code,
      COUNT(*) OVER (PARTITION BY country_code) as visit_count
    FROM app_visits
    WHERE visit_started_at::date = p_date
  ) sub
  GROUP BY p_date
  ON CONFLICT (date) DO UPDATE SET
    total_visits = EXCLUDED.total_visits,
    unique_visitors = EXCLUDED.unique_visitors,
    unique_authenticated_users = EXCLUDED.unique_authenticated_users,
    new_visitors = EXCLUDED.new_visitors,
    returning_visitors = EXCLUDED.returning_visitors,
    visits_web = EXCLUDED.visits_web,
    visits_ios = EXCLUDED.visits_ios,
    visits_android = EXCLUDED.visits_android,
    total_sessions = EXCLUDED.total_sessions,
    avg_session_duration_seconds = EXCLUDED.avg_session_duration_seconds,
    total_pages_viewed = EXCLUDED.total_pages_viewed,
    rooms_created = EXCLUDED.rooms_created,
    rooms_joined = EXCLUDED.rooms_joined,
    tracks_played = EXCLUDED.tracks_played,
    new_signups = EXCLUDED.new_signups,
    active_users = EXCLUDED.active_users,
    peak_concurrent_users = EXCLUDED.peak_concurrent_users,
    visits_by_country = EXCLUDED.visits_by_country,
    updated_at = NOW();
END;
$$ LANGUAGE plpgsql;

-- Function to aggregate platform analytics
CREATE OR REPLACE FUNCTION aggregate_platform_analytics(p_date DATE DEFAULT CURRENT_DATE - INTERVAL '1 day')
RETURNS void AS $$
BEGIN
  -- Delete existing records for this date to avoid conflicts with NULLs
  DELETE FROM platform_analytics WHERE date = p_date;
  
  -- Insert aggregated data
  INSERT INTO platform_analytics (
    date, platform, device_type, browser, os,
    visits, unique_visitors, sessions, avg_session_duration_seconds
  )
  SELECT
    p_date,
    platform,
    COALESCE(device_type, '') as device_type,
    COALESCE(browser, '') as browser,
    COALESCE(os, '') as os,
    COUNT(*) as visits,
    COUNT(DISTINCT visitor_id) as unique_visitors,
    COUNT(DISTINCT session_id) as sessions,
    AVG(session_duration_seconds)::INTEGER as avg_session_duration_seconds
  FROM app_visits
  WHERE visit_started_at::date = p_date
  GROUP BY p_date, platform, COALESCE(device_type, ''), COALESCE(browser, ''), COALESCE(os, '');
END;
$$ LANGUAGE plpgsql;

-- Function to aggregate feature usage
CREATE OR REPLACE FUNCTION aggregate_feature_usage(p_date DATE DEFAULT CURRENT_DATE - INTERVAL '1 day')
RETURNS void AS $$
BEGIN
  INSERT INTO feature_usage (
    date, feature_name, event_category, usage_count, unique_users
  )
  SELECT
    p_date,
    event_name as feature_name,
    event_category,
    COUNT(*) as usage_count,
    COUNT(DISTINCT COALESCE(user_id::text, visitor_id)) as unique_users
  FROM user_events
  WHERE created_at::date = p_date
  GROUP BY p_date, event_name, event_category
  ON CONFLICT (date, feature_name) 
  DO UPDATE SET
    usage_count = EXCLUDED.usage_count,
    unique_users = EXCLUDED.unique_users,
    updated_at = NOW();
END;
$$ LANGUAGE plpgsql;

-- Trigger to update updated_at column
DROP TRIGGER IF EXISTS update_app_visits_updated_at ON app_visits;
CREATE TRIGGER update_app_visits_updated_at
  BEFORE UPDATE ON app_visits
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_daily_analytics_updated_at ON daily_analytics;
CREATE TRIGGER update_daily_analytics_updated_at
  BEFORE UPDATE ON daily_analytics
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_platform_analytics_updated_at ON platform_analytics;
CREATE TRIGGER update_platform_analytics_updated_at
  BEFORE UPDATE ON platform_analytics
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_feature_usage_updated_at ON feature_usage;
CREATE TRIGGER update_feature_usage_updated_at
  BEFORE UPDATE ON feature_usage
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Views for easy querying

-- View: Daily Active Users (DAU)
CREATE OR REPLACE VIEW daily_active_users AS
SELECT 
  date,
  unique_authenticated_users as dau,
  unique_visitors as total_dau,
  active_users
FROM daily_analytics
ORDER BY date DESC;

-- View: Weekly Active Users (WAU) - last 7 days
CREATE OR REPLACE VIEW weekly_active_users AS
SELECT 
  DATE_TRUNC('week', date) as week_start,
  COUNT(DISTINCT unique_authenticated_users) as wau,
  SUM(unique_visitors) as total_wau
FROM daily_analytics
WHERE date >= CURRENT_DATE - INTERVAL '7 days'
GROUP BY DATE_TRUNC('week', date)
ORDER BY week_start DESC;

-- View: Monthly Active Users (MAU) - last 30 days
CREATE OR REPLACE VIEW monthly_active_users AS
SELECT 
  DATE_TRUNC('month', date) as month_start,
  COUNT(DISTINCT unique_authenticated_users) as mau,
  SUM(unique_visitors) as total_mau
FROM daily_analytics
WHERE date >= CURRENT_DATE - INTERVAL '30 days'
GROUP BY DATE_TRUNC('month', date)
ORDER BY month_start DESC;

-- View: Top Features by Usage
CREATE OR REPLACE VIEW top_features_usage AS
SELECT 
  feature_name,
  event_category,
  SUM(usage_count) as total_usage,
  SUM(unique_users) as total_unique_users,
  AVG(usage_count) as avg_daily_usage
FROM feature_usage
WHERE date >= CURRENT_DATE - INTERVAL '30 days'
GROUP BY feature_name, event_category
ORDER BY total_usage DESC
LIMIT 50;

-- View: Error Summary
CREATE OR REPLACE VIEW error_summary AS
SELECT 
  error_type,
  error_code,
  COUNT(*) as error_count,
  COUNT(DISTINCT user_id) as affected_users,
  MIN(created_at) as first_occurrence,
  MAX(created_at) as last_occurrence
FROM error_logs
WHERE created_at >= CURRENT_DATE - INTERVAL '7 days'
GROUP BY error_type, error_code
ORDER BY error_count DESC;

-- View: Platform Distribution
CREATE OR REPLACE VIEW platform_distribution AS
SELECT 
  platform,
  device_type,
  SUM(visits) as total_visits,
  SUM(unique_visitors) as total_unique_visitors,
  AVG(avg_session_duration_seconds)::INTEGER as avg_session_duration
FROM platform_analytics
WHERE date >= CURRENT_DATE - INTERVAL '30 days'
GROUP BY platform, device_type
ORDER BY total_visits DESC;

