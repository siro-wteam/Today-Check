import { AppHeader } from '@/components/AppHeader';
import { DatePickerModal } from '@/components/DatePickerModal';
import { colors, borderRadius, shadows, spacing } from '@/constants/colors';
import { deleteTask, updateTask } from '@/lib/api/tasks';
import { useBacklogTasks } from '@/lib/hooks/use-backlog-tasks';
import type { Task } from '@/lib/types';
import { useQueryClient } from '@tanstack/react-query';
import { addDays, format } from 'date-fns';
import * as Haptics from 'expo-haptics';
import { Archive, Calendar } from 'lucide-react-native';
import { useCallback, useState } from 'react';
import { ActionSheetIOS, ActivityIndicator, Alert, Dimensions, FlatList, Platform, Pressable, RefreshControl, SafeAreaView, StyleSheet, Text, View } from 'react-native';
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
          <Text className="text-4xl mb-4">⚠️</Text>
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
            <Text className="text-white font-semibold">Try Again</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <AppHeader onNotificationPress={handleNotificationPress} />

      {/* Title Bar */}
      <View 
        style={[
          styles.titleBar,
          Platform.OS === 'web' && { maxWidth: 600, width: '100%', alignSelf: 'center' }
        ]}
      >
        <Text style={styles.title}>
          No Due Date
        </Text>
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
          <View className="flex-1 items-center justify-center px-6">
            <Text className="text-6xl mb-4">💡</Text>
            <Text style={[styles.textMain, { fontSize: 20, fontWeight: '600', marginBottom: 8, textAlign: 'center' }]}>
              Your backlog is empty
            </Text>
            <Text style={[styles.textSub, { textAlign: 'center', fontSize: 16 }]}>
              Add ideas and tasks without dates here.{'\n'}Schedule them when you're ready!
            </Text>
          </View>
        ) : (
          <FlatList
            data={tasks}
            keyExtractor={(item) => item.id}
            renderItem={({ item }) => (
              <BacklogItem
                task={item}
                onSchedule={(dateStr) => handleScheduleTask(item.id, dateStr)}
                onSwipeSchedule={() => handleSwipeRight(item.id)}
              />
            )}
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
          />
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
        alert('오늘의 완료 목록으로 이동됨');
      } else {
        Alert.alert('Completed', '오늘의 완료 목록으로 이동됨');
      }
    } else if (newStatus === 'TODO' && !task.due_date) {
      // Unchecked and assigned to today
      if (Platform.OS === 'web') {
        alert('오늘 할 일로 배정됨');
      } else {
        Alert.alert('Scheduled', '오늘 할 일로 배정됨');
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
          { backgroundColor: colors.card }
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
                paddingVertical: 12,
              }}>
                {/* Checkbox */}
                <View 
                  style={[
                    {
                      width: 20,
                      height: 20,
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
                      borderColor: colors.gray300,
                    },
                  ]}
                >
                  {isDone && (
                    <Text style={{ color: '#fff', fontSize: 12, fontWeight: '600' }}>✓</Text>
                  )}
                </View>

                {/* Task Title */}
                <Text 
                  style={[
                    {
                      fontSize: 16,
                      flex: 1,
                    },
                    isDone && {
                      color: colors.textSub,
                      textDecorationLine: 'line-through',
                    },
                    !isDone && {
                      color: colors.textMain,
                      fontWeight: '500',
                    },
                  ]}
                  numberOfLines={2}
                >
                  {task.title}
                </Text>

                {/* Swipe hint icon */}
                <Calendar size={16} color={colors.textSub} strokeWidth={2} />
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
  titleBar: {
    backgroundColor: colors.card,
    paddingHorizontal: 24,
    paddingVertical: 14, // Match Home header padding
    minHeight: 68, // Match Home header actual height (24px icon + 8px*2 button padding + 14px*2 vertical padding = 68px)
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    justifyContent: 'center', // Center content vertically
    alignItems: 'center', // Center content horizontally
  },
  title: {
    fontSize: 18, // Match Home header font size
    fontWeight: '600', // Match Home header font weight
    color: colors.textMain,
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
    borderRadius: borderRadius.lg,
    marginBottom: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
    ...shadows.sm,
  },
});
