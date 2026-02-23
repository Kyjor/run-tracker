import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import type { CommunityPlan } from '../types';
import { Header } from '../components/navigation/Header';
import { CommunityPlanCard } from '../components/plan/CommunityPlanCard';
import { EmptyState } from '../components/ui/EmptyState';
import { Spinner } from '../components/ui/Spinner';
import { getCommunityPlans, upvotePlan, removeUpvote } from '../services/communityService';
import { useAuth } from '../contexts/AuthContext';

const RACE_FILTERS: { value: string; label: string }[] = [
  { value: '', label: 'All' },
  { value: '5k', label: '5K' },
  { value: '10k', label: '10K' },
  { value: 'half_marathon', label: 'Half' },
  { value: 'full_marathon', label: 'Full' },
];

export function CommunityScreen() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [plans, setPlans] = useState<CommunityPlan[]>([]);
  const [filter, setFilter] = useState('');
  const [sort, setSort] = useState<'top' | 'new'>('top');
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    const data = await getCommunityPlans({ race_type: filter || undefined, sort });
    setPlans(data);
    setLoading(false);
  }, [filter, sort]);

  useEffect(() => { load(); }, [load]);

  async function handleUpvote(plan: CommunityPlan) {
    if (!user) { navigate('/auth'); return; }
    if (plan.user_has_upvoted) {
      await removeUpvote(plan.id);
      setPlans(prev => prev.map(p => p.id === plan.id ? { ...p, upvote_count: p.upvote_count - 1, user_has_upvoted: false } : p));
    } else {
      await upvotePlan(plan.id);
      setPlans(prev => prev.map(p => p.id === plan.id ? { ...p, upvote_count: p.upvote_count + 1, user_has_upvoted: true } : p));
    }
  }

  return (
    <div className="flex flex-col flex-1 overflow-y-auto pb-24">
      <Header title="Community Plans" showBack />

      {/* Filters */}
      <div className="flex items-center gap-2 px-4 pt-3 pb-2 overflow-x-auto">
        {RACE_FILTERS.map(f => (
          <button
            key={f.value}
            onClick={() => setFilter(f.value)}
            className={[
              'px-3 py-1.5 rounded-xl text-sm font-medium whitespace-nowrap',
              filter === f.value
                ? 'bg-primary-600 text-white'
                : 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400',
            ].join(' ')}
          >
            {f.label}
          </button>
        ))}
        <button
          onClick={() => setSort(s => s === 'top' ? 'new' : 'top')}
          className="ml-auto text-xs text-primary-600 dark:text-primary-400 whitespace-nowrap"
        >
          {sort === 'top' ? '▼ Top' : '🕐 New'}
        </button>
      </div>

      <div className="px-4 flex flex-col gap-3 pb-4">
        {loading ? (
          <div className="flex justify-center py-16">
            <Spinner size="lg" className="text-primary-500" />
          </div>
        ) : plans.length === 0 ? (
          <EmptyState
            emoji="🌐"
            title="No community plans yet"
            description="Be the first to share a training plan!"
          />
        ) : (
          plans.map(plan => (
            <CommunityPlanCard
              key={plan.id}
              plan={plan}
              hasUpvoted={plan.user_has_upvoted}
              onClick={() => navigate(`/community/${plan.id}`)}
              onUpvote={() => handleUpvote(plan)}
            />
          ))
        )}
      </div>
    </div>
  );
}

