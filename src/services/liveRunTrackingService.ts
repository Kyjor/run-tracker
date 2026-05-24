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
  state: 'idle' | 'running';
  started_at_ms: number;
  elapsed_seconds: number;
  distance_meters: number;
  points: LiveRoutePoint[];
  last_point?: LiveRoutePoint;
  permission_warning?: string | null;
}

const LIVE_RUN_TICK_EVENT = 'live-run-tick';

let nativeAvailableCache: boolean | null = null;

interface WebSession {
  watchId: number | null;
  timerId: number | null;
  startTimeMs: number | null;
  points: LiveRoutePoint[];
  distanceMeters: number;
}

const webSession: WebSession = {
  watchId: null,
  timerId: null,
  startTimeMs: null,
  points: [],
  distanceMeters: 0,
};

const webListeners = new Set<(snapshot: LiveRunSnapshot) => void>();

function webSnapshot(): LiveRunSnapshot {
  const running = webSession.startTimeMs != null;
  const elapsedSeconds = running
    ? Math.max(0, Math.floor((Date.now() - webSession.startTimeMs!) / 1000))
    : 0;

  return {
    state: running ? 'running' : 'idle',
    started_at_ms: webSession.startTimeMs ?? 0,
    elapsed_seconds: elapsedSeconds,
    distance_meters: webSession.distanceMeters,
    points: [...webSession.points],
    last_point: webSession.points.length > 0
      ? webSession.points[webSession.points.length - 1]
      : undefined,
    permission_warning: null,
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

      if (webSession.points.length === 0) {
        webSession.points = [nextPoint];
      } else {
        const last = webSession.points[webSession.points.length - 1];
        const extra = haversineMeters(last, nextPoint);
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
  startWebWatch();
  webSession.timerId = window.setInterval(() => {
    notifyWebListeners();
  }, 1000);
  const snapshot = webSnapshot();
  notifyWebListeners();
  return snapshot;
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
