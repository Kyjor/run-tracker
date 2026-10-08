import type Database from '@tauri-apps/plugin-sql';
import type { DistanceUnit, HeroVisual, HRZones, RoutePoint, Run } from '../types';
import { haversineMeters } from './geoUtils';
import { calcPaceSeconds, convertDistance, formatDistance, formatPace } from './paceUtils';

const ZONE_META: { key: keyof HRZones; label: string; color: string }[] = [
  { key: 'z1_seconds', label: 'Recovery', color: '#94a3b8' },
  { key: 'z2_seconds', label: 'Easy', color: '#38bdf8' },
  { key: 'z3_seconds', label: 'Aerobic', color: '#34d399' },
  { key: 'z4_seconds', label: 'Threshold', color: '#fb923c' },
  { key: 'z5_seconds', label: 'Max', color: '#ef4444' },
];

export interface HeroOption {
  kind: string;
  label: string;
}

interface Sample {
  minute: number;
  heartRate: number | null;
  cadence: number | null;
}

export function parseHero(raw: string | null | undefined): HeroVisual | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as HeroVisual;
    if (!parsed || typeof parsed.title !== 'string' || typeof parsed.headline !== 'string') return null;
    return parsed;
  } catch {
    return null;
  }
}

export async function heroOptionsForRun(
  db: Database,
  run: Run,
  route: RoutePoint[] | null,
  unit: DistanceUnit,
): Promise<HeroOption[]> {
  const samples = await loadFitSamples(db, run.id);
  const options: HeroOption[] = [];
  if (paceSeries(route, unit).length >= 4) options.push({ kind: 'pace_series', label: 'Pace over time' });
  if (samples.filter(s => s.heartRate != null).length >= 4) options.push({ kind: 'hr_series', label: 'Heart rate over time' });
  if (samples.filter(s => s.cadence != null).length >= 4) options.push({ kind: 'cadence_series', label: 'Cadence over time' });
  if (zoneSlices(run).length > 0) options.push({ kind: 'hr_zones', label: 'Heart rate zones' });
  if (run.avg_heart_rate != null) options.push({ kind: 'avg_heart_rate', label: 'Average heart rate' });
  if (run.distance_value > 0 && run.duration_seconds > 0) options.push({ kind: 'pace', label: 'Average pace' });
  if (run.distance_value > 0) options.push({ kind: 'distance', label: 'Distance' });
  if (run.avg_cadence != null) options.push({ kind: 'cadence', label: 'Average cadence' });
  if (run.elevation_gain_meters != null) options.push({ kind: 'elevation', label: 'Elevation gain' });
  return options;
}

export async function buildHero(
  db: Database,
  run: Run,
  route: RoutePoint[] | null,
  unit: DistanceUnit,
  kind: string,
): Promise<HeroVisual | null> {
  const samples = await loadFitSamples(db, run.id);
  const pace = calcPaceSeconds(
    convertDistance(run.distance_value, run.distance_unit, unit),
    run.duration_seconds,
    unit,
  );

  if (kind === 'pace_series') {
    const series = paceSeries(route, unit);
    if (series.length < 4) return null;
    return {
      kind,
      title: 'Pace',
      headline: pace > 0 ? formatPace(pace, unit) : '—',
      caption: 'Minutes into the run',
      series,
    };
  }
  if (kind === 'hr_series') {
    const series = downsample(samples.flatMap(s => s.heartRate == null ? [] : [{ t: s.minute, y: s.heartRate }]));
    if (series.length < 4) return null;
    return {
      kind,
      title: 'Heart rate',
      headline: run.avg_heart_rate != null ? `${Math.round(run.avg_heart_rate)} bpm` : '—',
      caption: 'Minutes into the run',
      series,
    };
  }
  if (kind === 'cadence_series') {
    const series = downsample(samples.flatMap(s => s.cadence == null ? [] : [{ t: s.minute, y: s.cadence }]));
    if (series.length < 4) return null;
    return {
      kind,
      title: 'Cadence',
      headline: run.avg_cadence != null ? `${Math.round(run.avg_cadence)} spm` : '—',
      caption: 'Minutes into the run',
      series,
    };
  }
  if (kind === 'hr_zones') {
    const slices = zoneSlices(run);
    if (slices.length === 0) return null;
    const top = [...slices].sort((a, b) => b.seconds - a.seconds)[0];
    return { kind, title: 'Heart rate zones', headline: top.label, caption: 'Share of time', slices };
  }
  if (kind === 'avg_heart_rate' && run.avg_heart_rate != null) {
    return { kind, title: 'Average heart rate', headline: `${Math.round(run.avg_heart_rate)}`, caption: 'bpm' };
  }
  if (kind === 'pace' && pace > 0) {
    return { kind, title: 'Average pace', headline: formatPace(pace, unit) };
  }
  if (kind === 'distance' && run.distance_value > 0) {
    return { kind, title: 'Distance', headline: formatDistance(convertDistance(run.distance_value, run.distance_unit, unit), unit) };
  }
  if (kind === 'cadence' && run.avg_cadence != null) {
    return { kind, title: 'Average cadence', headline: `${Math.round(run.avg_cadence)}`, caption: 'steps / min' };
  }
  if (kind === 'elevation' && run.elevation_gain_meters != null) {
    const feet = unit === 'mi';
    const value = feet ? Math.round(run.elevation_gain_meters * 3.28084) : Math.round(run.elevation_gain_meters);
    return { kind, title: 'Elevation gain', headline: `${value}`, caption: feet ? 'ft' : 'm' };
  }
  return null;
}

function zoneSlices(run: Run): NonNullable<HeroVisual['slices']> {
  if (!run.hr_zones) return [];
  try {
    const zones = JSON.parse(run.hr_zones) as Partial<HRZones>;
    return ZONE_META
      .map(zone => ({ label: zone.label, seconds: zones[zone.key] ?? 0, color: zone.color }))
      .filter(zone => zone.seconds > 0);
  } catch {
    return [];
  }
}

function paceSeries(route: RoutePoint[] | null, unit: DistanceUnit): { t: number; y: number }[] {
  if (!route || route.length < 2) return [];
  const points: { t: number; y: number }[] = [];
  const origin = route.find(point => point.t != null)?.t;
  if (origin == null) return [];
  for (let i = 1; i < route.length; i++) {
    const prev = route[i - 1];
    const next = route[i];
    if (prev.t == null || next.t == null) continue;
    const seconds = (next.t - prev.t) / 1000;
    const meters = haversineMeters(prev, next);
    if (seconds < 1 || meters < 1) continue;
    const distance = unit === 'mi' ? meters / 1609.34 : meters / 1000;
    const pace = seconds / distance;
    if (pace < 120 || pace > 1800) continue;
    points.push({ t: (next.t - origin) / 60000, y: pace });
  }
  return downsample(points);
}

async function loadFitSamples(db: Database, runId: string): Promise<Sample[]> {
  const rows = await db.select<{ parsed_json: string }[]>(
    'SELECT parsed_json FROM fit_imports WHERE run_id = $1 LIMIT 1',
    [runId],
  );
  const raw = rows[0]?.parsed_json;
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw) as { records?: unknown };
    if (!Array.isArray(parsed.records)) return [];
    const samples: Sample[] = [];
    let startMs: number | null = null;
    for (const record of parsed.records) {
      if (!record || typeof record !== 'object') continue;
      const row = record as Record<string, unknown>;
      const stamp = typeof row.timestamp === 'string' ? Date.parse(row.timestamp) : NaN;
      if (!Number.isFinite(stamp)) continue;
      if (startMs == null) startMs = stamp;
      const hr = numberOrNull(row.heart_rate);
      const cadence = numberOrNull(row.cadence);
      if (hr == null && cadence == null) continue;
      samples.push({ minute: (stamp - startMs) / 60000, heartRate: hr, cadence });
    }
    return samples;
  } catch {
    return [];
  }
}

function numberOrNull(value: unknown): number | null {
  const n = typeof value === 'number' ? value : typeof value === 'string' ? Number(value) : NaN;
  return Number.isFinite(n) ? n : null;
}

function downsample(points: { t: number; y: number }[], max = 48): { t: number; y: number }[] {
  if (points.length <= max) return points;
  const step = (points.length - 1) / (max - 1);
  return Array.from({ length: max }, (_, i) => points[Math.round(i * step)]);
}
