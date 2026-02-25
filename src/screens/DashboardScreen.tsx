import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import type { GoalProgress, RunStats, FeedItem, Run } from '../types';
import { Header } from '../components/navigation/Header';
import { TodayActivityCard } from '../components/run/TodayActivityCard';
import { RunCard } from '../components/run/RunCard';
import { ActivityFeedItem } from '../components/social/ActivityFeedItem';
import { Card, SectionHeader } from '../components/ui/Card';
import { ProgressRing } from '../components/ui/ProgressRing';
import { EmptyState } from '../components/ui/EmptyState';
import { Spinner } from '../components/ui/Spinner';
import { Button } from '../components/ui/Button';
import { PullToRefresh } from '../components/ui/PullToRefresh';
import { usePlan } from '../contexts/PlanContext';
import { useDb } from '../contexts/DatabaseContext';
import { useSettings } from '../contexts/SettingsContext';
import { useToast } from '../contexts/ToastContext';
import { useAuth } from '../contexts/AuthContext';
import { getRuns } from '../services/runService';
import { getActiveGoals, getGoalProgress } from '../services/goalService';
import { getRunStats } from '../services/statsService';
import { getFeed, toggleLike } from '../services/socialService';
import type { HealthKitWorkout } from '../services/healthkitService';
import { requestHealthKitPermission, fetchHealthKitWorkouts, workoutExists, importHealthKitWorkout } from '../services/healthkitService';
import { format, startOfWeek, endOfWeek, parseISO } from 'date-fns';
import { formatDistance } from '../utils/paceUtils';

const FEED_PAGE_SIZE = 5;

export function DashboardScreen() {
  const navigate = useNavigate();
  const db = useDb();
  const { settings } = useSettings();
  const { user } = useAuth();
  const { todayActivity, weekNumber, dayOfWeek, isLoading } = usePlan();
  const { showToast } = useToast();

  const [recentRuns, setRecentRuns] = useState<Run[]>([]);
  const [goalProgress, setGoalProgress] = useState<GoalProgress[]>([]);
  const [weekStats, setWeekStats] = useState<RunStats | null>(null);
  const [dataLoading, setDataLoading] = useState(true);
  const [todayWorkouts, setTodayWorkouts] = useState<Array<HealthKitWorkout & { alreadyImported: boolean }>>([]);
  const [importingWorkoutId, setImportingWorkoutId] = useState<string | null>(null);

  // Friends feed
  const [feed, setFeed] = useState<FeedItem[]>([]);
  const [feedOffset, setFeedOffset] = useState(0);
  const [feedLoading, setFeedLoading] = useState(false);
  const [hasMore, setHasMore] = useState(true);

  async function refreshTodayHealthKitWorkouts() {
    if (!db) return;
    try {
      const hasHKPermission = await requestHealthKitPermission();
      if (!hasHKPermission) {
        setTodayWorkouts([]);
        return;
      }
      const dayStart = new Date();
      dayStart.setHours(0, 0, 0, 0);
      const now = new Date();
      const raw = await fetchHealthKitWorkouts(dayStart.toISOString(), now.toISOString());
      // Extra safety: filter on the client as well so mock/non‑iOS paths and
      // any older native builds still only show *today's* workouts here.
      const todayStartMs = dayStart.getTime();
      const todayEndMs = now.getTime();
      const onlyToday = raw.filter(w => {
        const t = new Date(w.start_date).getTime();
        return t >= todayStartMs && t <= todayEndMs;
      });

      const withStatus = await Promise.all(
        onlyToday.map(async w => ({
          ...w,
          alreadyImported: await workoutExists(db, w, settings.units),
        })),
      );
      setTodayWorkouts(withStatus);
    } catch (err) {
      console.error('Failed to load today HealthKit workouts:', err);
      setTodayWorkouts([]);
    }
  }

  useEffect(() => {
    if (!db) return;
    async function load() {
      const today = format(new Date(), 'yyyy-MM-dd');
      const weekStart = format(startOfWeek(new Date(), { weekStartsOn: 1 }), 'yyyy-MM-dd');
      const weekEnd = format(endOfWeek(new Date(), { weekStartsOn: 1 }), 'yyyy-MM-dd');

      const [runs, goals, stats] = await Promise.all([
        getRuns(db, 5),
        getActiveGoals(db, today),
        getRunStats(db, settings.units, weekStart, weekEnd),
      ]);
      setRecentRuns(runs);
      setWeekStats(stats);

      const progressArr = await Promise.all(goals.map(g => getGoalProgress(db, g)));
      setGoalProgress(progressArr);
      await refreshTodayHealthKitWorkouts();
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
      getRuns(db, 5),
      getActiveGoals(db, today),
      getRunStats(db, settings.units, weekStart, weekEnd),
    ]);
    setRecentRuns(runs);
    setWeekStats(stats);

    const progressArr = await Promise.all(goals.map(g => getGoalProgress(db, g)));
    setGoalProgress(progressArr);
    await refreshTodayHealthKitWorkouts();
    setDataLoading(false);

    // Also refresh feed if user is logged in
    if (user) {
      await refreshFeed();
    }
  }, [db, settings.units, user, refreshFeed]);

  const unimportedTodayWorkouts = todayWorkouts.filter(w => !w.alreadyImported);

  async function handleImportTodayWorkout(workout: HealthKitWorkout & { alreadyImported: boolean }) {
    if (!db || workout.alreadyImported) return;
    setImportingWorkoutId(workout.id);
    try {
      const result = await importHealthKitWorkout(db, workout, settings.units, settings.max_heart_rate_bpm);
      if (result.success) {
        showToast('Workout imported!', 'success');
        setTodayWorkouts(prev =>
          prev.map(w => (w.id === workout.id ? { ...w, alreadyImported: true } : w)),
        );
        await handleRefresh();
      } else if (result.error) {
        showToast(result.error, 'error');
      }
    } catch (err) {
      console.error('Failed to import workout from dashboard:', err);
      showToast('Failed to import workout', 'error');
    } finally {
      setImportingWorkoutId(null);
    }
  }

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
        <div className="px-4 pt-4 pb-24 flex flex-col gap-4">
        {unimportedTodayWorkouts.length > 0 && (
          <Card className="border border-primary-200 dark:border-primary-800 bg-primary-50 dark:bg-primary-900/20">
            <div className="flex flex-col gap-3">
              <div className="flex items-start gap-3">
                <div className="text-xl">💡</div>
                <div className="flex-1">
                  <p className="text-sm font-semibold text-gray-900 dark:text-gray-100">
                    I noticed you worked out today
                  </p>
                  <p className="text-xs text-gray-600 dark:text-gray-300 mt-1">
                    Import today&apos;s HealthKit workouts directly from here.
                  </p>
                </div>
              </div>
              <div className="flex flex-col gap-2">
                {unimportedTodayWorkouts.map(w => {
                  const distanceKm = (w.distance_meters ?? 0) / 1000;
                  const distanceMi = distanceKm * 0.621371;
                  const distVal = settings.units === 'mi' ? distanceMi : distanceKm;
                  const distLabel = distVal > 0 ? `${distVal.toFixed(2)} ${settings.units}` : 'No distance';
                  const d = parseISO(w.start_date);
                  const timeLabel = format(d, 'p');
                  const durationMinutes = Math.floor(w.duration_seconds / 60);
                  const durationSeconds = Math.floor(w.duration_seconds % 60);
                  const durationStr = `${durationMinutes}:${durationSeconds.toString().padStart(2, '0')}`;
                  return (
                    <div
                      key={w.id}
                      className="flex items-center justify-between gap-3 px-3 py-2 rounded-xl bg-white/80 dark:bg-gray-900/60"
                    >
                      <div className="flex flex-col text-xs text-gray-700 dark:text-gray-200">
                        <span className="font-medium">{timeLabel}</span>
                        <span className="text-gray-500 dark:text-gray-400">
                          {distLabel} · {durationStr}
                        </span>
                      </div>
                      <Button
                        size="sm"
                        onClick={() => handleImportTodayWorkout(w)}
                        disabled={importingWorkoutId === w.id}
                        isLoading={importingWorkoutId === w.id}
                      >
                        Import
                      </Button>
                    </div>
                  );
                })}
              </div>
            </div>
          </Card>
        )}

        {/* Today's Activity */}
        <div>
          <SectionHeader title="Today" />
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

        {/* Week stats */}
        {weekStats && weekStats.total_runs > 0 && (
          <div>
            <SectionHeader title="This Week" action={
              <button className="text-xs text-primary-600 dark:text-primary-400" onClick={() => navigate('/stats')}>
                See All →
              </button>
            } />
            <Card>
              <div className="flex justify-around">
                <StatPill label="Runs" value={String(weekStats.total_runs)} />
                <StatPill label={settings.units} value={weekStats.total_distance.toFixed(1)} />
                <StatPill label="Streak" value={`${weekStats.current_streak}d 🔥`} />
              </div>
            </Card>
          </div>
        )}

        {/* Goal progress */}
        {goalProgress.length > 0 && (
          <div>
            <SectionHeader title="Goals" action={
              <button className="text-xs text-primary-600 dark:text-primary-400" onClick={() => navigate('/profile/goals')}>
                Manage →
              </button>
            } />
            <div className="flex flex-col gap-2">
              {goalProgress.map(gp => (
                <Card key={gp.goal.id} padding={false}>
                  <div className="flex items-center gap-4 p-4">
                    <ProgressRing value={gp.percentage} size={56} strokeWidth={5} color="#3b82f6">
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

        {/* Recent Runs */}
        <div>
          <SectionHeader title="Recent Runs" action={
            <button className="text-xs text-primary-600 dark:text-primary-400" onClick={() => navigate('/stats')}>
              All runs →
            </button>
          } />
          {recentRuns.length === 0 ? (
            <EmptyState
              emoji="👟"
              title="No runs yet"
              description="Log your first run to start tracking your progress."
              action={<Button size="sm" onClick={() => navigate('/log/manual')}>Log a Run</Button>}
            />
          ) : (
            <div className="flex flex-col gap-2">
              {recentRuns.map(r => (
                <RunCard key={r.id} run={r} onClick={() => navigate(`/runs/${r.id}`)} />
              ))}
            </div>
          )}
        </div>

        {/* Friends Feed */}
        {user && (
          <div>
            <SectionHeader title="Friends" action={
              <button className="text-xs text-primary-600 dark:text-primary-400" onClick={() => navigate('/social')}>
                See all →
              </button>
            } />
            {feedLoading && feed.length === 0 ? (
              <div className="flex justify-center py-8">
                <Spinner size="lg" className="text-primary-500" />
              </div>
            ) : feed.length === 0 ? (
              <Card className="text-center py-4">
                <p className="text-sm text-gray-500 dark:text-gray-400 mb-3">
                  Follow friends to see their activity here.
                </p>
                <Button size="sm" onClick={() => navigate('/social/search')}>Find Friends</Button>
              </Card>
            ) : (
              <div className="flex flex-col gap-2">
                {feed.map(item => (
                  <ActivityFeedItem
                    key={item.id}
                    item={item}
                    onLike={() => handleFeedLike(item)}
                    onCommentAdded={() => {
                      // Refresh feed to update comment counts
                      refreshFeed();
                    }}
                  />
                ))}
                {hasMore && (
                  <button
                    onClick={loadMoreFeed}
                    disabled={feedLoading}
                    className="w-full py-3 text-sm text-primary-600 dark:text-primary-400 font-medium flex items-center justify-center gap-2"
                  >
                    {feedLoading ? <Spinner size="sm" /> : 'Load more'}
                  </button>
                )}
              </div>
            )}
          </div>
        )}
        </div>
      </PullToRefresh>
    </div>
  );
}

function StatPill({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col items-center">
      <span className="text-lg font-bold text-gray-900 dark:text-white">{value}</span>
      <span className="text-xs text-gray-400 uppercase tracking-wide">{label}</span>
    </div>
  );
}

function getGreeting(): string {
  const h = new Date().getHours();
  if (h < 12) return 'morning';
  if (h < 17) return 'afternoon';
  return 'evening';
}

