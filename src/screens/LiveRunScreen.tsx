import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import type { DistanceUnit, RunType } from '../types';
import { Header } from '../components/navigation/Header';
import { Card } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Spinner } from '../components/ui/Spinner';
import { RunRouteMap } from '../components/run/RunRouteMap';
import { AnimatedNumber } from '../components/motion/AnimatedNumber';
import { FadeIn } from '../components/motion/FadeIn';
import { useDb } from '../contexts/DatabaseContext';
import { useSettings } from '../contexts/SettingsContext';
import { useToast } from '../contexts/ToastContext';
import { usePlan } from '../contexts/PlanContext';
import { useAuth } from '../contexts/AuthContext';
import { createRun } from '../services/runService';
import { publishFeedActivity } from '../services/socialService';
import { syncToCloud } from '../services/syncService';
import { generateId } from '../utils/generateId';
import { formatDistance, formatDuration, formatPace, calcPaceSeconds } from '../utils/paceUtils';
import {
  getLiveRunSnapshot,
  isNativeLiveTrackingAvailable,
  requestLocationPermission,
  startLiveRun,
  stopLiveRun,
  subscribeLiveRunUpdates,
  type LiveRunSnapshot,
} from '../services/liveRunTrackingService';

type SessionState = 'idle' | 'running' | 'saving';

function applySnapshot(snapshot: LiveRunSnapshot) {
  return {
    points: snapshot.points,
    distanceMeters: snapshot.distance_meters,
    elapsedSeconds: Math.floor(snapshot.elapsed_seconds),
    permissionWarning: snapshot.permission_warning ?? null,
    isRunning: snapshot.state === 'running',
  };
}

export function LiveRunScreen() {
  const navigate = useNavigate();
  const db = useDb();
  const { settings } = useSettings();
  const { showToast } = useToast();
  const { refresh } = usePlan();
  const { session } = useAuth();

  const [sessionState, setSessionState] = useState<SessionState>('idle');
  const [points, setPoints] = useState<LiveRunSnapshot['points']>([]);
  const [distanceMeters, setDistanceMeters] = useState(0);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [permissionWarning, setPermissionWarning] = useState<string | null>(null);
  const [usesNativeTracking, setUsesNativeTracking] = useState(false);

  const unit: DistanceUnit = settings.units;

  const distanceValue = useMemo(() => {
    if (distanceMeters <= 0) return 0;
    return unit === 'mi' ? distanceMeters / 1609.34 : distanceMeters / 1000;
  }, [distanceMeters, unit]);

  const paceSeconds = useMemo(
    () => calcPaceSeconds(distanceValue, elapsedSeconds, unit),
    [distanceValue, elapsedSeconds, unit],
  );

  const lastPoint = points.length > 0 ? points[points.length - 1] : null;
  const isRunning = sessionState === 'running';

  const syncFromSnapshot = useRef((snapshot: LiveRunSnapshot) => {
    const next = applySnapshot(snapshot);
    setPoints(next.points);
    setDistanceMeters(next.distanceMeters);
    setElapsedSeconds(next.elapsedSeconds);
    setPermissionWarning(next.permissionWarning);
    setSessionState(next.isRunning ? 'running' : 'idle');
  }).current;

  useEffect(() => {
    let cancelled = false;
    let unlisten: (() => void) | undefined;
    let pollId: number | undefined;

    async function init() {
      const native = await isNativeLiveTrackingAvailable();
      if (cancelled) return;
      setUsesNativeTracking(native);

      const snapshot = await getLiveRunSnapshot();
      if (cancelled) return;
      syncFromSnapshot(snapshot);

      unlisten = await subscribeLiveRunUpdates((next) => {
        if (!cancelled) syncFromSnapshot(next);
      });

      pollId = window.setInterval(() => {
        void getLiveRunSnapshot().then((next) => {
          if (!cancelled) syncFromSnapshot(next);
        });
      }, 2000);
    }

    void init();

    return () => {
      cancelled = true;
      if (unlisten) unlisten();
      if (pollId != null) window.clearInterval(pollId);
    };
  }, [syncFromSnapshot]);

  async function handleStart() {
    if (sessionState === 'running') return;

    try {
      setError(null);
      const native = await isNativeLiveTrackingAvailable();
      setUsesNativeTracking(native);
      const permission = await requestLocationPermission();
      if (permission === 'denied') {
        throw new Error('Location permission is required to track a live run.');
      }

      const snapshot = await startLiveRun();
      syncFromSnapshot(snapshot);

      if (permission === 'when_in_use' && native) {
        setPermissionWarning(
          'Background tracking may stop when the phone is locked. Enable Always location in Settings for reliable tracking.',
        );
      }
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e);
      setError(message);
      showToast('Could not start live run', 'error');
    }
  }

  async function handleEnd() {
    if (sessionState !== 'running') return;
    setSessionState('saving');

    try {
      const snapshot = await stopLiveRun();

      if (!db) {
        throw new Error('Database is not ready');
      }
      if (snapshot.distance_meters <= 0 || snapshot.elapsed_seconds <= 0) {
        throw new Error('Need some movement and time to save a run.');
      }

      const saveDistanceValue = unit === 'mi'
        ? snapshot.distance_meters / 1609.34
        : snapshot.distance_meters / 1000;
      const roundedDistance = Math.round(saveDistanceValue * 100) / 100;
      const nowIso = new Date().toISOString();
      const runType: RunType = 'easy_run';

      const run = await createRun(db, {
        date: nowIso,
        distance_value: roundedDistance,
        distance_unit: unit,
        duration_seconds: Math.floor(snapshot.elapsed_seconds),
        run_type: runType,
        notes: '',
        source: 'manual',
        has_route: snapshot.points.length > 0 ? 1 : 0,
      });

      if (snapshot.points.length > 0) {
        const routeId = generateId();
        await db.execute(
          'INSERT INTO run_routes (id, run_id, points_json, created_at) VALUES ($1, $2, $3, $4)',
          [routeId, run.id, JSON.stringify(snapshot.points), nowIso],
        );
      }

      showToast('Live run saved! 🎉', 'success');
      await refresh();

      if (session) {
        publishFeedActivity('run_completed', {
          distance: run.distance_value,
          unit: run.distance_unit,
          duration: run.duration_seconds,
          run_type: run.run_type,
          run_id: run.id,
          run_date: run.date,
        }).catch(() => {});

        syncToCloud(db).catch(() => {});
      }

      navigate(`/runs/${run.id}`);
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e);
      setError(message);
      showToast('Could not save live run', 'error');
      setSessionState('idle');
    }
  }

  return (
    <div className="flex flex-col flex-1 overflow-y-auto pb-safe-bottom">
      <Header title="Live Run" showBack={!isRunning} />

      {isRunning && (
        <div className="relative mx-4 mt-2">
          <RunRouteMap points={points} followLatest className="h-72 rounded-card" />
          <div className="absolute bottom-3 left-3 right-3 flex gap-2">
            <MetricPill label="Time" live={elapsedSeconds} format={(n) => formatDuration(Math.floor(n))} />
            <MetricPill label={unit} live={distanceValue} format={(n) => formatDistance(n, unit)} />
            <MetricPill label="Pace" value={formatPace(paceSeconds, unit)} />
          </div>
        </div>
      )}

      <div className="px-4 pt-4 flex flex-col gap-4">
        {!isRunning && (
          <FadeIn>
            <Card>
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs uppercase tracking-wide text-ink-muted">Duration</p>
                  <p className="text-2xl font-semibold tabular-nums">{formatDuration(elapsedSeconds)}</p>
                </div>
                <div>
                  <p className="text-xs uppercase tracking-wide text-ink-muted">Distance</p>
                  <p className="text-2xl font-semibold tabular-nums">{formatDistance(distanceValue, unit)}</p>
                </div>
                <div>
                  <p className="text-xs uppercase tracking-wide text-ink-muted">Pace</p>
                  <p className="text-2xl font-semibold tabular-nums">{formatPace(paceSeconds, unit)}</p>
                </div>
              </div>
            </Card>
          </FadeIn>
        )}

        <div className="flex flex-col gap-1 px-1">
          <p className="text-xs text-ink-secondary">
            {lastPoint
              ? `GPS · ±${lastPoint.accuracy ? Math.round(lastPoint.accuracy) : '?'}m`
              : 'Waiting for GPS fix…'}
          </p>
          {permissionWarning && <p className="text-xs text-amber-600 dark:text-amber-400">{permissionWarning}</p>}
          {error && <p className="text-xs text-red-500">{error}</p>}
        </div>

        <Card>
          <div className="flex flex-col items-center gap-4">
            {sessionState === 'saving' ? (
              <div className="flex items-center gap-2 text-gray-500 dark:text-gray-400">
                <Spinner size="sm" />
                <span className="text-sm">Saving run...</span>
              </div>
            ) : (
              <>
                <Button
                  className="w-full"
                  size="lg"
                  onClick={isRunning ? handleEnd : handleStart}
                >
                  {isRunning ? 'End run' : 'Start live run'}
                </Button>
                {!isRunning && (
                  <p className="text-xs text-gray-500 dark:text-gray-400 text-center">
                    {usesNativeTracking
                      ? 'Live tracking continues in the background when you lock your phone or switch apps. Tap the banner to return to your run.'
                      : 'Live tracking uses your browser GPS while this screen is open.'}
                  </p>
                )}
              </>
            )}
          </div>
        </Card>
      </div>
    </div>
  );
}

function MetricPill({
  label,
  value,
  live,
  format,
}: {
  label: string;
  value?: string;
  live?: number;
  format?: (n: number) => string;
}) {
  return (
    <div className="flex-1 rounded-2xl bg-map-overlay backdrop-blur-md px-3 py-2 text-center">
      <p className="text-[10px] uppercase tracking-wide text-white/70">{label}</p>
      <p className="text-sm font-bold text-white tabular-nums">
        {live != null && format ? <AnimatedNumber value={live} format={format} /> : value}
      </p>
    </div>
  );
}
