/**
 * Social features — requires Supabase auth (sync tier).
 * All functions are no-ops (return empty data) when the user is not authenticated.
 */

import { supabase } from './supabaseClient';
import type { Profile, Follow, FeedItem, FeedComment, Run } from '../types';

// ---------------------------------------------------------------------------
// Profile
// ---------------------------------------------------------------------------

export async function getMyProfile(): Promise<Profile | null> {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) return null;
  const { data } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', session.user.id)
    .single();
  return data ?? null;
}

export async function getProfileById(userId: string): Promise<Profile | null> {
  const { data } = await supabase.from('profiles').select('*').eq('id', userId).single();
  return data ?? null;
}

export async function updateProfile(updates: Partial<Profile>): Promise<void> {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) return;
  await supabase.from('profiles').update(updates).eq('id', session.user.id);
}

export async function searchProfiles(query: string): Promise<Profile[]> {
  const { data } = await supabase
    .from('profiles')
    .select('*')
    .ilike('display_name', `%${query}%`)
    .eq('is_public', true)
    .limit(20);
  return data ?? [];
}

// ---------------------------------------------------------------------------
// Following
// ---------------------------------------------------------------------------

export async function followUser(targetId: string): Promise<void> {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) return;
  await supabase.from('follows').upsert({ follower_id: session.user.id, following_id: targetId });
}

export async function unfollowUser(targetId: string): Promise<void> {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) return;
  await supabase.from('follows').delete()
    .eq('follower_id', session.user.id)
    .eq('following_id', targetId);
}

export async function getFollowing(): Promise<Follow[]> {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) return [];
  const { data } = await supabase
    .from('follows')
    .select('*')
    .eq('follower_id', session.user.id);
  return data ?? [];
}

export async function getFollowers(): Promise<Follow[]> {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) return [];
  const { data } = await supabase
    .from('follows')
    .select('*')
    .eq('following_id', session.user.id);
  return data ?? [];
}

/** Returns profiles of everyone I follow */
export async function getFollowingWithProfiles(): Promise<Profile[]> {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) return [];
  const { data: follows } = await supabase
    .from('follows')
    .select('following_id')
    .eq('follower_id', session.user.id);
  if (!follows || follows.length === 0) return [];
  const ids = follows.map(f => f.following_id);
  const { data: profiles } = await supabase.from('profiles').select('*').in('id', ids);
  return profiles ?? [];
}

/** Returns profiles of everyone who follows me */
export async function getFollowersWithProfiles(): Promise<Profile[]> {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) return [];
  const { data: follows } = await supabase
    .from('follows')
    .select('follower_id')
    .eq('following_id', session.user.id);
  if (!follows || follows.length === 0) return [];
  const ids = follows.map(f => f.follower_id);
  const { data: profiles } = await supabase.from('profiles').select('*').in('id', ids);
  return profiles ?? [];
}

/** Fetch recent runs for any user from Supabase (requires RLS policy allowing followers to read) */
export async function getRunsByUser(userId: string, limit = 20): Promise<Run[]> {
  const { data } = await supabase
    .from('user_runs')
    .select('*')
    .eq('user_id', userId)
    .order('date', { ascending: false })
    .limit(limit);
  return (data ?? []) as Run[];
}

export async function isFollowing(targetId: string): Promise<boolean> {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) return false;
  const { data } = await supabase
    .from('follows')
    .select('follower_id')
    .eq('follower_id', session.user.id)
    .eq('following_id', targetId)
    .single();
  return !!data;
}

// ---------------------------------------------------------------------------
// Activity Feed
// ---------------------------------------------------------------------------

export async function getFeed(limit = 30, offset = 0): Promise<FeedItem[]> {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) return [];

  // Get IDs of people we follow
  const { data: follows } = await supabase
    .from('follows')
    .select('following_id')
    .eq('follower_id', session.user.id);

  const followingIds = (follows ?? []).map(f => f.following_id);
  if (followingIds.length === 0) return [];

  // Show recent runs from followed users (this is the primary feed content)
  const { data: runs } = await supabase
    .from('user_runs')
    .select('*')
    .in('user_id', followingIds)
    .order('date', { ascending: false })
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1);

  if (!runs || runs.length === 0) return [];

  // Fetch profiles for these users
  const userIds = [...new Set(runs.map(r => r.user_id))];
  const { data: profiles } = await supabase
    .from('profiles')
    .select('*')
    .in('id', userIds);

  const profileMap = new Map((profiles ?? []).map(p => [p.id, p]));

  // For each run, find or create a feed_activity
  const feedItems: FeedItem[] = [];
  for (const run of runs) {
    const runData = {
      distance: run.distance_value,
      unit: run.distance_unit,
      duration: run.duration_seconds,
      run_type: run.run_type,
      run_id: run.id, // Store run ID in data for reference
    };

    // Check if feed_activity exists for this run (match by user, type, and created_at within 1 minute)
    const runTime = new Date(run.created_at);
    const timeStart = new Date(runTime.getTime() - 60000).toISOString();
    const timeEnd = new Date(runTime.getTime() + 60000).toISOString();

    const { data: existingActivities } = await supabase
      .from('feed_activities')
      .select('id')
      .eq('user_id', run.user_id)
      .eq('activity_type', 'run_completed')
      .gte('created_at', timeStart)
      .lte('created_at', timeEnd)
      .limit(1);

    let activityId: string;
    if (existingActivities && existingActivities.length > 0) {
      activityId = existingActivities[0].id;
    } else {
      // Create feed_activity for this run
      const { data: newActivity, error } = await supabase
        .from('feed_activities')
        .insert({
          user_id: run.user_id,
          activity_type: 'run_completed',
          data: runData,
          created_at: run.created_at,
        })
        .select('id')
        .single();
      if (error || !newActivity) {
        console.error('Failed to create feed activity:', error);
        continue;
      }
      activityId = newActivity.id;
    }

    // Fetch likes and comments for this activity
    const [likesRes, commentsRes, userLikeRes] = await Promise.all([
      supabase.from('feed_likes').select('id').eq('activity_id', activityId),
      supabase.from('feed_comments').select('id').eq('activity_id', activityId),
      supabase.from('feed_likes').select('id').eq('activity_id', activityId).eq('user_id', session.user.id).maybeSingle(),
    ]);

    feedItems.push({
      id: activityId,
      user_id: run.user_id,
      activity_type: 'run_completed',
      data: runData,
      created_at: run.created_at,
      profile: profileMap.get(run.user_id) ?? undefined,
      likes_count: likesRes.data?.length ?? 0,
      comments_count: commentsRes.data?.length ?? 0,
      user_has_liked: !!userLikeRes.data,
    });
  }

  return feedItems;
}

export async function publishFeedActivity(
  activityType: string,
  data: Record<string, unknown>,
): Promise<void> {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) return;
  await supabase.from('feed_activities').insert({
    user_id: session.user.id,
    activity_type: activityType,
    data,
  });
}

// ---------------------------------------------------------------------------
// Comments & Likes
// ---------------------------------------------------------------------------

export async function getComments(activityId: string): Promise<FeedComment[]> {
  const { data: comments } = await supabase
    .from('feed_comments')
    .select('*')
    .eq('activity_id', activityId)
    .order('created_at', { ascending: true });

  if (!comments || comments.length === 0) return [];

  // Fetch profiles for all comment authors
  const userIds = [...new Set(comments.map(c => c.user_id))];
  const { data: profiles } = await supabase
    .from('profiles')
    .select('*')
    .in('id', userIds);

  const profileMap = new Map((profiles ?? []).map(p => [p.id, p]));

  // Merge profiles into comments
  return comments.map(comment => ({
    ...comment,
    profile: profileMap.get(comment.user_id),
  })) as FeedComment[];
}

export async function addComment(activityId: string, text: string): Promise<void> {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) return;
  await supabase.from('feed_comments').insert({
    user_id: session.user.id,
    activity_id: activityId,
    text,
  });
}

export async function toggleLike(activityId: string): Promise<void> {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) return;
  const { data: existing } = await supabase
    .from('feed_likes')
    .select('id')
    .eq('user_id', session.user.id)
    .eq('activity_id', activityId)
    .single();

  if (existing) {
    await supabase.from('feed_likes').delete()
      .eq('user_id', session.user.id)
      .eq('activity_id', activityId);
  } else {
    await supabase.from('feed_likes').insert({ user_id: session.user.id, activity_id: activityId });
  }
}

