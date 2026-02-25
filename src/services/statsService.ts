import type Database from '@tauri-apps/plugin-sql';
import type { RunStats, DistanceUnit, ActivityType } from '../types';
import { convertDistance } from '../utils/paceUtils';
import { format, subDays, parseISO, differenceInCalendarDays } from 'date-fns';
import { extractDate, planDayToDate } from '../utils/dateUtils';

interface RunRow {
  date: string;
  distance_value: number;
  distance_unit: DistanceUnit;
  duration_seconds: number;
}

interface PlanDayRow {
  week_number: number;
  day_of_week: number;
  activity_type: ActivityType;
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
    // Convert date-only inputs to datetime range
    const startDatetime = startDate.includes('T') ? startDate : `${startDate}T00:00:00Z`;
    const endDatetime = endDate.includes('T') ? endDate : `${endDate}T23:59:59Z`;
    query += ' WHERE date >= $1 AND date <= $2';
    params.push(startDatetime, endDatetime);
  } else if (startDate) {
    const startDatetime = startDate.includes('T') ? startDate : `${startDate}T00:00:00Z`;
    query += ' WHERE date >= $1';
    params.push(startDatetime);
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

  // Streak calculation — extract date portion from datetime values
  const runDates = new Set(runs.map(r => extractDate(r.date)));

  // Rest days from active training plan should also count toward streak so
  // we don't imply people must run every single day.
  const restDates = new Set<string>();
  try {
    const active = await db.select<{ plan_id: string; start_date: string }[]>(
      'SELECT plan_id, start_date FROM active_plan WHERE is_active = 1 LIMIT 1',
    );
    if (active.length > 0) {
      const { plan_id, start_date } = active[0];
      const days = await db.select<PlanDayRow[]>(
        'SELECT week_number, day_of_week, activity_type FROM plan_days WHERE plan_id = $1',
        [plan_id],
      );
      for (const d of days) {
        if (d.activity_type === 'rest') {
          const iso = planDayToDate(start_date, d.week_number, d.day_of_week);
          if (iso) restDates.add(iso);
        }
      }
    }
  } catch {
    // If this fails for any reason, just fall back to run-only streaks.
  }

  const activeDates = new Set<string>([...runDates, ...restDates]);
  let current_streak = 0;
  let longest_streak = 0;
  let streak = 0;
  // check backwards from today
  for (let i = 0; i <= 365; i++) {
    const d = format(subDays(new Date(), i), 'yyyy-MM-dd');
    if (activeDates.has(d)) {
      streak++;
      if (i === 0 || i === current_streak) current_streak = streak;
    } else {
      if (i === 0) { current_streak = 0; }
      break;
    }
  }
  // longest streak
  const sortedDates = [...activeDates].sort();
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
    if (activeDates.has(d)) { cs++; } else { break; }
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
    
    // Convert date-only to datetime range
    const startDatetime = `${s}T00:00:00Z`;
    const endDatetime = `${e}T23:59:59Z`;
    let query = 'SELECT distance_value, distance_unit FROM runs WHERE date >= $1 AND date <= $2';
    const params = [startDatetime, endDatetime];
    
    // Further filter by date range if provided
    if (startDate && s < startDate) {
      const startDatetimeFilter = startDate.includes('T') ? startDate : `${startDate}T00:00:00Z`;
      query = 'SELECT distance_value, distance_unit FROM runs WHERE date >= $1 AND date <= $2';
      params[0] = startDatetimeFilter;
    }
    if (endDate && e > endDate) {
      const endDatetimeFilter = endDate.includes('T') ? endDate : `${endDate}T23:59:59Z`;
      query = 'SELECT distance_value, distance_unit FROM runs WHERE date >= $1 AND date <= $2';
      params[1] = endDatetimeFilter;
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
    // Convert date-only inputs to datetime range
    const startDatetime = startDate.includes('T') ? startDate : `${startDate}T00:00:00Z`;
    const endDatetime = endDate.includes('T') ? endDate : `${endDate}T23:59:59Z`;
    query += ' WHERE date >= $1 AND date <= $2';
    params.push(startDatetime, endDatetime);
  }
  const rows = await db.select<(RunRow & { run_type: string })[]>(query, params);
  const map: Record<string, number> = {};
  for (const r of rows) {
    const d = convertDistance(r.distance_value, r.distance_unit, unit);
    map[r.run_type] = (map[r.run_type] ?? 0) + d;
  }
  return Object.entries(map).map(([type, miles]) => ({ type, miles: parseFloat(miles.toFixed(1)) }));
}

