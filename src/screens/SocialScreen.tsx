import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import type { FeedItem, Profile } from '../types';
import { Header } from '../components/navigation/Header';
import { ActivityFeedCard } from '../components/social/ActivityFeedCard';
import { SegmentedControl } from '../components/ui/SegmentedControl';
import { Avatar } from '../components/ui/Avatar';
import { FollowButton } from '../components/social/FollowButton';
import { EmptyState } from '../components/ui/EmptyState';
import { Spinner } from '../components/ui/Spinner';
import { Button } from '../components/ui/Button';
import { PullToRefresh } from '../components/ui/PullToRefresh';
import { getFeed, toggleLike, getFollowingWithProfiles, getFollowersWithProfiles } from '../services/socialService';
import { getCachedFeed, setCachedFeed } from '../services/feedCache';
import { useAuth } from '../contexts/AuthContext';

type Tab = 'feed' | 'following' | 'followers';

function ProfileRow({ profile, onPress }: { profile: Profile; onPress: () => void }) {
  return (
    <div className="flex items-center gap-3 bg-surface dark:bg-surface-dark-elevated p-3 rounded-card border border-border dark:border-border-dark shadow-card">
      <button type="button" className="flex items-center gap-3 flex-1 text-left" onClick={onPress}>
        <Avatar name={profile.display_name ?? '?'} size="md" />
        <p className="font-medium text-ink-primary dark:text-ink-dark-primary">{profile.display_name}</p>
      </button>
      <FollowButton targetId={profile.id} />
    </div>
  );
}

export function SocialScreen() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [tab, setTab] = useState<Tab>('feed');

  const [feed, setFeed] = useState<FeedItem[]>(() => getCachedFeed() ?? []);
  const [following, setFollowing] = useState<Profile[]>([]);
  const [followers, setFollowers] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(true);

  const loadFeed = useCallback(async () => {
    if (feed.length === 0) setLoading(true);
    const data = await getFeed();
    setFeed(data);
    setCachedFeed(data);
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
    setFeed(prev => {
      const next = prev.map(f =>
        f.id === item.id
          ? { ...f, user_has_liked: !f.user_has_liked, likes_count: (f.likes_count ?? 0) + (f.user_has_liked ? -1 : 1) }
          : f,
      );
      setCachedFeed(next);
      return next;
    });
    await toggleLike(item.id);
  }

  const handleRefresh = useCallback(async () => {
    if (tab === 'feed') await loadFeed();
    else if (tab === 'following') await loadFollowing();
    else await loadFollowers();
  }, [tab, loadFeed, loadFollowing, loadFollowers]);

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
    <div className="flex flex-col flex-1 overflow-hidden">
      <Header
        title="Friends"
        rightAction={
          <button className="text-xs text-primary-600 dark:text-primary-400 pr-1" onClick={() => navigate('/social/search')}>
            Find Friends
          </button>
        }
      />

      <div className="px-4 mt-3 mb-1">
        <SegmentedControl
          options={tabs.map(t => ({ value: t.id, label: t.label }))}
          value={tab}
          onChange={setTab}
        />
      </div>

      <PullToRefresh onRefresh={handleRefresh}>
        <div className="px-4 pt-3 pb-24 flex flex-col gap-3">
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
              <ActivityFeedCard
                key={item.id}
                item={item}
                onLike={() => handleLike(item)}
                onCommentAdded={() => loadFeed()}
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
      </PullToRefresh>
    </div>
  );
}
