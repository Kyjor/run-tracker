import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
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

  useEffect(() => {
    if (!db || !isReady) return;
    loadSettings(db).then(s => {
      setSettings(s);
      setIsLoaded(true);
    });
  }, [db, isReady]);

  // Apply dark mode class to document
  useEffect(() => {
    const { dark_mode } = settings;
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    const isDark = dark_mode === 'dark' || (dark_mode === 'system' && prefersDark);
    document.documentElement.classList.toggle('dark', isDark);
  }, [settings.dark_mode]);

  const updateSettings = useCallback(async (updates: Partial<AppSettings>) => {
    if (!db) return;
    const next = { ...settings, ...updates };
    setSettings(next);
    await saveSettings(db, updates);
  }, [db, settings]);

  return (
    <SettingsContext.Provider value={{ settings, updateSettings, isLoaded }}>
      {children}
    </SettingsContext.Provider>
  );
}

export function useSettings(): SettingsContextValue {
  return useContext(SettingsContext);
}

