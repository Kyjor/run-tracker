# Run With Friends — Complete Application Spec

## 1. Overview

**App Name:** Run With Friends
**Bundle Identifier:** `com.runwithfriends.app`
**Platform:** iOS only (Tauri v2 mobile)
**Architecture:** Offline-first with opt-in cloud sync

A run tracking and training plan app that works fully offline with local SQLite. Users can optionally create an account and enable cloud sync (subscription-gated) to unlock cross-device sync, social features (friends, activity feed, comments/reactions), and a community plan marketplace where users share, rate, and upvote custom training plans.

### Key Feature Summary

- **Offline-first:** All core features work without an account. SQLite is the primary data store.
- **Training Plans:** 12 built-in plans (5K/10K/Half/Full × Beginner/Intermediate/Advanced). Users can create, edit, duplicate, import/export (JSON), and share plans.
- **Run Logging:** Manual logging with pre-fill from plan. Tracks distance, duration, pace, type, notes.
- **Calendar:** Month and week views with color-coded activities, completion tracking, and day detail.
- **Statistics:** Charts for mileage trends, pace progression, run type breakdown. Streak tracking.
- **Goals:** Weekly/monthly mileage goals with progress indicators.
- **Social (requires sync):** Follow friends, view their plans/progress/runs/streaks, like/comment on activities.
- **Community Plans (requires sync):** Browse, rate, upvote, comment on shared plans. Import into local plans.
- **Onboarding:** Welcome → Units → Plan selection → Preview → Start date.
- **Settings:** Units (mi/km), dark mode (system/light/dark), account, sync toggle, data export.
- **CI/CD:** GitHub Actions → TestFlight via Fastlane.
- **TODO (deferred):** Apple HealthKit integration, actual subscription payment (StoreKit).

---

## 2. Tech Stack

### Frontend (TypeScript)
| Package | Version | Purpose |
|---|---|---|
| react | ^18.3.1 | UI framework |
| react-dom | ^18.3.1 | React DOM renderer |
| react-router-dom | ^6.28.0 | Client-side routing |
| @supabase/supabase-js | ^2.52.0 | Supabase client (sync/social only) |
| @tauri-apps/api | ^2 | Tauri JS API |
| @tauri-apps/plugin-sql | ^2 | SQLite from JS |
| recharts | ^2.15.0 | Charts |
| date-fns | ^4.1.0 | Date utilities |
| tailwindcss | ^3.4.17 | CSS framework |
| postcss | ^8.4.49 | PostCSS |
| autoprefixer | ^10.4.20 | Vendor prefixing |

### Dev Dependencies
| Package | Version | Purpose |
|---|---|---|
| @tauri-apps/cli | ^2 | Tauri CLI |
| @types/react | ^18.3.1 | React types |
| @types/react-dom | ^18.3.1 | ReactDOM types |
| @vitejs/plugin-react | ^4.3.4 | Vite React plugin |
| typescript | ~5.6.2 | TypeScript compiler |
| vite | ^6.0.3 | Build tool |

### Backend (Rust — `src-tauri/Cargo.toml`)
| Crate | Version | Features | Purpose |
|---|---|---|---|
| tauri | 2 | [] | Tauri runtime |
| tauri-build | 2 | [] | Build script |
| tauri-plugin-sql | 2 | ["sqlite"] | SQLite plugin |
| serde | 1 | ["derive"] | Serialization |
| serde_json | 1 | | JSON handling |

---

## 3. Project Structure

```
/
├── .github/
│   └── workflows/
│       └── deploy-testflight.yml
├── src/
│   ├── main.tsx                          # Entry point, mounts App
│   ├── App.tsx                           # Root: context providers + router
│   ├── index.css                         # Tailwind directives + global styles
│   ├── vite-env.d.ts                     # Vite env types
│   ├── components/
│   │   ├── ui/
│   │   │   ├── Button.tsx                # Reusable button (variants: primary, secondary, ghost, danger)
│   │   │   ├── Input.tsx                 # Text/number input with label and error state
│   │   │   ├── Card.tsx                  # Container card with optional header
│   │   │   ├── Modal.tsx                 # Bottom sheet / modal overlay
│   │   │   ├── Toast.tsx                 # Toast notification component
│   │   │   ├── ProgressBar.tsx           # Horizontal progress bar
│   │   │   ├── ProgressRing.tsx          # Circular progress indicator
│   │   │   ├── Spinner.tsx               # Loading spinner
│   │   │   ├── EmptyState.tsx            # Empty state with icon, title, description, action
│   │   │   ├── Badge.tsx                 # Small colored badge/chip
│   │   │   └── Toggle.tsx               # Toggle switch
│   │   ├── calendar/
│   │   │   ├── MonthView.tsx             # Monthly calendar grid
│   │   │   ├── WeekView.tsx              # Horizontal/vertical week strip
│   │   │   ├── DayCell.tsx               # Single day cell (color-coded, distance, checkmark)
│   │   │   └── DayDetailSheet.tsx        # Bottom sheet for tapped day
│   │   ├── charts/
│   │   │   ├── MileageChart.tsx          # Bar chart: weekly mileage
│   │   │   ├── PaceChart.tsx             # Line chart: pace over time
│   │   │   └── RunTypeChart.tsx          # Pie chart: distribution by run type
│   │   ├── plan/
│   │   │   ├── PlanCard.tsx              # Plan summary card (name, type, difficulty, progress)
│   │   │   ├── PlanPreview.tsx           # Scrollable calendar preview of a plan
│   │   │   ├── PlanEditorGrid.tsx        # Week × day grid editor for plan creation
│   │   │   ├── ActivityCellEditor.tsx    # Editor for a single day's activity
│   │   │   └── CommunityPlanCard.tsx     # Plan card with rating, upvotes, author
│   │   ├── run/
│   │   │   ├── RunForm.tsx               # Run logging form (distance, duration, type, notes)
│   │   │   ├── RunCard.tsx               # Single run display card
│   │   │   └── TodayActivityCard.tsx     # Dashboard card showing today's planned activity
│   │   ├── social/
│   │   │   ├── ActivityFeedItem.tsx       # Single feed item (run completed, goal hit, etc.)
│   │   │   ├── FriendCard.tsx            # Friend list item (avatar, name, plan, recent activity)
│   │   │   ├── CommentList.tsx           # List of comments with input
│   │   │   └── FollowButton.tsx          # Follow/unfollow toggle button
│   │   ├── navigation/
│   │   │   ├── TabBar.tsx                # Bottom tab navigation bar
│   │   │   └── Header.tsx                # Screen header with title and optional actions
│   │   └── onboarding/
│   │       ├── WelcomeStep.tsx           # Welcome screen
│   │       ├── UnitsStep.tsx             # Miles/km selection
│   │       ├── PlanBrowserStep.tsx       # Plan selection during onboarding
│   │       ├── PlanPreviewStep.tsx       # Preview selected plan
│   │       └── StartDateStep.tsx         # Pick plan start date
│   ├── screens/
│   │   ├── OnboardingScreen.tsx          # Onboarding flow container (manages steps)
│   │   ├── AuthScreen.tsx                # Sign in / create account
│   │   ├── DashboardScreen.tsx           # Home tab: today card, weekly summary, streak, quick stats
│   │   ├── CalendarScreen.tsx            # Calendar tab: month/week toggle, day tap
│   │   ├── LogRunScreen.tsx              # Log tab: run form (optionally pre-filled from plan day)
│   │   ├── StatsScreen.tsx               # Stats tab: charts, metrics, goals
│   │   ├── ProfileScreen.tsx             # Profile tab: user info, sections for plans/social/settings
│   │   ├── MyPlansScreen.tsx             # List of user's plans + create/import
│   │   ├── PlanDetailScreen.tsx          # Full plan view with actions (start, edit, export, share)
│   │   ├── PlanEditorScreen.tsx          # Multi-step plan editor (metadata → grid → preview → save)
│   │   ├── CommunityPlansScreen.tsx      # Browse community plans with search/filter/sort
│   │   ├── CommunityPlanDetailScreen.tsx # Community plan with rating, upvotes, comments, import
│   │   ├── GoalsScreen.tsx               # Manage mileage goals
│   │   ├── SettingsScreen.tsx            # All settings
│   │   ├── SocialScreen.tsx              # Feed / Friends / Find tabs
│   │   └── FriendProfileScreen.tsx       # View a friend's profile and activity
│   ├── contexts/
│   │   ├── DatabaseContext.tsx            # SQLite init, migrations, seeding
│   │   ├── AuthContext.tsx                # Supabase auth + sync state
│   │   ├── SettingsContext.tsx            # Units, dark mode, onboarding state
│   │   ├── PlanContext.tsx                # Plans CRUD, active plan
│   │   ├── RunContext.tsx                 # Runs CRUD, goals, today's activity
│   │   ├── SocialContext.tsx              # Friends, feed, community plans
│   │   └── ToastContext.tsx               # Toast queue and display
│   ├── services/
│   │   ├── database.ts                   # SQLite helpers: migration SQL, query wrappers
│   │   ├── supabaseClient.ts             # Supabase client init
│   │   ├── syncService.ts                # Bidirectional sync engine
│   │   ├── planService.ts                # Plan CRUD (SQLite)
│   │   ├── runService.ts                 # Run CRUD (SQLite)
│   │   ├── goalService.ts                # Goal CRUD (SQLite)
│   │   ├── socialService.ts              # Social operations (Supabase)
│   │   ├── communityService.ts           # Community plans operations (Supabase)
│   │   ├── statsService.ts               # Statistics calculations (SQLite queries)
│   │   └── backupService.ts              # Full data export/import/backup (JSON + CSV)
│   ├── types/
│   │   └── index.ts                      # All TypeScript interfaces and enums
│   ├── utils/
│   │   ├── dateUtils.ts                  # Date formatting, week calculations, timezone handling
│   │   ├── paceUtils.ts                  # Pace calculation, formatting (min:sec per mi/km)
│   │   ├── unitConversion.ts             # Miles ↔ kilometers conversion
│   │   ├── planSeedData.ts               # All 12 built-in plan definitions
│   │   ├── restDayMessages.ts            # Motivational messages for rest days
│   │   └── colors.ts                     # Activity type color map
│   └── hooks/
│       ├── useDarkMode.ts                # System preference detection + manual override
│       └── useDebounce.ts                # Debounce hook for search inputs
├── src-tauri/
│   ├── tauri.conf.json
│   ├── Cargo.toml
│   ├── build.rs
│   ├── capabilities/
│   │   └── default.json
│   └── src/
│       ├── main.rs                       # Desktop entry (unused on iOS, kept for build)
│       └── lib.rs                        # Tauri Builder: register plugins
├── package.json
├── tsconfig.json
├── tsconfig.node.json
├── vite.config.ts
├── tailwind.config.js
├── postcss.config.js
├── index.html
└── .env.example                          # VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY
```

---

## 4. Configuration Files

### 4.1 `tauri.conf.json`
```json
{
  "$schema": "https://schema.tauri.app/config/2",
  "productName": "Run With Friends",
  "version": "0.1.0",
  "identifier": "com.runwithfriends.app",
  "build": {
    "beforeDevCommand": "npm run dev",
    "devUrl": "http://localhost:1420",
    "beforeBuildCommand": "npm run build",
    "frontendDist": "../dist"
  },
  "app": {
    "windows": [
      {
        "title": "Run With Friends",
        "width": 393,
        "height": 852,
        "resizable": false,
        "fullscreen": false
      }
    ],
    "security": {
      "csp": null
    }
  },
  "plugins": {
    "sql": {
      "preload": {
        "db": "sqlite:runwithfriends.db"
      }
    }
  },
  "bundle": {
    "active": true,
    "targets": "all",
    "icon": [
      "icons/32x32.png",
      "icons/128x128.png",
      "icons/128x128@2x.png",
      "icons/icon.icns",
      "icons/icon.ico"
    ],
    "iOS": {
      "developmentTeam": "AKG5NATH99"
    }
  }
}
```

### 4.2 `package.json`
```json
{
  "name": "run-with-friends",
  "private": true,
  "version": "0.1.0",
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "tsc && vite build",
    "preview": "vite preview",
    "tauri": "tauri"
  },
  "dependencies": {
    "@supabase/supabase-js": "^2.52.0",
    "@tauri-apps/api": "^2",
    "@tauri-apps/plugin-sql": "^2",
    "react": "^18.3.1",
    "react-dom": "^18.3.1",
    "react-router-dom": "^6.28.0",
    "recharts": "^2.15.0",
    "date-fns": "^4.1.0"
  },
  "devDependencies": {
    "@tauri-apps/cli": "^2",
    "@types/react": "^18.3.1",
    "@types/react-dom": "^18.3.1",
    "@vitejs/plugin-react": "^4.3.4",
    "autoprefixer": "^10.4.20",
    "postcss": "^8.4.49",
    "tailwindcss": "^3.4.17",
    "typescript": "~5.6.2",
    "vite": "^6.0.3"
  }
}
```

### 4.3 `src-tauri/Cargo.toml`
```toml
[package]
name = "run-with-friends"
version = "0.1.0"
description = "Run With Friends - Training Plan & Run Tracker"
authors = ["you"]
edition = "2021"

[lib]
name = "run_with_friends_lib"
crate-type = ["staticlib", "cdylib", "rlib"]

[build-dependencies]
tauri-build = { version = "2", features = [] }

[dependencies]
tauri = { version = "2", features = [] }
tauri-plugin-sql = { version = "2", features = ["sqlite"] }
serde = { version = "1", features = ["derive"] }
serde_json = "1"
```

### 4.4 `src-tauri/src/lib.rs`
```rust
#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_sql::Builder::new().build())
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
```

### 4.5 `tailwind.config.js`
```js
/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  darkMode: "class",
  theme: {
    extend: {
      colors: {
        primary: {
          50: "#eff6ff",
          100: "#dbeafe",
          200: "#bfdbfe",
          300: "#93c5fd",
          400: "#60a5fa",
          500: "#3b82f6",
          600: "#2563eb",
          700: "#1d4ed8",
          800: "#1e40af",
          900: "#1e3a8a",
        },
        accent: {
          50: "#fff7ed",
          100: "#ffedd5",
          200: "#fed7aa",
          300: "#fdba74",
          400: "#fb923c",
          500: "#f97316",
          600: "#ea580c",
          700: "#c2410c",
          800: "#9a3412",
          900: "#7c2d12",
        },
        activity: {
          rest: "#9ca3af",
          cross: "#818cf8",
          easy: "#34d399",
          pace: "#fbbf24",
          tempo: "#fb923c",
          long: "#f87171",
          intervals: "#a78bfa",
          race: "#ef4444",
        },
      },
      fontFamily: {
        sans: ["-apple-system", "BlinkMacSystemFont", "SF Pro Text", "Helvetica Neue", "sans-serif"],
      },
    },
  },
  plugins: [],
};
```

### 4.6 `postcss.config.js`
```js
export default {
  plugins: {
    tailwindcss: {},
    autoprefixer: {},
  },
};
```

### 4.7 `vite.config.ts`
```ts
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

const host = process.env.TAURI_DEV_HOST;

export default defineConfig(async () => ({
  plugins: [react()],
  clearScreen: false,
  server: {
    port: 1420,
    strictPort: true,
    host: host || false,
    hmr: host ? { protocol: "ws", host, port: 1421 } : undefined,
    watch: { ignored: ["**/src-tauri/**"] },
  },
  define: { global: "globalThis" },
}));
```

### 4.8 `index.html`
```html
<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0, viewport-fit=cover, user-scalable=no" />
    <meta name="apple-mobile-web-app-capable" content="yes" />
    <meta name="apple-mobile-web-app-status-bar-style" content="default" />
    <title>Run With Friends</title>
  </head>
  <body class="bg-white dark:bg-gray-950 text-gray-900 dark:text-gray-100">
    <div id="root"></div>
    <script type="module" src="/src/main.tsx"></script>
  </body>
</html>
```

### 4.9 `.env.example`
```
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key
```

### 4.10 `src-tauri/capabilities/default.json`
```json
{
  "$schema": "../gen/schemas/iOS-schema.json",
  "identifier": "default",
  "description": "Default capabilities for Run With Friends",
  "windows": ["*"],
  "permissions": [
    "core:default",
    "sql:default",
    "sql:allow-load",
    "sql:allow-execute",
    "sql:allow-select",
    "sql:allow-close"
  ]
}
```

---

## 5. Database Schema

### 5.1 Local SQLite Schema

All tables use TEXT for UUIDs (generated via `crypto.randomUUID()` in JS). All timestamps are ISO 8601 strings in UTC.

```sql
-- ============================================================
-- SETTINGS (local only, never synced)
-- ============================================================
CREATE TABLE IF NOT EXISTS settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL
);
-- Default settings to insert on first launch:
-- ('units', 'mi')
-- ('dark_mode', 'system')        -- 'system' | 'light' | 'dark'
-- ('onboarding_complete', 'false')
-- ('sync_enabled', 'false')
-- ('last_sync_at', '')

-- ============================================================
-- TRAINING PLANS
-- ============================================================
CREATE TABLE IF NOT EXISTS training_plans (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  race_type TEXT NOT NULL,           -- '5k' | '10k' | 'half_marathon' | 'full_marathon' | 'other'
  difficulty TEXT NOT NULL,          -- 'beginner' | 'intermediate' | 'advanced' | 'custom'
  description TEXT NOT NULL DEFAULT '',
  duration_weeks INTEGER NOT NULL,
  is_builtin INTEGER NOT NULL DEFAULT 0,  -- 1 for seeded plans, 0 for user-created
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  sync_status TEXT NOT NULL DEFAULT 'local'  -- 'local' | 'synced' | 'dirty'
);

-- ============================================================
-- PLAN DAYS (individual scheduled activities within a plan)
-- ============================================================
CREATE TABLE IF NOT EXISTS plan_days (
  id TEXT PRIMARY KEY,
  plan_id TEXT NOT NULL REFERENCES training_plans(id) ON DELETE CASCADE,
  week_number INTEGER NOT NULL,       -- 1-indexed
  day_of_week INTEGER NOT NULL,       -- 0=Mon, 1=Tue, 2=Wed, 3=Thu, 4=Fri, 5=Sat, 6=Sun
  activity_type TEXT NOT NULL,        -- 'rest' | 'cross_training' | 'easy_run' | 'pace_run' | 'tempo_run' | 'long_run' | 'intervals' | 'race'
  distance_value REAL,                -- nullable, in user's preferred units at time of creation
  distance_unit TEXT NOT NULL DEFAULT 'mi',  -- 'mi' | 'km'
  duration_minutes INTEGER,           -- nullable, for cross_training
  description TEXT NOT NULL DEFAULT '',
  UNIQUE(plan_id, week_number, day_of_week)
);

-- ============================================================
-- ACTIVE PLAN (user's currently active training plan assignment)
-- Only one row should have is_active = 1 at a time
-- ============================================================
CREATE TABLE IF NOT EXISTS active_plan (
  id TEXT PRIMARY KEY,
  plan_id TEXT NOT NULL REFERENCES training_plans(id),
  start_date TEXT NOT NULL,           -- ISO date 'YYYY-MM-DD'
  is_active INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL,
  sync_status TEXT NOT NULL DEFAULT 'local'
);

-- ============================================================
-- RUNS (logged runs — both planned and extra)
-- ============================================================
CREATE TABLE IF NOT EXISTS runs (
  id TEXT PRIMARY KEY,
  date TEXT NOT NULL,                 -- ISO date 'YYYY-MM-DD'
  distance_value REAL NOT NULL,
  distance_unit TEXT NOT NULL DEFAULT 'mi',
  duration_seconds INTEGER NOT NULL,  -- total seconds
  run_type TEXT NOT NULL,             -- same enum as activity_type (excluding 'rest' and 'cross_training') + 'other'
  plan_day_id TEXT REFERENCES plan_days(id),  -- nullable, null for extra runs
  notes TEXT NOT NULL DEFAULT '',
  source TEXT NOT NULL DEFAULT 'manual',  -- 'manual' | 'healthkit'
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  sync_status TEXT NOT NULL DEFAULT 'local'
);

-- ============================================================
-- GOALS (weekly or monthly mileage goals)
-- ============================================================
CREATE TABLE IF NOT EXISTS goals (
  id TEXT PRIMARY KEY,
  type TEXT NOT NULL,                  -- 'weekly' | 'monthly'
  target_value REAL NOT NULL,
  target_unit TEXT NOT NULL DEFAULT 'mi',
  start_date TEXT NOT NULL,            -- ISO date
  end_date TEXT NOT NULL,              -- ISO date
  created_at TEXT NOT NULL,
  sync_status TEXT NOT NULL DEFAULT 'local'
);

-- ============================================================
-- SYNC QUEUE (tracks local changes pending cloud sync)
-- ============================================================
CREATE TABLE IF NOT EXISTS sync_queue (
  id TEXT PRIMARY KEY,
  table_name TEXT NOT NULL,
  record_id TEXT NOT NULL,
  action TEXT NOT NULL,                -- 'upsert' | 'delete'
  payload TEXT NOT NULL DEFAULT '{}',  -- JSON of the record
  created_at TEXT NOT NULL,
  UNIQUE(table_name, record_id)        -- latest action per record
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_plan_days_plan_id ON plan_days(plan_id);
CREATE INDEX IF NOT EXISTS idx_runs_date ON runs(date);
CREATE INDEX IF NOT EXISTS idx_runs_plan_day_id ON runs(plan_day_id);
CREATE INDEX IF NOT EXISTS idx_active_plan_active ON active_plan(is_active);
CREATE INDEX IF NOT EXISTS idx_goals_dates ON goals(start_date, end_date);
CREATE INDEX IF NOT EXISTS idx_sync_queue_table ON sync_queue(table_name);
```

### 5.2 Supabase Schema (Cloud — sync + social)

Create these via Supabase SQL Editor or migrations. All tables use UUID primary keys. RLS is enabled on all tables.

```sql
-- ============================================================
-- Enable necessary extensions
-- ============================================================
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================================
-- PROFILES (extends Supabase auth.users)
-- ============================================================
CREATE TABLE profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  display_name TEXT NOT NULL,
  email TEXT NOT NULL,
  avatar_url TEXT,
  units_preference TEXT NOT NULL DEFAULT 'mi',
  is_public BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

-- Anyone can read public profiles
CREATE POLICY "Public profiles readable" ON profiles
  FOR SELECT USING (is_public = true);
-- Users can read own profile always
CREATE POLICY "Own profile readable" ON profiles
  FOR SELECT USING (auth.uid() = id);
-- Users can update own profile
CREATE POLICY "Own profile updatable" ON profiles
  FOR UPDATE USING (auth.uid() = id);
-- Users can insert own profile (on sign-up)
CREATE POLICY "Own profile insertable" ON profiles
  FOR INSERT WITH CHECK (auth.uid() = id);

-- ============================================================
-- FOLLOWS
-- ============================================================
CREATE TABLE follows (
  follower_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  following_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (follower_id, following_id),
  CHECK (follower_id != following_id)
);

ALTER TABLE follows ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read follows" ON follows
  FOR SELECT USING (true);
CREATE POLICY "Users manage own follows" ON follows
  FOR INSERT WITH CHECK (auth.uid() = follower_id);
CREATE POLICY "Users delete own follows" ON follows
  FOR DELETE USING (auth.uid() = follower_id);

-- ============================================================
-- TRAINING PLANS (synced from local)
-- ============================================================
CREATE TABLE training_plans (
  id UUID PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  race_type TEXT NOT NULL,
  difficulty TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  duration_weeks INTEGER NOT NULL,
  is_builtin BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE training_plans ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users read own plans" ON training_plans
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users crud own plans" ON training_plans
  FOR ALL USING (auth.uid() = user_id);
-- Friends can read plans of people they follow (used in friend profile view)
CREATE POLICY "Followers read plans" ON training_plans
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM follows WHERE follower_id = auth.uid() AND following_id = training_plans.user_id
    )
  );

-- ============================================================
-- PLAN DAYS (synced from local)
-- ============================================================
CREATE TABLE plan_days (
  id UUID PRIMARY KEY,
  plan_id UUID NOT NULL REFERENCES training_plans(id) ON DELETE CASCADE,
  week_number INTEGER NOT NULL,
  day_of_week INTEGER NOT NULL,
  activity_type TEXT NOT NULL,
  distance_value REAL,
  distance_unit TEXT NOT NULL DEFAULT 'mi',
  duration_minutes INTEGER,
  description TEXT NOT NULL DEFAULT '',
  UNIQUE(plan_id, week_number, day_of_week)
);

ALTER TABLE plan_days ENABLE ROW LEVEL SECURITY;

-- plan_days inherits access from training_plans via plan_id
CREATE POLICY "Access via plan ownership" ON plan_days
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM training_plans WHERE id = plan_days.plan_id AND user_id = auth.uid()
    )
  );
CREATE POLICY "Followers read plan days" ON plan_days
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM training_plans tp
      JOIN follows f ON f.following_id = tp.user_id
      WHERE tp.id = plan_days.plan_id AND f.follower_id = auth.uid()
    )
  );

-- ============================================================
-- ACTIVE PLANS (synced from local)
-- ============================================================
CREATE TABLE active_plans (
  id UUID PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  plan_id UUID NOT NULL REFERENCES training_plans(id) ON DELETE CASCADE,
  start_date DATE NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE active_plans ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own active plans" ON active_plans
  FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "Followers read active plans" ON active_plans
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM follows WHERE follower_id = auth.uid() AND following_id = active_plans.user_id)
  );

-- ============================================================
-- RUNS (synced from local)
-- ============================================================
CREATE TABLE runs (
  id UUID PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  distance_value REAL NOT NULL,
  distance_unit TEXT NOT NULL DEFAULT 'mi',
  duration_seconds INTEGER NOT NULL,
  run_type TEXT NOT NULL,
  plan_day_id UUID REFERENCES plan_days(id),
  notes TEXT NOT NULL DEFAULT '',
  source TEXT NOT NULL DEFAULT 'manual',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE runs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own runs" ON runs
  FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "Followers read runs" ON runs
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM follows WHERE follower_id = auth.uid() AND following_id = runs.user_id)
  );

-- ============================================================
-- GOALS (synced from local)
-- ============================================================
CREATE TABLE goals (
  id UUID PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  type TEXT NOT NULL,
  target_value REAL NOT NULL,
  target_unit TEXT NOT NULL DEFAULT 'mi',
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE goals ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own goals" ON goals
  FOR ALL USING (auth.uid() = user_id);

-- ============================================================
-- ACTIVITY FEED (social — generated on run completion, goal achievement, etc.)
-- ============================================================
CREATE TABLE activity_feed (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  activity_type TEXT NOT NULL,   -- 'run_completed' | 'plan_started' | 'plan_completed' | 'goal_achieved' | 'streak_milestone'
  data JSONB NOT NULL DEFAULT '{}',  -- flexible payload (distance, pace, streak count, plan name, etc.)
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE activity_feed ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users insert own feed items" ON activity_feed
  FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users read own feed" ON activity_feed
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Followers read feed" ON activity_feed
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM follows WHERE follower_id = auth.uid() AND following_id = activity_feed.user_id)
  );

-- ============================================================
-- ACTIVITY LIKES
-- ============================================================
CREATE TABLE activity_likes (
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  activity_id UUID NOT NULL REFERENCES activity_feed(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, activity_id)
);

ALTER TABLE activity_likes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read likes" ON activity_likes
  FOR SELECT USING (true);
CREATE POLICY "Users manage own likes" ON activity_likes
  FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users delete own likes" ON activity_likes
  FOR DELETE USING (auth.uid() = user_id);

-- ============================================================
-- ACTIVITY COMMENTS
-- ============================================================
CREATE TABLE activity_comments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  activity_id UUID NOT NULL REFERENCES activity_feed(id) ON DELETE CASCADE,
  text TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE activity_comments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read comments" ON activity_comments
  FOR SELECT USING (true);
CREATE POLICY "Users insert own comments" ON activity_comments
  FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users delete own comments" ON activity_comments
  FOR DELETE USING (auth.uid() = user_id);

-- ============================================================
-- COMMUNITY PLANS (published plans for marketplace)
-- ============================================================
CREATE TABLE community_plans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  author_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  plan_data JSONB NOT NULL,     -- full plan + days as JSON (see Section 10 for format)
  name TEXT NOT NULL,
  race_type TEXT NOT NULL,
  difficulty TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  duration_weeks INTEGER NOT NULL,
  upvote_count INTEGER NOT NULL DEFAULT 0,
  avg_rating REAL NOT NULL DEFAULT 0,
  rating_count INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE community_plans ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read community plans" ON community_plans
  FOR SELECT USING (true);
CREATE POLICY "Users insert own community plans" ON community_plans
  FOR INSERT WITH CHECK (auth.uid() = author_id);
CREATE POLICY "Users delete own community plans" ON community_plans
  FOR DELETE USING (auth.uid() = author_id);

-- ============================================================
-- PLAN RATINGS
-- ============================================================
CREATE TABLE plan_ratings (
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  plan_id UUID NOT NULL REFERENCES community_plans(id) ON DELETE CASCADE,
  rating INTEGER NOT NULL CHECK (rating >= 1 AND rating <= 5),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, plan_id)
);

ALTER TABLE plan_ratings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read ratings" ON plan_ratings
  FOR SELECT USING (true);
CREATE POLICY "Users manage own ratings" ON plan_ratings
  FOR ALL USING (auth.uid() = user_id);

-- Trigger: update community_plans avg_rating and rating_count on rating change
CREATE OR REPLACE FUNCTION update_plan_rating_stats()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE community_plans SET
    avg_rating = (SELECT COALESCE(AVG(rating), 0) FROM plan_ratings WHERE plan_id = COALESCE(NEW.plan_id, OLD.plan_id)),
    rating_count = (SELECT COUNT(*) FROM plan_ratings WHERE plan_id = COALESCE(NEW.plan_id, OLD.plan_id))
  WHERE id = COALESCE(NEW.plan_id, OLD.plan_id);
  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_plan_rating_stats
AFTER INSERT OR UPDATE OR DELETE ON plan_ratings
FOR EACH ROW EXECUTE FUNCTION update_plan_rating_stats();

-- ============================================================
-- PLAN UPVOTES
-- ============================================================
CREATE TABLE plan_upvotes (
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  plan_id UUID NOT NULL REFERENCES community_plans(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, plan_id)
);

ALTER TABLE plan_upvotes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read upvotes" ON plan_upvotes
  FOR SELECT USING (true);
CREATE POLICY "Users manage own upvotes" ON plan_upvotes
  FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users delete own upvotes" ON plan_upvotes
  FOR DELETE USING (auth.uid() = user_id);

-- Trigger: update community_plans upvote_count
CREATE OR REPLACE FUNCTION update_plan_upvote_count()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE community_plans SET
    upvote_count = (SELECT COUNT(*) FROM plan_upvotes WHERE plan_id = COALESCE(NEW.plan_id, OLD.plan_id))
  WHERE id = COALESCE(NEW.plan_id, OLD.plan_id);
  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_plan_upvote_count
AFTER INSERT OR DELETE ON plan_upvotes
FOR EACH ROW EXECUTE FUNCTION update_plan_upvote_count();

-- ============================================================
-- PLAN COMMENTS
-- ============================================================
CREATE TABLE plan_comments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  plan_id UUID NOT NULL REFERENCES community_plans(id) ON DELETE CASCADE,
  text TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE plan_comments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read plan comments" ON plan_comments
  FOR SELECT USING (true);
CREATE POLICY "Users insert own plan comments" ON plan_comments
  FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users delete own plan comments" ON plan_comments
  FOR DELETE USING (auth.uid() = user_id);

-- ============================================================
-- INDEXES
-- ============================================================
CREATE INDEX idx_follows_following ON follows(following_id);
CREATE INDEX idx_training_plans_user ON training_plans(user_id);
CREATE INDEX idx_runs_user_date ON runs(user_id, date);
CREATE INDEX idx_activity_feed_user ON activity_feed(user_id, created_at DESC);
CREATE INDEX idx_community_plans_race ON community_plans(race_type, difficulty);
CREATE INDEX idx_community_plans_popular ON community_plans(upvote_count DESC);
CREATE INDEX idx_community_plans_rated ON community_plans(avg_rating DESC);
```

### 5.3 Supabase Auth Trigger

Auto-create a profile row when a new user signs up:

```sql
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO profiles (id, display_name, email)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'display_name', split_part(NEW.email, '@', 1)),
    NEW.email
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_auth_user_created
AFTER INSERT ON auth.users
FOR EACH ROW EXECUTE FUNCTION handle_new_user();
```

---

## 6. TypeScript Types

All types live in `src/types/index.ts`.

```typescript
// ============================================================
// Enums (as string union types for SQLite compatibility)
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
// Database Models (match SQLite columns)
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
  week_number: number;
  day_of_week: number; // 0=Mon ... 6=Sun
  activity_type: ActivityType;
  distance_value: number | null;
  distance_unit: DistanceUnit;
  duration_minutes: number | null;
  description: string;
}

export interface ActivePlan {
  id: string;
  plan_id: string;
  start_date: string; // YYYY-MM-DD
  is_active: number;
  created_at: string;
  sync_status: SyncStatus;
}

export interface Run {
  id: string;
  date: string; // YYYY-MM-DD
  distance_value: number;
  distance_unit: DistanceUnit;
  duration_seconds: number;
  run_type: RunType;
  plan_day_id: string | null;
  notes: string;
  source: 'manual' | 'healthkit';
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
  payload: string; // JSON
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
}

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
  // Joined fields:
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
  // Joined:
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
// Plan Import/Export Format (JSON)
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
// Computed / View Types (not stored, derived in code)
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
// Data Backup & Export
// ============================================================

export interface FullBackup {
  version: 1;
  exported_at: string;          // ISO 8601 timestamp
  app_version: string;          // e.g. "0.1.0"
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
  duration: string;             // "HH:MM:SS"
  pace: string;                 // "M:SS /mi" or "/km"
  type: string;
  planned: 'yes' | 'no';       // whether linked to a plan day
  notes: string;
}

// ============================================================
// Activity Type Color Map
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
```

---

## 7. App Architecture

### 7.1 Entry Point (`src/main.tsx`)

```tsx
import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import "./index.css";

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
```

### 7.2 Root Component (`src/App.tsx`)

Context nesting order (outermost → innermost):

```
DatabaseProvider          ← initializes SQLite, runs migrations, seeds built-in plans
  └─ SettingsProvider     ← loads settings from SQLite
    └─ ToastProvider      ← toast notification queue
      └─ AuthProvider     ← Supabase auth (optional, for sync/social)
        └─ PlanProvider   ← training plans, active plan
          └─ RunProvider  ← logged runs, goals, today's activity
            └─ SocialProvider  ← friends, feed, community (noop if not authed)
              └─ BrowserRouter
                └─ AppRoutes  ← route definitions + TabBar layout
```

**`AppRoutes` logic:**
1. If `DatabaseContext` is still loading → show full-screen `Spinner`
2. If `settings.onboarding_complete === false` → render `OnboardingScreen` (no tabs)
3. Otherwise → render `MainLayout` (screens + `TabBar`)

### 7.3 Navigation & Routing

**Bottom Tab Bar** — 5 tabs, always visible on main screens:

| Tab | Icon | Label | Route |
|---|---|---|---|
| 1 | 🏠 (home) | Home | `/home` |
| 2 | 📅 (calendar) | Calendar | `/calendar` |
| 3 | ➕ (plus circle) | Log | `/log` |
| 4 | 📊 (chart) | Stats | `/stats` |
| 5 | 👤 (person) | Profile | `/profile` |

The center "Log" tab should be visually prominent (larger, accent-colored).

**Full Route Table:**

| Route | Screen | Tab | Notes |
|---|---|---|---|
| `/home` | DashboardScreen | Home | Default route after onboarding |
| `/calendar` | CalendarScreen | Calendar | |
| `/log` | LogRunScreen | Log | Optional query param `?planDayId=X` for pre-fill |
| `/log/:runId/edit` | LogRunScreen | Log | Edit existing run |
| `/stats` | StatsScreen | Stats | |
| `/profile` | ProfileScreen | Profile | |
| `/profile/plans` | MyPlansScreen | Profile | |
| `/profile/plans/new` | PlanEditorScreen | Profile | |
| `/profile/plans/:planId` | PlanDetailScreen | Profile | |
| `/profile/plans/:planId/edit` | PlanEditorScreen | Profile | Pre-load plan data |
| `/profile/goals` | GoalsScreen | Profile | |
| `/profile/settings` | SettingsScreen | Profile | |
| `/community` | CommunityPlansScreen | Profile | Requires auth |
| `/community/:planId` | CommunityPlanDetailScreen | Profile | |
| `/social` | SocialScreen | Profile | Requires auth |
| `/social/user/:userId` | FriendProfileScreen | Profile | |
| `/auth` | AuthScreen | — | No tab bar, standalone |
| `/onboarding` | OnboardingScreen | — | No tab bar, shown on first launch |

**TabBar** hides on: `/auth`, `/onboarding`, `/profile/plans/new`, `/profile/plans/:id/edit`.

### 7.4 Context Providers — Interfaces

#### DatabaseContext

```typescript
interface DatabaseContextType {
  db: Database | null;        // tauri-plugin-sql Database instance
  isReady: boolean;           // true when migrations + seeding are complete
}
```

**Initialization logic (in useEffect on mount):**
1. Load SQLite database: `await Database.load("sqlite:runwithfriends.db")`
2. Run all CREATE TABLE IF NOT EXISTS statements from Section 5.1
3. Check if built-in plans exist: `SELECT COUNT(*) FROM training_plans WHERE is_builtin = 1`
4. If count is 0 → seed all 12 built-in plans from `planSeedData.ts` (insert into `training_plans` and `plan_days`)
5. Insert default settings if not present
6. Set `isReady = true`

#### SettingsContext

```typescript
interface SettingsContextType {
  settings: AppSettings;
  loading: boolean;
  updateSetting: (key: keyof AppSettings, value: string) => Promise<void>;
}
```

**Loads on mount:** SELECT all rows from `settings` table, parse into `AppSettings` object.
**`updateSetting`:** UPDATE the settings table row + update local state.

The `dark_mode` setting drives a `useDarkMode` hook that adds/removes the `dark` class on `<html>`.

#### AuthContext

```typescript
interface AuthContextType {
  user: Profile | null;        // null if not signed in
  loading: boolean;
  error: string | null;
  signUp: (email: string, password: string, displayName: string) => Promise<void>;
  signIn: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
  clearError: () => void;
}
```

**On mount:** Check `supabase.auth.getSession()`. If session exists, fetch profile from `profiles` table. Listen to `onAuthStateChange`.

**`signUp`:** Call `supabase.auth.signUp` with `display_name` in `options.data`. The DB trigger creates the profile row.

**`signOut`:** Call `supabase.auth.signOut`, set user to null.

#### ToastContext

```typescript
interface Toast {
  id: string;
  message: string;
  type: 'success' | 'error' | 'info';
  duration?: number; // ms, default 3000
}

interface ToastContextType {
  toasts: Toast[];
  showToast: (message: string, type?: Toast['type']) => void;
}
```

Toasts render as a stack at the top of the screen (below safe area). Auto-dismiss after duration. Max 3 visible at once.

#### PlanContext

```typescript
interface PlanContextType {
  plans: TrainingPlan[];                // all plans (built-in + custom)
  activePlan: ActivePlan | null;        // currently active plan assignment
  activePlanDays: PlanDay[];            // days for the active plan
  loading: boolean;

  // CRUD
  createPlan: (plan: Omit<TrainingPlan, 'id' | 'created_at' | 'updated_at' | 'sync_status'>, days: Omit<PlanDay, 'id'>[]) => Promise<string>;
  updatePlan: (planId: string, updates: Partial<TrainingPlan>, days?: Omit<PlanDay, 'id'>[]) => Promise<void>;
  deletePlan: (planId: string) => Promise<void>;
  duplicatePlan: (planId: string, newName: string) => Promise<string>;

  // Active plan management
  setActivePlan: (planId: string, startDate: string) => Promise<void>;
  clearActivePlan: () => Promise<void>;

  // Import/Export
  importPlan: (json: PlanExportFormat) => Promise<string>;
  exportPlan: (planId: string) => PlanExportFormat;

  // Helpers
  getPlanDays: (planId: string) => Promise<PlanDay[]>;
  getPlanDayForDate: (date: string) => PlanDay | null;  // maps a calendar date to a plan day using active plan + start date
}
```

**`getPlanDayForDate` logic:**
1. If no active plan → return null
2. Calculate day offset: `differenceInDays(date, activePlan.start_date)`
3. If offset < 0 or offset >= (duration_weeks * 7) → return null
4. `week_number = Math.floor(offset / 7) + 1`
5. `day_of_week = offset % 7`
6. Find matching PlanDay in `activePlanDays`

#### RunContext

```typescript
interface RunContextType {
  runs: Run[];                           // all logged runs
  goals: Goal[];                         // all goals
  todayActivity: TodayActivity;          // derived: today's plan day + completion status
  currentStreak: number;                 // consecutive days following plan
  loading: boolean;

  // Run CRUD
  logRun: (run: Omit<Run, 'id' | 'created_at' | 'updated_at' | 'sync_status'>) => Promise<void>;
  updateRun: (runId: string, updates: Partial<Run>) => Promise<void>;
  deleteRun: (runId: string) => Promise<void>;
  getRunsForDateRange: (start: string, end: string) => Run[];
  getRunForPlanDay: (planDayId: string) => Run | null;

  // Goal CRUD
  addGoal: (goal: Omit<Goal, 'id' | 'created_at' | 'sync_status'>) => Promise<void>;
  updateGoal: (goalId: string, updates: Partial<Goal>) => Promise<void>;
  deleteGoal: (goalId: string) => Promise<void>;
  getGoalProgress: (goalId: string) => GoalProgress;
}
```

**`todayActivity` derivation (recomputed when runs or activePlanDays change):**
1. Get today's date string
2. Call `PlanContext.getPlanDayForDate(today)` to get the plan day
3. If plan day exists and is a run type → check if a run exists with matching `plan_day_id`
4. If plan day is `cross_training` → check if any run with that date is logged (or a separate completion mechanism: store completion as a run with `run_type = 'other'` and `plan_day_id` set)
5. Return `{ plan_day, is_completed, logged_run }`

**Streak calculation:** Walk backwards from today. For each date, check if the scheduled activity was completed (run logged for run days, or rest/cross day counts as completed). Stop when a non-completed day is found.

#### SocialContext

```typescript
interface SocialContextType {
  isAvailable: boolean;               // true only if user is authed + sync enabled
  following: Profile[];               // people the user follows
  followers: Profile[];               // people following the user
  feed: FeedItem[];                   // activity feed from followed users
  loading: boolean;

  // Social actions
  followUser: (userId: string) => Promise<void>;
  unfollowUser: (userId: string) => Promise<void>;
  searchUsers: (query: string) => Promise<Profile[]>;
  likeActivity: (activityId: string) => Promise<void>;
  unlikeActivity: (activityId: string) => Promise<void>;
  commentOnActivity: (activityId: string, text: string) => Promise<void>;
  deleteComment: (commentId: string) => Promise<void>;
  getComments: (activityId: string) => Promise<FeedComment[]>;
  getFriendProfile: (userId: string) => Promise<{ profile: Profile; runs: Run[]; activePlan: ActivePlan | null }>;

  // Feed
  refreshFeed: () => Promise<void>;
  postActivity: (type: FeedActivityType, data: Record<string, unknown>) => Promise<void>;
}
```

If `isAvailable` is false, all functions are no-ops or return empty arrays.

---

## 8. Detailed Screen Specs

### 8.1 OnboardingScreen

A multi-step flow. Container component manages step index (0–4). No tab bar visible.

**Step 0 — WelcomeStep:**
- Center-aligned layout
- App icon/logo (running shoe or runner silhouette — use an emoji or simple SVG placeholder)
- Title: "Run With Friends"
- Subtitle: "Your personal running companion"
- Large primary button: "Get Started"

**Step 1 — UnitsStep:**
- Heading: "Choose your units"
- Two large selectable cards side-by-side:
  - Left: "Miles" with "mi" label
  - Right: "Kilometers" with "km" label
- Selected card has `ring-2 ring-primary-500` border + checkmark
- "Continue" button (disabled until selection made — default to miles, so enabled)

**Step 2 — PlanBrowserStep:**
- Heading: "Choose a training plan"
- Subheading: "You can always change this later"
- 4 race type cards in a 2×2 grid:
  - Each card: race icon (🏃‍♂️), race name, distance label
  - 5K (3.1 mi), 10K (6.2 mi), Half Marathon (13.1 mi), Full Marathon (26.2 mi)
- Tapping a card expands/navigates to show 3 difficulty options (Beginner, Intermediate, Advanced) as sub-cards
- Tapping a difficulty card selects that plan and advances to Step 3
- "Skip for now" link at bottom → jumps to main app (marks onboarding complete, no plan selected)

**Step 3 — PlanPreviewStep:**
- Heading: plan name (e.g., "10K Intermediate")
- Plan metadata: race type badge, difficulty badge, "X weeks" badge
- Description text
- Scrollable mini calendar showing all weeks (use PlanPreview component)
- Color-coded days matching the main calendar scheme
- "Start This Plan" button → advances to Step 4
- "Choose Different Plan" link → goes back to Step 2

**Step 4 — StartDateStep:**
- Heading: "When do you want to start?"
- Date picker (native input or custom). Default: next Monday from today.
- Summary text: "Your plan runs from [start] to [end]" (calculated from duration_weeks)
- "Let's Go! 🏃" button → saves active plan with start date, marks onboarding complete, navigates to `/home`

### 8.2 AuthScreen

Standalone screen (no tab bar). Accessed from Settings or Social.

- Back button in header → navigate back
- Tab toggle at top: "Sign In" | "Create Account"
- **Sign In tab:**
  - Email input
  - Password input
  - "Sign In" button
  - Error message area (red text below button)
  - "Forgot Password?" link → triggers `supabase.auth.resetPasswordForEmail`
- **Create Account tab:**
  - Display Name input
  - Email input
  - Password input (min 6 chars)
  - "Create Account" button
  - Error message area

On successful auth → navigate back to previous screen. Show success toast.

### 8.3 DashboardScreen (Home Tab)

**Layout (scrollable, vertical):**

1. **Header:** "Run With Friends" title, profile avatar (or initials) on right → taps to `/profile`

2. **TodayActivityCard** (prominent, full-width):
   - **If no active plan:** Card with "Choose a Training Plan" message + "Browse Plans" button → `/profile/plans`
   - **If rest day:** Rest icon (🛌), "Rest Day" title, random motivational message from `restDayMessages.ts` array, muted gray card background
   - **If cross training day:** Activity icon (🏊/🚴), "Cross Training" title, duration (e.g., "30 minutes"), "Mark Complete" button (logs a completion entry)
   - **If run day:** Run type color dot + label (e.g., "Easy Run"), distance (e.g., "3 miles"), "Log Run" button → `/log?planDayId=X`
   - **If today's activity is already completed:** Show checkmark overlay + logged data (distance, pace, duration)

3. **WeeklySummaryCard:**
   - "Week X of Y" header
   - 7 small circles representing Mon–Sun, filled with activity color if completed, hollow if pending, gray for rest days
   - "X.X / Y.Y miles this week" progress bar

4. **StreakCard:**
   - 🔥 fire icon + "X Day Streak" large number
   - "Personal best: Y days" subtitle

5. **QuickStatsRow** (3 small cards in a row):
   - This Week: X.X mi
   - This Month: X.X mi
   - Plan Progress: XX%

### 8.4 CalendarScreen (Calendar Tab)

**Header:**
- Month/Year title (e.g., "February 2026")
- Left/Right arrow buttons for month navigation
- "Month" | "Week" toggle pill buttons

**Month View (MonthView component):**
- Day-of-week header row: M T W T F S S
- 6-row grid of DayCell components
- Each DayCell:
  - Day number (top-left, small)
  - Activity color dot (matches `ACTIVITY_COLORS`)
  - Distance or duration text (e.g., "3 mi" or "30m")
  - If completed: small green checkmark (✓) in corner
  - If today: highlighted border (`ring-2 ring-primary-500`)
  - Days outside the training plan period: no color dot, grayed out
  - Days outside the current month: very faded
- Tapping a DayCell opens DayDetailSheet

**Week View (WeekView component):**
- Shows 7 day cards in a vertical scrollable list
- Each card:
  - Day name + date (e.g., "Monday, Feb 16")
  - Activity type badge with color
  - Distance/duration
  - Description from plan
  - Completion status (checkmark or "Log Run" button)
- Week navigation: prev/next arrows

**DayDetailSheet (Modal/Bottom Sheet):**
- Date + day name header
- Activity type with color badge
- Planned distance/duration
- Plan description
- If completed:
  - Logged: distance, duration, pace, notes
  - "Edit Run" button → `/log/:runId/edit`
  - "Delete Run" button (with confirmation)
- If not completed (and it's a run day):
  - "Log Run" button → `/log?planDayId=X`
- Close button / swipe down to dismiss

**Plan Progress Bar** at bottom of screen:
- "Plan Progress: XX% complete" with a horizontal progress bar

### 8.5 LogRunScreen (Log Tab)

Accessed either from tab bar (blank form) or from a plan day link (pre-filled).

**Header:** "Log Run" title. If editing: "Edit Run". Back button if navigated from elsewhere.

**Form fields:**

1. **Date** — Date picker. Default: today. Validation: cannot be in the future.
2. **Distance** — Numeric input with unit label (mi/km from settings). Pre-filled from plan day if `planDayId` query param.
3. **Duration** — Three inputs: Hours : Minutes : Seconds. All numeric.
4. **Run Type** — Dropdown/selector: Easy Run, Pace Run, Tempo Run, Long Run, Intervals, Race, Other. Pre-filled from plan day.
5. **Notes** — Multiline text input (optional). Placeholder: "How did it feel?"

**Auto-calculated Pace display:** Updates live as distance/duration change. Format: "X:XX /mi" or "/km". Shows below duration fields.

**If pre-filled from plan:** Show a "Planned: X mi [Type]" info bar at top of form.

**"Save Run" button:**
- Validates: distance > 0, duration > 0, date not future
- Inserts into `runs` table
- If `planDayId` is set, links the run to that plan day
- Shows success toast: "Run logged! 🎉"
- If this run completes a goal → show goal achievement toast
- If this run extends a streak milestone (7, 14, 30 days) → show streak toast
- If sync enabled → add to sync queue
- If sync enabled → post to activity feed (run_completed)
- Navigate back to previous screen

**If editing (`/log/:runId/edit`):**
- Load existing run data into form
- "Save Changes" button instead
- "Delete Run" button (red, with confirmation modal)

### 8.6 StatsScreen (Stats Tab)

**Header:** "Statistics"

**Date range filter:** Horizontal scrollable pills: "Week" | "Month" | "Plan" | "All Time". Default: "Plan" (if active plan exists) or "Month".

Date range logic:
- Week: current ISO week (Mon–Sun)
- Month: current calendar month
- Plan: active plan start date → today (or plan end date if completed)
- All Time: earliest run date → today

**Summary Cards Row** (horizontal scroll, 4 cards):
- Total Miles: X.X (with unit)
- Total Runs: X
- Avg Pace: X:XX /mi
- Longest Run: X.X mi

**MileageChart (Recharts BarChart):**
- Title: "Weekly Mileage"
- X-axis: Week labels (e.g., "W1", "W2", ... or date range)
- Y-axis: Distance
- Bars colored with `primary-500`
- Tooltip showing exact value on tap

**PaceChart (Recharts LineChart):**
- Title: "Pace Over Time"
- X-axis: Run dates
- Y-axis: Pace (min/mi or min/km) — inverted so lower (faster) is up
- Line with data points
- Colored with `accent-500`

**RunTypeChart (Recharts PieChart):**
- Title: "Run Type Breakdown"
- Slices colored with activity colors
- Legend below chart
- Shows count and total distance per type

**Goal Progress Section:**
- For each active goal: GoalProgress card with ProgressBar
- "Weekly Goal: X.X / Y.Y mi" or "Monthly Goal: X.X / Y.Y mi"
- ProgressBar filled with primary color, accent color when ≥100%

**Streaks & Records Section:**
- Current Streak: X days 🔥
- Longest Streak: X days
- Completed vs Scheduled: X / Y runs (with percentage)

### 8.7 ProfileScreen (Profile Tab)

**Header area:**
- Avatar circle (initials if no avatar) — large, centered
- Display name (or "Guest" if not signed in)
- If not signed in: "Create Account" button → `/auth`
- If signed in: email shown below name

**Stats summary row:** 3 items: Total Miles | Total Runs | Plans Completed

**Menu sections** (list of tappable rows):

**Training:**
- 📋 My Training Plans → `/profile/plans`
- 🌐 Community Plans → `/community` (badge: "Account Required" if not authed)
- 🎯 Mileage Goals → `/profile/goals`

**Social:**
- 👥 Friends & Social → `/social` (badge: "Account Required" if not authed)

**App:**
- ⚙️ Settings → `/profile/settings`

### 8.8 MyPlansScreen

**Header:** "My Plans" with back button

**Action buttons row:**
- "Create New" button → `/profile/plans/new`
- "Import JSON" button → opens file picker, reads JSON, calls `importPlan`, shows toast

**Plan list** (vertical, scrollable):
- Active plan section (if exists): PlanCard with "Active" badge, progress percentage, current week
- Other plans section: PlanCard for each non-active plan
- Each PlanCard shows: name, race_type badge, difficulty badge, duration_weeks, is_builtin indicator
- Tap → `/profile/plans/:planId`

### 8.9 PlanDetailScreen

**Header:** Plan name with back button

**Plan metadata section:**
- Race type badge + Difficulty badge + "X weeks" badge
- Description text
- "Built-in Plan" or "Custom Plan" label

**PlanPreview component** — scrollable calendar preview of the entire plan (all weeks visible, color-coded, compact)

**Action buttons:**
- If not active: "Start This Plan" → date picker modal → sets as active plan → toast → navigate to `/home`
- If active: "Currently Active — Week X" indicator
- "Duplicate & Edit" → duplicates plan, navigates to `/profile/plans/:newId/edit`
- If custom (not built-in): "Edit Plan" → `/profile/plans/:planId/edit`
- "Export JSON" → generates JSON, triggers file save/share
- If authed + sync enabled: "Share to Community" → publishes to `community_plans` table → toast
- If custom (not built-in): "Delete Plan" → confirmation modal → deletes → navigate back

### 8.10 PlanEditorScreen

Multi-step editor. Header: "Create Plan" or "Edit Plan" with back/cancel button.

**Step indicator:** 3 dots/pills showing current step: Metadata → Schedule → Preview

**Step 1 — Metadata:**
- Name input (required)
- Race Type selector: 5 buttons (5K, 10K, Half, Full, Other)
- Difficulty selector: 4 buttons (Beginner, Intermediate, Advanced, Custom)
- Description textarea
- Number of weeks stepper (1–30, default 8)
- "Next" button

**Step 2 — Schedule:**
- Horizontal week selector: scrollable row of week number pills (W1, W2, ..., WN)
- Selected week shows 7 day columns (Mon–Sun) as a row of cards
- Each day card shows:
  - Day label (Mon, Tue, etc.)
  - Current activity type color dot + label
  - Distance/duration
  - Tap → opens ActivityCellEditor modal
- **ActivityCellEditor modal:**
  - Activity type dropdown
  - If run type: Distance input (with unit label)
  - If cross_training: Duration input (minutes)
  - Description input
  - "Save" / "Cancel" buttons
- **"Copy Week" button:** Select source week → copies all 7 days to current week
- "Previous" / "Next" buttons

**Step 3 — Preview:**
- Full PlanPreview calendar view of all weeks
- Color-coded, read-only
- "Save Plan" button → inserts into SQLite → toast → navigate to plan detail
- "Back to Edit" button

### 8.11 CommunityPlansScreen (requires auth)

If not authed: show message "Sign in to browse community plans" + "Sign In" button → `/auth`

**Header:** "Community Plans" with back button

**Search bar** at top (debounced, searches by name)

**Filter row:** Race type pills (All, 5K, 10K, Half, Full). Difficulty pills (All, Beginner, Intermediate, Advanced).

**Sort dropdown:** Most Popular | Highest Rated | Newest

**Plan list** (CommunityPlanCard for each):
- Plan name, author name, race type badge, difficulty badge
- Star rating (★ X.X) + upvote count (▲ X)
- Duration: "X weeks"
- Tap → `/community/:planId`

Pull-to-refresh to reload.

### 8.12 CommunityPlanDetailScreen

**Header:** Plan name with back button

**Author section:** Avatar + display name + "Follow" button (if not already following)

**Metadata:** Race type, difficulty, duration, description

**Rating section:**
- Average rating display (★ X.X from Y ratings)
- User's rating: 5 tappable stars (tap to rate or update)
- Upvote button with count (toggle: filled/outlined)

**PlanPreview** — scrollable calendar of the plan

**"Import to My Plans" button** → copies plan to local SQLite as a custom plan → toast → navigate to `/profile/plans/:newId`

**Comments section:**
- List of PlanComment items: avatar, name, text, time ago
- Comment input at bottom: text field + "Post" button
- User can delete own comments (swipe or long-press → delete)

### 8.13 GoalsScreen

**Header:** "Mileage Goals" with back button

**"Add Goal" button** → opens modal:
- Goal type toggle: Weekly | Monthly
- Target value input (with unit label)
- For weekly: auto-calculates start/end as current week
- For monthly: auto-calculates start/end as current month
- "Save" button

**Goals list:**
- Each goal shows:
  - Type badge (Weekly/Monthly)
  - Target: X.X mi
  - ProgressBar: current / target
  - "X.X mi remaining" or "Goal reached! 🎉" if ≥100%
  - Date range
  - Tap → edit modal (same as add, pre-filled)
  - Swipe to delete (with confirmation)

If no goals: EmptyState "Set a mileage goal to track your progress" + "Add Goal" button

### 8.14 SettingsScreen

**Header:** "Settings" with back button

**Sections:**

**Preferences:**
- Units: "Miles" / "Kilometers" toggle. Changing units updates settings, does NOT convert existing data — just changes display label for new entries.
- Appearance: 3-option selector: "System" | "Light" | "Dark"

**Account:**
- If not signed in:
  - "Sign In" button → `/auth`
  - "Create Account" button → `/auth`
- If signed in:
  - Display name + email
  - "Sign Out" button (with confirmation)

**Cloud Sync (visible only if signed in):**
- Toggle: "Enable Cloud Sync" (this is the subscription gate — for now, just a toggle)
- If enabled:
  - Last synced: "2 minutes ago" or "Never"
  - "Sync Now" button → triggers manual sync
  - Sync status: "All synced ✓" or "X changes pending"

**Data & Backups:**
- "Export Full Backup (JSON)" → calls `exportFullBackup` + `backupToJson` → triggers share/save via Web Share API → file name `run-with-friends-backup-YYYY-MM-DD.json`. Toast: "Backup exported successfully"
- "Export Runs (CSV)" → calls `exportRunsCsv` → triggers share/save → file name `runs-export-YYYY-MM-DD.csv`. Toast: "Runs exported as CSV"
- "Restore from Backup" → file picker (accept `.json`) → reads file → calls `parseBackupJson` → shows confirmation modal: "This will replace your current data with the backup from [date]. Your built-in plans will be preserved. Continue?" → on confirm: calls `restoreFromBackup` → toast: "Restored X plans, Y runs, Z goals" → refreshes all contexts
- "Clear All Data" → confirmation modal ("This will delete all your runs, plans, and goals. This cannot be undone. Consider exporting a backup first.") → includes a "Export Backup First" secondary button + "Delete Everything" danger button → clears all SQLite tables (except settings) → re-seeds built-in plans → navigate to `/onboarding`

**About:**
- Version: "0.1.0"

### 8.15 SocialScreen (requires auth)

If not authed: message + "Sign In" button

**Header:** "Social"

**Tab bar** within screen: "Feed" | "Friends" | "Find"

**Feed tab:**
- Vertical list of ActivityFeedItem components
- Each item:
  - Avatar + display name + time ago
  - Activity description based on type:
    - `run_completed`: "Completed a X.X mi [type] run in XX:XX (X:XX/mi pace)"
    - `plan_started`: "Started the [Plan Name] training plan"
    - `plan_completed`: "Completed the [Plan Name] training plan! 🎉"
    - `goal_achieved`: "Reached their [weekly/monthly] goal of X.X mi!"
    - `streak_milestone`: "Hit a X-day training streak! 🔥"
  - Like button (❤️) with count
  - Comment button (💬) with count → expands inline comment list
- Pull-to-refresh
- If empty: "Follow some friends to see their activity here"

**Friends tab:**
- List of FriendCard components (people you follow)
- Each card: avatar, name, current plan name (or "No active plan"), last activity time
- Tap → `/social/user/:userId`
- "Unfollow" button on each

**Find tab:**
- Search input (by display name or email)
- Search results: list of Profile cards with "Follow" / "Following" button
- Debounced search (300ms)

### 8.16 FriendProfileScreen

**Header:** Friend's display name with back button

**Profile section:**
- Avatar (large) + name
- "Following ✓" / "Follow" button

**Stats row:** Total Miles | Current Streak | Plan Progress

**Current Plan section** (if they have an active plan):
- Plan name, race type, difficulty
- Current week / total weeks
- Progress bar

**Recent Runs** (last 10):
- List of RunCard: date, distance, duration, pace, type badge

### 8.17 UI Components — Key Specs

**Button** variants: `primary` (blue bg, white text), `secondary` (gray bg), `ghost` (transparent, text only), `danger` (red bg). Sizes: `sm`, `md`, `lg`. Full-width option. Loading state with spinner.

**Card**: `bg-white dark:bg-gray-900 rounded-2xl p-4 shadow-sm`. Optional `header` prop rendered as bold title.

**Modal**: Full-screen overlay with `bg-black/50`. Content slides up from bottom with `rounded-t-2xl` corners. Close via X button or swipe down or tap outside.

**Toast**: Fixed position at top. Rounded pill. Colors: success=green, error=red, info=blue. Fade in/out animation. Auto-dismiss.

**ProgressBar**: Height 8px, rounded-full. Background: `bg-gray-200 dark:bg-gray-700`. Fill: `bg-primary-500` (or `bg-accent-500` when ≥100%).

**ProgressRing**: SVG-based circular progress. Shows percentage in center.

**Badge**: Small rounded pill with colored background. Used for race type, difficulty, activity type labels.

**EmptyState**: Centered layout with large icon/emoji, title text, description text, optional action button.

**TabBar**: Fixed at bottom, height 80px (with safe area padding). 5 evenly-spaced items. Active tab: `text-primary-500`, inactive: `text-gray-400`. Center tab (Log) has larger icon with `bg-primary-500` circle.

---

## 9. Service Layer

### 9.1 `services/database.ts`

```typescript
// Exports:
export const MIGRATION_SQL: string;      // All CREATE TABLE + CREATE INDEX statements from Section 5.1
export const DEFAULT_SETTINGS: { key: string; value: string }[];
export async function initDatabase(db: Database): Promise<void>;  // Runs migrations + seeds
export async function seedBuiltinPlans(db: Database): Promise<void>;
export async function querySetting(db: Database, key: string): Promise<string | null>;
export async function updateSetting(db: Database, key: string, value: string): Promise<void>;
```

### 9.2 `services/supabaseClient.ts`

```typescript
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string;

const supabase = createClient(supabaseUrl, supabaseAnonKey);
export default supabase;
```

### 9.3 `services/planService.ts`

All functions take `db: Database` as first parameter. All return Promises.

```typescript
export async function getAllPlans(db): Promise<TrainingPlan[]>;
export async function getPlanById(db, id: string): Promise<TrainingPlan | null>;
export async function getPlanDays(db, planId: string): Promise<PlanDay[]>;
export async function getActivePlan(db): Promise<ActivePlan | null>;
export async function createPlan(db, plan: InsertTrainingPlan, days: InsertPlanDay[]): Promise<string>;
export async function updatePlan(db, id: string, updates: Partial<TrainingPlan>): Promise<void>;
export async function updatePlanDays(db, planId: string, days: InsertPlanDay[]): Promise<void>;  // deletes old days, inserts new
export async function deletePlan(db, id: string): Promise<void>;
export async function setActivePlan(db, planId: string, startDate: string): Promise<string>;  // deactivates previous, inserts new
export async function clearActivePlan(db): Promise<void>;
export async function addToSyncQueue(db, table: string, recordId: string, action: string, payload: unknown): Promise<void>;
```

### 9.4 `services/runService.ts`

```typescript
export async function getAllRuns(db): Promise<Run[]>;
export async function getRunsByDateRange(db, start: string, end: string): Promise<Run[]>;
export async function getRunByPlanDayId(db, planDayId: string): Promise<Run | null>;
export async function createRun(db, run: InsertRun): Promise<string>;
export async function updateRun(db, id: string, updates: Partial<Run>): Promise<void>;
export async function deleteRun(db, id: string): Promise<void>;
```

### 9.5 `services/goalService.ts`

```typescript
export async function getAllGoals(db): Promise<Goal[]>;
export async function createGoal(db, goal: InsertGoal): Promise<string>;
export async function updateGoal(db, id: string, updates: Partial<Goal>): Promise<void>;
export async function deleteGoal(db, id: string): Promise<void>;
export async function getGoalMileage(db, startDate: string, endDate: string): Promise<number>;
```

### 9.6 `services/statsService.ts`

All take `db: Database` and a date range.

```typescript
export async function getRunStats(db, start: string, end: string): Promise<RunStats>;
export async function getWeeklyMileage(db, start: string, end: string): Promise<{ week: string; miles: number }[]>;
export async function getPaceOverTime(db, start: string, end: string): Promise<{ date: string; pace: number }[]>;
export async function getRunTypeBreakdown(db, start: string, end: string): Promise<{ type: RunType; count: number; distance: number }[]>;
export async function getCurrentStreak(db, planDays: PlanDay[], activePlan: ActivePlan | null, runs: Run[]): number;
export async function getLongestStreak(db, planDays: PlanDay[], activePlan: ActivePlan | null, runs: Run[]): number;
```

### 9.7 `services/syncService.ts`

```typescript
export async function performSync(db: Database, userId: string): Promise<{ pushed: number; pulled: number; errors: string[] }>;
export async function pushLocalChanges(db: Database, userId: string): Promise<number>;
export async function pullRemoteChanges(db: Database, userId: string): Promise<number>;
export async function addToSyncQueue(db: Database, tableName: string, recordId: string, action: 'upsert' | 'delete', payload: unknown): Promise<void>;
export async function clearSyncQueue(db: Database, recordIds: string[]): Promise<void>;
```

**Sync protocol (Section 10 has more detail):**

`pushLocalChanges`:
1. Read all records from `sync_queue`
2. Group by table_name
3. For each group, upsert/delete to corresponding Supabase table (adding `user_id` field)
4. On success, remove from `sync_queue` and update `sync_status` to 'synced' on the source record

`pullRemoteChanges`:
1. For each syncable table, query Supabase for records with `updated_at > last_sync_at`
2. For each remote record:
   - If local record doesn't exist → insert locally with `sync_status = 'synced'`
   - If local record exists and `sync_status = 'synced'` → update locally (remote wins)
   - If local record exists and `sync_status = 'dirty'` → compare `updated_at`, keep newer (last-write-wins)
3. Update `last_sync_at` setting

### 9.8 `services/socialService.ts`

```typescript
export async function getFollowing(userId: string): Promise<Profile[]>;
export async function getFollowers(userId: string): Promise<Profile[]>;
export async function followUser(followerId: string, followingId: string): Promise<void>;
export async function unfollowUser(followerId: string, followingId: string): Promise<void>;
export async function searchProfiles(query: string): Promise<Profile[]>;
export async function getFeed(userId: string, limit?: number, offset?: number): Promise<FeedItem[]>;
export async function postFeedItem(userId: string, type: FeedActivityType, data: Record<string, unknown>): Promise<void>;
export async function likeActivity(userId: string, activityId: string): Promise<void>;
export async function unlikeActivity(userId: string, activityId: string): Promise<void>;
export async function getActivityComments(activityId: string): Promise<FeedComment[]>;
export async function postComment(userId: string, activityId: string, text: string): Promise<void>;
export async function deleteComment(commentId: string): Promise<void>;
export async function getUserProfile(userId: string): Promise<Profile>;
export async function getUserRuns(userId: string, limit?: number): Promise<Run[]>;
export async function getUserActivePlan(userId: string): Promise<ActivePlan | null>;
```

### 9.9 `services/communityService.ts`

```typescript
export async function getCommunityPlans(filters: {
  race_type?: RaceType;
  difficulty?: Difficulty;
  search?: string;
  sort?: 'popular' | 'rated' | 'newest';
  limit?: number;
  offset?: number;
}): Promise<CommunityPlan[]>;

export async function getCommunityPlanById(planId: string): Promise<CommunityPlan>;
export async function publishPlan(authorId: string, planExport: PlanExportFormat): Promise<void>;
export async function ratePlan(userId: string, planId: string, rating: number): Promise<void>;
export async function upvotePlan(userId: string, planId: string): Promise<void>;
export async function removeUpvote(userId: string, planId: string): Promise<void>;
export async function getPlanComments(planId: string): Promise<PlanComment[]>;
export async function postPlanComment(userId: string, planId: string, text: string): Promise<void>;
export async function deletePlanComment(commentId: string): Promise<void>;
```

### 9.10 `services/backupService.ts`

Handles full data export, import/restore, and CSV export. All functions take `db: Database` as first parameter.

```typescript
// ── Full JSON Backup ──

// Reads ALL user data from SQLite and returns a FullBackup object.
// Includes: settings, all training_plans (custom only — built-in plans are
// re-seeded on restore), all plan_days for those plans, active_plan, all runs, all goals.
export async function exportFullBackup(db: Database): Promise<FullBackup>;

// Serializes a FullBackup to a formatted JSON string ready for file save.
export function backupToJson(backup: FullBackup): string;

// ── Full JSON Restore ──

// Parses a JSON string into a FullBackup. Validates the `version` field
// and all required keys. Throws a descriptive error on invalid data.
export function parseBackupJson(json: string): FullBackup;

// Restores data from a FullBackup:
//  1. Clears all rows from: runs, goals, active_plan, plan_days, training_plans (WHERE is_builtin = 0)
//  2. Inserts all records from the backup
//  3. Re-seeds built-in plans if they are missing (in case schema changed between versions)
//  4. Restores settings (units, dark_mode) — does NOT overwrite onboarding_complete or sync_enabled
//  5. Sets all restored records' sync_status to 'dirty' so they sync on next push
// Returns a summary: { plans: number, runs: number, goals: number }
export async function restoreFromBackup(db: Database, backup: FullBackup): Promise<{ plans: number; runs: number; goals: number }>;

// ── Runs CSV Export ──

// Queries all runs (optionally filtered by date range), converts each to
// a RunCsvRow, and returns a CSV string with headers.
// Columns: Date, Distance, Unit, Duration, Pace, Type, Planned, Notes
export async function exportRunsCsv(db: Database, startDate?: string, endDate?: string): Promise<string>;

// ── Individual Plan Export ──
// (Already covered by PlanContext.exportPlan — included here for completeness)
// Builds a PlanExportFormat JSON from a plan_id.
export async function exportPlanJson(db: Database, planId: string): Promise<string>;

// Parses a PlanExportFormat JSON string, validates structure, and imports
// as a new custom plan. Returns the new plan's id.
export async function importPlanJson(db: Database, json: string): Promise<string>;
```

**Export file naming convention:**
- Full backup: `run-with-friends-backup-YYYY-MM-DD.json`
- Runs CSV: `runs-export-YYYY-MM-DD.csv`
- Single plan: `plan-{plan-name-slugified}.json`

**File save/share:** Use the Web Share API (`navigator.share`) when available (iOS Safari/WKWebView supports it). Create a `Blob` from the string, construct a `File` object, and pass to `navigator.share({ files: [file] })`. This lets the user save to Files, AirDrop, email, etc. Fallback: create a download link via `URL.createObjectURL`.

---

## 10. Sync Protocol Detail

### Syncable Tables Mapping

| Local SQLite Table | Supabase Table | Extra Supabase Column |
|---|---|---|
| training_plans | training_plans | user_id |
| plan_days | plan_days | — (inherits via plan_id) |
| active_plan | active_plans | user_id |
| runs | runs | user_id |
| goals | goals | user_id |

### Sync Flow

**On `logRun`, `createPlan`, `updatePlan`, `deletePlan`, `setActivePlan`, `addGoal`, etc.:**
1. Write to SQLite immediately (set `sync_status = 'dirty'` if sync enabled, `'local'` if not)
2. If sync enabled → insert/update `sync_queue` row with `table_name`, `record_id`, `action`, `payload` (JSON of the full record)

**Periodic sync (when app comes to foreground, or manual "Sync Now"):**
1. Call `performSync(db, userId)`
2. `pushLocalChanges`: process sync_queue → upsert to Supabase
3. `pullRemoteChanges`: fetch records updated since `last_sync_at` → merge locally
4. Update `last_sync_at` in settings
5. Update UI sync status indicators

**Conflict resolution: Last-write-wins** using `updated_at` timestamps. All timestamps are UTC ISO 8601.

**On enabling sync for the first time:**
1. All existing local records have `sync_status = 'local'`
2. Mark all as 'dirty' → triggers full push on next sync
3. Run full sync

---

## 11. Built-in Training Plans

### Plan Data Format

Each plan is defined as a `PlanExportFormat` object in `src/utils/planSeedData.ts`. The seed function iterates these, generating UUIDs for each plan and plan_day, and inserts them into SQLite with `is_builtin = 1`.

### Compact Schedule Notation

In the tables below:
- **R** = rest
- **CT(N)** = cross_training, N minutes
- **E(N)** = easy_run, N miles
- **P(N)** = pace_run, N miles
- **T(N)** = tempo_run, N miles
- **L(N)** = long_run, N miles
- **I(N)** = intervals, N miles
- **RC(N)** = race, N miles

Day order: Mon, Tue, Wed, Thu, Fri, Sat, Sun

---

### 5K Beginner (8 weeks)

**Description:** "Build up to running your first 5K. Starts with short easy runs and gradually increases distance. Perfect for new runners."

| Week | Mon | Tue | Wed | Thu | Fri | Sat | Sun |
|------|-----|-----|-----|-----|-----|-----|-----|
| 1 | R | E(1.5) | CT(20) | E(1.5) | R | E(2) | R |
| 2 | R | E(2) | CT(20) | E(2) | R | E(2.5) | R |
| 3 | R | E(2) | CT(25) | E(2.5) | R | E(3) | R |
| 4 | R | E(2.5) | CT(25) | E(2.5) | R | L(3) | R |
| 5 | R | E(2.5) | CT(30) | E(3) | R | L(3.5) | R |
| 6 | R | E(3) | CT(30) | P(2) | R | L(4) | R |
| 7 | R | E(3) | CT(30) | P(2.5) | R | L(3) | R |
| 8 | R | E(2) | R | E(1.5) | R | RC(3.1) | R |

### 5K Intermediate (8 weeks)

**Description:** "Improve your 5K time with tempo runs and intervals. Assumes a base of 3 miles comfortably."

| Week | Mon | Tue | Wed | Thu | Fri | Sat | Sun |
|------|-----|-----|-----|-----|-----|-----|-----|
| 1 | R | E(3) | CT(30) | T(3) | R | L(4) | R |
| 2 | R | E(3) | CT(30) | I(3) | R | L(5) | R |
| 3 | R | E(3.5) | CT(30) | T(3.5) | R | L(5) | R |
| 4 | R | E(3) | CT(30) | I(3.5) | R | L(6) | R |
| 5 | R | E(4) | CT(30) | T(4) | R | L(6) | R |
| 6 | R | E(4) | CT(30) | I(4) | R | L(5) | R |
| 7 | R | E(3) | CT(30) | T(3) | R | L(4) | R |
| 8 | R | E(2) | R | E(2) | R | RC(3.1) | R |

### 5K Advanced (8 weeks)

**Description:** "High-intensity 5K prep with aggressive interval work and higher weekly mileage for experienced runners."

| Week | Mon | Tue | Wed | Thu | Fri | Sat | Sun |
|------|-----|-----|-----|-----|-----|-----|-----|
| 1 | E(4) | I(4) | CT(30) | T(4) | R | L(6) | R |
| 2 | E(4) | I(5) | CT(30) | T(4) | R | L(7) | R |
| 3 | E(5) | I(5) | CT(30) | T(5) | R | L(8) | R |
| 4 | E(4) | I(4) | CT(30) | T(4) | R | L(6) | R |
| 5 | E(5) | I(5) | CT(30) | T(5) | R | L(8) | R |
| 6 | E(5) | I(6) | CT(30) | T(5) | R | L(8) | R |
| 7 | E(4) | I(4) | CT(30) | T(3) | R | L(5) | R |
| 8 | R | E(3) | R | E(2) | R | RC(3.1) | R |

### 10K Beginner (10 weeks)

**Description:** "Your first 10K! Gradually builds endurance from a 2-mile base to race-ready over 10 weeks."

| Week | Mon | Tue | Wed | Thu | Fri | Sat | Sun |
|------|-----|-----|-----|-----|-----|-----|-----|
| 1 | R | E(2) | CT(20) | E(2) | R | L(3) | R |
| 2 | R | E(2.5) | CT(20) | E(2.5) | R | L(3.5) | R |
| 3 | R | E(3) | CT(25) | E(3) | R | L(4) | R |
| 4 | R | E(3) | CT(25) | P(2) | R | L(4.5) | R |
| 5 | R | E(3) | CT(30) | P(2.5) | R | L(5) | R |
| 6 | R | E(3.5) | CT(30) | P(3) | R | L(5.5) | R |
| 7 | R | E(3.5) | CT(30) | P(3) | R | L(6) | R |
| 8 | R | E(4) | CT(30) | P(3) | R | L(6) | R |
| 9 | R | E(3) | CT(30) | P(2) | R | L(4) | R |
| 10 | R | E(2) | R | E(2) | R | RC(6.2) | R |

### 10K Intermediate (10 weeks)

**Description:** "Sharpen your 10K with tempo and interval sessions. Builds on a solid 4-mile base."

| Week | Mon | Tue | Wed | Thu | Fri | Sat | Sun |
|------|-----|-----|-----|-----|-----|-----|-----|
| 1 | R | E(4) | CT(30) | T(3) | R | L(5) | R |
| 2 | R | E(4) | CT(30) | I(4) | R | L(6) | R |
| 3 | R | E(4) | CT(30) | T(4) | R | L(7) | R |
| 4 | R | E(4) | CT(30) | I(4) | R | L(7) | R |
| 5 | R | E(5) | CT(30) | T(4) | R | L(8) | R |
| 6 | R | E(5) | CT(30) | I(5) | R | L(8) | R |
| 7 | R | E(5) | CT(30) | T(5) | R | L(8) | R |
| 8 | R | E(5) | CT(30) | I(5) | R | L(7) | R |
| 9 | R | E(4) | CT(30) | T(3) | R | L(5) | R |
| 10 | R | E(3) | R | E(2) | R | RC(6.2) | R |

### 10K Advanced (10 weeks)

**Description:** "Aggressive 10K race prep with high mileage, intervals, and tempo work for competitive runners."

| Week | Mon | Tue | Wed | Thu | Fri | Sat | Sun |
|------|-----|-----|-----|-----|-----|-----|-----|
| 1 | E(5) | I(5) | CT(30) | T(4) | R | L(7) | R |
| 2 | E(5) | I(5) | CT(30) | T(5) | R | L(8) | R |
| 3 | E(5) | I(6) | CT(30) | T(5) | R | L(9) | R |
| 4 | E(4) | I(4) | CT(30) | T(4) | R | L(7) | R |
| 5 | E(5) | I(6) | CT(30) | T(5) | R | L(9) | R |
| 6 | E(6) | I(6) | CT(30) | T(6) | R | L(10) | R |
| 7 | E(6) | I(6) | CT(30) | T(6) | R | L(10) | R |
| 8 | E(5) | I(5) | CT(30) | T(5) | R | L(8) | R |
| 9 | R | E(4) | CT(30) | T(3) | R | L(6) | R |
| 10 | R | E(3) | R | E(2) | R | RC(6.2) | R |

### Half Marathon Beginner (12 weeks)

**Description:** "Train for your first half marathon. Gradually builds your long run to 11 miles with proper recovery weeks."

| Week | Mon | Tue | Wed | Thu | Fri | Sat | Sun |
|------|-----|-----|-----|-----|-----|-----|-----|
| 1 | R | E(3) | CT(30) | E(3) | R | L(4) | R |
| 2 | R | E(3) | CT(30) | E(3) | R | L(5) | R |
| 3 | R | E(3.5) | CT(30) | P(3) | R | L(6) | R |
| 4 | R | E(3) | CT(30) | E(3) | R | L(5) | R |
| 5 | R | E(4) | CT(30) | P(3) | R | L(7) | R |
| 6 | R | E(4) | CT(30) | P(3.5) | R | L(8) | R |
| 7 | R | E(4) | CT(30) | P(4) | R | L(9) | R |
| 8 | R | E(4) | CT(30) | P(3) | R | L(7) | R |
| 9 | R | E(4) | CT(30) | P(4) | R | L(10) | R |
| 10 | R | E(4) | CT(30) | P(4) | R | L(11) | R |
| 11 | R | E(3) | CT(30) | P(3) | R | L(8) | R |
| 12 | R | E(3) | R | E(2) | R | RC(13.1) | R |

### Half Marathon Intermediate (12 weeks)

**Description:** "Improve your half marathon performance with tempo runs, intervals, and structured long runs up to 12 miles."

| Week | Mon | Tue | Wed | Thu | Fri | Sat | Sun |
|------|-----|-----|-----|-----|-----|-----|-----|
| 1 | R | E(4) | CT(30) | T(4) | R | L(6) | R |
| 2 | R | E(4) | CT(30) | I(4) | R | L(7) | R |
| 3 | R | E(5) | CT(30) | T(5) | R | L(8) | R |
| 4 | R | E(4) | CT(30) | I(3) | R | L(6) | R |
| 5 | R | E(5) | CT(30) | T(5) | R | L(9) | R |
| 6 | R | E(5) | CT(30) | I(5) | R | L(10) | R |
| 7 | R | E(5) | CT(30) | T(5) | R | L(10) | R |
| 8 | R | E(4) | CT(30) | I(4) | R | L(8) | R |
| 9 | R | E(5) | CT(30) | T(5) | R | L(11) | R |
| 10 | R | E(5) | CT(30) | I(5) | R | L(12) | R |
| 11 | R | E(4) | CT(30) | T(3) | R | L(8) | R |
| 12 | R | E(3) | R | E(2) | R | RC(13.1) | R |

### Half Marathon Advanced (12 weeks)

**Description:** "Race-focused half marathon plan with high mileage, aggressive tempo work, and long runs up to 14 miles."

| Week | Mon | Tue | Wed | Thu | Fri | Sat | Sun |
|------|-----|-----|-----|-----|-----|-----|-----|
| 1 | E(5) | I(5) | CT(30) | T(5) | R | L(8) | R |
| 2 | E(5) | I(6) | CT(30) | T(5) | R | L(10) | R |
| 3 | E(6) | I(6) | CT(30) | T(6) | R | L(11) | R |
| 4 | E(4) | I(4) | CT(30) | T(4) | R | L(8) | R |
| 5 | E(6) | I(6) | CT(30) | T(6) | R | L(12) | R |
| 6 | E(6) | I(7) | CT(30) | T(6) | R | L(12) | R |
| 7 | E(6) | I(7) | CT(30) | T(6) | R | L(13) | R |
| 8 | E(5) | I(5) | CT(30) | T(4) | R | L(10) | R |
| 9 | E(6) | I(6) | CT(30) | T(6) | R | L(14) | R |
| 10 | E(6) | I(6) | CT(30) | T(6) | R | L(12) | R |
| 11 | E(5) | I(4) | CT(30) | T(3) | R | L(8) | R |
| 12 | R | E(3) | R | E(2) | R | RC(13.1) | R |

### Full Marathon Beginner (16 weeks)

**Description:** "Your first marathon! Conservative build-up with recovery weeks every 4th week. Long run peaks at 20 miles."

| Week | Mon | Tue | Wed | Thu | Fri | Sat | Sun |
|------|-----|-----|-----|-----|-----|-----|-----|
| 1 | R | E(3) | CT(30) | E(3) | R | L(5) | R |
| 2 | R | E(3) | CT(30) | E(3.5) | R | L(6) | R |
| 3 | R | E(4) | CT(30) | P(3) | R | L(7) | R |
| 4 | R | E(3) | CT(30) | E(3) | R | L(5) | R |
| 5 | R | E(4) | CT(30) | P(3) | R | L(8) | R |
| 6 | R | E(4) | CT(30) | P(4) | R | L(9) | R |
| 7 | R | E(4) | CT(30) | P(4) | R | L(10) | R |
| 8 | R | E(3) | CT(30) | P(3) | R | L(8) | R |
| 9 | R | E(5) | CT(30) | P(4) | R | L(12) | R |
| 10 | R | E(5) | CT(30) | P(4) | R | L(14) | R |
| 11 | R | E(5) | CT(30) | P(5) | R | L(16) | R |
| 12 | R | E(4) | CT(30) | P(3) | R | L(12) | R |
| 13 | R | E(5) | CT(30) | P(5) | R | L(18) | R |
| 14 | R | E(5) | CT(30) | P(5) | R | L(20) | R |
| 15 | R | E(4) | CT(30) | P(3) | R | L(12) | R |
| 16 | R | E(3) | R | E(2) | R | RC(26.2) | R |

### Full Marathon Intermediate (16 weeks)

**Description:** "Step up your marathon with tempo and interval sessions. Builds to 20 miles with structured quality workouts."

| Week | Mon | Tue | Wed | Thu | Fri | Sat | Sun |
|------|-----|-----|-----|-----|-----|-----|-----|
| 1 | R | E(5) | CT(30) | T(4) | R | L(8) | R |
| 2 | R | E(5) | CT(30) | I(4) | R | L(10) | R |
| 3 | R | E(5) | CT(30) | T(5) | R | L(11) | R |
| 4 | R | E(4) | CT(30) | I(3) | R | L(8) | R |
| 5 | R | E(5) | CT(30) | T(5) | R | L(12) | R |
| 6 | R | E(6) | CT(30) | I(5) | R | L(14) | R |
| 7 | R | E(6) | CT(30) | T(5) | R | L(15) | R |
| 8 | R | E(4) | CT(30) | I(4) | R | L(10) | R |
| 9 | R | E(6) | CT(30) | T(6) | R | L(16) | R |
| 10 | R | E(6) | CT(30) | I(6) | R | L(18) | R |
| 11 | R | E(6) | CT(30) | T(6) | R | L(18) | R |
| 12 | R | E(5) | CT(30) | I(4) | R | L(14) | R |
| 13 | R | E(6) | CT(30) | T(6) | R | L(20) | R |
| 14 | R | E(5) | CT(30) | I(5) | R | L(16) | R |
| 15 | R | E(4) | CT(30) | T(3) | R | L(10) | R |
| 16 | R | E(3) | R | E(2) | R | RC(26.2) | R |

### Full Marathon Advanced (16 weeks)

**Description:** "Elite marathon prep. High weekly mileage with aggressive speed work, peaking at 22-mile long runs."

| Week | Mon | Tue | Wed | Thu | Fri | Sat | Sun |
|------|-----|-----|-----|-----|-----|-----|-----|
| 1 | E(6) | I(6) | CT(30) | T(5) | R | L(10) | R |
| 2 | E(6) | I(7) | CT(30) | T(6) | R | L(12) | R |
| 3 | E(7) | I(7) | CT(30) | T(6) | R | L(14) | R |
| 4 | E(5) | I(5) | CT(30) | T(4) | R | L(10) | R |
| 5 | E(7) | I(7) | CT(30) | T(7) | R | L(15) | R |
| 6 | E(7) | I(8) | CT(30) | T(7) | R | L(16) | R |
| 7 | E(7) | I(8) | CT(30) | T(7) | R | L(18) | R |
| 8 | E(5) | I(5) | CT(30) | T(5) | R | L(12) | R |
| 9 | E(7) | I(8) | CT(30) | T(7) | R | L(18) | R |
| 10 | E(8) | I(8) | CT(30) | T(7) | R | L(20) | R |
| 11 | E(8) | I(8) | CT(30) | T(7) | R | L(20) | R |
| 12 | E(6) | I(6) | CT(30) | T(5) | R | L(14) | R |
| 13 | E(7) | I(8) | CT(30) | T(7) | R | L(22) | R |
| 14 | E(6) | I(6) | CT(30) | T(6) | R | L(16) | R |
| 15 | E(5) | I(4) | CT(30) | T(3) | R | L(10) | R |
| 16 | R | E(3) | R | E(2) | R | RC(26.2) | R |

### Implementation Notes for `planSeedData.ts`

Export an array of `PlanExportFormat` objects. Use a helper to convert the compact notation above. Example structure:

```typescript
export const BUILTIN_PLANS: PlanExportFormat[] = [
  {
    version: 1,
    plan: {
      name: "5K Beginner",
      race_type: "5k",
      difficulty: "beginner",
      description: "Build up to running your first 5K...",
      duration_weeks: 8,
      schedule: [
        {
          week: 1,
          days: [
            { day: 0, type: "rest" },
            { day: 1, type: "easy_run", distance: 1.5, distance_unit: "mi" },
            { day: 2, type: "cross_training", duration: 20, description: "Swimming, cycling, or yoga" },
            { day: 3, type: "easy_run", distance: 1.5, distance_unit: "mi" },
            { day: 4, type: "rest" },
            { day: 5, type: "easy_run", distance: 2, distance_unit: "mi" },
            { day: 6, type: "rest" },
          ],
        },
        // ... remaining weeks
      ],
    },
  },
  // ... remaining 11 plans
];
```

All 12 plans must be fully defined in this file — no placeholders.

---

## 12. Utilities

### 12.1 `utils/restDayMessages.ts`

Export an array of strings. Pick randomly on each render.

```typescript
export const REST_DAY_MESSAGES: string[] = [
  "Recovery is when your body gets stronger. Enjoy the rest! 💪",
  "Rest days are training days too. Your muscles are rebuilding.",
  "Great job sticking to the plan. Recharge for tomorrow.",
  "Active recovery tip: stretch, foam roll, or take an easy walk.",
  "The best athletes know when to rest. You're doing it right.",
  "Your body adapts during rest. Trust the process.",
  "Take it easy today. Tomorrow's run will thank you.",
  "Rest, refuel, repeat. You've earned this day off.",
  "Recovery isn't lazy — it's strategic. 🧠",
  "Let your legs recover. They've been working hard for you.",
];
```

### 12.2 `utils/paceUtils.ts`

```typescript
// Calculate pace in seconds per unit from distance and duration
export function calculatePace(distanceValue: number, durationSeconds: number): number;

// Format pace as "X:XX" string
export function formatPace(secondsPerUnit: number): string;

// Format duration as "Xh Xm Xs" or "XX:XX:XX"
export function formatDuration(totalSeconds: number): string;

// Parse hours, minutes, seconds inputs to total seconds
export function parseDuration(hours: number, minutes: number, seconds: number): number;
```

### 12.3 `utils/unitConversion.ts`

```typescript
export const MI_TO_KM = 1.60934;
export const KM_TO_MI = 0.621371;

export function milesToKm(miles: number): number;
export function kmToMiles(km: number): number;
export function convertDistance(value: number, from: DistanceUnit, to: DistanceUnit): number;
export function formatDistance(value: number, unit: DistanceUnit, decimals?: number): string;
// Returns "X.X mi" or "X.X km"
```

### 12.4 `utils/dateUtils.ts`

```typescript
// Get ISO date string for today
export function today(): string; // 'YYYY-MM-DD'

// Get the Monday of the current week
export function startOfCurrentWeek(): string;

// Get start/end of current month
export function startOfCurrentMonth(): string;
export function endOfCurrentMonth(): string;

// Calculate which plan day corresponds to a given date
export function dateToPlanDay(date: string, startDate: string): { weekNumber: number; dayOfWeek: number } | null;

// Calculate the calendar date for a given plan day
export function planDayToDate(weekNumber: number, dayOfWeek: number, startDate: string): string;

// Get all dates for a month grid (includes overflow from prev/next months)
export function getMonthGrid(year: number, month: number): string[]; // 42 dates (6 rows × 7 cols)

// Format date for display
export function formatDateShort(date: string): string; // "Feb 16"
export function formatDateFull(date: string): string; // "Monday, February 16, 2026"
export function timeAgo(isoTimestamp: string): string; // "2 minutes ago", "3 hours ago", etc.
```

### 12.5 `utils/colors.ts`

```typescript
// Same as ACTIVITY_COLORS in types but also export Tailwind class versions
export const ACTIVITY_BG_CLASSES: Record<ActivityType, string> = {
  rest: 'bg-activity-rest',
  cross_training: 'bg-activity-cross',
  easy_run: 'bg-activity-easy',
  pace_run: 'bg-activity-pace',
  tempo_run: 'bg-activity-tempo',
  long_run: 'bg-activity-long',
  intervals: 'bg-activity-intervals',
  race: 'bg-activity-race',
};

export const ACTIVITY_TEXT_CLASSES: Record<ActivityType, string> = {
  rest: 'text-activity-rest',
  cross_training: 'text-activity-cross',
  // ... etc
};
```

---

## 13. Styling & Dark Mode

### Color Palette

- **Primary:** Blue (`primary-500: #3b82f6`) — buttons, active states, links
- **Accent:** Orange (`accent-500: #f97316`) — highlights, achievements, celebrations
- **Background:** White / Gray-950 (dark)
- **Surface (cards):** White / Gray-900 (dark)
- **Text:** Gray-900 / Gray-100 (dark)
- **Muted text:** Gray-500 / Gray-400 (dark)
- **Border:** Gray-200 / Gray-800 (dark)
- **Activity colors:** See `tailwind.config.js` `activity` colors

### Dark Mode Implementation

`useDarkMode` hook:
1. Read `dark_mode` setting from SettingsContext
2. If 'system' → use `window.matchMedia('(prefers-color-scheme: dark)')` with listener
3. If 'light' → force light
4. If 'dark' → force dark
5. Add/remove `dark` class on `document.documentElement`

### Global CSS (`src/index.css`)

```css
@tailwind base;
@tailwind components;
@tailwind utilities;

@layer base {
  html {
    -webkit-tap-highlight-color: transparent;
    -webkit-font-smoothing: antialiased;
  }
  body {
    @apply bg-white dark:bg-gray-950 text-gray-900 dark:text-gray-100;
    font-family: -apple-system, BlinkMacSystemFont, 'SF Pro Text', 'Helvetica Neue', sans-serif;
    padding-top: env(safe-area-inset-top);
    padding-bottom: env(safe-area-inset-bottom);
  }
}

@layer components {
  .safe-bottom {
    padding-bottom: calc(env(safe-area-inset-bottom) + 80px); /* tab bar height */
  }
}
```

All screen containers should have `safe-bottom` class to prevent content from being hidden behind the tab bar.

---

## 14. CI/CD Pipeline

### `.github/workflows/deploy-testflight.yml`

```yaml
name: Deploy to TestFlight

on:
  push:
    tags:
      - 'v*'
  workflow_dispatch:

env:
  CARGO_TERM_COLOR: always

jobs:
  build-and-deploy:
    runs-on: macos-14
    timeout-minutes: 60

    steps:
      - name: Checkout
        uses: actions/checkout@v4

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'npm'

      - name: Install Rust toolchain
        uses: dtolnay/rust-toolchain@stable
        with:
          targets: aarch64-apple-ios

      - name: Rust cache
        uses: Swatinem/rust-cache@v2
        with:
          workspaces: src-tauri

      - name: Install dependencies
        run: npm ci

      - name: Create .env
        run: |
          echo "VITE_SUPABASE_URL=${{ secrets.SUPABASE_URL }}" >> .env
          echo "VITE_SUPABASE_ANON_KEY=${{ secrets.SUPABASE_ANON_KEY }}" >> .env

      - name: Install Apple certificate and provisioning profile
        env:
          BUILD_CERTIFICATE_BASE64: ${{ secrets.BUILD_CERTIFICATE_BASE64 }}
          P12_PASSWORD: ${{ secrets.P12_PASSWORD }}
          BUILD_PROVISION_PROFILE_BASE64: ${{ secrets.BUILD_PROVISION_PROFILE_BASE64 }}
          KEYCHAIN_PASSWORD: ${{ secrets.KEYCHAIN_PASSWORD }}
        run: |
          CERTIFICATE_PATH=$RUNNER_TEMP/build_certificate.p12
          PP_PATH=$RUNNER_TEMP/build_pp.mobileprovision
          KEYCHAIN_PATH=$RUNNER_TEMP/app-signing.keychain-db

          echo -n "$BUILD_CERTIFICATE_BASE64" | base64 --decode -o $CERTIFICATE_PATH
          echo -n "$BUILD_PROVISION_PROFILE_BASE64" | base64 --decode -o $PP_PATH

          security create-keychain -p "$KEYCHAIN_PASSWORD" $KEYCHAIN_PATH
          security set-keychain-settings -lut 21600 $KEYCHAIN_PATH
          security unlock-keychain -p "$KEYCHAIN_PASSWORD" $KEYCHAIN_PATH

          security import $CERTIFICATE_PATH -P "$P12_PASSWORD" -A -t cert -f pkcs12 -k $KEYCHAIN_PATH
          security set-key-partition-list -S apple-tool:,apple: -k "$KEYCHAIN_PASSWORD" $KEYCHAIN_PATH
          security list-keychain -d user -s $KEYCHAIN_PATH

          mkdir -p ~/Library/MobileDevice/Provisioning\ Profiles
          cp $PP_PATH ~/Library/MobileDevice/Provisioning\ Profiles

      - name: Build Tauri iOS
        run: npx tauri ios build --export-method app-store-connect
        env:
          APPLE_DEVELOPMENT_TEAM: ${{ secrets.APPLE_DEVELOPMENT_TEAM }}

      - name: Upload to TestFlight
        env:
          APP_STORE_CONNECT_API_KEY_ID: ${{ secrets.ASC_KEY_ID }}
          APP_STORE_CONNECT_API_ISSUER_ID: ${{ secrets.ASC_ISSUER_ID }}
          APP_STORE_CONNECT_API_KEY: ${{ secrets.ASC_PRIVATE_KEY }}
        run: |
          xcrun altool --upload-app \
            --type ios \
            --file src-tauri/gen/apple/build/*.ipa \
            --apiKey "$APP_STORE_CONNECT_API_KEY_ID" \
            --apiIssuer "$APP_STORE_CONNECT_API_ISSUER_ID"

      - name: Notify on success
        if: success()
        run: echo "✅ Successfully uploaded to TestFlight"

      - name: Notify on failure
        if: failure()
        run: echo "❌ Build or upload failed"

      - name: Cleanup keychain
        if: always()
        run: security delete-keychain $RUNNER_TEMP/app-signing.keychain-db
```

### Required GitHub Secrets

| Secret | Description |
|---|---|
| `SUPABASE_URL` | Supabase project URL |
| `SUPABASE_ANON_KEY` | Supabase anon/public key |
| `APPLE_DEVELOPMENT_TEAM` | Apple dev team ID (AKG5NATH99) |
| `BUILD_CERTIFICATE_BASE64` | iOS distribution certificate (.p12) base64-encoded |
| `P12_PASSWORD` | Password for the .p12 certificate |
| `BUILD_PROVISION_PROFILE_BASE64` | iOS provisioning profile base64-encoded |
| `KEYCHAIN_PASSWORD` | Temporary keychain password (any string) |
| `ASC_KEY_ID` | App Store Connect API Key ID |
| `ASC_ISSUER_ID` | App Store Connect API Issuer ID |
| `ASC_PRIVATE_KEY` | App Store Connect API private key (.p8 contents) |

---

## 15. Deferred Features (TODO)

### Apple HealthKit Integration
- **Priority:** High (Phase 2)
- **Approach:** Create a custom Tauri plugin in Swift that bridges HealthKit to the Tauri JS layer
- **Plugin location:** `src-tauri/tauri-plugin-healthkit/` (or as a Tauri v2 Swift plugin)
- **Capabilities needed:**
  - Request permission to read HKWorkoutType (running)
  - Query workouts by date range
  - Return workout data: distance, duration, average pace, calories, heart rate
- **Integration points:**
  - Auto-match HealthKit workouts to scheduled plan days by date + distance proximity
  - Sync status indicator in Settings
  - Manual sync trigger button
  - Auto-sync on app foreground (if enabled)
  - Conflict resolution UI when HealthKit data differs from manual log
- **iOS entitlements:** Add HealthKit entitlement to `homeplan_iOS.entitlements` (will be renamed to match new app)
- **Info.plist:** Add `NSHealthShareUsageDescription` key

### Subscription / Payment
- **Priority:** Medium (Phase 3)
- **Approach:** StoreKit 2 integration via custom Tauri Swift plugin
- **Gate points already in place:**
  - Cloud sync toggle in Settings (currently free to toggle — later gated)
  - Social features check `isAvailable` in SocialContext
  - Community plans browsing (could be free, publishing gated)
- **Implementation when ready:**
  - Define subscription products in App Store Connect
  - Create StoreKit 2 Swift plugin for Tauri
  - Add subscription management screen
  - Gate sync/social behind active subscription check

### Push Notifications
- **Priority:** Low (Phase 4)
- **Approach:** APNs via Supabase Edge Functions or custom push service
- **Use cases:** Daily training reminders, friend activity highlights, goal deadline warnings

---

## 16. Error Handling & Edge Cases

### Offline Behavior
- All screens work offline — data comes from SQLite
- Social/Community screens show "You're offline" message when no network AND no cached data
- Sync operations silently fail and retry on next attempt
- Toast: "Changes saved locally. They'll sync when you're back online."

### Data Validation
- Run distance: must be > 0
- Run duration: must be > 0
- Run date: cannot be in the future
- Plan name: required, max 100 chars
- Plan weeks: 1–30
- Goal target: must be > 0
- Comment text: required, max 500 chars

### Auth Edge Cases
- Token expiry: Supabase JS client auto-refreshes. If refresh fails → set user to null, show "Session expired, please sign in again" toast
- Network failure during auth: show error message on auth screen
- Duplicate email on sign-up: show Supabase error message

### Backup & Export Edge Cases
- Backup JSON from a newer app version than currently installed → `parseBackupJson` checks `version` field. If version is unknown, show error toast: "This backup was created with a newer version of the app. Please update first."
- Backup JSON is malformed or missing required keys → `parseBackupJson` throws with a specific message. Show error toast: "Invalid backup file. The file may be corrupted."
- Backup contains plans with IDs that collide with existing built-in plans → skip those; built-in plans are never overwritten by restore.
- CSV export with zero runs → export a file with only the header row. Toast: "No runs to export."
- Restore while sync is enabled → restored records get `sync_status = 'dirty'` so they push to Supabase on next sync cycle, ensuring cloud stays in sync with the restored state.
- File picker cancelled by user → no-op, no error toast.
- Very large backup file (thousands of runs) → show a spinner during restore with "Restoring data..." message. Wrap in a transaction for atomicity.

### Plan Edge Cases
- User deletes active plan → clear active_plan, show "Choose a plan" on dashboard
- User skips days → streak resets, skipped days show as incomplete on calendar
- User completes future days → allowed (pre-logging)
- User changes start date of active plan → recalculate all date mappings, preserve logged runs

### Calendar Edge Cases
- No active plan → calendar shows empty month with "No plan selected" message
- Plan start date in a different month → show plan days only where they fall
- Timezone: all dates are stored as naive dates (YYYY-MM-DD). Use device local date for "today" determination.

---

## 17. Implementation Order

Recommended build sequence for the implementing agent:

1. **Project setup:** Scaffold Tauri v2 project, install all deps, configure tailwind/postcss/vite, set up tauri.conf.json and Cargo.toml
2. **Database layer:** `database.ts` with migrations, `planSeedData.ts` with all 12 plans, `DatabaseContext`
3. **Settings & dark mode:** `SettingsContext`, `useDarkMode` hook
4. **Types:** All TypeScript types in `types/index.ts`
5. **UI components:** All components in `components/ui/`
6. **Utility functions:** All utils
7. **Navigation:** React Router setup, `TabBar`, `Header`, `App.tsx` with routes
8. **Onboarding:** OnboardingScreen + all step components
9. **Plan system:** `planService.ts`, `PlanContext`, plan screens (MyPlans, PlanDetail, PlanEditor)
10. **Run logging:** `runService.ts`, `RunContext`, LogRunScreen
11. **Dashboard:** DashboardScreen with TodayActivityCard, WeeklySummary, Streak
12. **Calendar:** CalendarScreen, MonthView, WeekView, DayCell, DayDetailSheet
13. **Statistics:** `statsService.ts`, StatsScreen, all chart components
14. **Goals:** `goalService.ts`, GoalsScreen
15. **Auth:** `supabaseClient.ts`, `AuthContext`, AuthScreen
16. **Sync:** `syncService.ts`, sync integration into existing contexts
17. **Social:** `socialService.ts`, `SocialContext`, SocialScreen, FriendProfileScreen
18. **Community:** `communityService.ts`, CommunityPlansScreen, CommunityPlanDetailScreen
19. **Backup & export:** `backupService.ts` — full JSON backup/restore, CSV run export, plan JSON import/export
20. **Settings screen:** Full SettingsScreen with all sections including Data & Backups
21. **CI/CD:** GitHub Actions workflow file
22. **Polish:** Loading states, error states, empty states, toasts, animations

