import { AppHeader } from '@/components/AppHeader';
import { DatePickerModal } from '@/components/DatePickerModal';
import { EmptyState } from '@/components/EmptyState';
import { colors, borderRadius, shadows, spacing } from '@/constants/colors';
import { deleteTask, updateTask } from '@/lib/api/tasks';
import { useBacklogTasks } from '@/lib/hooks/use-backlog-tasks';
import type { Task } from '@/lib/types';
import { useQueryClient } from '@tanstack/react-query';
import { addDays, format } from 'date-fns';
import * as Haptics from 'expo-haptics';
import { Calendar, Check, Package } from 'lucide-react-native';
import { useCallback, useState } from 'react';
import { ActionSheetIOS, ActivityIndicator, Alert, Dimensions, FlatList, Platform, Pressable, RefreshControl, SafeAreaView, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { Swipeable, TapGestureHandler, LongPressGestureHandler, State } from 'react-native-gesture-handler';

const SCREEN_WIDTH = Dimensions.get('window').width;
const SCREEN_HEIGHT = Dimensions.get('window').height;
const HEADER_HEIGHT = 60;
const TITLE_BAR_HEIGHT = 90;
const AVAILABLE_HEIGHT = SCREEN_HEIGHT - HEADER_HEIGHT - TITLE_BAR_HEIGHT;

export default function BacklogScreen() {
  const { tasks, isLoading, isError, error, refetch } = useBacklogTasks();
  const [isDatePickerVisible, setIsDatePickerVisible] = useState(false);
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const queryClient = useQueryClient();

  const handleNotificationPress = () => {
    Alert.alert('Notifications', 'Notification feature coming soon!');
  };

  // Pull-to-Refresh handler
  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await refetch();
    setRefreshing(false);
  }, [refetch]);

  // Auto-refresh on focus (silent update)
  useFocusEffect(
    useCallback(() => {
      // Silently refetch when screen comes into focus
      refetch();
    }, [refetch])
  );

  const handleScheduleTask = async (taskId: string, dateStr: string) => {
    await updateTask({ id: taskId, due_date: dateStr, original_due_date: dateStr });
    queryClient.invalidateQueries({ queryKey: ['tasks', 'backlog'] });
    queryClient.invalidateQueries({ queryKey: ['tasks', 'timeline'] });
    
    // Show confirmation
    if (Platform.OS === 'web') {
      alert('Task scheduled!');
    } else {
      Alert.alert('Scheduled', 'Task has been scheduled');
    }
  };

  const handleSwipeRight = (taskId: string) => {
    setSelectedTaskId(taskId);
    setIsDatePickerVisible(true);
  };

  const handleDateSelect = (dateStr: string) => {
    if (selectedTaskId) {
      handleScheduleTask(selectedTaskId, dateStr);
      setSelectedTaskId(null);
    }
  };

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
                      onSchedule={(dateStr) => handleScheduleTask(item.id, dateStr)}
                      onSwipeSchedule={() => handleSwipeRight(item.id)}
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
                        onSchedule={(dateStr) => handleScheduleTask(item.id, dateStr)}
                        onSwipeSchedule={() => handleSwipeRight(item.id)}
                      />
                    ))}
                </View>
              </View>
            )}
          </ScrollView>
        )}
      </View>

      {/* Date Picker Modal */}
      <DatePickerModal
        visible={isDatePickerVisible}
        onClose={() => {
          setIsDatePickerVisible(false);
          setSelectedTaskId(null);
        }}
        onSelectDate={handleDateSelect}
        title="Schedule Task"
      />
    </SafeAreaView>
  );
}

// Backlog Item Component
function BacklogItem({
  task,
  onSchedule,
  onSwipeSchedule,
}: {
  task: Task;
  onSchedule: (dateStr: string) => void;
  onSwipeSchedule: () => void;
}) {
  const queryClient = useQueryClient();
  const [isDatePickerVisible, setIsDatePickerVisible] = useState(false);
  const isDone = task.status === 'DONE';

  const handleToggleComplete = async () => {
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    const newStatus = task.status === 'DONE' ? 'TODO' : 'DONE';
    
    // Prepare updates
    const updates: any = { status: newStatus };

    // If unchecking (DONE -> TODO) and task has no due_date, assign today's date
    if (newStatus === 'TODO' && !task.due_date) {
      const todayStr = format(new Date(), 'yyyy-MM-dd');
      updates.due_date = todayStr;
      updates.original_due_date = todayStr;
    }
    
    await updateTask({ id: task.id, ...updates });
    queryClient.invalidateQueries({ queryKey: ['tasks', 'backlog'] });
    queryClient.invalidateQueries({ queryKey: ['tasks', 'timeline'] });

    if (newStatus === 'DONE') {
      if (Platform.OS === 'web') {
        alert('Moved to today\'s completed list');
      } else {
        Alert.alert('Completed', 'Moved to today\'s completed list');
      }
    } else if (newStatus === 'TODO' && !task.due_date) {
      // Unchecked and assigned to today
      if (Platform.OS === 'web') {
        alert('Scheduled for today');
      } else {
        Alert.alert('Scheduled', 'Scheduled for today');
      }
    }
  };

  const handleLongPress = async () => {
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);

    const today = format(new Date(), 'yyyy-MM-dd');
    const tomorrow = format(addDays(new Date(), 1), 'yyyy-MM-dd');

    if (Platform.OS === 'ios') {
      ActionSheetIOS.showActionSheetWithOptions(
        {
          title: 'Schedule Task',
          options: ['Do Today', 'Do Tomorrow', 'Pick Date', 'Delete', 'Cancel'],
          destructiveButtonIndex: 3,
          cancelButtonIndex: 4,
        },
        async (buttonIndex) => {
          if (buttonIndex === 0) {
            await handleScheduleTask(today);
          } else if (buttonIndex === 1) {
            await handleScheduleTask(tomorrow);
          } else if (buttonIndex === 2) {
            setIsDatePickerVisible(true);
          } else if (buttonIndex === 3) {
            Alert.alert(
              'Delete Task',
              'Are you sure you want to delete this task?',
              [
                { text: 'Cancel', style: 'cancel' },
                {
                  text: 'Delete',
                  style: 'destructive',
                  onPress: async () => {
                    await deleteTask(task.id);
                    queryClient.invalidateQueries({ queryKey: ['tasks', 'backlog'] });
                  },
                },
              ]
            );
          }
        }
      );
    } else {
      if (Platform.OS === 'web') {
        const action = prompt('Schedule Task:\n1: Do Today\n2: Do Tomorrow\n3: Pick Date\n4: Delete\n0: Cancel');
        
        if (action === '1') {
          await handleScheduleTask(today);
        } else if (action === '2') {
          await handleScheduleTask(tomorrow);
        } else if (action === '3') {
          setIsDatePickerVisible(true);
        } else if (action === '4') {
          if (confirm('Are you sure you want to delete this task?')) {
            await deleteTask(task.id);
            queryClient.invalidateQueries({ queryKey: ['tasks', 'backlog'] });
          }
        }
      } else {
        Alert.alert(
          'Schedule Task',
          '',
          [
            {
              text: 'Do Today',
              onPress: async () => await handleScheduleTask(today),
            },
            {
              text: 'Do Tomorrow',
              onPress: async () => await handleScheduleTask(tomorrow),
            },
            {
              text: 'Pick Date',
              onPress: () => setIsDatePickerVisible(true),
            },
            {
              text: 'Delete',
              style: 'destructive',
              onPress: () => {
                Alert.alert(
                  'Delete Task',
                  'Are you sure you want to delete this task?',
                  [
                    { text: 'Cancel', style: 'cancel' },
                    {
                      text: 'Delete',
                      style: 'destructive',
                      onPress: async () => {
                        await deleteTask(task.id);
                        queryClient.invalidateQueries({ queryKey: ['tasks', 'backlog'] });
                      },
                    },
                  ]
                );
              },
            },
            {
              text: 'Cancel',
              style: 'cancel',
            },
          ]
        );
      }
    }
  };

  const handleScheduleTask = async (dateStr: string) => {
    await updateTask({ 
      id: task.id, 
      due_date: dateStr,
      original_due_date: dateStr,
    });
    queryClient.invalidateQueries({ queryKey: ['tasks', 'backlog'] });
    queryClient.invalidateQueries({ queryKey: ['tasks', 'timeline'] });
  };

  // Render right swipe action (Schedule - Send to Timeline)
  const renderRightActions = () => (
    <View 
      style={{ 
        backgroundColor: colors.primary, 
        width: 70,
        justifyContent: 'center',
        alignItems: 'center',
        borderTopRightRadius: borderRadius.lg,
        borderBottomRightRadius: borderRadius.lg,
      }}
    >
      <Calendar size={20} color="#FFFFFF" strokeWidth={2} />
    </View>
  );

  const onTap = (event: any) => {
    if (event.nativeEvent.state === State.END) {
      handleToggleComplete();
    }
  };

  const onLongPress = (event: any) => {
    if (event.nativeEvent.state === State.ACTIVE) {
      handleLongPress();
    }
  };

  return (
    <>
      <View
        style={[
          styles.card,
          isDone && { backgroundColor: `${colors.gray100}80` }, // Muted background for completed
        ]}
      >
        <Swipeable
          renderRightActions={renderRightActions}
          onSwipeableOpen={() => onSwipeSchedule()}
          overshootRight={false}
          enabled={!isDone}
        >
          <LongPressGestureHandler
            onHandlerStateChange={onLongPress}
            minDurationMs={500}
          >
            <TapGestureHandler
              onHandlerStateChange={onTap}
              maxDist={10}
            >
              <View style={{ flex: 1 }}>
                <View style={{ 
                  flexDirection: 'row', 
                  alignItems: 'center', 
                  gap: 12,
                  paddingHorizontal: 16,
                  paddingVertical: 16,
                }}>
                  {/* Checkbox - Larger and more prominent */}
                  <Pressable
                    onPress={handleToggleComplete}
                    style={[
                      {
                        width: 24,
                        height: 24,
                        borderRadius: borderRadius.full,
                        borderWidth: 2,
                        flexShrink: 0,
                        alignItems: 'center',
                        justifyContent: 'center',
                      },
                      isDone && {
                        backgroundColor: colors.success,
                        borderColor: colors.success,
                      },
                      !isDone && {
                        borderColor: `${colors.textSub}4D`, // 30% opacity
                      },
                    ]}
                    hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                  >
                    {isDone && (
                      <Check size={14} color="#FFFFFF" strokeWidth={3} />
                    )}
                  </Pressable>

                  {/* Task Title - 2 lines max */}
                  <Text 
                    style={[
                      {
                        fontSize: 15,
                        flex: 1,
                        lineHeight: 22,
                      },
                      isDone && {
                        color: colors.textSub,
                        textDecorationLine: 'line-through',
                      },
                      !isDone && {
                        color: colors.textMain,
                      },
                    ]}
                    numberOfLines={2}
                  >
                    {task.title}
                  </Text>

                  {/* Calendar Button */}
                  <Pressable
                    onPress={() => setIsDatePickerVisible(true)}
                    style={[
                      {
                        width: 36,
                        height: 36,
                        borderRadius: borderRadius.md,
                        alignItems: 'center',
                        justifyContent: 'center',
                        flexShrink: 0,
                      },
                      !isDone && {
                        backgroundColor: 'transparent',
                      },
                    ]}
                    hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                  >
                    <Calendar 
                      size={20} 
                      color={isDone ? colors.textSub : colors.textSub} 
                      strokeWidth={2} 
                    />
                  </Pressable>
                </View>
              </View>
            </TapGestureHandler>
          </LongPressGestureHandler>
        </Swipeable>
      </View>

      {/* Date Picker Modal for this item */}
      <DatePickerModal
        visible={isDatePickerVisible}
        onClose={() => setIsDatePickerVisible(false)}
        onSelectDate={(dateStr) => {
          handleScheduleTask(dateStr);
          setIsDatePickerVisible(false);
        }}
        title="Schedule Task"
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
