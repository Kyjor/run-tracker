import { invoke, isTauri } from '@tauri-apps/api/core';
import { listen } from '@tauri-apps/api/event';
import type { RoutePoint } from '../types';
import { haversineMeters } from '../utils/geoUtils';

export type LocationPermissionStatus =
  | 'denied'
  | 'when_in_use'
  | 'always'
  | 'not_determined';

export interface LiveRoutePoint extends RoutePoint {
  accuracy?: number;
}

export interface LiveRunSnapshot {
  state: 'idle' | 'running' | 'paused';
  started_at_ms: number;
  elapsed_seconds: number;
  distance_meters: number;
  points: LiveRoutePoint[];
  last_point?: LiveRoutePoint;
  permission_warning?: string | null;
  current_heart_rate?: number | null;
  avg_heart_rate?: number | null;
  max_heart_rate?: number | null;
  min_heart_rate?: number | null;
  paused_total_ms?: number;
  pause_started_ms?: number | null;
}

const LIVE_RUN_TICK_EVENT = 'live-run-tick';

let nativeAvailableCache: boolean | null = null;

const AUTO_PAUSE_SPEED_MPS = 0.45;
const AUTO_RESUME_SPEED_MPS = 1.2;
const AUTO_PAUSE_AFTER_MS = 8000;

interface WebSession {
  watchId: number | null;
  timerId: number | null;
  startTimeMs: number | null;
  points: LiveRoutePoint[];
  distanceMeters: number;
  state: 'idle' | 'running' | 'paused';
  pausedTotalMs: number;
  pauseStartedMs: number | null;
  manualPause: boolean;
  slowSinceMs: number | null;
}

const webSession: WebSession = {
  watchId: null,
  timerId: null,
  startTimeMs: null,
  points: [],
  distanceMeters: 0,
  state: 'idle',
  pausedTotalMs: 0,
  pauseStartedMs: null,
  manualPause: false,
  slowSinceMs: null,
};

const webListeners = new Set<(snapshot: LiveRunSnapshot) => void>();

function webElapsedSeconds(): number {
  if (webSession.startTimeMs == null || webSession.state === 'idle') return 0;
  const endMs = webSession.state === 'paused' && webSession.pauseStartedMs != null
    ? webSession.pauseStartedMs
    : Date.now();
  return Math.max(0, Math.floor((endMs - webSession.startTimeMs - webSession.pausedTotalMs) / 1000));
}

function webSnapshot(): LiveRunSnapshot {
  return {
    state: webSession.state,
    started_at_ms: webSession.startTimeMs ?? 0,
    elapsed_seconds: webElapsedSeconds(),
    distance_meters: webSession.distanceMeters,
    points: [...webSession.points],
    last_point: webSession.points.length > 0
      ? webSession.points[webSession.points.length - 1]
      : undefined,
    permission_warning: null,
    current_heart_rate: null,
    avg_heart_rate: null,
    max_heart_rate: null,
    min_heart_rate: null,
    paused_total_ms: webSession.pausedTotalMs,
    pause_started_ms: webSession.pauseStartedMs,
  };
}

function notifyWebListeners() {
  const snapshot = webSnapshot();
  for (const listener of webListeners) {
    listener(snapshot);
  }
}

function stopWebWatch() {
  if (webSession.watchId != null && typeof navigator !== 'undefined' && navigator.geolocation) {
    navigator.geolocation.clearWatch(webSession.watchId);
  }
  webSession.watchId = null;
}

function stopWebTimer() {
  if (webSession.timerId != null) {
    window.clearInterval(webSession.timerId);
  }
  webSession.timerId = null;
}

function resetWebSession() {
  stopWebWatch();
  stopWebTimer();
  webSession.startTimeMs = null;
  webSession.points = [];
  webSession.distanceMeters = 0;
  webSession.state = 'idle';
  webSession.pausedTotalMs = 0;
  webSession.pauseStartedMs = null;
  webSession.manualPause = false;
  webSession.slowSinceMs = null;
}

function pauseWebSession(manual: boolean) {
  if (webSession.state !== 'running') return;
  webSession.pauseStartedMs = Date.now();
  webSession.state = 'paused';
  webSession.manualPause = manual;
  webSession.slowSinceMs = null;
  notifyWebListeners();
}

function resumeWebSession() {
  if (webSession.state !== 'paused') return;
  if (webSession.pauseStartedMs != null) {
    webSession.pausedTotalMs += Date.now() - webSession.pauseStartedMs;
  }
  webSession.pauseStartedMs = null;
  webSession.state = 'running';
  webSession.manualPause = false;
  webSession.slowSinceMs = null;
  notifyWebListeners();
}

function startWebWatch() {
  if (typeof navigator === 'undefined' || !navigator.geolocation) {
    throw new Error('Location is not available on this device.');
  }

  const id = navigator.geolocation.watchPosition(
    (pos) => {
      const { latitude, longitude, accuracy } = pos.coords;
      const t = Date.now();
      const nextPoint: LiveRoutePoint = {
        lat: latitude,
        lng: longitude,
        t,
        accuracy: accuracy ?? undefined,
      };

      if (webSession.state === 'paused' && webSession.manualPause) return;

      if (webSession.state === 'paused' && !webSession.manualPause) {
        const last = webSession.points[webSession.points.length - 1];
        if (last?.t) {
          const dt = (t - last.t) / 1000;
          const speed = dt > 0 ? haversineMeters(last, nextPoint) / dt : 0;
          if (speed >= AUTO_RESUME_SPEED_MPS) resumeWebSession();
        }
        return;
      }

      if (webSession.state !== 'running') return;

      if (webSession.points.length === 0) {
        webSession.points = [nextPoint];
        webSession.slowSinceMs = null;
      } else {
        const last = webSession.points[webSession.points.length - 1];
        const extra = haversineMeters(last, nextPoint);
        const dt = last.t ? (t - last.t) / 1000 : 0;
        const speed = dt > 0 ? extra / dt : 0;
        if (speed < AUTO_PAUSE_SPEED_MPS) {
          if (webSession.slowSinceMs == null) webSession.slowSinceMs = t;
          else if (t - webSession.slowSinceMs >= AUTO_PAUSE_AFTER_MS) {
            pauseWebSession(false);
            return;
          }
        } else {
          webSession.slowSinceMs = null;
        }
        if (extra > 0) {
          webSession.distanceMeters += extra;
        }
        webSession.points = [...webSession.points, nextPoint];
      }
      notifyWebListeners();
    },
    () => {
      // no-op: caller surfaces errors via UI state
    },
    {
      enableHighAccuracy: true,
      maximumAge: 1000,
    },
  );
  webSession.watchId = id;
}

export async function isNativeLiveTrackingAvailable(): Promise<boolean> {
  if (nativeAvailableCache !== null) return nativeAvailableCache;
  try {
    if (!(await isTauri())) {
      nativeAvailableCache = false;
      return false;
    }
    nativeAvailableCache = await invoke<boolean>('is_native_live_tracking_available');
    return nativeAvailableCache;
  } catch {
    nativeAvailableCache = false;
    return false;
  }
}

export async function requestLocationPermission(): Promise<LocationPermissionStatus> {
  if (await isNativeLiveTrackingAvailable()) {
    const status = await invoke<string>('request_location_permission');
    return status as LocationPermissionStatus;
  }

  if (typeof navigator === 'undefined' || !navigator.geolocation) {
    return 'denied';
  }
  return 'when_in_use';
}

export async function getLiveRunSnapshot(): Promise<LiveRunSnapshot> {
  if (await isNativeLiveTrackingAvailable()) {
    return invoke<LiveRunSnapshot>('get_live_run_snapshot');
  }
  return webSnapshot();
}

export async function startLiveRun(): Promise<LiveRunSnapshot> {
  if (await isNativeLiveTrackingAvailable()) {
    await invoke('start_live_run');
    return getLiveRunSnapshot();
  }

  resetWebSession();
  webSession.startTimeMs = Date.now();
  webSession.state = 'running';
  startWebWatch();
  webSession.timerId = window.setInterval(() => {
    notifyWebListeners();
  }, 1000);
  const snapshot = webSnapshot();
  notifyWebListeners();
  return snapshot;
}

export async function pauseLiveRun(): Promise<LiveRunSnapshot> {
  if (await isNativeLiveTrackingAvailable()) {
    await invoke('pause_live_run');
    return getLiveRunSnapshot();
  }
  pauseWebSession(true);
  return webSnapshot();
}

export async function resumeLiveRun(): Promise<LiveRunSnapshot> {
  if (await isNativeLiveTrackingAvailable()) {
    await invoke('resume_live_run');
    return getLiveRunSnapshot();
  }
  resumeWebSession();
  return webSnapshot();
}

export async function stopLiveRun(): Promise<LiveRunSnapshot> {
  if (await isNativeLiveTrackingAvailable()) {
    return invoke<LiveRunSnapshot>('stop_live_run');
  }

  const snapshot = webSnapshot();
  resetWebSession();
  notifyWebListeners();
  return snapshot;
}

export async function cancelLiveRun(): Promise<void> {
  if (await isNativeLiveTrackingAvailable()) {
    await invoke('cancel_live_run');
    return;
  }
  resetWebSession();
  notifyWebListeners();
}

export async function subscribeLiveRunUpdates(
  callback: (snapshot: LiveRunSnapshot) => void,
): Promise<() => void> {
  if (await isNativeLiveTrackingAvailable()) {
    const unlisten = await listen<LiveRunSnapshot>(LIVE_RUN_TICK_EVENT, (event) => {
      callback(event.payload);
    });
    return unlisten;
  }

  webListeners.add(callback);
  return () => {
    webListeners.delete(callback);
  };
}
