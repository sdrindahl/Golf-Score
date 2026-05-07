-- Migration: Add updated_at timestamp to rounds table for inactivity tracking

ALTER TABLE rounds ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP DEFAULT NOW();

-- Update existing rounds to have updated_at = created_at if it's null
UPDATE rounds SET updated_at = created_at WHERE updated_at IS NULL;

-- Create index for faster queries on updated_at
CREATE INDEX IF NOT EXISTS rounds_updated_at_idx ON rounds(updated_at);
