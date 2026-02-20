/**
 * Tasks API - CRUD operations for tasks
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { addDays, differenceInCalendarDays, format, parse, parseISO } from 'date-fns';
import Constants from 'expo-constants';
import { Platform } from 'react-native';

// Supabase 클라이언트 import
const supabase: SupabaseClient = createClient(
  Constants.expoConfig?.extra?.supabaseUrl || process.env.EXPO_PUBLIC_SUPABASE_URL || '',
  Constants.expoConfig?.extra?.supabaseAnonKey || process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || '',
  {
    auth: {
      storage: Platform.OS === 'web' ? {
        getItem: (key: string) => {
          if (typeof window !== 'undefined') {
            return Promise.resolve(window.localStorage.getItem(key));
          }
          return Promise.resolve(null);
        },
        setItem: (key: string, value: string) => {
          if (typeof window !== 'undefined') {
            window.localStorage.setItem(key, value);
          }
          return Promise.resolve();
        },
        removeItem: (key: string) => {
          if (typeof window !== 'undefined') {
            window.localStorage.removeItem(key);
          }
          return Promise.resolve();
        },
      } : AsyncStorage,
      autoRefreshToken: true,
      persistSession: true,
      detectSessionInUrl: false,
    },
  }
);

// 타입 단순화를 위한 any 타입 사용
export type SupabaseResult<T> = {
  data: T | null;
  error: Error | null;
};

export type SupabaseUpdateResult = SupabaseResult<any[]>;
export type SupabaseSelectResult<T> = SupabaseResult<T>;

// Task 인터페이스 정의
export interface Task {
  id: string;
  title: string;
  description: string | null;
  status: 'TODO' | 'DONE' | 'CANCELLED';
  due_date: string | null;
  due_time: string | null;
  due_time_end: string | null;
  original_due_date: string | null;
  completed_at: string | null;
  created_at: string;
  updated_at: string | null;
  deleted_at: string | null;
  group_id: string | null;
  creator_id: string;
  task_assignees?: any;
}

export interface TaskWithRollover {
  id: string;
  title: string;
  description: string | null;
  status: 'TODO' | 'DONE' | 'CANCELLED';
  due_date: string | null;
  due_time: string | null;
  due_time_end: string | null;
  original_due_date: string | null;
  completed_at: string | null;
  created_at: string;
  updated_at: string | null;
  deleted_at: string | null;
  group_id: string | null;
  creator_id: string;
  task_assignees?: any;
  rollover_info?: {
    id: string;
    days_overdue: number;
    is_overdue: boolean;
    display_text: string;
    next_due_date: string | null;
  };
}

export interface CreateTaskInput {
  title: string;
  description?: string;
  status?: 'TODO' | 'DONE' | 'CANCELLED';
  due_date?: string;
  due_time?: string;
  due_time_end?: string;
  group_id?: string;
  assignee_ids?: string[];
}

export interface CreateTaskWithAssigneesInput {
  title: string;
  description?: string;
  due_date?: string;
  due_time?: string;
  due_time_end?: string;
  group_id?: string;
  assignees?: { user_id: string; is_completed?: boolean }[];
}

export interface UpdateTaskInput {
  id: string;
  title?: string;
  description?: string;
  status?: 'TODO' | 'DONE' | 'CANCELLED';
  due_date?: string;
  due_time?: string;
  due_time_end?: string;
  completed_at?: string | null;
}

/**
 * Get all tasks for the current user (excluding soft-deleted)
 */
export async function getTasks() {
  const { data, error } = await supabase
    .from('tasks')
    .select('*')
    .is('deleted_at', null) // Soft delete filter
    .order('due_date', { ascending: true, nullsFirst: false })
    .order('due_time', { ascending: true, nullsFirst: false })
    .order('created_at', { ascending: true });

  if (error) {
    console.error('Error fetching tasks:', error);
    return { data: null, error };
  }

  return { data: data as Task[], error: null };
}

/**
 * Get today's tasks (including rollovers, excluding soft-deleted)
 * Returns tasks with due_date <= today and status = TODO or DONE
 * @deprecated Use getActiveTasksAndTimeline() for better performance
 */
export async function getTodayTasks(): Promise<{ data: Task[] | null; error: any }> {
  // date-fns format으로 로컬 타임존 기준 오늘 날짜 생성
  const today = format(new Date(), 'yyyy-MM-dd');

  const { data, error } = await supabase
    .from('tasks')
    .select('*')
    .lte('due_date', today)
    .not('due_date', 'is', null)
    .is('deleted_at', null) // Soft delete filter
    .order('due_date', { ascending: true })
    .order('due_time', { ascending: true, nullsFirst: false })
    .order('created_at', { ascending: true });

  if (error) {
    console.error('Error fetching today tasks:', error);
    return { data: null, error };
  }

  return { data: data as Task[], error: null };
}

/**
 * Query 1: Get all active (TODO) tasks within a reasonable range
 * Fetches TODO tasks from the last 30 days to today (prevents fetching entire history)
 * This is much more efficient than fetching all historical incomplete tasks
 */
export async function getActiveTasks(): Promise<{ data: Task[] | null; error: any }> {
  const today = format(new Date(), 'yyyy-MM-dd');
  const startDate = format(addDays(new Date(), -30), 'yyyy-MM-dd'); // Last 30 days

  const { data, error } = await supabase
    .from('tasks')
    .select(`
      *,
      task_assignees (
        user_id,
        is_completed,
        completed_at
      )
    `)
    .eq('status', 'TODO')
    .gte('due_date', startDate) // ✅ Range start: last 30 days
    .lte('due_date', today)      // ✅ Range end: today
    .not('due_date', 'is', null)
    .is('deleted_at', null)
    .order('due_date', { ascending: true })
    .order('due_time', { ascending: true, nullsFirst: false })
    .order('created_at', { ascending: true });

  if (error) {
    console.error('Error fetching active tasks:', error);
    return { data: null, error };
  }

  return { data: data as Task[], error: null };
}

/**
 * Query 2: Get timeline tasks within a date range
 * Used for initial load (±7 days) and pagination (additional chunks)
 */
export async function getTimelineTasks(
  startDate: string, // yyyy-MM-dd
  endDate: string     // yyyy-MM-dd
): Promise<{ data: Task[] | null; error: any }> {
  const result = await getTimelineTasksWithoutEnrichment(startDate, endDate);
  if (result.error || !result.data) {
    return result;
  }

  // Enrich with profile data
  const enrichedData = await enrichTasksWithProfiles(result.data);
  return { data: enrichedData as Task[], error: null };
}

/**
 * Get completed tasks by completed_at range (regardless of due_date)
 */
export async function getCompletedTasksByDateRange(
  startDate: string, // yyyy-MM-dd
  endDate: string     // yyyy-MM-dd
): Promise<{ data: Task[] | null; error: any }> {
  const result = await getCompletedTasksByDateRangeWithoutEnrichment(startDate, endDate);
  if (result.error || !result.data) {
    return result;
  }

  // Enrich with profile data
  const enrichedData = await enrichTasksWithProfiles(result.data);
  return { data: enrichedData as Task[], error: null };
}

/**
 * OPTIMIZED: Unified Task Fetcher - Single API call for all tasks in range
 * Much more efficient than separate calls by status
 * 
 * @param startDate - Start date (yyyy-MM-dd)
 * @param endDate - End date (yyyy-MM-dd)
 * @returns All tasks in the range, enriched with profile data
 */
export async function getAllTasksInRange(
  startDate: string,
  endDate: string
): Promise<{ data: Task[] | null; error: any }> {
  try {
    const startIso = `${startDate}T00:00:00`;
    const endIso = `${endDate}T23:59:59.999`;

    // Single API call: Get ALL tasks in date range (regardless of status)
    const { data, error } = await supabase
      .from('tasks')
      .select(`
        *,
        task_assignees (
          user_id,
          is_completed,
          completed_at
        )
      `)
      // Fetch tasks that either:
      // 1. Have due_date in range (any status)
      // 2. Are DONE and completed_at in range
      .or(`and(due_date.gte.${startDate},due_date.lte.${endDate}),and(status.eq.DONE,completed_at.gte.${startIso},completed_at.lte.${endIso})`)
      .is('deleted_at', null)
      .order('due_date', { ascending: true })
      .order('due_time', { ascending: true, nullsFirst: false })
      .order('created_at', { ascending: true });

    if (error) {
      console.error('[getAllTasksInRange] Error:', error);
      return { data: null, error };
    }

    // Enrich with profiles ONCE
    const enrichedTasks = await enrichTasksWithProfiles(data as Task[]);
    
    return { data: enrichedTasks, error: null };
  } catch (error) {
    console.error('[getAllTasksInRange] Exception:', error);
    return { data: null, error };
  }
}

/**
 * OPTIMIZED: Get timeline tasks (single API call version)
 * Replaces the old getActiveTasksAndTimeline
 */
export async function getActiveTasksAndTimeline(): Promise<{ data: Task[] | null; error: any }> {
  const today = new Date();
  const startDate = format(addDays(today, -37), 'yyyy-MM-dd'); // 30 days past + 7 days window
  const endDate = format(addDays(today, 7), 'yyyy-MM-dd');

  return getAllTasksInRange(startDate, endDate);
}

/**
 * Get active tasks WITHOUT enriching (internal use)
 * Fetches TODO tasks from the last 30 days to today
 */
async function getActiveTasksWithoutEnrichment(): Promise<{ data: Task[] | null; error: any }> {
  const today = format(new Date(), 'yyyy-MM-dd');
  const startDate = format(addDays(new Date(), -30), 'yyyy-MM-dd'); // Last 30 days

  const { data, error } = await supabase
    .from('tasks')
    .select(`
      *,
      task_assignees (
        user_id,
        is_completed,
        completed_at
      )
    `)
    .eq('status', 'TODO')
    .gte('due_date', startDate) // ✅ Range start: last 30 days
    .lte('due_date', today)      // ✅ Range end: today
    .not('due_date', 'is', null)
    .is('deleted_at', null)
    .order('due_date', { ascending: true })
    .order('due_time', { ascending: true, nullsFirst: false })
    .order('created_at', { ascending: true });

  if (error) {
    console.error('Error fetching active tasks:', error);
    return { data: null, error };
  }

  return { data: data as Task[], error: null };
}

/**
 * Get timeline tasks WITHOUT enriching (internal use)
 */
export async function getTimelineTasksWithoutEnrichment(
  startDate: string,
  endDate: string
): Promise<{ data: Task[] | null; error: any }> {
  const { data, error } = await supabase
    .from('tasks')
    .select(`
      *,
      task_assignees (
        user_id,
        is_completed,
        completed_at
      )
    `)
    .gte('due_date', startDate)
    .lte('due_date', endDate)
    .not('due_date', 'is', null)
    .is('deleted_at', null)
    .order('due_date', { ascending: true })
    .order('due_time', { ascending: true, nullsFirst: false })
    .order('created_at', { ascending: true });

  if (error) {
    console.error('Error fetching timeline tasks:', error);
    return { data: null, error };
  }

  return { data: data as Task[], error: null };
}

/**
 * Get completed tasks WITHOUT enriching (internal use)
 */
export async function getCompletedTasksByDateRangeWithoutEnrichment(
  startDate: string,
  endDate: string
): Promise<{ data: Task[] | null; error: any }> {
  const startIso = new Date(`${startDate}T00:00:00`).toISOString();
  const endIso = new Date(`${endDate}T23:59:59.999`).toISOString();

  const { data, error } = await supabase
    .from('tasks')
    .select(`
      *,
      task_assignees (
        user_id,
        is_completed,
        completed_at
      )
    `)
    .eq('status', 'DONE')
    .gte('completed_at', startIso)
    .lte('completed_at', endIso)
    .is('deleted_at', null);

  if (error) {
    console.error('Error fetching completed tasks by date range:', error);
    return { data: null, error };
  }

  return { data: data as Task[], error: null };
}

/**
 * Get backlog tasks (due_date is NULL, excluding soft-deleted)
 */
export async function getBacklogTasks(): Promise<{ data: Task[] | null; error: any }> {
  const { data, error } = await supabase
    .from('tasks')
    .select(`
      *,
      task_assignees (
        user_id,
        is_completed,
        completed_at
      )
    `)
    .is('due_date', null)
    .eq('status', 'TODO') // Only TODO tasks (no DONE/CANCEL)
    .is('deleted_at', null) // Soft delete filter
    .order('created_at', { ascending: false }); // Latest first (descending)

  if (error) {
    console.error('Error fetching backlog tasks:', error);
    return { data: null, error };
  }

  // Enrich with profile data
  if (data) {
    const enrichedData = await enrichTasksWithProfiles(data);
    return { data: enrichedData as Task[], error: null };
  }

  return { data: data as Task[], error: null };
}

// Import shared profile fetching utility
import { fetchProfiles } from './profiles';

/**
 * Enrich tasks with profile data for assignees (with caching)
 */
export async function enrichTasksWithProfiles(tasks: any[]): Promise<any[]> {
  if (!tasks || tasks.length === 0) {
    return tasks;
  }

  // Get all unique user IDs from assignees
  const userIds = new Set<string>();
  tasks.forEach(task => {
    if (task.task_assignees && Array.isArray(task.task_assignees)) {
      task.task_assignees.forEach((assignee: any) => {
        if (assignee.user_id) {
          userIds.add(assignee.user_id);
        }
      });
    }
  });

  if (userIds.size === 0) {
    return tasks;
  }

  // Fetch profiles (with caching)
  const profileMap = await fetchProfiles(Array.from(userIds));

  // Enrich tasks with profile data
  const enrichedTasks = tasks.map(task => {
    if (task.task_assignees && Array.isArray(task.task_assignees)) {
      task.assignees = task.task_assignees.map((assignee: any) => ({
        user_id: assignee.user_id,
        is_completed: assignee.is_completed || false,
        completed_at: assignee.completed_at || null,
        profile: profileMap.get(assignee.user_id) || null,
      }));
      delete task.task_assignees;
    }
    return task;
  });

  return enrichedTasks;
}

/**
 * Calculate rollover info for tasks
 * 
 * differenceInCalendarDays를 사용하여 시간(Time)을 무시하고
 * 순수한 캘린더 날짜 차이만 계산
 */
export function calculateRolloverInfo(tasks: Task[]): TaskWithRollover[] {
  const today = new Date();

  return tasks.map((task) => {
    if (!task.original_due_date || task.status !== 'TODO') {
      return {
        ...task,
        daysOverdue: 0,
        isOverdue: false,
      };
    }

    // original_due_date 문자열을 Date 객체로 파싱
    // parse를 사용하여 로컬 타임존으로 해석
    const originalDate = parse(task.original_due_date, 'yyyy-MM-dd', new Date());

    // differenceInCalendarDays: 캘린더 날짜 차이만 계산 (시간 무시)
    const diffDays = differenceInCalendarDays(today, originalDate);

    return {
      ...task,
      daysOverdue: diffDays > 0 ? diffDays : 0,
      isOverdue: diffDays > 0,
    };
  });
}

/**
 * Calculate progress info for tasks with assignees
 */
export function calculateTaskProgress(
  task: Task,
  currentUserId?: string
): {
  completedCount: number;
  totalCount: number;
  progressPercent: number;
  myCompletion: boolean;
  displayText: string;
} {
  const assignees = Array.isArray(task.task_assignees) ? task.task_assignees : [];
  const totalCount = assignees.length;
  const completedCount = assignees.filter((a: { is_completed?: boolean }) => a.is_completed).length;
  const progressPercent = totalCount > 0 
    ? Math.round((completedCount / totalCount) * 100) 
    : 0;
  
  const myCompletion = currentUserId
    ? assignees.find((a: { user_id: string }) => a.user_id === currentUserId)?.is_completed || false
    : false;

  const displayText = totalCount > 0 
    ? `${completedCount}/${totalCount}` 
    : '0/0';

  return {
    completedCount,
    totalCount,
    progressPercent,
    myCompletion,
    displayText,
  };
}

/**
 * Create a new task (personal only)
 * For group tasks with multiple assignees, use createTaskWithAssignees instead
 */
export async function createTask(input: CreateTaskInput) {
  // 🔍 인증 상태 확인 및 대기
  let user = null;
  let retries = 0;
  const maxRetries = 3;
  
  while (!user && retries < maxRetries) {
    const { data: userData } = await supabase.auth.getUser();
    user = userData?.user;
    
    if (!user) {
      console.log(`⏳ User not ready, retrying... (${retries + 1}/${maxRetries})`);
      await new Promise(resolve => setTimeout(resolve, 500)); // 500ms 대기
      retries++;
    }
  }
  
  if (!user) {
    console.error('🚨 User authentication failed after retries');
    return { data: null, error: new Error('User not authenticated') };
  }
  
  console.log('✅ User authenticated:', { id: user.id, email: user.email });

  // Step 1: Insert the task (INSERT policy only checks creator_id)
  const taskData = {
    creator_id: user.id,
    group_id: input.group_id || null,
    title: input.title,
    status: input.status || 'TODO',
    due_date: input.due_date || null,
    due_time: input.due_time || null,
    due_time_end: input.due_time_end || null,
    original_due_date: input.due_date || null,
  };

  const { data: task, error: taskError } = await supabase
    .from('tasks')
    .insert(taskData)
    .select()
    .single();

  if (taskError) {
    console.error('Error creating task:', taskError);
    return { data: null, error: taskError };
  }

  // Step 2: Add assignee (now task exists, so SELECT policy will pass)
  const { error: assigneeError } = await supabase
    .from('task_assignees')
    .insert({
      task_id: task.id,
      user_id: input.assignee_ids?.[0] ?? user.id,
      is_completed: false,
    });

  // 🔍 user.id 확인 로직
  if (!user.id) {
    console.error('🚨 Critical: user.id is undefined!', { user, input });
    return { data: null, error: new Error('User not authenticated') };
  }

  if (assigneeError) {
    console.error('Error creating task assignee:', assigneeError);
    // Rollback: Delete the task if assignee creation fails
    await supabase.from('tasks').delete().eq('id', task.id);
    return { data: null, error: assigneeError };
  }

  // Re-fetch with assignees
  const { data: taskWithAssignees, error: fetchError } = await supabase
    .from('tasks')
    .select(`
      *,
      task_assignees (
        user_id,
        is_completed,
        completed_at
      )
    `)
    .eq('id', task.id)
    .single();

  if (fetchError) {
    console.error('Error fetching created task:', fetchError);
    return { data: task as Task, error: null };
  }

  // Enrich with profiles before returning
  if (taskWithAssignees) {
    const enriched = await enrichTasksWithProfiles([taskWithAssignees]);
    return { data: enriched[0] as Task, error: null };
  }

  return { data: task as Task, error: null };
}

/**
 * Create group task with multiple assignees (1 task -> N assignees)
 * Client-side logic without RPC
 */
export async function createTaskWithAssignees(input: CreateTaskWithAssigneesInput) {
  const { data: { user } } = await supabase.auth.getUser();
  
  if (!user) {
    return { data: null, error: new Error('User not authenticated') };
  }

  // Note: assignees can be empty array - group tasks can exist without assignees

  // Step 1: Create the task
  const taskData = {
    creator_id: user.id,
    group_id: input.group_id,
    title: input.title,
    status: 'TODO' as const,
    due_date: input.due_date || null,
    due_time: input.due_time || null,
    due_time_end: input.due_time_end || null,
    original_due_date: input.due_date || null,
  };

  const { data: task, error: taskError } = await supabase
    .from('tasks')
    .insert(taskData)
    .select()
    .single();

  if (taskError) {
    console.error('Error creating group task:', taskError);
    return { data: null, error: taskError };
  }

  // Step 2: Add assignees only if provided
  if (input.assignees && input.assignees.length > 0) {
    const assigneeData = input.assignees.map(a => ({
      task_id: task.id,
      user_id: a.user_id,
      is_completed: a.is_completed ?? false,
    }));

    const { error: assigneeError } = await supabase
      .from('task_assignees')
      .insert(assigneeData);

    if (assigneeError) {
      console.error('Error creating task assignees:', assigneeError);
      // Rollback: Delete the task if assignee creation fails
      await supabase.from('tasks').delete().eq('id', task.id);
      return { data: null, error: assigneeError };
    }
  }

  // Step 3: Fetch the complete task with assignees (use task_assignees to match other queries)
  const { data: taskWithAssignees, error: fetchError } = await supabase
    .from('tasks')
    .select(`
      *,
      task_assignees (
        user_id,
        is_completed,
        completed_at
      )
    `)
    .eq('id', task.id)
    .single();

  if (fetchError) {
    console.error('Error fetching created task:', fetchError);
    return { data: null, error: fetchError };
  }

  // Enrich with profiles before returning
  if (taskWithAssignees) {
    const enriched = await enrichTasksWithProfiles([taskWithAssignees]);
    return { data: enriched[0] as Task, error: null };
  }

  return { data: taskWithAssignees as Task, error: null };
}

/**
 * Toggle assignee completion (OWNER can toggle any assignee, MEMBER can only toggle themselves).
 * Reads current status from DB then toggles (avoids stale client state). Then syncs task status.
 * @param taskId - Task ID
 * @param assigneeId - User ID to toggle
 * @param _currentStatus - Ignored; we read from DB so client state cannot cause wrong toggle
 */
export async function toggleAssigneeCompletion(
  taskId: string,
  assigneeId: string,
  _currentStatus?: boolean
): Promise<{ data: boolean | null; error: Error | null }> {
  try {
    // 0) Read current status from DB (single source of truth; avoids stale UI)
    const { data: currentRow, error: fetchErr } = await supabase
      .from('task_assignees')
      .select('is_completed')
      .eq('task_id', taskId)
      .eq('user_id', assigneeId)
      .maybeSingle();

    if (fetchErr || currentRow == null) {
      console.error('🔴 [API toggleAssigneeCompletion] Assignee not found or error:', fetchErr);
      return { data: null, error: fetchErr || new Error('Assignee not found') };
    }

    const newStatus = !(currentRow.is_completed === true);
    const completedAt = newStatus ? new Date().toISOString() : null;

    // 1) Update this assignee
    const { data: updateResult, error: updateError } = await supabase
      .from('task_assignees')
      .update({
        is_completed: newStatus,
        completed_at: completedAt,
      })
      .eq('task_id', taskId)
      .eq('user_id', assigneeId)
      .select() as any;

    if (updateError) {
      console.error('🔴 [API toggleAssigneeCompletion] Error updating assignee:', updateError);
      return { data: null, error: updateError };
    }

    if (!updateResult || (Array.isArray(updateResult) && updateResult.length === 0)) {
      console.error('🔴 [API toggleAssigneeCompletion] No rows updated! Assignee not found.');
      return { data: null, error: new Error('Assignee not found') };
    }

    // 2) Sync task status: DONE only when all assignees are completed
    const { data: assignees, error: fetchError } = await supabase
      .from('task_assignees')
      .select('is_completed')
      .eq('task_id', taskId);

    if (fetchError) {
      console.error('🔴 [API toggleAssigneeCompletion] Error fetching assignees for task status:', fetchError);
      return { data: null, error: fetchError };
    }

    const allCompleted =
      Array.isArray(assignees) &&
      assignees.length > 0 &&
      assignees.every((a: { is_completed: boolean }) => a.is_completed);

    const { error: taskUpdateError } = await supabase
      .from('tasks')
      .update({
        status: allCompleted ? 'DONE' : 'TODO',
        completed_at: allCompleted ? new Date().toISOString() : null,
      })
      .eq('id', taskId);

    if (taskUpdateError) {
      console.error('🔴 [API toggleAssigneeCompletion] Error syncing task status:', taskUpdateError);
      return { data: null, error: taskUpdateError };
    }

    return { data: true, error: null };
  } catch (error) {
    console.error('[API toggleAssigneeCompletion] Exception:', error);
    return { data: null, error: error as Error };
  }
}

/**
 * Toggle all assignees completion (OWNER only)
 * Sets all assignees to the same completion status
 */
export async function toggleAllAssigneesCompletion(
  taskId: string,
  isCompleted: boolean
): Promise<{ error: Error | null }> {
  try {
    console.log('[toggleAllAssigneesCompletion] START:', { taskId, isCompleted });
    
    const completedAt = isCompleted ? new Date().toISOString() : null;

    // Update all assignees
    const { data: assigneesData, error: assigneesError, count: assigneesCount } = await supabase
      .from('task_assignees')
      .update({
        is_completed: isCompleted,
        completed_at: completedAt,
      })
      .eq('task_id', taskId)
      .select();

    if (assigneesError) {
      console.error('[toggleAllAssigneesCompletion] ❌ Error updating assignees:', assigneesError);
      return { error: assigneesError };
    }

    console.log('[toggleAllAssigneesCompletion] ✅ Assignees updated:', { 
      count: assigneesCount, 
      updatedRows: assigneesData?.length || 0 
    });

    // Update task status
    const { data: taskData, error: taskError, count: taskCount } = await supabase
      .from('tasks')
      .update({
        status: isCompleted ? 'DONE' : 'TODO',
        completed_at: completedAt,
      })
      .eq('id', taskId)
      .select();

    if (taskError) {
      console.error('[toggleAllAssigneesCompletion] ❌ Error updating task:', taskError);
      return { error: taskError };
    }

    console.log('[toggleAllAssigneesCompletion] ✅ Task updated:', { 
      count: taskCount,
      taskId: taskData?.[0]?.id,
      newStatus: taskData?.[0]?.status 
    });

    console.log('[toggleAllAssigneesCompletion] ✅ SUCCESS - All updates completed');
    return { error: null };
  } catch (error) {
    console.error('[toggleAllAssigneesCompletion] ❌ Exception:', error);
    return { error: error as Error };
  }
}

/**
 * Check if user can toggle assignee completion
 * @param task - The task
 * @param targetUserId - User ID to toggle
 * @param currentUserId - Current user ID
 * @param userRole - User's role in the group (OWNER, ADMIN, or MEMBER)
 * @returns true if user has permission
 */
export function canToggleAssignee(
  task: Task,
  targetUserId: string,
  currentUserId: string,
  userRole?: 'OWNER' | 'ADMIN' | 'MEMBER'
): boolean {
  // Personal tasks use different logic
  if (!task.group_id) return false;

  // Group owner and admin can toggle any assignee
  if (userRole === 'OWNER' || userRole === 'ADMIN') return true;

  // Members can only toggle their own completion
  return targetUserId === currentUserId;
}

/**
 * Toggle task completion for current user (for multi-assignee tasks)
 * @deprecated Use toggleAssigneeCompletion instead
 */
export async function toggleMyTaskCompletion(taskId: string) {
  const { data: { user } } = await supabase.auth.getUser();
  
  if (!user) {
    return { data: null, error: new Error('User not authenticated') };
  }

  const { data: assignee } = await supabase
    .from('task_assignees')
    .select('is_completed')
    .eq('task_id', taskId)
    .eq('user_id', user.id)
    .maybeSingle();
  const currentStatus = assignee?.is_completed ?? false;
  return toggleAssigneeCompletion(taskId, user.id, currentStatus);
}

/**
 * Update a task
 * Note: original_due_date is NOT updated to preserve rollover calculation
 * Auto-sets completed_at based on status changes:
 *   - DONE: sets completed_at to now (if not manually provided)
 *   - TODO/CANCEL: clears completed_at (if not manually provided)
 */
export async function updateTask(input: UpdateTaskInput) {
  const { id, ...updates } = input;

  // Auto-manage completed_at based on status changes
  if (updates.status && !('completed_at' in updates)) {
    if (updates.status === 'DONE') {
      // Task marked as done → set completed_at to now
      updates.completed_at = new Date().toISOString();
    } else {
      // Task marked as TODO/CANCEL → clear completed_at
      updates.completed_at = null;
    }
  }

  const { data, error } = await supabase
    .from('tasks')
    .update(updates)
    .eq('id', id)
    .select()
    .single();

  if (error) {
    console.error('Error updating task:', error);
    return { data: null, error };
  }

  return { data: data as Task, error: null };
}

/**
 * Get a single task by ID with assignees and profiles
 * @param taskId - Task ID
 */
export async function getTaskById(taskId: string): Promise<{ data: Task | null; error: any }> {
  try {
    const { data, error } = await supabase
      .from('tasks')
      .select(`
        *,
        task_assignees (
          user_id,
          is_completed,
          completed_at
        )
      `)
      .eq('id', taskId)
      .is('deleted_at', null)
      .single();

    if (error) {
      console.error('[getTaskById] Error:', error);
      return { data: null, error };
    }

    // Enrich with profiles
    if (data) {
      const enriched = await enrichTasksWithProfiles([data as Task]);
      return { data: enriched[0] || null, error: null };
    }

    return { data: null, error: null };
  } catch (error) {
    console.error('[getTaskById] Exception:', error);
    return { data: null, error };
  }
}

/**
 * Update task assignees
 * Replaces all existing assignees with new ones
 * @param taskId - Task ID
 * @param assigneeIds - Array of user IDs to assign (empty array = remove all assignees)
 */
export async function updateTaskAssignees(
  taskId: string,
  assigneeIds: string[]
): Promise<{ data: boolean | null; error: Error | null }> {
  try {
    // Step 1: Delete all existing assignees
    const { error: deleteError } = await supabase
      .from('task_assignees')
      .delete()
      .eq('task_id', taskId);

    if (deleteError) {
      console.error('Error deleting existing assignees:', deleteError);
      return { data: null, error: deleteError };
    }

    // Step 2: Insert new assignees (if any)
    if (assigneeIds.length > 0) {
      const newAssignees = assigneeIds.map(userId => ({
        task_id: taskId,
        user_id: userId,
        is_completed: false,
        completed_at: null,
      }));

      const { error: insertError } = await supabase
        .from('task_assignees')
        .insert(newAssignees);

      if (insertError) {
        console.error('Error inserting new assignees:', insertError);
        return { data: null, error: insertError };
      }
    }

    // Step 3: Update task status based on new assignees
    // If no assignees, task status should remain TODO (or could be set to DONE if all were completed)
    // For now, we'll keep the current status
    // If assignees exist, ensure status is TODO (since new assignees are not completed)
    if (assigneeIds.length > 0) {
      const { error: statusError } = await supabase
        .from('tasks')
        .update({
          status: 'TODO',
          completed_at: null,
        })
        .eq('id', taskId);

      if (statusError) {
        console.error('Error updating task status:', statusError);
        // Don't fail the whole operation
      }
    }

    return { data: true, error: null };
  } catch (error) {
    console.error('Exception updating task assignees:', error);
    return { data: null, error: error as Error };
  }
}

/**
 * Postpone a task to tomorrow
 * Updates due_date to tomorrow while preserving original_due_date for rollover calculation
 */
export async function postponeTask(taskId: string) {
  // Calculate tomorrow's date in local timezone
  const tomorrow = addDays(new Date(), 1);
  const tomorrowFormatted = format(tomorrow, 'yyyy-MM-dd');

  const { data, error } = await supabase
    .from('tasks')
    .update({ due_date: tomorrowFormatted })
    .eq('id', taskId)
    .select()
    .single();

  if (error) {
    console.error('Error postponing task:', error);
    return { data: null, error };
  }

  return { data: data as Task, error: null };
}

/**
 * Postpone a task to a specific date (current date + 1 day)
 * Updates due_date while preserving original_due_date for rollover calculation
 */
export async function postponeTaskToDate(taskId: string, targetDate: string) {
  // targetDate should be in yyyy-MM-dd format
  const { data, error } = await supabase
    .from('tasks')
    .update({ due_date: targetDate })
    .eq('id', taskId)
    .select()
    .single();

  if (error) {
    console.error('Error postponing task to date:', error);
    return { data: null, error };
  }

  return { data: data as Task, error: null };
}

/**
 * Soft delete a task (set deleted_at timestamp)
 */
export async function deleteTask(taskId: string) {
  const { error } = await supabase
    .from('tasks')
    .update({ deleted_at: new Date().toISOString() })
    .eq('id', taskId);

  if (error) {
    console.error('Error soft deleting task:', error);
    return { error };
  }

  return { error: null };
}

/**
 * Hard delete a task (permanent removal - use with caution)
 */
export async function hardDeleteTask(taskId: string) {
  const { error } = await supabase
    .from('tasks')
    .delete()
    .eq('id', taskId);

  if (error) {
    console.error('Error hard deleting task:', error);
    return { error };
  }

  return { error: null };
}

/**
 * Duplicate tasks in the given week to the next week (same weekday).
 * Only tasks whose due_date is in [currentWeekStart, currentWeekEnd] (이번주 시작 ~ 이번주 끝).
 * 연기된 일정(rollover)은 due_date가 이번주 시작 전이므로 자동 제외됨.
 */
export async function duplicateTasksToNextWeek(
  currentWeekStart: Date,
  currentWeekEnd: Date
): Promise<{ data: { copied: number }; error: any }> {
  const startStr = format(currentWeekStart, 'yyyy-MM-dd');
  const endStr = format(currentWeekEnd, 'yyyy-MM-dd');

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return { data: null, error: new Error('User not authenticated') };
  }

  const { data: tasks, error: fetchError } = await supabase
    .from('tasks')
    .select(`
      id,
      title,
      group_id,
      due_date,
      due_time,
      due_time_end,
      creator_id,
      task_assignees (
        user_id,
        is_completed
      )
    `)
    .gte('due_date', startStr)
    .lte('due_date', endStr)
    .not('due_date', 'is', null)
    .is('deleted_at', null)
    .order('due_date', { ascending: true })
    .order('due_time', { ascending: true, nullsFirst: false });

  if (fetchError) {
    console.error('[duplicateTasksToNextWeek] Fetch error:', fetchError);
    return { data: null, error: fetchError };
  }

  if (!tasks || tasks.length === 0) {
    return { data: { copied: 0 }, error: null };
  }

  const newRows = tasks.map((t: any) => {
    const dueDate = t.due_date ? format(addDays(parseISO(t.due_date), 7), 'yyyy-MM-dd') : null;
    const originalDueDate = dueDate;
    return {
      title: t.title,
      creator_id: user.id,
      group_id: t.group_id ?? null,
      status: 'TODO',
      due_date: dueDate,
      due_time: t.due_time ?? null,
      due_time_end: t.due_time_end ?? null,
      original_due_date: originalDueDate,
    };
  });

  const { data: inserted, error: insertError } = await supabase
    .from('tasks')
    .insert(newRows)
    .select('id');

  if (insertError) {
    console.error('[duplicateTasksToNextWeek] Insert error:', insertError);
    return { data: null, error: insertError };
  }

  const insertedList = (inserted || []) as { id: string }[];
  const assigneesByIndex = tasks.map((t: any) => (t.task_assignees || []).map((a: any) => ({ user_id: a.user_id, is_completed: false })));

  for (let i = 0; i < insertedList.length; i++) {
    const newTaskId = insertedList[i].id;
    const assignees = assigneesByIndex[i];
    if (assignees && assignees.length > 0) {
      const assigneeRows = assignees.map((a: { user_id: string; is_completed: boolean }) => ({
        task_id: newTaskId,
        user_id: a.user_id,
        is_completed: false,
      }));
      const { error: assigneeErr } = await supabase.from('task_assignees').insert(assigneeRows);
      if (assigneeErr) {
        console.error('[duplicateTasksToNextWeek] Assignee insert error for task', newTaskId, assigneeErr);
      }
    }
  }

  return { data: { copied: insertedList.length }, error: null };
}

/**
 * Toggle task status between TODO and DONE
 */
export async function toggleTaskStatus(taskId: string, currentStatus: string) {
  const newStatus = currentStatus === 'TODO' ? 'DONE' : 'TODO';
  
  return updateTask({ id: taskId, status: newStatus });
}

/**
 * Move a task to today
 * Updates due_date to today, but keeps original_due_date unchanged
 */
export async function moveTaskToToday(taskId: string) {
  // date-fns format으로 로컬 타임존 기준 오늘 날짜 생성
  const today = format(new Date(), 'yyyy-MM-dd');
  
  return updateTask({ id: taskId, due_date: today });
}

/**
 * Move a task to backlog
 * Sets both due_date and original_due_date to NULL (no date)
 */
export async function moveTaskToBacklog(taskId: string) {
  return updateTask({ id: taskId, due_date: null, original_due_date: null });
}

/**
 * Get user statistics: completed count, total delay days, and backlog count
 * 
 * Logic:
 * - Personal tasks (group_id = null): Count if creator_id = userId
 * - Group tasks:
 *   - OWNER/ADMIN: Count all completed tasks in the group
 *   - MEMBER: Count only tasks where user is an assignee
 */
export async function getUserStats(userId: string): Promise<{
  completedCount: number;
  totalDelayDays: number;
  backlogCount: number;
  error: Error | null;
}> {
  try {
    const today = format(new Date(), 'yyyy-MM-dd');

    // 1. Get user's groups and roles
    const { data: memberRows, error: memberError } = await supabase
      .from('group_members')
      .select('group_id, role')
      .eq('user_id', userId);

    if (memberError) {
      console.error('Error fetching user groups:', memberError);
      return { completedCount: 0, totalDelayDays: 0, backlogCount: 0, error: memberError as Error };
    }

    const userRoleMap = new Map<string, 'OWNER' | 'ADMIN' | 'MEMBER'>();
    const ownerAdminGroupIds: string[] = [];
    const memberGroupIds: string[] = [];

    if (memberRows) {
      memberRows.forEach((m) => {
        const role = m.role as 'OWNER' | 'ADMIN' | 'MEMBER';
        userRoleMap.set(m.group_id, role);
        if (role === 'OWNER' || role === 'ADMIN') {
          ownerAdminGroupIds.push(m.group_id);
        } else {
          memberGroupIds.push(m.group_id);
        }
      });
    }

    // 2. Get completed tasks
    // Personal tasks: creator_id = userId
    // Group tasks (OWNER/ADMIN): all tasks in their groups
    // Group tasks (MEMBER): tasks where user is assignee
    const completedTasksQueries: Promise<any>[] = [];

    // Personal completed tasks
    const personalCompletedQuery = supabase
      .from('tasks')
      .select('id, due_date, original_due_date, completed_at, status, group_id, creator_id')
      .eq('status', 'DONE')
      .is('group_id', null)
      .eq('creator_id', userId)
      .not('completed_at', 'is', null)
      .is('deleted_at', null);

    completedTasksQueries.push(personalCompletedQuery as unknown as Promise<any>);

    // Group tasks where user is OWNER/ADMIN (all tasks in group)
    if (ownerAdminGroupIds.length > 0) {
      const ownerAdminCompletedQuery = supabase
        .from('tasks')
        .select('id, due_date, original_due_date, completed_at, status, group_id, creator_id')
        .eq('status', 'DONE')
        .in('group_id', ownerAdminGroupIds)
        .not('completed_at', 'is', null)
        .is('deleted_at', null);

      completedTasksQueries.push(ownerAdminCompletedQuery as unknown as Promise<any>);
    }

    // Group tasks where user is MEMBER (only assigned tasks)
    if (memberGroupIds.length > 0) {
      const memberCompletedQuery = supabase
        .from('tasks')
        .select(`
          id,
          due_date,
          original_due_date,
          completed_at,
          status,
          group_id,
          creator_id,
          task_assignees!inner (
            user_id,
            is_completed
          )
        `)
        .eq('status', 'DONE')
        .in('group_id', memberGroupIds)
        .eq('task_assignees.user_id', userId)
        .eq('task_assignees.is_completed', true)
        .not('completed_at', 'is', null)
        .is('deleted_at', null);

      completedTasksQueries.push(memberCompletedQuery as unknown as Promise<any>);
    }

    // Execute all queries (Supabase query builders are thenable)
    const completedResults = await Promise.all(completedTasksQueries);
    const allCompletedTasks: any[] = [];
    let completedError: any = null;

    for (const result of completedResults) {
      if (result.error) {
        completedError = result.error;
        break;
      }
      if (result.data) {
        allCompletedTasks.push(...result.data);
      }
    }

    if (completedError) {
      console.error('Error fetching completed tasks:', completedError);
      return { completedCount: 0, totalDelayDays: 0, backlogCount: 0, error: completedError as Error };
    }

    // Remove duplicates (in case a task appears in multiple queries)
    const uniqueCompletedTasks = Array.from(
      new Map(allCompletedTasks.map((task: any) => [task.id, task])).values()
    );

    const completedCount = uniqueCompletedTasks.length;

    // 3. Calculate delay days from completed tasks (completed_at > due_date or original_due_date)
    let completedDelayDays = 0;
    uniqueCompletedTasks.forEach((task: any) => {
      if (task.completed_at) {
        // Use original_due_date if available (for backlog tasks), otherwise use due_date
        const referenceDueDate = task.original_due_date || task.due_date;
        if (referenceDueDate) {
          const completedDate = parseISO(task.completed_at);
          const dueDate = parseISO(referenceDueDate);
          const daysLate = differenceInCalendarDays(completedDate, dueDate);
          if (daysLate > 0) {
            completedDelayDays += daysLate;
          }
        }
      }
    });

    // 4. Get incomplete tasks with delay (TODO status)
    // IMPORTANT: We need to check both due_date and original_due_date for delay calculation
    // A task can have due_date = today (moved from backlog) but original_due_date < today (overdue)
    const incompleteTasksQueries: Promise<any>[] = [];

    // Personal incomplete tasks
    // Fetch all TODO tasks, we'll filter by delay in JavaScript
    const personalIncompleteQuery = supabase
      .from('tasks')
      .select('id, due_date, original_due_date, status, group_id, creator_id')
      .eq('status', 'TODO')
      .is('group_id', null)
      .eq('creator_id', userId)
      .is('deleted_at', null);

    incompleteTasksQueries.push(personalIncompleteQuery as unknown as Promise<any>);

    // Group tasks where user is OWNER/ADMIN (all tasks in group)
    if (ownerAdminGroupIds.length > 0) {
      const ownerAdminIncompleteQuery = supabase
        .from('tasks')
        .select('id, due_date, original_due_date, status, group_id, creator_id')
        .eq('status', 'TODO')
        .in('group_id', ownerAdminGroupIds)
        .is('deleted_at', null);

      incompleteTasksQueries.push(ownerAdminIncompleteQuery as unknown as Promise<any>);
    }

    // Group tasks where user is MEMBER (only assigned tasks)
    if (memberGroupIds.length > 0) {
      const memberIncompleteQuery = supabase
        .from('tasks')
        .select(`
          id,
          due_date,
          original_due_date,
          status,
          group_id,
          creator_id,
          task_assignees!inner (
            user_id,
            is_completed
          )
        `)
        .eq('status', 'TODO')
        .in('group_id', memberGroupIds)
        .eq('task_assignees.user_id', userId)
        .eq('task_assignees.is_completed', false)
        .is('deleted_at', null);

      incompleteTasksQueries.push(memberIncompleteQuery as unknown as Promise<any>);
    }

    // Execute all incomplete queries (Supabase query builders are thenable)
    const incompleteResults = await Promise.all(incompleteTasksQueries);
    const allIncompleteTasks: any[] = [];
    let incompleteError: any = null;

    for (const result of incompleteResults) {
      if (result.error) {
        incompleteError = result.error;
        break;
      }
      if (result.data) {
        allIncompleteTasks.push(...result.data);
      }
    }

    if (incompleteError) {
      console.error('Error fetching incomplete tasks:', incompleteError);
      return { completedCount, totalDelayDays: completedDelayDays, backlogCount: 0, error: incompleteError as Error };
    }

    // Remove duplicates
    const uniqueIncompleteTasks = Array.from(
      new Map(allIncompleteTasks.map((task: any) => [task.id, task])).values()
    );

    // 5. Calculate delay days from incomplete tasks
    // Use original_due_date if available (for rollover calculation), otherwise use due_date
    // Filter: Only count tasks that have a delay (referenceDueDate < today)
    let incompleteDelayDays = 0;
    uniqueIncompleteTasks.forEach((task: any) => {
      // Use original_due_date if available, otherwise use due_date
      const referenceDueDate = task.original_due_date || task.due_date;
      if (referenceDueDate) {
        const dueDate = parseISO(referenceDueDate);
        const todayDate = parseISO(today);
        const daysOverdue = differenceInCalendarDays(todayDate, dueDate);
        if (daysOverdue > 0) {
          incompleteDelayDays += daysOverdue;
        }
      }
    });

    const totalDelayDays = completedDelayDays + incompleteDelayDays;

    // Debug: Log delay calculation with detailed task info
    const delayedCompletedTasks = uniqueCompletedTasks.filter((task: any) => {
      const referenceDueDate = task.original_due_date || task.due_date;
      if (!referenceDueDate || !task.completed_at) return false;
      const completedDate = parseISO(task.completed_at);
      const dueDate = parseISO(referenceDueDate);
      return differenceInCalendarDays(completedDate, dueDate) > 0;
    });
    
    const delayedIncompleteTasks = uniqueIncompleteTasks.filter((task: any) => {
      const referenceDueDate = task.original_due_date || task.due_date;
      if (!referenceDueDate) return false;
      const dueDate = parseISO(referenceDueDate);
      const todayDate = parseISO(today);
      return differenceInCalendarDays(todayDate, dueDate) > 0;
    });

    console.log('[getUserStats] Delay calculation:', {
      userId,
      completedTasksCount: uniqueCompletedTasks.length,
      delayedCompletedTasksCount: delayedCompletedTasks.length,
      completedDelayDays,
      incompleteTasksCount: uniqueIncompleteTasks.length,
      delayedIncompleteTasksCount: delayedIncompleteTasks.length,
      incompleteDelayDays,
      totalDelayDays,
      delayedCompletedTaskIds: delayedCompletedTasks.map((t: any) => t.id),
      delayedIncompleteTaskIds: delayedIncompleteTasks.map((t: any) => t.id),
    });

    // 6. Get backlog tasks count
    const backlogTasksQueries: Promise<any>[] = [];

    // Personal backlog tasks
    const personalBacklogQuery = supabase
      .from('tasks')
      .select('id')
      .is('due_date', null)
      .eq('status', 'TODO')
      .is('group_id', null)
      .eq('creator_id', userId)
      .is('deleted_at', null);

    backlogTasksQueries.push(personalBacklogQuery as unknown as Promise<any>);

    // Group backlog tasks where user is OWNER/ADMIN (all tasks in group)
    if (ownerAdminGroupIds.length > 0) {
      const ownerAdminBacklogQuery = supabase
        .from('tasks')
        .select('id')
        .is('due_date', null)
        .eq('status', 'TODO')
        .in('group_id', ownerAdminGroupIds)
        .is('deleted_at', null);

      backlogTasksQueries.push(ownerAdminBacklogQuery as unknown as Promise<any>);
    }

    // Group backlog tasks where user is MEMBER (only assigned tasks)
    if (memberGroupIds.length > 0) {
      const memberBacklogQuery = supabase
        .from('tasks')
        .select(`
          id,
          task_assignees!inner (
            user_id
          )
        `)
        .is('due_date', null)
        .eq('status', 'TODO')
        .in('group_id', memberGroupIds)
        .eq('task_assignees.user_id', userId)
        .is('deleted_at', null);

      backlogTasksQueries.push(memberBacklogQuery as unknown as Promise<any>);
    }

    // Execute all backlog queries (Supabase query builders are thenable)
    const backlogResults = await Promise.all(backlogTasksQueries);
    const allBacklogTasks: any[] = [];
    let backlogError: any = null;

    for (const result of backlogResults) {
      if (result.error) {
        backlogError = result.error;
        break;
      }
      if (result.data) {
        allBacklogTasks.push(...result.data);
      }
    }

    if (backlogError) {
      console.error('Error fetching backlog tasks:', backlogError);
      return { completedCount, totalDelayDays, backlogCount: 0, error: backlogError as Error };
    }

    // Remove duplicates
    const uniqueBacklogTasks = Array.from(
      new Map(allBacklogTasks.map((task: any) => [task.id, task])).values()
    );

    const backlogCount = uniqueBacklogTasks.length;

    return { completedCount, totalDelayDays, backlogCount, error: null };
  } catch (err: any) {
    console.error('Exception getting user stats:', err);
    return { completedCount: 0, totalDelayDays: 0, backlogCount: 0, error: err };
  }
}
