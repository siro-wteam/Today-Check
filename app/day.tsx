// AppHeader removed for modal presentation
import { EmptyState } from '@/components/EmptyState';
import { EditTaskBottomSheet } from '@/components/EditTaskBottomSheet';
import { AddTaskModal } from '@/components/AddTaskModal';
import { colors, borderRadius, shadows, spacing } from '@/constants/colors';
import { validateStateTransition } from '@/lib/api/task-state-machine';
import { deleteTask, updateTask } from '@/lib/api/tasks';
import { useAuth } from '@/lib/hooks/use-auth';
import { useTimelineTasks } from '@/lib/hooks/use-timeline-tasks';
import type { TaskStatus, TaskWithRollover } from '@/lib/types';
import { useQueryClient } from '@tanstack/react-query';
import { addDays, differenceInCalendarDays, eachDayOfInterval, format, parseISO, startOfDay, subDays } from 'date-fns';
import * as Haptics from 'expo-haptics';
import { Archive, ChevronLeft, ChevronRight, Clock, Package, Plus } from 'lucide-react-native';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Alert, BackHandler, Dimensions, FlatList, Platform, Pressable, RefreshControl, SafeAreaView, ScrollView, StyleSheet, Text, View, ViewToken } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { Swipeable, TapGestureHandler, Gesture, GestureDetector, State } from 'react-native-gesture-handler';
import Animated, { useSharedValue, useAnimatedStyle, withSpring, runOnJS } from 'react-native-reanimated';
import { useLocalSearchParams, useRouter } from 'expo-router';

// Timeline task type (no ghost flag needed anymore)
interface TimelineTask extends TaskWithRollover {
  // Clean: no ghost logic
}

interface DayPage {
  date: string; // yyyy-MM-dd
  dateObj: Date;
  displayDate: string; // "Jan 19 (Mon)" or "🔥 TODAY"
  isToday: boolean;
  isPast: boolean;
  isFuture: boolean;
  tasks: TimelineTask[];
}

const SCREEN_WIDTH = Dimensions.get('window').width;
const SCREEN_HEIGHT = Dimensions.get('window').height;
const HEADER_HEIGHT = 0; // No header in modal
const NAVIGATOR_HEIGHT = 0; // No navigator in modal
const AVAILABLE_HEIGHT = SCREEN_HEIGHT; // Full height for modal

export default function HomeScreen() {
  const { tasks, isLoading, isError, error, refetch, isLoadingMore } = useTimelineTasks();
  const { user } = useAuth();
  const router = useRouter();
  const flatListRef = useRef<FlatList>(null);
  const scrollViewRef = useRef<ScrollView>(null);
  const params = useLocalSearchParams<{ jumpToDate?: string }>();
  const [refreshing, setRefreshing] = useState(false);
  const [isAddTaskModalVisible, setIsAddTaskModalVisible] = useState(false);
  const [addTaskInitialDate, setAddTaskInitialDate] = useState<string | undefined>(undefined);
  const isAtTop = useSharedValue(true); // Track if ScrollView is at top (shared value for gesture handler)

  // Drag to dismiss animation values
  const translateY = useSharedValue(0);
  const scale = useSharedValue(1);
  const startY = useSharedValue(0); // Store initial position
  const DRAG_THRESHOLD = 100; // Minimum drag distance to dismiss

  // Generate date pages: Today -7 to +7 (15 days total)
  const generateDatePages = useCallback((): DayPage[] => {
    const todayDate = startOfDay(new Date());
    const todayStr = format(todayDate, 'yyyy-MM-dd');
    
    const startDate = subDays(todayDate, 7);
    const endDate = addDays(todayDate, 7);
    const dateRange = eachDayOfInterval({ start: startDate, end: endDate });

    return dateRange.map((date) => {
      const dateStr = format(date, 'yyyy-MM-dd');
      const isPast = date < todayDate;
      const isToday = dateStr === todayStr;
      const isFuture = date > todayDate;

      const displayDate = format(date, 'MMM d (EEE)');

      // Filter tasks for this date
      const pageTasks: TimelineTask[] = [];

      tasks.forEach((task) => {
        // Simplified Grouping Logic (No Ghost Tasks)
        // - DONE tasks: Group by completed_at (completion date)
        // - TODO tasks (past): Move to TODAY only (no duplication in past)
        // - TODO/CANCEL tasks (today/future): Show on due_date
        
        if (task.status === 'DONE') {
          // ✅ DONE: Group by completion date in LOCAL TIME
          if (!task.completed_at) return;
          
          const completedDate = parseISO(task.completed_at);
          const completedDateStr = format(completedDate, 'yyyy-MM-dd');
          
          if (completedDateStr === dateStr) {
            pageTasks.push(task);
          }
        } else {
          // TODO or CANCEL: Group by due_date
          if (!task.due_date) return;

          const taskDate = parseISO(task.due_date);
          const isTaskPast = taskDate < todayDate;

          if (task.status === 'TODO' && isTaskPast) {
            // ✅ Overdue TODO: Show ONLY in TODAY (no ghost in past)
            if (isToday) {
              pageTasks.push(task);
            }
          } else {
            // ✅ Normal case: Show on due_date
            if (task.due_date === dateStr) {
              pageTasks.push(task);
            }
          }
        }
      });

      // Sort tasks by date/time (maintain position when status changes)
      if (isToday) {
        pageTasks.sort((a, b) => {
          // Sort by original due_date, then by time
          const aDate = parseISO(a.original_due_date || a.due_date || a.created_at);
          const bDate = parseISO(b.original_due_date || b.due_date || b.created_at);
          
          const timeDiff = aDate.getTime() - bDate.getTime();
          if (timeDiff !== 0) return timeDiff;
          
          // If same date, sort by time
          if (a.due_time && b.due_time) {
            return a.due_time.localeCompare(b.due_time);
          }
          
          // Finally by created_at
          return a.created_at.localeCompare(b.created_at);
        });
      }

      return {
        date: dateStr,
        dateObj: date,
        displayDate,
        isToday,
        isPast,
        isFuture,
        tasks: pageTasks,
      };
    });
  }, [tasks]);

  const datePages = generateDatePages();
  const initialDateIndex = useMemo(() => {
    if (params.jumpToDate && datePages.length > 0) {
      const foundIndex = datePages.findIndex(page => page.date === params.jumpToDate);
      if (foundIndex !== -1) {
        return foundIndex;
      }
    }
    // Default: Today is at index 7 (0-based)
    return 7;
  }, [datePages, params.jumpToDate]);
  
  const [currentDateIndex, setCurrentDateIndex] = useState(() => initialDateIndex);
  const [currentDateDisplay, setCurrentDateDisplay] = useState(() => {
    const initialPage = datePages[initialDateIndex];
    return initialPage ? (initialPage.isToday ? `Today · ${initialPage.displayDate}` : initialPage.displayDate) : format(startOfDay(new Date()), 'MMM d (EEE)');
  });

  // No need for auto-scroll useEffect - initialScrollIndex handles it

  // Track current visible page
  const onViewableItemsChanged = useRef(({ viewableItems }: { viewableItems: ViewToken[] }) => {
    if (viewableItems.length > 0) {
      const visibleItem = viewableItems[0];
      const index = visibleItem.index || 0;
      setCurrentDateIndex(index);
      const page = datePages[index] as DayPage | undefined;
      if (page) {
        setCurrentDateDisplay(page.isToday ? `Today · ${page.displayDate}` : page.displayDate);
      } else {
        setCurrentDateDisplay('');
      }
    }
  }).current;

  const viewabilityConfig = {
    itemVisiblePercentThreshold: 50,
  };

  // Navigation functions
  const goToPreviousDay = useCallback(() => {
    if (currentDateIndex > 0) {
      flatListRef.current?.scrollToIndex({
        index: currentDateIndex - 1,
        animated: true,
      });
    }
  }, [currentDateIndex]);

  const goToNextDay = useCallback(() => {
    if (currentDateIndex < datePages.length - 1) {
      flatListRef.current?.scrollToIndex({
        index: currentDateIndex + 1,
        animated: true,
      });
    }
  }, [currentDateIndex, datePages.length]);

  // Navigate to specific date
  const goToDate = useCallback((dateStr: string) => {
    const targetIndex = datePages.findIndex(page => page.date === dateStr);
    if (targetIndex !== -1) {
      flatListRef.current?.scrollToIndex({
        index: targetIndex,
        animated: true,
      });
    }
  }, [datePages]);

  // Handle quick add task
  const handleQuickAdd = useCallback((dateStr: string) => {
    setAddTaskInitialDate(dateStr);
    setIsAddTaskModalVisible(true);
  }, []);

  // Keyboard navigation (Web only)
  useEffect(() => {
    if (Platform.OS !== 'web') return;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'ArrowLeft') {
        goToPreviousDay();
      } else if (event.key === 'ArrowRight') {
        goToNextDay();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [goToPreviousDay, goToNextDay]);

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

  // Dismiss modal (go back to previous screen)
  const dismissModal = useCallback(() => {
    if (router.canGoBack()) {
      router.back();
    } else {
      // Fallback: navigate to home
      router.replace('/(tabs)');
    }
  }, [router]);

  // Handle Android back button with zoom-out animation
  useEffect(() => {
    if (Platform.OS !== 'android') return;

    const backHandler = BackHandler.addEventListener('hardwareBackPress', () => {
      // Trigger zoom-out animation
      translateY.value = withSpring(SCREEN_HEIGHT);
      scale.value = withSpring(0.9);
      // Dismiss modal after a short delay to allow animation to start
      setTimeout(() => {
        dismissModal();
      }, 100);
      return true;
    });

    return () => backHandler.remove();
  }, [dismissModal, translateY, scale]);

  // Pan gesture handler for drag to dismiss (Native only - Web has pointer capture issues)
  const panGesture = useMemo(
    () => {
      if (Platform.OS === 'web') {
        // Return a no-op gesture for web to avoid pointer capture errors
        return Gesture.Pan().enabled(false);
      }
      return Gesture.Pan()
        .onStart(() => {
          // Store initial position
          startY.value = translateY.value;
        })
        .onUpdate((event) => {
          // Only allow downward drag when at top
          if (event.translationY > 0 && isAtTop.value) {
            translateY.value = startY.value + event.translationY;
            // Scale down slightly as user drags
            scale.value = Math.max(0.95, 1 - event.translationY / 500);
          }
        })
        .onEnd((event) => {
          if (event.translationY > DRAG_THRESHOLD && isAtTop.value) {
            // Dismiss: zoom out and close modal
            translateY.value = withSpring(SCREEN_HEIGHT);
            scale.value = withSpring(0.9);
            runOnJS(dismissModal)();
          } else {
            // Spring back to original position
            translateY.value = withSpring(0);
            scale.value = withSpring(1);
          }
        })
        .activeOffsetY(10)
        .failOffsetX([-50, 50]);
    },
    [dismissModal]
  );

  // Animated style for drag to dismiss
  const animatedContainerStyle = useAnimatedStyle(() => {
    return {
      transform: [
        { translateY: translateY.value },
        { scale: scale.value },
      ],
    };
  });

  // Track ScrollView scroll position
  const handleScroll = useCallback((event: any) => {
    const offsetY = event.nativeEvent.contentOffset.y;
    isAtTop.value = offsetY <= 0;
  }, [isAtTop]);

  const currentPage = datePages[currentDateIndex] as DayPage | undefined;
  const daySubtitle = '';

  const renderDayPage = ({ item }: { item: DayPage }) => {
    const pageWidth = Platform.OS === 'web' ? Math.min(SCREEN_WIDTH, 600) : SCREEN_WIDTH;
    const isToday = item.isToday;
    
    // Navigate to specific date handler
    const handleDateChange = (dateStr: string) => {
      goToDate(dateStr);
    };
    
    const containerContent = (
      <Animated.View
        style={[
          {
            width: pageWidth,
            height: Platform.OS === 'web' ? AVAILABLE_HEIGHT : undefined,
            backgroundColor: colors.background,
            flex: Platform.OS === 'web' ? undefined : 1,
          },
          animatedContainerStyle,
        ]}
      >
        {/* Handle Bar (Visual Hint) - Only show on native */}
        {Platform.OS !== 'web' && (
          <View
            style={{
              alignItems: 'center',
              paddingTop: 8,
              paddingBottom: 4,
            }}
          >
            <View
              style={{
                width: 40,
                height: 4,
                backgroundColor: colors.textSub,
                borderRadius: 2,
                opacity: 0.3,
              }}
            />
          </View>
        )}

        {/* Web: Close button hint */}
        {Platform.OS === 'web' && (
          <View
            style={{
              alignItems: 'center',
              paddingTop: 8,
              paddingBottom: 4,
            }}
          >
            <Text style={{ fontSize: 12, color: colors.textSub }}>
              Press ESC to close
            </Text>
          </View>
        )}

          {/* Outer Wrapper ScrollView */}
          <ScrollView
            ref={scrollViewRef}
            style={{ flex: 1 }}
            contentContainerStyle={{
              padding: 16,
              paddingBottom: Platform.OS === 'web' ? 200 : 120,
              ...(Platform.OS === 'web' 
                ? { minHeight: 'auto', height: 'auto' } 
                : { flexGrow: 0 }), // Web: auto height, Native: don't grow
            }}
            showsVerticalScrollIndicator={Platform.OS === 'web'}
            scrollEnabled={true}
            bounces={true}
            onScroll={handleScroll}
            scrollEventThrottle={16}
            refreshControl={
              <RefreshControl
                refreshing={refreshing}
                onRefresh={onRefresh}
                tintColor={colors.primary}
                colors={[colors.primary]}
              />
            }
          >
          {/* Main Card Container - Fit Content */}
          <Animated.View
            style={[
              styles.dayCard,
              isToday && styles.dayCardToday,
              isToday && { backgroundColor: '#EFF6FF' }, // Very light blue for today
              { 
                ...(Platform.OS === 'web' 
                  ? { width: '100%', minHeight: 'auto' } 
                  : { flex: 0, alignSelf: 'stretch' }), // Web: explicit width, Native: flex
                marginBottom: 16, // Add bottom margin
              },
            ]}
            sharedTransitionTag={`day-card-${item.date}`}
          >
            {/* Card Header - Date Display */}
            <View
              style={[
                {
                  paddingHorizontal: 16,
                  paddingTop: 16,
                  paddingBottom: 12,
                },
                isToday && { backgroundColor: '#EFF6FF' }, // Light blue header for today
              ]}
            >
              <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                {/* Date Text */}
                <Text
                  style={{
                    fontSize: 18,
                    fontWeight: '600',
                    color: isToday ? colors.primary : colors.textMain,
                  }}
                >
                  {item.displayDate}
                </Text>

                {/* Navigation Arrows */}
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                  <Pressable
                    onPress={goToPreviousDay}
                    disabled={currentDateIndex === 0}
                    style={{ 
                      padding: 8,
                      opacity: currentDateIndex === 0 ? 0.3 : 1,
                    }}
                    hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                  >
                    <ChevronLeft size={20} color={colors.textSub} strokeWidth={2} />
                  </Pressable>
                  <Pressable
                    onPress={goToNextDay}
                    disabled={currentDateIndex === datePages.length - 1}
                    style={{ 
                      padding: 8,
                      opacity: currentDateIndex === datePages.length - 1 ? 0.3 : 1,
                    }}
                    hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                  >
                    <ChevronRight size={20} color={colors.textSub} strokeWidth={2} />
                  </Pressable>
                </View>
              </View>
            </View>

            {/* Card Body - Task List (No Scroll, Fit Content) */}
            <View
              style={{
                paddingHorizontal: 16,
                paddingVertical: 16,
              }}
            >
              {item.tasks.length === 0 ? (
                <View style={{ paddingVertical: 4 }}>
                  {/* Empty State with Quick Add - Only for Today and Future */}
                  {!item.isPast ? (
                    <View style={{
                      alignItems: 'center',
                      justifyContent: 'center',
                      paddingVertical: 24,
                      paddingHorizontal: 16,
                      gap: 16,
                    }}>
                      <Text style={{
                        fontSize: 14,
                        color: colors.textSub,
                      }}>
                        No tasks scheduled
                      </Text>
                      <Pressable
                        onPress={() => handleQuickAdd(item.date)}
                        style={{
                          flexDirection: 'row',
                          alignItems: 'center',
                          backgroundColor: colors.primary,
                          paddingHorizontal: 24,
                          paddingVertical: 12,
                          borderRadius: borderRadius.full,
                          gap: 6,
                        }}
                      >
                        <Plus size={16} color={colors.primaryForeground} strokeWidth={2.5} />
                        <Text style={{
                          fontSize: 16,
                          color: colors.primaryForeground,
                          fontWeight: '600',
                        }}>
                          Add Task
                        </Text>
                      </Pressable>
                    </View>
                  ) : (
                    <EmptyState size="sm" message="No tasks scheduled" />
                  )}
                </View>
              ) : (
                <>
                  {item.tasks.map((task, index) => (
                    <TaskItem
                      key={`${task.id}-${index}`}
                      task={task}
                      isFuture={item.isFuture}
                      isOverdue={task.isOverdue}
                      daysOverdue={task.daysOverdue}
                      sectionDate={item.date}
                      onDateChange={handleDateChange}
                    />
                  ))}
                  {/* Footer - Quick Add Button (Only for Today and Future) */}
                  {!item.isPast && (
                    <Pressable
                      onPress={() => handleQuickAdd(item.date)}
                      style={{
                        flexDirection: 'row',
                        alignItems: 'center',
                        justifyContent: 'center',
                        paddingVertical: 12,
                        paddingHorizontal: 16,
                        marginTop: 8,
                        borderRadius: borderRadius.md,
                        backgroundColor: 'transparent',
                        borderWidth: 2,
                        borderColor: 'rgba(156, 163, 175, 0.2)', // border-muted-foreground/20
                        borderStyle: 'dashed',
                        gap: 6,
                      }}
                    >
                      <Plus size={16} color={colors.textSub} strokeWidth={2} />
                      <Text style={{
                        fontSize: 14,
                        color: colors.textSub,
                        fontWeight: '500',
                      }}>
                        Add a task
                      </Text>
                    </Pressable>
                  )}
                </>
              )}
            </View>
          </Animated.View>
        </ScrollView>
      </Animated.View>
    );

    // Wrap with GestureDetector only on native (web has pointer capture issues)
    if (Platform.OS === 'web') {
      return containerContent;
    }

    return (
      <GestureDetector gesture={panGesture}>
        {containerContent}
      </GestureDetector>
    );
  };

  if (isLoading) {
    return (
      <SafeAreaView style={styles.container}>
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={[styles.textSub, { marginTop: 16 }]}>
            Loading tasks...
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  if (isError) {
    return (
      <SafeAreaView style={styles.container}>
        <View className="flex-1 items-center justify-center">
          <Text className="text-4xl mb-4">⚠️</Text>
          <Text style={[styles.textMain, { fontSize: 16, fontWeight: '600', marginBottom: 8 }]}>
            Failed to load tasks
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
      {/* Horizontal Day Paging View */}
      <View 
        style={{
          flex: 1,
          height: Platform.OS === 'web' ? AVAILABLE_HEIGHT : undefined,
          ...(Platform.OS === 'web' && { maxWidth: 600, width: '100%', alignSelf: 'center' }),
        }}
      >
        <FlatList
          ref={flatListRef}
          data={datePages}
          renderItem={renderDayPage}
          keyExtractor={(item) => item.date}
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
          initialScrollIndex={initialDateIndex}
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

      {/* Add Task Modal */}
      <AddTaskModal
        visible={isAddTaskModalVisible}
        onClose={() => {
          setIsAddTaskModalVisible(false);
          setAddTaskInitialDate(undefined);
        }}
        initialDate={addTaskInitialDate}
      />
    </SafeAreaView>
  );
}

// Task Item Component
function TaskItem({ 
  task, 
  isFuture = false,
  isOverdue = false,
  daysOverdue = 0,
  sectionDate,
  onDateChange,
}: { 
  task: TimelineTask; 
  isFuture: boolean;
  isOverdue: boolean;
  daysOverdue: number;
  sectionDate: string; // yyyy-MM-dd
  onDateChange?: (dateStr: string) => void;
}) {
  const queryClient = useQueryClient();
  const isCancelled = task.status === 'CANCEL';
  const isDone = task.status === 'DONE';
  const isTodo = task.status === 'TODO';
  
  // ✅ TIMEZONE-SAFE: Calculate late completion (completed_at > due_date)
  // Uses local time for both dates to ensure accurate day difference
  const isLateCompletion = isDone && task.completed_at && task.due_date 
    ? (() => {
        // Parse UTC timestamp and convert to local date
        const completedDate = parseISO(task.completed_at); // UTC -> Local
        // Parse date-only string (no timezone conversion needed)
        const dueDate = parseISO(task.due_date);
        
        // differenceInCalendarDays compares calendar dates (ignores time)
        const daysLate = differenceInCalendarDays(completedDate, dueDate);
        return daysLate > 0 ? daysLate : 0;
      })()
    : 0;
  
  // Format time from HH:MM:SS to HH:MM
  const formatTime = (time: string | null) => {
    if (!time) return null;
    return time.substring(0, 5);
  };

  // Change status (with validation)
  const changeStatus = async (targetStatus: TaskStatus) => {
    const validation = validateStateTransition(task.status, targetStatus);
    
    if (!validation.valid) {
      if (Platform.OS === 'web') {
        alert(validation.error);
      } else {
        Alert.alert('Invalid Action', validation.error);
      }
      return;
    }

    // Prepare updates
    const updates: any = { status: targetStatus };

    // If unchecking (DONE -> TODO) and task has no due_date, assign today's date
    if (targetStatus === 'TODO' && !task.due_date) {
      const todayStr = format(new Date(), 'yyyy-MM-dd');
      updates.due_date = todayStr;
      updates.original_due_date = todayStr;
    }

    await updateTask({ id: task.id, ...updates });
    queryClient.invalidateQueries({ queryKey: ['tasks', 'timeline'] });
  };

  // Handle Checkbox Tap
  const handleCheckboxPress = async () => {
    // Toggle task status (including Future items)
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

    if (isTodo) {
      changeStatus('DONE');
    } else if (isDone) {
      changeStatus('TODO');
    } else if (isCancelled) {
      changeStatus('TODO');
    }
  };

  // Handle Title Press - Open Edit Sheet
  const [isEditSheetVisible, setIsEditSheetVisible] = useState(false);
  
  const handleTitlePress = () => {
    setIsEditSheetVisible(true);
  };

  const handleTaskUpdate = () => {
    queryClient.invalidateQueries({ queryKey: ['tasks', 'timeline'] });
  };

  // Send to Backlog (remove due_date)
  const handleSendToBacklog = async () => {
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

  // Render left swipe action (Archive - Send to Backlog)
  const renderLeftActions = () => (
    <View
      style={{
        width: 70,
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

  // Render task item
  const tapRef = useRef(null);

  const onCheckboxTap = (event: any) => {
    if (event.nativeEvent.state === State.END) {
      handleCheckboxPress();
    }
  };

  return (
    <View
      style={[
        styles.card,
        isOverdue && isTodo && styles.cardOverdue,
        isDone && { backgroundColor: '#F8FAFC' }, // Completed task background
      ]}
    >
      <Swipeable
        renderLeftActions={isTodo ? renderLeftActions : undefined}
        onSwipeableOpen={() => handleSendToBacklog()}
        overshootLeft={false}
        enabled={isTodo} // Only enable swipe for TODO tasks
      >
        <View style={{ flex: 1 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 12, gap: 12 }}>
            {/* Checkbox */}
            <TapGestureHandler
              ref={tapRef}
              onHandlerStateChange={onCheckboxTap}
              maxDist={10}
            >
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
            </TapGestureHandler>

            {/* Task Title - Pressable */}
            <Pressable
              onPress={handleTitlePress}
              style={{ flex: 1 }}
            >
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
                {task.title}
              </Text>
            </Pressable>

        {/* Badges */}
        <View className="flex-row items-center gap-2 flex-shrink-0">
          {/* Time Badge */}
          {task.due_time && (
            <View style={{
              flexDirection: 'row',
              alignItems: 'center',
              backgroundColor: '#F1F5F9', // Slate 100
              paddingHorizontal: 8,
              paddingVertical: 4,
              borderRadius: 6, // 4-6px range
            }}>
              <View style={{ marginRight: 4 }}>
                <Clock size={12} color="#475569" strokeWidth={2} />
              </View>
              <Text style={{
                fontSize: 12,
                fontWeight: '500',
                color: '#475569', // Slate 600
              }}>
                {formatTime(task.due_time)}
              </Text>
            </View>
          )}

          {/* From Backlog Badge - for DONE tasks without due_date */}
          {isDone && !task.due_date && (
            <View style={{
              flexDirection: 'row',
              alignItems: 'center',
              backgroundColor: '#F1F5F9', // Slate 100
              paddingHorizontal: 8,
              paddingVertical: 4,
              borderRadius: 6, // 4-6px range
            }}>
              <Package size={12} color="#475569" strokeWidth={2} />
              <Text style={{
                fontSize: 12,
                fontWeight: '500',
                color: '#475569', // Slate 600
                marginLeft: 4,
              }}>
                Backlog
              </Text>
            </View>
          )}

          {/* Late Completion Badge - for DONE tasks completed after due_date */}
          {isLateCompletion > 0 && (
            <View style={{
              backgroundColor: 'rgba(245, 158, 11, 0.2)', // bg-warning/20
              paddingHorizontal: 8,
              paddingVertical: 4,
              borderRadius: borderRadius.sm,
            }}>
              <Text style={{ 
                color: colors.textMain, // text-main
                fontSize: 12, 
                fontWeight: '500' 
              }}>
                +{isLateCompletion}
              </Text>
            </View>
          )}

          {/* Rollover Badge - only for overdue TODO items */}
          {isOverdue && daysOverdue > 0 && isTodo && (
            <View style={{
              backgroundColor: 'rgba(245, 158, 11, 0.2)', // bg-warning/20
              paddingHorizontal: 8,
              paddingVertical: 4,
              borderRadius: borderRadius.sm,
            }}>
              <Text style={{ 
                color: colors.textMain, // text-main
                fontSize: 12, 
                fontWeight: '500' 
              }}>
                +{daysOverdue}
              </Text>
            </View>
          )}
        </View>
          </View>
        </View>
      </Swipeable>
      
      {/* Edit Task Bottom Sheet */}
      <EditTaskBottomSheet
        visible={isEditSheetVisible}
        onClose={() => setIsEditSheetVisible(false)}
        task={{
          id: task.id,
          title: task.title,
          due_date: task.due_date,
          due_time: task.due_time,
        }}
        onUpdate={handleTaskUpdate}
        onDateChange={onDateChange}
      />
    </View>
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
  },
  cardOverdue: {
    backgroundColor: '#FEF2F2', // Very light red
    borderColor: colors.error,
  },
  dayCard: {
    backgroundColor: colors.card,
    borderRadius: borderRadius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    ...shadows.sm,
    overflow: 'hidden',
  },
  dayCardToday: {
    borderColor: colors.primary,
    borderWidth: 2,
    ...shadows.sm,
  },
});
