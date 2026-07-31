import { useEffect, useState } from 'react';
import type { PlanDay, Run, RunType, DistanceUnit } from '../../types';
import { RUN_TYPE_LABELS } from '../../types';
import { Input, Textarea } from '../ui/Input';
import { Select } from '../ui/Select';
import { Button } from '../ui/Button';
import { GearPicker } from '../gear/GearPicker';
import { today, extractDate } from '../../utils/dateUtils';
import { formatPace, calcPaceSeconds } from '../../utils/paceUtils';
import { parseISO, format } from 'date-fns';
import { useSettings } from '../../contexts/SettingsContext';
import { useDb } from '../../contexts/DatabaseContext';
import { getDefaultGearIds, getGearForRun } from '../../services/gearService';

interface RunFormValues {
  date: string;
  time: string;
  distance_value: string;
  distance_unit: DistanceUnit;
  hours: string;
  minutes: string;
  seconds: string;
  run_type: RunType;
  notes: string;
  avg_heart_rate: string;
  max_heart_rate: string;
}

interface RunFormProps {
  initialDate?: string;
  prefillPlanDay?: PlanDay | null;
  existingRun?: Run | null;
  onSubmit: (values: {
    date: string;
    distance_value: number;
    distance_unit: DistanceUnit;
    duration_seconds: number;
    run_type: RunType;
    plan_day_id?: string;
    notes: string;
    avg_heart_rate?: number | null;
    max_heart_rate?: number | null;
    gear_ids: string[];
  }) => Promise<void>;
  isLoading?: boolean;
}

const RUN_TYPE_OPTIONS = Object.entries(RUN_TYPE_LABELS).map(([value, label]) => ({ value, label }));
const UNIT_OPTIONS: { value: string; label: string }[] = [
  { value: 'mi', label: 'Miles' },
  { value: 'km', label: 'Kilometers' },
];

function secsToHMS(total: number) {
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  return { h: h.toString(), m: m.toString(), s: s.toString() };
}

function parseOptionalHr(value: string): number | null {
  if (!value.trim()) return null;
  const n = parseInt(value, 10);
  if (isNaN(n) || n <= 0 || n > 250) return null;
  return n;
}

export function RunForm({ initialDate, prefillPlanDay, existingRun, onSubmit, isLoading }: RunFormProps) {
  const { settings } = useSettings();
  const db = useDb();

  const hms = existingRun ? secsToHMS(existingRun.duration_seconds) : null;

  let initialDateValue = existingRun?.date
    ? extractDate(existingRun.date)
    : (initialDate ?? today());

  let initialTimeValue = '12:00';
  if (existingRun?.date && existingRun.date.includes('T')) {
    try {
      const dt = parseISO(existingRun.date);
      initialTimeValue = format(dt, 'HH:mm');
    } catch {
      initialTimeValue = '12:00';
    }
  } else {
    initialTimeValue = format(new Date(), 'HH:mm');
  }

  const [values, setValues] = useState<RunFormValues>({
    date: initialDateValue,
    time: initialTimeValue,
    distance_value: existingRun?.distance_value?.toString() ?? prefillPlanDay?.distance_value?.toString() ?? '',
    distance_unit: (existingRun?.distance_unit ?? prefillPlanDay?.distance_unit ?? settings.units) as DistanceUnit,
    hours: hms?.h ?? '0',
    minutes: hms?.m ?? '',
    seconds: hms?.s ?? '',
    run_type: (existingRun?.run_type ?? prefillPlanDay?.activity_type as RunType | undefined) ?? 'easy_run',
    notes: existingRun?.notes ?? prefillPlanDay?.description ?? '',
    avg_heart_rate: existingRun?.avg_heart_rate?.toString() ?? '',
    max_heart_rate: existingRun?.max_heart_rate?.toString() ?? '',
  });

  const [gearIds, setGearIds] = useState<string[]>([]);
  const [errors, setErrors] = useState<Partial<Record<keyof RunFormValues, string>>>({});

  useEffect(() => {
    if (!db) return;
    (async () => {
      if (existingRun) {
        const assigned = await getGearForRun(db, existingRun.id);
        setGearIds(assigned.map(g => g.id));
      } else {
        setGearIds(await getDefaultGearIds(db));
      }
    })();
  }, [db, existingRun?.id]);

  const durationSeconds =
    parseInt(values.hours || '0') * 3600 +
    parseInt(values.minutes || '0') * 60 +
    parseInt(values.seconds || '0');
  const dist = parseFloat(values.distance_value);
  const paceStr = dist > 0 && durationSeconds > 0
    ? formatPace(calcPaceSeconds(dist, durationSeconds, values.distance_unit as DistanceUnit), values.distance_unit as DistanceUnit)
    : null;

  const set = (k: keyof RunFormValues, v: string) => setValues(prev => ({ ...prev, [k]: v }));

  function validate(): boolean {
    const e: typeof errors = {};
    if (!values.date) e.date = 'Required';
    if (!values.distance_value || isNaN(dist) || dist <= 0) e.distance_value = 'Enter a positive distance';
    if (durationSeconds <= 0) e.minutes = 'Enter duration';
    if (values.avg_heart_rate && parseOptionalHr(values.avg_heart_rate) == null) {
      e.avg_heart_rate = 'Invalid HR';
    }
    if (values.max_heart_rate && parseOptionalHr(values.max_heart_rate) == null) {
      e.max_heart_rate = 'Invalid HR';
    }
    setErrors(e);
    return Object.keys(e).length === 0;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!validate()) return;

    const datetime = new Date(`${values.date}T${values.time}:00`).toISOString();

    await onSubmit({
      date: datetime,
      distance_value: dist,
      distance_unit: values.distance_unit as DistanceUnit,
      duration_seconds: durationSeconds,
      run_type: values.run_type as RunType,
      plan_day_id: prefillPlanDay?.id,
      notes: values.notes,
      avg_heart_rate: parseOptionalHr(values.avg_heart_rate),
      max_heart_rate: parseOptionalHr(values.max_heart_rate),
      gear_ids: gearIds,
    });
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      <div className="flex gap-2">
        <div className="flex-1">
          <Input
            label="Date"
            type="date"
            value={values.date}
            onChange={e => set('date', e.target.value)}
            max={today()}
            error={errors.date}
          />
        </div>
        <div className="flex-1">
          <Input
            label="Time"
            type="time"
            value={values.time}
            onChange={e => set('time', e.target.value)}
          />
        </div>
      </div>

      <div className="flex gap-2">
        <div className="flex-1">
          <Input
            label="Distance"
            type="number"
            step="0.01"
            min="0.01"
            placeholder="3.1"
            value={values.distance_value}
            onChange={e => set('distance_value', e.target.value)}
            error={errors.distance_value}
          />
        </div>
        <div className="w-28">
          <Select
            label="Unit"
            options={UNIT_OPTIONS}
            value={values.distance_unit}
            onChange={e => set('distance_unit', e.target.value)}
          />
        </div>
      </div>

      <div>
        <label className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-1 block">
          Duration
        </label>
        <div className="flex gap-2 items-end">
          <div className="flex-1">
            <Input
              placeholder="0"
              type="number"
              min="0"
              value={values.hours}
              onChange={e => set('hours', e.target.value)}
              hint="hrs"
            />
          </div>
          <div className="flex-1">
            <Input
              placeholder="30"
              type="number"
              min="0"
              max="59"
              value={values.minutes}
              onChange={e => set('minutes', e.target.value)}
              hint="min"
              error={errors.minutes}
            />
          </div>
          <div className="flex-1">
            <Input
              placeholder="00"
              type="number"
              min="0"
              max="59"
              value={values.seconds}
              onChange={e => set('seconds', e.target.value)}
              hint="sec"
            />
          </div>
        </div>
      </div>

      {paceStr && (
        <div className="flex items-center gap-2 px-3 py-2 bg-gray-50 dark:bg-gray-700/50 rounded-xl">
          <span className="text-xs text-gray-500 dark:text-gray-400">Pace</span>
          <span className="text-sm font-medium text-gray-800 dark:text-gray-100">{paceStr}</span>
        </div>
      )}

      <Select
        label="Run Type"
        options={RUN_TYPE_OPTIONS}
        value={values.run_type}
        onChange={e => set('run_type', e.target.value)}
      />

      <div className="flex gap-2">
        <div className="flex-1">
          <Input
            label="Avg HR (optional)"
            type="number"
            min="1"
            max="250"
            placeholder="145"
            value={values.avg_heart_rate}
            onChange={e => set('avg_heart_rate', e.target.value)}
            error={errors.avg_heart_rate}
          />
        </div>
        <div className="flex-1">
          <Input
            label="Max HR (optional)"
            type="number"
            min="1"
            max="250"
            placeholder="175"
            value={values.max_heart_rate}
            onChange={e => set('max_heart_rate', e.target.value)}
            error={errors.max_heart_rate}
          />
        </div>
      </div>

      <GearPicker selectedIds={gearIds} onChange={setGearIds} />

      <Textarea
        label="Notes (optional)"
        placeholder="How did it feel?"
        rows={3}
        value={values.notes}
        onChange={e => set('notes', e.target.value)}
      />

      <Button type="submit" size="lg" isLoading={isLoading} className="w-full mt-2">
        Save Run
      </Button>
    </form>
  );
}
