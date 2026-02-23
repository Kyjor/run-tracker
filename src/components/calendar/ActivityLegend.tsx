import { ACTIVITY_COLORS, ACTIVITY_LABELS } from '../../types';
import type { ActivityType } from '../../types';

const SHOW: ActivityType[] = ['rest', 'cross_training', 'easy_run', 'pace_run', 'tempo_run', 'long_run', 'intervals', 'race'];

export function ActivityLegend() {
  return (
    <div className="px-4 pt-4 pb-2">
      <div className="flex flex-wrap gap-x-3 gap-y-1.5">
        {SHOW.map(type => (
          <div key={type} className="flex items-center gap-1.5">
            <div className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: ACTIVITY_COLORS[type] }} />
            <span className="text-xs text-gray-500 dark:text-gray-400">{ACTIVITY_LABELS[type]}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

