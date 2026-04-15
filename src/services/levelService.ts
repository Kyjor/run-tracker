import type Database from '@tauri-apps/plugin-sql';

export interface UserLevel {
  level: number;
  xp: number;
  total_xp: number;
  updated_at: string;
}

// XP required per level (exponential growth)
const XP_PER_LEVEL = 100;
const XP_MULTIPLIER = 1.5;

export function getXPForLevel(level: number): number {
  if (level === 1) return 0;
  let total = 0;
  for (let i = 2; i <= level; i++) {
    total += Math.floor(XP_PER_LEVEL * Math.pow(XP_MULTIPLIER, i - 2));
  }
  return total;
}

export function getLevelFromXP(totalXP: number): { level: number; xp: number; xpForNextLevel: number } {
  let level = 1;
  let xp = totalXP;
  let xpForNextLevel = XP_PER_LEVEL;

  while (xp >= xpForNextLevel) {
    xp -= xpForNextLevel;
    level++;
    xpForNextLevel = Math.floor(XP_PER_LEVEL * Math.pow(XP_MULTIPLIER, level - 2));
  }

  return { level, xp, xpForNextLevel };
}

export async function getUserLevel(db: Database): Promise<UserLevel> {
  const rows = await db.select<UserLevel[]>('SELECT * FROM user_level LIMIT 1');
  if (rows.length > 0) {
    return rows[0];
  }

  // Initialize if doesn't exist
  const now = new Date().toISOString();
  const initial: UserLevel = {
    level: 1,
    xp: 0,
    total_xp: 0,
    updated_at: now,
  };

  await db.execute(
    'INSERT INTO user_level (level, xp, total_xp, updated_at) VALUES ($1, $2, $3, $4)',
    [initial.level, initial.xp, initial.total_xp, initial.updated_at],
  );

  return initial;
}

export async function addXP(db: Database, amount: number): Promise<{ level: number; xp: number; leveledUp: boolean; newLevel?: number }> {
  const current = await getUserLevel(db);
  const newTotalXP = current.total_xp + amount;
  const { level: newLevel, xp: newXP } = getLevelFromXP(newTotalXP);
  const leveledUp = newLevel > current.level;

  await db.execute(
    'UPDATE user_level SET level = $1, xp = $2, total_xp = $3, updated_at = $4',
    [newLevel, newXP, newTotalXP, new Date().toISOString()],
  );

  return {
    level: newLevel,
    xp: newXP,
    leveledUp,
    newLevel: leveledUp ? newLevel : undefined,
  };
}

