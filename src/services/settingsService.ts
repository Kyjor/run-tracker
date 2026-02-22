import type Database from '@tauri-apps/plugin-sql';
import type { AppSettings, DistanceUnit, DarkModePreference } from '../types';
import { DEFAULT_APP_SETTINGS } from '../types';

type SettingRow = { key: string; value: string };

export async function loadSettings(db: Database): Promise<AppSettings> {
  const rows = await db.select<SettingRow[]>('SELECT key, value FROM settings');
  const map: Record<string, string> = {};
  rows.forEach(r => { map[r.key] = r.value; });

  return {
    units: (map['units'] as DistanceUnit) ?? DEFAULT_APP_SETTINGS.units,
    dark_mode: (map['dark_mode'] as DarkModePreference) ?? DEFAULT_APP_SETTINGS.dark_mode,
    onboarding_complete: map['onboarding_complete'] === 'true',
    sync_enabled: map['sync_enabled'] === 'true',
    last_sync_at: map['last_sync_at'] ?? '',
  };
}

export async function saveSetting(db: Database, key: keyof AppSettings, value: string): Promise<void> {
  await db.execute(
    'INSERT INTO settings (key, value) VALUES ($1, $2) ON CONFLICT(key) DO UPDATE SET value = $2',
    [key, value],
  );
}

export async function saveSettings(db: Database, settings: Partial<AppSettings>): Promise<void> {
  for (const [k, v] of Object.entries(settings)) {
    await saveSetting(db, k as keyof AppSettings, String(v));
  }
}

