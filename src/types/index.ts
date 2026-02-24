// ============================================================
// Enums (string union types for SQLite compatibility)
// ============================================================

export type RaceType = '5k' | '10k' | 'half_marathon' | 'full_marathon' | 'other';

export type Difficulty = 'beginner' | 'intermediate' | 'advanced' | 'custom';

export type ActivityType =
  | 'rest'
  | 'cross_training'
  | 'easy_run'
  | 'pace_run'
  | 'tempo_run'
  | 'long_run'
  | 'intervals'
  | 'race';

export type RunType = 'easy_run' | 'pace_run' | 'tempo_run' | 'long_run' | 'intervals' | 'race' | 'other';

export type DistanceUnit = 'mi' | 'km';

export type GoalType = 'weekly' | 'monthly';

export type SyncStatus = 'local' | 'synced' | 'dirty';

export type DarkModePreference = 'system' | 'light' | 'dark';

export type FeedActivityType =
  | 'run_completed'
  | 'plan_started'
  | 'plan_completed'
  | 'goal_achieved'
  | 'streak_milestone';

// ============================================================
// Database Models (match SQLite columns exactly)
// ============================================================

export interface TrainingPlan {
  id: string;
  name: string;
  race_type: RaceType;
  difficulty: Difficulty;
  description: string;
  duration_weeks: number;
  is_builtin: number; // 0 or 1 (SQLite boolean)
  created_at: string;
  updated_at: string;
  sync_status: SyncStatus;
}

export interface PlanDay {
  id: string;
  plan_id: string;
  week_number: number;    // 1-indexed
  day_of_week: number;    // 0=Mon ... 6=Sun
  activity_type: ActivityType;
  distance_value: number | null;
  distance_unit: DistanceUnit;
  duration_minutes: number | null; // for cross_training
  description: string;
  workout_segments: string | null; // JSON-encoded WorkoutSegment[]
}

// ============================================================
// Pace Zones & Workout Structure
// ============================================================

export type PaceZoneType = 'easy' | 'long' | 'tempo' | 'intervals' | 'race' | 'recovery';

export interface WorkoutSegment {
  zone: PaceZoneType;
  distance_value?: number;    // in user's distance unit
  duration_minutes?: number;  // time-based segment
  reps?: number;              // for repeating (e.g. 8× 400m)
  description?: string;
}

export interface PaceZones {
  easy: number;       // sec/unit
  long: number;
  tempo: number;
  intervals: number;
  race: number;
  recovery: number;
}

// Defaults in sec/mile — sensible for a recreational runner
export const DEFAULT_PACE_ZONES_MI: PaceZones = {
  easy:      600, // 10:00/mi
  long:      630, // 10:30/mi
  tempo:     510, // 8:30/mi
  intervals: 450, // 7:30/mi
  race:      540, // 9:00/mi
  recovery:  660, // 11:00/mi
};

// Defaults in sec/km
export const DEFAULT_PACE_ZONES_KM: PaceZones = {
  easy:      373, // 6:13/km
  long:      391, // 6:31/km
  tempo:     317, // 5:17/km
  intervals: 280, // 4:40/km
  race:      335, // 5:35/km
  recovery:  410, // 6:50/km
};

export const PACE_ZONE_LABELS: Record<PaceZoneType, string> = {
  easy:      'Easy',
  long:      'Long',
  tempo:     'Tempo',
  intervals: 'Intervals',
  race:      'Race',
  recovery:  'Recovery',
};

export interface ActivePlan {
  id: string;
  plan_id: string;
  start_date: string; // YYYY-MM-DD
  is_active: number;  // 0 or 1
  created_at: string;
  sync_status: SyncStatus;
}

// ============================================================
// Health Metrics
// ============================================================

/** Time (seconds) spent in each HR zone during a run. */
export interface HRZones {
  z1_seconds: number; // Recovery  < 60% maxHR
  z2_seconds: number; // Easy      60-70%
  z3_seconds: number; // Aerobic   70-80%
  z4_seconds: number; // Threshold 80-90%
  z5_seconds: number; // Max       > 90%
}

/** A single GPS point in a run route. */
export interface RoutePoint {
  lat: number;
  lng: number;
  alt?: number;   // metres
  t?: number;     // unix ms timestamp
}

export interface Run {
  id: string;
  date: string; // ISO 8601 datetime (e.g., "2025-02-22T14:30:00Z")
  distance_value: number;
  distance_unit: DistanceUnit;
  duration_seconds: number;
  run_type: RunType;
  plan_day_id: string | null;
  notes: string;
  source: 'manual' | 'healthkit';

  // ── Heart Rate ──────────────────────────────────────────
  avg_heart_rate: number | null;
  max_heart_rate: number | null;
  min_heart_rate: number | null;
  /** JSON-encoded HRZones */
  hr_zones: string | null;

  // ── Cadence & Running Form ───────────────────────────────
  /** Steps per minute */
  avg_cadence: number | null;
  /** Metres */
  avg_stride_length_meters: number | null;
  /** Milliseconds */
  avg_ground_contact_time_ms: number | null;
  /** Centimetres */
  avg_vertical_oscillation_cm: number | null;

  // ── Power ────────────────────────────────────────────────
  /** Watts */
  avg_power_watts: number | null;
  max_power_watts: number | null;

  // ── Elevation ────────────────────────────────────────────
  /** Metres gained */
  elevation_gain_meters: number | null;
  /** Metres lost */
  elevation_loss_meters: number | null;

  // ── Fitness ──────────────────────────────────────────────
  /** mL/kg/min snapshot from Apple Watch */
  vo2_max: number | null;

  // ── Environment ──────────────────────────────────────────
  temperature_celsius: number | null;
  humidity_percent: number | null;
  /** 'clear' | 'cloudy' | 'foggy' | 'windy' | 'rain' | 'snow' */
  weather_condition: string | null;

  // ── Calories ─────────────────────────────────────────────
  calories: number | null;

  // ── Route ────────────────────────────────────────────────
  /** 1 if GPS route data exists in run_routes table */
  has_route: number;

  created_at: string;
  updated_at: string;
  sync_status: SyncStatus;
}

export interface Goal {
  id: string;
  type: GoalType;
  target_value: number;
  target_unit: DistanceUnit;
  start_date: string;
  end_date: string;
  created_at: string;
  sync_status: SyncStatus;
}

export interface SyncQueueItem {
  id: string;
  table_name: string;
  record_id: string;
  action: 'upsert' | 'delete';
  payload: string; // JSON string
  created_at: string;
}

// ============================================================
// Settings
// ============================================================

export interface AppSettings {
  units: DistanceUnit;
  dark_mode: DarkModePreference;
  onboarding_complete: boolean;
  sync_enabled: boolean;
  last_sync_at: string;
  pace_zones: PaceZones;
  /** User's maximum heart rate in bpm, used for HR zone calculations. Default 190. */
  max_heart_rate_bpm: number;
}

export const DEFAULT_APP_SETTINGS: AppSettings = {
  units: 'mi',
  dark_mode: 'system',
  onboarding_complete: false,
  sync_enabled: false,
  last_sync_at: '',
  pace_zones: DEFAULT_PACE_ZONES_MI,
  max_heart_rate_bpm: 190,
};

// ============================================================
// Supabase / Social Models
// ============================================================

export interface Profile {
  id: string;
  display_name: string;
  email: string;
  avatar_url: string | null;
  units_preference: DistanceUnit;
  is_public: boolean;
  created_at: string;
  updated_at: string;
}

export interface Follow {
  follower_id: string;
  following_id: string;
  created_at: string;
}

export interface FeedItem {
  id: string;
  user_id: string;
  activity_type: FeedActivityType;
  data: Record<string, unknown>;
  created_at: string;
  // Joined fields populated by queries
  profile?: Profile;
  likes_count?: number;
  comments_count?: number;
  user_has_liked?: boolean;
}

export interface FeedComment {
  id: string;
  user_id: string;
  activity_id: string;
  text: string;
  created_at: string;
  profile?: Profile;
}

export interface CommunityPlan {
  id: string;
  author_id: string;
  plan_data: PlanExportFormat;
  name: string;
  race_type: RaceType;
  difficulty: Difficulty;
  description: string;
  duration_weeks: number;
  upvote_count: number;
  avg_rating: number;
  rating_count: number;
  created_at: string;
  // Joined
  author?: Profile;
  user_has_upvoted?: boolean;
  user_rating?: number;
}

export interface PlanComment {
  id: string;
  user_id: string;
  plan_id: string;
  text: string;
  created_at: string;
  profile?: Profile;
}

// ============================================================
// Plan Import/Export Format
// ============================================================

export interface PlanExportFormat {
  version: 1;
  plan: {
    name: string;
    race_type: RaceType;
    difficulty: Difficulty;
    description: string;
    duration_weeks: number;
    schedule: PlanExportWeek[];
  };
}

export interface PlanExportWeek {
  week: number;
  days: PlanExportDay[];
}

export interface PlanExportDay {
  day: number; // 0-6
  type: ActivityType;
  distance?: number;
  distance_unit?: DistanceUnit;
  duration?: number; // minutes, for cross_training
  description?: string;
}

// ============================================================
// Data Backup & Export
// ============================================================

export interface FullBackup {
  version: 1;
  exported_at: string;
  app_version: string;
  settings: AppSettings;
  training_plans: TrainingPlan[];
  plan_days: PlanDay[];
  active_plan: ActivePlan | null;
  runs: Run[];
  goals: Goal[];
}

export interface RunCsvRow {
  date: string;
  distance: number;
  unit: DistanceUnit;
  duration: string;  // "HH:MM:SS"
  pace: string;      // "M:SS /mi"
  type: string;
  planned: 'yes' | 'no';
  notes: string;
}

// ============================================================
// Computed / View Types (derived, not stored)
// ============================================================

export interface TodayActivity {
  plan_day: PlanDay | null;
  is_completed: boolean;
  logged_run: Run | null;
}

export interface WeekSummary {
  week_number: number;
  days_completed: number;
  days_total: number;
  miles_completed: number;
  miles_planned: number;
}

export interface RunStats {
  total_distance: number;
  total_runs: number;
  total_duration_seconds: number;
  avg_pace_seconds_per_unit: number;
  longest_run_distance: number;
  current_streak: number;
  longest_streak: number;
  runs_completed_vs_scheduled: { completed: number; scheduled: number };
}

export interface GoalProgress {
  goal: Goal;
  current_value: number;
  percentage: number;
  remaining: number;
}

// ============================================================
// Activity Color & Label Maps
// ============================================================

export const ACTIVITY_COLORS: Record<ActivityType, string> = {
  rest: '#9ca3af',
  cross_training: '#818cf8',
  easy_run: '#34d399',
  pace_run: '#fbbf24',
  tempo_run: '#fb923c',
  long_run: '#f87171',
  intervals: '#a78bfa',
  race: '#ef4444',
};

export const ACTIVITY_LABELS: Record<ActivityType, string> = {
  rest: 'Rest',
  cross_training: 'Cross Training',
  easy_run: 'Easy Run',
  pace_run: 'Pace Run',
  tempo_run: 'Tempo Run',
  long_run: 'Long Run',
  intervals: 'Intervals',
  race: 'Race Day',
};

export const RACE_TYPE_LABELS: Record<RaceType, string> = {
  '5k': '5K',
  '10k': '10K',
  'half_marathon': 'Half Marathon',
  'full_marathon': 'Full Marathon',
  'other': 'Other',
};

export const RACE_TYPE_DISTANCES: Record<RaceType, string> = {
  '5k': '3.1 mi',
  '10k': '6.2 mi',
  'half_marathon': '13.1 mi',
  'full_marathon': '26.2 mi',
  'other': '',
};

export const DIFFICULTY_LABELS: Record<Difficulty, string> = {
  beginner: 'Beginner',
  intermediate: 'Intermediate',
  advanced: 'Advanced',
  custom: 'Custom',
};

export const RUN_TYPE_LABELS: Record<RunType, string> = {
  easy_run: 'Easy Run',
  pace_run: 'Pace Run',
  tempo_run: 'Tempo Run',
  long_run: 'Long Run',
  intervals: 'Intervals',
  race: 'Race',
  other: 'Other',
};
