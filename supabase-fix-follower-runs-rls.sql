-- One-way follower access to runs was replaced by mutual follows.
-- Re-running this file must not open runs back up.

DROP POLICY IF EXISTS "Followers can view followed users runs" ON public.user_runs;
DROP POLICY IF EXISTS "Followers can view followed users run routes" ON public.user_run_routes;
DROP POLICY IF EXISTS "Followers can view followed user runs" ON public.user_runs;
