import type Database from '@tauri-apps/plugin-sql';
import type { Achievement, AchievementKey } from '../types/achievements';
import { ACHIEVEMENT_DEFINITIONS } from '../types/achievements';
import { generateId } from '../utils/generateId';
import type { Run, RunStats } from '../types';

export async function getAchievements(db: Database): Promise<Achievement[]> {
  return db.select<Achievement[]>('SELECT * FROM achievements ORDER BY unlocked_at DESC, created_at ASC');
}

export async function getAchievement(db: Database, key: AchievementKey): Promise<Achievement | null> {
  const rows = await db.select<Achievement[]>('SELECT * FROM achievements WHERE achievement_key = $1', [key]);
  return rows[0] ?? null;
}

export async function updateAchievementProgress(
  db: Database,
  key: AchievementKey,
  progress: number,
): Promise<Achievement> {
  const existing = await getAchievement(db, key);
  const def = ACHIEVEMENT_DEFINITIONS[key];
  const now = new Date().toISOString();
  const isUnlocked = progress >= def.maxProgress;

  if (existing) {
    // Don't update if already unlocked
    if (existing.unlocked_at) {
      return existing;
    }

    await db.execute(
      'UPDATE achievements SET progress = $1, unlocked_at = $2, updated_at = $3 WHERE achievement_key = $4',
      [progress, isUnlocked ? now : null, now, key],
    );

    const updated = await getAchievement(db, key);
    if (!updated) throw new Error('Failed to update achievement');
    return updated;
  } else {
    const id = generateId();
    await db.execute(
      'INSERT INTO achievements (id, achievement_key, progress, max_progress, unlocked_at, created_at, updated_at) VALUES ($1, $2, $3, $4, $5, $6, $7)',
      [id, key, progress, def.maxProgress, isUnlocked ? now : null, now, now],
    );

    const created = await getAchievement(db, key);
    if (!created) throw new Error('Failed to create achievement');
    return created;
  }
}

export async function checkAndUpdateAchievements(
  db: Database,
  stats: RunStats,
  _runs: Run[],
  unit: 'mi' | 'km',
): Promise<Achievement[]> {
  const newlyUnlocked: Achievement[] = [];
  const now = Date.now();

  // First run
  if (stats.total_runs >= 1) {
    const existing = await getAchievement(db, 'first_run');
    const ach = await updateAchievementProgress(db, 'first_run', 1);
    // Check if just unlocked (unlocked_at is recent)
    if (ach.unlocked_at && (!existing || !existing.unlocked_at)) {
      const unlockedTime = new Date(ach.unlocked_at).getTime();
      if (unlockedTime > now - 10000) { // Within last 10 seconds
        newlyUnlocked.push(ach);
      }
    }
  }

  // Total runs achievements
  if (stats.total_runs >= 10) {
    const existing = await getAchievement(db, 'total_runs_10');
    const ach = await updateAchievementProgress(db, 'total_runs_10', stats.total_runs);
    if (ach.unlocked_at && (!existing || !existing.unlocked_at)) {
      const unlockedTime = new Date(ach.unlocked_at).getTime();
      if (unlockedTime > now - 10000) newlyUnlocked.push(ach);
    }
  }
  if (stats.total_runs >= 50) {
    const existing = await getAchievement(db, 'total_runs_50');
    const ach = await updateAchievementProgress(db, 'total_runs_50', stats.total_runs);
    if (ach.unlocked_at && (!existing || !existing.unlocked_at)) {
      const unlockedTime = new Date(ach.unlocked_at).getTime();
      if (unlockedTime > now - 10000) newlyUnlocked.push(ach);
    }
  }
  if (stats.total_runs >= 100) {
    const existing = await getAchievement(db, 'total_runs_100');
    const ach = await updateAchievementProgress(db, 'total_runs_100', stats.total_runs);
    if (ach.unlocked_at && (!existing || !existing.unlocked_at)) {
      const unlockedTime = new Date(ach.unlocked_at).getTime();
      if (unlockedTime > now - 10000) newlyUnlocked.push(ach);
    }
  }

  // Distance achievements (convert to miles for consistency)
  const totalMiles = unit === 'mi' ? stats.total_distance : stats.total_distance * 0.621371;
  if (totalMiles >= 100) {
    const existing = await getAchievement(db, 'total_distance_100');
    const ach = await updateAchievementProgress(db, 'total_distance_100', Math.round(totalMiles));
    if (ach.unlocked_at && (!existing || !existing.unlocked_at)) {
      const unlockedTime = new Date(ach.unlocked_at).getTime();
      if (unlockedTime > now - 10000) newlyUnlocked.push(ach);
    }
  }
  if (totalMiles >= 500) {
    const existing = await getAchievement(db, 'total_distance_500');
    const ach = await updateAchievementProgress(db, 'total_distance_500', Math.round(totalMiles));
    if (ach.unlocked_at && (!existing || !existing.unlocked_at)) {
      const unlockedTime = new Date(ach.unlocked_at).getTime();
      if (unlockedTime > now - 10000) newlyUnlocked.push(ach);
    }
  }
  if (totalMiles >= 1000) {
    const existing = await getAchievement(db, 'total_distance_1000');
    const ach = await updateAchievementProgress(db, 'total_distance_1000', Math.round(totalMiles));
    if (ach.unlocked_at && (!existing || !existing.unlocked_at)) {
      const unlockedTime = new Date(ach.unlocked_at).getTime();
      if (unlockedTime > now - 10000) newlyUnlocked.push(ach);
    }
  }

  // Longest run achievements
  const longestMiles = unit === 'mi' ? stats.longest_run_distance : stats.longest_run_distance * 0.621371;
  if (longestMiles >= 5) {
    const existing = await getAchievement(db, 'longest_run_5');
    const ach = await updateAchievementProgress(db, 'longest_run_5', Math.round(longestMiles * 10) / 10);
    if (ach.unlocked_at && (!existing || !existing.unlocked_at)) {
      const unlockedTime = new Date(ach.unlocked_at).getTime();
      if (unlockedTime > now - 10000) newlyUnlocked.push(ach);
    }
  }
  if (longestMiles >= 10) {
    const existing = await getAchievement(db, 'longest_run_10');
    const ach = await updateAchievementProgress(db, 'longest_run_10', Math.round(longestMiles * 10) / 10);
    if (ach.unlocked_at && (!existing || !existing.unlocked_at)) {
      const unlockedTime = new Date(ach.unlocked_at).getTime();
      if (unlockedTime > now - 10000) newlyUnlocked.push(ach);
    }
  }
  if (longestMiles >= 13.1) {
    const existing = await getAchievement(db, 'longest_run_13');
    const ach = await updateAchievementProgress(db, 'longest_run_13', Math.round(longestMiles * 10) / 10);
    if (ach.unlocked_at && (!existing || !existing.unlocked_at)) {
      const unlockedTime = new Date(ach.unlocked_at).getTime();
      if (unlockedTime > now - 10000) newlyUnlocked.push(ach);
    }
  }
  if (longestMiles >= 26.2) {
    const existing = await getAchievement(db, 'longest_run_26');
    const ach = await updateAchievementProgress(db, 'longest_run_26', Math.round(longestMiles * 10) / 10);
    if (ach.unlocked_at && (!existing || !existing.unlocked_at)) {
      const unlockedTime = new Date(ach.unlocked_at).getTime();
      if (unlockedTime > now - 10000) newlyUnlocked.push(ach);
    }
  }

  // Streak achievements
  if (stats.current_streak >= 7) {
    const existing = await getAchievement(db, 'streak_7');
    const ach = await updateAchievementProgress(db, 'streak_7', stats.current_streak);
    if (ach.unlocked_at && (!existing || !existing.unlocked_at)) {
      const unlockedTime = new Date(ach.unlocked_at).getTime();
      if (unlockedTime > now - 10000) newlyUnlocked.push(ach);
    }
  }
  if (stats.current_streak >= 14) {
    const existing = await getAchievement(db, 'streak_14');
    const ach = await updateAchievementProgress(db, 'streak_14', stats.current_streak);
    if (ach.unlocked_at && (!existing || !existing.unlocked_at)) {
      const unlockedTime = new Date(ach.unlocked_at).getTime();
      if (unlockedTime > now - 10000) newlyUnlocked.push(ach);
    }
  }
  if (stats.current_streak >= 30) {
    const existing = await getAchievement(db, 'streak_30');
    const ach = await updateAchievementProgress(db, 'streak_30', stats.current_streak);
    if (ach.unlocked_at && (!existing || !existing.unlocked_at)) {
      const unlockedTime = new Date(ach.unlocked_at).getTime();
      if (unlockedTime > now - 10000) newlyUnlocked.push(ach);
    }
  }
  if (stats.current_streak >= 100) {
    const existing = await getAchievement(db, 'streak_100');
    const ach = await updateAchievementProgress(db, 'streak_100', stats.current_streak);
    if (ach.unlocked_at && (!existing || !existing.unlocked_at)) {
      const unlockedTime = new Date(ach.unlocked_at).getTime();
      if (unlockedTime > now - 10000) newlyUnlocked.push(ach);
    }
  }

  return newlyUnlocked;
}

