import { AppHeader } from '@/components/AppHeader';
import { colors, borderRadius, shadows, spacing } from '@/constants/colors';
import { updateTask } from '@/lib/api/tasks';
import { signOut } from '@/lib/hooks/use-auth';
import { useTimelineTasks } from '@/lib/hooks/use-timeline-tasks';
import type { Task } from '@/lib/types';
import { useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { Archive, ChevronLeft, ChevronRight } from 'lucide-react-native';
import { addWeeks, differenceInCalendarDays, eachDayOfInterval, endOfWeek, format, parseISO, startOfDay, startOfWeek, subWeeks } from 'date-fns';
import { ActivityIndicator, Alert, Dimensions, FlatList, Platform, Pressable, RefreshControl, SafeAreaView, ScrollView, StyleSheet, Text, View, ViewToken } from 'react-native';
import { Swipeable, TapGestureHandler, State } from 'react-native-gesture-handler';
import { useFocusEffect } from '@react-navigation/native';
import { useCallback, useEffect, useRef, useState } from 'react';
import Animated from 'react-native-reanimated';

const SCREEN_WIDTH = Dimensions.get('window').width;
const SCREEN_HEIGHT = Dimensions.get('window').height;
const HEADER_HEIGHT = 60; // AppHeader height
const NAVIGATOR_HEIGHT = 70; // Week navigator height
const AVAILABLE_HEIGHT = SCREEN_HEIGHT - HEADER_HEIGHT - NAVIGATOR_HEIGHT;

interface TaskWithOverdue extends Task {
  isOverdue?: boolean;
  daysOverdue?: number;
}

interface DailyGroup {
  date: string; // yyyy-MM-dd
  dateObj: Date;
  displayDate: string; // "Jan 20 (Tue)"
  tasks: TaskWithOverdue[];
  completedCount: number;
  totalCount: number;
}

interface WeekPage {
  weekStart: Date;
  weekEnd: Date;
  weekStartStr: string;
  weekEndStr: string;
  displayRange: string; // "Jan 19 - Jan 25"
  dailyGroups: DailyGroup[];
}

export default function WeekScreen() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { tasks, isLoading, isError, error, refetch } = useTimelineTasks();
  
  const flatListRef = useRef<FlatList>(null);
  const [currentWeekIndex, setCurrentWeekIndex] = useState(2); // This week is at index 2
  const [currentWeekDisplay, setCurrentWeekDisplay] = useState('');
  const [refreshing, setRefreshing] = useState(false);

  // Generate week pages: This week -2 to +2 (5 weeks total)
  const generateWeekPages = useCallback((): WeekPage[] => {
    const today = startOfDay(new Date()); // Use start of day for accurate comparison
    const weeks: WeekPage[] = [];

    for (let offset = -2; offset <= 2; offset++) {
      const targetWeek = addWeeks(today, offset);
      const weekStart = startOfWeek(targetWeek, { weekStartsOn: 1 }); // Monday
      const weekEnd = endOfWeek(targetWeek, { weekStartsOn: 1 }); // Sunday

      const weekStartStr = format(weekStart, 'yyyy-MM-dd');
      const weekEndStr = format(weekEnd, 'yyyy-MM-dd');
      const displayRange = `${format(weekStart, 'MMM d')} - ${format(weekEnd, 'MMM d')}`;

      // Generate daily groups for this week
      const todayStr = format(today, 'yyyy-MM-dd');
      const dailyGroups: DailyGroup[] = eachDayOfInterval({
        start: weekStart,
        end: weekEnd,
      }).map((date) => {
        const dateStr = format(date, 'yyyy-MM-dd');
        const isToday = dateStr === todayStr;
        
        // Filter tasks for this date
        const dayTasks: TaskWithOverdue[] = [];

        tasks.forEach((task) => {
          if (task.status === 'DONE') {
            // DONE tasks: Group by completed_at
            if (!task.completed_at) return;
            const completedDateStr = format(parseISO(task.completed_at), 'yyyy-MM-dd');
            if (completedDateStr === dateStr) {
              dayTasks.push(task);
            }
          } else if (task.status === 'TODO') {
            // TODO tasks: Check if overdue
            if (!task.due_date) return;
            
            const taskDueDate = parseISO(task.due_date);
            const isTaskOverdue = taskDueDate < today;

            if (isTaskOverdue) {
              // Overdue TODO: Move to TODAY
              if (isToday) {
                const daysOverdue = differenceInCalendarDays(today, taskDueDate);
                dayTasks.push({
                  ...task,
                  isOverdue: true,
                  daysOverdue,
                });
              }
            } else {
              // Not overdue: Show on original due_date
              if (task.due_date === dateStr) {
                dayTasks.push(task);
              }
            }
          } else {
            // CANCEL or other: Group by due_date
            if (task.due_date === dateStr) {
              dayTasks.push(task);
            }
          }
        });

        // Sort tasks by date/time (maintain position when status changes)
        dayTasks.sort((a, b) => {
          // For overdue tasks, use original_due_date if available
          const aDateStr = a.original_due_date || a.due_date || a.created_at;
          const bDateStr = b.original_due_date || b.due_date || b.created_at;
          
          const aDate = parseISO(aDateStr);
          const bDate = parseISO(bDateStr);
          
          const timeDiff = aDate.getTime() - bDate.getTime();
          if (timeDiff !== 0) return timeDiff;
          
          // If same date, sort by time
          if (a.due_time && b.due_time) {
            return a.due_time.localeCompare(b.due_time);
          }
          
          // Finally by created_at
          return a.created_at.localeCompare(b.created_at);
        });

        const completedCount = dayTasks.filter((t) => t.status === 'DONE').length;
        const totalCount = dayTasks.length;

        return {
          date: dateStr,
          dateObj: date,
          displayDate: format(date, 'MMM d (EEE)'),
          tasks: dayTasks,
          completedCount,
          totalCount,
        };
      });

      weeks.push({
        weekStart,
        weekEnd,
        weekStartStr,
        weekEndStr,
        displayRange,
        dailyGroups,
      });
    }

    return weeks;
  }, [tasks]);

  const weekPages = generateWeekPages();

  // Auto scroll to this week on initial load
  useEffect(() => {
    if (!isLoading && weekPages.length > 0) {
      setTimeout(() => {
        flatListRef.current?.scrollToIndex({
          index: 2, // This week is at index 2
          animated: false,
        });
      }, 100);
    }
  }, [isLoading, weekPages.length]);

  // Track current visible week
  const onViewableItemsChanged = useRef(({ viewableItems }: { viewableItems: ViewToken[] }) => {
    if (viewableItems.length > 0) {
      const visibleItem = viewableItems[0];
      const index = visibleItem.index || 0;
      setCurrentWeekIndex(index);
      setCurrentWeekDisplay((weekPages[index] as WeekPage)?.displayRange || '');
    }
  }).current;

  const viewabilityConfig = {
    itemVisiblePercentThreshold: 50,
  };

  // Navigation functions
  const goToPreviousWeek = useCallback(() => {
    if (currentWeekIndex > 0) {
      flatListRef.current?.scrollToIndex({
        index: currentWeekIndex - 1,
        animated: true,
      });
    }
  }, [currentWeekIndex]);

  const goToNextWeek = useCallback(() => {
    if (currentWeekIndex < weekPages.length - 1) {
      flatListRef.current?.scrollToIndex({
        index: currentWeekIndex + 1,
        animated: true,
      });
    }
  }, [currentWeekIndex, weekPages.length]);

  const handleNotificationPress = () => {
    Alert.alert('Notifications', 'Notification feature coming soon!');
  };

  const currentWeekPage = weekPages[currentWeekIndex];

  const handleDateCardPress = (dateStr: string) => {
    // Open Day modal with specific date (with shared element animation)
    router.push({
      pathname: '/day',
      params: { jumpToDate: dateStr },
    });
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

  const renderWeekPage = ({ item }: { item: WeekPage }) => {
    const pageWidth = Platform.OS === 'web' ? Math.min(SCREEN_WIDTH, 600) : SCREEN_WIDTH;
    
    return (
      <View 
        style={{
          width: pageWidth,
          height: Platform.OS === 'web' ? AVAILABLE_HEIGHT : undefined,
          backgroundColor: colors.background,
          flex: Platform.OS === 'web' ? undefined : 1,
        }}
      >
        {/* Weekly List (Vertical scroll inside week page) */}
        <ScrollView 
          style={Platform.OS === 'web' ? { 
            height: AVAILABLE_HEIGHT,
            overflow: 'auto' as any,
          } : { flex: 1 }}
          contentContainerStyle={{
            paddingHorizontal: 16,
            paddingVertical: 16,
            paddingBottom: Platform.OS === 'web' ? 200 : 120, // Increased for tab bar clearance
            ...(Platform.OS === 'web' 
              ? { minHeight: 'auto', height: 'auto' } 
              : { flexGrow: 0 }), // Web: auto height, Native: don't grow
          }}
          showsVerticalScrollIndicator={Platform.OS === 'web'}
          scrollEnabled={true}
          bounces={true}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor={colors.primary}
              colors={[colors.primary]}
            />
          }
        >
          {item.dailyGroups.map((group) => (
            <DailyCard
              key={group.date}
              group={group}
              onPress={() => handleDateCardPress(group.date)}
            />
          ))}
        </ScrollView>
      </View>
    );
  };

  if (isLoading) {
    return (
      <SafeAreaView style={styles.container}>
        <AppHeader onNotificationPress={handleNotificationPress} />
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={[styles.textSub, { marginTop: 16 }]}>
            Loading weeks...
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
            Failed to load weeks
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

      {/* Week Navigator */}
      <View 
        style={[
          {
            backgroundColor: colors.card,
            paddingHorizontal: 24,
            paddingVertical: 14,
            borderBottomWidth: 1,
            borderBottomColor: colors.border,
          },
          Platform.OS === 'web' && { maxWidth: 600, width: '100%', alignSelf: 'center' },
        ]}
      >
        <View className="flex-row items-center justify-between">
          {/* Previous Week Button */}
          <Pressable
            onPress={goToPreviousWeek}
            disabled={currentWeekIndex === 0}
            className="p-2 rounded-lg active:opacity-70"
            style={{ opacity: currentWeekIndex === 0 ? 0.3 : 1 }}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <ChevronLeft size={24} color={colors.textSub} strokeWidth={2} />
          </Pressable>

          {/* Week Range Display */}
          <View className="items-center">
            <Text style={{ fontSize: 18, fontWeight: '600', color: colors.textMain }}>
              {currentWeekDisplay}
            </Text>
          </View>

          {/* Next Week Button */}
          <Pressable
            onPress={goToNextWeek}
            disabled={currentWeekIndex === weekPages.length - 1}
            className="p-2 rounded-lg active:opacity-70"
            style={{ opacity: currentWeekIndex === weekPages.length - 1 ? 0.3 : 1 }}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <ChevronRight size={24} color={colors.textSub} strokeWidth={2} />
          </Pressable>
        </View>
      </View>

      {/* Horizontal Week Paging View */}
      <View 
        style={{
          flex: 1,
          height: Platform.OS === 'web' ? AVAILABLE_HEIGHT : undefined,
          ...(Platform.OS === 'web' && { maxWidth: 600, width: '100%', alignSelf: 'center' }),
        }}
      >
        <FlatList
          ref={flatListRef}
          data={weekPages}
          renderItem={renderWeekPage}
          keyExtractor={(item) => item.weekStartStr}
          horizontal
          pagingEnabled
          showsHorizontalScrollIndicator={false}
          nestedScrollEnabled={true}
          scrollEnabled={true}
          directionalLockEnabled={false}
          onViewableItemsChanged={onViewableItemsChanged}
          viewabilityConfig={viewabilityConfig}
          getItemLayout={(data, index) => ({
            length: Platform.OS === 'web' ? Math.min(SCREEN_WIDTH, 600) : SCREEN_WIDTH,
            offset: (Platform.OS === 'web' ? Math.min(SCREEN_WIDTH, 600) : SCREEN_WIDTH) * index,
            index,
          })}
          initialScrollIndex={2}
          onScrollToIndexFailed={(info) => {
            setTimeout(() => {
              flatListRef.current?.scrollToIndex({
                index: info.index,
                animated: false,
              });
            }, 100);
          }}
        />
      </View>
    </SafeAreaView>
  );
}

// Daily Card Component
function DailyCard({ group, onPress }: { group: DailyGroup; onPress: () => void }) {
  const queryClient = useQueryClient();
  const todayDate = startOfDay(new Date());
  const today = format(todayDate, 'yyyy-MM-dd');
  const isToday = group.date === today;
  const isPast = group.dateObj < todayDate;

  // Show all tasks - ensure it's always an array
  const visibleTasks = Array.isArray(group.tasks) ? group.tasks : [];

  const handleToggleComplete = async (task: TaskWithOverdue) => {
    // Haptic feedback for instant response
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

    // Toggle status: TODO ↔ DONE
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
    
    // Refetch timeline data
    queryClient.invalidateQueries({ queryKey: ['tasks', 'timeline'] });
  };

  const handleSendToBacklog = async (task: TaskWithOverdue) => {
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    
    // Update task: set due_date to null
    await updateTask({ 
      id: task.id, 
      due_date: null,
      original_due_date: null,
    });
    
    // Invalidate queries to refresh UI
    queryClient.invalidateQueries({ queryKey: ['tasks', 'timeline'] });
    
    // Show toast message
    if (Platform.OS === 'web') {
      alert('Task moved to Backlog');
    } else {
      Alert.alert('Moved', 'Task moved to Backlog');
    }
  };

  const renderLeftActions = () => (
    <View
      style={{
        width: 70,
        height: '100%',
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: colors.textSub,
        borderTopLeftRadius: borderRadius.lg,
        borderBottomLeftRadius: borderRadius.lg,
      }}
    >
      <Archive size={20} color="#FFFFFF" strokeWidth={2} />
    </View>
  );

  return (
    <Animated.View
      style={[
        styles.card,
        isToday && styles.cardToday,
        isToday && { backgroundColor: '#EFF6FF' }, // Very light blue for today
        { 
          ...(Platform.OS === 'web' 
            ? { width: '100%', minHeight: 'auto' } 
            : { flex: 0, alignSelf: 'stretch' }), // Web: explicit width, Native: flex
        },
      ]}
      sharedTransitionTag={`day-card-${group.date}`}
    >
      {/* Card Header - Navigation to Day view */}
      <Pressable
        onPress={onPress}
        className="active:opacity-70"
        style={[
          {
            paddingHorizontal: 16,
            paddingTop: 16,
            paddingBottom: 12,
            borderBottomWidth: 1,
            borderBottomColor: colors.border,
            borderTopLeftRadius: borderRadius.lg, // Match card's top-left corner
            borderTopRightRadius: borderRadius.lg, // Match card's top-right corner
          },
          isToday && { backgroundColor: '#EFF6FF' }, // Light blue header for today
        ]}
      >
        <View className="flex-row items-center justify-between">
          <View className="flex-row items-center gap-2 flex-1">
            <Text 
              style={{
                fontSize: 16,
                fontWeight: '600',
                color: isToday ? colors.primary : isPast ? colors.textSub : colors.textMain,
              }}
            >
              {String(group.displayDate)}{isToday ? ' (Today)' : ''}
            </Text>

            {/* Completion Badge */}
            {group.totalCount > 0 ? (
              <View 
                style={{
                  backgroundColor: group.completedCount === group.totalCount ? '#D1FAE5' : colors.gray100,
                  paddingHorizontal: 8,
                  paddingVertical: 4,
                  borderRadius: borderRadius.sm,
                }}
              >
                <Text 
                  style={{
                    fontSize: 12,
                    fontWeight: '600',
                    color: group.completedCount === group.totalCount ? colors.success : colors.textSub,
                  }}
                >
                  {String(group.completedCount)}/{String(group.totalCount)}
                </Text>
              </View>
            ) : null}
          </View>

          {/* Navigation hint - Chevron */}
          <ChevronRight size={16} color={colors.textSub} strokeWidth={2} />
        </View>
      </Pressable>

      {/* Card Body - Task List */}
      <View className="px-4 py-3">
        {visibleTasks.length === 0 ? (
          <Text className="text-sm text-gray-400 dark:text-gray-600 italic">
            No tasks
          </Text>
        ) : (
          <View>
            {visibleTasks.map((task) => {
              const isDone = task.status === 'DONE';
              const isCancelled = task.status === 'CANCEL';
              const isTodo = task.status === 'TODO';
              const isOverdue = task.isOverdue === true && task.daysOverdue && task.daysOverdue > 0;
              
              // Calculate late completion
              const isLateCompletion = isDone && task.completed_at && task.due_date 
                ? (() => {
                    const completedDate = parseISO(task.completed_at);
                    const dueDate = parseISO(task.due_date);
                    const daysLate = differenceInCalendarDays(completedDate, dueDate);
                    return daysLate > 0 ? daysLate : 0;
                  })()
                : 0;

              // Format time
              const formatTime = (time: string | null) => {
                if (!time) return null;
                return time.substring(0, 5);
              };

              return (
                <View
                  key={task.id}
                  style={[
                    styles.weekTaskCard,
                    isOverdue && isTodo && styles.weekTaskCardOverdue,
                  ]}
                >
                  <Swipeable
                    renderLeftActions={isTodo ? renderLeftActions : undefined}
                    onSwipeableOpen={() => handleSendToBacklog(task)}
                    overshootLeft={false}
                    enabled={isTodo}
                  >
                    <TapGestureHandler
                      onHandlerStateChange={(event) => {
                        if (event.nativeEvent.state === State.END) {
                          handleToggleComplete(task);
                        }
                      }}
                      maxDist={10}
                    >
                      <View style={{ flex: 1 }}>
                        <View style={{ 
                          flexDirection: 'row', 
                          alignItems: 'center', 
                          paddingHorizontal: 16, 
                          paddingVertical: 12, 
                          gap: 12 
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
                              isCancelled && {
                                backgroundColor: colors.gray300,
                                borderColor: colors.gray300,
                              },
                              !isDone && !isCancelled && {
                                borderColor: colors.gray300,
                              },
                            ]}
                          >
                            {isDone && (
                              <Text style={{ color: '#fff', fontSize: 12, fontWeight: '600' }}>✓</Text>
                            )}
                            {isCancelled && (
                              <Text style={{ color: '#fff', fontSize: 12, fontWeight: '600' }}>✕</Text>
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
                              isCancelled && {
                                color: colors.textDisabled,
                                textDecorationLine: 'line-through',
                              },
                              !isDone && !isCancelled && {
                                color: colors.textMain,
                                fontWeight: '500',
                              },
                            ]}
                          >
                            {task.title || '(Untitled)'}
                          </Text>

                          {/* Badges */}
                          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, flexShrink: 0 }}>
                            {/* Time Badge */}
                            {task.due_time && (
                              <View style={{
                                backgroundColor: colors.gray100,
                                paddingHorizontal: 8,
                                paddingVertical: 4,
                                borderRadius: borderRadius.sm,
                              }}>
                                <Text style={{
                                  fontSize: 12,
                                  fontWeight: '500',
                                  color: isDone || isCancelled ? colors.textDisabled : colors.textSub,
                                }}>
                                  {formatTime(task.due_time)}
                                </Text>
                              </View>
                            )}

                            {/* From Backlog Badge - for DONE tasks without due_date */}
                            {isDone && !task.due_date && (
                              <View style={{
                                backgroundColor: colors.gray100,
                                paddingHorizontal: 8,
                                paddingVertical: 4,
                                borderRadius: borderRadius.sm,
                              }}>
                                <Text style={{
                                  fontSize: 12,
                                  fontWeight: '500',
                                  color: colors.textSub,
                                }}>
                                  📦 From Backlog
                                </Text>
                              </View>
                            )}

                            {/* Late Completion Badge - for DONE tasks completed after due_date */}
                            {isLateCompletion > 0 && (
                              <View style={{
                                backgroundColor: colors.warning,
                                paddingHorizontal: 8,
                                paddingVertical: 4,
                                borderRadius: borderRadius.sm,
                              }}>
                                <Text style={{ color: '#fff', fontSize: 12, fontWeight: '600' }}>
                                  Late +{isLateCompletion}d
                                </Text>
                              </View>
                            )}

                            {/* Rollover Badge - only for overdue TODO items */}
                            {isOverdue && isTodo && (
                              <View style={{
                                backgroundColor: colors.error,
                                paddingHorizontal: 8,
                                paddingVertical: 4,
                                borderRadius: borderRadius.sm,
                              }}>
                                <Text style={{ color: '#fff', fontSize: 12, fontWeight: '600' }}>
                                  +{task.daysOverdue}d
                                </Text>
                              </View>
                            )}
                          </View>
                        </View>
                      </View>
                    </TapGestureHandler>
                  </Swipeable>
                </View>
              );
            })}
          </View>
        )}
      </View>
    </Animated.View>
  );
}

// Modern Minimalist Styles
const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
    ...(Platform.OS === 'web' && { height: '100vh' }),
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
    overflow: 'hidden', // Ensure rounded corners are preserved
  },
  cardToday: {
    borderColor: colors.primary,
    borderWidth: 2,
  },
  weekTaskCard: {
    backgroundColor: colors.card,
    borderRadius: borderRadius.lg,
    marginBottom: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
    ...shadows.sm,
  },
  weekTaskCardOverdue: {
    backgroundColor: '#FEF2F2', // Very light red
    borderColor: colors.error,
  },
});
