import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Header } from '../components/navigation/Header';
import { Card } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { useAuth } from '../contexts/AuthContext';
import { usePlan } from '../contexts/PlanContext';
import { useSettings } from '../contexts/SettingsContext';
import { useDb } from '../contexts/DatabaseContext';
import { getRunStats } from '../services/statsService';
import { RACE_TYPE_LABELS } from '../types';
import { formatDistance } from '../utils/paceUtils';

export function ProfileScreen() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { activePlanDetails, activePlan } = usePlan();
  const { settings } = useSettings();
  const db = useDb();
  const [allTimeDistance, setAllTimeDistance] = useState(0);
  const [totalRuns, setTotalRuns] = useState(0);
  const [streak, setStreak] = useState(0);

  useEffect(() => {
    getRunStats(db, settings.units).then(s => {
      setAllTimeDistance(s.total_distance);
      setTotalRuns(s.total_runs);
      setStreak(s.current_streak);
    });
  }, [db, settings.units]);

  const menuItems = [
    { icon: '📋', label: 'My Plans', path: '/profile/plans' },
    { icon: '🎯', label: 'Goals', path: '/profile/goals' },
    { icon: '👥', label: 'Friends', path: '/social' },
    { icon: '🌐', label: 'Community Plans', path: '/community' },
    { icon: '⚙️', label: 'Settings', path: '/settings' },
  ];

  return (
    <div className="flex flex-col flex-1 overflow-y-auto pb-24">
      <Header title="Profile" />

      <div className="px-4 pt-4 flex flex-col gap-4">
        {/* User info */}
        <Card>
          <div className="flex items-center gap-4 mb-4">
            <div className="w-14 h-14 bg-primary-100 dark:bg-primary-900/40 rounded-full flex items-center justify-center text-2xl">
              {user ? user.email?.[0].toUpperCase() : '🏃'}
            </div>
            <div>
              <p className="font-bold text-gray-900 dark:text-white text-lg">
                {user ? (user.user_metadata?.display_name ?? user.email) : 'Runner'}
              </p>
              {user && <p className="text-sm text-gray-400">{user.email}</p>}
            </div>
          </div>

          {/* Stats row */}
          <div className="grid grid-cols-3 gap-2 pt-3 border-t border-gray-100 dark:border-gray-700">
            <div className="text-center">
              <p className="font-bold text-gray-900 dark:text-white">{formatDistance(allTimeDistance, settings.units)}</p>
              <p className="text-xs text-gray-400">All time</p>
            </div>
            <div className="text-center">
              <p className="font-bold text-gray-900 dark:text-white">{totalRuns}</p>
              <p className="text-xs text-gray-400">Runs</p>
            </div>
            <div className="text-center">
              <p className="font-bold text-gray-900 dark:text-white">{streak}🔥</p>
              <p className="text-xs text-gray-400">Streak</p>
            </div>
          </div>
        </Card>

        {/* Active plan chip */}
        {activePlanDetails && (
          <Card padding={false}>
            <button
              onClick={() => navigate(`/profile/plans/${activePlan?.plan_id}`)}
              className="flex items-center gap-3 p-4 w-full"
            >
              <span className="text-2xl">📋</span>
              <div className="flex-1 text-left">
                <p className="text-sm font-semibold text-gray-900 dark:text-white">{activePlanDetails.name}</p>
                <p className="text-xs text-gray-400">
                  {RACE_TYPE_LABELS[activePlanDetails.race_type]} · {activePlanDetails.duration_weeks} weeks
                </p>
              </div>
              <span className="text-gray-300 dark:text-gray-600">›</span>
            </button>
          </Card>
        )}

        {/* Menu */}
        <Card padding={false}>
          {menuItems.map((item, i) => (
            <button
              key={item.path}
              onClick={() => navigate(item.path)}
              className={[
                'flex items-center gap-3 p-4 w-full text-left active:bg-gray-50 dark:active:bg-gray-750',
                i > 0 ? 'border-t border-gray-100 dark:border-gray-700' : '',
              ].join(' ')}
            >
              <span className="text-xl w-8 text-center">{item.icon}</span>
              <span className="text-sm font-medium text-gray-800 dark:text-gray-100 flex-1">{item.label}</span>
              <span className="text-gray-300 dark:text-gray-600">›</span>
            </button>
          ))}
        </Card>

        {!user && (
          <div className="bg-primary-50 dark:bg-primary-900/20 rounded-2xl p-4 text-center">
            <p className="text-sm text-gray-600 dark:text-gray-300 mb-3">
              Sign in to unlock cloud sync, social features, and community plans.
            </p>
            <Button onClick={() => navigate('/auth')}>Sign In</Button>
          </div>
        )}
      </div>
    </div>
  );
}

