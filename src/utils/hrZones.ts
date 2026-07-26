import type { HRZones } from '../types';

/** Build zone JSON from avg/max only (no time series) — best-effort for live/manual runs. */
export function buildHrZonesFromSummary(
  avgBpm: number | null | undefined,
  maxBpm: number | null | undefined,
  durationSeconds: number,
  maxHr: number,
): string | null {
  if (!avgBpm || durationSeconds <= 0 || maxHr <= 0) return null;

  const pct = avgBpm / maxHr;
  const zones: HRZones = {
    z1_seconds: 0,
    z2_seconds: 0,
    z3_seconds: 0,
    z4_seconds: 0,
    z5_seconds: 0,
  };

  // Attribute whole duration to the zone matching average HR
  if (pct < 0.6) zones.z1_seconds = durationSeconds;
  else if (pct < 0.7) zones.z2_seconds = durationSeconds;
  else if (pct < 0.8) zones.z3_seconds = durationSeconds;
  else if (pct < 0.9) zones.z4_seconds = durationSeconds;
  else zones.z5_seconds = durationSeconds;

  // If max was in a higher zone, nudge a small portion into that zone
  if (maxBpm != null) {
    const maxPct = maxBpm / maxHr;
    if (maxPct >= 0.9 && zones.z5_seconds === 0) {
      const bump = Math.min(30, Math.floor(durationSeconds * 0.1));
      if (zones.z4_seconds > bump) {
        zones.z4_seconds -= bump;
        zones.z5_seconds += bump;
      } else if (zones.z3_seconds > bump) {
        zones.z3_seconds -= bump;
        zones.z5_seconds += bump;
      }
    }
  }

  return JSON.stringify(zones);
}
