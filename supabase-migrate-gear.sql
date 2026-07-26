-- Gear tracking tables (mirror local SQLite gear / run_gear).
-- Run in Supabase SQL editor.

CREATE TABLE IF NOT EXISTS user_gear (
  id TEXT PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  type TEXT NOT NULL CHECK (type IN ('shoes', 'heart_rate_monitor', 'watch', 'bike', 'other')),
  name TEXT NOT NULL,
  brand TEXT,
  model TEXT,
  purchase_date TEXT,
  notes TEXT NOT NULL DEFAULT '',
  is_active BOOLEAN NOT NULL DEFAULT true,
  retired_at TIMESTAMPTZ,
  alert_threshold_mi REAL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(user_id, id)
);

CREATE TABLE IF NOT EXISTS user_run_gear (
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  run_id TEXT NOT NULL,
  gear_id TEXT NOT NULL,
  PRIMARY KEY (user_id, run_id, gear_id)
);

CREATE INDEX IF NOT EXISTS idx_user_gear_user ON user_gear(user_id);
CREATE INDEX IF NOT EXISTS idx_user_run_gear_run ON user_run_gear(user_id, run_id);

ALTER TABLE user_gear ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_run_gear ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own gear" ON user_gear
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users manage own run gear" ON user_run_gear
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
