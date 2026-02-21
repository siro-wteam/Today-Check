/**
 * Subscription limit count APIs.
 * Used by useSubscriptionLimits to enforce FREE_MAX_* before create/move.
 * Counts respect RLS (only tasks/groups the user can see).
 */

import { supabase } from '../supabase';
import { FREE_MAX_BACKLOG, FREE_MAX_GROUPS, FREE_MAX_TASKS_PER_DATE } from '../../constants/subscription';

/** Count of backlog tasks (due_date IS NULL) visible to current user (RLS). */
export async function getBacklogTaskCount(): Promise<{ count: number; error: Error | null }> {
  const { count, error } = await supabase
    .from('tasks')
    .select('id', { count: 'exact', head: true })
    .is('due_date', null)
    .is('deleted_at', null);

  if (error) return { count: 0, error: error as Error };
  return { count: count ?? 0, error: null };
}

/** Count of tasks with due_date = dateStr visible to current user (RLS). */
export async function getTaskCountForDate(dateStr: string): Promise<{ count: number; error: Error | null }> {
  const { count, error } = await supabase
    .from('tasks')
    .select('id', { count: 'exact', head: true })
    .eq('due_date', dateStr)
    .is('deleted_at', null);

  if (error) return { count: 0, error: error as Error };
  return { count: count ?? 0, error: null };
}

/** Count of groups the user created (owns). Uses group_members.role = 'OWNER'. */
export async function getCreatedGroupCount(userId: string): Promise<{ count: number; error: Error | null }> {
  const { count, error } = await supabase
    .from('group_members')
    .select('group_id', { count: 'exact', head: true })
    .eq('user_id', userId)
    .eq('role', 'OWNER');

  if (error) return { count: 0, error: error as Error };
  return { count: count ?? 0, error: null };
}

export const LIMIT_MESSAGES = {
  groups: 'Free plan: max 2 groups. Upgrade to add more.',
  backlog: 'Free plan: max 5 backlog items. Upgrade to add more.',
  perDate: (dateLabel: string) =>
    `Free plan: max 5 tasks per date. ${dateLabel} is full. Upgrade to add more.`,
} as const;

export {
  FREE_MAX_GROUPS,
  FREE_MAX_BACKLOG,
  FREE_MAX_TASKS_PER_DATE,
};
