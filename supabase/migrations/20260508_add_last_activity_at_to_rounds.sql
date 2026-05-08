-- Migration: Add last_activity_at timestamp to rounds for idle detection
-- This tracks actual score changes, separate from heartbeat updates

ALTER TABLE rounds ADD COLUMN IF NOT EXISTS last_activity_at TIMESTAMP DEFAULT NOW();

-- Update existing rounds to have last_activity_at = updated_at
UPDATE rounds SET last_activity_at = updated_at WHERE last_activity_at IS NULL;

-- Create index for faster queries on last_activity_at
CREATE INDEX IF NOT EXISTS rounds_last_activity_at_idx ON rounds(last_activity_at);
