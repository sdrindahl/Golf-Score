-- Migration: Fix Lost Spur round score mismatch
-- Date: 2026-04-15
-- Issue: The Lost Spur round had scores that sum to 35 but total_score stored as 34

-- Fix the Lost Spur Golf Course round with id "round-1776309308407"
-- Scores [5,4,3,4,4,3,5,3,4] sum to 35, not 34
UPDATE rounds 
SET total_score = 35
WHERE id = 'round-1776309308407'
  AND course_name = 'Lost Spur Golf Course'
  AND total_score = 34;

-- Verify the fix
-- SELECT id, course_name, total_score, scores FROM rounds WHERE id = 'round-1776309308407';
