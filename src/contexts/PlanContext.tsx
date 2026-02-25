import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';
import type { TrainingPlan, ActivePlan, TodayActivity, DistanceUnit, Run } from '../types';
import { getActivePlan, getPlanById, getPlanDayForDate } from '../services/planService';
import { getRunsForDate } from '../services/runService';
import { currentPlanPosition, today, extractDate } from '../utils/dateUtils';
import { useDatabase } from './DatabaseContext';
import { convertDistance } from '../utils/paceUtils';

interface PlanContextValue {
  activePlan: ActivePlan | null;
  activePlanDetails: TrainingPlan | null;
  todayActivity: TodayActivity | null;
  weekNumber: number | null;
  dayOfWeek: number | null;
  isLoading: boolean;
  refresh: () => Promise<void>;
}

const PlanContext = createContext<PlanContextValue>({
  activePlan: null,
  activePlanDetails: null,
  todayActivity: null,
  weekNumber: null,
  dayOfWeek: null,
  isLoading: true,
  refresh: async () => {},
});

export function PlanProvider({ children }: { children: React.ReactNode }) {
  const { db, isReady } = useDatabase();
  const [activePlan, setActivePlan] = useState<ActivePlan | null>(null);
  const [activePlanDetails, setActivePlanDetails] = useState<TrainingPlan | null>(null);
  const [todayActivity, setTodayActivity] = useState<TodayActivity | null>(null);
  const [weekNumber, setWeekNumber] = useState<number | null>(null);
  const [dayOfWeek, setDayOfWeek] = useState<number | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const load = useCallback(async () => {
    if (!db) return;
    setIsLoading(true);
    try {
      const ap = await getActivePlan(db);
      setActivePlan(ap);

      if (ap) {
        const details = await getPlanById(db, ap.plan_id);
        setActivePlanDetails(details);

        const pos = details ? currentPlanPosition(ap.start_date, details.duration_weeks) : null;
        setWeekNumber(pos?.weekNumber ?? null);
        setDayOfWeek(pos?.dayOfWeek ?? null);

        if (pos && details) {
          const planDay = await getPlanDayForDate(db, ap.plan_id, pos.weekNumber, pos.dayOfWeek);

          let loggedRun: Run | null = null;
          let isCompleted = false;

          if (planDay) {
            const todayDate = today();

            // Fetch all runs logged today (manual + HealthKit), regardless of plan_day_id.
            const todaysRuns = await getRunsForDate(db, todayDate);

            // Filter to only runs actually on "today" by date portion, as extra safety.
            const todaysRunsExact = todaysRuns.filter(
              r => extractDate(r.date) === todayDate,
            );

            // Choose a representative run for UI display:
            // - Prefer a run explicitly linked to this plan day
            // - Fallback to the latest run today (if any)
            loggedRun =
              todaysRunsExact.find(r => r.plan_day_id === planDay.id) ??
              (todaysRunsExact.length > 0
                ? todaysRunsExact[todaysRunsExact.length - 1]
                : null);

            // For run-type days with a planned distance, consider the day completed
            // when the *sum* of today's runs meets or exceeds the planned distance.
            const runLikeActivities = ['easy_run', 'pace_run', 'tempo_run', 'long_run', 'intervals', 'race'];
            const hasPlannedDistance =
              planDay.distance_value != null && planDay.distance_value > 0;
            const isRunDay = runLikeActivities.includes(planDay.activity_type);

            if (isRunDay && hasPlannedDistance) {
              const targetUnit: DistanceUnit = (planDay.distance_unit as DistanceUnit) ?? 'mi';

              const totalDistanceInPlanUnits = todaysRunsExact.reduce((sum, r) => {
                return (
                  sum +
                  convertDistance(
                    r.distance_value,
                    r.distance_unit as DistanceUnit,
                    targetUnit,
                  )
                );
              }, 0);

              if (totalDistanceInPlanUnits + 1e-6 >= planDay.distance_value!) {
                isCompleted = true;
              }

              setTodayActivity({
                plan_day: planDay,
                is_completed: isCompleted,
                logged_run: loggedRun,
                todays_runs: todaysRunsExact,
                total_distance: totalDistanceInPlanUnits,
              });
            } else {
              // For non-distance-based days, fall back to simple "any run logged" semantics.
              if (loggedRun) {
                isCompleted = true;
              }
              setTodayActivity({
                plan_day: planDay,
                is_completed: isCompleted,
                logged_run: loggedRun,
                todays_runs: todaysRunsExact,
                total_distance: 0,
              });
            }
          } else {
            setTodayActivity({
              plan_day: planDay,
              is_completed: false,
              logged_run: null,
              todays_runs: [],
              total_distance: 0,
            });
          }
        } else {
          setTodayActivity({ plan_day: null, is_completed: false, logged_run: null, todays_runs: [], total_distance: 0 });
        }
      } else {
        setActivePlanDetails(null);
        setTodayActivity(null);
        setWeekNumber(null);
        setDayOfWeek(null);
      }
    } finally {
      setIsLoading(false);
    }
  }, [db]);

  useEffect(() => {
    if (isReady) load();
  }, [isReady, load]);

  return (
    <PlanContext.Provider value={{
      activePlan,
      activePlanDetails,
      todayActivity,
      weekNumber,
      dayOfWeek,
      isLoading,
      refresh: load,
    }}>
      {children}
    </PlanContext.Provider>
  );
}

export function usePlan() {
  return useContext(PlanContext);
}

