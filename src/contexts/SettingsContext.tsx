import React, { createContext, useContext, useEffect, useState, useCallback, useRef } from 'react';
import type { AppSettings } from '../types';
import { DEFAULT_APP_SETTINGS } from '../types';
import { loadSettings, saveSettings } from '../services/settingsService';
import { useDatabase } from './DatabaseContext';

interface SettingsContextValue {
  settings: AppSettings;
  updateSettings: (updates: Partial<AppSettings>) => Promise<void>;
  isLoaded: boolean;
}

const SettingsContext = createContext<SettingsContextValue>({
  settings: DEFAULT_APP_SETTINGS,
  updateSettings: async () => {},
  isLoaded: false,
});

export function SettingsProvider({ children }: { children: React.ReactNode }) {
  const { db, isReady } = useDatabase();
  const [settings, setSettings] = useState<AppSettings>(DEFAULT_APP_SETTINGS);
  const [isLoaded, setIsLoaded] = useState(false);
  const settingsRef = useRef(settings);
  settingsRef.current = settings;

  useEffect(() => {
    if (!db || !isReady) return;
    loadSettings(db).then(s => {
      setSettings(s);
      setIsLoaded(true);
    });
  }, [db, isReady]);

  const updateSettings = useCallback(async (updates: Partial<AppSettings>) => {
    if (!db) return;
    const next = { ...settingsRef.current, ...updates };
    setSettings(next);
    await saveSettings(db, updates);
  }, [db]);

  // Restore Remove Ads entitlement from the store when possible
  useEffect(() => {
    if (!isLoaded || !db) return;
    if (settingsRef.current.ads_removed) return;

    let unsub: (() => void) | undefined;
    let cancelled = false;

    void (async () => {
      try {
        const { syncAdsRemovedFromStore, listenForRemoveAdsPurchases } = await import('../native/iap');
        const owned = await syncAdsRemovedFromStore();
        if (!cancelled && owned) {
          await updateSettings({ ads_removed: true });
        }
        unsub = await listenForRemoveAdsPurchases(async () => {
          await updateSettings({ ads_removed: true });
        });
      } catch {
        /* store unavailable in web/dev */
      }
    })();

    return () => {
      cancelled = true;
      unsub?.();
    };
  }, [isLoaded, db, updateSettings]);

  // Apply dark mode class to document (+ listen for system changes)
  useEffect(() => {
    const apply = () => {
      const { dark_mode } = settings;
      const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
      const isDark = dark_mode === 'dark' || (dark_mode === 'system' && prefersDark);
      document.documentElement.classList.toggle('dark', isDark);
    };
    apply();
    if (settings.dark_mode !== 'system') return;
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    const handler = () => apply();
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  }, [settings.dark_mode]);

  return (
    <SettingsContext.Provider value={{ settings, updateSettings, isLoaded }}>
      {children}
    </SettingsContext.Provider>
  );
}

export function useSettings(): SettingsContextValue {
  return useContext(SettingsContext);
}
