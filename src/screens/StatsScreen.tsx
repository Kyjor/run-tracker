import { useCallback, useEffect, useState } from 'react';
import { format, subDays, startOfMonth, endOfMonth } from 'date-fns';
import type { Run, RunStats } from '../types';
import { Header } from '../components/navigation/Header';
import { Card, SectionHeader } from '../components/ui/Card';
import { SegmentedControl } from '../components/ui/SegmentedControl';
import { FadeIn } from '../components/motion/FadeIn';
import { StaggerList, StaggerItem } from '../components/motion/StaggerList';
import { MileageChart } from '../components/charts/MileageChart';
import { RunTypeChart } from '../components/charts/RunTypeChart';
import { RunCard } from '../components/run/RunCard';
import { Spinner } from '../components/ui/Spinner';
import { useDb } from '../contexts/DatabaseContext';
import { useSettings } from '../contexts/SettingsContext';
import { getRunStats, getWeeklyMileage, getRunTypeBreakdown } from '../services/statsService';
import { getRunsPaginated } from '../services/runService';
import { formatDistance, formatPace } from '../utils/paceUtils';

type Range = 'week' | 'month' | 'year' | 'all';

const RUNS_PAGE_SIZE = 20;

export function StatsScreen() {
  const db = useDb();
  const { settings } = useSettings();
  const [range, setRange] = useState<Range>('month');
  const [stats, setStats] = useState<RunStats | null>(null);
  const [weeklyMileage, setWeeklyMileage] = useState<{ week: string; miles: number }[]>([]);
  const [typeBreakdown, setTypeBreakdown] = useState<{ type: string; miles: number }[]>([]);
  const [loading, setLoading] = useState(true);

  const [runs, setRuns] = useState<Run[]>([]);
  const [runsOffset, setRunsOffset] = useState(0);
  const [hasMoreRuns, setHasMoreRuns] = useState(false);
  const [runsLoading, setRunsLoading] = useState(false);

  useEffect(() => {
    async function load() {
      setLoading(true);
      setRuns([]);
      setRunsOffset(0);
      setHasMoreRuns(false);

      const { start, end } = getDateRange(range);
      const weeks = range === 'week' ? 1 : range === 'month' ? 4 : range === 'year' ? 52 : 52;
      const [s, wm, tb, page] = await Promise.all([
        getRunStats(db, settings.units, start, end),
        getWeeklyMileage(db, settings.units, weeks, start, end),
        getRunTypeBreakdown(db, settings.units, start, end),
        getRunsPaginated(db, {
          startDate: start,
          endDate: end,
          limit: RUNS_PAGE_SIZE,
          offset: 0,
        }),
      ]);
      setStats(s);
      setWeeklyMileage(wm);
      setTypeBreakdown(tb);
      setRuns(page);
      setRunsOffset(page.length);
      setHasMoreRuns(page.length === RUNS_PAGE_SIZE);
      setLoading(false);
    }
    load();
  }, [db, settings.units, range]);

  const loadMoreRuns = useCallback(async () => {
    if (runsLoading || !hasMoreRuns) return;
    setRunsLoading(true);
    const { start, end } = getDateRange(range);
    const page = await getRunsPaginated(db, {
      startDate: start,
      endDate: end,
      limit: RUNS_PAGE_SIZE,
      offset: runsOffset,
    });
    setRuns(prev => [...prev, ...page]);
    setRunsOffset(prev => prev + page.length);
    setHasMoreRuns(page.length === RUNS_PAGE_SIZE);
    setRunsLoading(false);
  }, [db, range, runsLoading, hasMoreRuns, runsOffset]);

  return (
    <div className="flex flex-col flex-1 overflow-y-auto pb-24">
      <Header title="Stats" />

      {/* Range Picker */}
      <div className="sticky top-0 z-20 bg-surface-elevated dark:bg-surface-dark border-b border-border dark:border-border-dark px-4 pt-3 pb-2">
        <SegmentedControl
          options={[
            { value: 'week' as Range, label: 'Week' },
            { value: 'month' as Range, label: 'Month' },
            { value: 'year' as Range, label: 'Year' },
            { value: 'all' as Range, label: 'All' },
          ]}
          value={range}
          onChange={setRange}
        />
      </div>

      {loading ? (
        <div className="flex items-center justify-center flex-1 py-20">
          <Spinner size="lg" className="text-primary-500" />
        </div>
      ) : stats ? (
        <FadeIn className="px-4 pt-4 flex flex-col gap-4">
          <Card>
            <div className="grid grid-cols-2 gap-4">
              <StatCell label="Total Distance" value={formatDistance(stats.total_distance, settings.units)} />
              <StatCell label="Total Runs" value={String(stats.total_runs)} />
              <StatCell label="Avg Pace" value={stats.avg_pace_seconds_per_unit > 0 ? formatPace(stats.avg_pace_seconds_per_unit, settings.units) : '—'} />
              <StatCell label="Longest Run" value={formatDistance(stats.longest_run_distance, settings.units)} />
              <StatCell label="Current Streak" value={`${stats.current_streak} days`} />
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

          {/* Runs for selected period */}
          <div>
            <SectionHeader title="Runs" />
            {runs.length === 0 ? (
              <p className="text-sm text-gray-400 py-4 text-center">
                No runs in this period.
              </p>
            ) : (
              <StaggerList className="flex flex-col gap-3">
                {runs.map(run => (
                  <StaggerItem key={run.id}>
                    <RunCard run={run} />
                  </StaggerItem>
                ))}
                {hasMoreRuns && (
                  <button
                    type="button"
                    onClick={loadMoreRuns}
                    disabled={runsLoading}
                    className="w-full py-3 text-sm text-primary-600 dark:text-primary-400 font-medium flex items-center justify-center gap-2"
                  >
                    {runsLoading ? <Spinner size="sm" /> : 'Load more'}
                  </button>
                )}
              </StaggerList>
            )}
          </div>
        </FadeIn>
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
