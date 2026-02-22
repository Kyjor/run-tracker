import React from 'react';
import { useNavigate } from 'react-router-dom';
import type { PlanDay, Run } from '../../types';
import { ACTIVITY_COLORS, ACTIVITY_LABELS } from '../../types';
import { Modal } from '../ui/Modal';
import { Button } from '../ui/Button';
import { formatLong } from '../../utils/dateUtils';
import { formatDistance, formatDuration, formatPace, calcPaceSeconds } from '../../utils/paceUtils';
import { useSettings } from '../../contexts/SettingsContext';

interface DayDetailSheetProps {
  isOpen: boolean;
  onClose: () => void;
  date: string | null;
  planDay: PlanDay | null;
  run: Run | null;
}

export function DayDetailSheet({ isOpen, onClose, date, planDay, run }: DayDetailSheetProps) {
  const navigate = useNavigate();
  const { settings } = useSettings();
  if (!date) return null;

  const color = planDay ? ACTIVITY_COLORS[planDay.activity_type] : '#9ca3af';

  const handleLogRun = () => {
    onClose();
    navigate('/log', { state: { date, planDayId: planDay?.id, prefill: planDay } });
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={formatLong(date)}>
      {/* Planned activity */}
      {planDay ? (
        <div className="mb-4 p-3 rounded-2xl" style={{ backgroundColor: color + '18' }}>
          <div className="flex items-center gap-2 mb-1">
            <div className="w-3 h-3 rounded-full" style={{ backgroundColor: color }} />
            <span className="font-semibold text-sm" style={{ color }}>
              {ACTIVITY_LABELS[planDay.activity_type]}
            </span>
          </div>
          {planDay.distance_value && (
            <p className="text-sm text-gray-600 dark:text-gray-300">
              {formatDistance(planDay.distance_value, settings.units)}
            </p>
          )}
          {planDay.duration_minutes && (
            <p className="text-sm text-gray-600 dark:text-gray-300">
              {planDay.duration_minutes} min
            </p>
          )}
          {planDay.description && (
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">{planDay.description}</p>
          )}
        </div>
      ) : (
        <p className="text-sm text-gray-400 mb-4">No scheduled activity for this day.</p>
      )}

      {/* Logged run */}
      {run ? (
        <div className="mb-4 p-3 bg-green-50 dark:bg-green-900/20 rounded-2xl">
          <p className="text-sm font-semibold text-green-700 dark:text-green-400 mb-1">✓ Run Logged</p>
          <div className="flex gap-4 text-sm text-gray-700 dark:text-gray-300">
            <span>{formatDistance(run.distance_value, run.distance_unit)}</span>
            <span>{formatDuration(run.duration_seconds)}</span>
            <span>{formatPace(calcPaceSeconds(run.distance_value, run.duration_seconds, run.distance_unit), run.distance_unit)}</span>
          </div>
          {run.notes && <p className="text-xs text-gray-500 mt-1">{run.notes}</p>}
        </div>
      ) : (
        planDay && planDay.activity_type !== 'rest' && (
          <Button onClick={handleLogRun} className="w-full">
            Log This Run
          </Button>
        )
      )}
    </Modal>
  );
}

