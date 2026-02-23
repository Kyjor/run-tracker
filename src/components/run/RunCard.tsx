import type { Run } from '../../types';
import { RUN_TYPE_LABELS, ACTIVITY_COLORS } from '../../types';
import { Card } from '../ui/Card';
import { formatShort } from '../../utils/dateUtils';
import { formatDistance, formatDuration, formatPace, calcPaceSeconds } from '../../utils/paceUtils';

interface RunCardProps {
  run: Run;
  onClick?: () => void;
}

export function RunCard({ run, onClick }: RunCardProps) {
  const color = ACTIVITY_COLORS[run.run_type as keyof typeof ACTIVITY_COLORS] ?? ACTIVITY_COLORS['easy_run'];
  const pace = calcPaceSeconds(run.distance_value, run.duration_seconds, run.distance_unit);

  return (
    <Card onClick={onClick} padding={false}>
      <div className="flex items-center gap-3 p-4">
        {/* Color indicator */}
        <div
          className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
          style={{ backgroundColor: color + '22' }}
        >
          <div className="w-3 h-3 rounded-full" style={{ backgroundColor: color }} />
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-sm font-semibold text-gray-900 dark:text-white">
              {RUN_TYPE_LABELS[run.run_type] ?? 'Run'}
            </span>
            <span className="text-xs text-gray-400">{formatShort(run.date)}</span>
          </div>
          <div className="flex gap-3 mt-0.5">
            <span className="text-xs text-gray-600 dark:text-gray-400">
              {formatDistance(run.distance_value, run.distance_unit)}
            </span>
            <span className="text-xs text-gray-400">{formatDuration(run.duration_seconds)}</span>
            {pace > 0 && (
              <span className="text-xs text-gray-400">{formatPace(pace, run.distance_unit)}</span>
            )}
          </div>
          {run.notes ? (
            <p className="text-xs text-gray-400 mt-0.5 truncate">{run.notes}</p>
          ) : null}
        </div>

        {run.plan_day_id && (
          <span className="text-xs text-primary-500 flex-shrink-0">📅</span>
        )}
      </div>
    </Card>
  );
}

