/**
 * OPTIMIZED: Week Tasks Hook
 * Single API call for better performance
 */

import { useQuery } from '@tanstack/react-query';
import { addDays, endOfWeek, format, startOfWeek } from 'date-fns';
import { useState } from 'react';
import { getAllTasksInRange } from '../api/tasks';

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

  // Include past 30 days for overdue tasks
  const startDate = format(addDays(weekStart, -30), 'yyyy-MM-dd');

  // OPTIMIZED: Single API call for entire range (all statuses)
  const query = useQuery({
    queryKey: ['tasks', 'unified', startDate, weekEndStr],
    queryFn: async () => {
      const result = await getAllTasksInRange(startDate, weekEndStr);
      if (result.error) throw result.error;
      return result.data || [];
    },
    staleTime: 1000 * 60 * 5, // 5 minutes (longer to prevent auto-refetch)
    gcTime: 1000 * 60 * 10, // 10 minutes
    refetchOnMount: false, // Don't refetch on mount if data exists
    refetchOnWindowFocus: false, // Don't refetch on window focus
  });

  const tasks = query.data || [];
  const isLoading = query.isLoading;
  const isError = query.isError;
  const error = query.error;
  
  const refetch = query.refetch;

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
