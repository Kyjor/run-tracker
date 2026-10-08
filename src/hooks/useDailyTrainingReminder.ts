import { useEffect } from 'react';
import { usePlan } from '../contexts/PlanContext';
import { useSettings } from '../contexts/SettingsContext';
import { useToast } from '../contexts/ToastContext';
import { useDatabase } from '../contexts/DatabaseContext';
import { ACTIVITY_LABELS } from '../types';
import { formatDistance } from '../utils/paceUtils';
import { planDayToDate } from '../utils/dateUtils';
import { getPlanDays } from '../services/planService';

/**
 * Get current notification permission status.
 * Returns 'granted' | 'denied' | 'default' | 'unknown'
 */
export async function getNotificationPermissionStatus(): Promise<'granted' | 'denied' | 'default' | 'unknown'> {
  try {
    const { isTauri } = await import('@tauri-apps/api/core');
    if (await isTauri()) {
      try {
        const { isPermissionGranted } = await import('@tauri-apps/plugin-notification');
        const granted = await isPermissionGranted();
        return granted ? 'granted' : 'denied';
      } catch (pluginError) {
        console.warn('[Notifications] Tauri notification plugin error:', pluginError);
        // Fall through to web API
      }
    }
  } catch (error) {
    console.warn('[Notifications] Failed to check Tauri status:', error);
    // Fall through to web API
  }

  // Fallback: Web Notification API
  try {
    if (typeof window !== 'undefined' && 'Notification' in window) {
      return Notification.permission as 'granted' | 'denied' | 'default';
    }
  } catch (error) {
    console.warn('[Notifications] Web Notification API not available:', error);
  }

  return 'unknown';
}

/**
 * Request notification permission proactively (call on app startup if reminder is enabled).
 * Returns { granted: boolean, status: string, needsSettings: boolean }
 * needsSettings is true if permission was previously denied and user needs to go to iOS Settings.
 */
export async function requestNotificationPermission(): Promise<{ granted: boolean; status: string; needsSettings: boolean }> {
  // Try Tauri native notifications first (iOS / desktop)
  try {
    const { isTauri } = await import('@tauri-apps/api/core');
    if (await isTauri()) {
      const { isPermissionGranted, requestPermission } = await import('@tauri-apps/plugin-notification');
      let granted = await isPermissionGranted();
      console.log('[Notifications] Current Tauri permission status:', granted ? 'granted' : 'denied');
      
      if (!granted) {
        console.log('[Notifications] Requesting Tauri notification permission...');
        try {
          const permission = await requestPermission();
          console.log('[Notifications] Tauri permission result:', permission);
          granted = permission === 'granted';
          
          // On iOS, if permission was previously denied, requestPermission() may return 'denied'
          // without showing a prompt. In that case, user needs to go to Settings.
          if (permission === 'denied') {
            return { granted: false, status: 'denied', needsSettings: true };
          }
          
          return { granted, status: permission, needsSettings: false };
        } catch (error) {
          console.error('[Notifications] Error requesting Tauri permission:', error);
          // If requestPermission throws, it might mean permission was previously denied
          return { granted: false, status: 'denied', needsSettings: true };
        }
      } else {
        console.log('[Notifications] Tauri permission already granted');
        return { granted: true, status: 'granted', needsSettings: false };
      }
    }
  } catch (error) {
    console.warn('[Notifications] Tauri notification plugin not available:', error);
  }

  // Fallback: Web Notification API
  if (typeof window !== 'undefined' && 'Notification' in window) {
    if (Notification.permission === 'granted') {
      console.log('[Notifications] Web notification permission already granted');
      return { granted: true, status: 'granted', needsSettings: false };
    }
    if (Notification.permission === 'denied') {
      console.log('[Notifications] Web notification permission was previously denied');
      return { granted: false, status: 'denied', needsSettings: true };
    }
    if (Notification.permission === 'default') {
      console.log('[Notifications] Requesting web notification permission...');
      try {
        const permission = await Notification.requestPermission();
        console.log('[Notifications] Web permission result:', permission);
        return { granted: permission === 'granted', status: permission, needsSettings: false };
      } catch (error) {
        console.warn('[Notifications] Failed to request web notification permission:', error);
        return { granted: false, status: 'error', needsSettings: false };
      }
    }
  }

  return { granted: false, status: 'unknown', needsSettings: false };
}

const REMINDER_IDS = Array.from({ length: 21 }, (_, i) => 880000 + i);

function reminderAt(dateIso: string, hour: number, minute: number): Date {
  const [year, month, day] = dateIso.split('-').map(Number);
  return new Date(year, month - 1, day, hour, minute, 0, 0);
}

async function clearScheduledReminders() {
  try {
    const { isTauri } = await import('@tauri-apps/api/core');
    if (!(await isTauri())) return;
    const { cancel } = await import('@tauri-apps/plugin-notification');
    await cancel(REMINDER_IDS);
  } catch {
    // No pending reminders, or notifications are unavailable.
  }
}

export function useDailyTrainingReminder() {
  const { activePlan, isLoading } = usePlan();
  const { db } = useDatabase();
  const { settings } = useSettings();
  const { showToast } = useToast();

  useEffect(() => {
    if (!settings.daily_reminder_enabled) return;
    void requestNotificationPermission().then(({ granted, needsSettings }) => {
      if (!granted && needsSettings) {
        showToast('Notification permission denied. Enable in Settings > Run 4 Fun > Notifications', 'info');
      }
    });
  }, [settings.daily_reminder_enabled, showToast]);

  useEffect(() => {
    if (isLoading) return;
    if (!settings.daily_reminder_enabled || !db || !activePlan) {
      void clearScheduledReminders();
      return;
    }

    const time = settings.daily_reminder_time ?? '08:00';
    const [hStr, mStr] = time.split(':');
    const targetHour = parseInt(hStr, 10);
    const targetMinute = parseInt(mStr, 10);
    if (isNaN(targetHour) || isNaN(targetMinute)) return;

    let cancelled = false;

    (async () => {
      const days = await getPlanDays(db, activePlan.plan_id);
      if (cancelled) return;

      const upcoming = days
        .filter(day => day.activity_type !== 'rest')
        .map(day => {
          const iso = planDayToDate(activePlan.start_date, day.week_number, day.day_of_week);
          const when = reminderAt(iso, targetHour, targetMinute);
          const label = ACTIVITY_LABELS[day.activity_type];
          const details = day.distance_value
            ? formatDistance(day.distance_value, day.distance_unit)
            : day.duration_minutes
              ? `${day.duration_minutes} min`
              : '';
          return {
            when,
            body: details ? `${label} · ${details}` : label,
          };
        })
        .filter(item => item.when.getTime() > Date.now())
        .sort((a, b) => a.when.getTime() - b.when.getTime())
        .slice(0, REMINDER_IDS.length);

      try {
        const { isTauri } = await import('@tauri-apps/api/core');
        if (!(await isTauri())) return;
        const { isPermissionGranted, sendNotification, Schedule, cancel } = await import('@tauri-apps/plugin-notification');
        if (!(await isPermissionGranted())) return;
        try { await cancel(REMINDER_IDS); } catch { /* none pending */ }
        if (cancelled) return;
        upcoming.forEach((item, index) => {
          sendNotification({
            id: REMINDER_IDS[index],
            title: "Today's run",
            body: item.body,
            schedule: Schedule.at(item.when, false, true),
          });
        });
      } catch (error) {
        console.warn('[Notifications] Could not schedule run reminders:', error);
      }
    })();

    return () => { cancelled = true; };
  }, [
    isLoading,
    db,
    activePlan,
    settings.daily_reminder_enabled,
    settings.daily_reminder_time,
  ]);
}


