import React, { useEffect, useState } from 'react';
import { Button } from '../ui/Button';
import { isFollowing, followUser, unfollowUser } from '../../services/socialService';
import { useAuth } from '../../contexts/AuthContext';

interface FollowButtonProps {
  targetId: string;
  size?: 'sm' | 'md';
}

export function FollowButton({ targetId, size = 'sm' }: FollowButtonProps) {
  const { user } = useAuth();
  const [following, setFollowing] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!user || user.id === targetId) return;
    isFollowing(targetId).then(setFollowing);
  }, [user, targetId]);

  if (!user || user.id === targetId) return null;

  async function toggle() {
    setLoading(true);
    if (following) {
      await unfollowUser(targetId);
      setFollowing(false);
    } else {
      await followUser(targetId);
      setFollowing(true);
    }
    setLoading(false);
  }

  return (
    <Button
      size={size}
      variant={following ? 'secondary' : 'primary'}
      isLoading={loading}
      onClick={toggle}
    >
      {following ? 'Following' : 'Follow'}
    </Button>
  );
}

