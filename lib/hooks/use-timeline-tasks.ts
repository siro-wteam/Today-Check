/**
 * BOUNDED RANGE: Timeline Tasks Hook
 * 
 * Strategy:
 * 1. Initial load: -1 month ~ +1 month (fast display)
 * 2. Background prefetch: Remaining range up to ±6 months
 * 3. Swipe limit: 6 months in each direction
 * 
 * Performance improvements:
 * - Fast initial display (only 2 months of data)
 * - Background prefetch ensures smooth swiping
 * - Memory protection (6 month limit)
 */

import { useQuery, useQueryClient } from '@tanstack/react-query';
import { addDays, format, subDays } from 'date-fns';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { calculateRolloverInfo, getAllTasksInRange } from '../api/tasks';
import { getCalendarRanges } from '../../constants/calendar';
import type { TaskWithRollover } from '../types';

interface DateRange {
  oldest: string; // yyyy-MM-dd
  newest: string; // yyyy-MM-dd
}

export function useTimelineTasks() {
  const queryClient = useQueryClient();
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [isPrefetching, setIsPrefetching] = useState(false);
  const prefetchCompletedRef = useRef(false);
  
  const { pastLimit, futureLimit, initialLoadStart, initialLoadEnd } = getCalendarRanges();
  
  // Initial load range: -1 month ~ +1 month
  const initialStartDate = format(initialLoadStart, 'yyyy-MM-dd');
  const initialEndDate = format(initialLoadEnd, 'yyyy-MM-dd');
  
  // Full range: -6 months ~ +6 months
  const fullStartDate = format(pastLimit, 'yyyy-MM-dd');
  const fullEndDate = format(futureLimit, 'yyyy-MM-dd');

  // OPTIMIZED: Initial load for fast display (only 2 months)
  const timelineQuery = useQuery({
    queryKey: ['tasks', 'unified', initialStartDate, initialEndDate],
    queryFn: async () => {
      const result = await getAllTasksInRange(initialStartDate, initialEndDate);
      if (result.error) throw result.error;
      return result.data || [];
    },
    staleTime: 1000 * 60 * 2, // 2 minutes
  });

  // Background prefetch: Load remaining range after initial load completes
  useEffect(() => {
    if (prefetchCompletedRef.current || timelineQuery.isLoading || !timelineQuery.data) {
      return;
    }

    // Mark as started to prevent duplicate prefetches
    prefetchCompletedRef.current = true;
    setIsPrefetching(true);

    // Prefetch in background (silent, no loading indicator)
    const prefetchRemainingRange = async () => {
      try {
        // Fetch past range: pastLimit to initialLoadStart
        const pastRangeStart = fullStartDate;
        const pastRangeEnd = format(subDays(initialLoadStart, 1), 'yyyy-MM-dd');
        
        // Fetch future range: initialLoadEnd to futureLimit
        const futureRangeStart = format(addDays(initialLoadEnd, 1), 'yyyy-MM-dd');
        const futureRangeEnd = fullEndDate;

        // Fetch both ranges in parallel (silent, merge into cache)
        const [pastResult, futureResult] = await Promise.all([
          getAllTasksInRange(pastRangeStart, pastRangeEnd),
          getAllTasksInRange(futureRangeStart, futureRangeEnd),
        ]);

        // Merge past tasks into cache
        if (pastResult.data && pastResult.data.length > 0) {
          queryClient.setQueriesData(
            { queryKey: ['tasks', 'unified'], exact: false },
            (oldData: any) => {
              if (!oldData) return pastResult.data;
              const taskMap = new Map(oldData.map((t: any) => [t.id, t]));
              pastResult.data.forEach((task: any) => {
                if (!taskMap.has(task.id)) {
                  taskMap.set(task.id, task);
                }
              });
              return Array.from(taskMap.values());
            }
          );
        }

        // Merge future tasks into cache
        if (futureResult.data && futureResult.data.length > 0) {
          queryClient.setQueriesData(
            { queryKey: ['tasks', 'unified'], exact: false },
            (oldData: any) => {
              if (!oldData) return futureResult.data;
              const taskMap = new Map(oldData.map((t: any) => [t.id, t]));
              futureResult.data.forEach((task: any) => {
                if (!taskMap.has(task.id)) {
                  taskMap.set(task.id, task);
                }
              });
              return Array.from(taskMap.values());
            }
          );
        }
      } catch (error) {
        console.error('Error prefetching remaining range:', error);
      } finally {
        setIsPrefetching(false);
      }
    };

    // Start prefetch after a short delay to prioritize initial display
    const timeoutId = setTimeout(prefetchRemainingRange, 500);
    return () => clearTimeout(timeoutId);
  }, [timelineQuery.isLoading, timelineQuery.data, queryClient, initialLoadStart, initialLoadEnd, fullStartDate, fullEndDate]);

  // Get all tasks from cache (initial + prefetched)
  const allTasks = useMemo(() => {
    // Get all unified query data
    const queries = queryClient.getQueriesData({ queryKey: ['tasks', 'unified'], exact: false });
    const allTasksFromCache: any[] = [];
    
    queries.forEach(([, data]) => {
      if (Array.isArray(data)) {
        allTasksFromCache.push(...data);
      }
    });

    // Deduplicate by id
    const taskMap = new Map<string, any>();
    allTasksFromCache.forEach(task => {
      if (!taskMap.has(task.id)) {
        taskMap.set(task.id, task);
      }
    });

    return Array.from(taskMap.values());
  }, [queryClient, timelineQuery.data]);

  // Calculate rollover info (client-side, very fast)
  const tasksWithRollover = useMemo(() => {
    if (timelineQuery.isLoading) {
      return [];
    }
    // Use all tasks from cache (initial + prefetched)
    return calculateRolloverInfo(allTasks);
  }, [allTasks, timelineQuery.isLoading]);

  const query = {
    data: tasksWithRollover,
    isLoading: timelineQuery.isLoading,
    isError: timelineQuery.isError,
    error: timelineQuery.error,
    refetch: timelineQuery.refetch,
  };

  // Legacy functions for compatibility (no-op since we use bounded range)
  const loadMorePast = useCallback(async () => {
    // No-op: All data is loaded via initial + prefetch
  }, []);

  const loadMoreFuture = useCallback(async () => {
    // No-op: All data is loaded via initial + prefetch
  }, []);

  return {
    tasks: query.data || [],
    isLoading: query.isLoading,
    isError: query.isError,
    error: query.error,
    refetch: query.refetch,
    loadMorePast,
    loadMoreFuture,
    isLoadingMore: isLoadingMore || isPrefetching,
    dateRange: {
      oldest: fullStartDate,
      newest: fullEndDate,
    },
    // Expose range limits for UI
    pastLimit: pastLimit,
    futureLimit: futureLimit,
  };
}
