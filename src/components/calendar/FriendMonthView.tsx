import { useMemo, useState } from 'react';
import { addMonths, subMonths } from 'date-fns';
import type { PlanDay, Run } from '../../types';
import { calendarGridDates, formatMonthYear, toISO, planDayToDate, isToday } from '../../utils/dateUtils';
import { DayCell } from './DayCell';

interface FriendMonthViewProps {
  planDays: PlanDay[];
  runs: Run[];
  startDate: string;
  onSelectDate: (date: string) => void;
  selectedDate: string | null;
}

const WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

export function FriendMonthView({ planDays, runs, startDate, onSelectDate, selectedDate }: FriendMonthViewProps) {
  const [viewDate, setViewDate] = useState(new Date());

  const gridDates = useMemo(() => calendarGridDates(viewDate.getFullYear(), viewDate.getMonth()), [viewDate]);

  // Build map: isoDate -> PlanDay
  const planDayMap = useMemo(() => {
    const map: Record<string, PlanDay> = {};
    for (const day of planDays) {
      const isoDate = planDayToDate(startDate, day.week_number, day.day_of_week);
      map[isoDate] = day;
    }
    return map;
  }, [planDays, startDate]);

  // Build map: isoDate -> Run (use first run if multiple)
  const runMap = useMemo(() => {
    const map: Record<string, Run> = {};
    for (const run of runs) {
      if (!map[run.date]) map[run.date] = run;
    }
    return map;
  }, [runs]);

  const currentMonth = viewDate.getMonth();

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between px-4 mb-4">
        <button
          onClick={() => setViewDate(d => subMonths(d, 1))}
          className="p-2 text-gray-500 dark:text-gray-400 active:opacity-60"
        >
          ‹
        </button>
        <h2 className="text-base font-semibold text-gray-900 dark:text-white">
          {formatMonthYear(viewDate)}
        </h2>
        <button
          onClick={() => setViewDate(d => addMonths(d, 1))}
          className="p-2 text-gray-500 dark:text-gray-400 active:opacity-60"
        >
          ›
        </button>
      </div>

      {/* Weekday labels */}
      <div className="grid grid-cols-7 mb-1 px-1">
        {WEEKDAYS.map(d => (
          <div key={d} className="text-center text-xs font-medium text-gray-400 dark:text-gray-500 py-1">
            {d}
          </div>
        ))}
      </div>

      {/* Grid */}
      <div className="grid grid-cols-7 gap-y-1 px-1">
        {gridDates.map(date => {
          const iso = toISO(date);
          return (
            <DayCell
              key={iso}
              date={date}
              planDay={planDayMap[iso] ?? null}
              run={runMap[iso] ?? null}
              isCurrentMonth={date.getMonth() === currentMonth}
              isToday={isToday(date)}
              isSelected={selectedDate === iso}
              onClick={() => onSelectDate(iso)}
            />
          );
        })}
      </div>
    </div>
  );
}

