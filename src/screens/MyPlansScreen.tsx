import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import type { TrainingPlan } from '../types';
import { Header } from '../components/navigation/Header';
import { PlanCard } from '../components/plan/PlanCard';
import { EmptyState } from '../components/ui/EmptyState';
import { Button } from '../components/ui/Button';
import { useDb } from '../contexts/DatabaseContext';
import { usePlan } from '../contexts/PlanContext';
import { getAllPlans } from '../services/planService';

export function MyPlansScreen() {
  const navigate = useNavigate();
  const db = useDb();
  const { activePlan } = usePlan();
  const [plans, setPlans] = useState<TrainingPlan[]>([]);

  const load = useCallback(async () => {
    setPlans(await getAllPlans(db));
  }, [db]);

  useEffect(() => { load(); }, [load]);

  return (
    <div className="flex flex-col flex-1 overflow-y-auto pb-24">
      <Header
        title="Training Plans"
        showBack
        rightAction={
          <Button size="sm" onClick={() => navigate('/profile/plans/new')}>+ New</Button>
        }
      />
      <div className="px-4 pt-4 flex flex-col gap-3">
        {plans.length === 0 ? (
          <EmptyState
            emoji="📋"
            title="No plans yet"
            description="Browse built-in plans or create your own."
            action={<Button size="sm" onClick={() => navigate('/community')}>Browse Community Plans</Button>}
          />
        ) : (
          plans.map(plan => (
            <PlanCard
              key={plan.id}
              plan={plan}
              isActive={activePlan?.plan_id === plan.id}
              onClick={() => navigate(`/profile/plans/${plan.id}`)}
            />
          ))
        )}
      </div>
    </div>
  );
}

