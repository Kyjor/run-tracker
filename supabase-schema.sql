-- ============================================================
-- Run With Friends - Supabase Database Schema
-- ============================================================
-- Run this in your Supabase SQL Editor to set up all tables,
-- RLS policies, triggers, and functions.
-- ============================================================

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================================
-- 1. Profiles (extends Supabase auth.users)
-- ============================================================

CREATE TABLE IF NOT EXISTS profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  display_name TEXT NOT NULL,
  email TEXT NOT NULL,
  avatar_url TEXT,
  units_preference TEXT NOT NULL DEFAULT 'mi' CHECK (units_preference IN ('mi', 'km')),
  is_public BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Auto-create profile on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, display_name, email)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'display_name', split_part(NEW.email, '@', 1)),
    NEW.email
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ============================================================
-- 2. Cloud Sync Tables (mirror local SQLite)
-- ============================================================

-- User Runs
CREATE TABLE IF NOT EXISTS user_runs (
  id TEXT PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  distance_value REAL NOT NULL,
  distance_unit TEXT NOT NULL CHECK (distance_unit IN ('mi', 'km')),
  duration_seconds INTEGER NOT NULL,
  run_type TEXT NOT NULL CHECK (run_type IN ('easy_run', 'pace_run', 'tempo_run', 'long_run', 'intervals', 'race', 'other')),
  plan_day_id TEXT,
  notes TEXT NOT NULL DEFAULT '',
  source TEXT NOT NULL DEFAULT 'manual' CHECK (source IN ('manual', 'healthkit')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(user_id, id)
);

-- User Goals
CREATE TABLE IF NOT EXISTS user_goals (
  id TEXT PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  type TEXT NOT NULL CHECK (type IN ('weekly', 'monthly')),
  target_value REAL NOT NULL,
  target_unit TEXT NOT NULL CHECK (target_unit IN ('mi', 'km')),
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(user_id, id)
);

-- Active Plans
CREATE TABLE IF NOT EXISTS active_plans (
  id TEXT PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  plan_id TEXT NOT NULL,
  start_date DATE NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(user_id, id)
);

-- Custom Training Plans (user-created, synced)
CREATE TABLE IF NOT EXISTS training_plans (
  id TEXT PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  race_type TEXT NOT NULL CHECK (race_type IN ('5k', '10k', 'half_marathon', 'full_marathon', 'other')),
  difficulty TEXT NOT NULL CHECK (difficulty IN ('beginner', 'intermediate', 'advanced', 'custom')),
  description TEXT NOT NULL DEFAULT '',
  duration_weeks INTEGER NOT NULL,
  is_builtin BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(user_id, id)
);

-- Plan Days (for custom plans only)
CREATE TABLE IF NOT EXISTS plan_days (
  id TEXT PRIMARY KEY,
  plan_id TEXT NOT NULL REFERENCES training_plans(id) ON DELETE CASCADE,
  week_number INTEGER NOT NULL,
  day_of_week INTEGER NOT NULL CHECK (day_of_week BETWEEN 0 AND 6),
  activity_type TEXT NOT NULL CHECK (activity_type IN ('rest', 'cross_training', 'easy_run', 'pace_run', 'tempo_run', 'long_run', 'intervals', 'race')),
  distance_value REAL,
  distance_unit TEXT NOT NULL DEFAULT 'mi' CHECK (distance_unit IN ('mi', 'km')),
  duration_minutes INTEGER,
  description TEXT NOT NULL DEFAULT '',
  workout_segments TEXT, -- JSON-encoded WorkoutSegment[]
  UNIQUE(plan_id, week_number, day_of_week)
);

-- ============================================================
-- 3. Social Features
-- ============================================================

-- Follows
CREATE TABLE IF NOT EXISTS follows (
  follower_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  following_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (follower_id, following_id),
  CHECK (follower_id != following_id)
);

-- Activity Feed
CREATE TABLE IF NOT EXISTS feed_activities (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  activity_type TEXT NOT NULL CHECK (activity_type IN ('run_completed', 'plan_started', 'plan_completed', 'goal_achieved', 'streak_milestone')),
  data JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Feed Likes
CREATE TABLE IF NOT EXISTS feed_likes (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  activity_id UUID NOT NULL REFERENCES feed_activities(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(user_id, activity_id)
);

-- Feed Comments
CREATE TABLE IF NOT EXISTS feed_comments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  activity_id UUID NOT NULL REFERENCES feed_activities(id) ON DELETE CASCADE,
  text TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- 4. Community Plans
-- ============================================================

CREATE TABLE IF NOT EXISTS community_plans (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  author_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  plan_data JSONB NOT NULL, -- Full PlanExportFormat JSON
  name TEXT NOT NULL,
  race_type TEXT NOT NULL CHECK (race_type IN ('5k', '10k', 'half_marathon', 'full_marathon', 'other')),
  difficulty TEXT NOT NULL CHECK (difficulty IN ('beginner', 'intermediate', 'advanced', 'custom')),
  description TEXT NOT NULL,
  duration_weeks INTEGER NOT NULL,
  upvote_count INTEGER NOT NULL DEFAULT 0,
  avg_rating REAL,
  rating_count INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Plan Upvotes
CREATE TABLE IF NOT EXISTS plan_upvotes (
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  plan_id UUID NOT NULL REFERENCES community_plans(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (user_id, plan_id)
);

-- Plan Ratings (1-5 stars)
CREATE TABLE IF NOT EXISTS plan_ratings (
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  plan_id UUID NOT NULL REFERENCES community_plans(id) ON DELETE CASCADE,
  rating INTEGER NOT NULL CHECK (rating BETWEEN 1 AND 5),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (user_id, plan_id)
);

-- Plan Comments
CREATE TABLE IF NOT EXISTS plan_comments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  plan_id UUID NOT NULL REFERENCES community_plans(id) ON DELETE CASCADE,
  text TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- 5. Indexes
-- ============================================================

CREATE INDEX IF NOT EXISTS idx_user_runs_user_date ON user_runs(user_id, date DESC);
CREATE INDEX IF NOT EXISTS idx_user_goals_user ON user_goals(user_id);
CREATE INDEX IF NOT EXISTS idx_active_plans_user ON active_plans(user_id);
CREATE INDEX IF NOT EXISTS idx_training_plans_user ON training_plans(user_id);
CREATE INDEX IF NOT EXISTS idx_plan_days_plan ON plan_days(plan_id, week_number, day_of_week);
CREATE INDEX IF NOT EXISTS idx_follows_follower ON follows(follower_id);
CREATE INDEX IF NOT EXISTS idx_follows_following ON follows(following_id);
CREATE INDEX IF NOT EXISTS idx_feed_activities_user ON feed_activities(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_feed_likes_activity ON feed_likes(activity_id);
CREATE INDEX IF NOT EXISTS idx_feed_comments_activity ON feed_comments(activity_id);
CREATE INDEX IF NOT EXISTS idx_community_plans_race ON community_plans(race_type, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_plan_upvotes_plan ON plan_upvotes(plan_id);
CREATE INDEX IF NOT EXISTS idx_plan_ratings_plan ON plan_ratings(plan_id);
CREATE INDEX IF NOT EXISTS idx_plan_comments_plan ON plan_comments(plan_id);

-- ============================================================
-- 6. Triggers & Functions
-- ============================================================

-- Update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_profiles_updated_at BEFORE UPDATE ON profiles
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER update_user_runs_updated_at BEFORE UPDATE ON user_runs
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER update_training_plans_updated_at BEFORE UPDATE ON training_plans
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER update_community_plans_updated_at BEFORE UPDATE ON community_plans
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER update_plan_ratings_updated_at BEFORE UPDATE ON plan_ratings
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- Update community_plans.upvote_count when upvotes change
CREATE OR REPLACE FUNCTION update_plan_upvote_count()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE community_plans SET upvote_count = upvote_count + 1 WHERE id = NEW.plan_id;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE community_plans SET upvote_count = GREATEST(0, upvote_count - 1) WHERE id = OLD.plan_id;
  END IF;
  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_upvote_count_on_insert
  AFTER INSERT ON plan_upvotes
  FOR EACH ROW EXECUTE FUNCTION update_plan_upvote_count();

CREATE TRIGGER update_upvote_count_on_delete
  AFTER DELETE ON plan_upvotes
  FOR EACH ROW EXECUTE FUNCTION update_plan_upvote_count();

-- Update community_plans.avg_rating and rating_count when ratings change
CREATE OR REPLACE FUNCTION update_plan_rating_stats()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' OR TG_OP = 'UPDATE' THEN
    UPDATE community_plans
    SET
      rating_count = (SELECT COUNT(*) FROM plan_ratings WHERE plan_id = NEW.plan_id),
      avg_rating = (SELECT AVG(rating)::REAL FROM plan_ratings WHERE plan_id = NEW.plan_id)
    WHERE id = NEW.plan_id;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE community_plans
    SET
      rating_count = (SELECT COUNT(*) FROM plan_ratings WHERE plan_id = OLD.plan_id),
      avg_rating = COALESCE((SELECT AVG(rating)::REAL FROM plan_ratings WHERE plan_id = OLD.plan_id), 0)
    WHERE id = OLD.plan_id;
  END IF;
  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_rating_stats_on_insert
  AFTER INSERT ON plan_ratings
  FOR EACH ROW EXECUTE FUNCTION update_plan_rating_stats();

CREATE TRIGGER update_rating_stats_on_update
  AFTER UPDATE ON plan_ratings
  FOR EACH ROW EXECUTE FUNCTION update_plan_rating_stats();

CREATE TRIGGER update_rating_stats_on_delete
  AFTER DELETE ON plan_ratings
  FOR EACH ROW EXECUTE FUNCTION update_plan_rating_stats();

-- ============================================================
-- 7. Row Level Security (RLS)
-- ============================================================

-- Enable RLS on all tables
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_runs ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_goals ENABLE ROW LEVEL SECURITY;
ALTER TABLE active_plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE training_plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE plan_days ENABLE ROW LEVEL SECURITY;
ALTER TABLE follows ENABLE ROW LEVEL SECURITY;
ALTER TABLE feed_activities ENABLE ROW LEVEL SECURITY;
ALTER TABLE feed_likes ENABLE ROW LEVEL SECURITY;
ALTER TABLE feed_comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE community_plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE plan_upvotes ENABLE ROW LEVEL SECURITY;
ALTER TABLE plan_ratings ENABLE ROW LEVEL SECURITY;
ALTER TABLE plan_comments ENABLE ROW LEVEL SECURITY;

-- Profiles: users can read their own or public profiles, update their own
CREATE POLICY "Users can view own profile" ON profiles
  FOR SELECT USING (auth.uid() = id);
CREATE POLICY "Users can view public profiles" ON profiles
  FOR SELECT USING (is_public = true);
CREATE POLICY "Users can update own profile" ON profiles
  FOR UPDATE USING (auth.uid() = id);
CREATE POLICY "Users can insert own profile" ON profiles
  FOR INSERT WITH CHECK (auth.uid() = id);

-- User Runs: users can only access their own
CREATE POLICY "Users can manage own runs" ON user_runs
  FOR ALL USING (auth.uid() = user_id);

-- User Goals: users can only access their own
CREATE POLICY "Users can manage own goals" ON user_goals
  FOR ALL USING (auth.uid() = user_id);

-- Active Plans: users can only access their own
CREATE POLICY "Users can manage own active plans" ON active_plans
  FOR ALL USING (auth.uid() = user_id);

-- Training Plans: users can only access their own custom plans
CREATE POLICY "Users can manage own plans" ON training_plans
  FOR ALL USING (auth.uid() = user_id);

-- Plan Days: users can only access days of their own plans
CREATE POLICY "Users can manage own plan days" ON plan_days
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM training_plans
      WHERE training_plans.id = plan_days.plan_id
      AND training_plans.user_id = auth.uid()
    )
  );

-- Follows: users can view all, but only manage their own
CREATE POLICY "Users can view all follows" ON follows
  FOR SELECT USING (true);
CREATE POLICY "Users can manage own follows" ON follows
  FOR ALL USING (auth.uid() = follower_id);

-- Feed Activities: users can view activities from people they follow or their own
CREATE POLICY "Users can view feed activities" ON feed_activities
  FOR SELECT USING (
    user_id = auth.uid() OR
    EXISTS (
      SELECT 1 FROM follows
      WHERE follows.follower_id = auth.uid()
      AND follows.following_id = feed_activities.user_id
    )
  );
CREATE POLICY "Users can insert own activities" ON feed_activities
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Feed Likes: users can view all, manage their own
CREATE POLICY "Users can view all likes" ON feed_likes
  FOR SELECT USING (true);
CREATE POLICY "Users can manage own likes" ON feed_likes
  FOR ALL USING (auth.uid() = user_id);

-- Feed Comments: users can view all, manage their own
CREATE POLICY "Users can view all comments" ON feed_comments
  FOR SELECT USING (true);
CREATE POLICY "Users can manage own comments" ON feed_comments
  FOR ALL USING (auth.uid() = user_id);

-- Community Plans: everyone can read, authors can update/delete
CREATE POLICY "Everyone can view community plans" ON community_plans
  FOR SELECT USING (true);
CREATE POLICY "Users can create community plans" ON community_plans
  FOR INSERT WITH CHECK (auth.uid() = author_id);
CREATE POLICY "Authors can update own plans" ON community_plans
  FOR UPDATE USING (auth.uid() = author_id);
CREATE POLICY "Authors can delete own plans" ON community_plans
  FOR DELETE USING (auth.uid() = author_id);

-- Plan Upvotes: everyone can view, users can manage their own
CREATE POLICY "Everyone can view upvotes" ON plan_upvotes
  FOR SELECT USING (true);
CREATE POLICY "Users can manage own upvotes" ON plan_upvotes
  FOR ALL USING (auth.uid() = user_id);

-- Plan Ratings: everyone can view, users can manage their own
CREATE POLICY "Everyone can view ratings" ON plan_ratings
  FOR SELECT USING (true);
CREATE POLICY "Users can manage own ratings" ON plan_ratings
  FOR ALL USING (auth.uid() = user_id);

-- Plan Comments: everyone can view, users can manage their own
CREATE POLICY "Everyone can view plan comments" ON plan_comments
  FOR SELECT USING (true);
CREATE POLICY "Users can create plan comments" ON plan_comments
  FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can delete own plan comments" ON plan_comments
  FOR DELETE USING (auth.uid() = user_id);

-- ============================================================
-- Done! Your Supabase database is ready.
-- ============================================================
-- Next steps:
-- 1. Set up your Supabase project
-- 2. Copy VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY to .env
-- 3. Test authentication and sync
-- ============================================================

