-- Perceived effort on runs, and a race date on the active plan.
-- Run in the Supabase SQL editor.

ALTER TABLE user_runs ADD COLUMN IF NOT EXISTS effort INTEGER;
ALTER TABLE active_plans ADD COLUMN IF NOT EXISTS race_date DATE;
