import type { ActivityType, DistanceUnit, PaceZones, PaceZoneType, WorkoutSegment } from '../types';

// ============================================================
// Pace Formatting
// ============================================================

/** Convert seconds-per-unit to "M:SS" string */
export function formatPaceFromSeconds(secsPerUnit: number, unit: DistanceUnit): string {
  const m = Math.floor(secsPerUnit / 60);
  const s = Math.round(secsPerUnit % 60);
  return `${m}:${s.toString().padStart(2, '0')}/${unit}`;
}

/** Parse "M:SS" or "MM:SS" pace string → seconds per unit */
export function parsePaceString(paceStr: string): number {
  const parts = paceStr.split(':');
  if (parts.length !== 2) return 0;
  const m = parseInt(parts[0]) || 0;
  const s = parseInt(parts[1]) || 0;
  return m * 60 + s;
}

// ============================================================
// Workout Estimation
// ============================================================

/** Estimated duration (seconds) for a single segment */
export function estimateSegmentSeconds(
  seg: WorkoutSegment,
  paceZones: PaceZones,
): number {
  const reps = seg.reps ?? 1;
  const pace = paceZones[seg.zone];

  if (seg.duration_minutes) return seg.duration_minutes * 60 * reps;
  if (seg.distance_value && pace > 0) return seg.distance_value * pace * reps;
  return 0;
}

/** Total estimated duration (seconds) for a full workout */
export function estimateWorkoutSeconds(
  segments: WorkoutSegment[],
  paceZones: PaceZones,
): number {
  return segments.reduce((acc, seg) => acc + estimateSegmentSeconds(seg, paceZones), 0);
}

/** Format total estimated time as "~45:00" or "~1:23:45" */
export function formatEstimatedTime(
  segments: WorkoutSegment[],
  paceZones: PaceZones,
): string {
  const total = estimateWorkoutSeconds(segments, paceZones);
  if (total <= 0) return '';
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = Math.round(total % 60);
  if (h > 0) return `~${h}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  return `~${m}:${s.toString().padStart(2, '0')}`;
}

/** Human-readable label for a single segment (e.g. "2 mi @ 8:30/mi tempo") */
export function formatSegmentLine(
  seg: WorkoutSegment,
  paceZones: PaceZones,
  unit: DistanceUnit,
): string {
  const paceStr = formatPaceFromSeconds(paceZones[seg.zone], unit);
  const repsPrefix = seg.reps && seg.reps > 1 ? `${seg.reps}× ` : '';

  let amount = '';
  if (seg.distance_value) {
    amount = `${seg.distance_value} ${unit}`;
  } else if (seg.duration_minutes) {
    amount = `${seg.duration_minutes} min`;
  }

  const note = seg.description ? ` — ${seg.description}` : '';
  return `${repsPrefix}${amount} @ ${paceStr}${note}`;
}

// ============================================================
// Default Segments
// ============================================================

/** Pre-filled workout segments for a given activity type and distance */
export function defaultSegmentsForActivity(
  activityType: ActivityType,
  distanceValue: number | null,
  unit: DistanceUnit,
): WorkoutSegment[] {
  const dist = distanceValue ?? (unit === 'mi' ? 3 : 5);

  switch (activityType) {
    case 'easy_run':
    case 'pace_run':
      return [
        { zone: 'easy' as PaceZoneType, distance_value: dist, description: 'Easy effort' },
      ];

    case 'long_run':
      return [
        { zone: 'long' as PaceZoneType, distance_value: dist, description: 'Steady long effort' },
      ];

    case 'tempo_run': {
      const warmup = unit === 'mi' ? 1 : 1.5;
      const cooldown = unit === 'mi' ? 1 : 1.5;
      const tempo = Math.max(dist - warmup - cooldown, unit === 'mi' ? 1 : 2);
      return [
        { zone: 'easy' as PaceZoneType, distance_value: warmup, description: 'Warmup' },
        { zone: 'tempo' as PaceZoneType, distance_value: tempo, description: 'Tempo' },
        { zone: 'easy' as PaceZoneType, distance_value: cooldown, description: 'Cooldown' },
      ];
    }

    case 'intervals': {
      const warmup = unit === 'mi' ? 1 : 1.5;
      const cooldown = unit === 'mi' ? 1 : 1.5;
      const intervalDist = unit === 'mi' ? 0.25 : 0.4; // ~400m
      const reps = 8;
      return [
        { zone: 'easy' as PaceZoneType, distance_value: warmup, description: 'Warmup' },
        { zone: 'intervals' as PaceZoneType, distance_value: intervalDist, reps, description: 'Fast' },
        { zone: 'recovery' as PaceZoneType, distance_value: intervalDist, reps, description: 'Jog recovery' },
        { zone: 'easy' as PaceZoneType, distance_value: cooldown, description: 'Cooldown' },
      ];
    }

    case 'race':
      return [
        { zone: 'race' as PaceZoneType, distance_value: dist, description: 'Race effort' },
      ];

    default:
      return [];
  }
}

// ============================================================
// Parse / Serialize
// ============================================================

export function parseSegments(raw: string | null | undefined): WorkoutSegment[] | null {
  if (!raw) return null;
  try { return JSON.parse(raw) as WorkoutSegment[]; }
  catch { return null; }
}

export function serializeSegments(segments: WorkoutSegment[]): string {
  return JSON.stringify(segments);
}

