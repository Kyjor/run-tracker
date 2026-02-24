-- Fix RLS policy for active_plans to allow users to view their own plans
-- and followers to view followed users' plans

-- Drop the restrictive "Followers can view followed user active plans" policy if it exists
DROP POLICY IF EXISTS "Followers can view followed user active plans" ON active_plans;

-- Create a SELECT policy that allows:
-- 1. Users to view their own active plans (auth.uid() = user_id)
-- 2. Followers to view followed users' active plans (EXISTS follows check)
-- Note: The existing "Users can manage own active plans" FOR ALL policy will still
-- handle INSERT/UPDATE/DELETE for own plans, and both policies will apply to SELECT (OR'd together)
CREATE POLICY "Users can view own or followed active plans" ON active_plans
  FOR SELECT USING (
    auth.uid() = user_id OR
    EXISTS (
      SELECT 1 FROM follows
      WHERE follows.follower_id = auth.uid()
      AND follows.following_id = active_plans.user_id
    )
  );

