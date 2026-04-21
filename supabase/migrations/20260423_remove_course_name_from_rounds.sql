-- Migration: Remove course_name column from rounds (multi-nine join table migration)

ALTER TABLE rounds DROP COLUMN IF EXISTS course_name;
