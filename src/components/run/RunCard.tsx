import { useState } from 'react';
import type { Run } from '../../types';
import { RUN_TYPE_LABELS, ACTIVITY_COLORS } from '../../types';
import { Card } from '../ui/Card';
import { CommentModal } from '../social/CommentModal';
import { formatShort } from '../../utils/dateUtils';
import { formatDistance, formatDuration, formatPace, calcPaceSeconds } from '../../utils/paceUtils';
import { getFeedActivityIdByRunId } from '../../services/socialService';
import { useAuth } from '../../contexts/AuthContext';

interface RunCardProps {
  run: Run;
  onClick?: () => void;
}

export function RunCard({ run, onClick }: RunCardProps) {
  const { user } = useAuth();
  const [commentModalOpen, setCommentModalOpen] = useState(false);
  const [activityId, setActivityId] = useState<string | null>(null);
  const color = ACTIVITY_COLORS[run.run_type as keyof typeof ACTIVITY_COLORS] ?? ACTIVITY_COLORS['easy_run'];
  const pace = calcPaceSeconds(run.distance_value, run.duration_seconds, run.distance_unit);

  async function handleCommentClick(e: React.MouseEvent) {
    e.stopPropagation(); // Prevent triggering onClick
    if (!user) return;
    
    let id = await getFeedActivityIdByRunId(run.id);
    
    // If no feed activity exists, create one
    if (!id) {
      const { publishFeedActivity } = await import('../../services/socialService');
      id = await publishFeedActivity('run_completed', {
        distance: run.distance_value,
        unit: run.distance_unit,
        duration: run.duration_seconds,
        run_type: run.run_type,
        run_id: run.id,
        run_date: run.date,
      });
    }
    
    if (id) {
      setActivityId(id);
      setCommentModalOpen(true);
    }
  }

  return (
    <>
      <Card onClick={onClick} padding={false}>
        <div className="flex items-center gap-3 p-4">
          {/* Color indicator */}
          <div
            className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
            style={{ backgroundColor: color + '22' }}
          >
            <div className="w-3 h-3 rounded-full" style={{ backgroundColor: color }} />
          </div>

          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <span className="text-sm font-semibold text-gray-900 dark:text-white">
                {RUN_TYPE_LABELS[run.run_type] ?? 'Run'}
              </span>
              <span className="text-xs text-gray-400">{formatShort(run.date)}</span>
            </div>
            <div className="flex gap-3 mt-0.5">
              <span className="text-xs text-gray-600 dark:text-gray-400">
                {formatDistance(run.distance_value, run.distance_unit)}
              </span>
              <span className="text-xs text-gray-400">{formatDuration(run.duration_seconds)}</span>
              {pace > 0 && (
                <span className="text-xs text-gray-400">{formatPace(pace, run.distance_unit)}</span>
              )}
            </div>
            {run.notes ? (
              <p className="text-xs text-gray-400 mt-0.5 truncate">{run.notes}</p>
            ) : null}
          </div>

          <div className="flex items-center gap-2 flex-shrink-0">
            {run.plan_day_id && (
              <span className="text-xs text-primary-500">📅</span>
            )}
            {user && (
              <button
                onClick={handleCommentClick}
                className="text-gray-400 hover:text-primary-500 active:opacity-60 transition-colors"
                title="View comments"
              >
                💬
              </button>
            )}
          </div>
        </div>
      </Card>

      {activityId && (
        <CommentModal
          isOpen={commentModalOpen}
          onClose={() => setCommentModalOpen(false)}
          activityId={activityId}
          onCommentAdded={() => {
            // Refresh if needed
          }}
        />
      )}
    </>
  );
}

