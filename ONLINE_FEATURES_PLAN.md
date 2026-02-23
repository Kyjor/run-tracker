# Online Features Implementation Plan

## Overview
This document outlines what needs to be implemented to enable cloud sync, social features, and community plans. Most of the backend services are already written; this focuses on UI integration and missing pieces.

---

## ✅ Already Implemented

### Backend Services
- ✅ `syncService.ts` - Push/pull sync for runs, goals, plans
- ✅ `socialService.ts` - Profiles, follows, activity feed, likes, comments
- ✅ `communityService.ts` - Community plans, upvotes, ratings, comments
- ✅ `AuthContext.tsx` - Authentication state management
- ✅ `supabaseClient.ts` - Supabase client initialization

### UI Screens (Partial)
- ✅ `AuthScreen.tsx` - Sign in/up (with back button)
- ✅ `SocialScreen.tsx` - Activity feed display
- ✅ `SettingsScreen.tsx` - Sync toggle + manual sync button
- ✅ `LogRunScreen.tsx` - Publishes to feed on run creation

---

## 🔨 What Needs Implementation

### 1. **Auto-sync on App Launch** ⚠️ HIGH PRIORITY
**Status:** Missing  
**Location:** `App.tsx` or `PlanContext.tsx`

**What to do:**
- When user is authenticated AND `sync_enabled = true`, automatically call `pullFromCloud()` on app launch
- Optionally: auto-sync every N minutes when app is active (e.g., every 5 minutes)

**Files to modify:**
- `src/App.tsx` - Add useEffect to check auth + sync_enabled, then pull
- `src/services/syncService.ts` - May need to add `pullFromCloud()` for goals/plans too (currently only runs)

---

### 2. **Profile Screen Enhancement** ⚠️ HIGH PRIORITY
**Status:** Basic screen exists, needs social features  
**Location:** `src/screens/ProfileScreen.tsx`

**What to add:**
- Display user's own profile (display name, avatar, units preference)
- Edit profile button (opens modal/form)
- Public/private toggle
- Stats summary (total runs, total miles, current streak)
- "View Profile" button when viewing someone else's profile (from social feed)

**Files to modify:**
- `src/screens/ProfileScreen.tsx` - Add profile editing UI
- Create `src/components/social/ProfileEditModal.tsx` (new)

---

### 3. **Social Screen Enhancements** ⚠️ MEDIUM PRIORITY
**Status:** Basic feed exists, needs more features  
**Location:** `src/screens/SocialScreen.tsx`

**What to add:**
- **Comments:** Tap activity → show comments modal, add comment
- **User profiles:** Tap user avatar/name → navigate to their profile
- **Follow/unfollow:** Button on profile screens
- **Refresh pull-to-refresh:** Swipe down to reload feed
- **Empty state improvements:** "Follow friends to see their activities"

**Files to modify:**
- `src/screens/SocialScreen.tsx` - Add comments modal, profile navigation
- `src/components/social/ActivityFeedItem.tsx` - Make tappable, show comment count
- Create `src/components/social/CommentsModal.tsx` (new)

---

### 4. **Community Plans Screen** ⚠️ MEDIUM PRIORITY
**Status:** Screen exists, needs full functionality  
**Location:** `src/screens/CommunityScreen.tsx`

**What to add:**
- **Browse plans:** List with filters (race type, difficulty, sort by top/new)
- **Plan detail:** Full plan preview, upvote/rating buttons, comments section
- **Import plan:** "Use This Plan" button → creates local copy
- **Share plan:** Button in `PlanDetailScreen` → uploads to community
- **Search:** Search bar for plan names/descriptions

**Files to modify:**
- `src/screens/CommunityScreen.tsx` - Implement full browsing UI
- `src/screens/PlanDetailScreen.tsx` - Add "Share to Community" button
- Create `src/components/community/PlanDetailModal.tsx` (new)

---

### 5. **Sync Status Indicators** ⚠️ LOW PRIORITY
**Status:** Missing  
**Location:** Various screens

**What to add:**
- Small badge/icon showing "Synced" or "Not synced" on runs/goals
- Last sync time in Settings (already there, but could be more prominent)
- Toast notification when auto-sync completes

**Files to modify:**
- `src/components/run/RunCard.tsx` - Add sync status badge
- `src/screens/StatsScreen.tsx` - Show sync status

---

### 6. **Pull Sync for All Data Types** ⚠️ HIGH PRIORITY
**Status:** Only runs are pulled  
**Location:** `src/services/syncService.ts`

**What to add:**
- `pullGoals()` - Pull remote goals that don't exist locally
- `pullActivePlan()` - Pull active plan from cloud
- `pullCustomPlans()` - Pull user's custom plans
- Merge strategy: remote wins on conflict (or last-write-wins if timestamps available)

**Files to modify:**
- `src/services/syncService.ts` - Implement pull functions for goals, plans

---

### 7. **Feed Activity Publishing** ⚠️ MEDIUM PRIORITY
**Status:** Only runs are published  
**Location:** Various screens

**What to add:**
- Publish when plan is activated (`plan_started`)
- Publish when plan is completed (`plan_completed`)
- Publish when goal is achieved (`goal_achieved`)
- Publish streak milestones (`streak_milestone`)

**Files to modify:**
- `src/services/planService.ts` - Publish on plan activation/completion
- `src/services/goalService.ts` - Publish on goal achievement
- `src/services/statsService.ts` - Check for streak milestones

---

### 8. **Error Handling & Offline Support** ⚠️ MEDIUM PRIORITY
**Status:** Basic, needs improvement  
**Location:** All sync/social services

**What to add:**
- Graceful degradation: if sync fails, show toast but don't block UI
- Retry logic: queue failed syncs, retry on next attempt
- Offline detection: show "Offline" badge when network unavailable
- Queue sync operations when offline, execute when back online

**Files to modify:**
- `src/services/syncService.ts` - Add try/catch, retry logic
- `src/services/socialService.ts` - Add error handling
- `src/contexts/ToastContext.tsx` - Show sync errors

---

### 9. **Profile Search & Discovery** ⚠️ LOW PRIORITY
**Status:** Service exists, UI missing  
**Location:** New screen or modal

**What to add:**
- "Find Friends" screen or modal
- Search by display name
- List public profiles
- "Follow" button on each result

**Files to create:**
- `src/screens/FindFriendsScreen.tsx` (new)
- Add navigation from ProfileScreen or SocialScreen

---

### 10. **Community Plan Import Flow** ⚠️ MEDIUM PRIORITY
**Status:** Service exists, UI missing  
**Location:** `CommunityScreen.tsx` + `PlanDetailScreen.tsx`

**What to add:**
- When viewing a community plan, show "Import Plan" button
- On click: create local copy in `training_plans` table
- Show success toast: "Plan imported! You can now activate it."
- Navigate to imported plan's detail screen

**Files to modify:**
- `src/screens/CommunityScreen.tsx` - Add import button
- `src/services/planService.ts` - Add `importCommunityPlan()` function

---

## 📋 Implementation Order (Recommended)

### Phase 1: Core Sync (Must Have)
1. ✅ Set up Supabase database (run `supabase-schema.sql`)
2. ⚠️ Implement `pullFromCloud()` for all data types (goals, plans)
3. ⚠️ Auto-sync on app launch
4. ⚠️ Test sync end-to-end (create run on Device A, verify on Device B)

### Phase 2: Social Basics (Should Have)
5. ⚠️ Profile editing UI
6. ⚠️ Comments on feed activities
7. ⚠️ Follow/unfollow functionality
8. ⚠️ User profile navigation from feed

### Phase 3: Community Plans (Nice to Have)
9. ⚠️ Full community browsing UI
10. ⚠️ Plan import flow
11. ⚠️ Share plan to community
12. ⚠️ Upvote/rating UI

### Phase 4: Polish (Later)
13. ⚠️ Sync status indicators
14. ⚠️ Feed activity publishing (plans, goals, streaks)
15. ⚠️ Error handling improvements
16. ⚠️ Profile search/discovery

---

## 🧪 Testing Checklist

- [ ] Sign up new account
- [ ] Sign in existing account
- [ ] Create run → verify syncs to cloud
- [ ] Create run on Device A → verify appears on Device B
- [ ] Create goal → verify syncs
- [ ] Activate plan → verify syncs
- [ ] Follow a user → verify feed shows their activities
- [ ] Like a feed activity → verify persists
- [ ] Comment on feed activity → verify appears
- [ ] Share plan to community → verify appears in browse
- [ ] Import community plan → verify creates local copy
- [ ] Upvote community plan → verify count updates
- [ ] Rate community plan → verify average updates

---

## 🔐 Security Notes

- All RLS policies are set up in the SQL schema
- Users can only access their own data (runs, goals, plans)
- Public profiles are readable by anyone
- Feed activities are only visible to followers or the author
- Community plans are public (read-only for non-authors)

---

## 📝 Notes

- **Subscription gating:** The UI mentions "premium subscription" but actual payment/subscription logic is deferred. For now, `sync_enabled` is just a toggle.
- **Conflict resolution:** Currently "remote wins" on sync conflicts. Future: implement last-write-wins using `updated_at` timestamps.
- **Real-time:** Supabase supports real-time subscriptions, but not implemented yet. Could add live feed updates later.

