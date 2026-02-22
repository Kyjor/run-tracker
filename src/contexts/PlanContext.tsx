import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';
import type { TrainingPlan, ActivePlan, TodayActivity } from '../types';
import { getActivePlan, getPlanById, getPlanDayForDate } from '../services/planService';
import { getRunForPlanDay } from '../services/runService';
import { currentPlanPosition } from '../utils/dateUtils';
import { useDatabase } from './DatabaseContext';

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
          let loggedRun = null;
          if (planDay) {
            loggedRun = await getRunForPlanDay(db, planDay.id);
          }
          setTodayActivity({
            plan_day: planDay,
            is_completed: !!loggedRun,
            logged_run: loggedRun,
          });
        } else {
          setTodayActivity({ plan_day: null, is_completed: false, logged_run: null });
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

