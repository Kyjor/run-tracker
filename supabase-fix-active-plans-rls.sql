-- Active plans are visible to you and to mutual follows.
-- Re-running this file must not restore one-way follower access.

DROP POLICY IF EXISTS "Followers can view followed user active plans" ON public.active_plans;
DROP POLICY IF EXISTS "Users can view own or followed active plans" ON public.active_plans;
