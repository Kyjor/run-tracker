-- Migration: Convert user_runs.date from DATE to TIMESTAMPTZ
-- This allows storing precise run times instead of just dates

-- Step 1: Add a temporary column with TIMESTAMPTZ
ALTER TABLE user_runs ADD COLUMN date_new TIMESTAMPTZ;

-- Step 2: Convert existing DATE values to TIMESTAMPTZ (use noon UTC for date-only values)
UPDATE user_runs SET date_new = (date::text || 'T12:00:00Z')::timestamptz WHERE date_new IS NULL;

-- Step 3: Drop the old column
ALTER TABLE user_runs DROP COLUMN date;

-- Step 4: Rename the new column
ALTER TABLE user_runs RENAME COLUMN date_new TO date;

-- Step 5: Add NOT NULL constraint back
ALTER TABLE user_runs ALTER COLUMN date SET NOT NULL;

