import { useCallback, useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { format, parseISO, subDays, startOfMonth, endOfMonth } from 'date-fns';
import type { Profile, Run, TrainingPlan, PlanDay } from '../types';
import { RUN_TYPE_LABELS, RACE_TYPE_LABELS, DIFFICULTY_LABELS, ACTIVITY_COLORS, ACTIVITY_LABELS } from '../types';
import { Header } from '../components/navigation/Header';
import { Card, SectionHeader } from '../components/ui/Card';
import { Spinner } from '../components/ui/Spinner';
import { EmptyState } from '../components/ui/EmptyState';
import { Badge } from '../components/ui/Badge';
import { FollowButton } from '../components/social/FollowButton';
import { getProfileById, getRunsByUser, getAllRunsByUser, getActivePlanByUser, getPlanDaysByUser, getTrainingPlanById } from '../services/socialService';
import { useSettings } from '../contexts/SettingsContext';
import { useAuth } from '../contexts/AuthContext';
import { formatDistance, formatDuration, formatPace } from '../utils/paceUtils';
import { calculateStatsFromRuns, calculateWeeklyMileage, calculateRunTypeBreakdown } from '../utils/calculateStatsFromRuns';
import { planDayToDate } from '../utils/dateUtils';
import { MileageChart } from '../components/charts/MileageChart';
import { RunTypeChart } from '../components/charts/RunTypeChart';
import { FriendMonthView } from '../components/calendar/FriendMonthView';
import { FriendDayDetailSheet } from '../components/calendar/FriendDayDetailSheet';
import { ActivityLegend } from '../components/calendar/ActivityLegend';

export function FriendProfileScreen() {
  const { id } = useParams<{ id: string }>();
  const { settings } = useSettings();
  const { user } = useAuth();
  const isOwnProfile = user?.id === id;

  const [profile, setProfile] = useState<Profile | null>(null);
  const [runs, setRuns] = useState<Run[]>([]);
  const [allRuns, setAllRuns] = useState<Run[]>([]);
  const [activePlan, setActivePlan] = useState<{ plan_id: string; start_date: string } | null>(null);
  const [planDetails, setPlanDetails] = useState<TrainingPlan | null>(null);
  const [planDays, setPlanDays] = useState<PlanDay[]>([]);
  const [loading, setLoading] = useState(true);
  const [runsLoading, setRunsLoading] = useState(true);
  const [runsError, setRunsError] = useState(false);
  const [planLoading, setPlanLoading] = useState(false);
  const [statsRange, setStatsRange] = useState<'week' | 'month' | 'year' | 'all'>('all');
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [selectedPlanDay, setSelectedPlanDay] = useState<PlanDay | null>(null);
  const [selectedRun, setSelectedRun] = useState<Run | null>(null);
  const [detailSheetOpen, setDetailSheetOpen] = useState(false);

  const load = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    const p = await getProfileById(id);
    setProfile(p);
    setLoading(false);
  }, [id]);

  const loadRuns = useCallback(async () => {
    if (!id) return;
    setRunsLoading(true);
    setRunsError(false);
    try {
      const [recent, all] = await Promise.all([
        getRunsByUser(id, 20),
        getAllRunsByUser(id),
      ]);
      setRuns(recent);
      setAllRuns(all);
    } catch {
      setRunsError(true);
    } finally {
      setRunsLoading(false);
    }
  }, [id]);

  const loadPlan = useCallback(async () => {
    if (!id) return;
    setPlanLoading(true);
    try {
      const ap = await getActivePlanByUser(id);
      if (ap && ap.is_active) {
        setActivePlan(ap);
        const [plan, days] = await Promise.all([
          getTrainingPlanById(ap.plan_id),
          getPlanDaysByUser(id, ap.plan_id),
        ]);
        setPlanDetails(plan);
        setPlanDays(days);
      } else {
        setActivePlan(null);
        setPlanDetails(null);
        setPlanDays([]);
      }
    } catch (error) {
      console.error('Failed to load plan:', error);
    } finally {
      setPlanLoading(false);
    }
  }, [id]);

  useEffect(() => {
    load();
    loadRuns();
    loadPlan();
  }, [load, loadRuns, loadPlan]);

  // Calculate stats based on selected range
  const getDateRange = (range: 'week' | 'month' | 'year' | 'all') => {
    const today = new Date();
    const end = format(today, 'yyyy-MM-dd');
    if (range === 'week') return { start: format(subDays(today, 6), 'yyyy-MM-dd'), end };
    if (range === 'month') return { start: format(startOfMonth(today), 'yyyy-MM-dd'), end: format(endOfMonth(today), 'yyyy-MM-dd') };
    if (range === 'year') return { start: format(new Date(today.getFullYear(), 0, 1), 'yyyy-MM-dd'), end };
    return {};
  };

  const dateRange = getDateRange(statsRange);
  const filteredRuns = dateRange.start && dateRange.end
    ? allRuns.filter(r => r.date >= dateRange.start! && r.date <= dateRange.end!)
    : allRuns;
  
  const stats = calculateStatsFromRuns(filteredRuns, settings.units);
  const weeks = statsRange === 'week' ? 1 : statsRange === 'month' ? 4 : statsRange === 'year' ? 52 : 52;
  const weeklyMileage = calculateWeeklyMileage(allRuns, settings.units, weeks, dateRange.start, dateRange.end);
  const runTypeBreakdown = calculateRunTypeBreakdown(allRuns, settings.units, dateRange.start, dateRange.end);

  // Get upcoming runs (future plan days)
  const upcomingRuns = activePlan && planDays.length > 0 ? (() => {
    const today = format(new Date(), 'yyyy-MM-dd');
    const upcoming: { date: string; planDay: PlanDay }[] = [];
    
    for (const day of planDays) {
      const dayDate = planDayToDate(activePlan.start_date, day.week_number, day.day_of_week);
      if (dayDate > today && day.activity_type !== 'rest') {
        upcoming.push({ date: dayDate, planDay: day });
        if (upcoming.length >= 7) break; // Show next 7 upcoming runs
      }
    }
    
    return upcoming.sort((a, b) => a.date.localeCompare(b.date));
  })() : [];

  async function handleSelectDate(iso: string) {
    setSelectedDate(iso);
    if (activePlan && planDays.length > 0) {
      const match = planDays.find(
        d => planDayToDate(activePlan.start_date, d.week_number, d.day_of_week) === iso,
      );
      setSelectedPlanDay(match ?? null);
    } else {
      setSelectedPlanDay(null);
    }
    const run = allRuns.find(r => r.date === iso);
    setSelectedRun(run ?? null);
    setDetailSheetOpen(true);
  }
  
  // Calculate plan progress
  const planProgress = activePlan && planDays.length > 0 ? (() => {
    const today = format(new Date(), 'yyyy-MM-dd');
    const startDate = activePlan.start_date;
    let completed = 0;
    let scheduled = 0;
    
    planDays.forEach(day => {
      const dayDate = planDayToDate(startDate, day.week_number, day.day_of_week);
      if (dayDate <= today && day.activity_type !== 'rest') {
        scheduled++;
        // Check if there's a run for this plan day
        const hasRun = allRuns.some(r => r.date === dayDate && r.plan_day_id === day.id);
        if (hasRun) completed++;
      }
    });
    
    return { completed, scheduled, percentage: scheduled > 0 ? (completed / scheduled) * 100 : 0 };
  })() : null;

  if (loading) {
    return (
      <div className="flex flex-col flex-1">
        <Header title="Profile" showBack />
        <div className="flex-1 flex items-center justify-center">
          <Spinner size="lg" className="text-primary-500" />
        </div>
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="flex flex-col flex-1">
        <Header title="Profile" showBack />
        <EmptyState emoji="🤷" title="User not found" description="This profile doesn't exist or is private." />
      </div>
    );
  }

  return (
    <div className="flex flex-col flex-1 overflow-y-auto pb-24">
      <Header title={isOwnProfile ? 'My Public Profile' : profile.display_name} showBack />

      <div className="px-4 pt-4 flex flex-col gap-4">
        {/* Profile card */}
        <Card>
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 bg-primary-100 dark:bg-primary-900/40 rounded-full flex items-center justify-center text-2xl font-bold text-primary-700 dark:text-primary-300">
              {profile.display_name?.[0]?.toUpperCase() ?? '?'}
            </div>
            <div className="flex-1">
              <p className="font-bold text-gray-900 dark:text-white text-lg">{profile.display_name}</p>
            </div>
            {!isOwnProfile && <FollowButton targetId={profile.id} />}
          </div>

        </Card>

        {/* Stats Section */}
        {allRuns.length > 0 && (
          <>
            {/* Range Picker */}
            <div className="flex gap-2 pt-2 pb-2 overflow-x-auto sticky top-0 bg-gray-50 dark:bg-gray-900 z-10 border-b border-gray-200 dark:border-gray-700 -mx-4 px-4">
              {(['week', 'month', 'year', 'all'] as const).map(r => (
                <button
                  key={r}
                  onClick={() => setStatsRange(r)}
                  className={[
                    'px-3 py-1.5 rounded-xl text-sm font-medium whitespace-nowrap transition-colors',
                    statsRange === r
                      ? 'bg-primary-600 text-white'
                      : 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400',
                  ].join(' ')}
                >
                  {r === 'week' ? 'This Week' : r === 'month' ? 'This Month' : r === 'year' ? 'This Year' : 'All Time'}
                </button>
              ))}
            </div>

            {/* Summary Stats */}
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

            {/* Weekly Mileage Chart */}
            {weeklyMileage.length > 0 && (
              <Card>
                <SectionHeader title="Weekly Mileage" />
                <MileageChart data={weeklyMileage} unit={settings.units} />
              </Card>
            )}

            {/* Run Type Breakdown Chart */}
            {runTypeBreakdown.length > 0 && (
              <Card>
                <SectionHeader title="By Run Type" />
                <RunTypeChart data={runTypeBreakdown} unit={settings.units} />
              </Card>
            )}
          </>
        )}

        {/* Active Plan & Calendar */}
        {planLoading ? (
          <Card>
            <div className="flex justify-center py-4">
              <Spinner size="sm" className="text-primary-500" />
            </div>
          </Card>
        ) : activePlan && planDetails ? (
          <>
            <Card>
              <div className="flex items-start gap-3 mb-3">
                <div className="flex-1">
                  <p className="font-semibold text-gray-900 dark:text-white text-base">{planDetails.name}</p>
                  <div className="flex gap-2 mt-1 flex-wrap">
                    <Badge label={RACE_TYPE_LABELS[planDetails.race_type]} color="#ef4444" />
                    <Badge label={DIFFICULTY_LABELS[planDetails.difficulty]} color="#6b7280" />
                    <Badge label={`${planDetails.duration_weeks} weeks`} color="#6b7280" />
                  </div>
                  {planProgress && (
                    <div className="mt-3">
                      <div className="flex items-center justify-between text-xs text-gray-400 mb-1">
                        <span>Plan Progress</span>
                        <span>{planProgress.completed}/{planProgress.scheduled} runs</span>
                      </div>
                      <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
                        <div
                          className="bg-primary-500 h-2 rounded-full transition-all"
                          style={{ width: `${planProgress.percentage}%` }}
                        />
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </Card>

            {/* Full Calendar View - Separate Card */}
            {planDays.length > 0 ? (
              <Card>
                <SectionHeader title="Training Calendar" />
                <div className="px-2">
                  <FriendMonthView
                    planDays={planDays}
                    runs={allRuns}
                    startDate={activePlan.start_date}
                    selectedDate={selectedDate}
                    onSelectDate={handleSelectDate}
                  />
                </div>
                <ActivityLegend />
              </Card>
            ) : (
              <Card>
                <p className="text-sm text-gray-500 dark:text-gray-400 text-center py-4">
                  Plan days are loading...
                </p>
              </Card>
            )}
          </>
        ) : (
          <Card>
            <p className="text-sm text-gray-500 dark:text-gray-400 text-center py-4">
              {profile?.display_name ?? 'This user'} doesn't have an active training plan.
            </p>
          </Card>
        )}

        {/* Upcoming Runs */}
        {upcomingRuns.length > 0 && (
          <Card>
            <SectionHeader title="Upcoming Runs" />
            <div className="flex flex-col gap-2">
              {upcomingRuns.map(({ date, planDay }) => {
                const color = ACTIVITY_COLORS[planDay.activity_type];
                return (
                  <div
                    key={`${date}-${planDay.id}`}
                    className="flex items-center gap-3 p-3 rounded-xl"
                    style={{ backgroundColor: color + '15' }}
                  >
                    <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: color }} />
                    <div className="flex-1">
                      <p className="text-sm font-semibold text-gray-900 dark:text-white">
                        {format(parseISO(date), 'EEE, MMM d')}
                      </p>
                      <p className="text-xs text-gray-600 dark:text-gray-400">
                        {ACTIVITY_LABELS[planDay.activity_type]}
                        {planDay.distance_value && ` · ${formatDistance(planDay.distance_value, settings.units)}`}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          </Card>
        )}

        {/* Recent runs */}
        <p className="text-sm font-semibold text-gray-700 dark:text-gray-300 px-1">Recent Runs</p>

        {runsLoading ? (
          <div className="flex justify-center py-10">
            <Spinner size="lg" className="text-primary-500" />
          </div>
        ) : runsError ? (
          <Card>
            <p className="text-sm text-gray-500 dark:text-gray-400 text-center py-4">
              Could not load runs. You may need to follow this user first, or they haven't synced yet.
            </p>
          </Card>
        ) : runs.length === 0 ? (
          <EmptyState emoji="🏃" title="No runs yet" description="This runner hasn't logged any runs." />
        ) : (
          runs.map(run => (
            <Card key={run.id} padding={false}>
              <div className="flex items-center gap-3 px-4 py-3">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-0.5">
                    <span className="text-sm font-semibold text-gray-900 dark:text-white">
                      {formatDistance(run.distance_value, run.distance_unit)}
                    </span>
                    <span className="text-xs text-gray-400">·</span>
                    <span className="text-xs text-gray-500 dark:text-gray-400">
                      {RUN_TYPE_LABELS[run.run_type]}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-gray-400">
                      {format(parseISO(run.date), 'MMM d, yyyy')}
                    </span>
                    {run.duration_seconds > 0 && (
                      <>
                        <span className="text-xs text-gray-300 dark:text-gray-600">·</span>
                        <span className="text-xs text-gray-400">{formatDuration(run.duration_seconds)}</span>
                      </>
                    )}
                  </div>
                  {run.notes ? (
                    <p className="text-xs text-gray-400 mt-1 italic">{run.notes}</p>
                  ) : null}
                </div>
              </div>
            </Card>
          ))
        )}
      </div>

      {/* Day Detail Sheet */}
      <FriendDayDetailSheet
        isOpen={detailSheetOpen}
        onClose={() => setDetailSheetOpen(false)}
        date={selectedDate}
        planDay={selectedPlanDay}
        run={selectedRun}
      />
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

