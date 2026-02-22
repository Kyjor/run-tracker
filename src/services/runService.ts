import type Database from '@tauri-apps/plugin-sql';
import type { Run, RunType, DistanceUnit } from '../types';
import { generateId } from '../utils/generateId';

export interface CreateRunInput {
  date: string;
  distance_value: number;
  distance_unit: DistanceUnit;
  duration_seconds: number;
  run_type: RunType;
  plan_day_id?: string | null;
  notes?: string;
  source?: 'manual' | 'healthkit';
}

export async function getRuns(db: Database, limit = 200): Promise<Run[]> {
  return db.select<Run[]>(
    'SELECT * FROM runs ORDER BY date DESC, created_at DESC LIMIT $1',
    [limit],
  );
}

export async function getRunsByDateRange(
  db: Database,
  startDate: string,
  endDate: string,
): Promise<Run[]> {
  return db.select<Run[]>(
    'SELECT * FROM runs WHERE date >= $1 AND date <= $2 ORDER BY date DESC',
    [startDate, endDate],
  );
}

export async function getRunsForDate(db: Database, date: string): Promise<Run[]> {
  return db.select<Run[]>(
    "SELECT * FROM runs WHERE date = $1 ORDER BY created_at",
    [date],
  );
}

export async function getRunById(db: Database, id: string): Promise<Run | null> {
  const rows = await db.select<Run[]>('SELECT * FROM runs WHERE id = $1', [id]);
  return rows[0] ?? null;
}

export async function createRun(db: Database, input: CreateRunInput): Promise<Run> {
  const id = generateId();
  const now = new Date().toISOString();
  const run: Run = {
    id,
    date: input.date,
    distance_value: input.distance_value,
    distance_unit: input.distance_unit,
    duration_seconds: input.duration_seconds,
    run_type: input.run_type,
    plan_day_id: input.plan_day_id ?? null,
    notes: input.notes ?? '',
    source: input.source ?? 'manual',
    created_at: now,
    updated_at: now,
    sync_status: 'local',
  };

  await db.execute(
    `INSERT INTO runs
      (id, date, distance_value, distance_unit, duration_seconds, run_type, plan_day_id, notes, source, created_at, updated_at, sync_status)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$10,'local')`,
    [run.id, run.date, run.distance_value, run.distance_unit, run.duration_seconds,
     run.run_type, run.plan_day_id, run.notes, run.source, now],
  );

  return run;
}

export async function updateRun(
  db: Database,
  id: string,
  updates: Partial<Omit<Run, 'id' | 'created_at'>>,
): Promise<void> {
  const now = new Date().toISOString();
  const fields = Object.keys(updates)
    .filter(k => k !== 'id' && k !== 'created_at')
    .map((k, i) => `${k}=$${i + 2}`)
    .join(', ');

  if (!fields) return;

  await db.execute(
    `UPDATE runs SET ${fields}, updated_at='${now}', sync_status='dirty' WHERE id=$1`,
    [id, ...Object.values(updates)],
  );
}

export async function deleteRun(db: Database, id: string): Promise<void> {
  await db.execute('DELETE FROM runs WHERE id = $1', [id]);
}

/** Returns the plan_day_id that a run was logged for, or null */
export async function getRunForPlanDay(db: Database, planDayId: string): Promise<Run | null> {
  const rows = await db.select<Run[]>(
    'SELECT * FROM runs WHERE plan_day_id = $1 LIMIT 1',
    [planDayId],
  );
  return rows[0] ?? null;
}

