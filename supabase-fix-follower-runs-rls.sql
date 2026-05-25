-- Allow followers to read friends' runs and GPS routes for the activity feed.
-- Run in Supabase SQL editor if feed maps / friend runs return empty.

CREATE POLICY "Followers can view followed users runs" ON user_runs
  FOR SELECT USING (
    auth.uid() = user_id
    OR EXISTS (
      SELECT 1 FROM follows
      WHERE follows.follower_id = auth.uid()
      AND follows.following_id = user_runs.user_id
    )
  );

CREATE POLICY "Followers can view followed users run routes" ON user_run_routes
  FOR SELECT USING (
    auth.uid() = user_id
    OR EXISTS (
      SELECT 1 FROM follows
      WHERE follows.follower_id = auth.uid()
      AND follows.following_id = user_run_routes.user_id
    )
  );
