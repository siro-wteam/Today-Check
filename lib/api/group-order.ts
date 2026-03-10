/**
 * User group order API (sync order across web + app via Supabase)
 */

import { supabase } from '../supabase';

const TABLE = 'user_group_order';

export async function getGroupOrder(userId: string): Promise<{ data: string[] | null; error: Error | null }> {
  try {
    const { data, error } = await supabase
      .from(TABLE)
      .select('ordered_ids')
      .eq('user_id', userId)
      .maybeSingle();

    if (error) return { data: null, error: new Error(error.message) };
    const raw = data?.ordered_ids;
    if (!Array.isArray(raw)) return { data: [], error: null };
    const ids = raw.filter((id): id is string => typeof id === 'string');
    return { data: ids, error: null };
  } catch (err: any) {
    return { data: null, error: err };
  }
}

export async function setGroupOrder(userId: string, orderedIds: string[]): Promise<{ error: Error | null }> {
  try {
    const { error } = await supabase
      .from(TABLE)
      .upsert(
        { user_id: userId, ordered_ids: orderedIds, updated_at: new Date().toISOString() },
        { onConflict: 'user_id' }
      );

    if (error) return { error: new Error(error.message) };
    return { error: null };
  } catch (err: any) {
    return { error: err };
  }
}
