import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Header } from '../components/navigation/Header';
import { Card } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { Toggle } from '../components/ui/Toggle';
import { Modal } from '../components/ui/Modal';
import { useAuth } from '../contexts/AuthContext';
import { usePlan } from '../contexts/PlanContext';
import { useSettings } from '../contexts/SettingsContext';
import { useDb } from '../contexts/DatabaseContext';
import { useToast } from '../contexts/ToastContext';
import { getRunStats } from '../services/statsService';
import { getMyProfile, updateProfile, getFollowing, getFollowers } from '../services/socialService';
import type { Profile } from '../types';
import { RACE_TYPE_LABELS } from '../types';
import { formatDistance } from '../utils/paceUtils';

export function ProfileScreen() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { activePlanDetails, activePlan } = usePlan();
  const { settings } = useSettings();
  const db = useDb();
  const { showToast } = useToast();
  const [allTimeDistance, setAllTimeDistance] = useState(0);
  const [totalRuns, setTotalRuns] = useState(0);
  const [streak, setStreak] = useState(0);
  const [followingCount, setFollowingCount] = useState(0);
  const [followersCount, setFollowersCount] = useState(0);

  // Profile editing
  const [profile, setProfile] = useState<Profile | null>(null);
  const [editOpen, setEditOpen] = useState(false);
  const [editName, setEditName] = useState('');
  const [editPublic, setEditPublic] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    getRunStats(db, settings.units).then(s => {
      setAllTimeDistance(s.total_distance);
      setTotalRuns(s.total_runs);
      setStreak(s.current_streak);
    });
  }, [db, settings.units]);

  useEffect(() => {
    if (user) {
      getMyProfile().then(p => {
        if (p) setProfile(p);
      });
      // Load following/followers counts for profile header
      (async () => {
        try {
          const [following, followers] = await Promise.all([getFollowing(), getFollowers()]);
          setFollowingCount(following.length);
          setFollowersCount(followers.length);
        } catch {
          // ignore count errors; not critical for UI
        }
      })();
    }
  }, [user]);

  function openEdit() {
    setEditName(profile?.display_name ?? user?.user_metadata?.display_name ?? '');
    setEditPublic(profile?.is_public ?? false);
    setEditOpen(true);
  }

  async function handleSaveProfile() {
    setSaving(true);
    try {
      await updateProfile({ display_name: editName.trim(), is_public: editPublic });
      setProfile(prev => prev ? { ...prev, display_name: editName.trim(), is_public: editPublic } : prev);
      showToast('Profile updated!', 'success');
      setEditOpen(false);
    } catch {
      showToast('Failed to update profile', 'error');
    } finally {
      setSaving(false);
    }
  }

  const menuItems = [
    { icon: '📋', label: 'My Plans', path: '/profile/plans' },
    { icon: '🎯', label: 'Goals', path: '/profile/goals' },
    { icon: '👤', label: 'View My Public Profile', path: user ? `/social/profile/${user.id}` : '/auth' },
    { icon: '👥', label: 'Friends', path: '/social' },
    { icon: '🌐', label: 'Community Plans', path: '/community' },
    { icon: '⚙️', label: 'Settings', path: '/settings' },
  ];

  return (
    <div className="flex flex-col flex-1 overflow-y-auto pb-24">
      <Header title="Profile" />

      <div className="px-4 pt-4 flex flex-col gap-4">
        {/* User info */}
        <Card
          className={user ? 'cursor-pointer' : undefined}
          onClick={() => {
            if (user) navigate(`/social/profile/${user.id}`);
          }}
        >
          <div className="flex items-center gap-4 mb-4">
            <div className="w-14 h-14 bg-primary-100 dark:bg-primary-900/40 rounded-full flex items-center justify-center text-2xl">
              {user ? user.email?.[0].toUpperCase() : '🏃'}
            </div>
            <div className="flex-1">
              <p className="font-bold text-gray-900 dark:text-white text-lg">
                {profile?.display_name ?? user?.user_metadata?.display_name ?? 'Runner'}
              </p>
              {user && <p className="text-sm text-gray-400">{user.email}</p>}
              {profile && (
                <p className="text-xs text-gray-400 mt-0.5">
                  {profile.is_public ? '🌐 Public profile' : '🔒 Private profile'}
                </p>
              )}
              {user && (
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                  <span className="font-semibold">{followingCount}</span> following ·{' '}
                  <span className="font-semibold">{followersCount}</span> followers
                </p>
              )}
            </div>
            {user && (
              <button
                onClick={openEdit}
                className="text-sm text-primary-500 font-medium px-2 py-1"
              >
                Edit
              </button>
            )}
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

      {/* Edit Profile Modal */}
      <Modal
        isOpen={editOpen}
        onClose={() => setEditOpen(false)}
        title="Edit Profile"
      >
        <div className="flex flex-col gap-4">
          <Input
            label="Display Name"
            value={editName}
            onChange={e => setEditName(e.target.value)}
            placeholder="Your name"
          />
          <div className="flex items-center justify-between py-1">
            <div>
              <p className="text-sm font-medium text-gray-800 dark:text-gray-100">Public Profile</p>
              <p className="text-xs text-gray-400 mt-0.5">Others can find you in Friend Search</p>
            </div>
            <Toggle checked={editPublic} onChange={setEditPublic} />
          </div>
          <Button
            className="w-full mt-2"
            onClick={handleSaveProfile}
            isLoading={saving}
            disabled={!editName.trim()}
          >
            Save
          </Button>
        </div>
      </Modal>
    </div>
  );
}

