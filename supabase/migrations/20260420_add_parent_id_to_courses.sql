-- Migration: Add parent_id to courses for 27-hole support
ALTER TABLE courses ADD COLUMN parent_id text;

-- Optional: Add index for parent_id for faster lookups
CREATE INDEX IF NOT EXISTS idx_courses_parent_id ON courses(parent_id);