/**
 * Tasks API - CRUD operations for tasks
 */

import { supabase } from '../supabase';
import type { Task, CreateTaskInput, UpdateTaskInput, TaskWithRollover } from '../types';
import { format, differenceInCalendarDays, parse } from 'date-fns';

/**
 * Get all tasks for the current user
 */
export async function getTasks() {
  const { data, error } = await supabase
    .from('tasks')
    .select('*')
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
 * Get today's tasks (including rollovers)
 * Returns tasks with due_date <= today and status = TODO or DONE
 */
export async function getTodayTasks(): Promise<{ data: Task[] | null; error: any }> {
  // date-fns format으로 로컬 타임존 기준 오늘 날짜 생성
  const today = format(new Date(), 'yyyy-MM-dd');

  const { data, error } = await supabase
    .from('tasks')
    .select('*')
    .lte('due_date', today)
    .not('due_date', 'is', null)
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
 * Get backlog tasks (due_date is NULL)
 */
export async function getBacklogTasks(): Promise<{ data: Task[] | null; error: any }> {
  const { data, error } = await supabase
    .from('tasks')
    .select('*')
    .is('due_date', null)
    .order('created_at', { ascending: true });

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
 */
export async function updateTask(input: UpdateTaskInput) {
  const { id, ...updates } = input;

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
 * Delete a task
 */
export async function deleteTask(taskId: string) {
  const { error } = await supabase
    .from('tasks')
    .delete()
    .eq('id', taskId);

  if (error) {
    console.error('Error deleting task:', error);
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
