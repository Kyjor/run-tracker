import { supabase } from './supabaseClient';
import type { CommunityPlan, PlanComment, PlanExportFormat } from '../types';

export async function getCommunityPlans(
  options: { race_type?: string; sort?: 'top' | 'new'; limit?: number } = {},
): Promise<CommunityPlan[]> {
  let q = supabase
    .from('community_plans')
    .select('*, profiles(*)');

  if (options.race_type) q = q.eq('race_type', options.race_type);
  if (options.sort === 'top') q = q.order('upvote_count', { ascending: false });
  else q = q.order('created_at', { ascending: false });
  q = q.limit(options.limit ?? 30);

  const { data } = await q;
  return (data ?? []) as CommunityPlan[];
}

export async function getCommunityPlan(id: string): Promise<CommunityPlan | null> {
  const { data } = await supabase
    .from('community_plans')
    .select('*, profiles(*)')
    .eq('id', id)
    .single();
  return data as CommunityPlan | null;
}

export async function sharePlanToCommunity(
  planData: PlanExportFormat,
  description: string,
): Promise<string> {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) throw new Error('Must be signed in to share a plan.');

  const { data, error } = await supabase.from('community_plans').insert({
    author_id: session.user.id,
    plan_data: planData,
    name: planData.plan.name,
    race_type: planData.plan.race_type,
    difficulty: planData.plan.difficulty,
    description,
    duration_weeks: planData.plan.duration_weeks,
  }).select('id').single();

  if (error) throw error;
  return (data as { id: string }).id;
}

export async function upvotePlan(planId: string): Promise<void> {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) return;
  await supabase.from('plan_upvotes').upsert({ user_id: session.user.id, plan_id: planId });
  // The DB trigger increments upvote_count
}

export async function removeUpvote(planId: string): Promise<void> {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) return;
  await supabase.from('plan_upvotes').delete()
    .eq('user_id', session.user.id)
    .eq('plan_id', planId);
}

export async function ratePlan(planId: string, rating: number): Promise<void> {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) return;
  await supabase.from('plan_ratings').upsert({
    user_id: session.user.id,
    plan_id: planId,
    rating: Math.max(1, Math.min(5, rating)),
  });
}

export async function getPlanComments(planId: string): Promise<PlanComment[]> {
  const { data } = await supabase
    .from('plan_comments')
    .select('*, profiles(*)')
    .eq('plan_id', planId)
    .order('created_at', { ascending: true });
  return (data ?? []) as PlanComment[];
}

export async function addPlanComment(planId: string, text: string): Promise<void> {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) return;
  await supabase.from('plan_comments').insert({ user_id: session.user.id, plan_id: planId, text });
}

