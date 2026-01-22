/**
 * Backlog Tasks Hook - Fetch tasks without due dates
 */

import { useQuery } from '@tanstack/react-query';
import { getBacklogTasks } from '../api/tasks';

export function useBacklogTasks() {
  const { data: response, isLoading, isError, error, refetch } = useQuery({
    queryKey: ['tasks', 'backlog'],
    queryFn: getBacklogTasks,
  });

  const tasks = response?.data || [];

  return {
    tasks,
    isLoading,
    isError,
    error,
    refetch,
  };
}
