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
      // Invalidate and refetch tasks
      queryClient.invalidateQueries({ queryKey: ['tasks', 'today'] });
      queryClient.invalidateQueries({ queryKey: ['tasks'] });
    },
  });

  return {
    createTask: mutation.mutate,
    isCreating: mutation.isPending,
    error: mutation.error,
  };
}
