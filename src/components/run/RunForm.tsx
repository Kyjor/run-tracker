import { useState } from 'react';
import type { PlanDay, RunType, DistanceUnit } from '../../types';
import { RUN_TYPE_LABELS } from '../../types';
import { Input, Textarea } from '../ui/Input';
import { Select } from '../ui/Select';
import { Button } from '../ui/Button';
import { today } from '../../utils/dateUtils';
import { formatPace, calcPaceSeconds } from '../../utils/paceUtils';
import { useSettings } from '../../contexts/SettingsContext';

interface RunFormValues {
  date: string;
  distance_value: string;
  distance_unit: DistanceUnit;
  hours: string;
  minutes: string;
  seconds: string;
  run_type: RunType;
  notes: string;
}

interface RunFormProps {
  initialDate?: string;
  prefillPlanDay?: PlanDay | null;
  onSubmit: (values: {
    date: string;
    distance_value: number;
    distance_unit: DistanceUnit;
    duration_seconds: number;
    run_type: RunType;
    plan_day_id?: string;
    notes: string;
  }) => Promise<void>;
  isLoading?: boolean;
}

const RUN_TYPE_OPTIONS = Object.entries(RUN_TYPE_LABELS).map(([value, label]) => ({ value, label }));
const UNIT_OPTIONS: { value: string; label: string }[] = [
  { value: 'mi', label: 'Miles' },
  { value: 'km', label: 'Kilometers' },
];

export function RunForm({ initialDate, prefillPlanDay, onSubmit, isLoading }: RunFormProps) {
  const { settings } = useSettings();

  const [values, setValues] = useState<RunFormValues>({
    date: initialDate ?? today(),
    distance_value: prefillPlanDay?.distance_value?.toString() ?? '',
    distance_unit: prefillPlanDay?.distance_unit ?? settings.units,
    hours: '0',
    minutes: '',
    seconds: '',
    run_type: (prefillPlanDay?.activity_type as RunType | undefined) ?? 'easy_run',
    notes: prefillPlanDay?.description ?? '',
  });

  const [errors, setErrors] = useState<Partial<Record<keyof RunFormValues, string>>>({});

  // Live pace
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
    setErrors(e);
    return Object.keys(e).length === 0;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!validate()) return;
    await onSubmit({
      date: values.date,
      distance_value: dist,
      distance_unit: values.distance_unit as DistanceUnit,
      duration_seconds: durationSeconds,
      run_type: values.run_type as RunType,
      plan_day_id: prefillPlanDay?.id,
      notes: values.notes,
    });
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      <Input
        label="Date"
        type="date"
        value={values.date}
        onChange={e => set('date', e.target.value)}
        max={today()}
        error={errors.date}
      />

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

