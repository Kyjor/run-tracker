import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import type { DistanceUnit, RoutePoint, RunType } from '../types';
import { Header } from '../components/navigation/Header';
import { Card } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Spinner } from '../components/ui/Spinner';
import { RunRouteMap } from '../components/run/RunRouteMap';
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

type SessionState = 'idle' | 'running' | 'saving';

interface LivePoint extends RoutePoint {
  accuracy?: number;
}

export function LiveRunScreen() {
  const navigate = useNavigate();
  const db = useDb();
  const { settings } = useSettings();
  const { showToast } = useToast();
  const { refresh } = usePlan();
  const { session } = useAuth();

  const [sessionState, setSessionState] = useState<SessionState>('idle');
  const [points, setPoints] = useState<LivePoint[]>([]);
  const [distanceMeters, setDistanceMeters] = useState(0);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [error, setError] = useState<string | null>(null);

  const watchIdRef = useRef<number | null>(null);
  const timerIdRef = useRef<number | null>(null);
  const startTimeRef = useRef<number | null>(null);

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

  useEffect(() => {
    return () => {
      stopWatch();
      stopTimer();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function startTimer() {
    if (timerIdRef.current != null) return;
    startTimeRef.current = Date.now();
    setElapsedSeconds(0);
    const id = window.setInterval(() => {
      if (startTimeRef.current == null) return;
      const diff = Math.floor((Date.now() - startTimeRef.current) / 1000);
      setElapsedSeconds(diff);
    }, 1000);
    timerIdRef.current = id;
  }

  function stopTimer() {
    if (timerIdRef.current != null) {
      window.clearInterval(timerIdRef.current);
      timerIdRef.current = null;
    }
  }

  function startWatch() {
    if (typeof navigator === 'undefined' || !navigator.geolocation) {
      setError('Location is not available on this device.');
      return;
    }

    setError(null);
    const id = navigator.geolocation.watchPosition(
      (pos) => {
        const { latitude, longitude, accuracy } = pos.coords;
        const t = Date.now();
        setPoints((prev) => {
          const nextPoint: LivePoint = { lat: latitude, lng: longitude, t, accuracy: accuracy ?? undefined };
          if (prev.length === 0) {
            return [nextPoint];
          }
          const last = prev[prev.length - 1];
          const extra = haversineMeters(last, nextPoint);
          if (extra > 0) {
            setDistanceMeters((d) => d + extra);
          }
          return [...prev, nextPoint];
        });
      },
      (err) => {
        setError(err.message);
      },
      {
        enableHighAccuracy: true,
        maximumAge: 1000,
      },
    );
    watchIdRef.current = id;
  }

  function stopWatch() {
    if (watchIdRef.current != null && navigator.geolocation) {
      navigator.geolocation.clearWatch(watchIdRef.current);
      watchIdRef.current = null;
    }
  }

  async function handleStart() {
    if (sessionState === 'running') return;
    setPoints([]);
    setDistanceMeters(0);
    setElapsedSeconds(0);
    startWatch();
    startTimer();
    setSessionState('running');
  }

  async function handleEnd() {
    if (sessionState !== 'running') return;
    stopWatch();
    stopTimer();
    setSessionState('saving');

    try {
      if (!db) {
        throw new Error('Database is not ready');
      }
      if (distanceMeters <= 0 || elapsedSeconds <= 0) {
        throw new Error('Need some movement and time to save a run.');
      }

      const nowIso = new Date().toISOString();
      const roundedDistance = Math.round(distanceValue * 100) / 100;
      const runType: RunType = 'easy_run';

      const run = await createRun(db, {
        date: nowIso,
        distance_value: roundedDistance,
        distance_unit: unit,
        duration_seconds: elapsedSeconds,
        run_type: runType,
        notes: '',
        source: 'manual',
        has_route: points.length > 0 ? 1 : 0,
      });

      if (points.length > 0) {
        const routeId = generateId();
        await db.execute(
          'INSERT INTO run_routes (id, run_id, points_json, created_at) VALUES ($1, $2, $3, $4)',
          [routeId, run.id, JSON.stringify(points), nowIso],
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
    } finally {
      stopWatch();
      stopTimer();
    }
  }

  const isRunning = sessionState === 'running';

  return (
    <div className="flex flex-col flex-1 overflow-y-auto pb-24">
      {/* While a live run is active, disable the back button so the user can't leave the screen */}
      <Header title="Live Run" showBack={!isRunning} />

      <div className="px-4 pt-4 flex flex-col gap-4">
        <Card>
          <div className="flex items-center justify-between mb-4">
            <div>
              <p className="text-xs uppercase tracking-wide text-gray-400 dark:text-gray-500">Duration</p>
              <p className="text-2xl font-semibold text-gray-900 dark:text-gray-50">
                {formatDuration(elapsedSeconds)}
              </p>
            </div>
            <div>
              <p className="text-xs uppercase tracking-wide text-gray-400 dark:text-gray-500">Distance</p>
              <p className="text-2xl font-semibold text-gray-900 dark:text-gray-50">
                {formatDistance(distanceValue, unit)}
              </p>
            </div>
            <div>
              <p className="text-xs uppercase tracking-wide text-gray-400 dark:text-gray-500">Pace</p>
              <p className="text-2xl font-semibold text-gray-900 dark:text-gray-50">
                {formatPace(paceSeconds, unit)}
              </p>
            </div>
          </div>

          <div className="mt-4 flex flex-col gap-2">
            <p className="text-xs text-gray-500 dark:text-gray-400">
              {lastPoint
                ? `GPS locked · ${lastPoint.lat.toFixed(5)}, ${lastPoint.lng.toFixed(5)}${
                    lastPoint.accuracy ? ` · ±${Math.round(lastPoint.accuracy)}m` : ''
                  }`
                : 'Waiting for GPS fix...'}
            </p>
            {error && (
              <p className="text-xs text-red-500">
                {error}
              </p>
            )}
          </div>
        </Card>

        {/* Live route preview */}
        {points.length > 1 && (
          <RunRouteMap points={points} />
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
                    Live tracking uses your phone&apos;s GPS while this screen is open. For best accuracy, keep
                    the app in the foreground.
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

function haversineMeters(a: RoutePoint, b: RoutePoint): number {
  const R = 6371000; // metres
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);

  const sinDLat = Math.sin(dLat / 2);
  const sinDLng = Math.sin(dLng / 2);

  const h =
    sinDLat * sinDLat +
    Math.cos(lat1) * Math.cos(lat2) * sinDLng * sinDLng;
  const c = 2 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));
  return R * c;
}


