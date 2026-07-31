import type Database from '@tauri-apps/plugin-sql';
import type { DistanceUnit, Gear, GearStats, GearType } from '../types';
import { DEFAULT_SHOE_ALERT_MI } from '../types';
import { generateId } from '../utils/generateId';
import { convertDistance } from '../utils/paceUtils';

export interface CreateGearInput {
  type: GearType;
  name: string;
  brand?: string | null;
  model?: string | null;
  purchase_date?: string | null;
  notes?: string;
  alert_threshold_mi?: number | null;
  /** Miles already on the gear before tracking in-app */
  starting_distance_mi?: number;
}

export interface UpdateGearInput {
  name?: string;
  brand?: string | null;
  model?: string | null;
  purchase_date?: string | null;
  notes?: string;
  alert_threshold_mi?: number | null;
  starting_distance_mi?: number;
  is_active?: number;
  retired_at?: string | null;
}

export async function getAllGear(db: Database, activeOnly = false): Promise<Gear[]> {
  if (activeOnly) {
    return db.select<Gear[]>('SELECT * FROM gear WHERE is_active = 1 ORDER BY type, name');
  }
  return db.select<Gear[]>('SELECT * FROM gear ORDER BY is_active DESC, type, name');
}

export async function getGearById(db: Database, id: string): Promise<Gear | null> {
  const rows = await db.select<Gear[]>('SELECT * FROM gear WHERE id = $1', [id]);
  return rows[0] ?? null;
}

export async function getGearByType(db: Database, type: GearType, activeOnly = true): Promise<Gear[]> {
  if (activeOnly) {
    return db.select<Gear[]>(
      'SELECT * FROM gear WHERE type = $1 AND is_active = 1 ORDER BY name',
      [type],
    );
  }
  return db.select<Gear[]>('SELECT * FROM gear WHERE type = $1 ORDER BY name', [type]);
}

export async function createGear(db: Database, input: CreateGearInput): Promise<Gear> {
  const now = new Date().toISOString();
  const gear: Gear = {
    id: generateId(),
    type: input.type,
    name: input.name.trim(),
    brand: input.brand?.trim() || null,
    model: input.model?.trim() || null,
    purchase_date: input.purchase_date ?? null,
    notes: input.notes ?? '',
    is_active: 1,
    retired_at: null,
    alert_threshold_mi:
      input.type === 'shoes'
        ? (input.alert_threshold_mi ?? DEFAULT_SHOE_ALERT_MI)
        : (input.alert_threshold_mi ?? null),
    starting_distance_mi: Math.max(0, input.starting_distance_mi ?? 0),
    created_at: now,
    updated_at: now,
    sync_status: 'local',
  };

  await db.execute(
    `INSERT INTO gear
      (id, type, name, brand, model, purchase_date, notes, is_active, retired_at,
       alert_threshold_mi, starting_distance_mi, created_at, updated_at, sync_status)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14)`,
    [
      gear.id, gear.type, gear.name, gear.brand, gear.model, gear.purchase_date,
      gear.notes, gear.is_active, gear.retired_at, gear.alert_threshold_mi,
      gear.starting_distance_mi, gear.created_at, gear.updated_at, gear.sync_status,
    ],
  );

  // First active item of this type becomes the default
  const existingDefault = await getDefaultGear(db, input.type);
  if (!existingDefault) {
    await setDefaultGear(db, input.type, gear.id);
  }

  return gear;
}

export async function updateGear(db: Database, id: string, input: UpdateGearInput): Promise<void> {
  const existing = await getGearById(db, id);
  if (!existing) return;

  const now = new Date().toISOString();
  await db.execute(
    `UPDATE gear SET
      name = $1, brand = $2, model = $3, purchase_date = $4, notes = $5,
      alert_threshold_mi = $6, starting_distance_mi = $7, is_active = $8, retired_at = $9,
      updated_at = $10, sync_status = 'dirty'
     WHERE id = $11`,
    [
      input.name ?? existing.name,
      input.brand !== undefined ? input.brand : existing.brand,
      input.model !== undefined ? input.model : existing.model,
      input.purchase_date !== undefined ? input.purchase_date : existing.purchase_date,
      input.notes ?? existing.notes,
      input.alert_threshold_mi !== undefined ? input.alert_threshold_mi : existing.alert_threshold_mi,
      input.starting_distance_mi !== undefined
        ? Math.max(0, input.starting_distance_mi)
        : (existing.starting_distance_mi ?? 0),
      input.is_active !== undefined ? input.is_active : existing.is_active,
      input.retired_at !== undefined ? input.retired_at : existing.retired_at,
      now,
      id,
    ],
  );
}

export async function retireGear(db: Database, id: string): Promise<void> {
  await updateGear(db, id, {
    is_active: 0,
    retired_at: new Date().toISOString(),
  });
  // Clear defaults pointing at this gear
  await db.execute('DELETE FROM gear_defaults WHERE gear_id = $1', [id]);
}

export async function deleteGear(db: Database, id: string): Promise<void> {
  const existing = await getGearById(db, id);
  if (existing && existing.sync_status !== 'local') {
    const { deleteFromCloudOrQueue } = await import('./syncService');
    await deleteFromCloudOrQueue(db, 'user_gear', id, async (userId) => {
      const { supabase } = await import('./supabaseClient');
      await supabase.from('user_run_gear').delete().eq('user_id', userId).eq('gear_id', id);
    });
  }

  await db.execute('DELETE FROM run_gear WHERE gear_id = $1', [id]);
  await db.execute('DELETE FROM gear_defaults WHERE gear_id = $1', [id]);
  await db.execute('DELETE FROM gear WHERE id = $1', [id]);
}

export async function assignGearToRun(db: Database, runId: string, gearIds: string[]): Promise<void> {
  await db.execute('DELETE FROM run_gear WHERE run_id = $1', [runId]);
  for (const gearId of gearIds) {
    await db.execute(
      'INSERT OR IGNORE INTO run_gear (run_id, gear_id) VALUES ($1, $2)',
      [runId, gearId],
    );
  }

  // Update defaults from assigned gear and mark dirty for sync
  const now = new Date().toISOString();
  // Mark run dirty so push replaces user_run_gear (including removals)
  await db.execute(
    "UPDATE runs SET sync_status = 'dirty', updated_at = $1 WHERE id = $2",
    [now, runId],
  );
  for (const gearId of gearIds) {
    const gear = await getGearById(db, gearId);
    if (gear && gear.is_active) {
      await setDefaultGear(db, gear.type, gear.id);
    }
    await db.execute(
      "UPDATE gear SET sync_status = 'dirty', updated_at = $1 WHERE id = $2",
      [now, gearId],
    );
  }
}

export async function getGearForRun(db: Database, runId: string): Promise<Gear[]> {
  return db.select<Gear[]>(
    `SELECT g.* FROM gear g
     INNER JOIN run_gear rg ON rg.gear_id = g.id
     WHERE rg.run_id = $1
     ORDER BY g.type, g.name`,
    [runId],
  );
}

export async function getDefaultGear(db: Database, type: GearType): Promise<Gear | null> {
  const rows = await db.select<Gear[]>(
    `SELECT g.* FROM gear g
     INNER JOIN gear_defaults d ON d.gear_id = g.id
     WHERE d.gear_type = $1 AND g.is_active = 1`,
    [type],
  );
  return rows[0] ?? null;
}

export async function setDefaultGear(db: Database, type: GearType, gearId: string): Promise<void> {
  await db.execute(
    `INSERT INTO gear_defaults (gear_type, gear_id) VALUES ($1, $2)
     ON CONFLICT(gear_type) DO UPDATE SET gear_id = excluded.gear_id`,
    [type, gearId],
  );
}

export async function getDefaultGearIds(db: Database): Promise<string[]> {
  const types: GearType[] = ['shoes', 'heart_rate_monitor', 'watch'];
  const ids: string[] = [];
  for (const type of types) {
    const gear = await getDefaultGear(db, type);
    if (gear) ids.push(gear.id);
  }
  return ids;
}

export async function getGearStats(db: Database, gearId: string): Promise<GearStats> {
  const gear = await getGearById(db, gearId);
  const rows = await db.select<{
    distance_value: number;
    distance_unit: DistanceUnit;
    date: string;
  }[]>(
    `SELECT r.distance_value, r.distance_unit, r.date
     FROM runs r
     INNER JOIN run_gear rg ON rg.run_id = r.id
     WHERE rg.gear_id = $1
     ORDER BY r.date DESC`,
    [gearId],
  );

  let totalMi = gear?.starting_distance_mi ?? 0;
  for (const row of rows) {
    totalMi += convertDistance(row.distance_value, row.distance_unit, 'mi');
  }

  return {
    gear_id: gearId,
    total_distance_mi: totalMi,
    run_count: rows.length,
    last_used_date: rows[0]?.date ?? null,
  };
}

export async function getShoesNeedingAlert(db: Database): Promise<Array<Gear & { total_distance_mi: number }>> {
  const shoes = await getGearByType(db, 'shoes', true);
  const alerts: Array<Gear & { total_distance_mi: number }> = [];

  for (const shoe of shoes) {
    const threshold = shoe.alert_threshold_mi ?? DEFAULT_SHOE_ALERT_MI;
    const stats = await getGearStats(db, shoe.id);
    if (stats.total_distance_mi >= threshold) {
      alerts.push({ ...shoe, total_distance_mi: stats.total_distance_mi });
    }
  }
  return alerts;
}
