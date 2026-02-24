-- Denormalize plan data into active_plans table for easier querying and RLS
-- This stores the plan details directly so we don't need to join with training_plans

-- Add columns for plan details
ALTER TABLE active_plans
  ADD COLUMN IF NOT EXISTS plan_name TEXT,
  ADD COLUMN IF NOT EXISTS plan_description TEXT,
  ADD COLUMN IF NOT EXISTS race_type TEXT,
  ADD COLUMN IF NOT EXISTS difficulty TEXT,
  ADD COLUMN IF NOT EXISTS duration_weeks INTEGER,
  ADD COLUMN IF NOT EXISTS plan_days_json JSONB;

-- Backfill existing active_plans with plan data
UPDATE active_plans ap
SET
  plan_name = tp.name,
  plan_description = tp.description,
  race_type = tp.race_type,
  difficulty = tp.difficulty,
  duration_weeks = tp.duration_weeks,
  plan_days_json = (
    SELECT jsonb_agg(
      jsonb_build_object(
        'id', pd.id,
        'week_number', pd.week_number,
        'day_of_week', pd.day_of_week,
        'activity_type', pd.activity_type,
        'distance_value', pd.distance_value,
        'distance_unit', pd.distance_unit,
        'duration_minutes', pd.duration_minutes,
        'description', pd.description,
        'workout_segments', pd.workout_segments
      )
      ORDER BY pd.week_number, pd.day_of_week
    )
    FROM plan_days pd
    WHERE pd.plan_id = tp.id
  )
FROM training_plans tp
WHERE ap.plan_id = tp.id;

-- Update RLS policy to be simpler (no need to check training_plans table)
DROP POLICY IF EXISTS "Users can view own or followed active plans" ON active_plans;
CREATE POLICY "Users can view own or followed active plans" ON active_plans
  FOR SELECT USING (
    auth.uid() = user_id OR
    EXISTS (
      SELECT 1 FROM follows
      WHERE follows.follower_id = auth.uid()
      AND follows.following_id = active_plans.user_id
    )
  );

