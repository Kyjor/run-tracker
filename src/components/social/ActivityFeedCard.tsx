import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import type { FeedItem } from '../../types';
import { Card } from '../ui/Card';
import { Avatar } from '../ui/Avatar';
import { MetricChip } from '../ui/MetricChip';
import { CommentModal } from './CommentModal';
import { RunRouteMap } from '../run/RunRouteMap';
import { formatRelativeTime } from '../../utils/dateUtils';
import { parseISO } from 'date-fns';
import { formatDistance, formatDuration, formatPace, calcPaceSeconds } from '../../utils/paceUtils';
import type { DistanceUnit } from '../../types';

interface ActivityFeedCardProps {
  item: FeedItem;
  onLike?: () => void;
  onCommentAdded?: () => void;
}

function KudosIcon({ filled }: { filled: boolean }) {
  return (
    <svg viewBox="0 0 24 24" className={`w-4 h-4 ${filled ? 'text-kudos-500 fill-kudos-500' : 'text-ink-muted'}`} fill={filled ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth={1.8}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M21 8.25c0-2.485-2.099-4.5-4.688-4.5-1.935 0-3.597 1.126-4.312 2.733-.715-1.607-2.377-2.733-4.313-2.733C5.1 3.75 3 5.765 3 8.25c0 7.22 9 12 9 12s9-4.78 9-12z" />
    </svg>
  );
}

function CommentIcon() {
  return (
    <svg viewBox="0 0 24 24" className="w-4 h-4 text-ink-muted" fill="none" stroke="currentColor" strokeWidth={1.8}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M8.625 12a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0H8.25m4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0H12m4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0h-.375M21 12c0 4.556-4.03 8.25-9 8.25a9.764 9.764 0 01-2.555-.337A5.972 5.972 0 015.41 20.97a5.969 5.969 0 01-.474-.065 4.48 4.48 0 00.978-2.025c.09-.457-.133-.901-.467-1.226C3.93 16.178 3 14.189 3 12c0-4.556 4.03-8.25 9-8.25s9 3.694 9 8.25z" />
    </svg>
  );
}

function RoutePlaceholder() {
  return (
    <div className="aspect-[16/9] w-full bg-gradient-to-br from-primary-100 via-primary-50 to-indigo-100 dark:from-primary-900/40 dark:via-gray-800 dark:to-indigo-900/30 flex items-center justify-center">
      <svg viewBox="0 0 24 24" className="w-10 h-10 text-primary-300 dark:text-primary-600" fill="none" stroke="currentColor" strokeWidth={1.2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M9 6.75V15m6-6.75v8.25M4.5 19.5h15M4.5 6.75h15M4.5 6.75l1.5-3h12l1.5 3" />
      </svg>
    </div>
  );
}

function LazyMap({ points }: { points: FeedItem['route_points'] }) {
  const ref = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const obs = new IntersectionObserver(
      ([e]) => {
        if (e.isIntersecting) {
          setVisible(true);
          obs.disconnect();
        }
      },
      { rootMargin: '120px' },
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, []);

  if (!points || points.length < 2) return <RoutePlaceholder />;

  return (
    <div ref={ref} className="aspect-[16/9] w-full relative">
      {visible ? (
        <RunRouteMap points={points} className="absolute inset-0 h-full rounded-none" interactive={false} />
      ) : (
        <div className="absolute inset-0 bg-gray-100 dark:bg-gray-800 animate-pulse" />
      )}
    </div>
  );
}

export function ActivityFeedCard({ item, onLike, onCommentAdded }: ActivityFeedCardProps) {
  const navigate = useNavigate();
  const [commentModalOpen, setCommentModalOpen] = useState(false);
  const d = item.data as Record<string, unknown>;
  const name = item.profile?.display_name ?? 'Someone';
  const unit = (d.unit as DistanceUnit) ?? 'mi';
  const distance = d.distance as number | undefined;
  const duration = d.duration as number | undefined;
  const hasRoute = (item.route_points?.length ?? 0) >= 2;

  const timeLabel =
    item.activity_type === 'run_completed' && d.run_date
      ? (() => {
          const runDate = parseISO(d.run_date as string);
          const createdTime = parseISO(item.created_at);
          const combined = new Date(runDate);
          combined.setHours(createdTime.getHours(), createdTime.getMinutes(), createdTime.getSeconds());
          return formatRelativeTime(combined.toISOString(), true);
        })()
      : formatRelativeTime(item.created_at, true);

  const paceStr =
    distance && duration
      ? formatPace(calcPaceSeconds(distance, duration, unit), unit)
      : null;

  const runId = typeof d.run_id === 'string' ? d.run_id : null;

  return (
    <Card padding={false} className="shadow-elevated">
      <div className="p-4 pb-3 flex items-center gap-3">
        <Avatar
          name={name}
          size="md"
          onClick={() => navigate(`/social/profile/${item.user_id}`)}
        />
        <div className="flex-1 min-w-0">
          <button
            type="button"
            onClick={() => navigate(`/social/profile/${item.user_id}`)}
            className="font-semibold text-ink-primary dark:text-ink-dark-primary truncate block text-left w-full"
          >
            {name}
          </button>
          <p className="text-xs text-ink-muted dark:text-ink-dark-muted">{timeLabel}</p>
        </div>
      </div>

      {item.activity_type === 'run_completed' && (
        <>
          <button
            type="button"
            className="w-full text-left"
            onClick={() => runId && navigate(`/runs/${runId}?userId=${item.user_id}`)}
          >
            {hasRoute ? <LazyMap points={item.route_points} /> : <RoutePlaceholder />}
          </button>
          <div className="px-4 py-3 flex gap-6 border-t border-border/60 dark:border-border-dark/60">
            {distance != null && <MetricChip label={unit} value={formatDistance(distance, unit)} />}
            {paceStr && <MetricChip label="pace" value={paceStr} />}
            {duration != null && <MetricChip label="time" value={formatDuration(duration)} />}
          </div>
        </>
      )}

      <div className="px-4 pb-4 flex items-center gap-5">
        <button
          type="button"
          onClick={onLike}
          className="flex items-center gap-1.5 text-sm font-medium"
        >
          <KudosIcon filled={!!item.user_has_liked} />
          <span className={item.user_has_liked ? 'text-kudos-500' : 'text-ink-muted'}>
            {(item.likes_count ?? 0) > 0 ? item.likes_count : 'Kudos'}
          </span>
        </button>
        <button
          type="button"
          onClick={() => setCommentModalOpen(true)}
          className="flex items-center gap-1.5 text-sm text-ink-muted"
        >
          <CommentIcon />
          {(item.comments_count ?? 0) > 0 ? item.comments_count : 'Comment'}
        </button>
        {runId && (
          <button
            type="button"
            onClick={() => navigate(`/runs/${runId}?userId=${item.user_id}`)}
            className="ml-auto text-sm font-medium text-primary-600 dark:text-primary-400"
          >
            View run
          </button>
        )}
      </div>

      <CommentModal
        isOpen={commentModalOpen}
        onClose={() => setCommentModalOpen(false)}
        activityId={item.id}
        onCommentAdded={() => onCommentAdded?.()}
      />
    </Card>
  );
}
