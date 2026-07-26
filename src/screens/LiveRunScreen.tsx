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
import { assignGearToRun, getDefaultGearIds } from '../services/gearService';
import { publishFeedActivity } from '../services/socialService';
import { syncToCloud } from '../services/syncService';
import { startHrmScan, stopHrmScan, isHrmConnected } from '../services/hrmService';
import { generateId } from '../utils/generateId';
import { formatDistance, formatDuration, formatPace, calcPaceSeconds } from '../utils/paceUtils';
import { buildHrZonesFromSummary } from '../utils/hrZones';
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
    currentHr: snapshot.current_heart_rate ?? null,
    avgHr: snapshot.avg_heart_rate ?? null,
    maxHr: snapshot.max_heart_rate ?? null,
    minHr: snapshot.min_heart_rate ?? null,
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
  const [currentHr, setCurrentHr] = useState<number | null>(null);
  const [bleEnabled, setBleEnabled] = useState(false);
  const [bleConnected, setBleConnected] = useState(false);

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
    setCurrentHr(next.currentHr);
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
        if (bleEnabled) {
          void isHrmConnected().then(c => { if (!cancelled) setBleConnected(c); });
        }
      }, 2000);
    }

    void init();

    return () => {
      cancelled = true;
      if (unlisten) unlisten();
      if (pollId != null) window.clearInterval(pollId);
    };
  }, [syncFromSnapshot, bleEnabled]);

  async function handleToggleBle() {
    if (bleEnabled) {
      await stopHrmScan();
      setBleEnabled(false);
      setBleConnected(false);
      return;
    }
    const ok = await startHrmScan();
    if (!ok) {
      showToast('BLE HRM unavailable on this device', 'error');
      return;
    }
    setBleEnabled(true);
    showToast('Scanning for heart rate monitor…', 'info');
  }

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

      if (bleEnabled) {
        await startHrmScan();
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
      if (bleEnabled) await stopHrmScan();

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
      const duration = Math.floor(snapshot.elapsed_seconds);
      const avgHr = snapshot.avg_heart_rate ?? null;
      const maxHr = snapshot.max_heart_rate ?? null;
      const minHr = snapshot.min_heart_rate ?? null;

      const run = await createRun(db, {
        date: nowIso,
        distance_value: roundedDistance,
        distance_unit: unit,
        duration_seconds: duration,
        run_type: runType,
        notes: '',
        source: 'live',
        has_route: snapshot.points.length > 0 ? 1 : 0,
        avg_heart_rate: avgHr,
        max_heart_rate: maxHr,
        min_heart_rate: minHr,
        hr_zones: buildHrZonesFromSummary(avgHr, maxHr, duration, settings.max_heart_rate_bpm),
      });

      if (snapshot.points.length > 0) {
        const routeId = generateId();
        await db.execute(
          'INSERT INTO run_routes (id, run_id, points_json, created_at) VALUES ($1, $2, $3, $4)',
          [routeId, run.id, JSON.stringify(snapshot.points), nowIso],
        );
      }

      const gearIds = await getDefaultGearIds(db);
      if (gearIds.length > 0) {
        await assignGearToRun(db, run.id, gearIds);
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
            {currentHr != null && (
              <MetricPill label="HR" live={currentHr} format={(n) => `${Math.round(n)}`} />
            )}
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
            {currentHr != null ? ` · HR ${Math.round(currentHr)} bpm` : ''}
          </p>
          {permissionWarning && <p className="text-xs text-amber-600 dark:text-amber-400">{permissionWarning}</p>}
          {error && <p className="text-xs text-red-500">{error}</p>}
        </div>

        {usesNativeTracking && !isRunning && (
          <Card>
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-sm font-medium text-ink-primary dark:text-ink-dark-primary">
                  Bluetooth HRM
                </p>
                <p className="text-xs text-ink-muted dark:text-ink-dark-muted mt-0.5">
                  {bleEnabled
                    ? (bleConnected ? 'Connected to chest strap' : 'Scanning for strap…')
                    : 'Optional — also reads HR from Apple Health'}
                </p>
              </div>
              <Button size="sm" variant={bleEnabled ? 'secondary' : 'primary'} onClick={handleToggleBle}>
                {bleEnabled ? 'Stop' : 'Connect'}
              </Button>
            </div>
          </Card>
        )}

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
