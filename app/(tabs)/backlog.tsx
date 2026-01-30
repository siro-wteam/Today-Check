import { AppHeader } from '@/components/AppHeader';
import { AssigneeAvatars } from '@/components/AssigneeAvatars';
import { EditTaskBottomSheet } from '@/components/EditTaskBottomSheet';
import { EmptyState } from '@/components/EmptyState';
import { NotificationCenterModal } from '@/components/NotificationCenterModal';
import { borderRadius, colors, shadows } from '@/constants/colors';
import { deleteTask, updateTask } from '@/lib/api/tasks';
import { useAuth } from '@/lib/hooks/use-auth';
import { useBacklogTasks } from '@/lib/hooks/use-backlog-tasks';
import { useGroupStore } from '@/lib/stores/useGroupStore';
import type { Task } from '@/lib/types';
import { useQueryClient } from '@tanstack/react-query';
import { format } from 'date-fns';
import * as Haptics from 'expo-haptics';
import { Check, Clock, Package, Users } from 'lucide-react-native';
import { useCallback, useMemo, useState } from 'react';
import { ActivityIndicator, Dimensions, Platform, Pressable, RefreshControl, SafeAreaView, ScrollView, StyleSheet, Text, View } from 'react-native';
import { showToast } from '@/utils/toast';

const SCREEN_WIDTH = Dimensions.get('window').width;
const SCREEN_HEIGHT = Dimensions.get('window').height;
const HEADER_HEIGHT = 60;
const TITLE_BAR_HEIGHT = 90;
const AVAILABLE_HEIGHT = SCREEN_HEIGHT - HEADER_HEIGHT - TITLE_BAR_HEIGHT;

export default function BacklogScreen() {
  const { tasks, isLoading, isError, error, refetch } = useBacklogTasks();
  const [refreshing, setRefreshing] = useState(false);
  const queryClient = useQueryClient();

  const [isNotificationModalVisible, setIsNotificationModalVisible] = useState(false);
  
  const handleNotificationPress = () => {
    setIsNotificationModalVisible(true);
  };

  // Pull-to-Refresh handler
  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await refetch();
    setRefreshing(false);
  }, [refetch]);

  // React Query already handles caching and refetching
  // No need for auto-refresh on focus - reduces API calls


  if (isLoading) {
    return (
      <SafeAreaView style={styles.container}>
        <AppHeader onNotificationPress={handleNotificationPress} />
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={[styles.textSub, { marginTop: 16 }]}>
            Loading backlog...
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  if (isError) {
    return (
      <SafeAreaView style={styles.container}>
        <AppHeader onNotificationPress={handleNotificationPress} />
        <View className="flex-1 items-center justify-center">
            <Text style={{ fontSize: 40, marginBottom: 16, color: colors.textMain }}>⚠️</Text>
          <Text style={[styles.textMain, { fontSize: 16, fontWeight: '600', marginBottom: 8 }]}>
            Failed to load backlog
          </Text>
          <Text style={[styles.textSub, { textAlign: 'center', marginBottom: 16 }]}>
            {error?.message || 'Something went wrong'}
          </Text>
          <Pressable 
            onPress={() => refetch()}
            style={styles.primaryButton}
            className="active:opacity-70"
          >
            <Text style={{ color: colors.primaryForeground, fontWeight: '600' }}>Try Again</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <AppHeader onNotificationPress={handleNotificationPress} />

      {/* Notification Center Modal */}
      <NotificationCenterModal
        visible={isNotificationModalVisible}
        onClose={() => setIsNotificationModalVisible(false)}
      />

      {/* Section Header */}
      <View 
        style={[
          styles.sectionHeader,
          Platform.OS === 'web' && { maxWidth: 600, width: '100%', alignSelf: 'center' }
        ]}
      >
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          <Package size={20} color={colors.textSub} strokeWidth={2} />
          <Text style={styles.sectionTitle}>
            No Due Date
          </Text>
          {tasks.filter(t => t.status === 'TODO').length > 0 && (
            <View style={styles.badge}>
              <Text style={styles.badgeText}>
                {tasks.filter(t => t.status === 'TODO').length}
              </Text>
            </View>
          )}
        </View>
      </View>

      {/* Backlog List */}
      <View 
        style={{
          flex: 1,
          height: Platform.OS === 'web' ? AVAILABLE_HEIGHT : undefined,
          ...(Platform.OS === 'web' && { maxWidth: 600, width: '100%', alignSelf: 'center' }),
        }}
      >
        {tasks.length === 0 ? (
          <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 24 }}>
            <EmptyState message="No tasks in backlog" />
          </View>
        ) : (
          <ScrollView
            style={Platform.OS === 'web' ? { 
              height: AVAILABLE_HEIGHT,
              overflow: 'auto' as any,
            } : { flex: 1 }}
            contentContainerStyle={{ 
              paddingHorizontal: 16, 
              paddingVertical: 16,
              paddingBottom: Platform.OS === 'web' ? 200 : 120,
            }}
            showsVerticalScrollIndicator={Platform.OS === 'web'}
            keyboardShouldPersistTaps="handled"
            nestedScrollEnabled={true}
            refreshControl={
              <RefreshControl
                refreshing={refreshing}
                onRefresh={onRefresh}
                tintColor={colors.primary}
                colors={[colors.primary]}
              />
            }
          >
            {/* Incomplete Tasks */}
            {tasks.filter(t => t.status === 'TODO').length > 0 && (
              <View style={{ marginBottom: 12 }}>
                {tasks
                  .filter(t => t.status === 'TODO')
                  .map((item) => (
                    <BacklogItem
                      key={item.id}
                      task={item}
                    />
                  ))}
              </View>
            )}

            {/* Completed Tasks Section */}
            {tasks.filter(t => t.status === 'DONE').length > 0 && (
              <View style={{ marginTop: 32 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 12, paddingHorizontal: 4 }}>
                  <Text style={styles.completedSectionTitle}>
                    Completed
                  </Text>
                  <View style={[styles.badge, { backgroundColor: `${colors.success}1A` }]}>
                    <Text style={[styles.badgeText, { color: colors.success }]}>
                      {tasks.filter(t => t.status === 'DONE').length}
                    </Text>
                  </View>
                </View>
                <View style={{ gap: 12 }}>
                  {tasks
                    .filter(t => t.status === 'DONE')
                    .map((item) => (
                      <BacklogItem
                        key={item.id}
                        task={item}
                      />
                    ))}
                </View>
              </View>
            )}
          </ScrollView>
        )}
      </View>

    </SafeAreaView>
  );
}

// Backlog Item Component
function BacklogItem({
  task,
}: {
  task: Task;
}) {
  const queryClient = useQueryClient();
  const { groups } = useGroupStore();
  const { user } = useAuth();
  const [isEditSheetVisible, setIsEditSheetVisible] = useState(false);
  const isDone = task.status === 'DONE';

  const handleToggleComplete = async () => {
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

    // Optimistic update helper
    const updateTaskInCache = (oldData: any, updateFn: (t: any) => any) => {
      if (!oldData) return oldData;
      
      // Handle both array format (unified) and object format (backlog: { data: Task[], error: any })
      if (Array.isArray(oldData)) {
        return oldData.map((t: any) => t.id === task.id ? updateFn(t) : t);
      }
      
      // Handle object format { data: Task[], error: any }
      if (oldData.data && Array.isArray(oldData.data)) {
        return {
          ...oldData,
          data: oldData.data.map((t: any) => t.id === task.id ? updateFn(t) : t),
        };
      }
      
      return oldData;
    };

    // Group task: use assignee logic
    if (task.group_id && task.assignees) {
      const myGroup = groups.find(g => g.id === task.group_id);
      const myRole = myGroup?.myRole;

      if (myRole === 'OWNER' || myRole === 'ADMIN') {
        // Owner and Admin: toggle all assignees (checkbox controls all)
        const allCompleted = task.assignees.every(a => a.is_completed);
        const newCompletionStatus = !allCompleted;

        // Prepare updates for group task completion
        const updates: any = {
          assignees: task.assignees?.map((a: any) => ({
            ...a,
            is_completed: newCompletionStatus,
            completed_at: newCompletionStatus ? new Date().toISOString() : null,
          })),
          status: newCompletionStatus ? 'DONE' : 'TODO',
          completed_at: newCompletionStatus ? new Date().toISOString() : null,
        };

        // Note: When completing (TODO -> DONE), we don't set due_date
        // getAllTasksInRange uses completed_at to show completed tasks in today's view
        // So completed_at is sufficient, no need to update due_date

        // Optimistically update UI immediately - update ALL matching queries
        const optimisticUpdate = (oldData: any) => updateTaskInCache(oldData, (t: any) => ({
          ...t,
          ...updates,
        }));

        queryClient.setQueriesData(
          { queryKey: ['tasks', 'backlog'], exact: false },
          optimisticUpdate
        );

        queryClient.setQueriesData(
          { queryKey: ['tasks', 'unified'], exact: false },
          optimisticUpdate
        );

        queryClient.setQueriesData(
          { queryKey: ['tasks', 'today'], exact: false },
          optimisticUpdate
        );

        // API call in background - only invalidate on error
        try {
          const { toggleAllAssigneesCompletion } = await import('@/lib/api/tasks');
          const { error } = await toggleAllAssigneesCompletion(task.id, newCompletionStatus);
          
          // Note: No need to update due_date when completing
          // getAllTasksInRange uses completed_at to show completed tasks
          
          if (error) {
            console.error('Error toggling all assignees:', error);
            // Rollback on error
            queryClient.invalidateQueries({ queryKey: ['tasks', 'backlog'] });
            queryClient.invalidateQueries({ queryKey: ['tasks', 'unified'] });
            queryClient.invalidateQueries({ queryKey: ['tasks', 'today'] });
          } else {
            // Success: Invalidate to sync with server state
            // This ensures the UI reflects the actual server state after refresh
            queryClient.invalidateQueries({ queryKey: ['tasks', 'backlog'] });
            queryClient.invalidateQueries({ queryKey: ['tasks', 'unified'] });
            queryClient.invalidateQueries({ queryKey: ['tasks', 'today'] });
          }
        } catch (error) {
          console.error('Exception toggling all assignees:', error);
          // Rollback on error
          queryClient.invalidateQueries({ queryKey: ['tasks', 'backlog'] });
          queryClient.invalidateQueries({ queryKey: ['tasks', 'unified'] });
          queryClient.invalidateQueries({ queryKey: ['tasks', 'today'] });
        }
      } else if (user) {
        // Member: toggle own status only
        const myAssignee = task.assignees.find(a => a.user_id === user.id);
        if (!myAssignee) return;

        const newCompletionStatus = !myAssignee.is_completed;

        // Optimistically update UI immediately - update ALL matching queries
        const optimisticUpdate = (oldData: any) => updateTaskInCache(oldData, (t: any) => {
          const updatedAssignees = t.assignees?.map((a: any) =>
            a.user_id === user.id
              ? { ...a, is_completed: newCompletionStatus, completed_at: newCompletionStatus ? new Date().toISOString() : null }
              : a
          );
          const allCompleted = updatedAssignees?.every((a: any) => a.is_completed) ?? false;
          
          const taskUpdates: any = {
            assignees: updatedAssignees,
            status: allCompleted ? 'DONE' : 'TODO',
            completed_at: allCompleted ? new Date().toISOString() : null,
          };

          // Note: No need to update due_date when completing
          // getAllTasksInRange uses completed_at to show completed tasks
          
          return {
            ...t,
            ...taskUpdates,
          };
        });

        queryClient.setQueriesData(
          { queryKey: ['tasks', 'backlog'], exact: false },
          optimisticUpdate
        );

        queryClient.setQueriesData(
          { queryKey: ['tasks', 'unified'], exact: false },
          optimisticUpdate
        );

        queryClient.setQueriesData(
          { queryKey: ['tasks', 'today'], exact: false },
          optimisticUpdate
        );

        // API call in background - only invalidate on error
        try {
          const { toggleAssigneeCompletion } = await import('@/lib/api/tasks');
          const { error } = await toggleAssigneeCompletion(
            task.id,
            user.id,
            myAssignee.is_completed
          );
          
          // Note: No need to update due_date when completing
          // getAllTasksInRange uses completed_at to show completed tasks
          
          if (error) {
            console.error('Error toggling assignee:', error);
            // Rollback on error
            queryClient.invalidateQueries({ queryKey: ['tasks', 'backlog'] });
            queryClient.invalidateQueries({ queryKey: ['tasks', 'unified'] });
            queryClient.invalidateQueries({ queryKey: ['tasks', 'today'] });
          }
          // Success: keep optimistic update, no invalidation needed
        } catch (error) {
          console.error('Exception toggling assignee:', error);
          // Rollback on error
          queryClient.invalidateQueries({ queryKey: ['tasks', 'backlog'] });
          queryClient.invalidateQueries({ queryKey: ['tasks', 'unified'] });
          queryClient.invalidateQueries({ queryKey: ['tasks', 'today'] });
        }
      }
      return;
    }

    // Personal task: original logic with optimistic update
    const newStatus = task.status === 'DONE' ? 'TODO' : 'DONE';
    const updates: any = { status: newStatus };

    // If unchecking (DONE -> TODO) and task has no due_date, assign today's date
    if (newStatus === 'TODO' && !task.due_date) {
      const todayStr = format(new Date(), 'yyyy-MM-dd');
      updates.due_date = todayStr;
      updates.original_due_date = todayStr;
    }
    
    // Note: When completing (TODO -> DONE), we don't set due_date
    // getAllTasksInRange uses completed_at to show completed tasks in today's view
    // So completed_at is sufficient, no need to update due_date

    // Optimistically update UI immediately - update ALL matching queries
    const optimisticUpdate = (oldData: any) => updateTaskInCache(oldData, (t: any) => ({
      ...t,
      ...updates,
      completed_at: newStatus === 'DONE' ? new Date().toISOString() : null,
    }));

    // Update all related query keys
    queryClient.setQueriesData(
      { queryKey: ['tasks', 'backlog'], exact: false },
      optimisticUpdate
    );

    queryClient.setQueriesData(
      { queryKey: ['tasks', 'unified'], exact: false },
      optimisticUpdate
    );

    queryClient.setQueriesData(
      { queryKey: ['tasks', 'today'], exact: false },
      optimisticUpdate
    );

    // API call in background - only invalidate on error
    try {
      await updateTask({ id: task.id, ...updates });
      
      // Success: keep optimistic update, no invalidation needed
      if (newStatus === 'DONE') {
        showToast('success', 'Completed', 'Moved to today\'s completed list');
      } else if (newStatus === 'TODO' && !task.due_date) {
        showToast('success', 'Scheduled', 'Scheduled for today');
      }
    } catch (error) {
      console.error('Error updating task:', error);
      // Rollback on error
      queryClient.invalidateQueries({ queryKey: ['tasks', 'backlog'] });
      queryClient.invalidateQueries({ queryKey: ['tasks', 'unified'] });
      queryClient.invalidateQueries({ queryKey: ['tasks', 'today'] });
    }
  };

  // Handle Title Press - Open Edit Sheet
  const handleTitlePress = () => {
    setIsEditSheetVisible(true);
  };

  const handleTaskUpdate = useCallback(() => {
    // Delay invalidation to ensure modal is closed first
    setTimeout(() => {
      queryClient.invalidateQueries({ queryKey: ['tasks', 'backlog'] });
      queryClient.invalidateQueries({ queryKey: ['tasks', 'unified'] });
    }, 200);
  }, [queryClient]);

  // Memoize task prop to prevent unnecessary re-renders
  const editTaskData = useMemo(() => ({
    id: task.id,
    title: task.title,
    due_date: task.due_date,
    due_time: task.due_time,
    group_id: task.group_id || null,
    assignees: task.assignees?.map(a => ({
      user_id: a.user_id,
      profile: a.profile,
    })) || [],
    status: task.status,
  }), [task.id, task.title, task.due_date, task.due_time, task.group_id, task.assignees, task.status]);

  // Format time
  const formatTime = (time: string | null) => {
    if (!time) return null;
    return time.substring(0, 5);
  };

  const isCancelled = task.status === 'CANCEL';
  const isTodo = task.status === 'TODO';

  return (
    <>
      <View
        style={[
          styles.card,
          isDone && { backgroundColor: '#F8FAFC' }, // Completed task background
          !isDone && {
            backgroundColor: colors.card,
            borderWidth: 1,
            borderColor: 'rgba(229, 231, 235, 0.5)',
            ...shadows.sm,
          },
        ]}
      >
        <View style={{ paddingHorizontal: 12, paddingVertical: 12 }}>
          {/* 첫 번째 줄: 체크박스 + 제목 + 시간뱃지 + delay뱃지 */}
          <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 12, marginBottom: 8 }}>
            {/* Checkbox */}
            {(() => {
              // Check if MEMBER should have read-only checkbox
              const myGroup = task.group_id ? groups.find(g => g.id === task.group_id) : null;
              const isCheckboxDisabled = task.group_id && myGroup?.myRole === 'MEMBER';
              
              return (
                <Pressable
                  onPress={handleToggleComplete}
                  disabled={isCheckboxDisabled}
                  style={[
                    {
                      width: 24,
                      height: 24,
                      borderRadius: borderRadius.full,
                      borderWidth: 2,
                      flexShrink: 0,
                      alignItems: 'center',
                      justifyContent: 'center',
                      marginTop: 2, // Align with text baseline
                    },
                    isDone && {
                      backgroundColor: colors.success,
                      borderColor: colors.success,
                    },
                    isCancelled && {
                      backgroundColor: colors.gray300,
                      borderColor: colors.gray300,
                    },
                    !isDone && !isCancelled && {
                      borderColor: 'rgba(156, 163, 175, 0.3)',
                    },
                    isCheckboxDisabled && {
                      opacity: 0.5, // Visual indicator for disabled state
                    },
                  ]}
                  hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                  delayPressIn={0}
                  pressRetentionOffset={{ top: 20, bottom: 20, left: 20, right: 20 }}
                >
                  {isDone && (
                    <Check size={14} color="#FFFFFF" strokeWidth={3} />
                  )}
                  {isCancelled && (
                    <Text style={{ color: '#fff', fontSize: 14, fontWeight: '600' }}>✕</Text>
                  )}
                </Pressable>
              );
            })()}

            {/* Task Title + Time Badge Container */}
            <View style={{ flex: 1, flexDirection: 'row', alignItems: 'center', gap: 4, minWidth: 0 }}>
              {/* Task Title - Clickable to open edit modal */}
              <Pressable
                onPress={handleTitlePress}
                style={{ flexShrink: 1, minWidth: 0 }}
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                delayPressIn={0}
                pressRetentionOffset={{ top: 20, bottom: 20, left: 20, right: 20 }}
              >
                <Text 
                  style={[
                    {
                      fontSize: 14,
                      fontWeight: '500',
                      minWidth: 0, // Allow text to shrink
                    },
                    isDone && {
                      color: colors.textSub,
                      textDecorationLine: 'line-through',
                    },
                    isCancelled && {
                      color: colors.textDisabled,
                      textDecorationLine: 'line-through',
                    },
                    !isDone && !isCancelled && {
                      color: colors.textMain,
                      fontWeight: '500',
                    },
                  ]}
                  numberOfLines={2}
                  ellipsizeMode="tail"
                >
                  {String(task.title || '(Untitled)')}
                </Text>
              </Pressable>

              {/* Time Badge - 제목 바로 옆에 표시 */}
              {task.due_time && (
                <View style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  backgroundColor: '#F1F5F9', // Slate 100
                  paddingHorizontal: 6,
                  paddingVertical: 4,
                  borderRadius: 6,
                  flexShrink: 0,
                }}>
                  <Clock size={10} color="#475569" strokeWidth={2} />
                  <Text style={{
                    fontSize: 10,
                    fontWeight: '500',
                    color: '#475569', // Slate 600
                    marginLeft: 4,
                  }}>
                    {String(formatTime(task.due_time) || '')}
                  </Text>
                </View>
              )}
            </View>
          </View>

          {/* 두 번째 줄: 그룹명 + 담당자이니셜 + 백로그뱃지 */}
          <View style={{ 
            flexDirection: 'row', 
            alignItems: 'center', 
            gap: 6,
            flexWrap: 'wrap', // Allow badges to wrap to next line
            marginLeft: 36, // Align with title (checkbox width + gap)
          }}>
            {/* Group Badge */}
            {task.group_id && (() => {
              const groupName = groups.find(g => g.id === task.group_id)?.name;
              return groupName ? (
                <View style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  backgroundColor: '#F1F5F9', // Slate 100
                  paddingHorizontal: 6,
                  paddingVertical: 4,
                  borderRadius: 6,
                  flexShrink: 0,
                }}>
                  <Users size={10} color="#475569" strokeWidth={2} />
                  <Text style={{
                    fontSize: 10,
                    fontWeight: '500',
                    color: '#475569', // Slate 600
                    marginLeft: 4,
                    maxWidth: 100, // Limit group name width
                  }}
                  numberOfLines={1}
                  ellipsizeMode="tail"
                  >
                    {String(groupName)}
                  </Text>
                </View>
              ) : null;
            })()}

            {/* Assignee Avatars (for group tasks) - show for both TODO and DONE */}
            {task.group_id && task.assignees && task.assignees.length > 0 && (
              <AssigneeAvatars
                taskId={task.id}
                groupId={task.group_id}
                assignees={task.assignees.map(a => ({
                  user_id: a.user_id,
                  nickname: a.profile?.nickname || 'Unknown',
                  avatar_url: a.profile?.avatar_url || null,
                  is_completed: a.is_completed,
                  completed_at: a.completed_at,
                }))}
                size={20}
                showCompletionRate={false}
              />
            )}

            {/* From Backlog Badge - for DONE tasks without due_date */}
            {isDone && !task.due_date && (
              <View style={{
                flexDirection: 'row',
                alignItems: 'center',
                backgroundColor: '#F1F5F9', // Slate 100
                paddingHorizontal: 6,
                paddingVertical: 4,
                borderRadius: 6,
                flexShrink: 0,
              }}>
                <Package size={10} color="#475569" strokeWidth={2} />
                <Text style={{
                  fontSize: 10,
                  fontWeight: '500',
                  color: '#475569', // Slate 600
                  marginLeft: 4,
                }}>
                  Backlog
                </Text>
              </View>
            )}
          </View>
        </View>
      </View>

      {/* Edit Task Bottom Sheet */}
      <EditTaskBottomSheet
        visible={isEditSheetVisible}
        onClose={() => setIsEditSheetVisible(false)}
        task={editTaskData}
        onUpdate={handleTaskUpdate}
      />
    </>
  );
}

// Modern Minimalist Styles
const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
    ...(Platform.OS === 'web' && { height: '100vh' }),
  },
  sectionHeader: {
    backgroundColor: colors.card,
    paddingHorizontal: 16,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: `${colors.border}80`, // 50% opacity
    justifyContent: 'center',
    alignItems: 'center',
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: colors.textMain,
  },
  badge: {
    borderRadius: borderRadius.full,
    backgroundColor: `${colors.primary}1A`, // 10% opacity
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  badgeText: {
    fontSize: 12,
    fontWeight: '500',
    color: colors.primary,
  },
  completedSectionTitle: {
    fontSize: 14,
    fontWeight: '500',
    color: colors.textSub,
  },
  textMain: {
    color: colors.textMain,
  },
  textSub: {
    color: colors.textSub,
    fontSize: 14,
  },
  primaryButton: {
    backgroundColor: colors.primary,
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: borderRadius.md,
  },
  card: {
    backgroundColor: colors.card,
    borderRadius: borderRadius.xl, // More rounded (16px)
    marginBottom: 12, // space-y-3 equivalent
    borderWidth: 1,
    borderColor: `${colors.border}80`, // 50% opacity
    ...shadows.sm,
  },
});
