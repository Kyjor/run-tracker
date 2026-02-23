import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import type { FeedItem } from '../../types';
import { Card } from '../ui/Card';
import { CommentModal } from './CommentModal';
import { formatShortWithTime } from '../../utils/dateUtils';
import { parseISO } from 'date-fns';
import { formatDistance, formatDuration } from '../../utils/paceUtils';

interface ActivityFeedItemProps {
  item: FeedItem;
  onLike?: () => void;
  onCommentAdded?: () => void;
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

export function ActivityFeedItem({ item, onLike, onCommentAdded }: ActivityFeedItemProps) {
  const navigate = useNavigate();
  const [commentModalOpen, setCommentModalOpen] = useState(false);
  const emoji = ACTIVITY_EMOJI[item.activity_type] ?? '🏃';
  const message = buildMessage(item);
  const d = item.data as Record<string, unknown>;
  const name = item.profile?.display_name ?? 'Someone';

  // Extract just the name part from the message for clickable link
  const messageWithoutName = message.replace(`${name} `, '');

  return (
    <Card padding={false}>
      <div className="p-4">
        <div className="flex items-start gap-3">
          <span className="text-2xl">{emoji}</span>
          <div className="flex-1">
            <p className="text-sm text-gray-800 dark:text-gray-100">
              {item.profile ? (
                <>
                  <button
                    onClick={() => navigate(`/social/profile/${item.user_id}`)}
                    className="font-semibold text-primary-600 dark:text-primary-400 hover:underline"
                  >
                    {name}
                  </button>
                  {' '}
                  {messageWithoutName}
                </>
              ) : (
                message
              )}
            </p>
            {item.activity_type === 'run_completed' && d.duration ? (
              <p className="text-xs text-gray-500 mt-0.5">
                {formatDuration(d.duration as number)}
              </p>
            ) : null}
            <p className="text-xs text-gray-400 mt-1">
              {item.activity_type === 'run_completed' && d.run_date
                ? (() => {
                    // Use run's date but keep the time from created_at for display
                    const runDate = parseISO(d.run_date as string);
                    const createdTime = parseISO(item.created_at);
                    const combined = new Date(runDate);
                    combined.setHours(createdTime.getHours(), createdTime.getMinutes(), createdTime.getSeconds());
                    return formatShortWithTime(combined.toISOString());
                  })()
                : formatShortWithTime(item.created_at)}
            </p>
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
          <button
            onClick={() => setCommentModalOpen(true)}
            className="flex items-center gap-1.5 text-xs text-gray-400"
          >
            <span>💬</span>
            {item.comments_count ?? 0}
          </button>
        </div>
      </div>

      <CommentModal
        isOpen={commentModalOpen}
        onClose={() => setCommentModalOpen(false)}
        activityId={item.id}
        onCommentAdded={() => {
          onCommentAdded?.();
          // Refresh the item's comment count (would need to reload from parent)
        }}
      />
    </Card>
  );
}

