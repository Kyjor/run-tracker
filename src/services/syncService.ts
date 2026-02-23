/**
 * Cloud sync between local SQLite and Supabase.
 * Only runs when sync_enabled = true and user is authenticated.
 *
 * Strategy: local-first. Dirty records are pushed up. Remote records
 * are pulled down and merged (remote wins on conflict for simplicity;
 * future: last-write-wins with updated_at).
 */

import type Database from '@tauri-apps/plugin-sql';
import { supabase } from './supabaseClient';
import type { Run, Goal, ActivePlan, TrainingPlan } from '../types';
import { saveSettings } from './settingsService';

export async function syncToCloud(db: Database): Promise<void> {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) return;

  await pushDirtyRuns(db, session.user.id);
  await pushDirtyGoals(db, session.user.id);
  await pushDirtyActivePlan(db, session.user.id);
  await pushDirtyCustomPlans(db, session.user.id);

  await saveSettings(db, { last_sync_at: new Date().toISOString() });
}

/**
 * Force-sync: resets all records back to 'local' so everything is re-uploaded.
 * Used by the manual "Sync Now" button to recover from previously failed syncs.
 */
export async function forceSyncToCloud(db: Database): Promise<void> {
  await db.execute("UPDATE runs SET sync_status='local'");
  await db.execute("UPDATE goals SET sync_status='local'");
  await db.execute("UPDATE active_plan SET sync_status='local'");
  await db.execute("UPDATE training_plans SET sync_status='local' WHERE is_builtin = 0");
  await syncToCloud(db);
}

async function pushDirtyRuns(db: Database, userId: string): Promise<void> {
  const dirty = await db.select<Run[]>("SELECT * FROM runs WHERE sync_status != 'synced'");
  for (const run of dirty) {
    // Only send columns that exist in user_runs (omit local-only sync_status)
    const { error } = await supabase.from('user_runs').upsert({
      id: run.id,
      user_id: userId,
      date: run.date,
      distance_value: run.distance_value,
      distance_unit: run.distance_unit,
      duration_seconds: run.duration_seconds,
      run_type: run.run_type,
      plan_day_id: run.plan_day_id,
      notes: run.notes,
      source: run.source,
      created_at: run.created_at,
      updated_at: run.updated_at,
    });
    if (error) {
      console.error('Failed to sync run', run.id, error.message);
    } else {
      await db.execute("UPDATE runs SET sync_status='synced' WHERE id=$1", [run.id]);
    }
  }
}

async function pushDirtyGoals(db: Database, userId: string): Promise<void> {
  const dirty = await db.select<Goal[]>("SELECT * FROM goals WHERE sync_status != 'synced'");
  for (const goal of dirty) {
    const { error } = await supabase.from('user_goals').upsert({
      id: goal.id,
      user_id: userId,
      type: goal.type,
      target_value: goal.target_value,
      target_unit: goal.target_unit,
      start_date: goal.start_date,
      end_date: goal.end_date,
      created_at: goal.created_at,
    });
    if (error) {
      console.error('Failed to sync goal', goal.id, error.message);
    } else {
      await db.execute("UPDATE goals SET sync_status='synced' WHERE id=$1", [goal.id]);
    }
  }
}

async function pushDirtyActivePlan(db: Database, userId: string): Promise<void> {
  const dirty = await db.select<ActivePlan[]>("SELECT * FROM active_plan WHERE sync_status != 'synced'");
  for (const ap of dirty) {
    const { error } = await supabase.from('active_plans').upsert({
      id: ap.id,
      user_id: userId,
      plan_id: ap.plan_id,
      start_date: ap.start_date,
      is_active: ap.is_active,
      created_at: ap.created_at,
    });
    if (error) {
      console.error('Failed to sync active plan', ap.id, error.message);
    } else {
      await db.execute("UPDATE active_plan SET sync_status='synced' WHERE id=$1", [ap.id]);
    }
  }
}

async function pushDirtyCustomPlans(db: Database, userId: string): Promise<void> {
  const dirty = await db.select<TrainingPlan[]>(
    "SELECT * FROM training_plans WHERE sync_status != 'synced' AND is_builtin = 0",
  );
  for (const plan of dirty) {
    const { error } = await supabase.from('training_plans').upsert({
      id: plan.id,
      user_id: userId,
      name: plan.name,
      description: plan.description,
      race_type: plan.race_type,
      difficulty: plan.difficulty,
      duration_weeks: plan.duration_weeks,
      created_at: plan.created_at,
    });
    if (error) {
      console.error('Failed to sync plan', plan.id, error.message);
    } else {
      await db.execute("UPDATE training_plans SET sync_status='synced' WHERE id=$1", [plan.id]);
    }
  }
}

/** Pull remote runs that don't exist locally (e.g. from another device) */
export async function pullFromCloud(db: Database): Promise<void> {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) return;

  const { data: remoteRuns } = await supabase
    .from('user_runs')
    .select('*')
    .eq('user_id', session.user.id);

  if (!remoteRuns) return;

  for (const run of remoteRuns) {
    const existing = await db.select<Run[]>('SELECT id FROM runs WHERE id=$1', [run.id]);
    if (existing.length === 0) {
      await db.execute(
        `INSERT INTO runs
          (id, date, distance_value, distance_unit, duration_seconds, run_type, plan_day_id, notes, source, created_at, updated_at, sync_status)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,'synced')`,
        [run.id, run.date, run.distance_value, run.distance_unit, run.duration_seconds,
         run.run_type, run.plan_day_id, run.notes, run.source, run.created_at, run.updated_at],
      );
    }
  }
}

