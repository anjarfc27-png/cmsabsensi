-- Add has_seen_tour column to profiles if it doesn't exist
ALTER TABLE profiles 
ADD COLUMN IF NOT EXISTS has_seen_tour BOOLEAN DEFAULT FALSE;

-- Add checking mechanism just in case (optional, but good practice)
COMMENT ON COLUMN profiles.has_seen_tour IS 'Tracks if the user has completed the dashboard tour';
