import type { TrainingPlan, PlanDay, ActivityType, RaceType, Difficulty } from '../types';

// ---------------------------------------------------------------------------
// Helper to build plan days concisely
// ---------------------------------------------------------------------------

type DaySpec = [
  activityType: ActivityType,
  distanceMi?: number | null,
  durationMin?: number | null,
  description?: string,
];

function buildDays(
  planId: string,
  schedule: DaySpec[][],
): PlanDay[] {
  const days: PlanDay[] = [];
  schedule.forEach((week, wi) => {
    week.forEach((day, di) => {
      const [type, dist, dur, desc] = day;
      days.push({
        id: `${planId}-w${wi + 1}d${di}`,
        plan_id: planId,
        week_number: wi + 1,
        day_of_week: di, // 0=Mon … 6=Sun
        activity_type: type,
        distance_value: dist ?? null,
        distance_unit: 'mi',
        duration_minutes: dur ?? null,
        description: desc ?? '',
      });
    });
  });
  return days;
}

function buildPlan(
  id: string,
  name: string,
  race_type: RaceType,
  difficulty: Difficulty,
  description: string,
  duration_weeks: number,
): TrainingPlan {
  const now = new Date().toISOString();
  return {
    id,
    name,
    race_type,
    difficulty,
    description,
    duration_weeks,
    is_builtin: 1,
    created_at: now,
    updated_at: now,
    sync_status: 'local',
  };
}

// ---------------------------------------------------------------------------
// 5K Plans
// ---------------------------------------------------------------------------

const PLAN_5K_BEG_ID = 'builtin-5k-beg';
export const PLAN_5K_BEG = buildPlan(
  PLAN_5K_BEG_ID,
  'Couch to 5K',
  '5k',
  'beginner',
  'A gentle 8-week program taking you from walking to running your first 5K.',
  8,
);
export const PLAN_5K_BEG_DAYS = buildDays(PLAN_5K_BEG_ID, [
  // Week 1
  [['easy_run', 1.5], ['rest'], ['easy_run', 1.5], ['rest'], ['easy_run', 1.5], ['rest'], ['rest']],
  // Week 2
  [['easy_run', 2.0], ['rest'], ['easy_run', 2.0], ['rest'], ['easy_run', 2.0], ['rest'], ['rest']],
  // Week 3
  [['easy_run', 2.5], ['rest'], ['easy_run', 2.5], ['cross_training', null, 30], ['easy_run', 2.5], ['rest'], ['rest']],
  // Week 4
  [['easy_run', 2.5], ['rest'], ['easy_run', 3.0], ['cross_training', null, 30], ['easy_run', 2.5], ['rest'], ['rest']],
  // Week 5
  [['easy_run', 2.5], ['cross_training', null, 30], ['easy_run', 3.0], ['rest'], ['easy_run', 3.0], ['rest'], ['rest']],
  // Week 6
  [['easy_run', 3.0], ['cross_training', null, 30], ['easy_run', 3.0], ['rest'], ['easy_run', 3.0], ['rest'], ['rest']],
  // Week 7
  [['easy_run', 3.0], ['cross_training', null, 30], ['pace_run', 3.0], ['rest'], ['easy_run', 3.1], ['rest'], ['rest']],
  // Week 8 — Race week
  [['easy_run', 2.0], ['rest'], ['easy_run', 2.0], ['rest'], ['rest'], ['race', 3.1, null, '5K Race Day!'], ['rest']],
].map(w => w.map(d => d as DaySpec)));

const PLAN_5K_INT_ID = 'builtin-5k-int';
export const PLAN_5K_INT = buildPlan(
  PLAN_5K_INT_ID,
  '5K Speed Builder',
  '5k',
  'intermediate',
  'An 8-week plan to improve your 5K time with tempo and interval work.',
  8,
);
export const PLAN_5K_INT_DAYS = buildDays(PLAN_5K_INT_ID, [
  [['easy_run', 3], ['intervals', 3], ['rest'], ['easy_run', 3], ['rest'], ['easy_run', 4], ['rest']],
  [['easy_run', 3], ['intervals', 3], ['rest'], ['easy_run', 3], ['rest'], ['easy_run', 4.5], ['rest']],
  [['easy_run', 3], ['tempo_run', 3], ['rest'], ['easy_run', 4], ['rest'], ['easy_run', 5], ['rest']],
  [['easy_run', 3], ['intervals', 4], ['rest'], ['easy_run', 3], ['rest'], ['easy_run', 5], ['rest']],
  [['easy_run', 3], ['tempo_run', 3.5], ['rest'], ['easy_run', 4], ['rest'], ['easy_run', 5.5], ['rest']],
  [['easy_run', 4], ['intervals', 4], ['rest'], ['easy_run', 4], ['rest'], ['easy_run', 6], ['rest']],
  [['easy_run', 3], ['tempo_run', 3], ['rest'], ['easy_run', 3], ['rest'], ['easy_run', 4], ['rest']],
  [['easy_run', 2], ['rest'], ['easy_run', 2], ['rest'], ['rest'], ['race', 3.1, null, '5K Race Day!'], ['rest']],
].map(w => w.map(d => d as DaySpec)));

// ---------------------------------------------------------------------------
// 10K Plans
// ---------------------------------------------------------------------------

const PLAN_10K_BEG_ID = 'builtin-10k-beg';
export const PLAN_10K_BEG = buildPlan(
  PLAN_10K_BEG_ID,
  '10K for Beginners',
  '10k',
  'beginner',
  'A 10-week introductory plan to get you to the 10K finish line.',
  10,
);
export const PLAN_10K_BEG_DAYS = buildDays(PLAN_10K_BEG_ID, [
  [['easy_run', 2], ['rest'], ['easy_run', 2], ['rest'], ['easy_run', 2], ['rest'], ['rest']],
  [['easy_run', 2.5], ['rest'], ['easy_run', 2.5], ['rest'], ['easy_run', 2.5], ['rest'], ['rest']],
  [['easy_run', 3], ['rest'], ['easy_run', 3], ['cross_training', null, 30], ['easy_run', 3], ['rest'], ['rest']],
  [['easy_run', 3], ['rest'], ['easy_run', 3.5], ['cross_training', null, 30], ['easy_run', 3], ['rest'], ['rest']],
  [['easy_run', 3.5], ['cross_training', null, 30], ['easy_run', 4], ['rest'], ['easy_run', 3.5], ['rest'], ['rest']],
  [['easy_run', 3.5], ['cross_training', null, 30], ['easy_run', 4.5], ['rest'], ['easy_run', 4], ['rest'], ['rest']],
  [['easy_run', 4], ['cross_training', null, 30], ['easy_run', 5], ['rest'], ['easy_run', 4], ['rest'], ['rest']],
  [['easy_run', 4.5], ['cross_training', null, 30], ['easy_run', 5.5], ['rest'], ['easy_run', 4.5], ['rest'], ['rest']],
  [['easy_run', 4], ['cross_training', null, 30], ['pace_run', 4], ['rest'], ['easy_run', 4], ['rest'], ['rest']],
  [['easy_run', 3], ['rest'], ['easy_run', 2], ['rest'], ['rest'], ['race', 6.2, null, '10K Race Day!'], ['rest']],
].map(w => w.map(d => d as DaySpec)));

const PLAN_10K_INT_ID = 'builtin-10k-int';
export const PLAN_10K_INT = buildPlan(
  PLAN_10K_INT_ID,
  '10K Performance Plan',
  '10k',
  'intermediate',
  'A 10-week plan to race a faster 10K with structured speed work.',
  10,
);
export const PLAN_10K_INT_DAYS = buildDays(PLAN_10K_INT_ID, [
  [['easy_run', 4], ['intervals', 4], ['rest'], ['easy_run', 4], ['cross_training', null, 30], ['easy_run', 5], ['rest']],
  [['easy_run', 4], ['intervals', 4], ['rest'], ['easy_run', 4], ['cross_training', null, 30], ['easy_run', 6], ['rest']],
  [['easy_run', 4], ['tempo_run', 4], ['rest'], ['easy_run', 4], ['cross_training', null, 30], ['easy_run', 7], ['rest']],
  [['easy_run', 4], ['intervals', 5], ['rest'], ['easy_run', 4], ['cross_training', null, 30], ['easy_run', 7], ['rest']],
  [['easy_run', 4], ['tempo_run', 4.5], ['rest'], ['easy_run', 5], ['cross_training', null, 30], ['easy_run', 8], ['rest']],
  [['easy_run', 4], ['intervals', 5], ['rest'], ['easy_run', 5], ['cross_training', null, 30], ['easy_run', 8], ['rest']],
  [['easy_run', 4], ['tempo_run', 5], ['rest'], ['easy_run', 5], ['cross_training', null, 30], ['easy_run', 9], ['rest']],
  [['easy_run', 5], ['intervals', 5], ['rest'], ['easy_run', 5], ['cross_training', null, 30], ['easy_run', 9], ['rest']],
  [['easy_run', 4], ['tempo_run', 4], ['rest'], ['easy_run', 4], ['rest'], ['easy_run', 6], ['rest']],
  [['easy_run', 3], ['rest'], ['easy_run', 2], ['rest'], ['rest'], ['race', 6.2, null, '10K Race Day!'], ['rest']],
].map(w => w.map(d => d as DaySpec)));

// ---------------------------------------------------------------------------
// Half Marathon Plans
// ---------------------------------------------------------------------------

const PLAN_HM_BEG_ID = 'builtin-hm-beg';
export const PLAN_HM_BEG = buildPlan(
  PLAN_HM_BEG_ID,
  'First Half Marathon',
  'half_marathon',
  'beginner',
  'A 12-week first-timer plan to get you across that half marathon finish line.',
  12,
);
export const PLAN_HM_BEG_DAYS = buildDays(PLAN_HM_BEG_ID, [
  // W1: Mon rest | Tue 3 | Wed 2 cross | Thu 3 | Fri rest | Sat 30 cross | Sun 4
  [['rest'], ['easy_run', 3], ['cross_training', null, 30, '2 mi run or cross'], ['easy_run', 3], ['rest'], ['cross_training', null, 30], ['long_run', 4]],
  // W2: same as W1
  [['rest'], ['easy_run', 3], ['cross_training', null, 30, '2 mi run or cross'], ['easy_run', 3], ['rest'], ['cross_training', null, 30], ['long_run', 4]],
  // W3
  [['rest'], ['easy_run', 3.5], ['cross_training', null, 40, '2 mi run or cross'], ['easy_run', 3.5], ['rest'], ['cross_training', null, 40], ['long_run', 5]],
  // W4: same as W3
  [['rest'], ['easy_run', 3.5], ['cross_training', null, 40, '2 mi run or cross'], ['easy_run', 3.5], ['rest'], ['cross_training', null, 40], ['long_run', 5]],
  // W5
  [['rest'], ['easy_run', 4], ['cross_training', null, 40, '2 mi run or cross'], ['easy_run', 4], ['rest'], ['cross_training', null, 40], ['long_run', 6]],
  // W6: 5K race Sunday
  [['rest'], ['easy_run', 4], ['cross_training', null, 40, '2 mi run or cross'], ['easy_run', 4], ['easy_run', null, null, 'Rest or easy run'], ['rest'], ['race', 3.1, null, '5K Race']],
  // W7
  [['rest'], ['easy_run', 4.5], ['cross_training', null, 50, '3 mi run or cross'], ['easy_run', 4.5], ['rest'], ['cross_training', null, 50], ['long_run', 7]],
  // W8
  [['rest'], ['easy_run', 4.5], ['cross_training', null, 50, '3 mi run or cross'], ['easy_run', 4.5], ['rest'], ['cross_training', null, 50], ['long_run', 8]],
  // W9: 10K race Sunday
  [['rest'], ['easy_run', 5], ['cross_training', null, 50, '3 mi run or cross'], ['easy_run', 5], ['easy_run', null, null, 'Rest or easy run'], ['rest'], ['race', 6.2, null, '10K Race']],
  // W10
  [['rest'], ['easy_run', 5], ['cross_training', null, 60, '3 mi run or cross'], ['easy_run', 5], ['rest'], ['cross_training', null, 60], ['long_run', 9]],
  // W11
  [['rest'], ['easy_run', 5], ['cross_training', null, 60, '3 mi run or cross'], ['easy_run', 5], ['rest'], ['cross_training', null, 60], ['long_run', 10]],
  // W12: taper + race Sunday
  [['rest'], ['easy_run', 4], ['cross_training', null, 30, '3 mi run or cross'], ['easy_run', 2], ['rest'], ['rest'], ['race', 13.1, null, 'Half Marathon Race Day!']],
].map(w => w.map(d => d as DaySpec)));

const PLAN_HM_INT_ID = 'builtin-hm-int';
export const PLAN_HM_INT = buildPlan(
  PLAN_HM_INT_ID,
  'Half Marathon PR Plan',
  'half_marathon',
  'intermediate',
  'A 12-week plan with tempo runs and long runs to set your half marathon personal record.',
  12,
);
export const PLAN_HM_INT_DAYS = buildDays(PLAN_HM_INT_ID, [
  [['easy_run', 4], ['intervals', 4], ['easy_run', 4], ['rest'], ['pace_run', 4], ['long_run', 6], ['rest']],
  [['easy_run', 4], ['intervals', 5], ['easy_run', 4], ['rest'], ['pace_run', 4], ['long_run', 7], ['rest']],
  [['easy_run', 4], ['tempo_run', 4], ['easy_run', 5], ['rest'], ['pace_run', 5], ['long_run', 8], ['rest']],
  [['easy_run', 4], ['intervals', 5], ['easy_run', 4], ['rest'], ['pace_run', 4], ['long_run', 7], ['rest']],
  [['easy_run', 4], ['tempo_run', 5], ['easy_run', 5], ['rest'], ['pace_run', 5], ['long_run', 9], ['rest']],
  [['easy_run', 5], ['intervals', 6], ['easy_run', 5], ['rest'], ['pace_run', 5], ['long_run', 10], ['rest']],
  [['easy_run', 4], ['tempo_run', 4], ['easy_run', 4], ['rest'], ['pace_run', 4], ['long_run', 8], ['rest']],
  [['easy_run', 5], ['intervals', 6], ['easy_run', 5], ['rest'], ['pace_run', 5], ['long_run', 11], ['rest']],
  [['easy_run', 5], ['tempo_run', 5], ['easy_run', 5], ['rest'], ['pace_run', 5], ['long_run', 12], ['rest']],
  [['easy_run', 5], ['intervals', 6], ['easy_run', 5], ['rest'], ['pace_run', 5], ['long_run', 10], ['rest']],
  [['easy_run', 4], ['tempo_run', 4], ['easy_run', 4], ['rest'], ['pace_run', 3], ['long_run', 7], ['rest']],
  [['easy_run', 3], ['rest'], ['easy_run', 2], ['rest'], ['rest'], ['race', 13.1, null, 'Half Marathon Race Day!'], ['rest']],
].map(w => w.map(d => d as DaySpec)));

// ---------------------------------------------------------------------------
// Full Marathon Plans
// ---------------------------------------------------------------------------

const PLAN_FM_BEG_ID = 'builtin-fm-beg';
export const PLAN_FM_BEG = buildPlan(
  PLAN_FM_BEG_ID,
  'First Marathon',
  'full_marathon',
  'beginner',
  'An 18-week finish-line-focused plan. Your first 26.2 awaits.',
  18,
);
export const PLAN_FM_BEG_DAYS = buildDays(PLAN_FM_BEG_ID, [
  [['easy_run', 3], ['cross_training', null, 30], ['easy_run', 4], ['rest'], ['easy_run', 3], ['easy_run', 6], ['rest']],
  [['easy_run', 3], ['cross_training', null, 30], ['easy_run', 4], ['rest'], ['easy_run', 3], ['easy_run', 7], ['rest']],
  [['easy_run', 4], ['cross_training', null, 30], ['easy_run', 5], ['rest'], ['easy_run', 4], ['easy_run', 8], ['rest']],
  [['easy_run', 4], ['cross_training', null, 30], ['easy_run', 5], ['rest'], ['easy_run', 4], ['easy_run', 9], ['rest']],
  [['easy_run', 4], ['cross_training', null, 30], ['easy_run', 5], ['rest'], ['easy_run', 4], ['easy_run', 10], ['rest']],
  [['easy_run', 4], ['cross_training', null, 30], ['easy_run', 5], ['rest'], ['easy_run', 4], ['easy_run', 11], ['rest']],
  [['easy_run', 4], ['cross_training', null, 30], ['easy_run', 5], ['rest'], ['easy_run', 4], ['easy_run', 8], ['rest']],
  [['easy_run', 5], ['cross_training', null, 30], ['easy_run', 5], ['rest'], ['easy_run', 5], ['easy_run', 12], ['rest']],
  [['easy_run', 5], ['cross_training', null, 30], ['easy_run', 6], ['rest'], ['easy_run', 5], ['easy_run', 13], ['rest']],
  [['easy_run', 5], ['cross_training', null, 30], ['easy_run', 6], ['rest'], ['easy_run', 5], ['easy_run', 14], ['rest']],
  [['easy_run', 5], ['cross_training', null, 30], ['easy_run', 6], ['rest'], ['easy_run', 5], ['easy_run', 15], ['rest']],
  [['easy_run', 5], ['cross_training', null, 30], ['easy_run', 6], ['rest'], ['easy_run', 5], ['easy_run', 16], ['rest']],
  [['easy_run', 4], ['cross_training', null, 30], ['easy_run', 5], ['rest'], ['easy_run', 4], ['easy_run', 12], ['rest']],
  [['easy_run', 5], ['cross_training', null, 30], ['easy_run', 6], ['rest'], ['easy_run', 5], ['easy_run', 18], ['rest']],
  [['easy_run', 5], ['cross_training', null, 30], ['easy_run', 6], ['rest'], ['easy_run', 5], ['easy_run', 20], ['rest']],
  [['easy_run', 4], ['cross_training', null, 30], ['easy_run', 5], ['rest'], ['easy_run', 4], ['easy_run', 12], ['rest']],
  [['easy_run', 4], ['cross_training', null, 30], ['easy_run', 4], ['rest'], ['easy_run', 3], ['easy_run', 8], ['rest']],
  [['easy_run', 3], ['rest'], ['easy_run', 2], ['rest'], ['rest'], ['race', 26.2, null, 'Marathon Race Day!'], ['rest']],
].map(w => w.map(d => d as DaySpec)));

const PLAN_FM_INT_ID = 'builtin-fm-int';
export const PLAN_FM_INT = buildPlan(
  PLAN_FM_INT_ID,
  'Marathon PR Plan',
  'full_marathon',
  'intermediate',
  'An 18-week plan with structured quality runs to nail a marathon PR.',
  18,
);
export const PLAN_FM_INT_DAYS = buildDays(PLAN_FM_INT_ID, [
  [['easy_run', 5], ['intervals', 5], ['easy_run', 5], ['rest'], ['pace_run', 5], ['long_run', 10], ['rest']],
  [['easy_run', 5], ['intervals', 6], ['easy_run', 5], ['rest'], ['pace_run', 5], ['long_run', 11], ['rest']],
  [['easy_run', 5], ['tempo_run', 5], ['easy_run', 5], ['rest'], ['pace_run', 6], ['long_run', 12], ['rest']],
  [['easy_run', 5], ['intervals', 6], ['easy_run', 5], ['rest'], ['pace_run', 5], ['long_run', 10], ['rest']],
  [['easy_run', 5], ['tempo_run', 6], ['easy_run', 6], ['rest'], ['pace_run', 6], ['long_run', 13], ['rest']],
  [['easy_run', 5], ['intervals', 7], ['easy_run', 6], ['rest'], ['pace_run', 6], ['long_run', 14], ['rest']],
  [['easy_run', 5], ['tempo_run', 5], ['easy_run', 5], ['rest'], ['pace_run', 5], ['long_run', 11], ['rest']],
  [['easy_run', 5], ['intervals', 7], ['easy_run', 6], ['rest'], ['pace_run', 6], ['long_run', 15], ['rest']],
  [['easy_run', 5], ['tempo_run', 6], ['easy_run', 6], ['rest'], ['pace_run', 6], ['long_run', 16], ['rest']],
  [['easy_run', 5], ['intervals', 7], ['easy_run', 6], ['rest'], ['pace_run', 6], ['long_run', 17], ['rest']],
  [['easy_run', 5], ['tempo_run', 6], ['easy_run', 6], ['rest'], ['pace_run', 6], ['long_run', 18], ['rest']],
  [['easy_run', 5], ['intervals', 7], ['easy_run', 6], ['rest'], ['pace_run', 6], ['long_run', 19], ['rest']],
  [['easy_run', 5], ['tempo_run', 5], ['easy_run', 5], ['rest'], ['pace_run', 5], ['long_run', 14], ['rest']],
  [['easy_run', 5], ['intervals', 7], ['easy_run', 6], ['rest'], ['pace_run', 6], ['long_run', 20], ['rest']],
  [['easy_run', 5], ['tempo_run', 6], ['easy_run', 6], ['rest'], ['pace_run', 6], ['long_run', 20], ['rest']],
  [['easy_run', 5], ['intervals', 5], ['easy_run', 5], ['rest'], ['pace_run', 5], ['long_run', 13], ['rest']],
  [['easy_run', 4], ['tempo_run', 4], ['easy_run', 4], ['rest'], ['pace_run', 4], ['long_run', 8], ['rest']],
  [['easy_run', 3], ['rest'], ['easy_run', 2], ['rest'], ['rest'], ['race', 26.2, null, 'Marathon Race Day!'], ['rest']],
].map(w => w.map(d => d as DaySpec)));

// ---------------------------------------------------------------------------
// All built-in plans export
// ---------------------------------------------------------------------------

export interface SeedPlan {
  plan: TrainingPlan;
  days: PlanDay[];
}

export const BUILTIN_PLANS: SeedPlan[] = [
  { plan: PLAN_5K_BEG,  days: PLAN_5K_BEG_DAYS  },
  { plan: PLAN_5K_INT,  days: PLAN_5K_INT_DAYS  },
  { plan: PLAN_10K_BEG, days: PLAN_10K_BEG_DAYS },
  { plan: PLAN_10K_INT, days: PLAN_10K_INT_DAYS },
  { plan: PLAN_HM_BEG,  days: PLAN_HM_BEG_DAYS  },
  { plan: PLAN_HM_INT,  days: PLAN_HM_INT_DAYS  },
  { plan: PLAN_FM_BEG,  days: PLAN_FM_BEG_DAYS  },
  { plan: PLAN_FM_INT,  days: PLAN_FM_INT_DAYS  },
];

