import { useEffect, useState } from 'react';
import { format, subDays, startOfMonth, endOfMonth } from 'date-fns';
import type { RunStats } from '../types';
import { Header } from '../components/navigation/Header';
import { Card, SectionHeader } from '../components/ui/Card';
import { MileageChart } from '../components/charts/MileageChart';
import { RunTypeChart } from '../components/charts/RunTypeChart';
import { Spinner } from '../components/ui/Spinner';
import { useDb } from '../contexts/DatabaseContext';
import { useSettings } from '../contexts/SettingsContext';
import { getRunStats, getWeeklyMileage, getRunTypeBreakdown } from '../services/statsService';
import { formatDistance, formatPace } from '../utils/paceUtils';

type Range = 'week' | 'month' | 'year' | 'all';

export function StatsScreen() {
  const db = useDb();
  const { settings } = useSettings();
  const [range, setRange] = useState<Range>('month');
  const [stats, setStats] = useState<RunStats | null>(null);
  const [weeklyMileage, setWeeklyMileage] = useState<{ week: string; miles: number }[]>([]);
  const [typeBreakdown, setTypeBreakdown] = useState<{ type: string; miles: number }[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      setLoading(true);
      const { start, end } = getDateRange(range);
      // Calculate number of weeks to show based on range
      const weeks = range === 'week' ? 1 : range === 'month' ? 4 : range === 'year' ? 52 : 52;
      const [s, wm, tb] = await Promise.all([
        getRunStats(db, settings.units, start, end),
        getWeeklyMileage(db, settings.units, weeks, start, end),
        getRunTypeBreakdown(db, settings.units, start, end),
      ]);
      setStats(s);
      setWeeklyMileage(wm);
      setTypeBreakdown(tb);
      setLoading(false);
    }
    load();
  }, [db, settings.units, range]);

  return (
    <div className="flex flex-col flex-1 overflow-y-auto pb-24">
      <Header title="Stats" />

      {/* Range Picker */}
      <div className="sticky top-0 z-20 bg-gray-50 dark:bg-gray-900 border-b border-gray-200 dark:border-gray-700">
        <div className="flex px-4 gap-2 pt-3 pb-2 overflow-x-auto">
        {(['week', 'month', 'year', 'all'] as Range[]).map(r => (
          <button
            key={r}
            onClick={() => setRange(r)}
            className={[
              'px-3 py-1.5 rounded-xl text-sm font-medium whitespace-nowrap transition-colors',
              range === r
                ? 'bg-primary-600 text-white'
                : 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400',
            ].join(' ')}
          >
            {r === 'week' ? 'This Week' : r === 'month' ? 'This Month' : r === 'year' ? 'This Year' : 'All Time'}
          </button>
        ))}
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center flex-1 py-20">
          <Spinner size="lg" className="text-primary-500" />
        </div>
      ) : stats ? (
        <div className="px-4 pt-4 flex flex-col gap-4">
          {/* Summary numbers */}
          <Card>
            <div className="grid grid-cols-2 gap-4">
              <StatCell label="Total Distance" value={formatDistance(stats.total_distance, settings.units)} />
              <StatCell label="Total Runs" value={String(stats.total_runs)} />
              <StatCell label="Avg Pace" value={stats.avg_pace_seconds_per_unit > 0 ? formatPace(stats.avg_pace_seconds_per_unit, settings.units) : '—'} />
              <StatCell label="Longest Run" value={formatDistance(stats.longest_run_distance, settings.units)} />
              <StatCell label="Current Streak" value={`${stats.current_streak} days 🔥`} />
              <StatCell label="Longest Streak" value={`${stats.longest_streak} days`} />
            </div>
          </Card>

          {/* Mileage chart */}
          {weeklyMileage.length > 0 && (
            <Card>
              <SectionHeader title="Weekly Mileage" />
              <MileageChart data={weeklyMileage} unit={settings.units} />
            </Card>
          )}

          {/* Run type breakdown */}
          {typeBreakdown.length > 0 && (
            <Card>
              <SectionHeader title="By Run Type" />
              <RunTypeChart data={typeBreakdown} unit={settings.units} />
            </Card>
          )}
        </div>
      ) : (
        <div className="flex items-center justify-center flex-1 py-20 text-gray-400">
          No data yet. Log some runs!
        </div>
      )}
    </div>
  );
}

function StatCell({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col">
      <span className="text-xs text-gray-400 uppercase tracking-wide">{label}</span>
      <span className="text-base font-bold text-gray-900 dark:text-white">{value}</span>
    </div>
  );
}

function getDateRange(range: Range): { start?: string; end?: string } {
  const today = new Date();
  const end = format(today, 'yyyy-MM-dd');
  if (range === 'week') return { start: format(subDays(today, 6), 'yyyy-MM-dd'), end };
  if (range === 'month') return { start: format(startOfMonth(today), 'yyyy-MM-dd'), end: format(endOfMonth(today), 'yyyy-MM-dd') };
  if (range === 'year') return { start: format(new Date(today.getFullYear(), 0, 1), 'yyyy-MM-dd'), end };
  return {};
}

