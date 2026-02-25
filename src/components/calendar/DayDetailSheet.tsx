import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import type { ActivePlan, PlanDay, Run, ActivityType, DistanceUnit } from '../../types';
import { ACTIVITY_COLORS, ACTIVITY_LABELS } from '../../types';
import { Modal } from '../ui/Modal';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import { Select } from '../ui/Select';
import { formatLong, dateToPlanPosition, toISO, addDays, parseISO } from '../../utils/dateUtils';
import { formatDistance, formatDuration, formatPace, calcPaceSeconds } from '../../utils/paceUtils';
import { useSettings } from '../../contexts/SettingsContext';
import { useDb } from '../../contexts/DatabaseContext';
import { useToast } from '../../contexts/ToastContext';
import { updatePlanDay, swapPlanDayPositions, getPlanDays } from '../../services/planService';
import { WorkoutDisplay } from '../workout/WorkoutDisplay';
import { WorkoutEditor } from '../workout/WorkoutEditor';
import type { WorkoutSegment } from '../../types';
import { parseSegments, serializeSegments, defaultSegmentsForActivity } from '../../utils/workoutUtils';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const ACTIVITY_OPTIONS = (Object.entries(ACTIVITY_LABELS) as [ActivityType, string][]).map(
  ([value, label]) => ({ value, label }),
);
const UNIT_OPTIONS = [{ value: 'mi', label: 'mi' }, { value: 'km', label: 'km' }];

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface DayDetailSheetProps {
  isOpen: boolean;
  onClose: () => void;
  date: string | null;
  planDay: PlanDay | null;
  run: Run | null;
  activePlan: ActivePlan | null;
  durationWeeks: number;
  onPlanDayUpdated: () => void;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function DayDetailSheet({
  isOpen,
  onClose,
  date,
  planDay,
  run,
  activePlan,
  durationWeeks,
  onPlanDayUpdated,
}: DayDetailSheetProps) {
  const navigate = useNavigate();
  const { settings } = useSettings();
  const db = useDb();
  const { showToast } = useToast();

  const [editing, setEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  // Edit form state — seeded from planDay when editing opens
  const [activityType, setActivityType] = useState<ActivityType>('rest');
  const [distanceValue, setDistanceValue] = useState('');
  const [distanceUnit, setDistanceUnit] = useState<DistanceUnit>(settings.units);
  const [durationMinutes, setDurationMinutes] = useState('');
  const [description, setDescription] = useState('');
  const [moveToDate, setMoveToDate] = useState('');
  const [workoutSegments, setWorkoutSegments] = useState<WorkoutSegment[]>([]);

  if (!date) return null;

  const color = planDay ? ACTIVITY_COLORS[planDay.activity_type] : '#9ca3af';

  // Compute allowed date range for moving (within plan bounds)
  const planStart = activePlan?.start_date ?? date;
  const planEnd = activePlan
    ? toISO(addDays(parseISO(activePlan.start_date), durationWeeks * 7 - 1))
    : date;

  function openEdit() {
    if (!planDay) return;
    const dist = planDay.distance_value ?? null;
    const type = planDay.activity_type;
    setActivityType(type);
    setDistanceValue(dist?.toString() ?? '');
    setDistanceUnit((planDay.distance_unit as DistanceUnit) ?? settings.units);
    setDurationMinutes(planDay.duration_minutes?.toString() ?? '');
    setDescription(planDay.description ?? '');
    setMoveToDate(date!);
    // Seed segments: use saved ones if present, else generate defaults
    const saved = parseSegments(planDay.workout_segments);
    setWorkoutSegments(saved ?? defaultSegmentsForActivity(type, dist, settings.units));
    setEditing(true);
  }

  // When activity type changes in edit mode, regenerate default segments
  function handleActivityTypeChange(t: ActivityType) {
    setActivityType(t);
    const dist = distanceValue ? parseFloat(distanceValue) : null;
    setWorkoutSegments(defaultSegmentsForActivity(t, dist, settings.units));
  }

  function closeEdit() {
    setEditing(false);
  }

  async function handleSave() {
    if (!planDay || !activePlan) return;
    setIsSaving(true);
    try {
      const dist = distanceValue ? parseFloat(distanceValue) : null;
      const dur = durationMinutes ? parseInt(durationMinutes) : null;

      const isMove = moveToDate && moveToDate !== date;

      if (isMove) {
        // Moving to a different day
        const pos = dateToPlanPosition(activePlan.start_date, moveToDate, durationWeeks);
        if (!pos) {
          showToast('That date is outside your plan range', 'error');
          setIsSaving(false);
          return;
        }

        // Find existing plan day at target slot (if any) and swap positions
        const allDays = await getPlanDays(db, activePlan.plan_id);
        const targetDay = allDays.find(
          d => d.week_number === pos.weekNumber && d.day_of_week === pos.dayOfWeek && d.id !== planDay.id,
        );

        const segmentsJson = workoutSegments.length > 0 ? serializeSegments(workoutSegments) : null;

        if (targetDay) {
          // Swap the two days' positions
          await swapPlanDayPositions(db, planDay, targetDay);
        } else {
          // No plan day at target — just move
          await updatePlanDay(db, planDay.id, {
            activity_type: activityType,
            distance_value: activityType !== 'rest' && activityType !== 'cross_training' ? dist : null,
            distance_unit: distanceUnit,
            duration_minutes: activityType === 'cross_training' ? dur : null,
            description: description.trim(),
            workout_segments: segmentsJson,
            week_number: pos.weekNumber,
            day_of_week: pos.dayOfWeek,
          });
        }
      } else {
        const segmentsJson = workoutSegments.length > 0 ? serializeSegments(workoutSegments) : null;
        // Edit in place (no move)
        await updatePlanDay(db, planDay.id, {
          activity_type: activityType,
          distance_value: activityType !== 'rest' && activityType !== 'cross_training' ? dist : null,
          distance_unit: distanceUnit,
          duration_minutes: activityType === 'cross_training' ? dur : null,
          description: description.trim(),
          workout_segments: segmentsJson,
        });
      }

      showToast('Plan day updated ✓', 'success');
      setEditing(false);
      onPlanDayUpdated();
      onClose();
    } catch (err) {
      showToast('Failed to save changes', 'error');
      console.error(err);
    } finally {
      setIsSaving(false);
    }
  }

  const handleLogRun = () => {
    onClose();
    navigate('/log/manual', { state: { date, planDayId: planDay?.id, prefill: planDay } });
  };

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  return (
    <Modal isOpen={isOpen} onClose={() => { closeEdit(); onClose(); }} title={formatLong(date)}>
      {editing && planDay ? (
        /* ---- Edit Form ---- */
        <div className="flex flex-col gap-4">
          <Select
            label="Activity"
            options={ACTIVITY_OPTIONS}
            value={activityType}
            onChange={e => handleActivityTypeChange(e.target.value as ActivityType)}
          />

          {activityType !== 'rest' && activityType !== 'cross_training' && (
            <div className="flex gap-2">
              <div className="flex-1">
                <Input
                  label="Distance"
                  type="number"
                  step="0.1"
                  min="0"
                  placeholder="3.1"
                  value={distanceValue}
                  onChange={e => setDistanceValue(e.target.value)}
                />
              </div>
              <div className="w-20">
                <Select
                  label="Unit"
                  options={UNIT_OPTIONS}
                  value={distanceUnit}
                  onChange={e => setDistanceUnit(e.target.value as DistanceUnit)}
                />
              </div>
            </div>
          )}

          {activityType === 'cross_training' && (
            <Input
              label="Duration (minutes)"
              type="number"
              min="1"
              placeholder="30"
              value={durationMinutes}
              onChange={e => setDurationMinutes(e.target.value)}
            />
          )}

          <Input
            label="Notes"
            placeholder="e.g. Easy effort, stay conversational"
            value={description}
            onChange={e => setDescription(e.target.value)}
          />

          {/* Workout structure editor */}
          {activityType !== 'rest' && activityType !== 'cross_training' && (
            <div className="mt-1">
              <WorkoutEditor
                activityType={activityType}
                distanceValue={distanceValue ? parseFloat(distanceValue) : null}
                segments={workoutSegments}
                onChange={setWorkoutSegments}
              />
            </div>
          )}

          {activePlan && (
            <Input
              label="Move to date"
              type="date"
              value={moveToDate}
              min={planStart}
              max={planEnd}
              onChange={e => setMoveToDate(e.target.value)}
            />
          )}

          <div className="flex gap-3 pt-1">
            <Button variant="secondary" className="flex-1" onClick={closeEdit} disabled={isSaving}>
              Cancel
            </Button>
            <Button className="flex-1" onClick={handleSave} isLoading={isSaving}>
              Save
            </Button>
          </div>
        </div>
      ) : (
        /* ---- Detail View ---- */
        <>
          {planDay ? (
            <div className="mb-4 p-3 rounded-2xl" style={{ backgroundColor: color + '18' }}>
              <div className="flex items-center justify-between mb-1">
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full" style={{ backgroundColor: color }} />
                  <span className="font-semibold text-sm" style={{ color }}>
                    {ACTIVITY_LABELS[planDay.activity_type]}
                  </span>
                </div>
                <button
                  className="text-xs text-primary-500 font-medium px-2 py-1 rounded-lg hover:bg-primary-50 dark:hover:bg-primary-900/30 active:scale-95 transition-transform"
                  onClick={openEdit}
                >
                  Edit
                </button>
              </div>
              {planDay.distance_value != null && (
                <p className="text-sm text-gray-600 dark:text-gray-300">
                  {formatDistance(planDay.distance_value, settings.units)}
                </p>
              )}
              {planDay.duration_minutes != null && (
                <p className="text-sm text-gray-600 dark:text-gray-300">
                  {planDay.duration_minutes} min
                </p>
              )}
              {planDay.description && (
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">{planDay.description}</p>
              )}
              {/* Workout structure */}
              {planDay.activity_type !== 'rest' && planDay.activity_type !== 'cross_training' && (
                <div className="mt-3 pt-3 border-t border-black/5 dark:border-white/5">
                  <WorkoutDisplay
                    planDay={planDay}
                    paceZones={settings.pace_zones}
                    unit={settings.units}
                  />
                </div>
              )}
            </div>
          ) : (
            <p className="text-sm text-gray-400 mb-4">No scheduled activity for this day.</p>
          )}

          {run ? (
            <div className="mb-4 p-3 bg-green-50 dark:bg-green-900/20 rounded-2xl">
              <div className="flex items-center justify-between mb-1">
                <p className="text-sm font-semibold text-green-700 dark:text-green-400">✓ Run Logged</p>
                <button
                  className="text-xs text-primary-500 font-medium"
                  onClick={() => { onClose(); navigate(`/log/edit/${run.id}`); }}
                >
                  Edit
                </button>
              </div>
              <div className="flex gap-4 text-sm text-gray-700 dark:text-gray-300">
                <span>{formatDistance(run.distance_value, run.distance_unit)}</span>
                <span>{formatDuration(run.duration_seconds)}</span>
                <span>{formatPace(calcPaceSeconds(run.distance_value, run.duration_seconds, run.distance_unit), run.distance_unit)}</span>
              </div>
              {run.notes && <p className="text-xs text-gray-500 mt-1">{run.notes}</p>}
            </div>
          ) : (
            planDay && planDay.activity_type !== 'rest' && (
              <Button onClick={handleLogRun} className="w-full">
                Log This Run
              </Button>
            )
          )}
        </>
      )}
    </Modal>
  );
}
