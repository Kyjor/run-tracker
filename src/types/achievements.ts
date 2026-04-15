export type AchievementKey =
  | 'first_run'
  | 'first_week'
  | 'streak_7'
  | 'streak_14'
  | 'streak_30'
  | 'streak_100'
  | 'goal_achieved'
  | 'plan_completed'
  | 'total_runs_10'
  | 'total_runs_50'
  | 'total_runs_100'
  | 'total_distance_100'
  | 'total_distance_500'
  | 'total_distance_1000'
  | 'longest_run_5'
  | 'longest_run_10'
  | 'longest_run_13'
  | 'longest_run_26';

export interface Achievement {
  id: string;
  achievement_key: AchievementKey;
  unlocked_at: string | null;
  progress: number;
  max_progress: number;
  created_at: string;
  updated_at: string;
}

export interface AchievementDefinition {
  key: AchievementKey;
  title: string;
  description: string;
  emoji: string;
  maxProgress: number;
  xpReward: number;
}

export const ACHIEVEMENT_DEFINITIONS: Record<AchievementKey, AchievementDefinition> = {
  first_run: {
    key: 'first_run',
    title: 'First Steps',
    description: 'Complete your first run',
    emoji: '👟',
    maxProgress: 1,
    xpReward: 10,
  },
  first_week: {
    key: 'first_week',
    title: 'Week Warrior',
    description: 'Complete a full week of training',
    emoji: '📅',
    maxProgress: 1,
    xpReward: 25,
  },
  streak_7: {
    key: 'streak_7',
    title: 'Week Streak',
    description: 'Maintain a 7-day streak',
    emoji: '🔥',
    maxProgress: 7,
    xpReward: 50,
  },
  streak_14: {
    key: 'streak_14',
    title: 'Two Week Champion',
    description: 'Maintain a 14-day streak',
    emoji: '💪',
    maxProgress: 14,
    xpReward: 100,
  },
  streak_30: {
    key: 'streak_30',
    title: 'Monthly Master',
    description: 'Maintain a 30-day streak',
    emoji: '⭐',
    maxProgress: 30,
    xpReward: 250,
  },
  streak_100: {
    key: 'streak_100',
    title: 'Century Streak',
    description: 'Maintain a 100-day streak',
    emoji: '👑',
    maxProgress: 100,
    xpReward: 1000,
  },
  goal_achieved: {
    key: 'goal_achieved',
    title: 'Goal Crusher',
    description: 'Achieve any goal',
    emoji: '🎯',
    maxProgress: 1,
    xpReward: 30,
  },
  plan_completed: {
    key: 'plan_completed',
    title: 'Plan Finisher',
    description: 'Complete a training plan',
    emoji: '🏁',
    maxProgress: 1,
    xpReward: 200,
  },
  total_runs_10: {
    key: 'total_runs_10',
    title: 'Getting Started',
    description: 'Complete 10 runs',
    emoji: '🏃',
    maxProgress: 10,
    xpReward: 20,
  },
  total_runs_50: {
    key: 'total_runs_50',
    title: 'Dedicated Runner',
    description: 'Complete 50 runs',
    emoji: '🏃‍♂️',
    maxProgress: 50,
    xpReward: 75,
  },
  total_runs_100: {
    key: 'total_runs_100',
    title: 'Century Runner',
    description: 'Complete 100 runs',
    emoji: '🏃‍♀️',
    maxProgress: 100,
    xpReward: 200,
  },
  total_distance_100: {
    key: 'total_distance_100',
    title: 'Century Club',
    description: 'Run 100 miles total',
    emoji: '📏',
    maxProgress: 100,
    xpReward: 100,
  },
  total_distance_500: {
    key: 'total_distance_500',
    title: 'Half K',
    description: 'Run 500 miles total',
    emoji: '🗺️',
    maxProgress: 500,
    xpReward: 500,
  },
  total_distance_1000: {
    key: 'total_distance_1000',
    title: 'Mile Master',
    description: 'Run 1000 miles total',
    emoji: '🌍',
    maxProgress: 1000,
    xpReward: 1000,
  },
  longest_run_5: {
    key: 'longest_run_5',
    title: '5K Runner',
    description: 'Complete a 5K run',
    emoji: '🎖️',
    maxProgress: 5,
    xpReward: 25,
  },
  longest_run_10: {
    key: 'longest_run_10',
    title: '10K Runner',
    description: 'Complete a 10K run',
    emoji: '🥇',
    maxProgress: 10,
    xpReward: 50,
  },
  longest_run_13: {
    key: 'longest_run_13',
    title: 'Half Marathoner',
    description: 'Complete a half marathon',
    emoji: '🏅',
    maxProgress: 13.1,
    xpReward: 150,
  },
  longest_run_26: {
    key: 'longest_run_26',
    title: 'Marathoner',
    description: 'Complete a marathon',
    emoji: '🏆',
    maxProgress: 26.2,
    xpReward: 500,
  },
};

