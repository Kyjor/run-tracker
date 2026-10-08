import { useEffect, useMemo, useState } from 'react';
import { addWeeks, format, startOfWeek } from 'date-fns';
import type { ActivePlan, PlanDay, Run, TrainingPlan } from '../../types';
import { ACTIVITY_COLORS, ACTIVITY_LABELS } from '../../types';
import { planDayToDate, toISO, extractDate } from '../../utils/dateUtils';
import { getPlanDays } from '../../services/planService';
import { getRunsByDateRange } from '../../services/runService';
import { formatDistance, formatDuration } from '../../utils/paceUtils';
import { useDb } from '../../contexts/DatabaseContext';
import { useSettings } from '../../contexts/SettingsContext';

interface WeekViewProps {
  activePlan: ActivePlan | null;
  activePlanDetails: TrainingPlan | null;
  selectedDate: string | null;
  onSelectDate: (date: string) => void;
  refreshToken?: number;
}

export function WeekView({
  activePlan,
  activePlanDetails,
  selectedDate,
  onSelectDate,
  refreshToken,
}: WeekViewProps) {
  const db = useDb();
  const { settings } = useSettings();
  const [anchor, setAnchor] = useState(() => startOfWeek(new Date(), { weekStartsOn: 1 }));
  const [planDays, setPlanDays] = useState<PlanDay[]>([]);
  const [runs, setRuns] = useState<Run[]>([]);

  const days = useMemo(
    () => Array.from({ length: 7 }, (_, i) => {
      const date = new Date(anchor);
      date.setDate(anchor.getDate() + i);
      return date;
    }),
    [anchor],
  );

  useEffect(() => {
    if (!activePlan || !activePlanDetails) {
      setPlanDays([]);
      return;
    }
    getPlanDays(db, activePlan.plan_id).then(setPlanDays);
  }, [db, activePlan, activePlanDetails, refreshToken]);

  useEffect(() => {
    const start = toISO(days[0]);
    const end = toISO(days[6]);
    getRunsByDateRange(db, start, end).then(setRuns);
  }, [db, days, refreshToken]);

  const planByDate = useMemo(() => {
    const map: Record<string, PlanDay> = {};
    if (!activePlan) return map;
    for (const day of planDays) {
      map[planDayToDate(activePlan.start_date, day.week_number, day.day_of_week)] = day;
    }
    return map;
  }, [planDays, activePlan]);

  const runsByDate = useMemo(() => {
    const map: Record<string, Run[]> = {};
    for (const run of runs) {
      const key = extractDate(run.date);
      if (!map[key]) map[key] = [];
      map[key].push(run);
    }
    return map;
  }, [runs]);

  return (
    <div className="px-2">
      <div className="flex items-center justify-between px-2 mb-3">
        <button type="button" onClick={() => setAnchor(d => addWeeks(d, -1))} className="p-2 text-gray-500">‹</button>
        <h2 className="text-base font-semibold text-gray-900 dark:text-white">
          {format(days[0], 'MMM d')} – {format(days[6], 'MMM d')}
        </h2>
        <button type="button" onClick={() => setAnchor(d => addWeeks(d, 1))} className="p-2 text-gray-500">›</button>
      </div>
      <div className="flex flex-col gap-2">
        {days.map(date => {
          const iso = toISO(date);
          const planDay = planByDate[iso];
          const dayRuns = runsByDate[iso] ?? [];
          const color = planDay ? ACTIVITY_COLORS[planDay.activity_type] : undefined;
          const selected = selectedDate === iso;
          return (
            <button
              key={iso}
              type="button"
              onClick={() => onSelectDate(iso)}
              className={[
                'flex items-start gap-3 rounded-card border px-3 py-3 text-left',
                selected
                  ? 'border-primary-400 bg-primary-50 dark:bg-primary-900/20'
                  : 'border-border dark:border-border-dark bg-surface dark:bg-surface-dark-elevated',
              ].join(' ')}
            >
              <div className="w-10 shrink-0">
                <p className="text-[10px] uppercase text-ink-muted">{format(date, 'EEE')}</p>
                <p className="text-lg font-semibold tabular-nums text-ink-primary dark:text-ink-dark-primary">{format(date, 'd')}</p>
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-ink-primary dark:text-ink-dark-primary">
                  {planDay ? ACTIVITY_LABELS[planDay.activity_type] : 'No plan'}
                </p>
                {planDay?.distance_value ? (
                  <p className="text-xs" style={{ color }}>{formatDistance(planDay.distance_value, settings.units)}</p>
                ) : null}
                {dayRuns.map(run => (
                  <p key={run.id} className="text-xs text-ink-secondary dark:text-ink-dark-secondary mt-0.5">
                    {formatDistance(run.distance_value, run.distance_unit)} · {formatDuration(run.duration_seconds)}
                  </p>
                ))}
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
