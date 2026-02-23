import type { PlanDay, PaceZones, DistanceUnit, PaceZoneType } from '../../types';
import { PACE_ZONE_LABELS } from '../../types';
import {
  parseSegments,
  formatEstimatedTime,
  estimateSegmentSeconds,
  formatPaceFromSeconds,
} from '../../utils/workoutUtils';

// Zone colors matching the brand palette
const ZONE_COLORS: Record<PaceZoneType, string> = {
  easy:      '#34d399', // green
  long:      '#60a5fa', // blue
  tempo:     '#fb923c', // orange
  intervals: '#a78bfa', // purple
  race:      '#ef4444', // red
  recovery:  '#9ca3af', // gray
};

interface WorkoutDisplayProps {
  planDay: PlanDay;
  paceZones: PaceZones;
  unit: DistanceUnit;
  compact?: boolean; // single-line summary for cards/calendar
}

export function WorkoutDisplay({ planDay, paceZones, unit, compact = false }: WorkoutDisplayProps) {
  const segments = parseSegments(planDay.workout_segments);

  if (!segments || segments.length === 0) {
    // No structured workout — show simple distance/duration
    if (compact) return null;
    return (
      <div className="text-sm text-gray-500 dark:text-gray-400 italic">
        No structured workout defined.
      </div>
    );
  }

  const estimated = formatEstimatedTime(segments, paceZones);

  if (compact) {
    // Single line: "~45:30  •  Easy 3mi → Tempo 2mi → Easy 1mi"
    const summary = segments
      .map(s => {
        const reps = s.reps && s.reps > 1 ? `${s.reps}×` : '';
        const amt = s.distance_value
          ? `${reps}${s.distance_value}${unit}`
          : s.duration_minutes
          ? `${reps}${s.duration_minutes}min`
          : '';
        return `${PACE_ZONE_LABELS[s.zone]} ${amt}`.trim();
      })
      .join(' → ');

    return (
      <div className="flex items-center gap-1.5 flex-wrap">
        {estimated && (
          <span className="text-xs font-semibold text-gray-700 dark:text-gray-200">{estimated}</span>
        )}
        {estimated && <span className="text-xs text-gray-400">·</span>}
        <span className="text-xs text-gray-500 dark:text-gray-400">{summary}</span>
      </div>
    );
  }

  // Full breakdown
  return (
    <div className="flex flex-col gap-2">
      {/* Header row */}
      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">
          Workout
        </span>
        {estimated && (
          <span className="text-sm font-semibold text-gray-800 dark:text-gray-100">
            {estimated}
          </span>
        )}
      </div>

      {/* Segment rows */}
      <div className="flex flex-col gap-1.5">
        {segments.map((seg, i) => {
          const color = ZONE_COLORS[seg.zone];
          const paceStr = formatPaceFromSeconds(paceZones[seg.zone], unit);
          const segSecs = estimateSegmentSeconds(seg, paceZones);
          const segTime = segSecs > 0 ? formatSecsShort(segSecs) : null;
          const repsPrefix = seg.reps && seg.reps > 1 ? `${seg.reps}× ` : '';
          const amt = seg.distance_value
            ? `${repsPrefix}${seg.distance_value} ${unit}`
            : seg.duration_minutes
            ? `${repsPrefix}${seg.duration_minutes} min`
            : '';

          return (
            <div key={i} className="flex items-center gap-2">
              {/* Zone color bar */}
              <div
                className="w-1 self-stretch rounded-full flex-shrink-0"
                style={{ backgroundColor: color, minHeight: '20px' }}
              />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5 flex-wrap">
                  <span
                    className="text-xs font-semibold"
                    style={{ color }}
                  >
                    {PACE_ZONE_LABELS[seg.zone]}
                  </span>
                  {amt && (
                    <span className="text-xs text-gray-700 dark:text-gray-300">{amt}</span>
                  )}
                  <span className="text-xs text-gray-400 dark:text-gray-500">@ {paceStr}</span>
                </div>
                {seg.description && (
                  <p className="text-[11px] text-gray-400 dark:text-gray-500 mt-0.5">
                    {seg.description}
                  </p>
                )}
              </div>
              {segTime && (
                <span className="text-xs text-gray-400 dark:text-gray-500 flex-shrink-0">
                  {segTime}
                </span>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function formatSecsShort(secs: number): string {
  const m = Math.floor(secs / 60);
  const s = Math.round(secs % 60);
  if (m >= 60) {
    const h = Math.floor(m / 60);
    const rem = m % 60;
    return `${h}h ${rem}m`;
  }
  return s > 0 ? `${m}:${s.toString().padStart(2, '0')}` : `${m} min`;
}

/** Thin banner showing estimated time — used in plan day cards */
export function EstimatedTimeBadge({
  planDay,
  paceZones,
}: {
  planDay: PlanDay;
  paceZones: PaceZones;
}) {
  const segments = parseSegments(planDay.workout_segments);
  if (!segments || segments.length === 0) return null;
  const t = formatEstimatedTime(segments, paceZones);
  if (!t) return null;
  return (
    <span className="inline-flex items-center gap-1 text-xs font-medium text-primary-600 dark:text-primary-400 bg-primary-50 dark:bg-primary-900/30 px-2 py-0.5 rounded-full">
      ⏱ {t}
    </span>
  );
}

