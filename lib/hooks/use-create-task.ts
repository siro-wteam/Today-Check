/**
 * Hook for creating tasks
 */

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { createTask } from '../api/tasks';
import type { CreateTaskInput } from '../types';

export function useCreateTask() {
  const queryClient = useQueryClient();

  const mutation = useMutation({
    mutationFn: async (input: CreateTaskInput) => {
      const { data, error } = await createTask(input);
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      // Invalidate unified task query (single cache key)
      queryClient.invalidateQueries({ queryKey: ['tasks', 'unified'] });
      queryClient.invalidateQueries({ queryKey: ['tasks', 'today'] });
      queryClient.invalidateQueries({ queryKey: ['tasks', 'backlog'] });
    },
  });

  return {
    createTask: mutation.mutate,
    isCreating: mutation.isPending,
    error: mutation.error,
  };
}
