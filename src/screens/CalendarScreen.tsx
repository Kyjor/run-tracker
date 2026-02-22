import React, { useEffect, useState } from 'react';
import type { PlanDay, Run } from '../types';
import { Header } from '../components/navigation/Header';
import { MonthView } from '../components/calendar/MonthView';
import { DayDetailSheet } from '../components/calendar/DayDetailSheet';
import { usePlan } from '../contexts/PlanContext';
import { useDb } from '../contexts/DatabaseContext';
import { getPlanDayForDate, getPlanDays } from '../services/planService';
import { getRunsForDate } from '../services/runService';
import { today, planDayToDate } from '../utils/dateUtils';
import { ActivityLegend } from '../components/calendar/ActivityLegend';

export function CalendarScreen() {
  const db = useDb();
  const { activePlan, activePlanDetails } = usePlan();
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [selectedPlanDay, setSelectedPlanDay] = useState<PlanDay | null>(null);
  const [selectedRun, setSelectedRun] = useState<Run | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);

  async function handleSelectDate(iso: string) {
    setSelectedDate(iso);
    // Load plan day for this date
    if (activePlan && activePlanDetails) {
      const allDays = await getPlanDays(db, activePlan.plan_id);
      const match = allDays.find(d => planDayToDate(activePlan.start_date, d.week_number, d.day_of_week) === iso);
      setSelectedPlanDay(match ?? null);
    } else {
      setSelectedPlanDay(null);
    }
    const runs = await getRunsForDate(db, iso);
    setSelectedRun(runs[0] ?? null);
    setSheetOpen(true);
  }

  return (
    <div className="flex flex-col flex-1 overflow-y-auto pb-24">
      <Header
        title="Calendar"
        subtitle={activePlanDetails ? activePlanDetails.name : 'No active plan'}
      />

      <div className="px-2 pt-4">
        <MonthView
          activePlan={activePlan}
          activePlanDetails={activePlanDetails}
          selectedDate={selectedDate}
          onSelectDate={handleSelectDate}
        />
      </div>

      <ActivityLegend />

      <DayDetailSheet
        isOpen={sheetOpen}
        onClose={() => setSheetOpen(false)}
        date={selectedDate}
        planDay={selectedPlanDay}
        run={selectedRun}
      />
    </div>
  );
}

