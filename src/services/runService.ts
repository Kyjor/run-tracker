import type Database from '@tauri-apps/plugin-sql';
import type { HRZones, Run, RunType, DistanceUnit, RoutePoint } from '../types';
import { generateId } from '../utils/generateId';
import { dateToDatetime } from '../utils/dateUtils';
import { convertDistance } from '../utils/paceUtils';

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
  effort?: number | null;
  source?: 'manual' | 'healthkit' | 'fit' | 'live';

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

/** Paginated runs, optionally scoped to a date range (omit both for all-time). */
export async function getRunsPaginated(
  db: Database,
  options: {
    startDate?: string;
    endDate?: string;
    limit?: number;
    offset?: number;
  } = {},
): Promise<Run[]> {
  const limit = options.limit ?? 20;
  const offset = options.offset ?? 0;
  const { startDate, endDate } = options;

  if (startDate && endDate) {
    const startDatetime = startDate.includes('T') ? startDate : `${startDate}T00:00:00Z`;
    const endDatetime = endDate.includes('T') ? endDate : `${endDate}T23:59:59Z`;
    return db.select<Run[]>(
      'SELECT * FROM runs WHERE date >= $1 AND date <= $2 ORDER BY date DESC, created_at DESC LIMIT $3 OFFSET $4',
      [startDatetime, endDatetime, limit, offset],
    );
  }

  return db.select<Run[]>(
    'SELECT * FROM runs ORDER BY date DESC, created_at DESC LIMIT $1 OFFSET $2',
    [limit, offset],
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
    effort: input.effort ?? null,
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
    hero_json: null,

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
      calories, has_route, effort,
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
      $26,$27,$28,
      $29,$29,'local'
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
      run.calories, run.has_route, run.effort,
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
  const runs = await db.select<Run[]>('SELECT sync_status FROM runs WHERE id = $1', [id]);
  const run = runs[0];

  // Cloud may have the row if it was synced or edited after sync (dirty)
  if (run && (run.sync_status === 'synced' || run.sync_status === 'dirty')) {
    const { deleteFromCloudOrQueue } = await import('./syncService');
    await deleteFromCloudOrQueue(db, 'user_runs', id, async (userId) => {
      const { supabase } = await import('./supabaseClient');
      await supabase.from('user_run_gear').delete().eq('user_id', userId).eq('run_id', id);
      await supabase.from('user_run_routes').delete().eq('user_id', userId).eq('run_id', id);
    });
  }

  await db.execute('DELETE FROM runs WHERE id = $1', [id]);
}

/** Fetch GPS route points for a run, if any exist. */
export async function getRouteForRun(db: Database, runId: string): Promise<RoutePoint[] | null> {
  const rows = await db.select<{ points_json: string }[]>(
    'SELECT points_json FROM run_routes WHERE run_id = $1 LIMIT 1',
    [runId],
  );
  const raw = rows[0]?.points_json;
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as RoutePoint[];
    return Array.isArray(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

function weightedAverage(parts: { value: number | null; seconds: number }[]): number | null {
  let total = 0;
  let weight = 0;
  for (const part of parts) {
    if (part.value == null || part.seconds <= 0) continue;
    total += part.value * part.seconds;
    weight += part.seconds;
  }
  return weight > 0 ? total / weight : null;
}

function roundTo(value: number | null, digits: number): number | null {
  if (value == null) return null;
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
}

function sumPresent(values: Array<number | null>): number | null {
  const present = values.filter((value): value is number => value != null);
  if (present.length === 0) return null;
  return present.reduce((sum, value) => sum + value, 0);
}

function extreme(values: Array<number | null>, pick: 'min' | 'max'): number | null {
  const present = values.filter((value): value is number => value != null);
  if (present.length === 0) return null;
  return pick === 'min' ? Math.min(...present) : Math.max(...present);
}

function sumZones(runs: Run[]): string | null {
  const keys: (keyof HRZones)[] = ['z1_seconds', 'z2_seconds', 'z3_seconds', 'z4_seconds', 'z5_seconds'];
  const totals: HRZones = { z1_seconds: 0, z2_seconds: 0, z3_seconds: 0, z4_seconds: 0, z5_seconds: 0 };
  let found = false;
  for (const run of runs) {
    if (!run.hr_zones) continue;
    try {
      const parsed = JSON.parse(run.hr_zones) as Partial<HRZones>;
      found = true;
      for (const key of keys) totals[key] += parsed[key] ?? 0;
    } catch {
      // Ignore a bad zone blob and keep the others.
    }
  }
  return found ? JSON.stringify(totals) : null;
}

/**
 * Fold other runs into `keepId` in the order they were started, then delete them.
 * Distance, time, elevation, and calories add up. Heart rate, cadence, and power
 * are averaged by time. GPS points are concatenated.
 */
export async function mergeRuns(db: Database, keepId: string, appendIds: string[]): Promise<void> {
  const ids = [...new Set(appendIds.filter(id => id && id !== keepId))];
  if (ids.length === 0) return;

  const keep = await getRunById(db, keepId);
  if (!keep) throw new Error('Run not found');
  const others: Run[] = [];
  for (const id of ids) {
    const run = await getRunById(db, id);
    if (run) others.push(run);
  }
  if (others.length === 0) return;

  const ordered = [keep, ...others].sort((a, b) => a.date.localeCompare(b.date));
  const unit = keep.distance_unit;
  const distance = ordered.reduce(
    (sum, run) => sum + convertDistance(run.distance_value, run.distance_unit, unit),
    0,
  );
  const duration = ordered.reduce((sum, run) => sum + (run.duration_seconds || 0), 0);
  const parts = ordered.map(run => ({ seconds: run.duration_seconds || 0 }));
  const weighted = (pick: (run: Run) => number | null) =>
    weightedAverage(ordered.map((run, i) => ({ value: pick(run), seconds: parts[i].seconds })));

  const effort = weighted(run => run.effort);
  const notes = [...new Set(ordered.map(run => run.notes.trim()).filter(Boolean))].join('\n');
  const earliest = ordered[0];
  const latestWithVo2 = [...ordered].reverse().find(run => run.vo2_max != null);

  const points: RoutePoint[] = [];
  for (const run of ordered) {
    const route = await getRouteForRun(db, run.id);
    if (route) points.push(...route);
  }
  if (points.every(point => point.t != null)) {
    points.sort((a, b) => (a.t ?? 0) - (b.t ?? 0));
  }

  await updateRun(db, keepId, {
    date: earliest.date,
    distance_value: roundTo(distance, 2) ?? distance,
    duration_seconds: duration,
    notes,
    effort: effort == null ? null : Math.min(5, Math.max(1, Math.round(effort))),
    plan_day_id: keep.plan_day_id ?? earliest.plan_day_id,
    avg_heart_rate: roundTo(weighted(run => run.avg_heart_rate), 0),
    max_heart_rate: extreme(ordered.map(run => run.max_heart_rate), 'max'),
    min_heart_rate: extreme(ordered.map(run => run.min_heart_rate), 'min'),
    hr_zones: sumZones(ordered),
    avg_cadence: roundTo(weighted(run => run.avg_cadence), 0),
    avg_stride_length_meters: roundTo(weighted(run => run.avg_stride_length_meters), 2),
    avg_ground_contact_time_ms: roundTo(weighted(run => run.avg_ground_contact_time_ms), 0),
    avg_vertical_oscillation_cm: roundTo(weighted(run => run.avg_vertical_oscillation_cm), 1),
    avg_power_watts: roundTo(weighted(run => run.avg_power_watts), 0),
    max_power_watts: extreme(ordered.map(run => run.max_power_watts), 'max'),
    elevation_gain_meters: roundTo(sumPresent(ordered.map(run => run.elevation_gain_meters)), 1),
    elevation_loss_meters: roundTo(sumPresent(ordered.map(run => run.elevation_loss_meters)), 1),
    vo2_max: latestWithVo2?.vo2_max ?? null,
    temperature_celsius: earliest.temperature_celsius,
    humidity_percent: earliest.humidity_percent,
    weather_condition: earliest.weather_condition,
    calories: roundTo(sumPresent(ordered.map(run => run.calories)), 0),
    has_route: points.length >= 2 ? 1 : keep.has_route,
  });

  if (points.length >= 2) {
    const existing = await db.select<{ id: string }[]>(
      'SELECT id FROM run_routes WHERE run_id = $1 LIMIT 1',
      [keepId],
    );
    const json = JSON.stringify(points);
    if (existing[0]) {
      await db.execute('UPDATE run_routes SET points_json = $1 WHERE run_id = $2', [json, keepId]);
    } else {
      await db.execute(
        'INSERT INTO run_routes (id, run_id, points_json, created_at) VALUES ($1, $2, $3, $4)',
        [generateId(), keepId, json, new Date().toISOString()],
      );
    }
  }

  for (const other of others) {
    const gear = await db.select<{ gear_id: string }[]>(
      'SELECT gear_id FROM run_gear WHERE run_id = $1',
      [other.id],
    );
    for (const row of gear) {
      await db.execute(
        'INSERT OR IGNORE INTO run_gear (run_id, gear_id) VALUES ($1, $2)',
        [keepId, row.gear_id],
      );
    }
    await db.execute('DELETE FROM fit_imports WHERE run_id = $1', [other.id]);
    await db.execute('DELETE FROM run_routes WHERE run_id = $1', [other.id]);
    await deleteRun(db, other.id);
  }
}

/** Returns the run logged for a specific plan day, or null. */
export async function getRunForPlanDay(db: Database, planDayId: string): Promise<Run | null> {
  const rows = await db.select<Run[]>(
    'SELECT * FROM runs WHERE plan_day_id = $1 LIMIT 1',
    [planDayId],
  );
  return rows[0] ?? null;
}
