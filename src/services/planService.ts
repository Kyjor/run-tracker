import type Database from '@tauri-apps/plugin-sql';
import type { TrainingPlan, PlanDay, ActivePlan, RaceType, Difficulty, PlanExportFormat } from '../types';
import { generateId } from '../utils/generateId';

// ---------------------------------------------------------------------------
// Training Plans
// ---------------------------------------------------------------------------

export async function getAllPlans(db: Database): Promise<TrainingPlan[]> {
  return db.select<TrainingPlan[]>('SELECT * FROM training_plans ORDER BY race_type, difficulty');
}

export async function getPlanById(db: Database, id: string): Promise<TrainingPlan | null> {
  const rows = await db.select<TrainingPlan[]>('SELECT * FROM training_plans WHERE id = $1', [id]);
  return rows[0] ?? null;
}

export async function getPlansByRaceType(db: Database, raceType: RaceType): Promise<TrainingPlan[]> {
  return db.select<TrainingPlan[]>(
    'SELECT * FROM training_plans WHERE race_type = $1 ORDER BY difficulty',
    [raceType],
  );
}

export async function createCustomPlan(
  db: Database,
  data: {
    name: string;
    race_type: RaceType;
    difficulty: Difficulty;
    description: string;
    duration_weeks: number;
  },
): Promise<string> {
  const id = generateId();
  const now = new Date().toISOString();
  await db.execute(
    `INSERT INTO training_plans
      (id, name, race_type, difficulty, description, duration_weeks, is_builtin, created_at, updated_at, sync_status)
     VALUES ($1,$2,$3,$4,$5,$6,0,$7,$7,'dirty')`,
    [id, data.name, data.race_type, data.difficulty, data.description, data.duration_weeks, now],
  );
  return id;
}

export async function updatePlan(
  db: Database,
  id: string,
  data: Partial<Pick<TrainingPlan, 'name' | 'description' | 'difficulty'>>,
): Promise<void> {
  const now = new Date().toISOString();
  if (data.name !== undefined) {
    await db.execute(
      "UPDATE training_plans SET name=$1, updated_at=$2, sync_status='dirty' WHERE id=$3",
      [data.name, now, id],
    );
  }
  if (data.description !== undefined) {
    await db.execute(
      "UPDATE training_plans SET description=$1, updated_at=$2, sync_status='dirty' WHERE id=$3",
      [data.description, now, id],
    );
  }
  if (data.difficulty !== undefined) {
    await db.execute(
      "UPDATE training_plans SET difficulty=$1, updated_at=$2, sync_status='dirty' WHERE id=$3",
      [data.difficulty, now, id],
    );
  }
}

export async function deletePlan(db: Database, id: string): Promise<void> {
  await db.execute('DELETE FROM training_plans WHERE id = $1 AND is_builtin = 0', [id]);
}

// ---------------------------------------------------------------------------
// Plan Days
// ---------------------------------------------------------------------------

export async function getPlanDays(db: Database, planId: string): Promise<PlanDay[]> {
  return db.select<PlanDay[]>(
    'SELECT * FROM plan_days WHERE plan_id = $1 ORDER BY week_number, day_of_week',
    [planId],
  );
}

export async function getPlanDayForDate(
  db: Database,
  planId: string,
  weekNumber: number,
  dayOfWeek: number,
): Promise<PlanDay | null> {
  const rows = await db.select<PlanDay[]>(
    'SELECT * FROM plan_days WHERE plan_id=$1 AND week_number=$2 AND day_of_week=$3',
    [planId, weekNumber, dayOfWeek],
  );
  return rows[0] ?? null;
}

export async function upsertPlanDay(db: Database, day: PlanDay): Promise<void> {
  await db.execute(
    `INSERT INTO plan_days
      (id, plan_id, week_number, day_of_week, activity_type, distance_value, distance_unit, duration_minutes, description)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
     ON CONFLICT(id) DO UPDATE SET
       activity_type=$5, distance_value=$6, distance_unit=$7, duration_minutes=$8, description=$9`,
    [day.id, day.plan_id, day.week_number, day.day_of_week, day.activity_type,
     day.distance_value, day.distance_unit, day.duration_minutes, day.description],
  );
}

export async function updatePlanDay(
  db: Database,
  id: string,
  data: {
    activity_type: PlanDay['activity_type'];
    distance_value: number | null;
    distance_unit: PlanDay['distance_unit'];
    duration_minutes: number | null;
    description: string;
    workout_segments?: string | null;
    week_number?: number;
    day_of_week?: number;
  },
): Promise<void> {
  if (data.week_number !== undefined && data.day_of_week !== undefined) {
    await db.execute(
      `UPDATE plan_days
         SET activity_type=$1, distance_value=$2, distance_unit=$3,
             duration_minutes=$4, description=$5, workout_segments=$6,
             week_number=$7, day_of_week=$8
       WHERE id=$9`,
      [data.activity_type, data.distance_value, data.distance_unit,
       data.duration_minutes, data.description, data.workout_segments ?? null,
       data.week_number, data.day_of_week, id],
    );
  } else {
    await db.execute(
      `UPDATE plan_days
         SET activity_type=$1, distance_value=$2, distance_unit=$3,
             duration_minutes=$4, description=$5, workout_segments=$6
       WHERE id=$7`,
      [data.activity_type, data.distance_value, data.distance_unit,
       data.duration_minutes, data.description, data.workout_segments ?? null, id],
    );
  }

  // Mark any active_plan that references this plan as dirty so it will be re-synced
  const rows = await db.select<{ plan_id: string }[]>(
    'SELECT plan_id FROM plan_days WHERE id = $1',
    [id],
  );
  if (rows.length > 0) {
    await db.execute(
      "UPDATE active_plan SET sync_status='dirty' WHERE plan_id = $1",
      [rows[0].plan_id],
    );
  }
}

/**
 * Swap two plan days' positions (week_number / day_of_week).
 * Used when moving a plan day to a slot that already has another plan day.
 */
export async function swapPlanDayPositions(
  db: Database,
  dayA: PlanDay,
  dayB: PlanDay,
): Promise<void> {
  // Temporarily move A to an impossible slot to avoid unique constraint issues
  await db.execute(
    'UPDATE plan_days SET week_number=-1, day_of_week=-1 WHERE id=$1',
    [dayA.id],
  );
  await db.execute(
    'UPDATE plan_days SET week_number=$1, day_of_week=$2 WHERE id=$3',
    [dayA.week_number, dayA.day_of_week, dayB.id],
  );
  await db.execute(
    'UPDATE plan_days SET week_number=$1, day_of_week=$2 WHERE id=$3',
    [dayB.week_number, dayB.day_of_week, dayA.id],
  );

  // Mark any active plan using this plan as dirty so updated positions sync
  await db.execute(
    "UPDATE active_plan SET sync_status='dirty' WHERE plan_id = $1",
    [dayA.plan_id],
  );
}

export async function deletePlanDay(db: Database, dayId: string): Promise<void> {
  // Capture plan_id before delete so we can mark active plan dirty
  const rows = await db.select<{ plan_id: string }[]>(
    'SELECT plan_id FROM plan_days WHERE id = $1',
    [dayId],
  );
  await db.execute('DELETE FROM plan_days WHERE id = $1', [dayId]);
  if (rows.length > 0) {
    await db.execute(
      "UPDATE active_plan SET sync_status='dirty' WHERE plan_id = $1",
      [rows[0].plan_id],
    );
  }
}

// ---------------------------------------------------------------------------
// Active Plan
// ---------------------------------------------------------------------------

export async function getActivePlan(db: Database): Promise<ActivePlan | null> {
  const rows = await db.select<ActivePlan[]>(
    'SELECT * FROM active_plan WHERE is_active = 1 ORDER BY created_at DESC LIMIT 1',
  );
  return rows[0] ?? null;
}

export async function setActivePlan(db: Database, planId: string, startDate: string): Promise<void> {
  const now = new Date().toISOString();
  // Deactivate any existing active plan and mark as dirty so it syncs
  await db.execute("UPDATE active_plan SET is_active = 0, sync_status='dirty' WHERE is_active = 1");
  // Check if this plan already has an active_plan row
  const existing = await db.select<ActivePlan[]>(
    'SELECT * FROM active_plan WHERE plan_id = $1',
    [planId],
  );
  if (existing.length > 0) {
    await db.execute(
      "UPDATE active_plan SET start_date=$1, is_active=1, sync_status='dirty' WHERE plan_id=$2",
      [startDate, planId],
    );
  } else {
    const id = generateId();
    await db.execute(
      `INSERT INTO active_plan (id, plan_id, start_date, is_active, created_at, sync_status)
       VALUES ($1,$2,$3,1,$4,'dirty')`,
      [id, planId, startDate, now],
    );
  }

  // Publish feed activity and sync to cloud
  const plan = await getPlanById(db, planId);
  if (plan) {
    const { publishFeedActivity } = await import('./socialService');
    await publishFeedActivity('plan_started', {
      plan_id: planId,
      plan_name: plan.name,
      start_date: startDate,
    });

    // Trigger immediate sync so friends can see the active plan
    const { syncToCloud } = await import('./syncService');
    syncToCloud(db).catch((e) => {
      console.error('Failed to sync active plan after activation:', e);
    });
  }
}

export async function clearActivePlan(db: Database): Promise<void> {
  await db.execute("UPDATE active_plan SET is_active = 0");
}

// ---------------------------------------------------------------------------
// Import / Export
// ---------------------------------------------------------------------------

export async function importPlanFromExport(db: Database, data: PlanExportFormat): Promise<string> {
  const now = new Date().toISOString();
  const planId = generateId();
  const { plan } = data;

  await db.execute(
    `INSERT INTO training_plans
      (id, name, race_type, difficulty, description, duration_weeks, is_builtin, created_at, updated_at, sync_status)
     VALUES ($1,$2,$3,$4,$5,$6,0,$7,$7,'dirty')`,
    [planId, plan.name, plan.race_type, plan.difficulty, plan.description, plan.duration_weeks, now],
  );

  for (const week of plan.schedule) {
    for (const day of week.days) {
      const dayId = generateId();
      await db.execute(
        `INSERT INTO plan_days
          (id, plan_id, week_number, day_of_week, activity_type, distance_value, distance_unit, duration_minutes, description)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
        [dayId, planId, week.week, day.day, day.type,
         day.distance ?? null, day.distance_unit ?? 'mi', day.duration ?? null, day.description ?? ''],
      );
    }
  }

  return planId;
}

export async function exportPlanToFormat(db: Database, planId: string): Promise<PlanExportFormat> {
  const plan = await getPlanById(db, planId);
  if (!plan) throw new Error(`Plan ${planId} not found`);
  const days = await getPlanDays(db, planId);

  const weekMap: Record<number, typeof days> = {};
  for (const day of days) {
    if (!weekMap[day.week_number]) weekMap[day.week_number] = [];
    weekMap[day.week_number].push(day);
  }

  return {
    version: 1,
    plan: {
      name: plan.name,
      race_type: plan.race_type,
      difficulty: plan.difficulty,
      description: plan.description,
      duration_weeks: plan.duration_weeks,
      schedule: Object.keys(weekMap).map(Number).sort((a, b) => a - b).map(w => ({
        week: w,
        days: weekMap[w].sort((a, b) => a.day_of_week - b.day_of_week).map(d => ({
          day: d.day_of_week,
          type: d.activity_type,
          distance: d.distance_value ?? undefined,
          distance_unit: d.distance_unit,
          duration: d.duration_minutes ?? undefined,
          description: d.description,
        })),
      })),
    },
  };
}

