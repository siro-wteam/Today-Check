/**
 * Assignee Avatars Component
 * Displays assignee avatars with completion status
 * OWNER can toggle any assignee, MEMBER can only toggle themselves
 */

import { colors, borderRadius } from '@/constants/colors';
import { toggleAssigneeCompletion } from '@/lib/api/tasks';
import { useAuth } from '@/lib/hooks/use-auth';
import { useGroupStore } from '@/lib/stores/useGroupStore';
import { useQueryClient } from '@tanstack/react-query';
import { Check } from 'lucide-react-native';
import { Pressable, StyleSheet, Text, View } from 'react-native';

interface Assignee {
  user_id: string;
  nickname: string;
  avatar_url: string | null;
  is_completed: boolean;
  completed_at: string | null;
}

interface AssigneeAvatarsProps {
  taskId: string;
  groupId: string | null;
  assignees: Assignee[];
  size?: number;
  showCompletionRate?: boolean; // For day view (show "2/3")
}

export function AssigneeAvatars({
  taskId,
  groupId,
  assignees,
  size = 32,
  showCompletionRate = false,
}: AssigneeAvatarsProps) {
  const { user } = useAuth();
  const { groups } = useGroupStore();
  const queryClient = useQueryClient();

  // Get user's role in the group
  const myRole = groupId
    ? groups.find(g => g.id === groupId)?.myRole || 'MEMBER'
    : null;

  // Check if user can toggle this assignee
  const canToggle = (assignee: Assignee) => {
    if (!groupId) {
      // Personal task: can toggle if it's me
      return assignee.user_id === user?.id;
    }

    // Group task
    if (myRole === 'OWNER' || myRole === 'ADMIN') {
      // OWNER and ADMIN can toggle any assignee
      return true;
    } else {
      // MEMBER can only toggle themselves
      return assignee.user_id === user?.id;
    }
  };

  const handleAssigneePress = async (assignee: Assignee) => {
    if (!canToggle(assignee)) {
      return; // Read-only
    }

    const newCompletionStatus = !assignee.is_completed;

    // Store original task for rollback
    const { useCalendarStore } = await import('@/lib/stores/useCalendarStore');
    const originalTask = useCalendarStore.getState().getTaskById(taskId);
    
    // Optimistic update helper
    const updateTaskInCache = (oldData: any) => {
      if (!oldData) return oldData;
      
      // Handle both array format (unified) and object format (backlog: { data: Task[], error: any })
      const tasksArray = Array.isArray(oldData) 
        ? oldData 
        : (oldData.data && Array.isArray(oldData.data) ? oldData.data : null);
      
      if (!tasksArray) return oldData;
      
      const updatedTasks = tasksArray.map((task: any) => {
        if (task.id !== taskId) return task;
        
        // Preserve assignees order - only update the specific assignee
        const updatedAssignees = task.assignees?.map((a: any) =>
          a.user_id === assignee.user_id
            ? { ...a, is_completed: newCompletionStatus, completed_at: newCompletionStatus ? new Date().toISOString() : null }
            : a
        );
        
        // Calculate new task status
        const allCompleted = updatedAssignees?.every((a: any) => a.is_completed) ?? false;
        
        return {
          ...task,
          assignees: updatedAssignees, // Order preserved
          status: allCompleted ? 'DONE' : 'TODO',
          completed_at: allCompleted ? new Date().toISOString() : null,
        };
      });
      
      // Return in the same format as input
      if (Array.isArray(oldData)) {
        return updatedTasks;
      } else {
        return {
          ...oldData,
          data: updatedTasks,
        };
      }
    };

    // Optimistically update React Query caches
    queryClient.setQueriesData(
      { queryKey: ['tasks', 'unified'], exact: false },
      updateTaskInCache
    );
    queryClient.setQueriesData(
      { queryKey: ['tasks', 'backlog'], exact: false },
      updateTaskInCache
    );
    queryClient.setQueriesData(
      { queryKey: ['tasks', 'today'], exact: false },
      updateTaskInCache
    );

    // Optimistically update Calendar Store (for weekly/daily views)
    if (originalTask) {
      const { calculateRolloverInfo } = await import('@/lib/api/tasks');
      const updatedAssignees = originalTask.assignees?.map((a: any) =>
        a.user_id === assignee.user_id
          ? { ...a, is_completed: newCompletionStatus, completed_at: newCompletionStatus ? new Date().toISOString() : null }
          : a
      ) || [];
      
      const allCompleted = updatedAssignees.every((a: any) => a.is_completed) ?? false;
      
      const optimisticTask = {
        ...originalTask,
        assignees: updatedAssignees, // Order preserved
        status: allCompleted ? 'DONE' : 'TODO',
        completed_at: allCompleted ? new Date().toISOString() : null,
      };
      
      const tasksWithRollover = calculateRolloverInfo([optimisticTask]);
      useCalendarStore.getState().mergeTasksIntoStore(tasksWithRollover);
    }
    
    try {
      const { toggleAssigneeCompletion } = await import('@/lib/api/tasks');
      const { error } = await toggleAssigneeCompletion(
        taskId,
        assignee.user_id,
        assignee.is_completed
      );
      
      if (error) {
        console.error('Error toggling assignee:', error);
        // Rollback on error
        if (originalTask) {
          const { calculateRolloverInfo } = await import('@/lib/api/tasks');
          const tasksWithRollover = calculateRolloverInfo([originalTask]);
          useCalendarStore.getState().mergeTasksIntoStore(tasksWithRollover);
        }
        queryClient.invalidateQueries({ queryKey: ['tasks', 'unified'] });
        queryClient.invalidateQueries({ queryKey: ['tasks', 'backlog'] });
        queryClient.invalidateQueries({ queryKey: ['tasks', 'today'] });
      }
      // Success: keep optimistic update; no getTaskById merge (avoids late response overwriting)
    } catch (error) {
      console.error('Exception toggling assignee:', error);
      // Rollback on exception
      if (originalTask) {
        const { calculateRolloverInfo } = await import('@/lib/api/tasks');
        const tasksWithRollover = calculateRolloverInfo([originalTask]);
        useCalendarStore.getState().mergeTasksIntoStore(tasksWithRollover);
      }
      queryClient.invalidateQueries({ queryKey: ['tasks', 'unified'] });
      queryClient.invalidateQueries({ queryKey: ['tasks', 'backlog'] });
      queryClient.invalidateQueries({ queryKey: ['tasks', 'today'] });
    }
  };

  // Get initials from nickname
  const getInitials = (nickname: string) => {
    if (!nickname || nickname.trim() === '') {
      return 'U'; // Unknown
    }
    const parts = nickname.trim().split(' ').filter(n => n.length > 0);
    if (parts.length === 0) {
      return nickname.substring(0, 2).toUpperCase();
    }
    if (parts.length === 1) {
      return parts[0].substring(0, 2).toUpperCase();
    }
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  };

  if (assignees.length === 0) {
    return null;
  }

  // Calculate completion rate
  const completedCount = assignees.filter(a => a.is_completed).length;
  const totalCount = assignees.length;

  // Preserve assignees order - don't sort by completion status
  // This ensures avatars stay in the same position when toggling completion
  return (
    <View style={styles.container}>
      {assignees.map((assignee) => {
        const isMe = assignee.user_id === user?.id;
        const canToggleThis = canToggle(assignee);

        return (
          <Pressable
            key={assignee.user_id}
            onPress={(event) => {
              event?.stopPropagation?.(); // Prevent event bubbling
              event?.preventDefault?.(); // Prevent default behavior
              handleAssigneePress(assignee);
            }}
            // @ts-ignore - Add data attribute for gesture handler detection
            dataSet={{ assigneeAvatar: 'true' }}
            disabled={!canToggleThis}
            style={[
              styles.avatarContainer,
              {
                width: size,
                height: size,
                borderRadius: size / 2,
              },
              assignee.is_completed && styles.avatarCompleted,
              !canToggleThis && styles.avatarReadOnly,
              isMe && styles.avatarMe,
            ]}
          >
            <View
              style={[
                styles.avatarPlaceholder,
                {
                  width: size,
                  height: size,
                  borderRadius: size / 2,
                },
              ]}
            >
              <Text style={[styles.avatarText, { fontSize: size * 0.4 }]}>
                {getInitials(assignee.nickname || 'U')}
              </Text>
            </View>
            {assignee.is_completed && (
              <View style={[styles.checkBadge, { width: size * 0.45, height: size * 0.45 }]}>
                <Check size={size * 0.32} color="#FFFFFF" strokeWidth={3} />
              </View>
            )}
          </Pressable>
        );
      })}
      
      {/* Completion Rate (for day view) */}
      {showCompletionRate && (
        <Text style={styles.completionRate}>
          {completedCount}/{totalCount}
        </Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flexWrap: 'wrap',
  },
  avatarContainer: {
    position: 'relative',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#E2E8F0', // Slate 200
    borderWidth: 2,
    borderColor: '#CBD5E1', // Slate 300
  },
  avatarCompleted: {
    // Removed - keeping same background for everyone
  },
  avatarReadOnly: {
    opacity: 0.5,
  },
  avatarMe: {
    borderColor: colors.primary,
    borderWidth: 2.5,
  },
  avatarImage: {
    width: '100%',
    height: '100%',
    borderRadius: 999,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#E2E8F0',
  },
  avatarPlaceholder: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#E2E8F0',
  },
  placeholderCompleted: {
    // Removed - not needed anymore
  },
  avatarText: {
    color: '#475569', // Slate 600
    fontWeight: '600',
  },
  avatarTextCompleted: {
    // Removed - not needed anymore
  },
  checkBadge: {
    position: 'absolute',
    bottom: -2,
    right: -2,
    backgroundColor: '#10B981', // Green 500
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderColor: '#FFFFFF',
  },
  completionRate: {
    fontSize: 12,
    color: '#64748B', // Slate 500
    fontWeight: '600',
    marginLeft: 4,
  },
});
