-- Comments are visible on activities you can see, and you can always see your own.
-- Row level security must be enabled or these policies do nothing.

ALTER TABLE public.feed_comments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view all comments" ON public.feed_comments;
DROP POLICY IF EXISTS "Users can view comments on visible activities" ON public.feed_comments;

CREATE POLICY "Users can view comments on visible activities" ON public.feed_comments
  FOR SELECT USING (
    user_id = (SELECT auth.uid())
    OR EXISTS (
      SELECT 1 FROM public.feed_activities
      WHERE feed_activities.id = feed_comments.activity_id
      AND (
        feed_activities.user_id = (SELECT auth.uid())
        OR public.is_mutual_follow(feed_activities.user_id)
      )
    )
  );
