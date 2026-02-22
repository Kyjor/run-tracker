/**
 * Social features — requires Supabase auth (sync tier).
 * All functions are no-ops (return empty data) when the user is not authenticated.
 */

import { supabase } from './supabaseClient';
import type { Profile, Follow, FeedItem, FeedComment } from '../types';

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

export async function getFeed(limit = 30): Promise<FeedItem[]> {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) return [];

  // Get IDs of people we follow
  const { data: follows } = await supabase
    .from('follows')
    .select('following_id')
    .eq('follower_id', session.user.id);

  const followingIds = (follows ?? []).map(f => f.following_id);
  if (followingIds.length === 0) return [];

  const { data } = await supabase
    .from('feed_activities')
    .select('*, profiles(*)')
    .in('user_id', followingIds)
    .order('created_at', { ascending: false })
    .limit(limit);

  return (data ?? []) as FeedItem[];
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
  const { data } = await supabase
    .from('feed_comments')
    .select('*, profiles(*)')
    .eq('activity_id', activityId)
    .order('created_at', { ascending: true });
  return (data ?? []) as FeedComment[];
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

