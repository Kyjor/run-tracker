import { useEffect, useMemo, useState } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import type { Profile } from '../../types';
import { getFollowersWithProfiles } from '../../services/socialService';
import { formatRelativeTime } from '../../utils/dateUtils';

type NotificationType = 'new_follower';

interface Notification {
  id: string;
  type: NotificationType;
  created_at: string;
  read: boolean;
  payload: {
    userId: string;
    displayName: string;
  };
}

const STORAGE_KEY_NOTIFICATIONS = 'notifications_v1';
const STORAGE_KEY_LAST_FOLLOWERS = 'notifications_last_followers_v1';

function loadNotifications(): Notification[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY_NOTIFICATIONS);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as Notification[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function saveNotifications(notifs: Notification[]) {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(STORAGE_KEY_NOTIFICATIONS, JSON.stringify(notifs));
  } catch {
    // ignore
  }
}

function loadLastFollowerIds(): string[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY_LAST_FOLLOWERS);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as string[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function saveLastFollowerIds(ids: string[]) {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(STORAGE_KEY_LAST_FOLLOWERS, JSON.stringify(ids));
  } catch {
    // ignore
  }
}

export function NotificationsBell() {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!user) return;
    setNotifications(loadNotifications());

    // Detect new followers and create notifications (local-only)
    (async () => {
      setLoading(true);
      try {
        const followers: Profile[] = await getFollowersWithProfiles();
        const currentIds = followers.map(f => f.id);
        const lastIds = loadLastFollowerIds();

        const newIds = currentIds.filter(id => !lastIds.includes(id));
        if (newIds.length > 0) {
          const now = new Date().toISOString();
          const newNotifs: Notification[] = newIds.map(id => {
            const profile = followers.find(f => f.id === id);
            return {
              id: `${id}-${now}`,
              type: 'new_follower',
              created_at: now,
              read: false,
              payload: {
                userId: id,
                displayName: profile?.display_name ?? 'Someone',
              },
            };
          });
          setNotifications(prev => {
            const next = [...newNotifs, ...prev];
            saveNotifications(next);
            return next;
          });
        }

        // Persist current follower set for next comparison
        saveLastFollowerIds(currentIds);
      } catch {
        // ignore errors; notifications are non-critical
      } finally {
        setLoading(false);
      }
    })();
  }, [user]);

  const unreadCount = useMemo(
    () => notifications.filter(n => !n.read).length,
    [notifications],
  );

  if (!user) return null;

  function toggleOpen() {
    const nextOpen = !open;
    setOpen(nextOpen);
    if (nextOpen && unreadCount > 0) {
      const updated = notifications.map(n => ({ ...n, read: true }));
      setNotifications(updated);
      saveNotifications(updated);
    }
  }

  return (
    <div className="relative">
      <button
        type="button"
        onClick={toggleOpen}
        className="relative p-2 text-gray-500 dark:text-gray-300 hover:text-primary-500 dark:hover:text-primary-400 focus:outline-none"
        aria-label="Notifications"
      >
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} className="w-6 h-6">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9"
          />
        </svg>
        {unreadCount > 0 && (
          <span className="absolute -top-0.5 -right-0.5 inline-flex items-center justify-center px-1.5 py-0.5 rounded-full text-[10px] font-semibold bg-red-500 text-white">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 mt-2 w-72 bg-white dark:bg-gray-800 rounded-2xl shadow-xl border border-gray-100 dark:border-gray-700 z-50">
          <div className="px-4 py-3 border-b border-gray-100 dark:border-gray-700 flex items-center justify-between">
            <span className="text-sm font-semibold text-gray-800 dark:text-gray-100">Notifications</span>
            {loading && (
              <span className="text-[10px] text-gray-400">Updating…</span>
            )}
          </div>
          <div className="max-h-72 overflow-y-auto py-2">
            {notifications.length === 0 ? (
              <p className="text-xs text-gray-400 dark:text-gray-500 px-4 py-3">
                You&apos;re all caught up.
              </p>
            ) : (
              notifications.map(n => (
                <div
                  key={n.id}
                  className={[
                    'px-4 py-2 text-xs flex items-start gap-2',
                    !n.read ? 'bg-primary-50 dark:bg-primary-900/20' : '',
                  ].join(' ')}
                >
                  <div className="flex-1 flex flex-col gap-0.5">
                    {n.type === 'new_follower' && (
                      <>
                        <span className="text-gray-800 dark:text-gray-100">
                          <span className="font-semibold">{n.payload.displayName}</span> started following you.
                        </span>
                        <span className="text-[11px] text-gray-400">
                          {formatRelativeTime(n.created_at, true)}
                        </span>
                      </>
                    )}
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      const next = notifications.filter(x => x.id !== n.id);
                      setNotifications(next);
                      saveNotifications(next);
                    }}
                    className="ml-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 px-1"
                    aria-label="Dismiss notification"
                  >
                    ×
                  </button>
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}


