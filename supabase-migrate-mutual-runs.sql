-- Runs, routes, plans, and the feed are visible only to mutual follows.

CREATE OR REPLACE FUNCTION public.is_mutual_follow(other_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
  SELECT
    auth.uid() IS NOT NULL
    AND other_id IS DISTINCT FROM auth.uid()
    AND EXISTS (
      SELECT 1 FROM public.follows
      WHERE follower_id = auth.uid() AND following_id = other_id
    )
    AND EXISTS (
      SELECT 1 FROM public.follows
      WHERE follower_id = other_id AND following_id = auth.uid()
    );
$$;

REVOKE ALL ON FUNCTION public.is_mutual_follow(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_mutual_follow(uuid) TO authenticated;

DROP POLICY IF EXISTS "Followers can view followed user runs" ON public.user_runs;
CREATE POLICY "Mutuals can view runs" ON public.user_runs
  FOR SELECT USING (public.is_mutual_follow(user_id));

DROP POLICY IF EXISTS "Public routes visible if run is public" ON public.user_run_routes;
CREATE POLICY "Mutuals can view routes" ON public.user_run_routes
  FOR SELECT USING (public.is_mutual_follow(user_id));

DROP POLICY IF EXISTS "Users can view own or followed active plans" ON public.active_plans;
CREATE POLICY "Mutuals can view active plans" ON public.active_plans
  FOR SELECT USING (public.is_mutual_follow(user_id));

DROP POLICY IF EXISTS "Users can view feed activities" ON public.feed_activities;
CREATE POLICY "Users can view feed activities" ON public.feed_activities
  FOR SELECT USING (user_id = auth.uid() OR public.is_mutual_follow(user_id));

DROP POLICY IF EXISTS "Users can view comments on visible activities" ON public.feed_comments;
CREATE POLICY "Users can view comments on visible activities" ON public.feed_comments
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.feed_activities
      WHERE feed_activities.id = feed_comments.activity_id
      AND (
        feed_activities.user_id = auth.uid()
        OR public.is_mutual_follow(feed_activities.user_id)
      )
    )
  );

DROP POLICY IF EXISTS "Mutuals can view profiles" ON public.profiles;
CREATE POLICY "Mutuals can view profiles" ON public.profiles
  FOR SELECT USING (public.is_mutual_follow(id));
