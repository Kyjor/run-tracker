-- Add health metrics columns to user_runs and widen source CHECK for fit/live.
-- Run in Supabase SQL editor.

ALTER TABLE user_runs ADD COLUMN IF NOT EXISTS avg_heart_rate REAL;
ALTER TABLE user_runs ADD COLUMN IF NOT EXISTS max_heart_rate REAL;
ALTER TABLE user_runs ADD COLUMN IF NOT EXISTS min_heart_rate REAL;
ALTER TABLE user_runs ADD COLUMN IF NOT EXISTS hr_zones TEXT;

ALTER TABLE user_runs ADD COLUMN IF NOT EXISTS avg_cadence REAL;
ALTER TABLE user_runs ADD COLUMN IF NOT EXISTS avg_stride_length_meters REAL;
ALTER TABLE user_runs ADD COLUMN IF NOT EXISTS avg_ground_contact_time_ms REAL;
ALTER TABLE user_runs ADD COLUMN IF NOT EXISTS avg_vertical_oscillation_cm REAL;

ALTER TABLE user_runs ADD COLUMN IF NOT EXISTS avg_power_watts REAL;
ALTER TABLE user_runs ADD COLUMN IF NOT EXISTS max_power_watts REAL;

ALTER TABLE user_runs ADD COLUMN IF NOT EXISTS elevation_gain_meters REAL;
ALTER TABLE user_runs ADD COLUMN IF NOT EXISTS elevation_loss_meters REAL;

ALTER TABLE user_runs ADD COLUMN IF NOT EXISTS vo2_max REAL;
ALTER TABLE user_runs ADD COLUMN IF NOT EXISTS temperature_celsius REAL;
ALTER TABLE user_runs ADD COLUMN IF NOT EXISTS humidity_percent REAL;
ALTER TABLE user_runs ADD COLUMN IF NOT EXISTS weather_condition TEXT;
ALTER TABLE user_runs ADD COLUMN IF NOT EXISTS calories REAL;

-- Widen source constraint to include fit + live
ALTER TABLE user_runs DROP CONSTRAINT IF EXISTS user_runs_source_check;
ALTER TABLE user_runs ADD CONSTRAINT user_runs_source_check
  CHECK (source IN ('manual', 'healthkit', 'fit', 'live'));
