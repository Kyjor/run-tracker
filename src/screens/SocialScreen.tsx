import React, { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import type { FeedItem } from '../types';
import { Header } from '../components/navigation/Header';
import { ActivityFeedItem } from '../components/social/ActivityFeedItem';
import { EmptyState } from '../components/ui/EmptyState';
import { Spinner } from '../components/ui/Spinner';
import { Button } from '../components/ui/Button';
import { getFeed, toggleLike } from '../services/socialService';
import { useAuth } from '../contexts/AuthContext';

export function SocialScreen() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [feed, setFeed] = useState<FeedItem[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    const data = await getFeed();
    setFeed(data);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

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

      <div className="px-4 pt-4 flex flex-col gap-3">
        {loading ? (
          <div className="flex justify-center py-16">
            <Spinner size="lg" className="text-primary-500" />
          </div>
        ) : feed.length === 0 ? (
          <EmptyState
            emoji="🏃"
            title="Nothing here yet"
            description="Follow some runners to see their activity here."
            action={
              <Button size="sm" onClick={() => navigate('/social/search')}>Find Friends</Button>
            }
          />
        ) : (
          feed.map(item => (
            <ActivityFeedItem
              key={item.id}
              item={item}
              onLike={() => handleLike(item)}
            />
          ))
        )}
      </div>
    </div>
  );
}

