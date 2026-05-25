import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import type { GoalProgress, RunStats, FeedItem, Run } from '../types';
import { Header } from '../components/navigation/Header';
import { TodayActivityCard } from '../components/run/TodayActivityCard';
import { LastRunCard } from '../components/run/LastRunCard';
import { ActivityFeedCard } from '../components/social/ActivityFeedCard';
import { StaggerList, StaggerItem } from '../components/motion/StaggerList';
import { Card, SectionHeader } from '../components/ui/Card';
import { ProgressRing } from '../components/ui/ProgressRing';
import { EmptyState } from '../components/ui/EmptyState';
import { Spinner } from '../components/ui/Spinner';
import { Button } from '../components/ui/Button';
import { PullToRefresh } from '../components/ui/PullToRefresh';
import { usePlan } from '../contexts/PlanContext';
import { useDb } from '../contexts/DatabaseContext';
import { useSettings } from '../contexts/SettingsContext';

import { useAuth } from '../contexts/AuthContext';
import { getRuns } from '../services/runService';
import { getActiveGoals, getGoalProgress } from '../services/goalService';
import { getRunStats } from '../services/statsService';
import { getFeed, toggleLike } from '../services/socialService';
import { format, startOfWeek, endOfWeek } from 'date-fns';
import { formatDistance } from '../utils/paceUtils';

const FEED_PAGE_SIZE = 5;

export function DashboardScreen() {
  const navigate = useNavigate();
  const db = useDb();
  const { settings } = useSettings();
  const { user } = useAuth();
  const { todayActivity, weekNumber, dayOfWeek, isLoading } = usePlan();

  const [lastRun, setLastRun] = useState<Run | null>(null);
  const [goalProgress, setGoalProgress] = useState<GoalProgress[]>([]);
  const [weekStats, setWeekStats] = useState<RunStats | null>(null);
  const [dataLoading, setDataLoading] = useState(true);

  // Friends feed
  const [feed, setFeed] = useState<FeedItem[]>([]);
  const [feedOffset, setFeedOffset] = useState(0);
  const [feedLoading, setFeedLoading] = useState(false);
  const [hasMore, setHasMore] = useState(true);

  useEffect(() => {
    if (!db) return;
    async function load() {
      const today = format(new Date(), 'yyyy-MM-dd');
      const weekStart = format(startOfWeek(new Date(), { weekStartsOn: 1 }), 'yyyy-MM-dd');
      const weekEnd = format(endOfWeek(new Date(), { weekStartsOn: 1 }), 'yyyy-MM-dd');

      const [runs, goals, stats] = await Promise.all([
        getRuns(db, 1),
        getActiveGoals(db, today),
        getRunStats(db, settings.units, weekStart, weekEnd),
      ]);
      setLastRun(runs[0] ?? null);
      setWeekStats(stats);

      const progressArr = await Promise.all(goals.map(g => getGoalProgress(db, g)));
      setGoalProgress(progressArr);
      setDataLoading(false);
    }
    load();
  }, [db, settings.units]);

  const refreshFeed = useCallback(async () => {
    if (!user) return;
    setFeedLoading(true);
    const items = await getFeed(FEED_PAGE_SIZE, 0);
    setFeed(items);
    setHasMore(items.length === FEED_PAGE_SIZE);
    setFeedOffset(items.length);
    setFeedLoading(false);
  }, [user]);

  // Load initial feed page when user is available
  useEffect(() => {
    refreshFeed();
  }, [refreshFeed]);

  const loadMoreFeed = useCallback(async () => {
    if (feedLoading || !hasMore) return;
    setFeedLoading(true);
    const items = await getFeed(FEED_PAGE_SIZE, feedOffset);
    setFeed(prev => [...prev, ...items]);
    setHasMore(items.length === FEED_PAGE_SIZE);
    setFeedOffset(prev => prev + items.length);
    setFeedLoading(false);
  }, [feedLoading, hasMore, feedOffset]);

  async function handleFeedLike(item: FeedItem) {
    await toggleLike(item.id);
    setFeed(prev => prev.map(f =>
      f.id === item.id
        ? { ...f, user_has_liked: !f.user_has_liked, likes_count: (f.likes_count ?? 0) + (f.user_has_liked ? -1 : 1) }
        : f,
    ));
  }

  // Refresh all dashboard data
  const handleRefresh = useCallback(async () => {
    if (!db) return;
    setDataLoading(true);
    const today = format(new Date(), 'yyyy-MM-dd');
    const weekStart = format(startOfWeek(new Date(), { weekStartsOn: 1 }), 'yyyy-MM-dd');
    const weekEnd = format(endOfWeek(new Date(), { weekStartsOn: 1 }), 'yyyy-MM-dd');

    const [runs, goals, stats] = await Promise.all([
      getRuns(db, 1),
      getActiveGoals(db, today),
      getRunStats(db, settings.units, weekStart, weekEnd),
    ]);
    setLastRun(runs[0] ?? null);
    setWeekStats(stats);

    const progressArr = await Promise.all(goals.map(g => getGoalProgress(db, g)));
    setGoalProgress(progressArr);
    setDataLoading(false);

    // Also refresh feed if user is logged in
    if (user) {
      await refreshFeed();
    }
  }, [db, settings.units, user, refreshFeed]);

  // Compute week run progress
  const weekProgress = { completed: 0, total: 0 };
  // This could be derived from plan days vs runs in week; simple count for now

  if (isLoading || dataLoading) {
    return (
      <div className="flex items-center justify-center flex-1">
        <Spinner size="lg" className="text-primary-500" />
      </div>
    );
  }

  return (
    <div className="flex flex-col flex-1 overflow-hidden">
      <Header
        title={`Good ${getGreeting()}, ${user?.user_metadata?.display_name ?? user?.email?.split('@')[0] ?? 'Runner'}`}
        subtitle={format(new Date(), 'EEEE, MMMM d')}
      />

      <PullToRefresh onRefresh={handleRefresh}>
        <div className="px-4 pt-4 pb-24 flex flex-col gap-section">

        {/* Today + This Week combined */}
        <div>
          <SectionHeader title="Today" action={
            weekStats && weekStats.total_runs > 0 ? (
              <button type="button" className="text-xs font-medium text-primary-600 dark:text-primary-400" onClick={() => navigate('/stats')}>
                See all
              </button>
            ) : undefined
          } />

          {weekStats && weekStats.total_runs > 0 && (
            <div className="flex items-center gap-3 mb-3 px-1">
              <WeekStat label="Runs" value={String(weekStats.total_runs)} />
              <span className="text-gray-300 dark:text-gray-600">·</span>
              <WeekStat label={settings.units} value={weekStats.total_distance.toFixed(1)} />
              <span className="text-gray-300 dark:text-gray-600">·</span>
              <WeekStat label="streak" value={`${weekStats.current_streak}d`} />
              <span className="ml-auto text-[10px] text-ink-muted dark:text-ink-dark-muted uppercase tracking-wide">this week</span>
            </div>
          )}

          {todayActivity ? (
            <TodayActivityCard
              activity={todayActivity}
              weekNumber={weekNumber}
              dayOfWeek={dayOfWeek}
              weekProgress={weekProgress}
            />
          ) : (
            <Card className="text-center py-6">
              <p className="text-gray-500 dark:text-gray-400 text-sm mb-3">No active plan</p>
              <Button size="sm" onClick={() => navigate('/profile/plans')}>
                Browse Plans
              </Button>
            </Card>
          )}
        </div>

        {/* Last run */}
        <div>
          <SectionHeader title="Your last run" action={
            <button type="button" className="text-xs font-medium text-primary-600 dark:text-primary-400" onClick={() => navigate('/stats')}>
              All runs
            </button>
          } />
          {lastRun ? (
            <LastRunCard
              run={lastRun}
              units={settings.units}
              onClick={() => navigate(`/runs/${lastRun.id}`)}
            />
          ) : (
            <EmptyState
              title="No runs yet"
              description="Log your first run to start tracking your progress."
              action={<Button size="sm" onClick={() => navigate('/log/manual')}>Log a Run</Button>}
            />
          )}
        </div>

        {/* Goal progress */}
        {goalProgress.length > 0 && (
          <div>
            <SectionHeader title="Goals" action={
              <button type="button" className="text-xs font-medium text-primary-600 dark:text-primary-400" onClick={() => navigate('/profile/goals')}>
                Manage
              </button>
            } />
            <div className="flex flex-col gap-2">
              {goalProgress.map(gp => (
                <Card key={gp.goal.id} padding={false}>
                  <div className="flex items-center gap-4 p-4">
                    <ProgressRing value={gp.percentage} size={56} strokeWidth={5} color="#6366f1">
                      <span className="text-[10px] font-bold text-gray-700 dark:text-gray-200">
                        {Math.round(gp.percentage)}%
                      </span>
                    </ProgressRing>
                    <div>
                      <p className="text-sm font-medium text-gray-800 dark:text-gray-100 capitalize">
                        {gp.goal.type} goal
                      </p>
                      <p className="text-xs text-gray-500">
                        {formatDistance(gp.current_value, gp.goal.target_unit)} / {formatDistance(gp.goal.target_value, gp.goal.target_unit)}
                      </p>
                      {gp.remaining > 0 && (
                        <p className="text-xs text-gray-400">
                          {formatDistance(gp.remaining, gp.goal.target_unit)} to go
                        </p>
                      )}
                    </div>
                  </div>
                </Card>
              ))}
            </div>
          </div>
        )}

        {/* Friends feed */}
        {user && (
          <div>
            <SectionHeader title="Friends" action={
              <button type="button" className="text-xs font-medium text-primary-600 dark:text-primary-400" onClick={() => navigate('/social')}>
                See all
              </button>
            } />
            {feedLoading && feed.length === 0 ? (
              <div className="flex flex-col gap-3">
                {[1, 2].map(i => (
                  <div key={i} className="rounded-card bg-surface dark:bg-surface-dark-elevated border border-border dark:border-border-dark overflow-hidden animate-pulse">
                    <div className="h-12 m-4 bg-gray-100 dark:bg-gray-700 rounded-xl" />
                    <div className="aspect-[16/9] bg-gray-100 dark:bg-gray-800" />
                  </div>
                ))}
              </div>
            ) : feed.length === 0 ? (
              <Card className="text-center py-6">
                <p className="text-sm text-ink-secondary dark:text-ink-dark-secondary mb-3">
                  Follow friends to see their runs here.
                </p>
                <Button size="sm" onClick={() => navigate('/social/search')}>Find Friends</Button>
              </Card>
            ) : (
              <StaggerList className="flex flex-col gap-3">
                {feed.map(item => (
                  <StaggerItem key={item.id}>
                    <ActivityFeedCard
                      item={item}
                      onLike={() => handleFeedLike(item)}
                      onCommentAdded={() => refreshFeed()}
                    />
                  </StaggerItem>
                ))}
                {hasMore && (
                  <button
                    type="button"
                    onClick={loadMoreFeed}
                    disabled={feedLoading}
                    className="w-full py-3 text-sm text-primary-600 dark:text-primary-400 font-medium flex items-center justify-center gap-2"
                  >
                    {feedLoading ? <Spinner size="sm" /> : 'Load more'}
                  </button>
                )}
              </StaggerList>
            )}
          </div>
        )}

        </div>
      </PullToRefresh>
    </div>
  );
}

function WeekStat({ label, value }: { label: string; value: string }) {
  return (
    <span className="text-sm text-ink-primary dark:text-ink-dark-primary">
      <span className="font-semibold">{value}</span>
      {' '}
      <span className="text-ink-muted dark:text-ink-dark-muted text-xs">{label}</span>
    </span>
  );
}

function getGreeting(): string {
  const h = new Date().getHours();
  if (h < 12) return 'morning';
  if (h < 17) return 'afternoon';
  return 'evening';
}

