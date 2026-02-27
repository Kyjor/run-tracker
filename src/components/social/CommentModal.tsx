import { useCallback, useEffect, useState } from 'react';
import { Modal } from '../ui/Modal';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import { Spinner } from '../ui/Spinner';
import { EmptyState } from '../ui/EmptyState';
import { getComments, addComment } from '../../services/socialService';
import { useAuth } from '../../contexts/AuthContext';
import { useToast } from '../../contexts/ToastContext';
import type { FeedComment } from '../../types';
import { formatRelativeTime } from '../../utils/dateUtils';

interface CommentModalProps {
  isOpen: boolean;
  onClose: () => void;
  activityId: string;
  onCommentAdded?: () => void;
}

export function CommentModal({ isOpen, onClose, activityId, onCommentAdded }: CommentModalProps) {
  const { user } = useAuth();
  const { showToast } = useToast();
  const [comments, setComments] = useState<FeedComment[]>([]);
  const [loading, setLoading] = useState(true);
  const [commentText, setCommentText] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const loadComments = useCallback(async () => {
    if (!isOpen) return;
    setLoading(true);
    const data = await getComments(activityId);
    setComments(data);
    setLoading(false);
  }, [isOpen, activityId]);

  useEffect(() => {
    loadComments();
  }, [loadComments]);

  async function handleSubmit() {
    if (!commentText.trim() || !user) return;
    setSubmitting(true);
    try {
      await addComment(activityId, commentText.trim());
      setCommentText('');
      // Small delay to ensure the comment is committed before reloading
      await new Promise(resolve => setTimeout(resolve, 100));
      await loadComments();
      onCommentAdded?.();
      showToast('Comment added!', 'success');
    } catch (error) {
      console.error('Failed to add comment:', error);
      showToast('Failed to add comment', 'error');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Comments"
      footer={
        user ? (
          <div className="flex gap-2">
            <Input
              value={commentText}
              onChange={e => setCommentText(e.target.value)}
              placeholder="Add a comment..."
              onKeyDown={e => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  handleSubmit();
                }
              }}
              className="flex-1"
            />
            <Button onClick={handleSubmit} isLoading={submitting} disabled={!commentText.trim()}>
              Post
            </Button>
          </div>
        ) : undefined
      }
    >
      <div className="flex flex-col gap-4">
        {/* Comments list */}
        <div className="flex-1 overflow-y-auto">
          {loading ? (
            <div className="flex justify-center py-8">
              <Spinner size="lg" className="text-primary-500" />
            </div>
          ) : comments.length === 0 ? (
            <EmptyState emoji="💬" title="No comments yet" description="Be the first to comment!" />
          ) : (
            <div className="flex flex-col gap-3">
              {comments.map(comment => (
                <div key={comment.id} className="flex gap-3">
                  <div className="w-8 h-8 rounded-full bg-primary-200 dark:bg-primary-700 flex items-center justify-center text-sm font-semibold text-primary-800 dark:text-primary-200 flex-shrink-0">
                    {(comment.profile as { display_name?: string })?.display_name?.[0]?.toUpperCase() ?? '?'}
                  </div>
                  <div className="flex-1">
                    <p className="text-sm font-medium text-gray-900 dark:text-white">
                      {(comment.profile as { display_name?: string })?.display_name ?? 'Someone'}
                    </p>
                    <p className="text-sm text-gray-700 dark:text-gray-300 mt-0.5">{comment.text}</p>
                    <p className="text-xs text-gray-400 mt-1">{formatRelativeTime(comment.created_at, true)}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </Modal>
  );
}

