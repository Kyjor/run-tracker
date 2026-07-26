import { useEffect, useState } from 'react';
import type { Gear, GearType } from '../../types';
import { GEAR_TYPE_LABELS } from '../../types';
import { useDb } from '../../contexts/DatabaseContext';
import { getAllGear } from '../../services/gearService';

interface GearPickerProps {
  selectedIds: string[];
  onChange: (ids: string[]) => void;
  /** Limit which types are shown; default all active gear */
  types?: GearType[];
  label?: string;
}

export function GearPicker({ selectedIds, onChange, types, label = 'Gear' }: GearPickerProps) {
  const db = useDb();
  const [gear, setGear] = useState<Gear[]>([]);

  useEffect(() => {
    if (!db) return;
    getAllGear(db, true).then(items => {
      setGear(types ? items.filter(g => types.includes(g.type)) : items);
    });
  }, [db, types]);

  if (gear.length === 0) return null;

  function toggle(id: string) {
    if (selectedIds.includes(id)) {
      onChange(selectedIds.filter(x => x !== id));
    } else {
      onChange([...selectedIds, id]);
    }
  }

  const byType = gear.reduce<Record<string, Gear[]>>((acc, g) => {
    (acc[g.type] ??= []).push(g);
    return acc;
  }, {});

  return (
    <div>
      <p className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">{label}</p>
      <div className="flex flex-col gap-3">
        {(Object.entries(byType) as [GearType, Gear[]][]).map(([type, items]) => (
          <div key={type}>
            <p className="text-[10px] uppercase tracking-wide text-ink-muted dark:text-ink-dark-muted mb-1.5">
              {GEAR_TYPE_LABELS[type]}
            </p>
            <div className="flex flex-wrap gap-2">
              {items.map(g => {
                const selected = selectedIds.includes(g.id);
                return (
                  <button
                    key={g.id}
                    type="button"
                    onClick={() => toggle(g.id)}
                    className={[
                      'px-3 py-1.5 rounded-xl text-xs font-medium border transition-colors',
                      selected
                        ? 'bg-primary-500 text-white border-primary-500'
                        : 'bg-surface dark:bg-surface-dark-elevated text-ink-primary dark:text-ink-dark-primary border-border dark:border-border-dark',
                    ].join(' ')}
                  >
                    {g.name}
                  </button>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
