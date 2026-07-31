import type { RoutePoint } from '../types';
import { haversineMeters } from './geoUtils';

const EPS = 1e-6;

function hasTime(p: RoutePoint): boolean {
  return typeof p.t === 'number' && Number.isFinite(p.t);
}

/**
 * Fastest contiguous effort covering at least `targetMeters` along a timed GPS route.
 * Returns duration in seconds, or null if the route is too short / untimed.
 */
export function bestEffortSeconds(points: RoutePoint[], targetMeters: number): number | null {
  if (points.length < 2 || targetMeters <= 0) return null;
  if (!points.every(hasTime)) return null;

  const cumDist: number[] = [0];
  const cumTimeSec: number[] = [points[0].t! / 1000];

  for (let i = 0; i < points.length - 1; i++) {
    const d = haversineMeters(points[i], points[i + 1]);
    cumDist.push(cumDist[i] + Math.max(0, d));
    cumTimeSec.push(points[i + 1].t! / 1000);
  }

  const total = cumDist[cumDist.length - 1];
  if (total + EPS < targetMeters) return null;

  let best: number | null = null;
  let end = 0;

  for (let start = 0; start < cumDist.length; start++) {
    const need = cumDist[start] + targetMeters;
    if (need > total + EPS) break;

    while (end < cumDist.length - 1 && cumDist[end] + EPS < need) {
      end += 1;
    }

    // Interpolate within the segment that crosses `need`
    let tEnd = cumTimeSec[end];
    if (end > 0 && cumDist[end] > cumDist[end - 1] + EPS) {
      const frac = (need - cumDist[end - 1]) / (cumDist[end] - cumDist[end - 1]);
      const clamped = Math.min(1, Math.max(0, frac));
      tEnd = cumTimeSec[end - 1] + clamped * (cumTimeSec[end] - cumTimeSec[end - 1]);
    }

    const dur = tEnd - cumTimeSec[start];
    if (dur > 0 && (best === null || dur < best)) best = dur;
  }

  return best;
}
