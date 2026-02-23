import { useCallback, useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { format } from 'date-fns';
import type { TrainingPlan, PlanDay } from '../types';
import { RACE_TYPE_LABELS, DIFFICULTY_LABELS } from '../types';
import { Header } from '../components/navigation/Header';
import { PlanPreview } from '../components/plan/PlanPreview';
import { Button } from '../components/ui/Button';
import { Card } from '../components/ui/Card';
import { Badge } from '../components/ui/Badge';
import { useDb } from '../contexts/DatabaseContext';
import { usePlan } from '../contexts/PlanContext';
import { useToast } from '../contexts/ToastContext';
import { getPlanById, getPlanDays, setActivePlan, exportPlanToFormat, deletePlan } from '../services/planService';
import { ConfirmModal } from '../components/ui/Modal';

function groupByWeek(days: PlanDay[]): PlanDay[][] {
  const weeks: PlanDay[][] = [];
  for (const day of days) {
    const wi = day.week_number - 1;
    if (!weeks[wi]) weeks[wi] = [];
    weeks[wi][day.day_of_week] = day;
  }
  return weeks;
}

export function PlanDetailScreen() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const db = useDb();
  const { activePlan, refresh } = usePlan();
  const { showToast } = useToast();

  const [plan, setPlan] = useState<TrainingPlan | null>(null);
  const [days, setDays] = useState<PlanDay[]>([]);
  const [startDate, setStartDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [activating, setActivating] = useState(false);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [deleteModal, setDeleteModal] = useState(false);

  const load = useCallback(async () => {
    if (!id) return;
    const [p, d] = await Promise.all([getPlanById(db, id), getPlanDays(db, id)]);
    setPlan(p);
    setDays(d);
  }, [db, id]);

  useEffect(() => { load(); }, [load]);

  const isActive = activePlan?.plan_id === id;

  async function handleActivate() {
    if (!id) return;
    setActivating(true);
    await setActivePlan(db, id, startDate);
    await refresh();
    showToast('Plan activated! Let\'s go 🏃', 'success');
    setActivating(false);
    setShowDatePicker(false);
  }

  async function handleShare() {
    if (!id) return;
    const exported = await exportPlanToFormat(db, id);
    const json = JSON.stringify(exported, null, 2);
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = `${plan?.name ?? 'plan'}.json`;
    a.click();
    URL.revokeObjectURL(url);
    showToast('Plan exported!', 'success');
  }

  async function handleDelete() {
    if (!id) return;
    await deletePlan(db, id);
    showToast('Plan deleted', 'info');
    navigate(-1);
  }

  if (!plan) return null;

  return (
    <div className="flex flex-col flex-1 overflow-y-auto pb-24">
      <Header
        title={plan.name}
        showBack
        rightAction={
          plan.is_builtin === 0 ? (
            <button className="text-sm text-primary-600 dark:text-primary-400 pr-1" onClick={() => navigate(`/profile/plans/${id}/edit`)}>
              Edit
            </button>
          ) : undefined
        }
      />

      <div className="px-4 pt-4 flex flex-col gap-4">
        {/* Info */}
        <Card>
          <div className="flex gap-2 flex-wrap mb-2">
            <Badge label={RACE_TYPE_LABELS[plan.race_type]} color="#ef4444" />
            <Badge label={DIFFICULTY_LABELS[plan.difficulty]} color="#6b7280" />
            <Badge label={`${plan.duration_weeks} weeks`} color="#6b7280" />
          </div>
          <p className="text-sm text-gray-600 dark:text-gray-300">{plan.description}</p>
        </Card>

        {/* Activate */}
        {isActive ? (
          <div className="flex items-center gap-2 bg-primary-50 dark:bg-primary-900/20 rounded-2xl p-4">
            <span className="text-primary-600 dark:text-primary-400 font-semibold text-sm">✓ Currently Active</span>
            <span className="text-xs text-gray-400 ml-auto">
              Started {activePlan!.start_date}
            </span>
          </div>
        ) : (
          <>
            {showDatePicker ? (
              <Card>
                <p className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Start Date</p>
                <input
                  type="date"
                  value={startDate}
                  onChange={e => setStartDate(e.target.value)}
                  className="w-full rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-white px-3 py-2 mb-3 focus:outline-none focus:ring-2 focus:ring-primary-500"
                />
                <Button size="lg" className="w-full" isLoading={activating} onClick={handleActivate}>
                  Activate Plan
                </Button>
              </Card>
            ) : (
              <Button size="lg" className="w-full" onClick={() => setShowDatePicker(true)}>
                Use This Plan
              </Button>
            )}
          </>
        )}

        {/* Preview */}
        <Card>
          <p className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">Schedule Preview</p>
          <PlanPreview weeks={groupByWeek(days)} maxWeeks={6} />
        </Card>

        {/* Actions */}
        <div className="flex gap-2">
          <Button variant="secondary" className="flex-1" onClick={handleShare}>Export JSON</Button>
          <Button variant="ghost" onClick={() => navigate('/community/share', { state: { planId: id } })}>
            Share to Community
          </Button>
        </div>

        {plan.is_builtin === 0 && (
          <Button variant="danger" onClick={() => setDeleteModal(true)} className="w-full">
            Delete Plan
          </Button>
        )}
      </div>

      <ConfirmModal
        isOpen={deleteModal}
        onClose={() => setDeleteModal(false)}
        onConfirm={handleDelete}
        title="Delete Plan"
        message="This will permanently delete this plan and all its schedule data."
        confirmLabel="Delete"
      />
    </div>
  );
}

