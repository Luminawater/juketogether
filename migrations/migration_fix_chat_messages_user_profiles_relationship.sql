-- Add foreign key constraint from chat_messages.user_id to user_profiles.id
-- This allows PostgREST to understand the relationship for joins
DO $$
BEGIN
  -- Check if the foreign key constraint already exists
  IF NOT EXISTS (
    SELECT 1 
    FROM information_schema.table_constraints 
    WHERE constraint_name = 'chat_messages_user_id_fkey_user_profiles'
    AND table_name = 'chat_messages'
  ) THEN
    -- Add the foreign key constraint
    ALTER TABLE chat_messages
    ADD CONSTRAINT chat_messages_user_id_fkey_user_profiles
    FOREIGN KEY (user_id) REFERENCES user_profiles(id) ON DELETE CASCADE;
  END IF;
END $$;

-- Create an index on chat_messages.user_id if it doesn't exist (for better join performance)
CREATE INDEX IF NOT EXISTS idx_chat_messages_user_id ON chat_messages(user_id);

