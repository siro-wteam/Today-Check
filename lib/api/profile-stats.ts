/**
 * Profile Stats API - 프로필 통계 데이터 관리
 */

import { eachDayOfInterval, format, isWithinInterval, startOfDay, subDays } from 'date-fns';
import { supabase } from '../supabase';
import type { Task, TaskAssignee } from '../types';

// Extended Task type with joined assignees
interface TaskWithAssignees extends Task {
  task_assignees?: TaskAssignee[];
}

export interface ProfileStats {
  completed: number;      // 총 완료한 태스크 수
  active: number;        // 현재 진행 중인 TODO 태스크 수
  streak: number;        // 연속으로 태스크를 완료한 일수 (최근 7일 기준)
}

/**
 * Get profile statistics for the current user
 */
export async function getProfileStats(): Promise<{ data: ProfileStats | null; error: any }> {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return { data: null, error: 'User not authenticated' };
    }

    // Get all tasks for the user (excluding soft-deleted)
    // Use task_assignees to find all tasks where user is involved
    const { data: tasks, error } = await supabase
      .from('tasks')
      .select(`
        *,
        task_assignees!inner (
          user_id,
          is_completed,
          completed_at
        )
      `)
      .eq('task_assignees.user_id', user.id)
      .is('deleted_at', null)
      .order('completed_at', { ascending: false, nullsFirst: false });

    if (error) {
      console.error('Error fetching profile stats:', error);
      return { data: null, error };
    }

    if (!tasks || tasks.length === 0) {
      return { 
        data: { 
          completed: 0, 
          active: 0, 
          streak: 0 
        }, 
        error: null 
      };
    }

    const tasksWithAssignees = tasks as TaskWithAssignees[];

    // Calculate completed tasks
    // Check user's completion status in task_assignees
    const completedTasks = tasksWithAssignees.filter(task => {
      const userAssignment = task.task_assignees?.find(
        (assignee: any) => assignee.user_id === user.id
      );
      return userAssignment?.is_completed || false;
    });
    const completedCount = completedTasks.length;

    // Calculate active tasks
    // Check user's completion status in task_assignees
    const activeTasks = tasksWithAssignees.filter(task => {
      const userAssignment = task.task_assignees?.find(
        (assignee: any) => assignee.user_id === user.id
      );
      return !userAssignment?.is_completed;
    });
    const activeCount = activeTasks.length;

    // Calculate streak (consecutive days with completed tasks in the last 7 days)
    const streak = calculateStreak(completedTasks, user.id);

    const stats: ProfileStats = {
      completed: completedCount,
      active: activeCount,
      streak,
    };

    return { data: stats, error: null };
  } catch (error) {
    console.error('Error in getProfileStats:', error);
    return { data: null, error };
  }
}

/**
 * Calculate consecutive days with completed tasks in the last 7 days
 */
function calculateStreak(completedTasks: TaskWithAssignees[], userId: string): number {
  if (!completedTasks || completedTasks.length === 0) {
    return 0;
  }

  const today = startOfDay(new Date());
  const sevenDaysAgo = subDays(today, 6); // Last 7 days including today
  const last7Days = eachDayOfInterval({
    start: sevenDaysAgo,
    end: today,
  });

  // Create a set of dates that have completed tasks
  const datesWithCompletedTasks = new Set<string>();
  
  completedTasks.forEach(task => {
    let completedDate: Date | null = null;
    
    // Use user's completion time from task_assignees
    const userAssignment = task.task_assignees?.find(
      (assignee: any) => assignee.user_id === userId
    );
    if (userAssignment?.completed_at) {
      completedDate = new Date(userAssignment.completed_at);
    }
    
    // Only include dates within the last 7 days
    if (completedDate) {
      const dateOnly = startOfDay(completedDate);
      if (isWithinInterval(dateOnly, { start: sevenDaysAgo, end: today })) {
        datesWithCompletedTasks.add(format(dateOnly, 'yyyy-MM-dd'));
      }
    }
  });

  // Calculate streak from today backwards
  let streak = 0;
  for (let i = last7Days.length - 1; i >= 0; i--) {
    const dateStr = format(last7Days[i], 'yyyy-MM-dd');
    if (datesWithCompletedTasks.has(dateStr)) {
      streak++;
    } else {
      break; // Break the streak when we find a day with no completed tasks
    }
  }

  return streak;
}
