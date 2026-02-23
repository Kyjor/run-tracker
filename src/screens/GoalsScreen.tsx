import { useCallback, useEffect, useState } from 'react';
import { format, startOfWeek, endOfWeek, startOfMonth, endOfMonth } from 'date-fns';
import type { GoalProgress, GoalType } from '../types';
import { Header } from '../components/navigation/Header';
import { Card } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { ProgressRing } from '../components/ui/ProgressRing';
import { ProgressBar } from '../components/ui/ProgressBar';
import { Modal } from '../components/ui/Modal';
import { Input } from '../components/ui/Input';
import { Select } from '../components/ui/Select';
import { EmptyState } from '../components/ui/EmptyState';
import { ConfirmModal } from '../components/ui/Modal';
import { useDb } from '../contexts/DatabaseContext';
import { useSettings } from '../contexts/SettingsContext';
import { useToast } from '../contexts/ToastContext';
import { getGoals, getGoalProgress, createGoal, deleteGoal } from '../services/goalService';
import { formatDistance } from '../utils/paceUtils';

export function GoalsScreen() {
  const db = useDb();
  const { settings } = useSettings();
  const { showToast } = useToast();

  const [progress, setProgress] = useState<GoalProgress[]>([]);
  const [addOpen, setAddOpen] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  // Form state
  const [goalType, setGoalType] = useState<GoalType>('weekly');
  const [targetValue, setTargetValue] = useState('');
  const [isAdding, setIsAdding] = useState(false);

  const load = useCallback(async () => {
    const goals = await getGoals(db);
    const pp = await Promise.all(goals.map(g => getGoalProgress(db, g)));
    setProgress(pp);
  }, [db]);

  useEffect(() => { load(); }, [load]);

  // When goal created, check if it triggers a toast celebration
  useEffect(() => {
    for (const gp of progress) {
      if (gp.percentage >= 100) {
        // Only show once per session — simple approach
      }
    }
  }, [progress]);

  async function handleAdd() {
    const tv = parseFloat(targetValue);
    if (isNaN(tv) || tv <= 0) return;
    setIsAdding(true);
    const today = new Date();
    const start = goalType === 'weekly'
      ? format(startOfWeek(today, { weekStartsOn: 1 }), 'yyyy-MM-dd')
      : format(startOfMonth(today), 'yyyy-MM-dd');
    const end = goalType === 'weekly'
      ? format(endOfWeek(today, { weekStartsOn: 1 }), 'yyyy-MM-dd')
      : format(endOfMonth(today), 'yyyy-MM-dd');
    await createGoal(db, { type: goalType, target_value: tv, target_unit: settings.units, start_date: start, end_date: end });
    await load();
    showToast('Goal set!', 'success');
    setAddOpen(false);
    setTargetValue('');
    setIsAdding(false);
  }

  return (
    <div className="flex flex-col flex-1 overflow-y-auto pb-24">
      <Header
        title="Goals"
        showBack
        rightAction={
          <Button size="sm" onClick={() => setAddOpen(true)}>+ Goal</Button>
        }
      />

      <div className="px-4 pt-4 flex flex-col gap-3">
        {progress.length === 0 ? (
          <EmptyState
            emoji="🎯"
            title="No goals set"
            description="Set a weekly or monthly mileage goal to stay motivated."
            action={<Button size="sm" onClick={() => setAddOpen(true)}>Set a Goal</Button>}
          />
        ) : (
          progress.map(gp => (
            <Card key={gp.goal.id} padding={false}>
              <div className="p-4">
                <div className="flex items-center gap-4 mb-3">
                  <ProgressRing
                    value={gp.percentage}
                    size={64}
                    strokeWidth={6}
                    color={gp.percentage >= 100 ? '#34d399' : '#3b82f6'}
                  >
                    <span className="text-xs font-bold text-gray-800 dark:text-gray-100">
                      {Math.round(gp.percentage)}%
                    </span>
                  </ProgressRing>
                  <div className="flex-1">
                    <p className="font-semibold text-gray-900 dark:text-white capitalize">{gp.goal.type} goal</p>
                    <p className="text-sm text-gray-600 dark:text-gray-300">
                      {formatDistance(gp.current_value, gp.goal.target_unit)} / {formatDistance(gp.goal.target_value, gp.goal.target_unit)}
                    </p>
                    {gp.percentage >= 100 ? (
                      <p className="text-xs text-green-500 font-medium">🎉 Goal achieved!</p>
                    ) : (
                      <p className="text-xs text-gray-400">
                        {formatDistance(gp.remaining, gp.goal.target_unit)} remaining
                      </p>
                    )}
                  </div>
                  <button
                    onClick={() => setDeleteId(gp.goal.id)}
                    className="text-gray-300 dark:text-gray-600 text-lg leading-none"
                  >
                    ×
                  </button>
                </div>
                <ProgressBar
                  value={gp.percentage}
                  color={gp.percentage >= 100 ? 'bg-green-400' : 'bg-primary-500'}
                />
              </div>
            </Card>
          ))
        )}
      </div>

      {/* Add Goal Modal */}
      <Modal
        isOpen={addOpen}
        onClose={() => setAddOpen(false)}
        title="New Goal"
        footer={
          <Button size="lg" className="w-full" isLoading={isAdding} onClick={handleAdd}>
            Set Goal
          </Button>
        }
      >
        <div className="flex flex-col gap-4">
          <Select
            label="Period"
            options={[{ value: 'weekly', label: 'Weekly' }, { value: 'monthly', label: 'Monthly' }]}
            value={goalType}
            onChange={e => setGoalType(e.target.value as GoalType)}
          />
          <Input
            label={`Target (${settings.units})`}
            type="number"
            step="0.1"
            min="0.1"
            placeholder={settings.units === 'mi' ? '20' : '30'}
            value={targetValue}
            onChange={e => setTargetValue(e.target.value)}
          />
        </div>
      </Modal>

      <ConfirmModal
        isOpen={!!deleteId}
        onClose={() => setDeleteId(null)}
        onConfirm={async () => {
          if (deleteId) { await deleteGoal(db, deleteId); await load(); setDeleteId(null); }
        }}
        title="Delete Goal"
        message="Remove this goal?"
        confirmLabel="Delete"
      />
    </div>
  );
}

