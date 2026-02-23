import type { PlanDay, Run } from '../../types';
import { ACTIVITY_COLORS } from '../../types';
import { formatDistance } from '../../utils/paceUtils';
import { useSettings } from '../../contexts/SettingsContext';

interface DayCellProps {
  date: Date;
  planDay?: PlanDay | null;
  run?: Run | null;
  isCurrentMonth: boolean;
  isToday: boolean;
  isSelected: boolean;
  onClick: () => void;
}

export function DayCell({ date, planDay, run, isCurrentMonth, isToday, isSelected, onClick }: DayCellProps) {
  const { settings } = useSettings();
  const dayNum = date.getDate();
  const color = planDay ? ACTIVITY_COLORS[planDay.activity_type] : undefined;
  const isCompleted = !!run;

  return (
    <button
      onClick={onClick}
      className={[
        'relative flex flex-col items-center pt-1 pb-0.5 rounded-xl transition-colors select-none',
        isSelected ? 'bg-primary-100 dark:bg-primary-900/40' : '',
        !isCurrentMonth ? 'opacity-30' : '',
      ].join(' ')}
    >
      {/* Day number */}
      <span
        className={[
          'flex items-center justify-center w-7 h-7 rounded-full text-sm font-medium mb-0.5',
          isToday
            ? 'bg-primary-600 text-white font-bold'
            : 'text-gray-800 dark:text-gray-100',
        ].join(' ')}
      >
        {dayNum}
      </span>

      {/* Activity dot / distance */}
      {planDay && planDay.activity_type !== 'rest' && (
        <div className="flex flex-col items-center gap-0.5">
          {/* Colored indicator */}
          <div
            className="w-1.5 h-1.5 rounded-full"
            style={{ backgroundColor: color }}
          />
          {/* Distance label */}
          {planDay.distance_value && (
            <span className="text-[9px] leading-none" style={{ color }}>
              {formatDistance(planDay.distance_value, settings.units)}
            </span>
          )}
          {planDay.duration_minutes && planDay.activity_type === 'cross_training' && (
            <span className="text-[9px] leading-none" style={{ color }}>
              {planDay.duration_minutes}m
            </span>
          )}
        </div>
      )}

      {/* Rest dot */}
      {planDay?.activity_type === 'rest' && (
        <div className="w-1.5 h-1.5 rounded-full bg-gray-300 dark:bg-gray-600" />
      )}

      {/* Completion checkmark overlay */}
      {isCompleted && planDay && planDay.activity_type !== 'rest' && (
        <span className="absolute top-0.5 right-0.5 text-[9px]">✓</span>
      )}
    </button>
  );
}

