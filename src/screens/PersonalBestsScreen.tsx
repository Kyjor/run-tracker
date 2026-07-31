import { useCallback, useEffect, useMemo, useState } from 'react';
import { format, parseISO } from 'date-fns';
import { useNavigate } from 'react-router-dom';
import { Header } from '../components/navigation/Header';
import { Card } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { Modal } from '../components/ui/Modal';
import { Spinner } from '../components/ui/Spinner';
import { FadeIn } from '../components/motion/FadeIn';
import { useDb } from '../contexts/DatabaseContext';
import { useSettings } from '../contexts/SettingsContext';
import { useToast } from '../contexts/ToastContext';
import {
  computePersonalBests,
  DEFAULT_PB_DISTANCES,
  metersLabel,
  parseCustomDistanceInput,
  type PbDistanceDef,
  type PersonalBest,
} from '../services/personalBestsService';
import { formatDuration } from '../utils/paceUtils';
import type { DistanceUnit } from '../types';

export function PersonalBestsScreen() {
  const navigate = useNavigate();
  const db = useDb();
  const { settings, updateSettings } = useSettings();
  const { showToast } = useToast();
  const [bests, setBests] = useState<PersonalBest[]>([]);
  const [loading, setLoading] = useState(true);
  const [addOpen, setAddOpen] = useState(false);
  const [customValue, setCustomValue] = useState('');
  const [customLabel, setCustomLabel] = useState('');
  const [saving, setSaving] = useState(false);

  const distances = useMemo((): PbDistanceDef[] => {
    const custom = settings.custom_pb_distances ?? [];
    return [...DEFAULT_PB_DISTANCES, ...custom];
  }, [settings.custom_pb_distances]);

  const reload = useCallback(async () => {
    setLoading(true);
    try {
      const rows = await computePersonalBests(db, distances);
      setBests(rows);
    } finally {
      setLoading(false);
    }
  }, [db, distances]);

  useEffect(() => {
    void reload();
  }, [reload]);

  async function handleAddCustom() {
    const value = parseFloat(customValue);
    const def = parseCustomDistanceInput(value, settings.units, customLabel || undefined);
    if (!def) {
      showToast('Enter a valid distance', 'error');
      return;
    }
    const exists = distances.some((d) => Math.abs(d.meters - def.meters) < 1);
    if (exists) {
      showToast('That distance is already listed', 'info');
      return;
    }
    setSaving(true);
    try {
      const next = [...(settings.custom_pb_distances ?? []), def];
      await updateSettings({ custom_pb_distances: next });
      setAddOpen(false);
      setCustomValue('');
      setCustomLabel('');
      showToast('Distance added', 'success');
    } finally {
      setSaving(false);
    }
  }

  async function handleRemove(id: string) {
    const next = (settings.custom_pb_distances ?? []).filter((d) => d.id !== id);
    await updateSettings({ custom_pb_distances: next });
    showToast('Removed', 'success');
  }

  return (
    <div className="flex flex-col flex-1 overflow-y-auto pb-24">
      <Header title="Personal Bests" showBack />

      <div className="px-4 pt-4 flex flex-col gap-4">
        <p className="text-sm text-gray-500 dark:text-gray-400">
          Fastest times at classic race distances. Longer GPS runs count via best effort when route
          data is available.
        </p>

        <Button variant="secondary" onClick={() => setAddOpen(true)}>
          Add custom distance
        </Button>

        {loading ? (
          <div className="flex justify-center py-16">
            <Spinner size="lg" className="text-primary-500" />
          </div>
        ) : (
          <FadeIn className="flex flex-col gap-3">
            {bests.map((pb) => (
              <PbRow
                key={pb.distance.id}
                pb={pb}
                units={settings.units}
                onOpenRun={() => pb.runId && navigate(`/runs/${pb.runId}`)}
                onRemove={
                  pb.distance.builtin ? undefined : () => void handleRemove(pb.distance.id)
                }
              />
            ))}
          </FadeIn>
        )}
      </div>

      <Modal isOpen={addOpen} onClose={() => setAddOpen(false)} title="Custom distance">
        <div className="flex flex-col gap-3">
          <Input
            label={`Distance (${settings.units})`}
            type="number"
            inputMode="decimal"
            value={customValue}
            onChange={(e) => setCustomValue(e.target.value)}
            placeholder={settings.units === 'mi' ? 'e.g. 3' : 'e.g. 5'}
          />
          <Input
            label="Label (optional)"
            value={customLabel}
            onChange={(e) => setCustomLabel(e.target.value)}
            placeholder="e.g. Park loop"
          />
          <Button isLoading={saving} onClick={() => void handleAddCustom()}>
            Add
          </Button>
        </div>
      </Modal>
    </div>
  );
}

function PbRow({
  pb,
  units,
  onOpenRun,
  onRemove,
}: {
  pb: PersonalBest;
  units: DistanceUnit;
  onOpenRun: () => void;
  onRemove?: () => void;
}) {
  const dateLabel = pb.runDate
    ? format(parseISO(pb.runDate.length === 10 ? `${pb.runDate}T12:00:00` : pb.runDate), 'MMM d, yyyy')
    : null;

  return (
    <Card>
      <div className="flex items-start justify-between gap-3">
        <button
          type="button"
          className="flex-1 text-left disabled:opacity-60"
          onClick={onOpenRun}
          disabled={!pb.runId}
        >
          <div className="flex items-baseline justify-between gap-2">
            <span className="font-bold text-gray-900 dark:text-white">{pb.distance.label}</span>
            <span className="text-lg font-bold tabular-nums text-primary-600 dark:text-primary-400">
              {pb.durationSeconds != null ? formatDuration(pb.durationSeconds) : '—'}
            </span>
          </div>
          <p className="text-xs text-gray-400 mt-1">
            {metersLabel(pb.distance.meters, units)}
            {dateLabel ? ` · ${dateLabel}` : ''}
            {pb.fromBestEffort ? ' · best effort' : ''}
          </p>
        </button>
        {onRemove ? (
          <button
            type="button"
            className="text-xs text-red-500 shrink-0 pt-1"
            onClick={onRemove}
          >
            Remove
          </button>
        ) : null}
      </div>
    </Card>
  );
}
