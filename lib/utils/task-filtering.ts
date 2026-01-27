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
  const overdueTasks: TaskWithOverdue[] = [];

  // Single pass through tasks: O(m) where m = number of tasks
  tasks.forEach((task) => {
    if (task.status === 'DONE') {
      // DONE: Group by completion date
      if (!task.completed_at) return;
      
      const completedDate = parseISO(task.completed_at);
      const completedDateStr = format(completedDate, 'yyyy-MM-dd');
      
      if (!tasksByDate.has(completedDateStr)) {
        tasksByDate.set(completedDateStr, []);
      }
      tasksByDate.get(completedDateStr)!.push(task);
    } else {
      // TODO or CANCEL: Group by due_date
      if (!task.due_date) return;

      const taskDate = parseISO(task.due_date);
      const isTaskPast = taskDate < today;

      if (task.status === 'TODO' && isTaskPast) {
        // Overdue TODO: Show ONLY in TODAY
        const daysOverdue = differenceInCalendarDays(today, taskDate);
        overdueTasks.push({
          ...task,
          isOverdue: true,
          daysOverdue,
        });
      } else {
        // Normal case: Show on due_date
        if (!tasksByDate.has(task.due_date)) {
          tasksByDate.set(task.due_date, []);
        }
        tasksByDate.get(task.due_date)!.push(task);
      }
    }
  });

  // Add overdue tasks to TODAY
  if (overdueTasks.length > 0) {
    if (!tasksByDate.has(todayStr)) {
      tasksByDate.set(todayStr, []);
    }
    const todayTasks = tasksByDate.get(todayStr)!;
    todayTasks.push(...overdueTasks);
    
    // Sort TODAY tasks by original due_date, then by time
    todayTasks.sort((a, b) => {
      const aDateStr = a.original_due_date || a.due_date || a.created_at;
      const bDateStr = b.original_due_date || b.due_date || b.created_at;
      
      const aDate = parseISO(aDateStr);
      const bDate = parseISO(bDateStr);
      
      const timeDiff = aDate.getTime() - bDate.getTime();
      if (timeDiff !== 0) return timeDiff;
      
      // If same date, sort by time
      if (a.due_time && b.due_time) {
        return a.due_time.localeCompare(b.due_time);
      }
      
      // Finally by created_at
      return a.created_at.localeCompare(b.created_at);
    });
  }

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
