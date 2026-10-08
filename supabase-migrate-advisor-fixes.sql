-- Advisor fixes: enable feed_comments RLS, pin function search_path,
-- stop public calls to handle_new_user, initplan auth.uid(), and
-- one SELECT policy per table. Access rules stay the same.

ALTER TABLE public.feed_comments ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, display_name, email)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'display_name', split_part(NEW.email, '@', 1)),
    NEW.email
  );
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.handle_new_user() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.handle_new_user() FROM anon, authenticated;
GRANT EXECUTE ON FUNCTION public.handle_new_user() TO supabase_auth_admin;

ALTER FUNCTION public.update_updated_at() SET search_path = public;
ALTER FUNCTION public.update_plan_upvote_count() SET search_path = public;
ALTER FUNCTION public.update_plan_rating_stats() SET search_path = public;

CREATE OR REPLACE FUNCTION public.is_mutual_follow(other_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
  SELECT
    (SELECT auth.uid()) IS NOT NULL
    AND other_id IS DISTINCT FROM (SELECT auth.uid())
    AND EXISTS (
      SELECT 1 FROM public.follows
      WHERE follower_id = (SELECT auth.uid()) AND following_id = other_id
    )
    AND EXISTS (
      SELECT 1 FROM public.follows
      WHERE follower_id = other_id AND following_id = (SELECT auth.uid())
    );
$$;

-- Profiles
DROP POLICY IF EXISTS "Users can view own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can view public profiles" ON public.profiles;
DROP POLICY IF EXISTS "Mutuals can view profiles" ON public.profiles;
DROP POLICY IF EXISTS "Users can view profiles" ON public.profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can insert own profile" ON public.profiles;

CREATE POLICY "Users can view profiles" ON public.profiles
  FOR SELECT USING (
    (SELECT auth.uid()) = id
    OR is_public = true
    OR public.is_mutual_follow(id)
  );
CREATE POLICY "Users can update own profile" ON public.profiles
  FOR UPDATE
  USING ((SELECT auth.uid()) = id)
  WITH CHECK ((SELECT auth.uid()) = id);
CREATE POLICY "Users can insert own profile" ON public.profiles
  FOR INSERT WITH CHECK ((SELECT auth.uid()) = id);

-- Runs
DROP POLICY IF EXISTS "Users can manage own runs" ON public.user_runs;
DROP POLICY IF EXISTS "Mutuals can view runs" ON public.user_runs;
DROP POLICY IF EXISTS "Users can view runs" ON public.user_runs;
DROP POLICY IF EXISTS "Users can insert own runs" ON public.user_runs;
DROP POLICY IF EXISTS "Users can update own runs" ON public.user_runs;
DROP POLICY IF EXISTS "Users can delete own runs" ON public.user_runs;

CREATE POLICY "Users can view runs" ON public.user_runs
  FOR SELECT USING (
    user_id = (SELECT auth.uid()) OR public.is_mutual_follow(user_id)
  );
CREATE POLICY "Users can insert own runs" ON public.user_runs
  FOR INSERT WITH CHECK (user_id = (SELECT auth.uid()));
CREATE POLICY "Users can update own runs" ON public.user_runs
  FOR UPDATE
  USING (user_id = (SELECT auth.uid()))
  WITH CHECK (user_id = (SELECT auth.uid()));
CREATE POLICY "Users can delete own runs" ON public.user_runs
  FOR DELETE USING (user_id = (SELECT auth.uid()));

-- Routes (also drop the duplicate owner policy)
DROP POLICY IF EXISTS "Users can manage own run routes" ON public.user_run_routes;
DROP POLICY IF EXISTS "Users manage own routes" ON public.user_run_routes;
DROP POLICY IF EXISTS "Mutuals can view routes" ON public.user_run_routes;
DROP POLICY IF EXISTS "Users can view routes" ON public.user_run_routes;
DROP POLICY IF EXISTS "Users can insert own routes" ON public.user_run_routes;
DROP POLICY IF EXISTS "Users can update own routes" ON public.user_run_routes;
DROP POLICY IF EXISTS "Users can delete own routes" ON public.user_run_routes;

CREATE POLICY "Users can view routes" ON public.user_run_routes
  FOR SELECT USING (
    user_id = (SELECT auth.uid()) OR public.is_mutual_follow(user_id)
  );
CREATE POLICY "Users can insert own routes" ON public.user_run_routes
  FOR INSERT WITH CHECK (user_id = (SELECT auth.uid()));
CREATE POLICY "Users can update own routes" ON public.user_run_routes
  FOR UPDATE
  USING (user_id = (SELECT auth.uid()))
  WITH CHECK (user_id = (SELECT auth.uid()));
CREATE POLICY "Users can delete own routes" ON public.user_run_routes
  FOR DELETE USING (user_id = (SELECT auth.uid()));

-- Goals: single policy, just stop per-row auth.uid()
DROP POLICY IF EXISTS "Users can manage own goals" ON public.user_goals;
CREATE POLICY "Users can manage own goals" ON public.user_goals
  FOR ALL USING (user_id = (SELECT auth.uid()))
  WITH CHECK (user_id = (SELECT auth.uid()));

-- Active plans
DROP POLICY IF EXISTS "Users can manage own active plans" ON public.active_plans;
DROP POLICY IF EXISTS "Mutuals can view active plans" ON public.active_plans;
DROP POLICY IF EXISTS "Users can view active plans" ON public.active_plans;
DROP POLICY IF EXISTS "Users can insert own active plans" ON public.active_plans;
DROP POLICY IF EXISTS "Users can update own active plans" ON public.active_plans;
DROP POLICY IF EXISTS "Users can delete own active plans" ON public.active_plans;

CREATE POLICY "Users can view active plans" ON public.active_plans
  FOR SELECT USING (
    user_id = (SELECT auth.uid()) OR public.is_mutual_follow(user_id)
  );
CREATE POLICY "Users can insert own active plans" ON public.active_plans
  FOR INSERT WITH CHECK (user_id = (SELECT auth.uid()));
CREATE POLICY "Users can update own active plans" ON public.active_plans
  FOR UPDATE
  USING (user_id = (SELECT auth.uid()))
  WITH CHECK (user_id = (SELECT auth.uid()));
CREATE POLICY "Users can delete own active plans" ON public.active_plans
  FOR DELETE USING (user_id = (SELECT auth.uid()));

-- Training plans: own rows, or someone you follow
DROP POLICY IF EXISTS "Users can manage own plans" ON public.training_plans;
DROP POLICY IF EXISTS "Followers can view followed user training plans" ON public.training_plans;
DROP POLICY IF EXISTS "Users can view training plans" ON public.training_plans;
DROP POLICY IF EXISTS "Users can insert own plans" ON public.training_plans;
DROP POLICY IF EXISTS "Users can update own plans" ON public.training_plans;
DROP POLICY IF EXISTS "Users can delete own plans" ON public.training_plans;

CREATE POLICY "Users can view training plans" ON public.training_plans
  FOR SELECT USING (
    user_id = (SELECT auth.uid())
    OR EXISTS (
      SELECT 1 FROM public.follows
      WHERE follows.follower_id = (SELECT auth.uid())
      AND follows.following_id = training_plans.user_id
    )
  );
CREATE POLICY "Users can insert own plans" ON public.training_plans
  FOR INSERT WITH CHECK (user_id = (SELECT auth.uid()));
CREATE POLICY "Users can update own plans" ON public.training_plans
  FOR UPDATE
  USING (user_id = (SELECT auth.uid()))
  WITH CHECK (user_id = (SELECT auth.uid()));
CREATE POLICY "Users can delete own plans" ON public.training_plans
  FOR DELETE USING (user_id = (SELECT auth.uid()));

-- Plan days: days on your plans, or plans of someone you follow
DROP POLICY IF EXISTS "Users can manage own plan days" ON public.plan_days;
DROP POLICY IF EXISTS "Followers can view followed user plan days" ON public.plan_days;
DROP POLICY IF EXISTS "Users can view plan days" ON public.plan_days;
DROP POLICY IF EXISTS "Users can insert own plan days" ON public.plan_days;
DROP POLICY IF EXISTS "Users can update own plan days" ON public.plan_days;
DROP POLICY IF EXISTS "Users can delete own plan days" ON public.plan_days;

CREATE POLICY "Users can view plan days" ON public.plan_days
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.training_plans tp
      WHERE tp.id = plan_days.plan_id
      AND (
        tp.user_id = (SELECT auth.uid())
        OR EXISTS (
          SELECT 1 FROM public.follows
          WHERE follows.follower_id = (SELECT auth.uid())
          AND follows.following_id = tp.user_id
        )
      )
    )
  );
CREATE POLICY "Users can insert own plan days" ON public.plan_days
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.training_plans
      WHERE training_plans.id = plan_days.plan_id
      AND training_plans.user_id = (SELECT auth.uid())
    )
  );
CREATE POLICY "Users can update own plan days" ON public.plan_days
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.training_plans
      WHERE training_plans.id = plan_days.plan_id
      AND training_plans.user_id = (SELECT auth.uid())
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.training_plans
      WHERE training_plans.id = plan_days.plan_id
      AND training_plans.user_id = (SELECT auth.uid())
    )
  );
CREATE POLICY "Users can delete own plan days" ON public.plan_days
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM public.training_plans
      WHERE training_plans.id = plan_days.plan_id
      AND training_plans.user_id = (SELECT auth.uid())
    )
  );

-- Follows: everyone can read, you only write your own
DROP POLICY IF EXISTS "Users can view all follows" ON public.follows;
DROP POLICY IF EXISTS "Users can manage own follows" ON public.follows;
DROP POLICY IF EXISTS "Users can insert own follows" ON public.follows;
DROP POLICY IF EXISTS "Users can update own follows" ON public.follows;
DROP POLICY IF EXISTS "Users can delete own follows" ON public.follows;

CREATE POLICY "Users can view all follows" ON public.follows
  FOR SELECT USING (true);
CREATE POLICY "Users can insert own follows" ON public.follows
  FOR INSERT WITH CHECK (follower_id = (SELECT auth.uid()));
CREATE POLICY "Users can update own follows" ON public.follows
  FOR UPDATE
  USING (follower_id = (SELECT auth.uid()))
  WITH CHECK (follower_id = (SELECT auth.uid()));
CREATE POLICY "Users can delete own follows" ON public.follows
  FOR DELETE USING (follower_id = (SELECT auth.uid()));

-- Feed
DROP POLICY IF EXISTS "Users can view feed activities" ON public.feed_activities;
DROP POLICY IF EXISTS "Users can insert own activities" ON public.feed_activities;

CREATE POLICY "Users can view feed activities" ON public.feed_activities
  FOR SELECT USING (
    user_id = (SELECT auth.uid()) OR public.is_mutual_follow(user_id)
  );
CREATE POLICY "Users can insert own activities" ON public.feed_activities
  FOR INSERT WITH CHECK (user_id = (SELECT auth.uid()));

DROP POLICY IF EXISTS "Users can view all likes" ON public.feed_likes;
DROP POLICY IF EXISTS "Users can manage own likes" ON public.feed_likes;
DROP POLICY IF EXISTS "Users can insert own likes" ON public.feed_likes;
DROP POLICY IF EXISTS "Users can update own likes" ON public.feed_likes;
DROP POLICY IF EXISTS "Users can delete own likes" ON public.feed_likes;

CREATE POLICY "Users can view all likes" ON public.feed_likes
  FOR SELECT USING (true);
CREATE POLICY "Users can insert own likes" ON public.feed_likes
  FOR INSERT WITH CHECK (user_id = (SELECT auth.uid()));
CREATE POLICY "Users can update own likes" ON public.feed_likes
  FOR UPDATE
  USING (user_id = (SELECT auth.uid()))
  WITH CHECK (user_id = (SELECT auth.uid()));
CREATE POLICY "Users can delete own likes" ON public.feed_likes
  FOR DELETE USING (user_id = (SELECT auth.uid()));

DROP POLICY IF EXISTS "Users can view all comments" ON public.feed_comments;
DROP POLICY IF EXISTS "Users can view comments on visible activities" ON public.feed_comments;
DROP POLICY IF EXISTS "Users can manage own comments" ON public.feed_comments;
DROP POLICY IF EXISTS "Users can insert own comments" ON public.feed_comments;
DROP POLICY IF EXISTS "Users can update own comments" ON public.feed_comments;
DROP POLICY IF EXISTS "Users can delete own comments" ON public.feed_comments;

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
CREATE POLICY "Users can insert own comments" ON public.feed_comments
  FOR INSERT WITH CHECK (user_id = (SELECT auth.uid()));
CREATE POLICY "Users can update own comments" ON public.feed_comments
  FOR UPDATE
  USING (user_id = (SELECT auth.uid()))
  WITH CHECK (user_id = (SELECT auth.uid()));
CREATE POLICY "Users can delete own comments" ON public.feed_comments
  FOR DELETE USING (user_id = (SELECT auth.uid()));

-- Community plans
DROP POLICY IF EXISTS "Users can create community plans" ON public.community_plans;
DROP POLICY IF EXISTS "Authors can update own plans" ON public.community_plans;
DROP POLICY IF EXISTS "Authors can delete own plans" ON public.community_plans;

CREATE POLICY "Users can create community plans" ON public.community_plans
  FOR INSERT WITH CHECK (author_id = (SELECT auth.uid()));
CREATE POLICY "Authors can update own plans" ON public.community_plans
  FOR UPDATE
  USING (author_id = (SELECT auth.uid()))
  WITH CHECK (author_id = (SELECT auth.uid()));
CREATE POLICY "Authors can delete own plans" ON public.community_plans
  FOR DELETE USING (author_id = (SELECT auth.uid()));

DROP POLICY IF EXISTS "Users can manage own upvotes" ON public.plan_upvotes;
DROP POLICY IF EXISTS "Users can insert own upvotes" ON public.plan_upvotes;
DROP POLICY IF EXISTS "Users can update own upvotes" ON public.plan_upvotes;
DROP POLICY IF EXISTS "Users can delete own upvotes" ON public.plan_upvotes;

CREATE POLICY "Users can insert own upvotes" ON public.plan_upvotes
  FOR INSERT WITH CHECK (user_id = (SELECT auth.uid()));
CREATE POLICY "Users can update own upvotes" ON public.plan_upvotes
  FOR UPDATE
  USING (user_id = (SELECT auth.uid()))
  WITH CHECK (user_id = (SELECT auth.uid()));
CREATE POLICY "Users can delete own upvotes" ON public.plan_upvotes
  FOR DELETE USING (user_id = (SELECT auth.uid()));

DROP POLICY IF EXISTS "Users can manage own ratings" ON public.plan_ratings;
DROP POLICY IF EXISTS "Users can insert own ratings" ON public.plan_ratings;
DROP POLICY IF EXISTS "Users can update own ratings" ON public.plan_ratings;
DROP POLICY IF EXISTS "Users can delete own ratings" ON public.plan_ratings;

CREATE POLICY "Users can insert own ratings" ON public.plan_ratings
  FOR INSERT WITH CHECK (user_id = (SELECT auth.uid()));
CREATE POLICY "Users can update own ratings" ON public.plan_ratings
  FOR UPDATE
  USING (user_id = (SELECT auth.uid()))
  WITH CHECK (user_id = (SELECT auth.uid()));
CREATE POLICY "Users can delete own ratings" ON public.plan_ratings
  FOR DELETE USING (user_id = (SELECT auth.uid()));

DROP POLICY IF EXISTS "Users can create plan comments" ON public.plan_comments;
DROP POLICY IF EXISTS "Users can delete own plan comments" ON public.plan_comments;

CREATE POLICY "Users can create plan comments" ON public.plan_comments
  FOR INSERT WITH CHECK (user_id = (SELECT auth.uid()));
CREATE POLICY "Users can delete own plan comments" ON public.plan_comments
  FOR DELETE USING (user_id = (SELECT auth.uid()));

CREATE INDEX IF NOT EXISTS idx_community_plans_author ON public.community_plans(author_id);
CREATE INDEX IF NOT EXISTS idx_feed_comments_user ON public.feed_comments(user_id);
CREATE INDEX IF NOT EXISTS idx_plan_comments_user ON public.plan_comments(user_id);
CREATE INDEX IF NOT EXISTS idx_user_run_routes_run ON public.user_run_routes(run_id);
