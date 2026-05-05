-- Migration: Add per_hole_stats column to rounds table
-- Date: 2026-05-05
-- Purpose: Store per-hole statistics (FIR, GIR, putts, distances, etc.)

ALTER TABLE rounds ADD COLUMN IF NOT EXISTS per_hole_stats jsonb DEFAULT '[]'::jsonb;

-- Create index for potential queries on per_hole_stats
CREATE INDEX IF NOT EXISTS idx_rounds_per_hole_stats ON rounds USING GIN (per_hole_stats);
