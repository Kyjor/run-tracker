import { Card } from '../ui/Card';
import type { WeightEntry } from '../../types';
import { format, parseISO, subDays } from 'date-fns';

interface WeightTrendChartProps {
  entries: WeightEntry[];
  days?: number;
}

export function WeightTrendChart({ entries, days = 30 }: WeightTrendChartProps) {
  if (entries.length === 0) {
    return (
      <Card>
        <p className="text-sm text-gray-500 dark:text-gray-400 text-center py-4">
          No weight data yet. Log weight to see trends.
        </p>
      </Card>
    );
  }

  // Get entries for the last N days
  const endDate = new Date();
  const startDate = subDays(endDate, days);
  const filteredEntries = entries
    .filter(e => {
      const entryDate = parseISO(e.date);
      return entryDate >= startDate && entryDate <= endDate;
    })
    .sort((a, b) => a.date.localeCompare(b.date));

  if (filteredEntries.length === 0) {
    return (
      <Card>
        <p className="text-sm text-gray-500 dark:text-gray-400 text-center py-4">
          No weight data in the last {days} days.
        </p>
      </Card>
    );
  }

  // Calculate min/max for scaling
  const weights = filteredEntries.map(e => e.weight_kg);
  const minWeight = Math.min(...weights);
  const maxWeight = Math.max(...weights);
  const range = maxWeight - minWeight || 1; // Avoid division by zero

  // Calculate trend
  const firstWeight = filteredEntries[0].weight_kg;
  const lastWeight = filteredEntries[filteredEntries.length - 1].weight_kg;
  const trend = lastWeight - firstWeight;
  const trendPerWeek = filteredEntries.length > 1
    ? (trend / filteredEntries.length) * 7
    : 0;

  return (
    <Card>
      <div className="flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs text-gray-500 dark:text-gray-400">Weight Trend</p>
            <p className="text-sm font-semibold text-gray-900 dark:text-gray-100 mt-1">
              {trend > 0 ? '+' : ''}{trend.toFixed(2)} kg ({trendPerWeek > 0 ? '+' : ''}{trendPerWeek.toFixed(2)} kg/week)
            </p>
          </div>
          <div className="text-2xl">
            {trend > 0.1 ? '📈' : trend < -0.1 ? '📉' : '➡️'}
          </div>
        </div>

        {/* Simple line chart */}
        <div className="relative h-32 bg-gray-50 dark:bg-gray-900 rounded-lg p-2">
          <svg className="w-full h-full" viewBox="0 0 200 100" preserveAspectRatio="none">
            <polyline
              fill="none"
              stroke="#3b82f6"
              strokeWidth="2"
              points={filteredEntries
                .map((entry, index) => {
                  const x = (index / (filteredEntries.length - 1 || 1)) * 200;
                  const y = 100 - ((entry.weight_kg - minWeight) / range) * 100;
                  return `${x},${y}`;
                })
                .join(' ')}
            />
            {filteredEntries.map((entry, index) => {
              const x = (index / (filteredEntries.length - 1 || 1)) * 200;
              const y = 100 - ((entry.weight_kg - minWeight) / range) * 100;
              return (
                <circle
                  key={entry.id}
                  cx={x}
                  cy={y}
                  r="2"
                  fill="#3b82f6"
                />
              );
            })}
          </svg>
        </div>

        <div className="flex justify-between text-[10px] text-gray-400 dark:text-gray-500">
          <span>{format(parseISO(filteredEntries[0].date), 'MMM d')}</span>
          <span>{format(parseISO(filteredEntries[filteredEntries.length - 1].date), 'MMM d')}</span>
        </div>
      </div>
    </Card>
  );
}

