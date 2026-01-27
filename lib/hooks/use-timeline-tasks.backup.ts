/**
 * Custom React Query hook for timeline tasks with pagination
 * Implements window-based pagination for efficient data loading
 */

import { useQuery, useQueryClient } from '@tanstack/react-query';
import { addDays, format, subDays } from 'date-fns';
import { useCallback, useMemo, useState } from 'react';
import { calculateRolloverInfo, enrichTasksWithProfiles, getCompletedTasksByDateRangeWithoutEnrichment, getTimelineTasksWithoutEnrichment } from '../api/tasks';
import type { Task, TaskWithRollover } from '../types';
import { useActiveTasks } from './use-active-tasks';

interface DateRange {
  oldest: string; // yyyy-MM-dd
  newest: string; // yyyy-MM-dd
}

export function useTimelineTasks() {
  const queryClient = useQueryClient();
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [dateRange, setDateRange] = useState<DateRange>(() => {
    const today = new Date();
    return {
      oldest: format(subDays(today, 3), 'yyyy-MM-dd'),
      newest: format(addDays(today, 3), 'yyyy-MM-dd'),
    };
  });

  // Use shared active tasks hook (cached, prevents duplicate API calls)
  const { tasks: activeTasks, isLoading: isLoadingActive, refetch: refetchActive } = useActiveTasks();

  // Timeline window: ±7 days
  const today = new Date();
  const timelineStartDate = format(addDays(today, -7), 'yyyy-MM-dd');
  const timelineEndDate = format(addDays(today, 7), 'yyyy-MM-dd');

  // Fetch timeline tasks for the initial window (without enrichment to avoid duplicate profile calls)
  const timelineQuery = useQuery({
    queryKey: ['tasks', 'timeline-window', timelineStartDate, timelineEndDate],
    queryFn: async () => {
      // Use WithoutEnrichment versions to avoid duplicate profile fetches
      const [timelineResult, completedResult] = await Promise.all([
        getTimelineTasksWithoutEnrichment(timelineStartDate, timelineEndDate),
        getCompletedTasksByDateRangeWithoutEnrichment(timelineStartDate, timelineEndDate),
      ]);

      if (timelineResult.error) throw timelineResult.error;
      if (completedResult.error) throw completedResult.error;

      // Merge and deduplicate
      const taskMap = new Map<string, Task>();
      
      timelineResult.data?.forEach(task => {
        taskMap.set(task.id, task);
      });
      
      completedResult.data?.forEach(task => {
        if (!taskMap.has(task.id)) {
          taskMap.set(task.id, task);
        }
      });

      const mergedTasks = Array.from(taskMap.values());
      
      // Enrich with profiles ONCE (instead of twice)
      const enrichedTasks = await enrichTasksWithProfiles(mergedTasks);
      
      return enrichedTasks;
    },
    staleTime: 1000 * 60 * 2, // 2 minutes
  });

  // Merge active tasks with timeline tasks
  const mergedTasks = useMemo(() => {
    if (isLoadingActive || timelineQuery.isLoading) {
      return [];
    }

    const timelineTasks = timelineQuery.data || [];
    
    // Merge and deduplicate by id
    const taskMap = new Map<string, Task>();
    
    // Add active tasks first
    activeTasks.forEach(task => {
      taskMap.set(task.id, task);
    });

    // Add timeline tasks (won't overwrite if already exists)
    timelineTasks.forEach(task => {
      if (!taskMap.has(task.id)) {
        taskMap.set(task.id, task);
      }
    });

    return Array.from(taskMap.values());
  }, [activeTasks, timelineQuery.data, isLoadingActive, timelineQuery.isLoading]);

  // Calculate rollover info
  const tasksWithRollover = useMemo(() => {
    return calculateRolloverInfo(mergedTasks);
  }, [mergedTasks]);

  const query = {
    data: tasksWithRollover,
    isLoading: isLoadingActive || timelineQuery.isLoading,
    isError: timelineQuery.isError,
    error: timelineQuery.error,
    refetch: async () => {
      await Promise.all([
        refetchActive(),
        timelineQuery.refetch(),
      ]);
    },
  };

  /**
   * Load more past tasks (14 days earlier)
   * Triggered when scrolling to the top
   */
  const loadMorePast = useCallback(async () => {
    if (isLoadingMore) return;
    
    setIsLoadingMore(true);
    
    try {
      const oldestDate = new Date(dateRange.oldest);
      const newStartDate = format(subDays(oldestDate, 14), 'yyyy-MM-dd');
      const newEndDate = format(subDays(oldestDate, 1), 'yyyy-MM-dd');

      const result = await getTimelineTasksWithoutEnrichment(newStartDate, newEndDate);
      if (result.error) {
        console.error('Error loading more past tasks:', result.error);
        return;
      }
      const enrichedData = await enrichTasksWithProfiles(result.data || []);
      const { data, error } = { data: enrichedData, error: null };
      
      if (error) {
        console.error('Error loading more past tasks:', error);
        return;
      }

      if (data && data.length > 0) {
        // Get current tasks
        const currentTasks = queryClient.getQueryData<TaskWithRollover[]>(['tasks', 'timeline']) || [];
        
        // Calculate rollover for new tasks
        const newTasksWithRollover = calculateRolloverInfo(data);
        
        // Merge: new tasks at the beginning
        const mergedTasks = [...newTasksWithRollover, ...currentTasks];
        
        // Deduplicate by id
        const taskMap = new Map<string, TaskWithRollover>();
        mergedTasks.forEach(task => {
          if (!taskMap.has(task.id)) {
            taskMap.set(task.id, task);
          }
        });
        
        const dedupedTasks = Array.from(taskMap.values());
        
        // Update query data
        queryClient.setQueryData(['tasks', 'timeline'], dedupedTasks);
        
        // Update date range
        setDateRange(prev => ({
          ...prev,
          oldest: newStartDate,
        }));
      }
    } finally {
      setIsLoadingMore(false);
    }
  }, [dateRange.oldest, isLoadingMore, queryClient]);

  /**
   * Load more future tasks (14 days later)
   * Triggered when scrolling to the bottom
   */
  const loadMoreFuture = useCallback(async () => {
    if (isLoadingMore) return;
    
    setIsLoadingMore(true);
    
    try {
      const newestDate = new Date(dateRange.newest);
      const newStartDate = format(addDays(newestDate, 1), 'yyyy-MM-dd');
      const newEndDate = format(addDays(newestDate, 14), 'yyyy-MM-dd');

      const result = await getTimelineTasksWithoutEnrichment(newStartDate, newEndDate);
      if (result.error) {
        console.error('Error loading more past tasks:', result.error);
        return;
      }
      const enrichedData = await enrichTasksWithProfiles(result.data || []);
      const { data, error } = { data: enrichedData, error: null };
      
      if (error) {
        console.error('Error loading more future tasks:', error);
        return;
      }

      if (data && data.length > 0) {
        // Get current tasks
        const currentTasks = queryClient.getQueryData<TaskWithRollover[]>(['tasks', 'timeline']) || [];
        
        // Calculate rollover for new tasks
        const newTasksWithRollover = calculateRolloverInfo(data);
        
        // Merge: new tasks at the end
        const mergedTasks = [...currentTasks, ...newTasksWithRollover];
        
        // Deduplicate by id
        const taskMap = new Map<string, TaskWithRollover>();
        mergedTasks.forEach(task => {
          if (!taskMap.has(task.id)) {
            taskMap.set(task.id, task);
          }
        });
        
        const dedupedTasks = Array.from(taskMap.values());
        
        // Update query data
        queryClient.setQueryData(['tasks', 'timeline'], dedupedTasks);
        
        // Update date range
        setDateRange(prev => ({
          ...prev,
          newest: newEndDate,
        }));
      }
    } finally {
      setIsLoadingMore(false);
    }
  }, [dateRange.newest, isLoadingMore, queryClient]);

  return {
    tasks: query.data || [],
    isLoading: query.isLoading,
    isError: query.isError,
    error: query.error,
    refetch: query.refetch,
    loadMorePast,
    loadMoreFuture,
    isLoadingMore,
    dateRange,
  };
}
