import type Database from '@tauri-apps/plugin-sql';
import type { DistanceUnit, Run, RoutePoint } from '../types';
import { convertDistance } from '../utils/paceUtils';
import { bestEffortSeconds } from '../utils/bestEffort';
import { getRouteForRun } from './runService';

export const MI_METERS = 1609.344;
export const KM_METERS = 1000;
export const HALF_MARATHON_METERS = 21097.5;
export const MARATHON_METERS = 42195;

export interface PbDistanceDef {
  id: string;
  label: string;
  meters: number;
  /** Built-in defaults cannot be deleted */
  builtin: boolean;
}

export interface PersonalBest {
  distance: PbDistanceDef;
  durationSeconds: number | null;
  runId: string | null;
  runDate: string | null;
  /** True when PB came from a GPS best-effort inside a longer run */
  fromBestEffort: boolean;
}

export const DEFAULT_PB_DISTANCES: PbDistanceDef[] = [
  { id: '1mi', label: '1 Mile', meters: MI_METERS, builtin: true },
  { id: '5k', label: '5K', meters: 5 * KM_METERS, builtin: true },
  { id: '10k', label: '10K', meters: 10 * KM_METERS, builtin: true },
  { id: 'half', label: 'Half Marathon', meters: HALF_MARATHON_METERS, builtin: true },
  { id: 'marathon', label: 'Marathon', meters: MARATHON_METERS, builtin: true },
];

/** Near-match band for full-run PBs when no timed route exists (±3%). */
const NEAR_MATCH = 0.03;

function runDistanceMeters(run: Run): number {
  return convertDistance(run.distance_value, run.distance_unit, 'km') * KM_METERS;
}

async function effortForRun(
  db: Database,
  run: Run,
  targetMeters: number,
  routeCache: Map<string, RoutePoint[] | null>,
): Promise<{ seconds: number; fromBestEffort: boolean } | null> {
  const distM = runDistanceMeters(run);
  if (distM + 1 < targetMeters * (1 - NEAR_MATCH)) return null;

  let route: RoutePoint[] | null | undefined = routeCache.get(run.id);
  if (route === undefined) {
    route = run.has_route ? await getRouteForRun(db, run.id) : null;
    routeCache.set(run.id, route);
  }

  if (route && route.length >= 2) {
    const effort = bestEffortSeconds(route, targetMeters);
    if (effort != null && effort > 0) {
      return { seconds: Math.round(effort), fromBestEffort: distM > targetMeters * (1 + NEAR_MATCH) };
    }
  }

  // Full-run near match only
  const ratio = distM / targetMeters;
  if (ratio >= 1 - NEAR_MATCH && ratio <= 1 + NEAR_MATCH && run.duration_seconds > 0) {
    return { seconds: run.duration_seconds, fromBestEffort: false };
  }

  return null;
}

export async function computePersonalBests(
  db: Database,
  distances: PbDistanceDef[],
): Promise<PersonalBest[]> {
  const runs = await db.select<Run[]>(
    'SELECT * FROM runs WHERE duration_seconds > 0 AND distance_value > 0 ORDER BY date DESC',
  );
  const routeCache = new Map<string, RoutePoint[] | null>();
  const results: PersonalBest[] = [];

  for (const distance of distances) {
    let best: PersonalBest = {
      distance,
      durationSeconds: null,
      runId: null,
      runDate: null,
      fromBestEffort: false,
    };

    for (const run of runs) {
      const effort = await effortForRun(db, run, distance.meters, routeCache);
      if (!effort) continue;
      if (best.durationSeconds == null || effort.seconds < best.durationSeconds) {
        best = {
          distance,
          durationSeconds: effort.seconds,
          runId: run.id,
          runDate: run.date,
          fromBestEffort: effort.fromBestEffort,
        };
      }
    }

    results.push(best);
  }

  return results;
}

export function metersLabel(meters: number, units: DistanceUnit): string {
  if (units === 'mi') {
    const mi = meters / MI_METERS;
    return mi >= 10 ? `${mi.toFixed(1)} mi` : `${mi.toFixed(2)} mi`;
  }
  const km = meters / KM_METERS;
  return km >= 10 ? `${km.toFixed(1)} km` : `${km.toFixed(2)} km`;
}

export function parseCustomDistanceInput(
  value: number,
  unit: DistanceUnit,
  label?: string,
): PbDistanceDef | null {
  if (!Number.isFinite(value) || value <= 0) return null;
  const meters = unit === 'mi' ? value * MI_METERS : value * KM_METERS;
  if (meters < 100 || meters > 200_000) return null;
  const id = `custom_${Math.round(meters)}_${Date.now().toString(36)}`;
  const autoLabel =
    label?.trim() ||
    (unit === 'mi' ? `${value} mi` : value >= 1 ? `${value}K`.replace('.0K', 'K') : `${value} km`);
  return { id, label: autoLabel, meters, builtin: false };
}
