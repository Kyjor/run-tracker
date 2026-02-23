import { useNavigate } from 'react-router-dom';
import type { TodayActivity } from '../../types';
import { ACTIVITY_COLORS, ACTIVITY_LABELS } from '../../types';
import { Card } from '../ui/Card';
import { Button } from '../ui/Button';
import { ProgressBar } from '../ui/ProgressBar';
import { formatDistance, formatDuration } from '../../utils/paceUtils';
import { getRestDayMessage, getCrossTrainingMessage } from '../../utils/restDayMessages';
import { today } from '../../utils/dateUtils';
import { useSettings } from '../../contexts/SettingsContext';
import { WorkoutDisplay } from '../workout/WorkoutDisplay';

interface TodayActivityCardProps {
  activity: TodayActivity;
  weekNumber: number | null;
  dayOfWeek: number | null;
  weekProgress: { completed: number; total: number };
}

const DOW_NAMES = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

export function TodayActivityCard({ activity, weekNumber, dayOfWeek, weekProgress }: TodayActivityCardProps) {
  const navigate = useNavigate();
  const { settings } = useSettings();
  const { plan_day, is_completed, logged_run } = activity;
  const color = plan_day ? ACTIVITY_COLORS[plan_day.activity_type] : '#9ca3af';

  if (!plan_day) {
    return (
      <Card className="bg-gradient-to-br from-primary-50 to-blue-50 dark:from-primary-900/20 dark:to-blue-900/20 border-0">
        <div className="text-center py-4">
          <p className="text-4xl mb-2">🏃</p>
          <p className="font-semibold text-gray-800 dark:text-gray-100">No plan active</p>
          <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">Choose a plan to get started</p>
          <Button onClick={() => navigate('/profile/plans')} size="sm">Browse Plans</Button>
        </div>
      </Card>
    );
  }

  const isRest = plan_day.activity_type === 'rest';
  const isCross = plan_day.activity_type === 'cross_training';

  return (
    <Card padding={false} className="overflow-hidden">
      {/* Color stripe */}
      <div className="h-1.5" style={{ backgroundColor: color }} />

      <div className="p-4">
        {/* Week / day header */}
        {weekNumber != null && dayOfWeek != null && (
          <div className="flex items-center gap-2 mb-3">
            <span className="text-xs font-medium px-2 py-0.5 bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 rounded-lg">
              Week {weekNumber} · {DOW_NAMES[dayOfWeek]}
            </span>
            {weekProgress.total > 0 && (
              <span className="text-xs text-gray-400">
                {weekProgress.completed}/{weekProgress.total} done
              </span>
            )}
          </div>
        )}

        {/* Activity info */}
        <div className="flex items-start gap-3">
          <div
            className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 mt-0.5"
            style={{ backgroundColor: color + '22' }}
          >
            <div className="w-3 h-3 rounded-full" style={{ backgroundColor: color }} />
          </div>

          <div className="flex-1">
            <p className="font-semibold text-gray-900 dark:text-white text-base">
              {ACTIVITY_LABELS[plan_day.activity_type]}
            </p>
            {plan_day.distance_value && (
              <p className="text-sm text-gray-600 dark:text-gray-400">
                {formatDistance(plan_day.distance_value, settings.units)}
              </p>
            )}
            {isCross && plan_day.duration_minutes && (
              <p className="text-sm text-gray-600 dark:text-gray-400">
                {plan_day.duration_minutes} minutes
              </p>
            )}
            {isRest && (
              <p className="text-sm text-gray-500 dark:text-gray-400 italic">
                {getRestDayMessage(today())}
              </p>
            )}
            {isCross && (
              <p className="text-sm text-gray-500 dark:text-gray-400 italic">
                {getCrossTrainingMessage(today())}
              </p>
            )}
            {plan_day.description && !isRest && !isCross && (
              <p className="text-xs text-gray-400 mt-0.5">{plan_day.description}</p>
            )}
          </div>
        </div>

        {/* Structured workout */}
        {!isRest && !isCross && (
          <div className="mt-3 pt-3 border-t border-gray-100 dark:border-gray-700">
            <WorkoutDisplay
              planDay={plan_day}
              paceZones={settings.pace_zones}
              unit={settings.units}
              compact
            />
          </div>
        )}

        {/* Week progress bar */}
        {weekProgress.total > 0 && (
          <ProgressBar
            value={(weekProgress.completed / weekProgress.total) * 100}
            className="mt-4"
            color={`bg-[${color}]`}
          />
        )}

        {/* Action */}
        {!isRest && (
          <div className="mt-4">
            {is_completed ? (
              <div className="flex items-center gap-2 text-green-600 dark:text-green-400">
                <span className="text-lg">✓</span>
                <span className="font-semibold text-sm">Completed!</span>
                {logged_run && (
                  <span className="text-xs text-gray-400 ml-auto">
                    {formatDistance(logged_run.distance_value, logged_run.distance_unit)} · {formatDuration(logged_run.duration_seconds)}
                  </span>
                )}
              </div>
            ) : (
              <Button
                onClick={() => navigate('/log', { state: { date: today(), planDayId: plan_day.id, prefill: plan_day } })}
                className="w-full"
              >
                Log Today's Run
              </Button>
            )}
          </div>
        )}
      </div>
    </Card>
  );
}

