import React from 'react';
import type { FeedItem } from '../../types';
import { Card } from '../ui/Card';
import { formatShort } from '../../utils/dateUtils';
import { formatDistance, formatDuration } from '../../utils/paceUtils';

interface ActivityFeedItemProps {
  item: FeedItem;
  onLike?: () => void;
  onComment?: () => void;
}

const ACTIVITY_EMOJI: Record<string, string> = {
  run_completed: '🏃',
  plan_started: '📋',
  plan_completed: '🏆',
  goal_achieved: '🎯',
  streak_milestone: '🔥',
};

function buildMessage(item: FeedItem): string {
  const name = item.profile?.display_name ?? 'Someone';
  const d = item.data as Record<string, unknown>;
  switch (item.activity_type) {
    case 'run_completed':
      return `${name} completed a ${formatDistance(d.distance as number, (d.unit as 'mi' | 'km') ?? 'mi')} run`;
    case 'plan_started':
      return `${name} started "${d.plan_name}"`;
    case 'plan_completed':
      return `${name} finished their ${d.plan_name} plan 🎉`;
    case 'goal_achieved':
      return `${name} hit their ${d.goal_type} mileage goal!`;
    case 'streak_milestone':
      return `${name} is on a ${d.streak_days}-day streak! 🔥`;
    default:
      return `${name} was active`;
  }
}

export function ActivityFeedItem({ item, onLike, onComment }: ActivityFeedItemProps) {
  const emoji = ACTIVITY_EMOJI[item.activity_type] ?? '🏃';
  const message = buildMessage(item);
  const d = item.data as Record<string, unknown>;

  return (
    <Card padding={false}>
      <div className="p-4">
        <div className="flex items-start gap-3">
          <span className="text-2xl">{emoji}</span>
          <div className="flex-1">
            <p className="text-sm text-gray-800 dark:text-gray-100">{message}</p>
            {item.activity_type === 'run_completed' && d.duration && (
              <p className="text-xs text-gray-500 mt-0.5">
                {formatDuration(d.duration as number)}
              </p>
            )}
            <p className="text-xs text-gray-400 mt-1">{formatShort(item.created_at)}</p>
          </div>
        </div>

        <div className="flex gap-4 mt-3 pt-3 border-t border-gray-100 dark:border-gray-700">
          <button
            onClick={onLike}
            className={`flex items-center gap-1.5 text-xs ${
              item.user_has_liked ? 'text-red-400' : 'text-gray-400'
            }`}
          >
            <span>{item.user_has_liked ? '❤️' : '🤍'}</span>
            {item.likes_count ?? 0}
          </button>
          <button onClick={onComment} className="flex items-center gap-1.5 text-xs text-gray-400">
            <span>💬</span>
            {item.comments_count ?? 0}
          </button>
        </div>
      </div>
    </Card>
  );
}

