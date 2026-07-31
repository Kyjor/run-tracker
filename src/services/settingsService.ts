import type Database from '@tauri-apps/plugin-sql';
import type { AppSettings, DistanceUnit, DarkModePreference, PaceZones } from '../types';
import { DEFAULT_APP_SETTINGS, DEFAULT_PACE_ZONES_MI, DEFAULT_PACE_ZONES_KM } from '../types';

type SettingRow = { key: string; value: string };

export async function loadSettings(db: Database): Promise<AppSettings> {
  const rows = await db.select<SettingRow[]>('SELECT key, value FROM settings');
  const map: Record<string, string> = {};
  rows.forEach(r => { map[r.key] = r.value; });

  const units = (map['units'] as DistanceUnit) ?? DEFAULT_APP_SETTINGS.units;

  let pace_zones: PaceZones;
  if (map['pace_zones']) {
    try {
      pace_zones = JSON.parse(map['pace_zones']);
    } catch {
      pace_zones = units === 'km' ? DEFAULT_PACE_ZONES_KM : DEFAULT_PACE_ZONES_MI;
    }
  } else {
    pace_zones = units === 'km' ? DEFAULT_PACE_ZONES_KM : DEFAULT_PACE_ZONES_MI;
  }

  const maxHR = map['max_heart_rate_bpm'] ? parseInt(map['max_heart_rate_bpm'], 10) : DEFAULT_APP_SETTINGS.max_heart_rate_bpm;

  let custom_pb_distances: AppSettings['custom_pb_distances'] = [];
  if (map['custom_pb_distances']) {
    try {
      const parsed = JSON.parse(map['custom_pb_distances']);
      if (Array.isArray(parsed)) custom_pb_distances = parsed;
    } catch {
      custom_pb_distances = [];
    }
  }

  return {
    units,
    dark_mode: (map['dark_mode'] as DarkModePreference) ?? DEFAULT_APP_SETTINGS.dark_mode,
    onboarding_complete: map['onboarding_complete'] === 'true',
    sync_enabled: map['sync_enabled'] === 'true',
    last_sync_at: map['last_sync_at'] ?? '',
    pace_zones,
    max_heart_rate_bpm: isNaN(maxHR) ? DEFAULT_APP_SETTINGS.max_heart_rate_bpm : maxHR,
    daily_reminder_enabled: map['daily_reminder_enabled'] === 'true',
    daily_reminder_time: map['daily_reminder_time'] ?? DEFAULT_APP_SETTINGS.daily_reminder_time,
    ads_removed: map['ads_removed'] === 'true',
    custom_pb_distances,
  };
}

export async function saveSetting(db: Database, key: string, value: string): Promise<void> {
  await db.execute(
    'INSERT INTO settings (key, value) VALUES ($1, $2) ON CONFLICT(key) DO UPDATE SET value = $2',
    [key, value],
  );
}

export async function saveSettings(db: Database, settings: Partial<AppSettings>): Promise<void> {
  for (const [k, v] of Object.entries(settings)) {
    if (k === 'pace_zones' || k === 'custom_pb_distances') {
      await saveSetting(db, k, JSON.stringify(v));
    } else {
      await saveSetting(db, k, String(v));
    }
  }
}
