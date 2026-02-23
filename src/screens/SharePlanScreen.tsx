import { useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Header } from '../components/navigation/Header';
import { Button } from '../components/ui/Button';
import { Card } from '../components/ui/Card';
import { useDb } from '../contexts/DatabaseContext';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../contexts/ToastContext';
import { getPlanById, exportPlanToFormat } from '../services/planService';
import { sharePlanToCommunity } from '../services/communityService';
import type { TrainingPlan } from '../types';
import { RACE_TYPE_LABELS, DIFFICULTY_LABELS } from '../types';

export function SharePlanScreen() {
  const navigate = useNavigate();
  const location = useLocation();
  const db = useDb();
  const { user } = useAuth();
  const { showToast } = useToast();

  const planId = (location.state as { planId?: string })?.planId;

  const [plan, setPlan] = useState<TrainingPlan | null>(null);
  const [description, setDescription] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!planId) return;
    getPlanById(db, planId).then(setPlan);
  }, [db, planId]);

  if (!user) {
    return (
      <div className="flex flex-col flex-1">
        <Header title="Share Plan" showBack />
        <div className="flex flex-col items-center justify-center flex-1 px-6 gap-4">
          <span className="text-5xl">🔒</span>
          <p className="text-gray-600 dark:text-gray-400 text-center">
            You need to be signed in to share plans to the community.
          </p>
          <Button onClick={() => navigate('/auth')}>Sign In</Button>
        </div>
      </div>
    );
  }

  if (!planId || !plan) {
    return (
      <div className="flex flex-col flex-1">
        <Header title="Share Plan" showBack />
        <div className="flex flex-col items-center justify-center flex-1 px-6 gap-4">
          <span className="text-5xl">⚠️</span>
          <p className="text-gray-600 dark:text-gray-400 text-center">No plan selected to share.</p>
          <Button variant="secondary" onClick={() => navigate(-1)}>Go Back</Button>
        </div>
      </div>
    );
  }

  async function handleShare() {
    if (!planId) return;
    setLoading(true);
    try {
      const exported = await exportPlanToFormat(db, planId);
      await sharePlanToCommunity(exported, description);
      showToast('Plan shared to community! 🎉', 'success');
      navigate('/community', { replace: true });
    } catch (e) {
      showToast(e instanceof Error ? e.message : 'Failed to share plan', 'error');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex flex-col flex-1 overflow-y-auto pb-24">
      <Header title="Share to Community" showBack />

      <div className="px-4 pt-4 flex flex-col gap-4">
        {/* Plan summary */}
        <Card>
          <p className="font-semibold text-gray-900 dark:text-white mb-1">{plan.name}</p>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            {RACE_TYPE_LABELS[plan.race_type]} · {DIFFICULTY_LABELS[plan.difficulty]} · {plan.duration_weeks} weeks
          </p>
        </Card>

        {/* Description */}
        <div className="flex flex-col gap-1.5">
          <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
            Description <span className="text-gray-400 font-normal">(optional)</span>
          </label>
          <textarea
            value={description}
            onChange={e => setDescription(e.target.value)}
            placeholder="Tell the community about this plan — who it's for, what makes it special..."
            rows={4}
            className="w-full rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 resize-none"
          />
        </div>

        <div className="bg-amber-50 dark:bg-amber-900/20 rounded-2xl p-3">
          <p className="text-xs text-amber-700 dark:text-amber-400">
            Sharing makes this plan visible to everyone in the community. Other runners can upvote, rate, and comment on it.
          </p>
        </div>

        <Button size="lg" className="w-full" isLoading={loading} onClick={handleShare}>
          Share Plan
        </Button>
      </div>
    </div>
  );
}

