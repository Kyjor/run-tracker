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

// Migrations: run once per version, safe to retry (errors are swallowed)
const MIGRATIONS = [
  // v1 — add workout_segments to plan_days
  `ALTER TABLE plan_days ADD COLUMN workout_segments TEXT`,

  // v2 — health metrics on runs (heart rate)
  `ALTER TABLE runs ADD COLUMN avg_heart_rate REAL`,
  `ALTER TABLE runs ADD COLUMN max_heart_rate REAL`,
  `ALTER TABLE runs ADD COLUMN min_heart_rate REAL`,
  `ALTER TABLE runs ADD COLUMN hr_zones TEXT`,

  // v3 — cadence & form
  `ALTER TABLE runs ADD COLUMN avg_cadence REAL`,
  `ALTER TABLE runs ADD COLUMN avg_stride_length_meters REAL`,
  `ALTER TABLE runs ADD COLUMN avg_ground_contact_time_ms REAL`,
  `ALTER TABLE runs ADD COLUMN avg_vertical_oscillation_cm REAL`,

  // v4 — power
  `ALTER TABLE runs ADD COLUMN avg_power_watts REAL`,
  `ALTER TABLE runs ADD COLUMN max_power_watts REAL`,

  // v5 — elevation
  `ALTER TABLE runs ADD COLUMN elevation_gain_meters REAL`,
  `ALTER TABLE runs ADD COLUMN elevation_loss_meters REAL`,

  // v6 — fitness & environment
  `ALTER TABLE runs ADD COLUMN vo2_max REAL`,
  `ALTER TABLE runs ADD COLUMN temperature_celsius REAL`,
  `ALTER TABLE runs ADD COLUMN humidity_percent REAL`,
  `ALTER TABLE runs ADD COLUMN weather_condition TEXT`,
  `ALTER TABLE runs ADD COLUMN calories REAL`,
  `ALTER TABLE runs ADD COLUMN has_route INTEGER NOT NULL DEFAULT 0`,

  // v7 — GPS route table
  `CREATE TABLE IF NOT EXISTS run_routes (
    id         TEXT PRIMARY KEY,
    run_id     TEXT NOT NULL REFERENCES runs(id) ON DELETE CASCADE,
    points_json TEXT NOT NULL,
    created_at TEXT NOT NULL
  )`,
  `CREATE INDEX IF NOT EXISTS idx_run_routes_run ON run_routes(run_id)`,

  // v8 — Convert runs.date from date-only (YYYY-MM-DD) to datetime (ISO 8601)
  // Convert existing date-only values to datetime by appending time from created_at
  `UPDATE runs SET date = date || 'T' || substr(created_at, 12, 8) || 'Z' WHERE length(date) = 10 AND date NOT LIKE '%T%'`,
  // For any remaining date-only values (if created_at doesn't have time), use noon UTC
  `UPDATE runs SET date = date || 'T12:00:00Z' WHERE length(date) = 10 AND date NOT LIKE '%T%'`,
];

// ---------------------------------------------------------------------------
// Init
// ---------------------------------------------------------------------------

export async function getDatabase(): Promise<Database> {
  if (_db) return _db;
  _db = await Database.load('sqlite:runwithfriends.db');
  await _db.execute(SCHEMA);
  for (const sql of MIGRATIONS) {
    try { await _db.execute(sql); } catch { /* already applied */ }
  }
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

