/**
 * Realtime Subscription Hook for Task Assignees
 * 
 * Subscribes to task_assignees changes and updates React Query cache automatically.
 * This eliminates the need for SELECT queries after UPDATE operations.
 */

import { useEffect, useRef } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { supabase } from '../supabase';
import type { RealtimeChannel } from '@supabase/supabase-js';

interface UseTaskRealtimeOptions {
  taskIds?: string[]; // Optional: subscribe to specific tasks only
  enabled?: boolean; // Optional: enable/disable subscription
}

/**
 * Hook to subscribe to task_assignees changes
 * Automatically updates React Query cache when assignees are updated
 */
export function useTaskRealtime(options: UseTaskRealtimeOptions = {}) {
  const { taskIds, enabled = true } = options;
  const queryClient = useQueryClient();
  const channelRef = useRef<RealtimeChannel | null>(null);

  useEffect(() => {
    if (!enabled) {
      return;
    }

    // Create channel name
    const channelName = taskIds 
      ? `task_assignees:${taskIds.join(',')}`
      : 'task_assignees:all';

    // Create subscription channel
    const channel = supabase
      .channel(channelName)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'task_assignees',
          ...(taskIds && { filter: `task_id=in.(${taskIds.join(',')})` }),
        },
        async (payload) => {
          console.log('🟢 [Realtime] task_assignees updated:', payload);
          
          const taskId = payload.new.task_id as string;
          
          // Fetch latest assignees for this task
          const { data: latestAssignees, error } = await supabase
            .from('task_assignees')
            .select('user_id, is_completed')
            .eq('task_id', taskId);

          if (error) {
            console.error('🔴 [Realtime] Error fetching latest assignees:', error);
            // Invalidate cache as fallback
            queryClient.invalidateQueries({ queryKey: ['tasks', 'unified'] });
            return;
          }

          // Calculate task status
          const allCompleted = latestAssignees?.every(a => a.is_completed) ?? false;
          const taskStatus = allCompleted ? 'DONE' : 'TODO';

          // Update React Query cache
          queryClient.setQueriesData(
            { queryKey: ['tasks', 'unified'], exact: false },
            (oldData: any) => {
              if (!oldData) return oldData;

              return oldData.map((task: any) => {
                if (task.id !== taskId) return task;

                // Update assignees
                const updatedAssignees = task.assignees?.map((a: any) => {
                  const latest = latestAssignees?.find(la => la.user_id === a.user_id);
                  return latest
                    ? { ...a, is_completed: latest.is_completed }
                    : a;
                });

                return {
                  ...task,
                  assignees: updatedAssignees,
                  status: taskStatus,
                  completed_at: allCompleted ? new Date().toISOString() : null,
                };
              });
            }
          );

          console.log('✅ [Realtime] Cache updated for task:', taskId, 'status:', taskStatus);
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'task_assignees',
          ...(taskIds && { filter: `task_id=in.(${taskIds.join(',')})` }),
        },
        async (payload) => {
          console.log('🟢 [Realtime] task_assignees inserted:', payload);
          // Invalidate cache to refetch with new assignee
          queryClient.invalidateQueries({ queryKey: ['tasks', 'unified'] });
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'DELETE',
          schema: 'public',
          table: 'task_assignees',
          ...(taskIds && { filter: `task_id=in.(${taskIds.join(',')})` }),
        },
        async (payload) => {
          console.log('🟢 [Realtime] task_assignees deleted:', payload);
          // Invalidate cache to refetch without deleted assignee
          queryClient.invalidateQueries({ queryKey: ['tasks', 'unified'] });
        }
      )
      .subscribe((status) => {
        console.log('📡 [Realtime] Subscription status:', status);
        if (status === 'SUBSCRIBED') {
          console.log('✅ [Realtime] Successfully subscribed to task_assignees');
        } else if (status === 'CHANNEL_ERROR') {
          console.error('🔴 [Realtime] Channel error occurred');
        }
      });

    channelRef.current = channel;

    // Cleanup
    return () => {
      if (channelRef.current) {
        console.log('🔌 [Realtime] Unsubscribing from task_assignees');
        supabase.removeChannel(channelRef.current);
        channelRef.current = null;
      }
    };
  }, [taskIds, enabled, queryClient]);

  return {
    channel: channelRef.current,
  };
}
