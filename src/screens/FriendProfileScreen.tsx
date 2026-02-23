import { useCallback, useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { format, parseISO } from 'date-fns';
import type { Profile, Run } from '../types';
import { RUN_TYPE_LABELS } from '../types';
import { Header } from '../components/navigation/Header';
import { Card } from '../components/ui/Card';
import { Spinner } from '../components/ui/Spinner';
import { EmptyState } from '../components/ui/EmptyState';
import { FollowButton } from '../components/social/FollowButton';
import { getProfileById, getRunsByUser } from '../services/socialService';
import { useSettings } from '../contexts/SettingsContext';
import { useAuth } from '../contexts/AuthContext';
import { formatDistance, formatDuration } from '../utils/paceUtils';

export function FriendProfileScreen() {
  const { id } = useParams<{ id: string }>();
  const { settings } = useSettings();
  const { user } = useAuth();
  const isOwnProfile = user?.id === id;

  const [profile, setProfile] = useState<Profile | null>(null);
  const [runs, setRuns] = useState<Run[]>([]);
  const [loading, setLoading] = useState(true);
  const [runsLoading, setRunsLoading] = useState(true);
  const [runsError, setRunsError] = useState(false);

  const load = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    const p = await getProfileById(id);
    setProfile(p);
    setLoading(false);
  }, [id]);

  const loadRuns = useCallback(async () => {
    if (!id) return;
    setRunsLoading(true);
    setRunsError(false);
    try {
      const data = await getRunsByUser(id);
      setRuns(data);
    } catch {
      setRunsError(true);
    } finally {
      setRunsLoading(false);
    }
  }, [id]);

  useEffect(() => {
    load();
    loadRuns();
  }, [load, loadRuns]);

  // Compute quick stats from their runs
  const totalMiles = runs.reduce((acc, r) => {
    const val = r.distance_unit === settings.units ? r.distance_value
      : settings.units === 'mi' ? r.distance_value / 1.60934 : r.distance_value * 1.60934;
    return acc + val;
  }, 0);

  if (loading) {
    return (
      <div className="flex flex-col flex-1">
        <Header title="Profile" showBack />
        <div className="flex-1 flex items-center justify-center">
          <Spinner size="lg" className="text-primary-500" />
        </div>
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="flex flex-col flex-1">
        <Header title="Profile" showBack />
        <EmptyState emoji="🤷" title="User not found" description="This profile doesn't exist or is private." />
      </div>
    );
  }

  return (
    <div className="flex flex-col flex-1 overflow-y-auto pb-24">
      <Header title={isOwnProfile ? 'My Public Profile' : profile.display_name} showBack />

      <div className="px-4 pt-4 flex flex-col gap-4">
        {/* Profile card */}
        <Card>
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 bg-primary-100 dark:bg-primary-900/40 rounded-full flex items-center justify-center text-2xl font-bold text-primary-700 dark:text-primary-300">
              {profile.display_name?.[0]?.toUpperCase() ?? '?'}
            </div>
            <div className="flex-1">
              <p className="font-bold text-gray-900 dark:text-white text-lg">{profile.display_name}</p>
            </div>
            {!isOwnProfile && <FollowButton targetId={profile.id} />}
          </div>

          {/* Stats */}
          {runs.length > 0 && (
            <div className="grid grid-cols-2 gap-2 mt-4 pt-4 border-t border-gray-100 dark:border-gray-700">
              <div className="text-center">
                <p className="font-bold text-gray-900 dark:text-white">
                  {formatDistance(totalMiles, settings.units)}
                </p>
                <p className="text-xs text-gray-400">Total distance</p>
              </div>
              <div className="text-center">
                <p className="font-bold text-gray-900 dark:text-white">{runs.length}</p>
                <p className="text-xs text-gray-400">Runs logged</p>
              </div>
            </div>
          )}
        </Card>

        {/* Recent runs */}
        <p className="text-sm font-semibold text-gray-700 dark:text-gray-300 px-1">Recent Runs</p>

        {runsLoading ? (
          <div className="flex justify-center py-10">
            <Spinner size="lg" className="text-primary-500" />
          </div>
        ) : runsError ? (
          <Card>
            <p className="text-sm text-gray-500 dark:text-gray-400 text-center py-4">
              Could not load runs. You may need to follow this user first, or they haven't synced yet.
            </p>
          </Card>
        ) : runs.length === 0 ? (
          <EmptyState emoji="🏃" title="No runs yet" description="This runner hasn't logged any runs." />
        ) : (
          runs.map(run => (
            <Card key={run.id} padding={false}>
              <div className="flex items-center gap-3 px-4 py-3">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-0.5">
                    <span className="text-sm font-semibold text-gray-900 dark:text-white">
                      {formatDistance(run.distance_value, run.distance_unit)}
                    </span>
                    <span className="text-xs text-gray-400">·</span>
                    <span className="text-xs text-gray-500 dark:text-gray-400">
                      {RUN_TYPE_LABELS[run.run_type]}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-gray-400">
                      {format(parseISO(run.date), 'MMM d, yyyy')}
                    </span>
                    {run.duration_seconds > 0 && (
                      <>
                        <span className="text-xs text-gray-300 dark:text-gray-600">·</span>
                        <span className="text-xs text-gray-400">{formatDuration(run.duration_seconds)}</span>
                      </>
                    )}
                  </div>
                  {run.notes ? (
                    <p className="text-xs text-gray-400 mt-1 italic">{run.notes}</p>
                  ) : null}
                </div>
              </div>
            </Card>
          ))
        )}
      </div>
    </div>
  );
}

