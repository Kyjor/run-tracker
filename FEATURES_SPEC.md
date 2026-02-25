## Product Feature Spec (Social Run App)

### Objectives

- **Keep social first**: low-friction feed, friends, and motivation without algorithmic junk.
- **Avoid paywall confusion**: free tier is useful; any paid tier must feel like clear, optional leverage, not extortion.

---

## 1. Social & Motivation

### 1.1 Core Social Feed  - [ ] Implemented

- **Description**: Chronological feed of friends’ activities with comments and reactions.
- **Key behaviors**:
  - [ ] Only show activities from people the user follows (no suggested/influencer content).
  - [ ] Allow likes/reactions, short comments, and basic privacy controls per activity.

### 1.2 Segments & PR Tracking  - [ ] Implemented

- **Description**: Lightweight segment system to create competition and progression without turning into pure KOM-chasing.
- **Key behaviors**:
  - [ ] Segments defined on routes; each activity auto-matches segments.
  - [ ] Show:
    - All-time PR for user.
    - Year-to-date PR.
    - Optional local leaderboard (simple top-N list).
  - [ ] UI emphasizes user vs self (“You improved vs last month”) more than global rankings.

### 1.3 Group & Private Challenges  - [ ] Implemented

- **Description**: Small-group challenges that motivate friends; not paywalled.
- **Key behaviors**:
  - [ ] Challenge types: total distance, total time, days active over a period.
  - [ ] Join via invite link or in-app search.
  - [ ] Leaderboard limited to group members; clear start/end dates and progress bars.

### 1.4 Year-in-Review Recap  - [ ] Implemented

- **Description**: Annual summary to visualize consistency and milestones.
- **Key behaviors**:
  - [ ] Show: total distance, time, number of activities, longest run, best streak, new routes explored.
  - [ ] No algorithmic commentary; focus on clean visuals and a few high-signal stats.

---

## 2. Routes, Maps, and Discovery

### 2.1 Route Builder with Heatmaps  - [ ] Implemented

- **Description**: Primary “power feature” for planning runs and rides, especially while traveling.
- **Key behaviors**:
  - [ ] Interactive map with:
    - Global heatmap layer (aggregated anonymous routes).
    - Personal heatmap layer (user’s own historical routes).
  - [ ] Snap-to-trail/road routing that:
      - Honors existing path when adding short waypoints.
      - Does not aggressively re-route the entire path unless requested.
  - [ ] Save, name, and reuse routes; sync to devices (where applicable).

### 2.2 Travel Mode: Local Popular Routes  - [ ] Implemented

- **Description**: Fast way to find safe, sensible routes in unfamiliar cities.
- **Key behaviors**:
  - [ ] Input: current location + desired distance range.
  - [ ] Output: 3–5 suggested loops/outs-and-backs based on global + local heatmaps.
  - [ ] Show simple descriptors: distance, elevation, surface tags (if available).

### 2.3 Personal Heatmap with Time Fading  - [ ] Implemented

- **Description**: Visualize where and how often a user has run, with recency.
- **Key behaviors**:
  - [ ] Map overlay where recent routes are brighter; older routes fade gradually.
  - [ ] Toggle by time window (e.g., last 3 months, last year, all-time).

### 2.4 Night/Safety Map Layer (Future)  - [ ] Implemented

- **Description**: Optional layer to help users pick safer routes at night.
- **Key behaviors**:
  - [ ] Approximation: highlight routes frequently used in evening/night hours.
  - [ ] Clear labeling that this is heuristic, not a safety guarantee.

---

## 3. Training Load & Analytics

### 3.1 Transparent Training Load Chart  - [ ] Implemented

- **Description**: Simple, documented load model for monitoring ramp-up and fatigue (inspired by intervals.icu / TRIMP).
- **Key behaviors**:
  - [ ] Per-activity “load” score based on duration × intensity (HR zones and/or pace vs threshold).
  - [ ] Plots:
      - Short-term load (e.g., 7-day rolling).
      - Long-term load (e.g., 42-day rolling).
  - [ ] Simple interpretations:
      - “Ramp-up is steep vs last month.”
      - “Load is stable.”
      - “You’ve backed off significantly.”
  - [ ] Documentation surfaced in-app so users understand what the numbers mean.

### 3.2 Relative Effort / Session RPE  - [ ] Implemented

- **Description**: Single “effort score” per activity that reflects how hard it felt and how long it lasted.
- **Key behaviors**:
  - [ ] Combine HR (or pace vs threshold) with user-provided RPE where available.
  - [ ] Highlight activities that are unusually hard vs recent history.
  - [ ] Surface guidance like:
      - “This was a hard session relative to your week.”
      - “This fits your ‘easy day’ target.”

### 3.3 Multi-Sport Aware Load  - [ ] Implemented

- **Description**: One load model for all sports (running, cycling, cross-training).
- **Key behaviors**:
  - [ ] Sport-specific multipliers (e.g., 60-min tempo run vs 60-min easy bike).
  - [ ] Unified load chart; users don’t get punished for cross-training instead of running.

### 3.4 Race Prediction (Honest & Optional)  - [ ] Implemented

- **Description**: Approximate race time predictions with explicit assumptions.
- **Key behaviors**:
  - [ ] Use: recent best performances + training volume and intensity.
  - [ ] Provide a range (e.g., “3:05–3:15 marathon”) rather than a single number.
  - [ ] Explain inputs and limitations; not positioned as coaching.

---

## 4. Plan-Aware Daily UX (Dashboard)

### 4.1 Today’s Planned Activity Card  - [ ] Implemented

- **Description**: Daily card that shows today’s plan and how logged work compares.
- **Key behaviors**:
  - [ ] Show: plan description, structured workout segments (if any), target distance/duration.
  - [ ] Aggregate **all runs today** (manual + imported) and compute:
      - Total distance vs planned distance (e.g., “3.10 / 3.00 mi”).
      - List of all today’s runs with distance, duration, and source (e.g., HealthKit).
  - [ ] Mark the plan day complete when summed distance meets/exceeds target in the plan’s unit.
  - [ ] Include non-running days:
      - Rest days still count toward streak.
      - Cross-training days show required duration and log status.

### 4.2 Streaks that Respect the Plan  - [ ] Implemented

- **Description**: Streak = adherence to the plan, not running every single day.
- **Key behaviors**:
  - [ ] Count a day as “on streak” if:
      - The user completes a planned activity; OR
      - It’s a scheduled rest day and they didn’t break the plan.
  - [ ] Visual streak display on dashboard and profile.

### 4.3 Shoe Mileage Tracking  - [ ] Implemented

- **Description**: Track mileage per shoe and surface simple replacement cues.
- **Key behaviors**:
  - [ ] Assign runs to a shoe (default last used).
  - [ ] Show mileage per shoe and warn at configurable thresholds (e.g., 300/400/500 miles).

---

## 5. Privacy, Control, and Anti-Annoyance

### 5.1 Privacy Per Activity  - [ ] Implemented

- **Description**: Fine-grained control over what others see.
- **Key behaviors**:
  - [ ] Visibility options: public, followers-only, private.
  - [ ] Ability to hide start time (show date-only) and/or start location radius.

### 5.2 Minimal Upsell & Clear Tiers  - [ ] Implemented

- **Description**: Subscription model that doesn’t degrade free usage.
- **Key behaviors**:
  - [ ] No full-screen “trial” pop-ups blocking core flows (logging, viewing feed).
  - [ ] Upsell messaging limited to:
      - A small non-intrusive banner.
      - Settings / upgrade screen.
  - [ ] Never paywall:
      - User’s own raw data (splits, temperature, heart rate graph).
      - Basic leaderboards and maps.

---

## 6. Integrations & Data Ownership

### 6.1 Device-Agnostic Sync Hub  - [ ] Implemented

- **Description**: The app acts as the central record for activities across devices.
- **Key behaviors**:
  - [ ] Integrate with major ecosystems: Garmin, Apple Health/Watch, Wahoo, etc.
  - [ ] Keep a unified activity timeline regardless of device brand.

### 6.2 Rich Metric Import & Display  - [ ] Implemented

- **Description**: Preserve and surface the metrics devices already record.
- **Key behaviors**:
  - [ ] Import and store: GPS route, pace, HR (incl. zones), cadence, power, VO2 estimates, elevation, weather, and calories.
  - [ ] Show these metrics in run details and training dashboards without extra paywalls.

### 6.3 Data Export  - [ ] Implemented

- **Description**: Allow users to leave without feeling locked in.
- **Key behaviors**:
  - [ ] Export activities as CSV/JSON (and/or zipped FIT/GPX).
  - [ ] Clear documentation on what is exported.

---

## 7. Gear & Equipment

### 7.1 Gear & Shoe Tracking  - [ ] Implemented

- **Description**: Let users define gear (shoes, HR straps, bikes, etc.) and track mileage/use on each item.
- **Key behaviors**:
  - [ ] Gear types: at minimum `shoes`, `heart_rate_monitor`, `watch`, `bike`, with room to extend.
  - [ ] Users can:
      - Add gear with name, brand/model, type, purchase date, and optional notes.
      - Mark gear as “active” or “retired”.
  - [ ] Activities can be tagged with one or more gear items:
      - Default to last-used gear per activity type (e.g., last running shoes).
      - Allow editing gear on an activity after the fact.
  - [ ] Per-gear stats:
      - Total distance (and/or time) by sport.
      - Last used date.
  - [ ] Thresholds:
      - Configurable alerts for shoes at mileage thresholds (e.g., 300/400/500 miles).
      - Optional “time to replace” suggestions based on mileage and age).

---

## 8. Monetization Principles (Non-Feature Requirements)

- **Align revenue with real value**:
  - Paid tier should focus on power tools (advanced route building, deeper analytics, maybe advanced dashboards), not on hiding basics.
- **Respect subscription fatigue**:
  - Consider:
    - Monthly / yearly.
    - Pausable or training-block-oriented subscriptions (e.g., 3-month “race block”).
  - Make it easy to cancel and rejoin without penalty.


