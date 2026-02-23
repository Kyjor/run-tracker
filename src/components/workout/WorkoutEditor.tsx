import { useState } from 'react';
import type { ActivityType, DistanceUnit, PaceZoneType, WorkoutSegment } from '../../types';
import { PACE_ZONE_LABELS } from '../../types';
import { Input } from '../ui/Input';
import { Select } from '../ui/Select';
import { Button } from '../ui/Button';
import { defaultSegmentsForActivity, formatPaceFromSeconds, formatEstimatedTime } from '../../utils/workoutUtils';
import { useSettings } from '../../contexts/SettingsContext';

const ZONE_OPTIONS = (Object.entries(PACE_ZONE_LABELS) as [PaceZoneType, string][]).map(
  ([value, label]) => ({ value, label }),
);

interface WorkoutEditorProps {
  activityType: ActivityType;
  distanceValue: number | null;
  segments: WorkoutSegment[];
  onChange: (segments: WorkoutSegment[]) => void;
}

export function WorkoutEditor({
  activityType,
  distanceValue,
  segments,
  onChange,
}: WorkoutEditorProps) {
  const { settings } = useSettings();
  const unit = settings.units;
  const paceZones = settings.pace_zones;

  const estimated = formatEstimatedTime(segments, paceZones);

  function update(idx: number, field: keyof WorkoutSegment, value: unknown) {
    const next = segments.map((s, i) => (i === idx ? { ...s, [field]: value } : s));
    onChange(next);
  }

  function addSegment() {
    onChange([...segments, { zone: 'easy' as PaceZoneType, distance_value: 1 }]);
  }

  function removeSegment(idx: number) {
    onChange(segments.filter((_, i) => i !== idx));
  }

  function resetToDefaults() {
    onChange(defaultSegmentsForActivity(activityType, distanceValue, unit));
  }

  return (
    <div className="flex flex-col gap-3">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-semibold text-gray-800 dark:text-gray-100">Workout Structure</h3>
          {estimated && (
            <p className="text-xs text-primary-500 font-medium mt-0.5">Est. {estimated}</p>
          )}
        </div>
        <Button size="sm" variant="ghost" onClick={resetToDefaults}>
          Reset defaults
        </Button>
      </div>

      {/* Segment list */}
      {segments.map((seg, idx) => (
        <SegmentRow
          key={idx}
          seg={seg}
          unit={unit}
          paceForZone={paceZones[seg.zone]}
          onUpdate={(field, value) => update(idx, field, value)}
          onRemove={() => removeSegment(idx)}
        />
      ))}

      <Button size="sm" variant="secondary" onClick={addSegment}>
        + Add Segment
      </Button>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Segment Row
// ---------------------------------------------------------------------------

interface SegmentRowProps {
  seg: WorkoutSegment;
  unit: DistanceUnit;
  paceForZone: number;
  onUpdate: (field: keyof WorkoutSegment, value: unknown) => void;
  onRemove: () => void;
}

function SegmentRow({ seg, unit, paceForZone, onUpdate, onRemove }: SegmentRowProps) {
  const [mode, setMode] = useState<'distance' | 'time'>(
    seg.duration_minutes && !seg.distance_value ? 'time' : 'distance',
  );

  const paceStr = formatPaceFromSeconds(paceForZone, unit);

  return (
    <div className="bg-gray-50 dark:bg-gray-700/50 rounded-xl p-3 flex flex-col gap-2">
      {/* Zone + remove */}
      <div className="flex items-center gap-2">
        <div className="flex-1">
          <Select
            options={ZONE_OPTIONS}
            value={seg.zone}
            onChange={e => onUpdate('zone', e.target.value)}
          />
        </div>
        <button
          onClick={onRemove}
          className="text-gray-400 hover:text-red-500 transition-colors px-1 py-1"
          aria-label="Remove segment"
        >
          ✕
        </button>
      </div>

      {/* Distance / Time toggle */}
      <div className="flex gap-1">
        {(['distance', 'time'] as const).map(m => (
          <button
            key={m}
            onClick={() => setMode(m)}
            className={[
              'flex-1 text-xs py-1 rounded-lg font-medium transition-colors',
              mode === m
                ? 'bg-primary-500 text-white'
                : 'bg-gray-200 dark:bg-gray-600 text-gray-600 dark:text-gray-300',
            ].join(' ')}
          >
            {m === 'distance' ? `By distance (${unit})` : 'By time (min)'}
          </button>
        ))}
      </div>

      <div className="flex gap-2">
        {mode === 'distance' ? (
          <div className="flex-1">
            <Input
              placeholder={`Distance (${unit})`}
              type="number"
              step="0.1"
              min="0.1"
              value={seg.distance_value?.toString() ?? ''}
              onChange={e => {
                const v = parseFloat(e.target.value);
                onUpdate('distance_value', isNaN(v) ? undefined : v);
                onUpdate('duration_minutes', undefined);
              }}
            />
          </div>
        ) : (
          <div className="flex-1">
            <Input
              placeholder="Duration (min)"
              type="number"
              min="1"
              value={seg.duration_minutes?.toString() ?? ''}
              onChange={e => {
                const v = parseInt(e.target.value);
                onUpdate('duration_minutes', isNaN(v) ? undefined : v);
                onUpdate('distance_value', undefined);
              }}
            />
          </div>
        )}

        <div className="w-16">
          <Input
            placeholder="Reps"
            type="number"
            min="1"
            value={seg.reps?.toString() ?? ''}
            onChange={e => {
              const v = parseInt(e.target.value);
              onUpdate('reps', isNaN(v) || v <= 1 ? undefined : v);
            }}
            hint="×"
          />
        </div>
      </div>

      {/* Pace preview */}
      <p className="text-xs text-gray-400 dark:text-gray-500">
        Target pace: <span className="font-medium text-gray-600 dark:text-gray-300">{paceStr}</span>
        {' · '}Set in <span className="underline">Pace Zones</span>
      </p>

      {/* Notes */}
      <Input
        placeholder="Note (e.g. 'Warmup')"
        value={seg.description ?? ''}
        onChange={e => onUpdate('description', e.target.value || undefined)}
      />
    </div>
  );
}

