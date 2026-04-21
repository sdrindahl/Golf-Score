-- Migration: Remove course_id FK and column from rounds (multi-nine join table migration)

ALTER TABLE rounds DROP CONSTRAINT IF EXISTS rounds_course_id_fkey;
ALTER TABLE rounds DROP COLUMN IF EXISTS course_id;
