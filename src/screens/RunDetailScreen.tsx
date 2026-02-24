import { useEffect, useState } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import type { Run } from '../types';
import { RUN_TYPE_LABELS, ACTIVITY_COLORS } from '../types';
import { Header } from '../components/navigation/Header';
import { Spinner } from '../components/ui/Spinner';
import { RunMetricsDisplay } from '../components/run/RunMetricsDisplay';
import { useDb } from '../contexts/DatabaseContext';
import { useSettings } from '../contexts/SettingsContext';
import { useAuth } from '../contexts/AuthContext';
import { getRunById } from '../services/runService';
import { getRunByUserAndId, getProfileById } from '../services/socialService';
import { formatDistance, formatDuration, formatPace, calcPaceSeconds } from '../utils/paceUtils';
import { formatLong } from '../utils/dateUtils';

export function RunDetailScreen() {
  const { id } = useParams<{ id: string }>();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const db = useDb();
  const { settings } = useSettings();
  const { user } = useAuth();

  const [run, setRun] = useState<Run | null>(null);
  const [loading, setLoading] = useState(true);
  const [isFriendRun, setIsFriendRun] = useState(false);
  const [friendName, setFriendName] = useState<string | null>(null);

  useEffect(() => {
    if (!id) return;
    
    const userId = searchParams.get('userId');
    const isOwnRun = !userId || userId === user?.id;
    
    setIsFriendRun(!isOwnRun);
    
    if (isOwnRun) {
      // Fetch from local DB
      getRunById(db, id)
        .then(r => setRun(r))
        .finally(() => setLoading(false));
    } else {
      // Fetch friend's run from Supabase
      Promise.all([
        getRunByUserAndId(userId, id),
        getProfileById(userId),
      ])
        .then(([r, profile]) => {
          setRun(r);
          setFriendName(profile?.display_name ?? null);
        })
        .catch(() => {
          setRun(null);
          setFriendName(null);
        })
        .finally(() => setLoading(false));
    }
  }, [db, id, searchParams, user]);

  if (loading) {
    return (
      <div className="flex flex-col flex-1">
        <Header title="Run Details" showBack />
        <div className="flex flex-1 items-center justify-center py-20">
          <Spinner size="lg" className="text-primary-500" />
        </div>
      </div>
    );
  }

  if (!run) {
    return (
      <div className="flex flex-col flex-1">
        <Header title="Run Details" showBack />
        <div className="flex flex-1 items-center justify-center py-20 text-gray-400">
          Run not found.
        </div>
      </div>
    );
  }

  const color = ACTIVITY_COLORS[run.run_type as keyof typeof ACTIVITY_COLORS] ?? ACTIVITY_COLORS['easy_run'];
  const pace = calcPaceSeconds(run.distance_value, run.duration_seconds, run.distance_unit);
  const hasMetrics = run.avg_heart_rate != null || run.avg_cadence != null
    || run.elevation_gain_meters != null || run.avg_power_watts != null
    || run.vo2_max != null || run.temperature_celsius != null || run.calories != null;

  return (
    <div className="flex flex-col flex-1 overflow-y-auto pb-24">
      <Header
        title="Run Details"
        showBack
        rightAction={
          !isFriendRun ? (
            <button
              className="text-sm text-primary-500 font-medium pr-1"
              onClick={() => navigate(`/log/edit/${run.id}`)}
            >
              Edit
            </button>
          ) : null
        }
      />

      <div className="flex flex-col gap-4 px-4 pt-4">

        {/* ── Hero card ─────────────────────────────────────────── */}
        <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 overflow-hidden">
          {/* Color bar */}
          <div className="h-1.5 w-full" style={{ backgroundColor: color }} />

          <div className="p-5">
            <div className="flex items-center gap-3 mb-4">
              <div
                className="w-12 h-12 rounded-2xl flex items-center justify-center"
                style={{ backgroundColor: color + '20' }}
              >
                <div className="w-4 h-4 rounded-full" style={{ backgroundColor: color }} />
              </div>
              <div>
                <h2 className="text-lg font-bold text-gray-900 dark:text-white">
                  {RUN_TYPE_LABELS[run.run_type] ?? 'Run'}
                </h2>
                <p className="text-sm text-gray-400">
                  {isFriendRun && friendName ? `${friendName}'s run · ` : ''}
                  {formatLong(run.date)}
                </p>
              </div>
              {run.source === 'healthkit' && (
                <span className="ml-auto text-xs bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400 px-2 py-1 rounded-full">
                  Apple Health
                </span>
              )}
            </div>

            {/* Core stats grid */}
            <div className="grid grid-cols-3 gap-3">
              <CoreStat
                label="Distance"
                value={formatDistance(run.distance_value, run.distance_unit)}
              />
              <CoreStat
                label="Duration"
                value={formatDuration(run.duration_seconds)}
              />
              <CoreStat
                label="Pace"
                value={pace > 0 ? formatPace(pace, run.distance_unit) : '—'}
              />
            </div>

            {/* Notes */}
            {run.notes ? (
              <p className="mt-4 text-sm text-gray-600 dark:text-gray-300 bg-gray-50 dark:bg-gray-700 rounded-xl px-3 py-2">
                {run.notes}
              </p>
            ) : null}
          </div>
        </div>

        {/* ── Health metrics ───────────────────────────────────── */}
        {hasMetrics && (
          <RunMetricsDisplay run={run} useFahrenheit={settings.units === 'mi'} />
        )}

        {!hasMetrics && (
          <div className="text-center text-sm text-gray-400 dark:text-gray-500 py-6">
            No health metrics available.{' '}
            {run.source === 'manual'
              ? 'Import from Apple Health to see HR, cadence, elevation, and more.'
              : ''}
          </div>
        )}
      </div>
    </div>
  );
}

function CoreStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col items-center bg-gray-50 dark:bg-gray-700 rounded-xl py-3">
      <span className="text-xs text-gray-400 uppercase tracking-wide mb-0.5">{label}</span>
      <span className="text-base font-bold text-gray-900 dark:text-white">{value}</span>
    </div>
  );
}

