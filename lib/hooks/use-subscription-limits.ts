/**
 * Hook for subscription limits (free tier caps).
 * Use canCreateGroup, canAddToBacklog, checkCanAddTaskToDate before actions.
 */

import { useCallback } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  getBacklogTaskCount,
  getCreatedGroupCount,
  getTaskCountForDate,
  FREE_MAX_BACKLOG,
  FREE_MAX_GROUPS,
  FREE_MAX_TASKS_PER_DATE,
  LIMIT_MESSAGES,
} from '../api/subscription-limits';
import { useSubscription } from './use-subscription';
import { useAuth } from './use-auth';

const QUERY_KEY_BACKLOG = ['subscription-limits', 'backlog'] as const;
const QUERY_KEY_GROUPS = (userId: string) => ['subscription-limits', 'groups', userId] as const;

export function useSubscriptionLimits() {
  const { user } = useAuth();
  const { isSubscribed } = useSubscription();
  const queryClient = useQueryClient();

  const { data: backlogCount = 0, refetch: refetchBacklog } = useQuery({
    queryKey: QUERY_KEY_BACKLOG,
    queryFn: async () => {
      const { count, error } = await getBacklogTaskCount();
      if (error) throw error;
      return count;
    },
    enabled: !!user?.id,
    staleTime: 30_000,
  });

  const { data: groupCount = 0, refetch: refetchGroupCount } = useQuery({
    queryKey: QUERY_KEY_GROUPS(user?.id ?? ''),
    queryFn: async () => {
      if (!user?.id) return 0;
      const { count, error } = await getCreatedGroupCount(user.id);
      if (error) throw error;
      return count;
    },
    enabled: !!user?.id,
    staleTime: 30_000,
  });

  const canCreateGroup = isSubscribed || groupCount < FREE_MAX_GROUPS;
  const canAddToBacklog = isSubscribed || backlogCount < FREE_MAX_BACKLOG;

  const checkCanAddTaskToDate = useCallback(
    async (dateStr: string): Promise<{ allowed: boolean; count: number; message?: string }> => {
      if (isSubscribed) return { allowed: true, count: 0 };
      const { count, error } = await getTaskCountForDate(dateStr);
      if (error) return { allowed: false, count: 0, message: error.message };
      const allowed = count < FREE_MAX_TASKS_PER_DATE;
      const message = allowed ? undefined : LIMIT_MESSAGES.perDate(dateStr);
      return { allowed, count, message };
    },
    [isSubscribed]
  );

  const refetchAll = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ['subscription-limits'] });
    refetchBacklog();
    refetchGroupCount();
  }, [queryClient, refetchBacklog, refetchGroupCount]);

  return {
    isSubscribed,
    groupCount,
    backlogCount,
    canCreateGroup,
    canAddToBacklog,
    checkCanAddTaskToDate,
    refetchBacklog,
    refetchGroupCount,
    refetchAll,
    limitMessages: LIMIT_MESSAGES,
    limits: {
      maxGroups: FREE_MAX_GROUPS,
      maxBacklog: FREE_MAX_BACKLOG,
      maxTasksPerDate: FREE_MAX_TASKS_PER_DATE,
    },
  };
}
