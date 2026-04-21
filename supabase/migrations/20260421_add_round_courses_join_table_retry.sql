-- Migration: Add round_courses join table for multi-nine support (retry)

CREATE TABLE IF NOT EXISTS round_courses (
    id BIGSERIAL PRIMARY KEY,
    round_id TEXT NOT NULL REFERENCES rounds(id) ON DELETE CASCADE,
    course_id TEXT NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
    course_order INTEGER NOT NULL DEFAULT 0
);

-- (Optional) Drop the course_id column from rounds if you want to fully migrate
-- ALTER TABLE rounds DROP COLUMN IF EXISTS course_id;

-- (Optional) Add a migration note
-- You may want to migrate existing data from rounds.course_id to round_courses
