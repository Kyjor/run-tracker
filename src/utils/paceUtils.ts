import type { DistanceUnit } from '../types';

// ---------------------------------------------------------------------------
// Conversions
// ---------------------------------------------------------------------------

/** Miles to km */
export function miToKm(mi: number): number {
  return mi * 1.60934;
}

/** Km to miles */
export function kmToMi(km: number): number {
  return km / 1.60934;
}

/** Convert distance to the target unit */
export function convertDistance(value: number, from: DistanceUnit, to: DistanceUnit): number {
  if (from === to) return value;
  return from === 'mi' ? miToKm(value) : kmToMi(value);
}

// ---------------------------------------------------------------------------
// Duration Formatting
// ---------------------------------------------------------------------------

/** Format seconds to "H:MM:SS" or "MM:SS" */
export function formatDuration(totalSeconds: number): string {
  const h = Math.floor(totalSeconds / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);
  const s = totalSeconds % 60;
  const mm = String(m).padStart(2, '0');
  const ss = String(s).padStart(2, '0');
  return h > 0 ? `${h}:${mm}:${ss}` : `${mm}:${ss}`;
}

/** Parse "H:MM:SS" or "MM:SS" to total seconds */
export function parseDuration(str: string): number {
  const parts = str.split(':').map(Number);
  if (parts.length === 3) return parts[0] * 3600 + parts[1] * 60 + parts[2];
  if (parts.length === 2) return parts[0] * 60 + parts[1];
  return 0;
}

/** Format minutes to "Xh Ym" */
export function formatMinutes(minutes: number): string {
  if (minutes < 60) return `${minutes}m`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m > 0 ? `${h}h ${m}m` : `${h}h`;
}

// ---------------------------------------------------------------------------
// Pace Calculations
// ---------------------------------------------------------------------------

/**
 * Calculate pace in seconds per unit.
 * @param distanceValue distance in distanceUnit
 * @param durationSeconds total seconds
 * @param unit target pace unit
 */
export function calcPaceSeconds(
  distanceValue: number,
  durationSeconds: number,
  _unit: DistanceUnit,
): number {
  if (distanceValue <= 0 || durationSeconds <= 0) return 0;
  return durationSeconds / distanceValue;
}

/**
 * Format pace seconds to "M:SS /unit" string (e.g. "8:30 /mi")
 */
export function formatPace(paceSecondsPerUnit: number, unit: DistanceUnit): string {
  if (!paceSecondsPerUnit || paceSecondsPerUnit <= 0) return '—';
  const m = Math.floor(paceSecondsPerUnit / 60);
  const s = Math.round(paceSecondsPerUnit % 60);
  const ss = String(s).padStart(2, '0');
  return `${m}:${ss} /${unit}`;
}

/**
 * Format distance to a nice string like "3.12 mi" or "5.25 km".
 * Show two decimal places to better reflect GPS/HealthKit distances.
 */
export function formatDistance(value: number, unit: DistanceUnit): string {
  return `${value.toFixed(2)} ${unit}`;
}

