import type { PlanDay, Run } from '../../types';
import { ACTIVITY_LABELS, ACTIVITY_COLORS, RUN_TYPE_LABELS } from '../../types';
import { Modal } from '../ui/Modal';
import { formatLong } from '../../utils/dateUtils';
import { formatDistance, formatDuration, formatPace } from '../../utils/paceUtils';
import { useSettings } from '../../contexts/SettingsContext';
import { WorkoutDisplay } from '../workout/WorkoutDisplay';

interface FriendDayDetailSheetProps {
  isOpen: boolean;
  onClose: () => void;
  date: string | null;
  planDay: PlanDay | null;
  run: Run | null;
}

export function FriendDayDetailSheet({ isOpen, onClose, date, planDay, run }: FriendDayDetailSheetProps) {
  const { settings } = useSettings();

  if (!date) return null;

  const color = planDay ? ACTIVITY_COLORS[planDay.activity_type] : undefined;

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={formatLong(date)}>
      <div className="flex flex-col gap-4">
        {/* Planned Activity */}
        {planDay && (
          <div>
            <p className="text-xs text-gray-400 uppercase tracking-wide mb-2">Planned Activity</p>
            <div className="flex items-start gap-3 p-3 rounded-xl" style={{ backgroundColor: color + '15' }}>
              <div className="w-2 h-2 rounded-full mt-1.5 flex-shrink-0" style={{ backgroundColor: color }} />
              <div className="flex-1">
                <p className="font-semibold text-gray-900 dark:text-white">
                  {ACTIVITY_LABELS[planDay.activity_type]}
                </p>
                {planDay.distance_value && (
                  <p className="text-sm text-gray-600 dark:text-gray-400">
                    {formatDistance(planDay.distance_value, settings.units)}
                  </p>
                )}
                {planDay.duration_minutes && planDay.activity_type === 'cross_training' && (
                  <p className="text-sm text-gray-600 dark:text-gray-400">
                    {planDay.duration_minutes} minutes
                  </p>
                )}
                {planDay.description && (
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">{planDay.description}</p>
                )}
                {planDay.workout_segments && (
                  <div className="mt-2">
                    <WorkoutDisplay
                      planDay={planDay}
                      paceZones={settings.pace_zones}
                      unit={settings.units}
                      compact
                    />
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Logged Run */}
        {run && (
          <div>
            <p className="text-xs text-gray-400 uppercase tracking-wide mb-2">Logged Run</p>
            <div className="p-3 rounded-xl bg-gray-50 dark:bg-gray-800">
              <div className="flex items-center gap-2 mb-2">
                <span className="font-semibold text-gray-900 dark:text-white">
                  {formatDistance(run.distance_value, run.distance_unit)}
                </span>
                <span className="text-xs text-gray-400">·</span>
                <span className="text-xs text-gray-500 dark:text-gray-400">
                  {RUN_TYPE_LABELS[run.run_type]}
                </span>
              </div>
              {run.duration_seconds > 0 && (
                <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400">
                  <span>{formatDuration(run.duration_seconds)}</span>
                  <span>·</span>
                  <span>{formatPace(run.duration_seconds / run.distance_value, run.distance_unit)}</span>
                </div>
              )}
              {run.notes && (
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-2 italic">{run.notes}</p>
              )}
            </div>
          </div>
        )}

        {/* No activity message */}
        {!planDay && !run && (
          <p className="text-sm text-gray-500 dark:text-gray-400 text-center py-4">
            No planned activity or logged run for this day.
          </p>
        )}
      </div>
    </Modal>
  );
}

