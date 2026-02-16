/**
 * Common task filtering utilities
 * Used by both Weekly and Daily views for consistent task grouping
 */

import { differenceInCalendarDays, format, parseISO, startOfDay } from 'date-fns';
import type { TaskWithRollover } from '../types';

export interface TaskWithOverdue extends TaskWithRollover {
  isOverdue?: boolean;
  daysOverdue?: number;
}

/**
 * Group tasks by date using Map for O(1) lookup
 * Returns: Map<dateString, TaskWithOverdue[]>
 * 
 * Logic:
 * - DONE tasks: Group by completed_at
 * - TODO tasks (overdue): Show ONLY in TODAY
 * - TODO/CANCEL tasks (not overdue): Show on due_date
 */
export function groupTasksByDate(
  tasks: TaskWithRollover[]
): Map<string, TaskWithOverdue[]> {
  const today = startOfDay(new Date());
  const todayStr = format(today, 'yyyy-MM-dd');
  const tasksByDate = new Map<string, TaskWithOverdue[]>();

  // Single pass: add each task to its bucket in iteration order (status-independent).
  // So completing/uncompleting doesn't change "insertion order" before sort.
  tasks.forEach((task) => {
    let bucketKey: string | null = null;
    let payload: TaskWithOverdue = task;

    if (task.status === 'DONE') {
      if (!task.completed_at) return;
      bucketKey = format(parseISO(task.completed_at), 'yyyy-MM-dd');
    } else {
      if (!task.due_date) return;
      const taskDate = parseISO(task.due_date);
      const isTaskPast = taskDate < today;
      if (task.status === 'TODO' && isTaskPast) {
        bucketKey = todayStr;
        payload = { ...task, isOverdue: true, daysOverdue: differenceInCalendarDays(today, taskDate) };
      } else {
        bucketKey = task.due_date;
      }
    }

    if (bucketKey) {
      if (!tasksByDate.has(bucketKey)) tasksByDate.set(bucketKey, []);
      tasksByDate.get(bucketKey)!.push(payload);
    }
  });

  // Sort every date bucket with the same comparator (status-free).
  // Tie-break by id so order is stable when keys are equal.
  const sortByDateTimeOnly = (a: TaskWithOverdue, b: TaskWithOverdue) => {
    const aDateStr = a.original_due_date || a.due_date || a.created_at;
    const bDateStr = b.original_due_date || b.due_date || b.created_at;
    const aDate = parseISO(aDateStr);
    const bDate = parseISO(bDateStr);
    const timeDiff = aDate.getTime() - bDate.getTime();
    if (timeDiff !== 0) return timeDiff;
    if (a.due_time && b.due_time) {
      const t = a.due_time.localeCompare(b.due_time);
      if (t !== 0) return t;
    }
    if (!a.created_at && !b.created_at) return 0;
    if (!a.created_at) return 1;
    if (!b.created_at) return -1;
    const c = a.created_at.localeCompare(b.created_at);
    if (c !== 0) return c;
    return (a.id || '').localeCompare(b.id || '');
  };

  tasksByDate.forEach((bucket) => {
    bucket.sort(sortByDateTimeOnly);
  });

  return tasksByDate;
}

/**
 * Get tasks for a specific date from the Map
 */
export function getTasksForDate(
  tasksByDate: Map<string, TaskWithOverdue[]>,
  dateStr: string
): TaskWithOverdue[] {
  return tasksByDate.get(dateStr) || [];
}
