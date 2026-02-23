import { invoke } from '@tauri-apps/api/core';
import type { Run, RunType, HRZones } from '../types';
import { createRun } from './runService';
import type Database from '@tauri-apps/plugin-sql';
import { format, parseISO } from 'date-fns';
import { generateId } from '../utils/generateId';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** Basic workout info — returned by the list query (fast, no sub-queries). */
export interface HealthKitWorkout {
  id: string;
  activity_type: string;   // 'running' | 'walking' | 'hiking'
  start_date: string;      // ISO 8601
  end_date: string;
  duration_seconds: number;
  distance_meters?: number;
  energy_burned_kcal?: number;
  average_heart_rate?: number;
  max_heart_rate?: number;
  temperature_celsius?: number;
  humidity_percent?: number;
  weather_condition?: string;
}

/** Full metrics fetched at import time (heavier per-workout queries). */
export interface WorkoutDetails {
  // HR zones (seconds in each)
  hr_zone_1_seconds?: number;
  hr_zone_2_seconds?: number;
  hr_zone_3_seconds?: number;
  hr_zone_4_seconds?: number;
  hr_zone_5_seconds?: number;
  min_heart_rate?: number;

  // Cadence & form
  average_cadence?: number;                 // steps/min
  average_stride_length_meters?: number;    // metres
  average_ground_contact_time_ms?: number;  // milliseconds
  average_vertical_oscillation_cm?: number; // centimetres

  // Power (Apple Watch Ultra / compatible devices)
  average_power_watts?: number;
  max_power_watts?: number;

  // Elevation
  elevation_gain_meters?: number;
  elevation_loss_meters?: number;

  // Fitness snapshot
  vo2_max?: number;

  // GPS route — JSON array of {lat, lng, alt?, t?}
  route_points?: string;
}

// ---------------------------------------------------------------------------
// Tauri command wrappers
// ---------------------------------------------------------------------------

export async function requestHealthKitPermission(): Promise<boolean> {
  try {
    return await invoke<boolean>('request_healthkit_permission');
  } catch {
    return false;
  }
}

export async function fetchHealthKitWorkouts(
  startDate?: string,
  endDate?: string,
): Promise<HealthKitWorkout[]> {
  return invoke<HealthKitWorkout[]>('fetch_healthkit_workouts', { startDate, endDate });
}

export async function fetchWorkoutDetails(
  workoutId: string,
  maxHeartRateBpm = 190,
): Promise<WorkoutDetails> {
  return invoke<WorkoutDetails>('fetch_workout_details', {
    workoutId,
    maxHeartRateBpm,
  });
}

// ---------------------------------------------------------------------------
// Duplicate detection
// ---------------------------------------------------------------------------

export async function workoutExists(
  db: Database,
  workout: HealthKitWorkout,
  units: 'mi' | 'km',
): Promise<boolean> {
  if (!workout.distance_meters) return false;
  const runDate = format(parseISO(workout.start_date), 'yyyy-MM-dd');
  const existing = await db.select<Run[]>(
    'SELECT distance_value, duration_seconds FROM runs WHERE date = $1 AND source = $2',
    [runDate, 'healthkit'],
  );
  const distanceValue = units === 'mi'
    ? workout.distance_meters / 1609.34
    : workout.distance_meters / 1000;
  const tolerance = units === 'mi' ? 0.1 : 0.16;
  return existing.some(
    r => Math.abs(r.distance_value - distanceValue) < tolerance
      && Math.abs(r.duration_seconds - workout.duration_seconds) < 60,
  );
}

// ---------------------------------------------------------------------------
// Conversion helpers
// ---------------------------------------------------------------------------

function inferRunType(workout: HealthKitWorkout, units: 'mi' | 'km'): RunType {
  if (workout.activity_type === 'walking') return 'easy_run';
  if (workout.activity_type === 'hiking')  return 'long_run';
  if (!workout.distance_meters || workout.duration_seconds <= 0) return 'easy_run';

  const distKm = workout.distance_meters / 1000;
  const paceMinPerKm = (workout.duration_seconds / 60) / distKm;
  const pace = units === 'mi' ? paceMinPerKm * 1.60934 : paceMinPerKm;

  if (pace < 7)  return 'intervals';
  if (pace < 8)  return 'tempo_run';
  if (pace > 10) return 'long_run';
  return 'easy_run';
}

function buildHRZonesJson(d: WorkoutDetails): string | null {
  if (d.hr_zone_1_seconds == null && d.hr_zone_2_seconds == null) return null;
  const zones: HRZones = {
    z1_seconds: d.hr_zone_1_seconds ?? 0,
    z2_seconds: d.hr_zone_2_seconds ?? 0,
    z3_seconds: d.hr_zone_3_seconds ?? 0,
    z4_seconds: d.hr_zone_4_seconds ?? 0,
    z5_seconds: d.hr_zone_5_seconds ?? 0,
  };
  return JSON.stringify(zones);
}

// ---------------------------------------------------------------------------
// Import
// ---------------------------------------------------------------------------

export async function importHealthKitWorkout(
  db: Database,
  workout: HealthKitWorkout,
  units: 'mi' | 'km',
  maxHeartRateBpm = 190,
): Promise<{ success: boolean; error?: string }> {
  try {
    if (!workout.distance_meters) {
      return { success: false, error: 'Workout has no distance data' };
    }
    if (await workoutExists(db, workout, units)) {
      return { success: false, error: 'Workout already imported' };
    }

    // Fetch full details (HR zones, cadence, elevation, route, VO2…)
    let details: WorkoutDetails = {};
    try {
      details = await fetchWorkoutDetails(workout.id, maxHeartRateBpm);
    } catch {
      // Non-fatal — import without details if the command fails (e.g. simulator)
    }

    const distanceValue = units === 'mi'
      ? workout.distance_meters / 1609.34
      : workout.distance_meters / 1000;

    const hrZonesJson = buildHRZonesJson(details);
    const hasRoute = details.route_points ? 1 : 0;

    await createRun(db, {
      id: workout.id,
      date: format(parseISO(workout.start_date), 'yyyy-MM-dd'),
      distance_value: Math.round(distanceValue * 100) / 100,
      distance_unit: units,
      duration_seconds: Math.round(workout.duration_seconds),
      run_type: inferRunType(workout, units),
      plan_day_id: null,
      notes: '',
      source: 'healthkit',

      // HR
      avg_heart_rate: workout.average_heart_rate ?? null,
      max_heart_rate: workout.max_heart_rate ?? null,
      min_heart_rate: details.min_heart_rate ?? null,
      hr_zones: hrZonesJson,

      // Form
      avg_cadence: details.average_cadence ?? null,
      avg_stride_length_meters: details.average_stride_length_meters ?? null,
      avg_ground_contact_time_ms: details.average_ground_contact_time_ms ?? null,
      avg_vertical_oscillation_cm: details.average_vertical_oscillation_cm ?? null,

      // Power
      avg_power_watts: details.average_power_watts ?? null,
      max_power_watts: details.max_power_watts ?? null,

      // Elevation
      elevation_gain_meters: details.elevation_gain_meters ?? null,
      elevation_loss_meters: details.elevation_loss_meters ?? null,

      // Fitness
      vo2_max: details.vo2_max ?? null,

      // Environment
      temperature_celsius: workout.temperature_celsius ?? null,
      humidity_percent: workout.humidity_percent ?? null,
      weather_condition: workout.weather_condition ?? null,

      // Calories
      calories: workout.energy_burned_kcal ?? null,

      has_route: hasRoute,
    });

    // If route data exists, persist it separately
    if (details.route_points && hasRoute) {
      const routeId = generateId();
      const now = new Date().toISOString();
      await db.execute(
        'INSERT INTO run_routes (id, run_id, points_json, created_at) VALUES ($1, $2, $3, $4)',
        [routeId, workout.id, details.route_points, now],
      );
    }

    return { success: true };
  } catch (error) {
    console.error('importHealthKitWorkout failed:', error);
    return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
  }
}

/** Fetch the GPS route for a run that was previously imported. */
export async function getRunRoute(
  db: Database,
  runId: string,
): Promise<string | null> {
  const rows = await db.select<{ points_json: string }[]>(
    'SELECT points_json FROM run_routes WHERE run_id = $1 LIMIT 1',
    [runId],
  );
  return rows[0]?.points_json ?? null;
}
