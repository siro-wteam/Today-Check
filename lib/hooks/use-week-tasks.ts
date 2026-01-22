/**
 * Week Tasks Hook - Fetch tasks for a specific week range
 */

import { useQuery } from '@tanstack/react-query';
import { addDays, endOfWeek, format, startOfWeek, subWeeks } from 'date-fns';
import { useState } from 'react';
import { getActiveTasks, getTimelineTasks } from '../api/tasks';
import type { Task } from '../types';

export function useWeekTasks() {
  // Current week offset (0 = this week, -1 = last week, +1 = next week)
  const [weekOffset, setWeekOffset] = useState(0);

  // Calculate week start and end dates (Monday-Sunday)
  const today = new Date();
  const targetWeek = addDays(today, weekOffset * 7);
  const weekStart = startOfWeek(targetWeek, { weekStartsOn: 1 }); // Monday
  const weekEnd = endOfWeek(targetWeek, { weekStartsOn: 1 }); // Sunday

  const weekStartStr = format(weekStart, 'yyyy-MM-dd');
  const weekEndStr = format(weekEnd, 'yyyy-MM-dd');

  // Fetch tasks for the week: Active tasks + Timeline range
  const { data: tasks, isLoading, isError, error, refetch } = useQuery({
    queryKey: ['tasks', 'week', weekStartStr, weekEndStr],
    queryFn: async () => {
      // Run both queries in parallel
      const [activeResult, timelineResult] = await Promise.all([
        getActiveTasks(), // All TODO tasks with due_date <= today
        getTimelineTasks(weekStartStr, weekEndStr), // Tasks in week range
      ]);

      if (activeResult.error) throw activeResult.error;
      if (timelineResult.error) throw timelineResult.error;

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

      return Array.from(taskMap.values());
    },
  });

  // Navigation functions
  const goToPreviousWeek = () => setWeekOffset((prev) => prev - 1);
  const goToNextWeek = () => setWeekOffset((prev) => prev + 1);
  const goToCurrentWeek = () => setWeekOffset(0);

  return {
    tasks: tasks || [],
    weekStart,
    weekEnd,
    weekStartStr,
    weekEndStr,
    isLoading,
    isError,
    error,
    refetch,
    goToPreviousWeek,
    goToNextWeek,
    goToCurrentWeek,
    weekOffset,
  };
}
