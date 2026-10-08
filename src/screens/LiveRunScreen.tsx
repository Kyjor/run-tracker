import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ACTIVITY_LABELS, PACE_ZONE_LABELS, type DistanceUnit, type PaceZoneType, type RunType } from '../types';
import { Header } from '../components/navigation/Header';
import { Card } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Spinner } from '../components/ui/Spinner';
import { RunRouteMap } from '../components/run/RunRouteMap';
import { AnimatedNumber } from '../components/motion/AnimatedNumber';
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
import { formatDuration, formatPace, calcPaceSeconds } from '../utils/paceUtils';
import { buildHrZonesFromSummary } from '../utils/hrZones';
import {
  getLiveRunSnapshot,
  isNativeLiveTrackingAvailable,
  pauseLiveRun,
  requestLocationPermission,
  resumeLiveRun,
  startLiveRun,
  stopLiveRun,
  subscribeLiveRunUpdates,
  type LiveRunSnapshot,
} from '../services/liveRunTrackingService';
import { EffortPicker } from '../components/run/EffortPicker';
import { hapticTick, speak, spokenDuration } from '../utils/runCues';
import { parseSegments } from '../utils/workoutUtils';

type SessionState = 'idle' | 'running' | 'paused' | 'review' | 'saving';

function flattenSegments(raw: string | null | undefined, unit: DistanceUnit) {
  const segments = parseSegments(raw) ?? [];
  const metersPerUnit = unit === 'mi' ? 1609.34 : 1000;
  const rows: { meters: number; label: string }[] = [];
  for (const segment of segments) {
    const reps = segment.reps && segment.reps > 0 ? segment.reps : 1;
    const each = (segment.distance_value ?? 0) * metersPerUnit;
    if (each <= 0) continue;
    const label = segment.description || PACE_ZONE_LABELS[segment.zone];
    for (let i = 0; i < reps; i++) rows.push({ meters: each, label });
  }
  return rows;
}

function crossedSegments(rows: { meters: number }[], distanceMeters: number) {
  let acc = 0;
  let crossed = 0;
  for (const row of rows) {
    acc += row.meters;
    if (distanceMeters >= acc) crossed += 1;
    else break;
  }
  return crossed;
}

const ZONE_FOR_ACTIVITY: Partial<Record<string, PaceZoneType>> = {
  easy_run: 'easy',
  pace_run: 'race',
  tempo_run: 'tempo',
  long_run: 'long',
  intervals: 'intervals',
  race: 'race',
};

function applySnapshot(snapshot: LiveRunSnapshot) {
  return {
    points: snapshot.points,
    distanceMeters: snapshot.distance_meters,
    elapsedSeconds: Math.floor(snapshot.elapsed_seconds),
    permissionWarning: snapshot.permission_warning ?? null,
    isRunning: snapshot.state === 'running',
    isPaused: snapshot.state === 'paused',
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
  const { refresh, todayActivity } = usePlan();
  const { session } = useAuth();

  const [sessionState, setSessionState] = useState<SessionState>('idle');
  const [pendingSnapshot, setPendingSnapshot] = useState<LiveRunSnapshot | null>(null);
  const [effort, setEffort] = useState<number | null>(null);
  const reviewing = useRef(false);
  const splitRef = useRef({ index: 0, elapsed: 0, primed: false });
  const segmentRef = useRef(0);
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
  const isPaused = sessionState === 'paused';
  const isActive = isRunning || isPaused;

  const planDay = todayActivity?.plan_day ?? null;
  const runLike = planDay != null && planDay.activity_type !== 'rest' && planDay.activity_type !== 'cross_training';
  const targetZone = planDay ? ZONE_FOR_ACTIVITY[planDay.activity_type] : undefined;
  const targetPace = targetZone ? settings.pace_zones[targetZone] : null;
  const plannedDistance = runLike && planDay?.distance_value
    ? (planDay.distance_unit === unit
      ? planDay.distance_value
      : unit === 'mi'
        ? planDay.distance_value / 1.60934
        : planDay.distance_value * 1.60934)
    : null;
  const remaining = plannedDistance != null ? Math.max(0, plannedDistance - distanceValue) : null;

  useEffect(() => {
    if (!isRunning) {
      splitRef.current.primed = false;
      return;
    }
    const splitMeters = unit === 'mi' ? 1609.34 : 1000;
    const index = Math.floor(distanceMeters / splitMeters);
    const segmentRows = flattenSegments(planDay?.workout_segments, unit);
    const crossed = crossedSegments(segmentRows, distanceMeters);
    if (!splitRef.current.primed) {
      splitRef.current = { index, elapsed: elapsedSeconds, primed: true };
      segmentRef.current = crossed;
      return;
    }
    if (index > splitRef.current.index) {
      const splitSeconds = Math.max(0, elapsedSeconds - splitRef.current.elapsed);
      splitRef.current = { index, elapsed: elapsedSeconds, primed: true };
      const unitName = unit === 'mi' ? 'Mile' : 'Kilometer';
      let line = `${unitName} ${index}. ${spokenDuration(splitSeconds)}.`;
      if (targetPace && splitSeconds > 0) {
        const delta = Math.round(splitSeconds - targetPace);
        if (Math.abs(delta) >= 8) {
          line += delta > 0 ? ` ${delta} seconds slow.` : ` ${Math.abs(delta)} seconds fast.`;
        }
      }
      speak(line);
      void hapticTick();
    }

    if (crossed > segmentRef.current && crossed < segmentRows.length) {
      speak(`Next. ${segmentRows[crossed].label}.`);
      void hapticTick();
    }
    segmentRef.current = crossed;
  }, [isRunning, distanceMeters, elapsedSeconds, unit, targetPace, planDay]);

  const syncFromSnapshot = useRef((snapshot: LiveRunSnapshot) => {
    const next = applySnapshot(snapshot);
    setPoints(next.points);
    setDistanceMeters(next.distanceMeters);
    setElapsedSeconds(next.elapsedSeconds);
    setPermissionWarning(next.permissionWarning);
    setCurrentHr(next.currentHr);
    if (reviewing.current) return;
    if (next.isRunning) setSessionState('running');
    else if (next.isPaused) setSessionState('paused');
    else setSessionState('idle');
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

  async function handlePause() {
    const snapshot = await pauseLiveRun();
    syncFromSnapshot(snapshot);
    speak('Paused.');
  }

  async function handleResume() {
    const snapshot = await resumeLiveRun();
    syncFromSnapshot(snapshot);
    speak('Resumed.');
  }

  async function handleEnd() {
    if (sessionState !== 'running' && sessionState !== 'paused') return;
    reviewing.current = true;
    try {
      const snapshot = await stopLiveRun();
      if (bleEnabled) await stopHrmScan();
      if (snapshot.distance_meters <= 0 || snapshot.elapsed_seconds <= 0) {
        reviewing.current = false;
        throw new Error('Need some movement and time to save a run.');
      }
      setPendingSnapshot(snapshot);
      setDistanceMeters(snapshot.distance_meters);
      setElapsedSeconds(Math.floor(snapshot.elapsed_seconds));
      setPoints(snapshot.points);
      setSessionState('review');
    } catch (e) {
      reviewing.current = false;
      const message = e instanceof Error ? e.message : String(e);
      setError(message);
      showToast('Could not save live run', 'error');
    }
  }

  async function handleSave() {
    const snapshot = pendingSnapshot;
    if (!snapshot || !db) return;
    setSessionState('saving');

    try {
      if (snapshot.distance_meters <= 0 || snapshot.elapsed_seconds <= 0) {
        throw new Error('Need some movement and time to save a run.');
      }

      const saveDistanceValue = unit === 'mi'
        ? snapshot.distance_meters / 1609.34
        : snapshot.distance_meters / 1000;
      const roundedDistance = Math.round(saveDistanceValue * 100) / 100;
      const nowIso = new Date().toISOString();
      const activity = planDay?.activity_type;
      const runType: RunType = activity && activity in ACTIVITY_LABELS && activity !== 'rest' && activity !== 'cross_training'
        ? activity as RunType
        : 'easy_run';
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
        plan_day_id: planDay?.id ?? null,
        notes: '',
        effort,
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

      showToast('Live run saved', 'success');
      reviewing.current = false;
      setPendingSnapshot(null);
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
      setSessionState('review');
    }
  }

  return (
    <div className="flex flex-col flex-1 overflow-y-auto pb-safe-bottom">
      <Header title={isPaused ? 'Paused' : 'Live Run'} showBack={!isActive && sessionState !== 'review'} />

      <div className="px-4 pt-6 flex flex-col gap-4">
        <div className="text-center">
          <p className="text-[11px] uppercase tracking-wide text-ink-muted">Time</p>
          <p className="text-6xl font-semibold tabular-nums text-ink-primary dark:text-ink-dark-primary leading-none">
            {isRunning
              ? <AnimatedNumber value={elapsedSeconds} format={(n) => formatDuration(Math.floor(n))} />
              : formatDuration(elapsedSeconds)}
          </p>
          {isPaused && (
            <p className="text-sm text-amber-600 dark:text-amber-400 mt-2">Time is frozen. It resumes when you move, or when you tap Resume.</p>
          )}
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="text-center">
            <p className="text-[11px] uppercase tracking-wide text-ink-muted">{unit}</p>
            <p className="text-4xl font-semibold tabular-nums">
              {isRunning
                ? <AnimatedNumber value={distanceValue} format={(n) => n.toFixed(2)} />
                : distanceValue.toFixed(2)}
            </p>
          </div>
          <div className="text-center">
            <p className="text-[11px] uppercase tracking-wide text-ink-muted">Pace</p>
            <p className="text-4xl font-semibold tabular-nums">{formatPace(paceSeconds, unit)}</p>
          </div>
        </div>

        {(runLike || currentHr != null || targetPace) && (
          <p className="text-center text-sm text-ink-secondary dark:text-ink-dark-secondary">
            {runLike && planDay ? ACTIVITY_LABELS[planDay.activity_type] : null}
            {targetPace ? ` · target ${formatPace(targetPace, unit)}` : ''}
            {remaining != null ? ` · ${remaining.toFixed(2)} ${unit} left` : ''}
            {currentHr != null ? ` · ${Math.round(currentHr)} bpm` : ''}
          </p>
        )}

        {isActive && (
          <RunRouteMap points={points} followLatest className="h-40 rounded-card" />
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

        {usesNativeTracking && sessionState === 'idle' && (
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

        {sessionState === 'review' && (
          <Card>
            <EffortPicker value={effort} onChange={setEffort} />
            <Button className="w-full mt-4" size="lg" onClick={handleSave}>Save run</Button>
          </Card>
        )}

        {sessionState !== 'review' && (
          <div className="flex flex-col gap-3">
            {sessionState === 'saving' ? (
              <div className="flex items-center justify-center gap-2 text-gray-500">
                <Spinner size="sm" />
                <span className="text-sm">Saving run...</span>
              </div>
            ) : isActive ? (
              <div className="grid grid-cols-2 gap-3">
                <Button size="lg" variant="secondary" onClick={isPaused ? handleResume : handlePause}>
                  {isPaused ? 'Resume' : 'Pause'}
                </Button>
                <Button size="lg" onClick={handleEnd}>End</Button>
              </div>
            ) : (
              <>
                <Button className="w-full" size="lg" onClick={handleStart}>
                  {planDay && runLike ? `Start ${ACTIVITY_LABELS[planDay.activity_type]}` : 'Start run'}
                </Button>
                <div className="flex justify-center gap-4 text-sm">
                  <button type="button" className="text-primary-600 dark:text-primary-400" onClick={() => navigate('/log/manual')}>Log manually</button>
                  <button type="button" className="text-primary-600 dark:text-primary-400" onClick={() => navigate('/log/import-fit')}>Import</button>
                </div>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
