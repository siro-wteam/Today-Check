/**
 * Custom React Query hook for timeline tasks with pagination
 * Implements window-based pagination for efficient data loading
 */

import { useQuery, useQueryClient } from '@tanstack/react-query';
import { format, addDays, subDays } from 'date-fns';
import { useState, useCallback } from 'react';
import { getActiveTasksAndTimeline, getTimelineTasks, calculateRolloverInfo } from '../api/tasks';
import type { Task, TaskWithRollover } from '../types';

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

  // Initial fetch: Active tasks + Timeline window (±7 days)
  const query = useQuery({
    queryKey: ['tasks', 'timeline'],
    queryFn: async () => {
      const { data, error } = await getActiveTasksAndTimeline();
      if (error) throw error;
      if (!data) return [];
      
      // Calculate rollover info
      return calculateRolloverInfo(data);
    },
    staleTime: 1000 * 60, // 1 minute
  });

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

      const { data, error } = await getTimelineTasks(newStartDate, newEndDate);
      
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

      const { data, error } = await getTimelineTasks(newStartDate, newEndDate);
      
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
