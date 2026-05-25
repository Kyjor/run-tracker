import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Header } from '../components/navigation/Header';
import { Card } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Spinner } from '../components/ui/Spinner';
import { StaggerList, StaggerItem } from '../components/motion/StaggerList';
import { useDb } from '../contexts/DatabaseContext';
import { useSettings } from '../contexts/SettingsContext';
import { useToast } from '../contexts/ToastContext';
import type { HealthKitWorkout } from '../services/healthkitService';
import { requestHealthKitPermission, fetchHealthKitWorkouts, workoutExists, importHealthKitWorkout } from '../services/healthkitService';
import { format, parseISO } from 'date-fns';

const ENTRIES = [
  {
    path: '/log/manual',
    title: 'Log manual run',
    description: 'Enter distance, time, and details for a run you already completed.',
    icon: ManualIcon,
    iconBg: 'bg-primary-100 dark:bg-primary-900/40',
    iconColor: 'text-primary-600 dark:text-primary-400',
  },
  {
    path: '/log/live',
    title: 'Live run',
    description: "Track in real time with GPS. Keeps running when you lock your phone.",
    icon: LiveIcon,
    iconBg: 'bg-emerald-100 dark:bg-emerald-900/40',
    iconColor: 'text-emerald-600 dark:text-emerald-400',
  },
  {
    path: '/log/import-fit',
    title: 'Import FIT workout',
    description: 'Select a .fit file, preview metrics, and import into your log.',
    icon: ImportIcon,
    iconBg: 'bg-indigo-100 dark:bg-indigo-900/40',
    iconColor: 'text-indigo-600 dark:text-indigo-400',
  },
] as const;

export function LogEntryScreen() {
  const navigate = useNavigate();
  const db = useDb();
  const { settings } = useSettings();
  const { showToast } = useToast();

  const [hkWorkouts, setHkWorkouts] = useState<Array<HealthKitWorkout & { alreadyImported: boolean }>>([]);
  const [hkLoading, setHkLoading] = useState(true);
  const [importingId, setImportingId] = useState<string | null>(null);

  useEffect(() => {
    if (!db) return;
    (async () => {
      try {
        const ok = await requestHealthKitPermission();
        if (!ok) { setHkLoading(false); return; }
        const dayStart = new Date();
        dayStart.setHours(0, 0, 0, 0);
        const now = new Date();
        const raw = await fetchHealthKitWorkouts(dayStart.toISOString(), now.toISOString());
        const todayStart = dayStart.getTime();
        const todayEnd = now.getTime();
        const today = raw.filter(w => {
          const t = new Date(w.start_date).getTime();
          return t >= todayStart && t <= todayEnd;
        });
        const withStatus = await Promise.all(
          today.map(async w => ({ ...w, alreadyImported: await workoutExists(db, w, settings.units) })),
        );
        setHkWorkouts(withStatus);
      } catch {
        setHkWorkouts([]);
      } finally {
        setHkLoading(false);
      }
    })();
  }, [db, settings.units]);

  const unimported = hkWorkouts.filter(w => !w.alreadyImported);

  async function handleImport(workout: HealthKitWorkout & { alreadyImported: boolean }) {
    if (!db || workout.alreadyImported) return;
    setImportingId(workout.id);
    try {
      const result = await importHealthKitWorkout(db, workout, settings.units, settings.max_heart_rate_bpm);
      if (result.success) {
        showToast('Workout imported!', 'success');
        setHkWorkouts(prev => prev.map(w => (w.id === workout.id ? { ...w, alreadyImported: true } : w)));
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
    <div className="flex flex-col flex-1 overflow-y-auto pb-24">
      <Header title="Log a Run" showBack />

      <div className="px-4 pt-4 flex flex-col gap-3">
        {!hkLoading && unimported.length > 0 && (
          <Card className="border border-primary-200/80 dark:border-primary-800 bg-primary-50/80 dark:bg-primary-900/20">
            <div className="flex flex-col gap-3">
              <div className="flex items-start gap-3">
                <div className="w-9 h-9 rounded-full bg-primary-100 dark:bg-primary-900/50 flex items-center justify-center shrink-0">
                  <HealthKitIcon className="w-5 h-5 text-primary-600 dark:text-primary-400" />
                </div>
                <div className="flex-1">
                  <p className="text-sm font-semibold text-ink-primary dark:text-ink-dark-primary">
                    Detected today&apos;s workout
                  </p>
                  <p className="text-xs text-ink-secondary dark:text-ink-dark-secondary mt-0.5">
                    Import directly from HealthKit.
                  </p>
                </div>
              </div>
              <div className="flex flex-col gap-2">
                {unimported.map(w => {
                  const distKm = (w.distance_meters ?? 0) / 1000;
                  const distMi = distKm * 0.621371;
                  const distVal = settings.units === 'mi' ? distMi : distKm;
                  const distLabel = distVal > 0 ? `${distVal.toFixed(2)} ${settings.units}` : 'No distance';
                  const timeLabel = format(parseISO(w.start_date), 'p');
                  const durMin = Math.floor(w.duration_seconds / 60);
                  const durSec = Math.floor(w.duration_seconds % 60);
                  return (
                    <div key={w.id} className="flex items-center justify-between gap-3 px-3 py-2 rounded-xl bg-white/80 dark:bg-gray-900/60">
                      <div className="flex flex-col text-xs text-ink-primary dark:text-ink-dark-primary">
                        <span className="font-medium">{timeLabel}</span>
                        <span className="text-ink-muted dark:text-ink-dark-muted">
                          {distLabel} · {durMin}:{durSec.toString().padStart(2, '0')}
                        </span>
                      </div>
                      <Button
                        size="sm"
                        onClick={() => handleImport(w)}
                        disabled={importingId === w.id}
                        isLoading={importingId === w.id}
                      >
                        Import
                      </Button>
                    </div>
                  );
                })}
              </div>
            </div>
          </Card>
        )}

        {hkLoading && (
          <div className="flex justify-center py-2">
            <Spinner size="sm" className="text-primary-400" />
          </div>
        )}

        <StaggerList className="flex flex-col gap-3">
          {ENTRIES.map((entry) => (
            <StaggerItem key={entry.path}>
              <Card onClick={() => navigate(entry.path)}>
                <div className="flex items-center gap-3">
                  <div className={`w-11 h-11 rounded-xl flex items-center justify-center shrink-0 ${entry.iconBg}`}>
                    <entry.icon className={`w-6 h-6 ${entry.iconColor}`} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-ink-primary dark:text-ink-dark-primary">{entry.title}</p>
                    <p className="text-xs text-ink-secondary dark:text-ink-dark-secondary mt-0.5">{entry.description}</p>
                  </div>
                </div>
              </Card>
            </StaggerItem>
          ))}
        </StaggerList>
      </div>
    </div>
  );
}

function ManualIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} className={className}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931zm0 0L19.5 7.125M18 14v4.75A2.25 2.25 0 0115.75 21H5.25A2.25 2.25 0 013 18.75V8.25A2.25 2.25 0 015.25 6H10" />
    </svg>
  );
}

function LiveIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} className={className}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M15 10.5a3 3 0 11-6 0 3 3 0 016 0z" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 10.5c0 7.142-7.5 11.25-7.5 11.25S4.5 17.642 4.5 10.5a7.5 7.5 0 1115 0z" />
    </svg>
  );
}

function ImportIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} className={className}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12L12 16.5m0 0L7.5 12m4.5 4.5V3" />
    </svg>
  );
}

function HealthKitIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} className={className}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 18v-5.25m0 0a6.01 6.01 0 001.5-.189m-1.5.189a6.01 6.01 0 01-1.5-.189m3.75 7.478a12.06 12.06 0 01-4.5 0m3.75 2.383a14.406 14.406 0 01-3 0M14.25 18v-.192c0-.983.658-1.823 1.508-2.316a7.5 7.5 0 10-7.517 0c.85.493 1.509 1.333 1.509 2.316V18" />
    </svg>
  );
}
