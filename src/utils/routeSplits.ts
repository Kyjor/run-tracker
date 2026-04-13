import type { DistanceUnit, RoutePoint } from '../types';
import { haversineMeters } from './geoUtils';

const MI_METERS = 1609.34;
const PARTIAL_MIN_M = 50;
const EPS = 1e-6;

export interface RouteSplitRow {
  /** 1-based index for full splits; partial rows use 0 */
  splitIndex: number;
  distanceMeters: number;
  durationSeconds: number;
  isPartial: boolean;
}

function splitLengthMeters(unit: DistanceUnit): number {
  return unit === 'mi' ? MI_METERS : 1000;
}

function hasTime(p: RoutePoint): boolean {
  return typeof p.t === 'number' && Number.isFinite(p.t);
}

/**
 * Auto splits along the GPS polyline at each full km or mile (per `unit`).
 * Requires timestamps on every point. Returns [] if splits cannot be computed or none qualify.
 */
export function computeRouteSplits(points: RoutePoint[], unit: DistanceUnit): RouteSplitRow[] {
  if (points.length < 2) return [];

  const L = splitLengthMeters(unit);
  const rows: RouteSplitRow[] = [];

  if (!hasTime(points[0])) return [];

  let lastSplitEndDist = 0;
  let lastSplitEndTimeSec = points[0].t! / 1000;
  let cumDist = 0;
  let splitCounter = 0;

  for (let i = 0; i < points.length - 1; i++) {
    const p0 = points[i];
    const p1 = points[i + 1];
    if (!hasTime(p0) || !hasTime(p1)) return [];

    const t0Sec = p0.t! / 1000;
    const t1Sec = p1.t! / 1000;
    const d0Seg = cumDist;
    const segLen = haversineMeters(p0, p1);
    if (segLen <= 0) {
      cumDist = d0Seg;
      continue;
    }
    const d1Seg = d0Seg + segLen;

    let nextBoundary = (Math.floor(d0Seg / L) + 1) * L;
    while (nextBoundary <= d1Seg + EPS) {
      const fraction = (nextBoundary - d0Seg) / segLen;
      const tBoundary = t0Sec + fraction * (t1Sec - t0Sec);
      const distM = nextBoundary - lastSplitEndDist;
      const dur = Math.max(0, tBoundary - lastSplitEndTimeSec);
      splitCounter += 1;
      rows.push({
        splitIndex: splitCounter,
        distanceMeters: distM,
        durationSeconds: dur,
        isPartial: false,
      });
      lastSplitEndDist = nextBoundary;
      lastSplitEndTimeSec = tBoundary;
      nextBoundary += L;
    }

    cumDist = d1Seg;
  }

  const last = points[points.length - 1];
  if (!hasTime(last)) return [];

  const lastTimeSec = last.t! / 1000;
  const partialRem = cumDist - lastSplitEndDist;
  if (partialRem >= PARTIAL_MIN_M) {
    const dur = Math.max(0, lastTimeSec - lastSplitEndTimeSec);
    rows.push({
      splitIndex: 0,
      distanceMeters: partialRem,
      durationSeconds: dur,
      isPartial: true,
    });
  }

  return rows;
}
