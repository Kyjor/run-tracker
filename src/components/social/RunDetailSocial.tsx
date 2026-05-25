import { useEffect, useState } from 'react';
import { Card } from '../ui/Card';
import { CommentModal } from './CommentModal';
import { getFeedActivityIdByRunId, toggleLike, getActivityEngagement } from '../../services/socialService';

interface RunDetailSocialProps {
  runId: string;
  ownerUserId: string;
}

export function RunDetailSocial({ runId, ownerUserId }: RunDetailSocialProps) {
  const [activityId, setActivityId] = useState<string | null>(null);
  const [liked, setLiked] = useState(false);
  const [likesCount, setLikesCount] = useState(0);
  const [commentsCount, setCommentsCount] = useState(0);
  const [commentOpen, setCommentOpen] = useState(false);

  useEffect(() => {
    void (async () => {
      const id = await getFeedActivityIdByRunId(runId, ownerUserId);
      if (!id) return;
      setActivityId(id);
      const eng = await getActivityEngagement(id);
      setLikesCount(eng.likes_count);
      setCommentsCount(eng.comments_count);
      setLiked(eng.user_has_liked);
    })();
  }, [runId, ownerUserId]);

  if (!activityId) return null;

  async function handleKudos() {
    await toggleLike(activityId!);
    setLiked((v) => !v);
    setLikesCount((c) => c + (liked ? -1 : 1));
  }

  return (
    <>
      <Card>
        <div className="flex items-center gap-6">
          <button type="button" onClick={handleKudos} className="flex items-center gap-2 text-sm font-medium">
            <svg viewBox="0 0 24 24" className={`w-5 h-5 ${liked ? 'text-kudos-500 fill-kudos-500' : 'text-ink-muted'}`} fill={liked ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth={1.8}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M21 8.25c0-2.485-2.099-4.5-4.688-4.5-1.935 0-3.597 1.126-4.312 2.733-.715-1.607-2.377-2.733-4.313-2.733C5.1 3.75 3 5.765 3 8.25c0 7.22 9 12 9 12s9-4.78 9-12z" />
            </svg>
            {likesCount > 0 ? `${likesCount} kudos` : 'Give kudos'}
          </button>
          <button type="button" onClick={() => setCommentOpen(true)} className="text-sm text-ink-secondary">
            {commentsCount > 0 ? `${commentsCount} comments` : 'Comment'}
          </button>
        </div>
      </Card>
      <CommentModal
        isOpen={commentOpen}
        onClose={() => setCommentOpen(false)}
        activityId={activityId}
        onCommentAdded={() => setCommentsCount((c) => c + 1)}
      />
    </>
  );
}
