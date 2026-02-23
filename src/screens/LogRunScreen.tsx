import { useEffect, useState } from 'react';
import { useNavigate, useLocation, useParams } from 'react-router-dom';
import type { PlanDay, Run } from '../types';
import { Header } from '../components/navigation/Header';
import { RunForm } from '../components/run/RunForm';
import { ConfirmModal } from '../components/ui/Modal';
import { useDb } from '../contexts/DatabaseContext';
import { useToast } from '../contexts/ToastContext';
import { usePlan } from '../contexts/PlanContext';
import { createRun, getRunById, updateRun, deleteRun } from '../services/runService';
import { publishFeedActivity } from '../services/socialService';
import { syncToCloud } from '../services/syncService';
import { useAuth } from '../contexts/AuthContext';

export function LogRunScreen() {
  const navigate = useNavigate();
  const location = useLocation();
  const params = useParams<{ id?: string }>();
  const db = useDb();
  const { showToast } = useToast();
  const { refresh } = usePlan();
  const { session } = useAuth();

  const isEdit = !!params.id;
  const locationState = location.state as { date?: string; planDayId?: string; prefill?: PlanDay } | null;

  const [existingRun, setExistingRun] = useState<Run | null>(null);
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  useEffect(() => {
    if (params.id) {
      getRunById(db, params.id).then(r => setExistingRun(r));
    }
  }, [db, params.id]);

  async function handleSubmit(values: Parameters<React.ComponentProps<typeof RunForm>['onSubmit']>[0]) {
    if (isEdit && existingRun) {
      await updateRun(db, existingRun.id, {
        date: values.date,
        distance_value: values.distance_value,
        distance_unit: values.distance_unit,
        duration_seconds: values.duration_seconds,
        run_type: values.run_type,
        notes: values.notes,
      });
      showToast('Run updated!', 'success');
    } else {
      const run = await createRun(db, { ...values, plan_day_id: locationState?.planDayId ?? null });
      showToast('Run logged! 🎉', 'success');
      // Publish to social feed if sync enabled
      if (session) {
        publishFeedActivity('run_completed', {
          distance: run.distance_value,
          unit: run.distance_unit,
          duration: run.duration_seconds,
          run_type: run.run_type,
        }).catch(() => {});
      }
    }
    await refresh();
    // Fire-and-forget sync — don't block navigation
    if (session) syncToCloud(db).catch(() => {});
    navigate(-1);
  }

  async function handleDelete() {
    if (!existingRun) return;
    setIsDeleting(true);
    await deleteRun(db, existingRun.id);
    await refresh();
    showToast('Run deleted', 'info');
    if (session) syncToCloud(db).catch(() => {});
    navigate(-1);
  }

  return (
    <div className="flex flex-col flex-1 overflow-y-auto pb-10">
      <Header
        title={isEdit ? 'Edit Run' : 'Log a Run'}
        showBack
        rightAction={isEdit ? (
          <button
            className="text-sm text-red-500 pr-1"
            onClick={() => setDeleteModalOpen(true)}
          >
            Delete
          </button>
        ) : undefined}
      />

      <div className="px-4 pt-4">
        <RunForm
          key={existingRun?.id ?? 'new'}
          initialDate={locationState?.date}
          prefillPlanDay={locationState?.prefill ?? null}
          existingRun={existingRun}
          onSubmit={handleSubmit}
        />
      </div>

      <ConfirmModal
        isOpen={deleteModalOpen}
        onClose={() => setDeleteModalOpen(false)}
        onConfirm={handleDelete}
        title="Delete Run"
        message="This run will be permanently deleted. Are you sure?"
        confirmLabel="Delete Run"
        confirmVariant="danger"
        isLoading={isDeleting}
      />
    </div>
  );
}

