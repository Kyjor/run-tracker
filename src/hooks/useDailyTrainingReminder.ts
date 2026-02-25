import { useEffect } from 'react';
import { usePlan } from '../contexts/PlanContext';
import { useSettings } from '../contexts/SettingsContext';
import { useToast } from '../contexts/ToastContext';
import { ACTIVITY_LABELS } from '../types';
import { formatDistance } from '../utils/paceUtils';
import { today as todayIso } from '../utils/dateUtils';

const STORAGE_KEY_LAST_REMINDER = 'daily_training_reminder_last_fire_v1';

function loadLastFireDate(): string | null {
  if (typeof window === 'undefined') return null;
  try {
    return window.localStorage.getItem(STORAGE_KEY_LAST_REMINDER);
  } catch {
    return null;
  }
}

function saveLastFireDate(d: string) {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(STORAGE_KEY_LAST_REMINDER, d);
  } catch {
    // ignore
  }
}

export function useDailyTrainingReminder() {
  const { todayActivity } = usePlan();
  const { settings } = useSettings();
  const { showToast } = useToast();

  useEffect(() => {
    if (!settings.daily_reminder_enabled) return;

    const time = settings.daily_reminder_time ?? '08:00';
    const [hStr, mStr] = time.split(':');
    const targetHour = parseInt(hStr, 10);
    const targetMinute = parseInt(mStr, 10);
    if (isNaN(targetHour) || isNaN(targetMinute)) return;

    async function fireReminder(message: string, today: string) {
      saveLastFireDate(today);

      // Prefer Tauri native notifications when available (iOS, desktop app)
      try {
        const { isTauri } = await import('@tauri-apps/api/core');
        if (isTauri()) {
          const { sendNotification, isPermissionGranted, requestPermission } = await import('@tauri-apps/plugin-notification');
          let granted = await isPermissionGranted();
          if (!granted) {
            const permission = await requestPermission();
            granted = permission === 'granted';
          }
          if (granted) {
            await sendNotification({ title: "Today's training", body: message });
            return;
          }
        }
      } catch {
        // fall through to web/Toast
      }

      // Fallback: web Notification API, then in-app toast
      if (typeof window !== 'undefined' && 'Notification' in window) {
        if (Notification.permission === 'granted') {
          new Notification("Today's training", { body: message });
        } else if (Notification.permission === 'default') {
          Notification.requestPermission().then(result => {
            if (result === 'granted') {
              new Notification("Today's training", { body: message });
            } else {
              showToast(message, 'info');
            }
          }).catch(() => {
            showToast(message, 'info');
          });
        } else {
          showToast(message, 'info');
        }
      } else {
        showToast(message, 'info');
      }
    }

    const interval = window.setInterval(() => {
      const now = new Date();
      const currentMinutes = now.getHours() * 60 + now.getMinutes();
      const targetMinutes = targetHour * 60 + targetMinute;

      const today = todayIso();
      const lastFire = loadLastFireDate();

      // Fire once per day, within a 5-minute window around the configured time
      if (lastFire === today) return;
      if (Math.abs(currentMinutes - targetMinutes) > 5) return;

      const planDay = todayActivity?.plan_day;
      if (!planDay || (planDay.activity_type !== 'cross_training' && planDay.activity_type === 'rest')) {
        // No scheduled training today (or rest only), skip
        return;
      }

      const label = ACTIVITY_LABELS[planDay.activity_type];
      let details = '';
      if (planDay.distance_value) {
        details = formatDistance(planDay.distance_value, planDay.distance_unit);
      } else if (planDay.duration_minutes) {
        details = `${planDay.duration_minutes} min`;
      }

      const message = details ? `${label} · ${details}` : label;
      void fireReminder(message, today);
    }, 60_000); // check every minute

    return () => window.clearInterval(interval);
  }, [settings.daily_reminder_enabled, settings.daily_reminder_time, todayActivity, showToast]);
}


