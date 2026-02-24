-- Fix feed_comments RLS policy to allow viewing comments on activities you can see
-- Run this in your Supabase SQL editor

-- Drop the old policy
DROP POLICY IF EXISTS "Users can view all comments" ON feed_comments;

-- Create the new policy that checks if you can see the parent activity
CREATE POLICY "Users can view comments on visible activities" ON feed_comments
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM feed_activities
      WHERE feed_activities.id = feed_comments.activity_id
      AND (
        feed_activities.user_id = auth.uid() OR
        EXISTS (
          SELECT 1 FROM follows
          WHERE follows.follower_id = auth.uid()
          AND follows.following_id = feed_activities.user_id
        )
      )
    )
  );


