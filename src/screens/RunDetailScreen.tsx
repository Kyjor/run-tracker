import { useEffect, useState } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import type { Run, RoutePoint } from '../types';
import { RUN_TYPE_LABELS, ACTIVITY_COLORS } from '../types';
import { Header } from '../components/navigation/Header';
import { Spinner } from '../components/ui/Spinner';
import { RunMetricsDisplay } from '../components/run/RunMetricsDisplay';
import { RunRouteMap } from '../components/run/RunRouteMap';
import { useDb } from '../contexts/DatabaseContext';
import { useSettings } from '../contexts/SettingsContext';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../contexts/ToastContext';
import { getRunById, getRouteForRun } from '../services/runService';
import { mergeHealthKitMetricsIntoRun } from '../services/healthkitService';
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
  const { showToast } = useToast();

  const [run, setRun] = useState<Run | null>(null);
  const [loading, setLoading] = useState(true);
  const [isFriendRun, setIsFriendRun] = useState(false);
  const [friendName, setFriendName] = useState<string | null>(null);
  const [routePoints, setRoutePoints] = useState<RoutePoint[] | null>(null);
  const [showDebug, setShowDebug] = useState(false);
  const [isMerging, setIsMerging] = useState(false);

  async function reloadRun(runId: string) {
    const r = await getRunById(db, runId);
    setRun(r);
    if (r && r.has_route) {
      const route = await getRouteForRun(db, r.id);
      setRoutePoints(route);
    } else {
      setRoutePoints(null);
    }
  }

  useEffect(() => {
    if (!id) return;
    
    const userId = searchParams.get('userId');
    const isOwnRun = !userId || userId === user?.id;
    
    setIsFriendRun(!isOwnRun);
    
    if (isOwnRun) {
      // Fetch from local DB, including route if available
      (async () => {
        await reloadRun(id);
        setLoading(false);
      })();
    } else {
      // Fetch friend's run from Supabase
      Promise.all([
        getRunByUserAndId(userId, id),
        getProfileById(userId),
      ])
        .then(([r, profile]) => {
          setRun(r);
          setFriendName(profile?.display_name ?? null);
          // TODO: fetch route for friend runs from Supabase if needed
          setRoutePoints(null);
        })
        .catch(() => {
          setRun(null);
          setFriendName(null);
          setRoutePoints(null);
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

  async function handleMergeHealthKit() {
    if (!db || !run) return;
    setIsMerging(true);
    try {
      const { success, error } = await mergeHealthKitMetricsIntoRun(
        db,
        run,
        settings.units,
        settings.max_heart_rate_bpm,
      );
      if (!success) {
        showToast(error || 'Could not find matching Apple Health workout', 'error');
        return;
      }
      showToast('Merged Apple Health metrics into this run', 'success');
      await reloadRun(run.id);
    } catch {
      showToast('Failed to merge Apple Health metrics', 'error');
    } finally {
      setIsMerging(false);
    }
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
            <div className="flex items-center gap-2 pr-1">
              <button
                className="text-xs text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"
                onClick={() => setShowDebug(d => !d)}
              >
                {showDebug ? 'Hide debug' : 'Show debug'}
              </button>
              {run.source === 'manual' && (
                <button
                  className="text-xs text-primary-500 font-medium disabled:opacity-50"
                  disabled={isMerging}
                  onClick={handleMergeHealthKit}
                >
                  {isMerging ? 'Merging…' : 'Merge Apple Health'}
                </button>
              )}
              <button
                className="text-sm text-primary-500 font-medium"
                onClick={() => navigate(`/log/edit/${run.id}`)}
              >
                Edit
              </button>
            </div>
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

        {/* ── Route map ────────────────────────────────────────── */}
        {!isFriendRun && run.has_route && routePoints && (
          <RunRouteMap points={routePoints} />
        )}

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

        {/* ── Debug console (local-only) ───────────────────────── */}
        {!isFriendRun && showDebug && (
          <div className="mt-2 text-[11px] text-gray-500 dark:text-gray-400 bg-gray-900/5 dark:bg-black/40 rounded-2xl px-3 py-2 max-h-56 overflow-auto">
            <p className="font-semibold mb-1">Debug — run &amp; route data</p>
            <p className="mb-1">
              has_route: {run.has_route ? '1' : '0'} · routePoints:{' '}
              {routePoints ? routePoints.length : 0}
            </p>
            <pre className="whitespace-pre-wrap break-all">
{JSON.stringify(
  {
    id: run.id,
    source: run.source,
    date: run.date,
    distance_value: run.distance_value,
    distance_unit: run.distance_unit,
    duration_seconds: run.duration_seconds,
    avg_heart_rate: run.avg_heart_rate,
    max_heart_rate: run.max_heart_rate,
    min_heart_rate: run.min_heart_rate,
    avg_cadence: run.avg_cadence,
    elevation_gain_meters: run.elevation_gain_meters,
    elevation_loss_meters: run.elevation_loss_meters,
    vo2_max: run.vo2_max,
    temperature_celsius: run.temperature_celsius,
    humidity_percent: run.humidity_percent,
    weather_condition: run.weather_condition,
  },
  null,
  2,
)}
            </pre>
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

