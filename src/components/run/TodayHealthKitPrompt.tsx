import { useEffect, useState } from 'react';
import { format, parseISO } from 'date-fns';
import { Card } from '../ui/Card';
import { Button } from '../ui/Button';
import { useDb } from '../../contexts/DatabaseContext';
import { useSettings } from '../../contexts/SettingsContext';
import { useToast } from '../../contexts/ToastContext';
import type { HealthKitWorkout } from '../../services/healthkitService';
import {
  requestHealthKitPermission,
  fetchHealthKitWorkouts,
  workoutExists,
  importHealthKitWorkout,
} from '../../services/healthkitService';

export function TodayHealthKitPrompt() {
  const db = useDb();
  const { settings } = useSettings();
  const { showToast } = useToast();
  const [workouts, setWorkouts] = useState<Array<HealthKitWorkout & { alreadyImported: boolean }>>([]);
  const [importingId, setImportingId] = useState<string | null>(null);

  useEffect(() => {
    if (!db) return;
    let cancelled = false;
    (async () => {
      try {
        const ok = await requestHealthKitPermission();
        if (!ok || cancelled) return;
        const dayStart = new Date();
        dayStart.setHours(0, 0, 0, 0);
        const now = new Date();
        const raw = await fetchHealthKitWorkouts(dayStart.toISOString(), now.toISOString());
        const todayStart = dayStart.getTime();
        const todayEnd = now.getTime();
        const today = raw.filter(workout => {
          const t = new Date(workout.start_date).getTime();
          return t >= todayStart && t <= todayEnd;
        });
        const withStatus = await Promise.all(
          today.map(async workout => ({
            ...workout,
            alreadyImported: await workoutExists(db, workout, settings.units),
          })),
        );
        if (!cancelled) setWorkouts(withStatus);
      } catch {
        if (!cancelled) setWorkouts([]);
      }
    })();
    return () => { cancelled = true; };
  }, [db, settings.units]);

  const unimported = workouts.filter(workout => !workout.alreadyImported);
  if (unimported.length === 0) return null;

  async function handleImport(workout: HealthKitWorkout) {
    if (!db) return;
    setImportingId(workout.id);
    try {
      const result = await importHealthKitWorkout(db, workout, settings.units, settings.max_heart_rate_bpm);
      if (result.success) {
        showToast('Workout imported', 'success');
        setWorkouts(prev => prev.map(item => (item.id === workout.id ? { ...item, alreadyImported: true } : item)));
      } else if (result.error) {
        showToast(result.error, 'error');
      }
    } catch {
      showToast('Failed to import workout', 'error');
    } finally {
      setImportingId(null);
    }
  }

  return (
    <Card className="border border-primary-200/80 dark:border-primary-800 bg-primary-50/80 dark:bg-primary-900/20">
      <p className="text-sm font-semibold text-ink-primary dark:text-ink-dark-primary">Today's workout is in Apple Health</p>
      <p className="text-xs text-ink-secondary dark:text-ink-dark-secondary mt-0.5 mb-3">Import it instead of logging twice.</p>
      <div className="flex flex-col gap-2">
        {unimported.map(workout => {
          const distKm = (workout.distance_meters ?? 0) / 1000;
          const distVal = settings.units === 'mi' ? distKm * 0.621371 : distKm;
          const distLabel = distVal > 0 ? `${distVal.toFixed(2)} ${settings.units}` : 'No distance';
          const durMin = Math.floor(workout.duration_seconds / 60);
          const durSec = Math.floor(workout.duration_seconds % 60);
          return (
            <div key={workout.id} className="flex items-center justify-between gap-3">
              <div className="text-xs text-ink-primary dark:text-ink-dark-primary">
                <span className="font-medium">{format(parseISO(workout.start_date), 'p')}</span>
                <span className="text-ink-muted dark:text-ink-dark-muted">
                  {' '}· {distLabel} · {durMin}:{durSec.toString().padStart(2, '0')}
                </span>
              </div>
              <Button size="sm" onClick={() => handleImport(workout)} isLoading={importingId === workout.id}>
                Import
              </Button>
            </div>
          );
        })}
      </div>
    </Card>
  );
}
