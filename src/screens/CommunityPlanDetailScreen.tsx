import { useCallback, useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import type { CommunityPlan } from '../types';
import { RACE_TYPE_LABELS, DIFFICULTY_LABELS } from '../types';
import { Header } from '../components/navigation/Header';
import { Button } from '../components/ui/Button';
import { Card } from '../components/ui/Card';
import { Badge } from '../components/ui/Badge';
import { Spinner } from '../components/ui/Spinner';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../contexts/ToastContext';
import { getCommunityPlan, upvotePlan, removeUpvote, ratePlan } from '../services/communityService';
import { useDb } from '../contexts/DatabaseContext';
import { importPlanFromExport } from '../services/planService';

export function CommunityPlanDetailScreen() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { showToast } = useToast();
  const db = useDb();

  const [plan, setPlan] = useState<CommunityPlan | null>(null);
  const [loading, setLoading] = useState(true);
  const [importing, setImporting] = useState(false);
  const [userRating, setUserRating] = useState(0);

  const load = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    const data = await getCommunityPlan(id);
    setPlan(data);
    setLoading(false);
  }, [id]);

  useEffect(() => { load(); }, [load]);

  async function handleUpvote() {
    if (!user) { navigate('/auth'); return; }
    if (!plan) return;
    if (plan.user_has_upvoted) {
      await removeUpvote(plan.id);
      setPlan(p => p ? { ...p, upvote_count: p.upvote_count - 1, user_has_upvoted: false } : p);
    } else {
      await upvotePlan(plan.id);
      setPlan(p => p ? { ...p, upvote_count: p.upvote_count + 1, user_has_upvoted: true } : p);
    }
  }

  async function handleRate(rating: number) {
    if (!user) { navigate('/auth'); return; }
    if (!plan) return;
    setUserRating(rating);
    await ratePlan(plan.id, rating);
    showToast('Rating saved!', 'success');
  }

  async function handleImport() {
    if (!plan?.plan_data) return;
    setImporting(true);
    try {
      await importPlanFromExport(db, plan.plan_data);
      showToast('Plan added to your plans!', 'success');
      navigate('/profile/plans');
    } catch (e) {
      showToast(e instanceof Error ? e.message : 'Failed to import plan', 'error');
    } finally {
      setImporting(false);
    }
  }

  if (loading) {
    return (
      <div className="flex flex-col flex-1">
        <Header title="Plan" showBack />
        <div className="flex justify-center py-16">
          <Spinner size="lg" className="text-primary-500" />
        </div>
      </div>
    );
  }

  if (!plan) {
    return (
      <div className="flex flex-col flex-1">
        <Header title="Plan" showBack />
        <div className="flex flex-col items-center justify-center flex-1 px-6 gap-3">
          <span className="text-4xl">😕</span>
          <p className="text-gray-500 dark:text-gray-400 text-center">Plan not found.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col flex-1 overflow-y-auto pb-24">
      <Header title={plan.name} showBack />

      <div className="px-4 pt-4 flex flex-col gap-4">
        {/* Info */}
        <Card>
          <div className="flex gap-2 flex-wrap mb-2">
            <Badge label={RACE_TYPE_LABELS[plan.race_type]} color="#ef4444" />
            <Badge label={DIFFICULTY_LABELS[plan.difficulty]} color="#6b7280" />
            <Badge label={`${plan.duration_weeks} weeks`} color="#6b7280" />
          </div>
          {plan.description && (
            <p className="text-sm text-gray-600 dark:text-gray-300">{plan.description}</p>
          )}
        </Card>

        {/* Upvote + Rating */}
        <Card>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <button
                onClick={handleUpvote}
                className={[
                  'flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-sm font-medium transition-colors',
                  plan.user_has_upvoted
                    ? 'bg-accent-100 dark:bg-accent-900/30 text-accent-600 dark:text-accent-400'
                    : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400',
                ].join(' ')}
              >
                <span>{plan.user_has_upvoted ? '▲' : '△'}</span>
                <span>{plan.upvote_count}</span>
              </button>

              <div className="flex items-center gap-1">
                <span className="text-amber-400">★</span>
                <span className="text-sm text-gray-600 dark:text-gray-400">
                  {plan.avg_rating > 0 ? plan.avg_rating.toFixed(1) : '—'}
                  {plan.rating_count > 0 && ` (${plan.rating_count})`}
                </span>
              </div>
            </div>

            {/* Star rating */}
            {user && (
              <div className="flex gap-1">
                {[1,2,3,4,5].map(star => (
                  <button
                    key={star}
                    onClick={() => handleRate(star)}
                    className={star <= userRating ? 'text-amber-400' : 'text-gray-300 dark:text-gray-600'}
                  >
                    ★
                  </button>
                ))}
              </div>
            )}
          </div>
        </Card>

        {/* Import */}
        <Button size="lg" className="w-full" isLoading={importing} onClick={handleImport}>
          Add to My Plans
        </Button>

        {!user && (
          <p className="text-xs text-center text-gray-400 dark:text-gray-500">
            <button className="text-primary-600 dark:text-primary-400" onClick={() => navigate('/auth')}>
              Sign in
            </button> to upvote or rate this plan
          </p>
        )}
      </div>
    </div>
  );
}

