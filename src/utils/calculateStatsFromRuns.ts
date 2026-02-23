import type { Run, RunStats, DistanceUnit } from '../types';
import { convertDistance } from './paceUtils';
import { format, subDays, parseISO, differenceInCalendarDays, startOfWeek, endOfWeek } from 'date-fns';

/**
 * Calculate run statistics from an array of runs (useful for friend profiles)
 */
export function calculateStatsFromRuns(runs: Run[], unit: DistanceUnit): RunStats {
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

  const total_distance = runs.reduce(
    (s, r) => s + convertDistance(r.distance_value, r.distance_unit, unit),
    0,
  );
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
  
  // Check backwards from today
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
  
  // Longest streak
  const sortedDates = [...runDates].sort();
  let maxStreak = 0;
  let curStreak = 0;
  let prevDate: string | null = null;
  for (const d of sortedDates) {
    if (prevDate) {
      const diff = differenceInCalendarDays(parseISO(d), parseISO(prevDate));
      if (diff === 1) {
        curStreak++;
      } else {
        maxStreak = Math.max(maxStreak, curStreak);
        curStreak = 1;
      }
    } else {
      curStreak = 1;
    }
    prevDate = d;
  }
  longest_streak = Math.max(maxStreak, curStreak);

  return {
    total_distance,
    total_runs: runs.length,
    total_duration_seconds,
    avg_pace_seconds_per_unit,
    longest_run_distance,
    current_streak,
    longest_streak,
    runs_completed_vs_scheduled: { completed: runs.length, scheduled: 0 },
  };
}

/**
 * Calculate weekly mileage from runs (for charts)
 */
export function calculateWeeklyMileage(
  runs: Run[],
  unit: DistanceUnit,
  weeks = 12,
  startDate?: string,
  endDate?: string,
): { week: string; miles: number }[] {
  const result: { week: string; miles: number }[] = [];
  const today = endDate ? parseISO(endDate) : new Date();
  
  for (let i = weeks - 1; i >= 0; i--) {
    const end = subDays(today, i * 7);
    const weekStart = startOfWeek(end, { weekStartsOn: 1 });
    const weekEnd = endOfWeek(end, { weekStartsOn: 1 });
    const s = format(weekStart, 'yyyy-MM-dd');
    const e = format(weekEnd, 'yyyy-MM-dd');
    
    // Skip weeks outside the date range if specified
    if (startDate && e < startDate) continue;
    if (endDate && s > endDate) continue;
    
    const weekRuns = runs.filter(r => r.date >= s && r.date <= e);
    const miles = weekRuns.reduce(
      (sum, r) => sum + convertDistance(r.distance_value, r.distance_unit, unit),
      0,
    );
    result.push({ week: format(weekStart, 'MMM d'), miles: parseFloat(miles.toFixed(1)) });
  }
  return result;
}

/**
 * Calculate run type breakdown from runs
 */
export function calculateRunTypeBreakdown(
  runs: Run[],
  unit: DistanceUnit,
  startDate?: string,
  endDate?: string,
): { type: string; miles: number }[] {
  let filteredRuns = runs;
  if (startDate || endDate) {
    filteredRuns = runs.filter(r => {
      if (startDate && r.date < startDate) return false;
      if (endDate && r.date > endDate) return false;
      return true;
    });
  }
  
  const map: Record<string, number> = {};
  for (const r of filteredRuns) {
    const d = convertDistance(r.distance_value, r.distance_unit, unit);
    map[r.run_type] = (map[r.run_type] ?? 0) + d;
  }
  return Object.entries(map).map(([type, miles]) => ({ type, miles: parseFloat(miles.toFixed(1)) }));
}

