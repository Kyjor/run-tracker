import type Database from '@tauri-apps/plugin-sql';
import type { Goal, GoalType, DistanceUnit, GoalProgress } from '../types';
import { generateId } from '../utils/generateId';
import { getRunsByDateRange } from './runService';
import { convertDistance } from '../utils/paceUtils';

export async function getGoals(db: Database): Promise<Goal[]> {
  return db.select<Goal[]>('SELECT * FROM goals ORDER BY created_at DESC');
}

export async function getActiveGoals(db: Database, date: string): Promise<Goal[]> {
  return db.select<Goal[]>(
    'SELECT * FROM goals WHERE start_date <= $1 AND end_date >= $1',
    [date],
  );
}

export async function createGoal(
  db: Database,
  data: { type: GoalType; target_value: number; target_unit: DistanceUnit; start_date: string; end_date: string },
): Promise<Goal> {
  const id = generateId();
  const now = new Date().toISOString();
  const goal: Goal = { id, ...data, created_at: now, sync_status: 'local' };
  await db.execute(
    `INSERT INTO goals (id, type, target_value, target_unit, start_date, end_date, created_at, sync_status)
     VALUES ($1,$2,$3,$4,$5,$6,$7,'local')`,
    [id, data.type, data.target_value, data.target_unit, data.start_date, data.end_date, now],
  );
  return goal;
}

export async function deleteGoal(db: Database, id: string): Promise<void> {
  await db.execute('DELETE FROM goals WHERE id = $1', [id]);
}

export async function getGoalProgress(db: Database, goal: Goal): Promise<GoalProgress> {
  const runs = await getRunsByDateRange(db, goal.start_date, goal.end_date);
  const current_value = runs.reduce((sum, r) => {
    const dist = convertDistance(r.distance_value, r.distance_unit, goal.target_unit);
    return sum + dist;
  }, 0);
  const percentage = Math.min(100, (current_value / goal.target_value) * 100);
  const remaining = Math.max(0, goal.target_value - current_value);
  return { goal, current_value, percentage, remaining };
}

