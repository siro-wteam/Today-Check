import { borderRadius, colors } from '@/constants/colors';
import { getTaskById, moveTaskToBacklog, updateTask, updateTaskAssignees } from '@/lib/api/tasks';
import { useAuth } from '@/lib/hooks/use-auth';
import { useSubscriptionLimits } from '@/lib/hooks/use-subscription-limits';
import { useCalendarStore } from '@/lib/stores/useCalendarStore';
import { useGroupStore } from '@/lib/stores/useGroupStore';
import type { Task } from '@/lib/types';
import { openLocationInMaps } from '@/lib/utils/open-maps';
import { showToast } from '@/utils/toast';
import DateTimePicker from '@react-native-community/datetimepicker';
import { useQueryClient } from '@tanstack/react-query';
import { addDays, format, isToday, isTomorrow, parseISO } from 'date-fns';
import * as Haptics from 'expo-haptics';
import { MapPin, Package, Trash2, Users, X } from 'lucide-react-native';
import { useEffect, useRef, useState } from 'react';
import { Alert, KeyboardAvoidingView, Modal, Platform, Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LocationInput } from './LocationInput';
import { ModalCloseButton } from './ModalCloseButton';

interface EditTaskBottomSheetProps {
  visible: boolean;
  onClose: () => void;
  task: Task;
  onUpdate: () => void;
  onDateChange?: (dateStr: string) => void;
}

export function EditTaskBottomSheet({ visible, onClose, task, onUpdate, onDateChange }: EditTaskBottomSheetProps) {
  const insets = useSafeAreaInsets();
  const { groups, fetchMyGroups } = useGroupStore();
  const { user } = useAuth();
  const { updateTask: updateTaskInStore, mergeTasksIntoStore, deleteTask: deleteTaskInStore } = useCalendarStore();
  const queryClient = useQueryClient();
  const { canAddToBacklog, checkCanAddTaskToDate, isSubscribed } = useSubscriptionLimits();
  
  // Form state
  const [title, setTitle] = useState(task.title || '');
  const [dueDate, setDueDate] = useState<Date | null>(task.due_date ? parseISO(task.due_date) : null);
  const [dueTime, setDueTime] = useState<Date | null>(task.due_time ? parseISO(`2000-01-01T${task.due_time}`) : null);
  const [dueTimeEnd, setDueTimeEnd] = useState<Date | null>(task.due_time_end ? parseISO(`2000-01-01T${task.due_time_end}`) : null);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [showTimePicker, setShowTimePicker] = useState(false);
  const [showEndTimePicker, setShowEndTimePicker] = useState(false);
  const [timePickerValue, setTimePickerValue] = useState<Date | null>(null);
  const [endTimePickerValue, setEndTimePickerValue] = useState<Date | null>(null);
  const [webStartPickerValue, setWebStartPickerValue] = useState<Date | null>(null);
  const [webEndPickerValue, setWebEndPickerValue] = useState<Date | null>(null);
  const [selectedGroupId, setSelectedGroupId] = useState<string | null>(task.group_id || null);
  const [selectedAssigneeIds, setSelectedAssigneeIds] = useState<string[]>(
    task.assignees?.map(a => a.user_id) || []
  );
  const [location, setLocation] = useState<string | null>(task.location ?? null);
  const [showLocationField, setShowLocationField] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const prevVisibleRef = useRef(false);
  const dateInputRef = useRef<any>(null);
  const timeInputRef = useRef<any>(null);
  const endTimeInputRef = useRef<any>(null);
  const onDateChangeRef = useRef(onDateChange);
  const timeBeforeOpenRef = useRef<Date | null>(null);
  const endTimeBeforeOpenRef = useRef<Date | null>(null);
  
  // Update ref when onDateChange changes
  useEffect(() => {
    onDateChangeRef.current = onDateChange;
  }, [onDateChange]);

  // Fetch groups only when modal opens and we don't have groups yet (avoids duplicate API calls)
  useEffect(() => {
    if (!visible || !user?.id) return;
    if (groups.length === 0) fetchMyGroups(user.id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible, user?.id, groups.length]);

  // Reset form when modal opens (only when visible changes from false to true)
  useEffect(() => {
    if (visible && !prevVisibleRef.current) {
      setTitle(task.title);
      setDueDate(task.due_date ? parseISO(task.due_date) : null);
      setDueTime(task.due_time ? parseISO(`2000-01-01T${task.due_time}`) : null);
      setDueTimeEnd(task.due_time_end ? parseISO(`2000-01-01T${task.due_time_end}`) : null);
      setSelectedGroupId(task.group_id || null);
      setSelectedAssigneeIds(task.assignees?.map(a => a.user_id) || []);
      setLocation(task.location ?? null);
      setShowLocationField(false);
      setShowDatePicker(false);
      setShowTimePicker(false);
      setShowEndTimePicker(false);
      setIsSaving(false); // Reset saving state when modal opens
    }
    prevVisibleRef.current = visible;
  }, [visible, task.title, task.due_date, task.due_time, task.due_time_end, task.group_id, task.assignees, task.location]);

  // 웹에서 날짜 선택기 자동 열기
  useEffect(() => {
    if (Platform.OS === 'web' && showDatePicker && dateInputRef.current) {
      // Use requestAnimationFrame to ensure DOM is ready
      requestAnimationFrame(() => {
        try {
          dateInputRef.current?.showPicker?.();
        } catch (error) {
          // Fallback: focus the input if showPicker fails
          dateInputRef.current?.focus?.();
        }
      });
    }
  }, [showDatePicker]);

  // 웹에서는 커스텀 모달(Cancel/Apply) 사용 → showPicker 호출 안 함
  useEffect(() => {
    if (Platform.OS === 'web') return;
    if (showTimePicker && timeInputRef.current) {
      requestAnimationFrame(() => {
        try {
          timeInputRef.current?.showPicker?.();
        } catch (error) {
          timeInputRef.current?.focus?.();
        }
      });
    }
  }, [showTimePicker]);

  useEffect(() => {
    if (Platform.OS === 'web') return;
    if (showEndTimePicker && endTimeInputRef.current) {
      requestAnimationFrame(() => {
        try {
          endTimeInputRef.current?.showPicker?.();
        } catch (error) {
          endTimeInputRef.current?.focus?.();
        }
      });
    }
  }, [showEndTimePicker]);

  // Check if user can edit this task
  const canEdit = (() => {
    if (task.group_id) {
      const originalGroup = groups.find(g => g.id === task.group_id);
      return originalGroup?.myRole === 'OWNER' || originalGroup?.myRole === 'ADMIN';
    }
    return true; // Personal task: creator can edit (RLS will enforce)
  })();

  // Check if user can delete this task (same as edit permission)
  const canDelete = canEdit;

  // Check if task can be moved to backlog (must have due_date and be TODO status)
  const canMoveToBacklog = task.due_date !== null && task.due_date !== undefined && task.status === 'TODO' && canAddToBacklog;

  // Completed tasks: read-only in edit modal (user must mark incomplete to edit)
  const isCompleted = task.status === 'DONE';
  const effectiveCanEdit = canEdit && !isCompleted;

  // Check if selected group allows editing (for group switching)
  const canEditSelectedGroup = selectedGroupId
    ? (groups.find(g => g.id === selectedGroupId)?.myRole === 'OWNER' || groups.find(g => g.id === selectedGroupId)?.myRole === 'ADMIN')
    : true; // Personal task

  // Get the currently selected group
  const currentGroup = selectedGroupId
    ? groups.find(g => g.id === selectedGroupId)
    : null;

  const handleClose = () => {
    setIsSaving(false); // Reset saving state when closing
    onClose();
  };

  const handleDelete = async () => {
    if (!canDelete) {
      showToast('error', 'Permission Denied', 'Only group owners can delete group tasks');
      return;
    }

    // Confirm deletion
    if (Platform.OS === 'web') {
      const confirmed = confirm('Are you sure you want to delete this task?');
      if (!confirmed) return;
    } else {
      Alert.alert(
        'Delete Task',
        'Are you sure you want to delete this task? This action cannot be undone.',
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Delete',
            style: 'destructive',
            onPress: async () => {
              await performDelete();
            },
          },
        ]
      );
      return;
    }

    await performDelete();
  };

  const performDelete = async () => {
    const result = await deleteTaskInStore(task.id);
    if (result.success) {
      handleClose();
      setTimeout(() => onUpdate(), 200);
    }
  };

  const handleMoveToBacklog = async () => {
    if (!canMoveToBacklog) {
      showToast('error', 'Cannot Move', 'This task cannot be moved to backlog');
      return;
    }

    // Show confirmation dialog (platform-specific)
    const confirmMove = () => {
      if (Platform.OS === 'web') {
        // Web: Use browser confirm dialog
        return window.confirm('Are you sure you want to move this task to the backlog?');
      } else {
        // Native: Use Alert.alert
        return new Promise<boolean>((resolve) => {
          Alert.alert(
            'Move to Backlog',
            'Are you sure you want to move this task to the backlog?',
            [
              {
                text: 'Cancel',
                style: 'cancel',
                onPress: () => resolve(false),
              },
              {
                text: 'Move',
                style: 'destructive',
                onPress: () => resolve(true),
              },
            ]
          );
        });
      }
    };

    const confirmed = await confirmMove();
    if (!confirmed) return;

    if (!canAddToBacklog) {
      showToast('error', 'Limit', 'Free plan: max 5 backlog items. Upgrade to add more.');
      return;
    }

    try {
      // Create optimistic task with due_date and original_due_date cleared
      const optimisticTask: Task = {
        ...task,
        due_date: null,
        original_due_date: null,
        updated_at: new Date().toISOString(),
      };

      // Apply optimistic update to CalendarStore
      const { calculateRolloverInfo } = await import('@/lib/api/tasks');
      const tasksWithRollover = calculateRolloverInfo([optimisticTask]);
      mergeTasksIntoStore(tasksWithRollover);

      // Apply optimistic update to React Query cache
      queryClient.setQueriesData(
        { queryKey: ['tasks', 'unified'], exact: false },
        (oldData: any) => {
          if (!oldData) return oldData;
          if (Array.isArray(oldData)) {
            return oldData.map((t: any) => t.id === task.id ? optimisticTask : t);
          }
          return oldData;
        }
      );

      // Call API
      const { error } = await moveTaskToBacklog(task.id);
      
      if (error) {
        // Revert optimistic update on error
        const revertTasks = calculateRolloverInfo([task]);
        mergeTasksIntoStore(revertTasks);
        
        queryClient.setQueriesData(
          { queryKey: ['tasks', 'unified'], exact: false },
          (oldData: any) => {
            if (!oldData) return oldData;
            if (Array.isArray(oldData)) {
              return oldData.map((t: any) => t.id === task.id ? task : t);
            }
            return oldData;
          }
        );
        
        throw error;
      }

      showToast('success', 'Moved to backlog', 'Task moved to backlog.');
      // Success - close modal and trigger update
      handleClose();
      
      // Delay onUpdate to ensure modal is closed first
      setTimeout(() => {
        onUpdate();
      }, 200);
    } catch (error: any) {
      showToast('error', 'Move Failed', error.message);
    }
  };

  const handleSave = async () => {
    if (!title.trim()) {
      showToast('error', 'Required', 'Please enter a title');
      return;
    }

    if (!canEdit) {
      showToast('error', 'Permission Denied', 'Only group owners can edit group tasks');
      return;
    }
    if (isCompleted) {
      return; // Read-only when completed
    }

    const dueDateStr = dueDate ? format(dueDate, 'yyyy-MM-dd') : null;

    // Subscription limits (free tier)
    if (!isSubscribed) {
      if (!dueDateStr) {
        if (!canAddToBacklog) {
          showToast('error', 'Limit', 'Free plan: max 5 backlog items. Upgrade to add more.');
          return;
        }
      } else {
        const { allowed, message } = await checkCanAddTaskToDate(dueDateStr);
        if (!allowed) {
          showToast('error', 'Limit', message ?? 'Free plan: max 5 tasks per date. Upgrade to add more.');
          return;
        }
      }
    }

    // Format times and build payload
    const dueTimeStr = dueTime ? format(dueTime, 'HH:mm:ss') : null;
    const dueTimeEndStr = dueTimeEnd ? format(dueTimeEnd, 'HH:mm:ss') : null;
    const wasBacklog = !task.due_date;
    const dateChanged = !!task.due_date && !!dueDateStr && task.due_date !== dueDateStr;

    const optimisticTask: Task = {
      ...task,
      title: title.trim(),
      due_date: dueDateStr,
      original_due_date: wasBacklog && dueDateStr ? dueDateStr : task.original_due_date,
      due_time: dueTimeStr,
      due_time_end: dueTimeEndStr,
      group_id: selectedGroupId,
      location: location?.trim() || null,
      updated_at: new Date().toISOString(),
    };

    const updatePayload: Parameters<typeof updateTask>[0] = {
      id: task.id,
      title: title.trim(),
      due_date: dueDateStr,
      due_time: dueTimeStr,
      due_time_end: dueTimeEndStr,
      group_id: selectedGroupId,
      location: location?.trim() || null,
    };
    if (wasBacklog && dueDateStr) {
      updatePayload.original_due_date = dueDateStr;
    }

    // Apply optimistic update so UI updates immediately
    const { calculateRolloverInfo } = await import('@/lib/api/tasks');
    const tasksWithRollover = calculateRolloverInfo([optimisticTask]);
    mergeTasksIntoStore(tasksWithRollover);
    queryClient.setQueriesData(
      { queryKey: ['tasks', 'unified'], exact: false },
      (oldData: any) => {
        if (!oldData) return oldData;
        if (Array.isArray(oldData)) {
          return oldData.map((t: any) => (t.id === task.id ? optimisticTask : t));
        }
        return oldData;
      }
    );

    // Close immediately and show success so save feels instant
    const dateLabel = dueDate ? format(dueDate, 'MMM d, yyyy') : '';
    if (wasBacklog && dueDateStr) {
      showToast('success', 'Scheduled', `Task scheduled for ${dateLabel}.`);
    } else if (dateChanged) {
      showToast('success', 'Rescheduled', `Task rescheduled to ${dateLabel}.`);
    } else {
      showToast('success', 'Updated', 'Task updated.');
    }
    handleClose();
    if (onUpdate) setTimeout(() => onUpdate(), 200);

    const revert = async () => {
      const { calculateRolloverInfo: revertCalc } = await import('@/lib/api/tasks');
      mergeTasksIntoStore(revertCalc([task as Task]));
      queryClient.setQueriesData(
        { queryKey: ['tasks', 'unified'], exact: false },
        (oldData: any) => {
          if (!oldData) return oldData;
          if (Array.isArray(oldData)) {
            return oldData.map((t: any) => (t.id === task.id ? task : t));
          }
          return oldData;
        }
      );
    };

    // Persist in background; revert and show error on failure
    (async () => {
      try {
        const updateResult = await updateTask(updatePayload);
        if (updateResult.error) {
          await revert();
          showToast('error', 'Save Failed', updateResult.error.message || 'Failed to update task');
          return;
        }
        if (selectedGroupId) {
          const { error: assigneeError } = await updateTaskAssignees(task.id, selectedAssigneeIds);
          if (assigneeError) {
            await revert();
            showToast('error', 'Save Failed', assigneeError.message);
            return;
          }
        } else if (task.group_id) {
          const { error: assigneeError } = await updateTaskAssignees(task.id, []);
          if (assigneeError) {
            await revert();
            showToast('error', 'Save Failed', assigneeError.message);
            return;
          }
        }
        const { data: updatedTask, error: fetchError } = await getTaskById(task.id);
        if (!fetchError && updatedTask) {
          const { calculateRolloverInfo: calc } = await import('@/lib/api/tasks');
          mergeTasksIntoStore(calc([updatedTask]));
          queryClient.setQueriesData(
            { queryKey: ['tasks', 'unified'], exact: false },
            (oldData: any) => {
              if (!oldData) return oldData;
              return Array.isArray(oldData)
                ? oldData.map((t: any) => (t.id === task.id ? updatedTask : t))
                : oldData;
            }
          );
        }
      } catch (error: any) {
        await revert();
        showToast('error', 'Save Failed', error.message);
      }
    })();
  };

  const handleGroupSelect = (groupId: string | null) => {
    if (!effectiveCanEdit) return;
    
    // Toggle: if already selected, deselect it
    if (selectedGroupId === groupId) {
      setSelectedGroupId(null);
      setSelectedAssigneeIds([]);
      return;
    }
    
    // Check if user can edit the selected group
    if (groupId && !canEditSelectedGroup) {
      return; // Don't allow selection if user is not OWNER
    }
    
    // Select this group (only one group can be selected)
    setSelectedGroupId(groupId);
    // Reset assignees when changing group
    setSelectedAssigneeIds([]);
  };

  // Toggle assignee selection
  const toggleAssignee = (userId: string) => {
    if (!effectiveCanEdit) return;
    
    const isCurrentlySelected = selectedAssigneeIds.includes(userId);
    
    if (isCurrentlySelected) {
      setSelectedAssigneeIds(prev => prev.filter(id => id !== userId));
    } else {
      setSelectedAssigneeIds(prev => [...prev, userId]);
    }
  };

  const handleQuickDate = (date: Date | null) => {
    setShowDatePicker(false);
    setShowTimePicker(false);

    if (!date) {
      setDueDate(null);
      setDueTime(null);
      return;
    }

    // Prevent past dates
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const selectedDate = new Date(date);
    selectedDate.setHours(0, 0, 0, 0);

    if (selectedDate < today) {
      showToast('error', '날짜 선택', '과거 날짜는 선택할 수 없습니다.');
      return;
    }

    if (dueDate && date) {
      const dueDateOnly = new Date(dueDate.getFullYear(), dueDate.getMonth(), dueDate.getDate());
      const targetDateOnly = new Date(date.getFullYear(), date.getMonth(), date.getDate());
      
      if (dueDateOnly.getTime() === targetDateOnly.getTime()) {
        setDueDate(null);
        setDueTime(null);
        return;
      }
    }
    
    setDueDate(date);
  };

  const isDateSelected = (targetDate: Date | null) => {
    if (!dueDate || !targetDate) return false;
    
    const dueDateOnly = new Date(dueDate.getFullYear(), dueDate.getMonth(), dueDate.getDate());
    const targetDateOnly = new Date(targetDate.getFullYear(), targetDate.getMonth(), targetDate.getDate());
    
    return dueDateOnly.getTime() === targetDateOnly.getTime();
  };

  const getDateButtonText = () => {
    if (!dueDate) return '📅 Pick Date';
    
    const today = new Date();
    const todayOnly = new Date(today.getFullYear(), today.getMonth(), today.getDate());
    const dueDateOnly = new Date(dueDate.getFullYear(), dueDate.getMonth(), dueDate.getDate());
    
    const diffDays = Math.floor((dueDateOnly.getTime() - todayOnly.getTime()) / (1000 * 60 * 60 * 24));
    
    if (diffDays === 0) return 'Today';
    if (diffDays === 1) return 'Tomorrow';
    
    return format(dueDate, 'MMM d');
  };

  const getDefaultTime = () => {
    const now = new Date();
    const defaultTime = new Date();
    defaultTime.setHours(now.getHours() + 1);
    defaultTime.setMinutes(0);
    defaultTime.setSeconds(0);
    return defaultTime;
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={handleClose}
    >
      <Pressable
        className="flex-1 bg-black/50 justify-end"
        onPress={handleClose}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        >
          <Pressable onPress={(e) => e.stopPropagation()}>
            <View 
              className="bg-white dark:bg-gray-900 rounded-t-3xl px-6 py-6"
              style={{ paddingBottom: Math.max(insets.bottom, 24) }}
            >
              {/* Header */}
              <View className="flex-row justify-between items-center mb-6">
                <Text className="text-xl font-bold text-gray-900 dark:text-white">
                  Edit Task
                </Text>
                <View className="flex-row items-center gap-4">
                  {/* Move to Backlog Button */}
                  {canMoveToBacklog && (
                    <Pressable
                      onPress={() => {
                        if (Platform.OS === 'ios') {
                          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
                        }
                        handleMoveToBacklog();
                      }}
                      className="p-2"
                      hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                    >
                      <Package size={20} color={colors.textSub || '#6b7280'} strokeWidth={2} />
                    </Pressable>
                  )}
                  {/* Delete Button */}
                  {canDelete && (
                    <Pressable
                      onPress={() => {
                        if (Platform.OS === 'ios') {
                          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy).catch(() => {});
                        }
                        handleDelete();
                      }}
                      className="p-2"
                      hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                    >
                      <Trash2 size={20} color={colors.error} strokeWidth={2} />
                    </Pressable>
                  )}
                  {/* Close Button */}
                  <ModalCloseButton onPress={handleClose} />
                </View>
              </View>

              {/* Permission Warning */}
              {!canEdit && (
                <View className="bg-yellow-50 dark:bg-yellow-900/20 rounded-xl px-4 py-3 mb-4">
                  <Text className="text-yellow-800 dark:text-yellow-200 text-sm">
                    ⚠️ Only group owners can edit group tasks
                  </Text>
                </View>
              )}

              {/* Completed task: read-only notice */}
              {isCompleted && (
                <View className="bg-gray-100 dark:bg-gray-800 rounded-xl px-4 py-3 mb-4">
                  <Text className="text-gray-700 dark:text-gray-300 text-sm">
                    This task is completed. Mark it incomplete to edit.
                  </Text>
                </View>
              )}

              {/* Group Selector */}
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                className="mb-4"
              >
                <View className="flex-row gap-2">
                  {/* Group buttons - only show groups where user is OWNER or ADMIN */}
                  {groups
                    .filter(group => group.myRole === 'OWNER' || group.myRole === 'ADMIN')
                    .map(group => (
                      <Pressable
                        key={group.id}
                        onPress={() => {
                          if (Platform.OS === 'ios') {
                            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
                          }
                          handleGroupSelect(group.id);
                        }}
                        disabled={!effectiveCanEdit}
                        className={`px-4 py-2 rounded-full flex-row items-center gap-2 ${
                          selectedGroupId === group.id
                            ? 'bg-primary'
                            : 'bg-gray-100 dark:bg-gray-800'
                        } ${!effectiveCanEdit ? 'opacity-50' : ''}`}
                      >
                        <Users 
                          size={14} 
                          color={selectedGroupId === group.id ? '#ffffff' : colors.textSub} 
                        />
                        <Text
                          className={`font-semibold ${
                            selectedGroupId === group.id
                              ? 'text-white'
                              : 'text-gray-700 dark:text-gray-300'
                          }`}
                        >
                          {group.name}
                        </Text>
                      </Pressable>
                    ))}
                </View>
              </ScrollView>

              {/* Title row: input + location icon (icon only when no location and editable; tap to open field) */}
              <View className="flex-row items-center gap-2 mb-4">
                <TextInput
                  className="flex-1 bg-gray-50 dark:bg-gray-800 rounded-xl px-4 py-4 text-base text-gray-900 dark:text-white min-w-0"
                  placeholder="What do you want to do?"
                  placeholderTextColor="#9ca3af"
                  value={title}
                  onChangeText={setTitle}
                  editable={effectiveCanEdit}
                />
                {effectiveCanEdit && location == null && (
                  <Pressable
                    onPress={() => {
                      if (Platform.OS === 'ios') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
                      setShowLocationField(true);
                    }}
                    className="rounded-xl bg-gray-50 dark:bg-gray-800 p-3 border border-gray-200 dark:border-gray-600"
                  >
                    <MapPin size={22} color="#64748b" strokeWidth={2} />
                  </Pressable>
                )}
              </View>

              {/* Location: editable = icon-triggered field or chip; read-only = tap to open maps */}
              {effectiveCanEdit ? (
                ((showLocationField && location == null) || location != null) ? (
                  <View className="mb-4">
                    <LocationInput
                      value={location}
                      onChange={(v) => {
                        setLocation(v);
                        if (v == null) setShowLocationField(false);
                      }}
                      hideTriggerWhenEmpty={true}
                      expandedWhenEmpty={showLocationField && location == null}
                      onCollapse={() => setShowLocationField(false)}
                    />
                  </View>
                ) : null
              ) : task.location ? (
                <Pressable
                  onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {}); openLocationInMaps(task.location!); }}
                  className="flex-row items-center gap-2 mb-4 rounded-lg bg-gray-50 dark:bg-gray-800 px-4 py-2"
                >
                  <MapPin size={16} color="#64748b" />
                  <Text className="text-gray-600 dark:text-gray-400 flex-1" numberOfLines={1}>
                    {task.location}
                  </Text>
                </Pressable>
              ) : null}

              {/* Assignee Bar (only for group tasks) */}
              {selectedGroupId && currentGroup && (
                <View className="mb-4">
                  <Text className="text-sm text-gray-600 dark:text-gray-400 mb-2">
                    Assign to:
                  </Text>
                  <ScrollView
                    horizontal
                    showsHorizontalScrollIndicator={false}
                  >
                    <View className="flex-row gap-3">
                      {currentGroup.members.map(member => {
                        const isSelected = selectedAssigneeIds.includes(member.id);
                        const isCurrentUser = member.id === user?.id;
                        
                        return (
                          <Pressable
                            key={member.id}
                            onPress={() => {
                              if (Platform.OS === 'ios') {
                                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
                              }
                              toggleAssignee(member.id);
                            }}
                            disabled={!effectiveCanEdit}
                            className={`px-4 py-2 rounded-full flex-row items-center gap-2 border-2 ${
                              isSelected
                                ? 'bg-blue-50 dark:bg-blue-900/30 border-primary'
                                : 'bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700'
                            } ${!effectiveCanEdit ? 'opacity-50' : ''}`}
                          >
                            <View 
                              className="w-6 h-6 rounded-full items-center justify-center"
                              style={{ backgroundColor: member.profileColor }}
                            >
                              <Text className="text-white text-xs font-bold">
                                {member.name.charAt(0).toUpperCase()}
                              </Text>
                            </View>
                            
                            <Text
                              className={`font-semibold ${
                                isSelected
                                  ? 'text-primary dark:text-primary'
                                  : 'text-gray-700 dark:text-gray-300'
                              }`}
                            >
                              {member.name} {isCurrentUser ? '(Me)' : ''}
                            </Text>
                          </Pressable>
                        );
                      })}
                    </View>
                  </ScrollView>
                  
                  {selectedAssigneeIds.length > 0 && (
                    <Text className="text-xs text-gray-500 dark:text-gray-400 mt-2">
                      {selectedAssigneeIds.length} {selectedAssigneeIds.length === 1 ? 'person' : 'people'} selected
                    </Text>
                  )}
                </View>
              )}

              {/* Quick Date Chips */}
              <View className="flex-row gap-2 mb-4">
                <Pressable
                  onPress={() => {
                    if (Platform.OS === 'ios') {
                      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
                    }
                    handleQuickDate(new Date());
                  }}
                  disabled={!effectiveCanEdit}
                  className={`px-4 py-2 rounded-full ${
                    isDateSelected(new Date())
                      ? 'bg-primary'
                      : 'bg-gray-100 dark:bg-gray-800'
                  } ${!effectiveCanEdit ? 'opacity-50' : ''}`}
                >
                  <Text
                    className={`font-semibold ${
                      isDateSelected(new Date())
                        ? 'text-white'
                        : 'text-gray-700 dark:text-gray-300'
                    }`}
                  >
                    Today
                  </Text>
                </Pressable>

                <Pressable
                  onPress={() => {
                    if (Platform.OS === 'ios') {
                      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
                    }
                    handleQuickDate(addDays(new Date(), 1));
                  }}
                  disabled={!effectiveCanEdit}
                  className={`px-4 py-2 rounded-full ${
                    isDateSelected(addDays(new Date(), 1))
                      ? 'bg-primary'
                      : 'bg-gray-100 dark:bg-gray-800'
                  } ${!effectiveCanEdit ? 'opacity-50' : ''}`}
                >
                  <Text
                    className={`font-semibold ${
                      isDateSelected(addDays(new Date(), 1))
                        ? 'text-white'
                        : 'text-gray-700 dark:text-gray-300'
                    }`}
                  >
                    Tomorrow
                  </Text>
                </Pressable>

                <Pressable
                  onPress={() => {
                    if (Platform.OS === 'ios') {
                      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
                    }
                    setShowDatePicker(true);
                  }}
                  disabled={!effectiveCanEdit}
                  className={`px-4 py-2 rounded-full ${
                    dueDate && !isToday(dueDate) && !isTomorrow(dueDate)
                      ? 'bg-primary'
                      : 'bg-gray-100 dark:bg-gray-800'
                  } ${!effectiveCanEdit ? 'opacity-50' : ''}`}
                >
                  <Text
                    className={`font-semibold ${
                      dueDate && !isToday(dueDate) && !isTomorrow(dueDate)
                        ? 'text-white'
                        : 'text-gray-700 dark:text-gray-300'
                    }`}
                  >
                    {dueDate && !isToday(dueDate) && !isTomorrow(dueDate)
                      ? format(dueDate, 'MMM d')
                      : '📅 Date'}
                  </Text>
                </Pressable>
              </View>

              {/* Time Selection: [아이콘+시작시간+제거] ~ [아이콘+종료시간+제거] */}
              {dueDate && (
                <View className={`flex-row items-center flex-wrap gap-2 mb-4 ${!effectiveCanEdit ? 'opacity-50' : ''}`} style={{ flexDirection: 'row', alignItems: 'center' }}>
                  {/* 그룹: 시작시간 */}
                  <View className="flex-row items-center rounded-lg border border-gray-200 dark:border-gray-600 bg-gray-50 dark:bg-gray-800 pl-2 pr-1 py-2" style={{ flexDirection: 'row', alignItems: 'center' }}>
                    <Text className="text-gray-700 dark:text-gray-300 mr-1.5">🕐</Text>
                    <Pressable
                      onPress={() => {
                        if (!effectiveCanEdit) return;
                        if (Platform.OS === 'ios') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
                      timeBeforeOpenRef.current = dueTime ? new Date(dueTime.getTime()) : null;
                        setTimePickerValue(dueTime ?? getDefaultTime());
                        if (Platform.OS === 'web') setWebStartPickerValue(dueTime ?? getDefaultTime());
                        setShowTimePicker(true);
                      }}
                    className="py-1 px-1 rounded min-w-[64px]"
                    >
                      <Text className="text-gray-700 dark:text-gray-300 font-medium">
                        {dueTime ? format(dueTime, 'HH:mm') : 'Start (Optional)'}
                      </Text>
                    </Pressable>
                    {effectiveCanEdit && dueTime != null && (
                      <Pressable
                        onPress={() => {
                          if (Platform.OS === 'ios') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
                          setDueTime(null);
                        }}
                        className="rounded-full p-1 ml-0.5 items-center justify-center bg-gray-200/40 dark:bg-gray-600/40 active:opacity-70"
                        hitSlop={{ top: 16, bottom: 16, left: 16, right: 16 }}
                      >
                        <X size={14} color="#64748B" strokeWidth={2.5} />
                      </Pressable>
                    )}
                  </View>
                  <Text className="text-gray-500 dark:text-gray-400 font-medium">~</Text>
                  {/* 그룹: 종료시간 */}
                  <View className="flex-row items-center rounded-lg border border-gray-200 dark:border-gray-600 bg-gray-50 dark:bg-gray-800 pl-2 pr-1 py-2" style={{ flexDirection: 'row', alignItems: 'center' }}>
                    <Text className="text-gray-700 dark:text-gray-300 mr-1.5">🕐</Text>
                    <Pressable
                      onPress={() => {
                        if (!effectiveCanEdit) return;
                        if (Platform.OS === 'ios') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
                      endTimeBeforeOpenRef.current = dueTimeEnd ? new Date(dueTimeEnd.getTime()) : null;
                        setEndTimePickerValue(dueTimeEnd ?? dueTime ?? getDefaultTime());
                        if (Platform.OS === 'web') setWebEndPickerValue(dueTimeEnd ?? dueTime ?? getDefaultTime());
                        setShowEndTimePicker(true);
                      }}
                    className="py-1 px-1 rounded min-w-[64px]"
                    >
                      <Text className="text-gray-700 dark:text-gray-300 font-medium">
                        {dueTimeEnd ? format(dueTimeEnd, 'HH:mm') : 'End (Optional)'}
                      </Text>
                    </Pressable>
                    {effectiveCanEdit && dueTimeEnd != null && (
                      <Pressable
                        onPress={() => {
                          if (Platform.OS === 'ios') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
                          setDueTimeEnd(null);
                        }}
                        className="rounded-full p-1 ml-0.5 items-center justify-center bg-gray-200/40 dark:bg-gray-600/40 active:opacity-70"
                        hitSlop={{ top: 16, bottom: 16, left: 16, right: 16 }}
                      >
                        <X size={14} color="#64748B" strokeWidth={2.5} />
                      </Pressable>
                    )}
                  </View>
                </View>
              )}

              {/* DateTimePicker - Web (HTML Input) - Always rendered but hidden */}
              {Platform.OS === 'web' && (
                <>
                  <input
                    ref={dateInputRef}
                    type="date"
                    value={dueDate ? format(dueDate, 'yyyy-MM-dd') : ''}
                    min={format(new Date(), 'yyyy-MM-dd')} // Prevent past dates
                    onChange={(e) => {
                      if (e.target.value) {
                        const selected = parseISO(e.target.value);
                        // Double check: ensure selected date is not in the past
                        const today = new Date();
                        today.setHours(0, 0, 0, 0);
                        const selectedDate = new Date(selected);
                        selectedDate.setHours(0, 0, 0, 0);
                        
                        if (selectedDate >= today) {
                          setDueDate(selected);
                          // If date changed, notify parent for navigation
                          if (onDateChangeRef.current && e.target.value) {
                            const dateStr = e.target.value;
                            if (task.due_date !== dateStr) {
                              onDateChangeRef.current(dateStr);
                            }
                          }
                        } else {
                          showToast('error', '날짜 선택', '과거 날짜는 선택할 수 없습니다.');
                        }
                      }
                      setShowDatePicker(false);
                    }}
                    onBlur={() => setShowDatePicker(false)}
                    style={{
                      position: 'absolute',
                      opacity: 0,
                      width: 0,
                      height: 0,
                      pointerEvents: 'none',
                      zIndex: -1,
                    }}
                  />
                  {showDatePicker && (
                    <View className="mb-4">
                      <Text className="text-sm text-gray-600 dark:text-gray-400 mb-2">
                        날짜를 선택하세요 (과거 날짜는 선택할 수 없습니다)
                      </Text>
                    </View>
                  )}
                  {/* Hidden input for time (native only; web uses modal below) */}
                  <input
                    ref={timeInputRef}
                    type="time"
                    value={dueTime ? format(dueTime, 'HH:mm') : ''}
                    onChange={(e) => {
                      if (e.target.value) {
                        const [h, m] = e.target.value.split(':');
                        const d = new Date();
                        d.setHours(parseInt(h, 10), parseInt(m, 10), 0);
                        setDueTime(d);
                      }
                      setShowTimePicker(false);
                    }}
                    style={{
                      position: 'absolute',
                      opacity: 0,
                      width: 0,
                      height: 0,
                      pointerEvents: 'none',
                      zIndex: -1,
                    }}
                  />
                  <input
                    ref={endTimeInputRef}
                    type="time"
                    value={dueTimeEnd ? format(dueTimeEnd, 'HH:mm') : ''}
                    onChange={(e) => {
                      if (e.target.value) {
                        const [h, m] = e.target.value.split(':');
                        const d = new Date();
                        d.setHours(parseInt(h, 10), parseInt(m, 10), 0);
                        setDueTimeEnd(d);
                      }
                      setShowEndTimePicker(false);
                    }}
                    style={{
                      position: 'absolute',
                      opacity: 0,
                      width: 0,
                      height: 0,
                      pointerEvents: 'none',
                      zIndex: -1,
                    }}
                  />
                  {/* Web: 시간 선택 모달 (Cancel / Apply) */}
                  {showTimePicker && (
                    <View className="mb-4 p-4 bg-gray-100 dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700">
                      <Text className="text-sm text-gray-600 dark:text-gray-400 mb-2">시작 시간</Text>
                      <input
                        type="time"
                        value={format(webStartPickerValue ?? getDefaultTime(), 'HH:mm')}
                        step="300"
                        onChange={(e) => {
                          if (e.target.value) {
                            const [h, m] = e.target.value.split(':');
                            const d = new Date();
                            d.setHours(parseInt(h, 10), parseInt(m, 10), 0);
                            setWebStartPickerValue(d);
                          }
                        }}
                        style={{
                          width: '100%',
                          padding: 12,
                          borderRadius: borderRadius.md,
                          border: '1px solid #d1d5db',
                          fontSize: 16,
                          marginBottom: 12,
                        }}
                      />
                      <View className="flex-row gap-3">
                        <Pressable
                          onPress={() => {
                            setDueTime(timeBeforeOpenRef.current);
                            setShowTimePicker(false);
                          }}
                          className="flex-1 bg-white dark:bg-gray-700 rounded-xl py-3 items-center border border-gray-200 dark:border-gray-600"
                        >
                          <Text className="text-gray-700 dark:text-gray-300 font-semibold">Cancel</Text>
                        </Pressable>
                        <Pressable
                          onPress={() => {
                            setDueTime(webStartPickerValue ?? getDefaultTime());
                            setShowTimePicker(false);
                          }}
                          className="flex-1 bg-primary rounded-xl py-3 items-center"
                        >
                          <Text className="text-white font-semibold">Apply</Text>
                        </Pressable>
                      </View>
                    </View>
                  )}
                  {showEndTimePicker && (
                    <View className="mb-4 p-4 bg-gray-100 dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700">
                      <Text className="text-sm text-gray-600 dark:text-gray-400 mb-2">종료 시간</Text>
                      <input
                        type="time"
                        value={format(webEndPickerValue ?? getDefaultTime(), 'HH:mm')}
                        step="300"
                        onChange={(e) => {
                          if (e.target.value) {
                            const [h, m] = e.target.value.split(':');
                            const d = new Date();
                            d.setHours(parseInt(h, 10), parseInt(m, 10), 0);
                            setWebEndPickerValue(d);
                          }
                        }}
                        style={{
                          width: '100%',
                          padding: 12,
                          borderRadius: borderRadius.md,
                          border: '1px solid #d1d5db',
                          fontSize: 16,
                          marginBottom: 12,
                        }}
                      />
                      <View className="flex-row gap-3">
                        <Pressable
                          onPress={() => {
                            setDueTimeEnd(endTimeBeforeOpenRef.current);
                            setShowEndTimePicker(false);
                          }}
                          className="flex-1 bg-white dark:bg-gray-700 rounded-xl py-3 items-center border border-gray-200 dark:border-gray-600"
                        >
                          <Text className="text-gray-700 dark:text-gray-300 font-semibold">Cancel</Text>
                        </Pressable>
                        <Pressable
                          onPress={() => {
                            setDueTimeEnd(webEndPickerValue ?? getDefaultTime());
                            setShowEndTimePicker(false);
                          }}
                          className="flex-1 bg-primary rounded-xl py-3 items-center"
                        >
                          <Text className="text-white font-semibold">Apply</Text>
                        </Pressable>
                      </View>
                    </View>
                  )}
                </>
              )}

              {/* DateTimePicker - Native iOS (Calendar) */}
              {Platform.OS === 'ios' && showDatePicker && (
                <View className="bg-gray-50 dark:bg-gray-800 rounded-xl p-2 mb-4" style={{ maxHeight: 350 }}>
                  <View style={{ transform: [{ scale: 0.85 }], marginTop: -10, marginBottom: -10 }}>
                    <DateTimePicker
                      value={dueDate || new Date()}
                      mode="date"
                      display="inline"
                      accentColor="#2563eb" // theme primary (V0 blue)
                      minimumDate={new Date()} // Prevent past dates
                      onChange={(event, selectedDate) => {
                        if (selectedDate) {
                          // Double check: ensure selected date is not in the past
                          const today = new Date();
                          today.setHours(0, 0, 0, 0);
                          const selected = new Date(selectedDate);
                          selected.setHours(0, 0, 0, 0);
                          
                          if (selected >= today) {
                            setDueDate(selectedDate);
                          } else {
                            showToast('error', '날짜 선택', '과거 날짜는 선택할 수 없습니다.');
                          }
                        }
                      }}
                    />
                  </View>
                  <View className="flex-row gap-3 mt-2">
                    <Pressable
                      onPress={() => {
                        if (Platform.OS === 'ios') {
                          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
                        }
                        setDueDate(null);
                        setDueTime(null);
                        setDueTimeEnd(null);
                        setShowDatePicker(false);
                      }}
                      className="flex-1 bg-white dark:bg-gray-900 rounded-xl py-3 items-center border border-gray-200 dark:border-gray-700"
                    >
                      <Text className="text-gray-700 dark:text-gray-300 font-semibold">
                        Cancel
                      </Text>
                    </Pressable>
                    <Pressable
                      onPress={() => {
                        if (Platform.OS === 'ios') {
                          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
                        }
                        setShowDatePicker(false);
                      }}
                      className="flex-1 bg-primary rounded-xl py-3 items-center"
                    >
                      <Text className="text-white font-semibold">Apply</Text>
                    </Pressable>
                  </View>
                </View>
              )}

              {Platform.OS === 'ios' && showTimePicker && (
                <View className="bg-gray-50 dark:bg-gray-800 rounded-xl p-2 mb-4" style={{ maxHeight: 250 }}>
                  <View style={{ transform: [{ scale: 0.85 }], marginTop: -10, marginBottom: -10 }}>
                    <DateTimePicker
                      value={timePickerValue ?? getDefaultTime()}
                      mode="time"
                      display="spinner"
                      minuteInterval={5}
                      onChange={(event, selectedTime) => {
                        if (selectedTime) {
                          setTimePickerValue(selectedTime);
                          setDueTime(selectedTime);
                        }
                      }}
                    />
                  </View>
                  <View className="flex-row gap-3 mt-2">
                    <Pressable
                      onPress={() => {
                        if (Platform.OS === 'ios') {
                          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
                        }
                        setDueTime(timeBeforeOpenRef.current);
                        setShowTimePicker(false);
                      }}
                      className="flex-1 bg-white dark:bg-gray-900 rounded-xl py-3 items-center border border-gray-200 dark:border-gray-700"
                    >
                      <Text className="text-gray-700 dark:text-gray-300 font-semibold">
                        Cancel
                      </Text>
                    </Pressable>
                    <Pressable
                      onPress={() => {
                        if (Platform.OS === 'ios') {
                          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
                        }
                        setDueTime(timePickerValue ?? getDefaultTime());
                        setShowTimePicker(false);
                      }}
                      className="flex-1 bg-primary rounded-xl py-3 items-center"
                    >
                      <Text className="text-white font-semibold">Apply</Text>
                    </Pressable>
                  </View>
                </View>
              )}

              {Platform.OS === 'ios' && showEndTimePicker && (
                <View className="bg-gray-50 dark:bg-gray-800 rounded-xl p-2 mb-4" style={{ maxHeight: 250 }}>
                  <View style={{ transform: [{ scale: 0.85 }], marginTop: -10, marginBottom: -10 }}>
                    <DateTimePicker
                      value={endTimePickerValue ?? dueTime ?? getDefaultTime()}
                      mode="time"
                      display="spinner"
                      minuteInterval={5}
                      onChange={(event, selectedTime) => {
                        if (selectedTime) {
                          setEndTimePickerValue(selectedTime);
                          setDueTimeEnd(selectedTime);
                        }
                      }}
                    />
                  </View>
                  <View className="flex-row gap-3 mt-2">
                    <Pressable
                      onPress={() => {
                        if (Platform.OS === 'ios') {
                          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
                        }
                        setDueTimeEnd(endTimeBeforeOpenRef.current);
                        setShowEndTimePicker(false);
                      }}
                      className="flex-1 bg-white dark:bg-gray-900 rounded-xl py-3 items-center border border-gray-200 dark:border-gray-700"
                    >
                      <Text className="text-gray-700 dark:text-gray-300 font-semibold">
                        Cancel
                      </Text>
                    </Pressable>
                    <Pressable
                      onPress={() => {
                        if (Platform.OS === 'ios') {
                          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
                        }
                        setDueTimeEnd(endTimePickerValue ?? dueTime ?? getDefaultTime());
                        setShowEndTimePicker(false);
                      }}
                      className="flex-1 bg-primary rounded-xl py-3 items-center"
                    >
                      <Text className="text-white font-semibold">Apply</Text>
                    </Pressable>
                  </View>
                </View>
              )}

              {/* DateTimePicker - Android */}
              {Platform.OS === 'android' && showDatePicker && (
                <DateTimePicker
                  value={dueDate || new Date()}
                  mode="date"
                  display="default"
                  minimumDate={new Date()} // Prevent past dates
                  onChange={(event, selectedDate) => {
                    setShowDatePicker(false);
                    if (event.type === 'set' && selectedDate) {
                      // Double check: ensure selected date is not in the past
                      const today = new Date();
                      today.setHours(0, 0, 0, 0);
                      const selected = new Date(selectedDate);
                      selected.setHours(0, 0, 0, 0);
                      
                      if (selected >= today) {
                        setDueDate(selectedDate);
                        // If date changed, notify parent for navigation
                        if (onDateChangeRef.current) {
                          const dateStr = format(selectedDate, 'yyyy-MM-dd');
                          if (task.due_date !== dateStr) {
                            onDateChangeRef.current(dateStr);
                          }
                        }
                      } else {
                        showToast('error', '날짜 선택', '과거 날짜는 선택할 수 없습니다.');
                      }
                    }
                  }}
                />
              )}

              {Platform.OS === 'android' && showTimePicker && (
                <DateTimePicker
                  value={dueTime || getDefaultTime()}
                  mode="time"
                  display="default"
                  minuteInterval={5}
                  onChange={(event, selectedTime) => {
                    setShowTimePicker(false);
                    if (event.type === 'set' && selectedTime) {
                      setDueTime(selectedTime);
                    }
                  }}
                />
              )}

              {Platform.OS === 'android' && showEndTimePicker && (
                <DateTimePicker
                  value={dueTimeEnd || dueTime || getDefaultTime()}
                  mode="time"
                  display="default"
                  minuteInterval={5}
                  onChange={(event, selectedTime) => {
                    setShowEndTimePicker(false);
                    if (event.type === 'set' && selectedTime) {
                      setDueTimeEnd(selectedTime);
                    }
                  }}
                />
              )}

              {/* Action Buttons - DatePicker가 열려있지 않을 때만 표시 */}
              {!showDatePicker && !showTimePicker && !showEndTimePicker && (
                <View className="flex-row gap-3 mt-2">
                  <Pressable
                    onPress={() => {
                      if (Platform.OS === 'ios') {
                        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
                      }
                      handleClose();
                    }}
                    className="flex-1 bg-gray-100 dark:bg-gray-800 rounded-xl py-4 items-center"
                    disabled={isSaving}
                  >
                    <Text className="text-gray-700 dark:text-gray-300 font-semibold">
                      Cancel
                    </Text>
                  </Pressable>

                  <Pressable
                    onPress={() => {
                      if (Platform.OS === 'ios') {
                        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
                      }
                      handleSave();
                    }}
                    className={`flex-1 bg-primary rounded-xl py-4 items-center ${
                      isSaving ? 'opacity-50' : ''
                    }`}
                    disabled={isSaving || !effectiveCanEdit}
                  >
                    <Text className="text-white font-semibold">
                      {isSaving ? 'Saving...' : 'Save'}
                    </Text>
                  </Pressable>
                </View>
              )}
            </View>
          </Pressable>
        </KeyboardAvoidingView>
      </Pressable>
    </Modal>
  );
}
