import Database from '@tauri-apps/plugin-sql';
import { BUILTIN_PLANS } from '../utils/planSeedData';

let _db: Database | null = null;

// ---------------------------------------------------------------------------
// Schema
// ---------------------------------------------------------------------------

const SCHEMA = `
PRAGMA journal_mode=WAL;

CREATE TABLE IF NOT EXISTS training_plans (
  id            TEXT PRIMARY KEY,
  name          TEXT NOT NULL,
  race_type     TEXT NOT NULL,
  difficulty    TEXT NOT NULL,
  description   TEXT NOT NULL DEFAULT '',
  duration_weeks INTEGER NOT NULL,
  is_builtin    INTEGER NOT NULL DEFAULT 0,
  created_at    TEXT NOT NULL,
  updated_at    TEXT NOT NULL,
  sync_status   TEXT NOT NULL DEFAULT 'local'
);

CREATE TABLE IF NOT EXISTS plan_days (
  id              TEXT PRIMARY KEY,
  plan_id         TEXT NOT NULL REFERENCES training_plans(id) ON DELETE CASCADE,
  week_number     INTEGER NOT NULL,
  day_of_week     INTEGER NOT NULL,
  activity_type   TEXT NOT NULL,
  distance_value  REAL,
  distance_unit   TEXT NOT NULL DEFAULT 'mi',
  duration_minutes INTEGER,
  description     TEXT NOT NULL DEFAULT ''
);

CREATE TABLE IF NOT EXISTS active_plan (
  id          TEXT PRIMARY KEY,
  plan_id     TEXT NOT NULL REFERENCES training_plans(id) ON DELETE CASCADE,
  start_date  TEXT NOT NULL,
  is_active   INTEGER NOT NULL DEFAULT 1,
  created_at  TEXT NOT NULL,
  sync_status TEXT NOT NULL DEFAULT 'local'
);

CREATE TABLE IF NOT EXISTS runs (
  id              TEXT PRIMARY KEY,
  date            TEXT NOT NULL,
  distance_value  REAL NOT NULL,
  distance_unit   TEXT NOT NULL DEFAULT 'mi',
  duration_seconds INTEGER NOT NULL,
  run_type        TEXT NOT NULL DEFAULT 'easy_run',
  plan_day_id     TEXT,
  notes           TEXT NOT NULL DEFAULT '',
  source          TEXT NOT NULL DEFAULT 'manual',
  created_at      TEXT NOT NULL,
  updated_at      TEXT NOT NULL,
  sync_status     TEXT NOT NULL DEFAULT 'local'
);

CREATE TABLE IF NOT EXISTS goals (
  id           TEXT PRIMARY KEY,
  type         TEXT NOT NULL,
  target_value REAL NOT NULL,
  target_unit  TEXT NOT NULL DEFAULT 'mi',
  start_date   TEXT NOT NULL,
  end_date     TEXT NOT NULL,
  created_at   TEXT NOT NULL,
  sync_status  TEXT NOT NULL DEFAULT 'local'
);

CREATE TABLE IF NOT EXISTS settings (
  key   TEXT PRIMARY KEY,
  value TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS sync_queue (
  id         TEXT PRIMARY KEY,
  table_name TEXT NOT NULL,
  record_id  TEXT NOT NULL,
  action     TEXT NOT NULL,
  payload    TEXT NOT NULL,
  created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_runs_date       ON runs(date);
CREATE INDEX IF NOT EXISTS idx_plan_days_plan  ON plan_days(plan_id, week_number, day_of_week);
`;

// ---------------------------------------------------------------------------
// Init
// ---------------------------------------------------------------------------

export async function getDatabase(): Promise<Database> {
  if (_db) return _db;
  _db = await Database.load('sqlite:runwithfriends.db');
  await _db.execute(SCHEMA);
  await seedBuiltinPlans(_db);
  return _db;
}

// ---------------------------------------------------------------------------
// Seeding built-in plans
// ---------------------------------------------------------------------------

async function seedBuiltinPlans(db: Database): Promise<void> {
  for (const { plan, days } of BUILTIN_PLANS) {
    const existing = await db.select<{ id: string }[]>(
      'SELECT id FROM training_plans WHERE id = $1',
      [plan.id],
    );
    if (existing.length > 0) continue;

    await db.execute(
      `INSERT INTO training_plans
        (id, name, race_type, difficulty, description, duration_weeks, is_builtin, created_at, updated_at, sync_status)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)`,
      [plan.id, plan.name, plan.race_type, plan.difficulty, plan.description,
       plan.duration_weeks, plan.is_builtin, plan.created_at, plan.updated_at, plan.sync_status],
    );

    for (const day of days) {
      await db.execute(
        `INSERT INTO plan_days
          (id, plan_id, week_number, day_of_week, activity_type, distance_value, distance_unit, duration_minutes, description)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
        [day.id, day.plan_id, day.week_number, day.day_of_week, day.activity_type,
         day.distance_value, day.distance_unit, day.duration_minutes, day.description],
      );
    }
  }
}

