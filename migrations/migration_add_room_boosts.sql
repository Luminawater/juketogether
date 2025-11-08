-- Create room_boosts table to store temporary tier 3 boosts for rooms
CREATE TABLE IF NOT EXISTS room_boosts (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  room_id TEXT NOT NULL REFERENCES rooms(id) ON DELETE CASCADE,
  purchased_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  purchased_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
  amount_paid DECIMAL(10, 2) NOT NULL DEFAULT 1.00,
  payment_status TEXT DEFAULT 'pending' CHECK (payment_status IN ('pending', 'completed', 'failed', 'refunded')),
  payment_provider TEXT, -- 'stripe', 'paypal', etc.
  payment_intent_id TEXT, -- External payment ID
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_room_boosts_room_id ON room_boosts(room_id);
CREATE INDEX IF NOT EXISTS idx_room_boosts_expires_at ON room_boosts(expires_at);
CREATE INDEX IF NOT EXISTS idx_room_boosts_payment_status ON room_boosts(payment_status);

-- Enable Row Level Security (RLS)
ALTER TABLE room_boosts ENABLE ROW LEVEL SECURITY;

-- Create policies for room_boosts
-- Allow authenticated users to read active boosts for any room
DROP POLICY IF EXISTS "Allow authenticated users to read active boosts" ON room_boosts;
CREATE POLICY "Allow authenticated users to read active boosts" ON room_boosts
  FOR SELECT USING (
    auth.role() = 'authenticated' AND
    payment_status = 'completed' AND
    expires_at > NOW()
  );

-- Allow users to insert their own boost purchases
DROP POLICY IF EXISTS "Allow users to create boost purchases" ON room_boosts;
CREATE POLICY "Allow users to create boost purchases" ON room_boosts
  FOR INSERT WITH CHECK (auth.uid() = purchased_by);

-- Allow users to update their own boost purchases (for payment status updates)
DROP POLICY IF EXISTS "Allow users to update their own boosts" ON room_boosts;
CREATE POLICY "Allow users to update their own boosts" ON room_boosts
  FOR UPDATE USING (auth.uid() = purchased_by);

-- Function to get active boost for a room
CREATE OR REPLACE FUNCTION get_active_room_boost(room_id_param TEXT)
RETURNS TABLE (
  id UUID,
  room_id TEXT,
  purchased_by UUID,
  purchased_at TIMESTAMP WITH TIME ZONE,
  expires_at TIMESTAMP WITH TIME ZONE,
  amount_paid DECIMAL(10, 2),
  payment_status TEXT,
  minutes_remaining INTEGER
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    rb.id,
    rb.room_id,
    rb.purchased_by,
    rb.purchased_at,
    rb.expires_at,
    rb.amount_paid,
    rb.payment_status,
    EXTRACT(EPOCH FROM (rb.expires_at - NOW()))::INTEGER / 60 AS minutes_remaining
  FROM room_boosts rb
  WHERE rb.room_id = room_id_param
    AND rb.payment_status = 'completed'
    AND rb.expires_at > NOW()
  ORDER BY rb.expires_at DESC
  LIMIT 1;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to clean up expired boosts (can be run periodically)
CREATE OR REPLACE FUNCTION cleanup_expired_boosts()
RETURNS INTEGER AS $$
DECLARE
  deleted_count INTEGER;
BEGIN
  DELETE FROM room_boosts
  WHERE expires_at < NOW() - INTERVAL '7 days'; -- Keep for 7 days for records
  
  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  RETURN deleted_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

