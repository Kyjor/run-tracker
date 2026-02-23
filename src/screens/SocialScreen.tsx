import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import type { FeedItem, Profile } from '../types';
import { Header } from '../components/navigation/Header';
import { ActivityFeedItem } from '../components/social/ActivityFeedItem';
import { FollowButton } from '../components/social/FollowButton';
import { EmptyState } from '../components/ui/EmptyState';
import { Spinner } from '../components/ui/Spinner';
import { Button } from '../components/ui/Button';
import { getFeed, toggleLike, getFollowingWithProfiles, getFollowersWithProfiles } from '../services/socialService';
import { useAuth } from '../contexts/AuthContext';

type Tab = 'feed' | 'following' | 'followers';

function ProfileRow({ profile, onPress }: { profile: Profile; onPress: () => void }) {
  return (
    <div className="flex items-center gap-3 bg-white dark:bg-gray-800 p-3 rounded-2xl shadow-sm">
      <button className="flex items-center gap-3 flex-1 text-left" onClick={onPress}>
        <div className="w-10 h-10 rounded-full bg-primary-200 dark:bg-primary-700 flex items-center justify-center text-lg font-semibold text-primary-800 dark:text-primary-200 flex-shrink-0">
          {profile.display_name?.[0]?.toUpperCase() ?? '?'}
        </div>
        <p className="font-medium text-gray-900 dark:text-white">{profile.display_name}</p>
      </button>
      <FollowButton targetId={profile.id} />
    </div>
  );
}

export function SocialScreen() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [tab, setTab] = useState<Tab>('feed');

  const [feed, setFeed] = useState<FeedItem[]>([]);
  const [following, setFollowing] = useState<Profile[]>([]);
  const [followers, setFollowers] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(true);

  const loadFeed = useCallback(async () => {
    setLoading(true);
    const data = await getFeed();
    setFeed(data);
    setLoading(false);
  }, []);

  const loadFollowing = useCallback(async () => {
    setLoading(true);
    const data = await getFollowingWithProfiles();
    setFollowing(data);
    setLoading(false);
  }, []);

  const loadFollowers = useCallback(async () => {
    setLoading(true);
    const data = await getFollowersWithProfiles();
    setFollowers(data);
    setLoading(false);
  }, []);

  useEffect(() => {
    if (!user) return;
    if (tab === 'feed') loadFeed();
    else if (tab === 'following') loadFollowing();
    else loadFollowers();
  }, [tab, user, loadFeed, loadFollowing, loadFollowers]);

  async function handleLike(item: FeedItem) {
    await toggleLike(item.id);
    setFeed(prev => prev.map(f =>
      f.id === item.id
        ? { ...f, user_has_liked: !f.user_has_liked, likes_count: (f.likes_count ?? 0) + (f.user_has_liked ? -1 : 1) }
        : f,
    ));
  }

  if (!user) {
    return (
      <div className="flex flex-col flex-1">
        <Header title="Friends" />
        <EmptyState
          emoji="👥"
          title="Sign in to see your friends"
          description="Follow friends to see their runs, plans, and achievements."
          action={<Button onClick={() => navigate('/auth')}>Sign In</Button>}
        />
      </div>
    );
  }

  const tabs: { id: Tab; label: string }[] = [
    { id: 'feed', label: 'Feed' },
    { id: 'following', label: 'Following' },
    { id: 'followers', label: 'Followers' },
  ];

  return (
    <div className="flex flex-col flex-1 overflow-y-auto pb-24">
      <Header
        title="Friends"
        rightAction={
          <button className="text-xs text-primary-600 dark:text-primary-400 pr-1" onClick={() => navigate('/social/search')}>
            Find Friends
          </button>
        }
      />

      {/* Tab bar */}
      <div className="flex mx-4 mt-3 mb-1 bg-gray-100 dark:bg-gray-800 rounded-xl p-1 gap-1">
        {tabs.map(t => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={[
              'flex-1 text-sm font-medium py-1.5 rounded-lg transition-colors',
              tab === t.id
                ? 'bg-white dark:bg-gray-700 text-gray-900 dark:text-white shadow-sm'
                : 'text-gray-500 dark:text-gray-400',
            ].join(' ')}
          >
            {t.label}
          </button>
        ))}
      </div>

      <div className="px-4 pt-3 flex flex-col gap-3">
        {loading ? (
          <div className="flex justify-center py-16">
            <Spinner size="lg" className="text-primary-500" />
          </div>
        ) : tab === 'feed' ? (
          feed.length === 0 ? (
            <EmptyState
              emoji="🏃"
              title="Nothing here yet"
              description="Follow some runners to see their activity here."
              action={<Button size="sm" onClick={() => navigate('/social/search')}>Find Friends</Button>}
            />
          ) : (
            feed.map(item => (
              <ActivityFeedItem
                key={item.id}
                item={item}
                onLike={() => handleLike(item)}
                onCommentAdded={() => {
                  // Refresh feed to update comment counts
                  loadFeed();
                }}
              />
            ))
          )
        ) : tab === 'following' ? (
          following.length === 0 ? (
            <EmptyState
              emoji="🔍"
              title="Not following anyone yet"
              description="Search for friends to follow."
              action={<Button size="sm" onClick={() => navigate('/social/search')}>Find Friends</Button>}
            />
          ) : (
            following.map(p => (
              <ProfileRow key={p.id} profile={p} onPress={() => navigate(`/social/profile/${p.id}`)} />
            ))
          )
        ) : (
          followers.length === 0 ? (
            <EmptyState emoji="👤" title="No followers yet" description="Share your profile to get followers." />
          ) : (
            followers.map(p => (
              <ProfileRow key={p.id} profile={p} onPress={() => navigate(`/social/profile/${p.id}`)} />
            ))
          )
        )}
      </div>
    </div>
  );
}
