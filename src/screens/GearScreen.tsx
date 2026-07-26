import { useCallback, useEffect, useState } from 'react';
import type { Gear, GearStats, GearType } from '../types';
import { DEFAULT_SHOE_ALERT_MI, GEAR_TYPE_LABELS } from '../types';
import { Header } from '../components/navigation/Header';
import { Card } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { Select } from '../components/ui/Select';
import { Modal, ConfirmModal } from '../components/ui/Modal';
import { EmptyState } from '../components/ui/EmptyState';
import { Spinner } from '../components/ui/Spinner';
import { useDb } from '../contexts/DatabaseContext';
import { useSettings } from '../contexts/SettingsContext';
import { useToast } from '../contexts/ToastContext';
import { useAuth } from '../contexts/AuthContext';
import {
  createGear,
  deleteGear,
  getAllGear,
  getGearStats,
  retireGear,
  setDefaultGear,
  updateGear,
} from '../services/gearService';
import { syncToCloud } from '../services/syncService';
import { convertDistance, formatDistance } from '../utils/paceUtils';

const TYPE_OPTIONS = (Object.entries(GEAR_TYPE_LABELS) as [GearType, string][]).map(
  ([value, label]) => ({ value, label }),
);

export function GearScreen() {
  const db = useDb();
  const { settings } = useSettings();
  const { showToast } = useToast();
  const { session } = useAuth();

  const [gear, setGear] = useState<Gear[]>([]);
  const [statsMap, setStatsMap] = useState<Record<string, GearStats>>({});
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Gear | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const [formType, setFormType] = useState<GearType>('shoes');
  const [formName, setFormName] = useState('');
  const [formBrand, setFormBrand] = useState('');
  const [formModel, setFormModel] = useState('');
  const [formPurchase, setFormPurchase] = useState('');
  const [formNotes, setFormNotes] = useState('');
  const [formThreshold, setFormThreshold] = useState(String(DEFAULT_SHOE_ALERT_MI));

  const load = useCallback(async () => {
    if (!db) return;
    const items = await getAllGear(db);
    setGear(items);
    const statsEntries = await Promise.all(
      items.map(async g => [g.id, await getGearStats(db, g.id)] as const),
    );
    setStatsMap(Object.fromEntries(statsEntries));
    setLoading(false);
  }, [db]);

  useEffect(() => { load(); }, [load]);

  function openAdd() {
    setEditing(null);
    setFormType('shoes');
    setFormName('');
    setFormBrand('');
    setFormModel('');
    setFormPurchase('');
    setFormNotes('');
    setFormThreshold(String(DEFAULT_SHOE_ALERT_MI));
    setModalOpen(true);
  }

  function openEdit(g: Gear) {
    setEditing(g);
    setFormType(g.type);
    setFormName(g.name);
    setFormBrand(g.brand ?? '');
    setFormModel(g.model ?? '');
    setFormPurchase(g.purchase_date ?? '');
    setFormNotes(g.notes);
    setFormThreshold(String(g.alert_threshold_mi ?? DEFAULT_SHOE_ALERT_MI));
    setModalOpen(true);
  }

  async function handleSave() {
    if (!db || !formName.trim()) return;
    setSaving(true);
    try {
      const threshold = formType === 'shoes'
        ? (parseFloat(formThreshold) || DEFAULT_SHOE_ALERT_MI)
        : null;

      if (editing) {
        await updateGear(db, editing.id, {
          name: formName.trim(),
          brand: formBrand.trim() || null,
          model: formModel.trim() || null,
          purchase_date: formPurchase || null,
          notes: formNotes,
          alert_threshold_mi: threshold,
        });
        showToast('Gear updated', 'success');
      } else {
        await createGear(db, {
          type: formType,
          name: formName.trim(),
          brand: formBrand.trim() || null,
          model: formModel.trim() || null,
          purchase_date: formPurchase || null,
          notes: formNotes,
          alert_threshold_mi: threshold,
        });
        showToast('Gear added', 'success');
      }
      setModalOpen(false);
      await load();
      if (session) syncToCloud(db).catch(() => {});
    } finally {
      setSaving(false);
    }
  }

  async function handleRetire(g: Gear) {
    if (!db) return;
    await retireGear(db, g.id);
    showToast('Gear retired', 'info');
    await load();
    if (session) syncToCloud(db).catch(() => {});
  }

  async function handleSetDefault(g: Gear) {
    if (!db) return;
    await setDefaultGear(db, g.type, g.id);
    showToast(`Default ${GEAR_TYPE_LABELS[g.type].toLowerCase()} set`, 'success');
  }

  async function handleDelete() {
    if (!db || !deleteId) return;
    await deleteGear(db, deleteId);
    setDeleteId(null);
    showToast('Gear deleted', 'info');
    await load();
    if (session) syncToCloud(db).catch(() => {});
  }

  const active = gear.filter(g => g.is_active);
  const retired = gear.filter(g => !g.is_active);

  return (
    <div className="flex flex-col flex-1 overflow-y-auto pb-24">
      <Header
        title="Gear"
        showBack
        rightAction={<Button size="sm" onClick={openAdd}>+ Add</Button>}
      />

      <div className="px-4 pt-4 flex flex-col gap-4">
        {loading ? (
          <div className="flex justify-center py-16">
            <Spinner size="lg" className="text-primary-500" />
          </div>
        ) : active.length === 0 && retired.length === 0 ? (
          <EmptyState
            title="No gear yet"
            description="Add shoes, a heart rate monitor, or a watch to track mileage and use."
            action={<Button size="sm" onClick={openAdd}>Add Gear</Button>}
          />
        ) : (
          <>
            {active.length > 0 && (
              <div className="flex flex-col gap-2">
                {active.map(g => {
                  const stats = statsMap[g.id];
                  const dist = stats
                    ? convertDistance(stats.total_distance_mi, 'mi', settings.units)
                    : 0;
                  const threshold = g.alert_threshold_mi;
                  const over =
                    g.type === 'shoes' &&
                    threshold != null &&
                    (stats?.total_distance_mi ?? 0) >= threshold;

                  return (
                    <Card key={g.id} padding={false}>
                      <button
                        type="button"
                        onClick={() => openEdit(g)}
                        className="w-full text-left p-4"
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <p className="text-xs text-ink-muted dark:text-ink-dark-muted uppercase tracking-wide">
                              {GEAR_TYPE_LABELS[g.type]}
                            </p>
                            <p className="font-semibold text-ink-primary dark:text-ink-dark-primary truncate">
                              {g.name}
                            </p>
                            {(g.brand || g.model) && (
                              <p className="text-xs text-ink-secondary dark:text-ink-dark-secondary mt-0.5">
                                {[g.brand, g.model].filter(Boolean).join(' · ')}
                              </p>
                            )}
                            <p className="text-xs text-ink-muted dark:text-ink-dark-muted mt-2">
                              {formatDistance(dist, settings.units)}
                              {stats ? ` · ${stats.run_count} runs` : ''}
                              {over ? ' · Replace soon' : ''}
                            </p>
                          </div>
                          <span className="text-gray-300 dark:text-gray-600">›</span>
                        </div>
                      </button>
                      <div className="flex gap-2 px-4 pb-3">
                        <button
                          type="button"
                          className="text-xs text-primary-600 dark:text-primary-400 font-medium"
                          onClick={() => handleSetDefault(g)}
                        >
                          Set default
                        </button>
                        <button
                          type="button"
                          className="text-xs text-ink-muted font-medium"
                          onClick={() => handleRetire(g)}
                        >
                          Retire
                        </button>
                        <button
                          type="button"
                          className="text-xs text-red-500 font-medium ml-auto"
                          onClick={() => setDeleteId(g.id)}
                        >
                          Delete
                        </button>
                      </div>
                    </Card>
                  );
                })}
              </div>
            )}

            {retired.length > 0 && (
              <div>
                <p className="text-xs font-medium text-ink-muted dark:text-ink-dark-muted uppercase tracking-wide mb-2">
                  Retired
                </p>
                <div className="flex flex-col gap-2 opacity-70">
                  {retired.map(g => (
                    <Card key={g.id} className="py-3">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-sm font-medium">{g.name}</p>
                          <p className="text-xs text-ink-muted">{GEAR_TYPE_LABELS[g.type]}</p>
                        </div>
                        <button
                          type="button"
                          className="text-xs text-red-500"
                          onClick={() => setDeleteId(g.id)}
                        >
                          Delete
                        </button>
                      </div>
                    </Card>
                  ))}
                </div>
              </div>
            )}
          </>
        )}
      </div>

      <Modal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editing ? 'Edit Gear' : 'Add Gear'}
      >
        <div className="flex flex-col gap-3">
          {!editing && (
            <Select
              label="Type"
              options={TYPE_OPTIONS}
              value={formType}
              onChange={e => setFormType(e.target.value as GearType)}
            />
          )}
          <Input label="Name" value={formName} onChange={e => setFormName(e.target.value)} placeholder="Pegasus 41" />
          <Input label="Brand" value={formBrand} onChange={e => setFormBrand(e.target.value)} placeholder="Nike" />
          <Input label="Model" value={formModel} onChange={e => setFormModel(e.target.value)} />
          <Input label="Purchase date" type="date" value={formPurchase} onChange={e => setFormPurchase(e.target.value)} />
          {(formType === 'shoes' || editing?.type === 'shoes') && (
            <Input
              label="Alert threshold (miles)"
              type="number"
              value={formThreshold}
              onChange={e => setFormThreshold(e.target.value)}
            />
          )}
          <Input label="Notes" value={formNotes} onChange={e => setFormNotes(e.target.value)} />
          <Button className="w-full mt-2" onClick={handleSave} isLoading={saving} disabled={!formName.trim()}>
            Save
          </Button>
        </div>
      </Modal>

      <ConfirmModal
        isOpen={!!deleteId}
        onClose={() => setDeleteId(null)}
        onConfirm={handleDelete}
        title="Delete Gear"
        message="This removes the gear and unlinks it from past runs. Continue?"
        confirmLabel="Delete"
        confirmVariant="danger"
      />
    </div>
  );
}
