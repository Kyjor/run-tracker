import type { DistanceUnit } from '../../types';
import type { RouteSplitRow } from '../../utils/routeSplits';
import { calcPaceSeconds, formatDistance, formatDuration, formatPace } from '../../utils/paceUtils';

const MI_METERS = 1609.34;

function distanceInUnit(meters: number, unit: DistanceUnit): number {
  return unit === 'mi' ? meters / MI_METERS : meters / 1000;
}

interface RunSplitsSectionProps {
  splits: RouteSplitRow[];
  unit: DistanceUnit;
}

export function RunSplitsSection({ splits, unit }: RunSplitsSectionProps) {
  if (splits.length === 0) return null;

  const title = unit === 'mi' ? 'Splits (per mi)' : 'Splits (per km)';

  return (
    <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 overflow-hidden">
      <div className="px-4 py-3 border-b border-gray-100 dark:border-gray-700">
        <h3 className="text-xs font-semibold uppercase tracking-wider text-gray-400 dark:text-gray-500">
          {title}
        </h3>
      </div>
      <div className="px-4 py-2">
        <div className="grid grid-cols-[minmax(0,1fr)_auto_auto] gap-x-3 gap-y-1 text-xs pb-2 border-b border-gray-100 dark:border-gray-700">
          <span className="text-gray-400 dark:text-gray-500 font-medium">Split</span>
          <span className="text-gray-400 dark:text-gray-500 font-medium text-right">Time</span>
          <span className="text-gray-400 dark:text-gray-500 font-medium text-right">Pace</span>
        </div>
        <ul className="flex flex-col">
          {splits.map((row, i) => {
            const distU = distanceInUnit(row.distanceMeters, unit);
            const paceSec = calcPaceSeconds(distU, Math.round(row.durationSeconds), unit);
            const label = row.isPartial
              ? (
                  <span className="inline-flex flex-col items-start">
                    <span className="font-semibold text-gray-900 dark:text-white">+</span>
                    <span className="text-[10px] text-gray-400 dark:text-gray-500 font-normal">
                      {formatDistance(distU, unit)}
                    </span>
                  </span>
                )
              : (
                  <span className="font-semibold text-gray-900 dark:text-white">{row.splitIndex}</span>
                );

            return (
              <li
                key={i}
                className="grid grid-cols-[minmax(0,1fr)_auto_auto] gap-x-3 items-center py-2.5 border-b border-gray-50 dark:border-gray-700/80 last:border-0"
              >
                <div className="min-w-0">{label}</div>
                <span className="text-sm font-medium text-gray-800 dark:text-gray-100 tabular-nums text-right">
                  {formatDuration(Math.round(row.durationSeconds))}
                </span>
                <span className="text-sm font-medium text-gray-800 dark:text-gray-100 tabular-nums text-right whitespace-nowrap">
                  {paceSec > 0 ? formatPace(paceSec, unit) : '—'}
                </span>
              </li>
            );
          })}
        </ul>
      </div>
    </div>
  );
}
