import type Database from '@tauri-apps/plugin-sql';
import type { RunStats, DistanceUnit } from '../types';
import { convertDistance } from '../utils/paceUtils';
import { format, subDays, parseISO, differenceInCalendarDays } from 'date-fns';

interface RunRow {
  date: string;
  distance_value: number;
  distance_unit: DistanceUnit;
  duration_seconds: number;
}

function sumDistance(runs: RunRow[], unit: DistanceUnit): number {
  return runs.reduce((s, r) => s + convertDistance(r.distance_value, r.distance_unit, unit), 0);
}

export async function getRunStats(
  db: Database,
  unit: DistanceUnit,
  startDate?: string,
  endDate?: string,
): Promise<RunStats> {
  let query = 'SELECT date, distance_value, distance_unit, duration_seconds FROM runs';
  const params: string[] = [];
  if (startDate && endDate) {
    query += ' WHERE date >= $1 AND date <= $2';
    params.push(startDate, endDate);
  } else if (startDate) {
    query += ' WHERE date >= $1';
    params.push(startDate);
  }
  query += ' ORDER BY date ASC';

  const runs = await db.select<RunRow[]>(query, params);

  if (runs.length === 0) {
    return {
      total_distance: 0,
      total_runs: 0,
      total_duration_seconds: 0,
      avg_pace_seconds_per_unit: 0,
      longest_run_distance: 0,
      current_streak: 0,
      longest_streak: 0,
      runs_completed_vs_scheduled: { completed: 0, scheduled: 0 },
    };
  }

  const total_distance = sumDistance(runs, unit);
  const total_duration_seconds = runs.reduce((s, r) => s + r.duration_seconds, 0);
  const avg_pace_seconds_per_unit = total_distance > 0 ? total_duration_seconds / total_distance : 0;
  const longest_run_distance = Math.max(
    ...runs.map(r => convertDistance(r.distance_value, r.distance_unit, unit)),
  );

  // Streak calculation
  const runDates = new Set(runs.map(r => r.date));
  let current_streak = 0;
  let longest_streak = 0;
  let streak = 0;
  // check backwards from today
  for (let i = 0; i <= 365; i++) {
    const d = format(subDays(new Date(), i), 'yyyy-MM-dd');
    if (runDates.has(d)) {
      streak++;
      if (i === 0 || i === current_streak) current_streak = streak;
    } else {
      if (i === 0) { current_streak = 0; }
      break;
    }
  }
  // longest streak
  const sortedDates = [...runDates].sort();
  let maxStreak = 0;
  let curStreak = 0;
  let prevDate: string | null = null;
  for (const d of sortedDates) {
    if (prevDate) {
      const diff = differenceInCalendarDays(parseISO(d), parseISO(prevDate));
      if (diff === 1) { curStreak++; } else { curStreak = 1; }
    } else { curStreak = 1; }
    if (curStreak > maxStreak) maxStreak = curStreak;
    prevDate = d;
  }
  longest_streak = maxStreak;
  // re-compute current_streak properly
  let cs = 0;
  for (let i = 0; i < 365; i++) {
    const d = format(subDays(new Date(), i), 'yyyy-MM-dd');
    if (runDates.has(d)) { cs++; } else { break; }
  }
  current_streak = cs;

  return {
    total_distance,
    total_runs: runs.length,
    total_duration_seconds,
    avg_pace_seconds_per_unit,
    longest_run_distance,
    current_streak,
    longest_streak,
    runs_completed_vs_scheduled: { completed: runs.length, scheduled: 0 }, // scheduled filled by caller
  };
}

/** Returns weekly mileage for the last N weeks as chart data */
export async function getWeeklyMileage(
  db: Database,
  unit: DistanceUnit,
  weeks = 12,
  startDate?: string,
  endDate?: string,
): Promise<{ week: string; miles: number }[]> {
  const result: { week: string; miles: number }[] = [];
  const today = endDate ? parseISO(endDate) : new Date();
  
  for (let i = weeks - 1; i >= 0; i--) {
    const end = subDays(today, i * 7);
    const start = subDays(end, 6);
    const s = format(start, 'yyyy-MM-dd');
    const e = format(end, 'yyyy-MM-dd');
    
    // Skip weeks outside the date range if specified
    if (startDate && e < startDate) continue;
    if (endDate && s > endDate) continue;
    
    let query = 'SELECT distance_value, distance_unit FROM runs WHERE date >= $1 AND date <= $2';
    const params = [s, e];
    
    // Further filter by date range if provided
    if (startDate && s < startDate) {
      query = 'SELECT distance_value, distance_unit FROM runs WHERE date >= $1 AND date <= $2';
      params[0] = startDate;
    }
    if (endDate && e > endDate) {
      query = 'SELECT distance_value, distance_unit FROM runs WHERE date >= $1 AND date <= $2';
      params[1] = endDate;
    }
    
    const rows = await db.select<RunRow[]>(query, params);
    const miles = rows.reduce((sum, r) => sum + convertDistance(r.distance_value, r.distance_unit, unit), 0);
    result.push({ week: format(start, 'MMM d'), miles: parseFloat(miles.toFixed(1)) });
  }
  return result;
}

/** Breakdown of total distance by run_type */
export async function getRunTypeBreakdown(
  db: Database,
  unit: DistanceUnit,
  startDate?: string,
  endDate?: string,
): Promise<{ type: string; miles: number }[]> {
  let query = 'SELECT run_type, distance_value, distance_unit FROM runs';
  const params: string[] = [];
  if (startDate && endDate) {
    query += ' WHERE date >= $1 AND date <= $2';
    params.push(startDate, endDate);
  }
  const rows = await db.select<(RunRow & { run_type: string })[]>(query, params);
  const map: Record<string, number> = {};
  for (const r of rows) {
    const d = convertDistance(r.distance_value, r.distance_unit, unit);
    map[r.run_type] = (map[r.run_type] ?? 0) + d;
  }
  return Object.entries(map).map(([type, miles]) => ({ type, miles: parseFloat(miles.toFixed(1)) }));
}

