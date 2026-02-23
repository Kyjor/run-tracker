import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import type { RaceType, Difficulty, ActivityType, DistanceUnit, WorkoutSegment } from '../types';
import { RACE_TYPE_LABELS, DIFFICULTY_LABELS, ACTIVITY_LABELS, ACTIVITY_COLORS } from '../types';
import { Header } from '../components/navigation/Header';
import { Input, Textarea } from '../components/ui/Input';
import { Select } from '../components/ui/Select';
import { Button } from '../components/ui/Button';
import { Card } from '../components/ui/Card';
import { useDb } from '../contexts/DatabaseContext';
import { useToast } from '../contexts/ToastContext';
import { createCustomPlan } from '../services/planService';
import { generateId } from '../utils/generateId';
import { WorkoutEditor } from '../components/workout/WorkoutEditor';
import { defaultSegmentsForActivity, serializeSegments } from '../utils/workoutUtils';
import { useSettings } from '../contexts/SettingsContext';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface DayCell {
  activity_type: ActivityType;
  distance_value: string;
  distance_unit: DistanceUnit;
  duration_minutes: string;
  description: string;
  workout_segments: WorkoutSegment[];
}

const blankDay = (unit: DistanceUnit = 'mi'): DayCell => ({
  activity_type: 'rest',
  distance_value: '',
  distance_unit: unit,
  duration_minutes: '',
  description: '',
  workout_segments: [],
});

const ACTIVITY_OPTIONS = Object.entries(ACTIVITY_LABELS).map(([value, label]) => ({ value, label }));
const RACE_TYPE_OPTIONS = Object.entries(RACE_TYPE_LABELS).map(([value, label]) => ({ value, label }));
const DIFFICULTY_OPTIONS = (Object.entries(DIFFICULTY_LABELS) as [Difficulty, string][])
  .filter(([k]) => k !== 'custom')
  .map(([value, label]) => ({ value, label }));
const UNIT_OPTIONS = [{ value: 'mi', label: 'mi' }, { value: 'km', label: 'km' }];
const WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function PlanEditorScreen() {
  const navigate = useNavigate();
  const db = useDb();
  const { showToast } = useToast();
  const { settings } = useSettings();
  const unit = settings.units;

  const [name, setName] = useState('');
  const [raceType, setRaceType] = useState<RaceType>('half_marathon');
  const [difficulty, setDifficulty] = useState<Difficulty>('beginner');
  const [description, setDescription] = useState('');
  const [weeks, setWeeks] = useState(12);
  const [isSaving, setIsSaving] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  // Grid: weeks × 7 days
  const [grid, setGrid] = useState<DayCell[][]>(() =>
    Array.from({ length: 12 }, () => Array.from({ length: 7 }, () => blankDay(unit))),
  );

  // Sync grid size when weeks changes
  function handleWeeksChange(n: number) {
    const clamped = Math.max(1, Math.min(52, n));
    setWeeks(clamped);
    setGrid(prev => {
      const next = [...prev];
      while (next.length < clamped) next.push(Array.from({ length: 7 }, () => blankDay(unit)));
      return next.slice(0, clamped);
    });
  }

  function setCell(wi: number, di: number, field: keyof DayCell, value: string | WorkoutSegment[]) {
    setGrid(prev => {
      const next = prev.map(w => [...w]);
      next[wi][di] = { ...next[wi][di], [field]: value };
      return next;
    });
  }

  function validate() {
    const e: Record<string, string> = {};
    if (!name.trim()) e.name = 'Plan name is required';
    if (weeks < 1 || weeks > 52) e.weeks = 'Must be between 1 and 52 weeks';
    setErrors(e);
    return Object.keys(e).length === 0;
  }

  async function handleSave() {
    if (!validate()) return;
    setIsSaving(true);
    try {
      const planId = await createCustomPlan(db, {
        name: name.trim(),
        race_type: raceType,
        difficulty,
        description: description.trim(),
        duration_weeks: weeks,
      });

      // Insert plan days
      const now = new Date().toISOString();
      for (let wi = 0; wi < grid.length; wi++) {
        for (let di = 0; di < 7; di++) {
          const cell = grid[wi][di];
          const dist = parseFloat(cell.distance_value);
          const dur = parseInt(cell.duration_minutes);
          const segs = cell.workout_segments.length > 0
            ? serializeSegments(cell.workout_segments)
            : null;
          await db.execute(
            `INSERT INTO plan_days
              (id, plan_id, week_number, day_of_week, activity_type,
               distance_value, distance_unit, duration_minutes, description,
               workout_segments, created_at, updated_at)
             VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$11)`,
            [
              generateId(),
              planId,
              wi + 1,
              di,
              cell.activity_type,
              isNaN(dist) ? null : dist,
              cell.distance_unit,
              isNaN(dur) ? null : dur,
              cell.description.trim(),
              segs,
              now,
            ],
          );
        }
      }

      showToast('Plan created! 🎉', 'success');
      navigate(`/profile/plans/${planId}`, { replace: true });
    } catch (err) {
      showToast('Failed to save plan', 'error');
      console.error(err);
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <div className="flex flex-col flex-1 overflow-y-auto pb-24">
      <Header title="New Training Plan" showBack />

      <div className="px-4 pt-4 flex flex-col gap-5">
        {/* Meta */}
        <Card>
          <div className="flex flex-col gap-4">
            <Input
              label="Plan Name"
              placeholder="e.g. My 5K Plan"
              value={name}
              onChange={e => setName(e.target.value)}
              error={errors.name}
            />
            <div className="flex gap-3">
              <div className="flex-1">
                <Select
                  label="Race Type"
                  options={RACE_TYPE_OPTIONS}
                  value={raceType}
                  onChange={e => setRaceType(e.target.value as RaceType)}
                />
              </div>
              <div className="flex-1">
                <Select
                  label="Difficulty"
                  options={DIFFICULTY_OPTIONS}
                  value={difficulty}
                  onChange={e => setDifficulty(e.target.value as Difficulty)}
                />
              </div>
            </div>
            <Input
              label="Duration (weeks)"
              type="number"
              min="1"
              max="52"
              value={weeks.toString()}
              onChange={e => handleWeeksChange(parseInt(e.target.value) || 1)}
              error={errors.weeks}
            />
            <Textarea
              label="Description (optional)"
              placeholder="What's this plan about?"
              rows={2}
              value={description}
              onChange={e => setDescription(e.target.value)}
            />
          </div>
        </Card>

        {/* Weekly grid */}
        <div className="flex flex-col gap-6">
          {grid.map((week, wi) => (
            <Card key={wi} padding={false}>
              <div className="px-4 py-3 border-b border-gray-100 dark:border-gray-700">
                <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-200">
                  Week {wi + 1}
                </h3>
              </div>
              <div className="divide-y divide-gray-100 dark:divide-gray-700">
                {week.map((cell, di) => (
                  <DayRow
                    key={di}
                    label={WEEKDAYS[di]}
                    cell={cell}
                    onChange={(field, value) => setCell(wi, di, field, value)}
                  />
                ))}
              </div>
            </Card>
          ))}
        </div>

        <Button size="lg" className="w-full" onClick={handleSave} isLoading={isSaving}>
          Save Plan
        </Button>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Day Row
// ---------------------------------------------------------------------------

interface DayRowProps {
  label: string;
  cell: DayCell;
  onChange: (field: keyof DayCell, value: string | WorkoutSegment[]) => void;
}

function DayRow({ label, cell, onChange }: DayRowProps) {
  const { settings } = useSettings();
  const isActive = cell.activity_type !== 'rest';
  const isCross = cell.activity_type === 'cross_training';
  const color = ACTIVITY_COLORS[cell.activity_type] ?? '#9ca3af';

  function handleActivityChange(type: ActivityType) {
    onChange('activity_type', type);
    // Regenerate default segments whenever activity type changes
    if (type !== 'rest' && type !== 'cross_training') {
      const dist = parseFloat(cell.distance_value) || null;
      onChange('workout_segments', defaultSegmentsForActivity(type, dist, settings.units));
    } else {
      onChange('workout_segments', []);
    }
  }

  return (
    <div className="px-4 py-3 flex flex-col gap-2">
      <div className="flex items-center gap-3">
        <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: color }} />
        <span className="text-sm font-medium text-gray-700 dark:text-gray-300 w-8">{label}</span>
        <div className="flex-1">
          <Select
            options={ACTIVITY_OPTIONS}
            value={cell.activity_type}
            onChange={e => handleActivityChange(e.target.value as ActivityType)}
          />
        </div>
      </div>

      {isActive && (
        <div className="pl-11 flex gap-2">
          {!isCross && (
            <>
              <div className="flex-1">
                <Input
                  placeholder="Distance"
                  type="number"
                  step="0.1"
                  min="0"
                  value={cell.distance_value}
                  onChange={e => onChange('distance_value', e.target.value)}
                />
              </div>
              <div className="w-20">
                <Select
                  options={UNIT_OPTIONS}
                  value={cell.distance_unit}
                  onChange={e => onChange('distance_unit', e.target.value)}
                />
              </div>
            </>
          )}
          {isCross && (
            <div className="flex-1">
              <Input
                placeholder="Duration (min)"
                type="number"
                min="0"
                value={cell.duration_minutes}
                onChange={e => onChange('duration_minutes', e.target.value)}
              />
            </div>
          )}
        </div>
      )}

      {isActive && (
        <div className="pl-11">
          <Input
            placeholder="Notes (optional)"
            value={cell.description}
            onChange={e => onChange('description', e.target.value)}
          />
        </div>
      )}

      {/* Workout structure editor for running activities */}
      {isActive && !isCross && (
        <div className="pl-11 mt-1">
          <WorkoutEditor
            activityType={cell.activity_type}
            distanceValue={parseFloat(cell.distance_value) || null}
            segments={cell.workout_segments}
            onChange={segs => onChange('workout_segments', segs)}
          />
        </div>
      )}
    </div>
  );
}

