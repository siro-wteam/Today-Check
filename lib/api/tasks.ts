/**
 * Tasks API - CRUD operations for tasks
 */

import { supabase } from '../supabase';
import type { Task, CreateTaskInput, UpdateTaskInput, TaskWithRollover } from '../types';
import { format, differenceInCalendarDays, parse, addDays } from 'date-fns';

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
 * Query 1: Get all active (TODO) tasks up to today
 * This ensures all incomplete tasks are visible regardless of how old they are
 */
export async function getActiveTasks(): Promise<{ data: Task[] | null; error: any }> {
  const today = format(new Date(), 'yyyy-MM-dd');

  const { data, error } = await supabase
    .from('tasks')
    .select('*')
    .eq('status', 'TODO')
    .lte('due_date', today)
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
  const { data, error } = await supabase
    .from('tasks')
    .select('*')
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
 * Get completed tasks by completed_at range (regardless of due_date)
 */
export async function getCompletedTasksByDateRange(
  startDate: string, // yyyy-MM-dd
  endDate: string     // yyyy-MM-dd
): Promise<{ data: Task[] | null; error: any }> {
  const startIso = new Date(`${startDate}T00:00:00`).toISOString();
  const endIso = new Date(`${endDate}T23:59:59.999`).toISOString();

  const { data, error } = await supabase
    .from('tasks')
    .select('*')
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
 * Initial fetch: Combine active tasks and timeline window
 * Returns deduplicated tasks
 */
export async function getActiveTasksAndTimeline(): Promise<{ data: Task[] | null; error: any }> {
  const today = new Date();
  const todayStr = format(today, 'yyyy-MM-dd');
  
  // Timeline window: ±7 days
  const startDate = format(addDays(today, -7), 'yyyy-MM-dd');
  const endDate = format(addDays(today, 7), 'yyyy-MM-dd');

  try {
    // Run both queries in parallel
    const [activeResult, timelineResult, completedResult] = await Promise.all([
      getActiveTasks(),
      getTimelineTasks(startDate, endDate),
      getCompletedTasksByDateRange(startDate, endDate),
    ]);

    if (activeResult.error) return activeResult;
    if (timelineResult.error) return timelineResult;
    if (completedResult.error) return completedResult;

    // Merge and deduplicate by id
    const taskMap = new Map<string, Task>();
    
    // Add active tasks first
    activeResult.data?.forEach(task => {
      taskMap.set(task.id, task);
    });

    // Add timeline tasks (won't overwrite if already exists)
    timelineResult.data?.forEach(task => {
      if (!taskMap.has(task.id)) {
        taskMap.set(task.id, task);
      }
    });

    // Add completed tasks by completion date (won't overwrite if already exists)
    completedResult.data?.forEach(task => {
      if (!taskMap.has(task.id)) {
        taskMap.set(task.id, task);
      }
    });

    const mergedTasks = Array.from(taskMap.values());

    // Sort by date
    mergedTasks.sort((a, b) => {
      if (a.due_date! < b.due_date!) return -1;
      if (a.due_date! > b.due_date!) return 1;
      
      // Same date, sort by time
      if (a.due_time && b.due_time) {
        if (a.due_time < b.due_time) return -1;
        if (a.due_time > b.due_time) return 1;
      }
      
      // Finally by created_at
      if (a.created_at < b.created_at) return -1;
      if (a.created_at > b.created_at) return 1;
      
      return 0;
    });

    return { data: mergedTasks, error: null };
  } catch (error) {
    console.error('Error fetching active tasks and timeline:', error);
    return { data: null, error };
  }
}

/**
 * Get backlog tasks (due_date is NULL, excluding soft-deleted)
 */
export async function getBacklogTasks(): Promise<{ data: Task[] | null; error: any }> {
  const { data, error } = await supabase
    .from('tasks')
    .select('*')
    .is('due_date', null)
    .eq('status', 'TODO') // Only TODO tasks (no DONE/CANCEL)
    .is('deleted_at', null) // Soft delete filter
    .order('created_at', { ascending: false }); // Latest first (descending)

  if (error) {
    console.error('Error fetching backlog tasks:', error);
    return { data: null, error };
  }

  return { data: data as Task[], error: null };
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
 * Create a new task
 */
export async function createTask(input: CreateTaskInput) {
  const { data: { user } } = await supabase.auth.getUser();
  
  if (!user) {
    return { data: null, error: new Error('User not authenticated') };
  }

  // Set original_due_date to due_date if due_date is provided
  const taskData = {
    user_id: user.id,
    title: input.title,
    status: input.status || 'TODO',
    due_date: input.due_date || null,
    due_time: input.due_time || null,
    original_due_date: input.due_date || null, // Set once on creation
  };

  const { data, error } = await supabase
    .from('tasks')
    .insert(taskData)
    .select()
    .single();

  if (error) {
    console.error('Error creating task:', error);
    return { data: null, error };
  }

  return { data: data as Task, error: null };
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
 * Sets due_date to NULL
 */
export async function moveTaskToBacklog(taskId: string) {
  return updateTask({ id: taskId, due_date: null });
}
