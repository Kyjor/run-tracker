import type Database from '@tauri-apps/plugin-sql';
import type { Run, RunType, DistanceUnit } from '../types';
import { generateId } from '../utils/generateId';
import { supabase } from './supabaseClient';
import { dateToDatetime } from '../utils/dateUtils';

// ---------------------------------------------------------------------------
// Input types
// ---------------------------------------------------------------------------

export interface CreateRunInput {
  // Core
  id?: string;  // optional — supply for HealthKit imports to use the HK UUID
  date: string;
  distance_value: number;
  distance_unit: DistanceUnit;
  duration_seconds: number;
  run_type: RunType;
  plan_day_id?: string | null;
  notes?: string;
  source?: 'manual' | 'healthkit';

  // Heart Rate
  avg_heart_rate?: number | null;
  max_heart_rate?: number | null;
  min_heart_rate?: number | null;
  hr_zones?: string | null;

  // Cadence & Form
  avg_cadence?: number | null;
  avg_stride_length_meters?: number | null;
  avg_ground_contact_time_ms?: number | null;
  avg_vertical_oscillation_cm?: number | null;

  // Power
  avg_power_watts?: number | null;
  max_power_watts?: number | null;

  // Elevation
  elevation_gain_meters?: number | null;
  elevation_loss_meters?: number | null;

  // Fitness
  vo2_max?: number | null;

  // Environment
  temperature_celsius?: number | null;
  humidity_percent?: number | null;
  weather_condition?: string | null;

  // Calories
  calories?: number | null;

  // Route
  has_route?: number;
}

// ---------------------------------------------------------------------------
// Queries
// ---------------------------------------------------------------------------

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
  // Convert date-only inputs to datetime range for comparison
  const startDatetime = startDate.includes('T') ? startDate : `${startDate}T00:00:00Z`;
  const endDatetime = endDate.includes('T') ? endDate : `${endDate}T23:59:59Z`;
  return db.select<Run[]>(
    'SELECT * FROM runs WHERE date >= $1 AND date <= $2 ORDER BY date DESC',
    [startDatetime, endDatetime],
  );
}

export async function getRunsForDate(db: Database, date: string): Promise<Run[]> {
  // Extract date portion from datetime for comparison
  // Use DATE() function or substring to match date portion
  return db.select<Run[]>(
    "SELECT * FROM runs WHERE substr(date, 1, 10) = $1 ORDER BY date ASC",
    [date.length === 10 ? date : date.split('T')[0]],
  );
}

export async function getRunById(db: Database, id: string): Promise<Run | null> {
  const rows = await db.select<Run[]>('SELECT * FROM runs WHERE id = $1', [id]);
  return rows[0] ?? null;
}

// ---------------------------------------------------------------------------
// Create
// ---------------------------------------------------------------------------

export async function createRun(db: Database, input: CreateRunInput): Promise<Run> {
  const id = input.id ?? generateId();
  const now = new Date().toISOString();
  
  // For HealthKit imports, always use the provided datetime as-is (it's already ISO 8601 from HealthKit)
  // For manual entries, convert date-only to datetime (use current time if not provided)
  const runDate = input.source === 'healthkit' || input.date.includes('T')
    ? input.date 
    : dateToDatetime(input.date, new Date().toISOString().split('T')[1].split('.')[0] + 'Z');

  const run: Run = {
    id,
    date: runDate,
    distance_value: input.distance_value,
    distance_unit: input.distance_unit,
    duration_seconds: input.duration_seconds,
    run_type: input.run_type,
    plan_day_id: input.plan_day_id ?? null,
    notes: input.notes ?? '',
    source: input.source ?? 'manual',

    avg_heart_rate: input.avg_heart_rate ?? null,
    max_heart_rate: input.max_heart_rate ?? null,
    min_heart_rate: input.min_heart_rate ?? null,
    hr_zones: input.hr_zones ?? null,

    avg_cadence: input.avg_cadence ?? null,
    avg_stride_length_meters: input.avg_stride_length_meters ?? null,
    avg_ground_contact_time_ms: input.avg_ground_contact_time_ms ?? null,
    avg_vertical_oscillation_cm: input.avg_vertical_oscillation_cm ?? null,

    avg_power_watts: input.avg_power_watts ?? null,
    max_power_watts: input.max_power_watts ?? null,

    elevation_gain_meters: input.elevation_gain_meters ?? null,
    elevation_loss_meters: input.elevation_loss_meters ?? null,

    vo2_max: input.vo2_max ?? null,

    temperature_celsius: input.temperature_celsius ?? null,
    humidity_percent: input.humidity_percent ?? null,
    weather_condition: input.weather_condition ?? null,

    calories: input.calories ?? null,
    has_route: input.has_route ?? 0,

    created_at: now,
    updated_at: now,
    sync_status: 'local',
  };

  await db.execute(
    `INSERT INTO runs (
      id, date, distance_value, distance_unit, duration_seconds, run_type,
      plan_day_id, notes, source,
      avg_heart_rate, max_heart_rate, min_heart_rate, hr_zones,
      avg_cadence, avg_stride_length_meters, avg_ground_contact_time_ms, avg_vertical_oscillation_cm,
      avg_power_watts, max_power_watts,
      elevation_gain_meters, elevation_loss_meters,
      vo2_max,
      temperature_celsius, humidity_percent, weather_condition,
      calories, has_route,
      created_at, updated_at, sync_status
    ) VALUES (
      $1,$2,$3,$4,$5,$6,
      $7,$8,$9,
      $10,$11,$12,$13,
      $14,$15,$16,$17,
      $18,$19,
      $20,$21,
      $22,
      $23,$24,$25,
      $26,$27,
      $28,$28,'local'
    )`,
    [
      run.id, run.date, run.distance_value, run.distance_unit, run.duration_seconds, run.run_type,
      run.plan_day_id, run.notes, run.source,
      run.avg_heart_rate, run.max_heart_rate, run.min_heart_rate, run.hr_zones,
      run.avg_cadence, run.avg_stride_length_meters, run.avg_ground_contact_time_ms, run.avg_vertical_oscillation_cm,
      run.avg_power_watts, run.max_power_watts,
      run.elevation_gain_meters, run.elevation_loss_meters,
      run.vo2_max,
      run.temperature_celsius, run.humidity_percent, run.weather_condition,
      run.calories, run.has_route,
      now,
    ],
  );

  return run;
}

// ---------------------------------------------------------------------------
// Update
// ---------------------------------------------------------------------------

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

// ---------------------------------------------------------------------------
// Delete
// ---------------------------------------------------------------------------

export async function deleteRun(db: Database, id: string): Promise<void> {
  // Check if run is synced to Supabase before deleting locally
  const runs = await db.select<Run[]>('SELECT sync_status FROM runs WHERE id = $1', [id]);
  const run = runs[0];
  
  // If run is synced, try to delete from Supabase first
  if (run && run.sync_status === 'synced') {
    const { data: { session } } = await supabase.auth.getSession();
    if (session) {
      const { error } = await supabase
        .from('user_runs')
        .delete()
        .eq('id', id)
        .eq('user_id', session.user.id);
      
      if (error) {
        // If delete fails (e.g., offline), queue it for later sync
        console.warn('Failed to delete run from Supabase, queueing for later:', error);
        const queueId = generateId();
        const now = new Date().toISOString();
        await db.execute(
          `INSERT INTO sync_queue (id, table_name, record_id, action, payload, created_at)
           VALUES ($1, $2, $3, $4, $5, $6)`,
          [queueId, 'user_runs', id, 'delete', JSON.stringify({ id }), now]
        );
      }
    } else {
      // Not authenticated, queue the delete
      const queueId = generateId();
      const now = new Date().toISOString();
      await db.execute(
        `INSERT INTO sync_queue (id, table_name, record_id, action, payload, created_at)
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [queueId, 'user_runs', id, 'delete', JSON.stringify({ id }), now]
      );
    }
  }
  
  // Delete locally (always delete locally, even if cloud delete failed)
  await db.execute('DELETE FROM runs WHERE id = $1', [id]);
}

/** Returns the run logged for a specific plan day, or null. */
export async function getRunForPlanDay(db: Database, planDayId: string): Promise<Run | null> {
  const rows = await db.select<Run[]>(
    'SELECT * FROM runs WHERE plan_day_id = $1 LIMIT 1',
    [planDayId],
  );
  return rows[0] ?? null;
}
