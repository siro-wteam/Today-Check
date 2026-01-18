/**
 * Custom React Query hooks for tasks
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { getTodayTasks, toggleTaskStatus, calculateRolloverInfo } from '../api/tasks';
import type { Task, TaskWithRollover } from '../types';

/**
 * Hook to fetch and manage today's tasks
 */
export function useTodayTasks() {
  const queryClient = useQueryClient();

  // Fetch today's tasks
  const query = useQuery({
    queryKey: ['tasks', 'today'],
    queryFn: async () => {
      const { data, error } = await getTodayTasks();
      if (error) throw error;
      if (!data) return [];
      
      // Calculate rollover info
      return calculateRolloverInfo(data);
    },
  });

  // Toggle task status mutation
  const toggleMutation = useMutation({
    mutationFn: async ({ taskId, currentStatus }: { taskId: string; currentStatus: string }) => {
      const { data, error } = await toggleTaskStatus(taskId, currentStatus);
      if (error) throw error;
      return data;
    },
    onMutate: async ({ taskId, currentStatus }) => {
      // Cancel outgoing refetches
      await queryClient.cancelQueries({ queryKey: ['tasks', 'today'] });

      // Snapshot previous value
      const previousTasks = queryClient.getQueryData<TaskWithRollover[]>(['tasks', 'today']);

      // Optimistically update
      if (previousTasks) {
        const newStatus = currentStatus === 'TODO' ? 'DONE' : 'TODO';
        queryClient.setQueryData<TaskWithRollover[]>(
          ['tasks', 'today'],
          previousTasks.map(task =>
            task.id === taskId ? { ...task, status: newStatus } : task
          )
        );
      }

      return { previousTasks };
    },
    onError: (err, variables, context) => {
      // Rollback on error
      if (context?.previousTasks) {
        queryClient.setQueryData(['tasks', 'today'], context.previousTasks);
      }
    },
    onSettled: () => {
      // Refetch after mutation
      queryClient.invalidateQueries({ queryKey: ['tasks', 'today'] });
    },
  });

  return {
    tasks: query.data || [],
    isLoading: query.isLoading,
    isError: query.isError,
    error: query.error,
    refetch: query.refetch,
    toggleTask: (taskId: string, currentStatus: string) =>
      toggleMutation.mutate({ taskId, currentStatus }),
    isToggling: toggleMutation.isPending,
  };
}
