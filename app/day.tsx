// AppHeader removed for modal presentation
import { AddTaskModal } from '@/components/AddTaskModal';
import { AssigneeAvatars } from '@/components/AssigneeAvatars';
import { EditTaskBottomSheet } from '@/components/EditTaskBottomSheet';
import { EmptyState } from '@/components/EmptyState';
import { TaskListSkeleton } from '@/components/TaskListSkeleton';
import { NotificationCenterModal } from '@/components/NotificationCenterModal';
import { getWeeklyCalendarRanges, isDateInWeeklyRange } from '@/constants/calendar';
import { borderRadius, colors, shadows, spacing } from '@/constants/colors';
import { validateStateTransition } from '@/lib/api/task-state-machine';
import { calculateRolloverInfo, calculateTaskProgress, toggleAllAssigneesCompletion, toggleAssigneeCompletion } from '@/lib/api/tasks';
import { useAuth } from '@/lib/hooks/use-auth';
import { useCalendarStore } from '@/lib/stores/useCalendarStore';
import { useGroupStore } from '@/lib/stores/useGroupStore';
import type { TaskStatus, TaskWithRollover } from '@/lib/types';
import { formatTimeRange } from '@/lib/utils/format-time-range';
import { getTasksForDate, groupTasksByDate, type TaskWithOverdue } from '@/lib/utils/task-filtering';
import { showToast } from '@/utils/toast';
import { useFocusEffect } from '@react-navigation/native';
import { useQueryClient } from '@tanstack/react-query';
import { addDays, differenceInCalendarDays, eachDayOfInterval, format, parseISO, startOfDay } from 'date-fns';
import * as Haptics from 'expo-haptics';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Archive, Check, ChevronLeft, ChevronRight, Clock, Package, Plus, Trash2, Undo2, Users } from 'lucide-react-native';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { BackHandler, Dimensions, FlatList, Platform, Pressable, RefreshControl, SafeAreaView, ScrollView, StyleSheet, Text, View, ViewToken } from 'react-native';
import { Gesture, GestureDetector, Swipeable } from 'react-native-gesture-handler';
import Animated, { runOnJS, useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated';

// TaskWithOverdue is imported from task-filtering.ts
// Use TaskWithOverdue instead of TimelineTask

const SCREEN_WIDTH = Dimensions.get('window').width;
const SCREEN_HEIGHT = Dimensions.get('window').height;
const HEADER_HEIGHT = 0; // No header in modal
const NAVIGATOR_HEIGHT = 0; // No navigator in modal
const AVAILABLE_HEIGHT = SCREEN_HEIGHT; // Full height for modal

export default function HomeScreen() {
  const { 
    tasks, 
    isLoading, 
    error,
    selectedDate,
    setSelectedDate,
    initializeCalendar,
    updateTask: updateTaskInStore,
    toggleTaskComplete: toggleTaskCompleteInStore,
    deleteTask: deleteTaskInStore,
  } = useCalendarStore();
  const { user } = useAuth();
  const { fetchMyGroups } = useGroupStore();
  const router = useRouter();
  const flatListRef = useRef<FlatList>(null);
  const scrollViewRef = useRef<ScrollView>(null);
  const params = useLocalSearchParams<{ jumpToDate?: string | string[] }>();
  const [refreshing, setRefreshing] = useState(false);
  const [isAddTaskModalVisible, setIsAddTaskModalVisible] = useState(false);
  const [addTaskInitialDate, setAddTaskInitialDate] = useState<string | undefined>(undefined);
  const [isNotificationModalVisible, setIsNotificationModalVisible] = useState(false);
  const isAtTop = useSharedValue(true); // Track if ScrollView is at top (shared value for gesture handler)
  
  // Initialize calendar on mount (skip if already initialized for faster modal opening)
  useEffect(() => {
    // Only initialize if not already initialized (calendar store is shared with weekly view)
    const { isInitialized } = useCalendarStore.getState();
    if (!isInitialized) {
      initializeCalendar();
    }
  }, [initializeCalendar]);
  
  // Extract jumpToDateStr from params
  const jumpToDateStr = useMemo(() => {
    if (!params.jumpToDate) return undefined;
    return Array.isArray(params.jumpToDate) ? params.jumpToDate[0] : params.jumpToDate;
  }, [params.jumpToDate]);
  
  // Use weekly view range: -2 months ~ +4 months (same as weekly view)
  const { pastLimit, futureLimit } = getWeeklyCalendarRanges();
  
  // Group tasks by date using Map (O(1) lookup) - same logic as weekly view
  const tasksByDate = useMemo(() => groupTasksByDate(tasks), [tasks]);
  
  // Generate date string array for FlatList data (no page objects needed)
  // Range: -2 months ~ +4 months (same as weekly view)
  const dateStrings = useMemo(() => {
    const today = startOfDay(new Date());
    const startDate = pastLimit;
    const endDate = futureLimit;
    
    const dates = eachDayOfInterval({ start: startDate, end: endDate })
      .filter((date: Date) => isDateInWeeklyRange(date));
    
    return dates.map((date: Date) => format(date, 'yyyy-MM-dd'));
  }, [pastLimit, futureLimit]);
  
  // Drag to dismiss animation values
  const translateY = useSharedValue(0);
  const scale = useSharedValue(1);
  const startY = useSharedValue(0);
  const DRAG_THRESHOLD = 100;
  
  // Calculate target date index
  const getTargetDateIndex = useCallback(() => {
    if (dateStrings.length === 0) return 0;
    
    // Priority 1: jumpToDate param
    if (jumpToDateStr) {
      const index = dateStrings.indexOf(jumpToDateStr);
      if (index !== -1) return index;
    }
    
    // Priority 2: selectedDate
    const selectedDateStr = format(selectedDate, 'yyyy-MM-dd');
    const index = dateStrings.indexOf(selectedDateStr);
    if (index !== -1) return index;
    
    // Priority 3: Today
    const todayStr = format(startOfDay(new Date()), 'yyyy-MM-dd');
    const todayIndex = dateStrings.indexOf(todayStr);
    if (todayIndex !== -1) return todayIndex;
    
    // Fallback: middle
    return Math.floor(dateStrings.length / 2);
  }, [dateStrings, selectedDate, jumpToDateStr]);
  
  const targetDateIndex = getTargetDateIndex();
  
  // Simple state
  const [currentDateIndex, setCurrentDateIndex] = useState(0);
  const [currentDateDisplay, setCurrentDateDisplay] = useState('');
  const isUserSwipingRef = useRef(false);
  const [hasInitialized, setHasInitialized] = useState(false);
  const initialScrollIndexRef = useRef<number | undefined>(undefined);
  
  // Initialize on mount
  useEffect(() => {
    if (!hasInitialized && dateStrings.length > 0 && targetDateIndex >= 0) {
      setHasInitialized(true);
      initialScrollIndexRef.current = targetDateIndex;
      setCurrentDateIndex(targetDateIndex);
      const dateStr = dateStrings[targetDateIndex];
      const date = parseISO(dateStr);
      const todayStr = format(startOfDay(new Date()), 'yyyy-MM-dd');
      const isToday = dateStr === todayStr;
      setCurrentDateDisplay(isToday 
        ? `Today · ${format(date, 'MMM d (EEE)')}` 
        : format(date, 'MMM d (EEE)'));
    }
  }, [hasInitialized, dateStrings.length, targetDateIndex, dateStrings]);
  
  // Handle jumpToDate param changes
  useEffect(() => {
    if (isUserSwipingRef.current || !jumpToDateStr || dateStrings.length === 0) return;
    
    const targetIndex = dateStrings.indexOf(jumpToDateStr);
    if (targetIndex !== -1 && targetIndex !== currentDateIndex) {
      setCurrentDateIndex(targetIndex);
      const date = parseISO(jumpToDateStr);
      const todayStr = format(startOfDay(new Date()), 'yyyy-MM-dd');
      const isToday = jumpToDateStr === todayStr;
      setCurrentDateDisplay(isToday 
        ? `Today · ${format(date, 'MMM d (EEE)')}` 
        : format(date, 'MMM d (EEE)'));
      
      setTimeout(() => {
        flatListRef.current?.scrollToIndex({
          index: targetIndex,
          animated: true,
        });
      }, 100);
    }
  }, [jumpToDateStr, dateStrings, currentDateIndex]);

  // Track current visible page and update selectedDate
  const previousDateIndexRef = useRef<number>(-1);
  
  // Store dateStrings, setCurrentDateIndex, setCurrentDateDisplay in refs for stable callback
  const dateStringsRef = useRef(dateStrings);
  const setCurrentDateIndexRef = useRef(setCurrentDateIndex);
  const setCurrentDateDisplayRef = useRef(setCurrentDateDisplay);
  const setSelectedDateRef = useRef(setSelectedDate);
  const flatListRefForCallback = useRef(flatListRef.current);
  
  // Update refs when values change
  useEffect(() => {
    dateStringsRef.current = dateStrings;
    setCurrentDateIndexRef.current = setCurrentDateIndex;
    setCurrentDateDisplayRef.current = setCurrentDateDisplay;
    setSelectedDateRef.current = setSelectedDate;
    flatListRefForCallback.current = flatListRef.current;
  }, [dateStrings, setCurrentDateIndex, setCurrentDateDisplay, setSelectedDate]);
  
  // SIMPLIFIED: Handle viewable items change (user swipe)
  const onViewableItemsChanged = useCallback(({ viewableItems }: { viewableItems: ViewToken[] }) => {
    if (viewableItems.length === 0) return;
    
    const visibleItem = viewableItems[0];
    const index = visibleItem.index || 0;
    const prevIndex = previousDateIndexRef.current;
    
    // Skip if index hasn't changed
    if (index === prevIndex) return;
    
    const dateStr = dateStringsRef.current[index];
    if (!dateStr) return;
    
    const date = parseISO(dateStr);
    const todayStr = format(startOfDay(new Date()), 'yyyy-MM-dd');
    const isTodayPage = dateStr === todayStr;
    
    // Update local state using refs
    if (setCurrentDateIndexRef.current) {
      setCurrentDateIndexRef.current(index);
    }
    if (setCurrentDateDisplayRef.current) {
      setCurrentDateDisplayRef.current(isTodayPage 
        ? `Today · ${format(date, 'MMM d (EEE)')}` 
        : format(date, 'MMM d (EEE)'));
    }
    
    // Mark as user swipe and update selectedDate
    isUserSwipingRef.current = true;
    if (setSelectedDateRef.current) {
      setSelectedDateRef.current(date);
    }
    
    // Reset flag after delay
    setTimeout(() => {
      isUserSwipingRef.current = false;
    }, 300);
    
    // Check swipe limits (-2 months ~ +4 months)
    if (prevIndex !== -1) {
      const swipeDirection = index > prevIndex ? 'next' : 'prev';
      const checkDate = swipeDirection === 'prev' 
        ? addDays(date, -1)
        : addDays(date, 1);
      
      if (!isDateInWeeklyRange(checkDate)) {
        showToast('info', '범위 제한', '최대로 이동하였습니다.');
        setTimeout(() => {
          flatListRefForCallback.current?.scrollToIndex({
            index: prevIndex,
            animated: true,
          });
        }, 100);
        return;
      }
    }
    
    previousDateIndexRef.current = index;
  }, []); // Empty dependency array - use refs for all dynamic values

  // Memoize viewabilityConfig to prevent recreation
  const viewabilityConfig = useMemo(() => ({
    itemVisiblePercentThreshold: 50,
  }), []);

  // Navigation functions with range checks
  const goToPreviousDay = useCallback(() => {
    if (currentDateIndex > 0) {
      const prevIndex = currentDateIndex - 1;
      const prevDateStr = dateStrings[prevIndex];
      if (prevDateStr && isDateInWeeklyRange(parseISO(prevDateStr))) {
        flatListRef.current?.scrollToIndex({
          index: prevIndex,
          animated: true,
        });
      } else {
        showToast('info', '범위 제한', '최대로 이동하였습니다.');
      }
    }
  }, [currentDateIndex, dateStrings]);

  const goToNextDay = useCallback(() => {
    if (currentDateIndex < dateStrings.length - 1) {
      const nextIndex = currentDateIndex + 1;
      const nextDateStr = dateStrings[nextIndex];
      if (nextDateStr && isDateInWeeklyRange(parseISO(nextDateStr))) {
        flatListRef.current?.scrollToIndex({
          index: nextIndex,
          animated: true,
        });
      } else {
        showToast('info', '범위 제한', '최대로 이동하였습니다.');
      }
    }
  }, [currentDateIndex, dateStrings]);

  // Handle quick add task
  const handleQuickAdd = useCallback((dateStr: string) => {
    if (Platform.OS === 'ios') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    }
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
    setIsNotificationModalVisible(true);
  };

  // Pull-to-Refresh handler
  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    // Force re-initialization to reload all tasks (including new group tasks)
    await initializeCalendar(true);
    setRefreshing(false);
  }, [initializeCalendar]);

  // Auto-refresh on focus (silent update)
  useFocusEffect(
    useCallback(() => {
      // Silently refresh when screen comes into focus
      initializeCalendar();
    }, [initializeCalendar])
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

  // Get current date string
  const currentDateStr = dateStrings[currentDateIndex] || '';
  const currentDate = currentDateStr ? parseISO(currentDateStr) : startOfDay(new Date());
  const todayStr = format(startOfDay(new Date()), 'yyyy-MM-dd');
  const isToday = currentDateStr === todayStr;
  
  // Go to today function
  const goToToday = useCallback(() => {
    const todayIndex = dateStrings.indexOf(todayStr);
    if (todayIndex !== -1) {
      flatListRef.current?.scrollToIndex({
        index: todayIndex,
        animated: true,
      });
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    }
  }, [dateStrings, todayStr]);
  
  // Render day page: item is date string (yyyy-MM-dd)
  const renderDayPage = ({ item: dateStr }: { item: string }) => {
    const pageWidth = Platform.OS === 'web' ? Math.min(SCREEN_WIDTH, 600) : SCREEN_WIDTH;
    const date = parseISO(dateStr);
    const isTodayPage = dateStr === todayStr;
    const isPast = date < startOfDay(new Date());
    const isFuture = date > startOfDay(new Date());
    
    // Get tasks for this date from Map (O(1) lookup)
    const dayTasks = getTasksForDate(tasksByDate, dateStr);
    
    // Navigate to specific date handler
    const handleDateChange = (targetDateStr: string) => {
      const targetIndex = dateStrings.indexOf(targetDateStr);
      if (targetIndex !== -1) {
        flatListRef.current?.scrollToIndex({
          index: targetIndex,
          animated: true,
        });
      }
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
            keyboardShouldPersistTaps="handled"
            nestedScrollEnabled={true}
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
              styles.dayCard as any,
              isToday && (styles.dayCardToday as any),
              isToday && { backgroundColor: '#EFF6FF' }, // Very light blue for today
              { 
                ...(Platform.OS === 'web' 
                  ? { width: '100%', minHeight: 'auto' } 
                  : { flex: 0, alignSelf: 'stretch' }), // Web: explicit width, Native: flex
                marginBottom: 16, // Add bottom margin
              },
            ]}
            {...(Platform.OS !== 'web' ? { sharedTransitionTag: `day-card-${dateStr}` } : {})}
          >
            {/* Card Header - Date Display */}
            <View
              style={[
                {
                  paddingHorizontal: 16,
                  paddingTop: 16,
                  paddingBottom: 12,
                },
                isTodayPage && { backgroundColor: '#EFF6FF' }, // Light blue header for today
              ]}
            >
              <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                {/* Date Text and Today Button */}
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, flex: 1 }}>
                  <Text
                    style={{
                      fontSize: 18,
                      fontWeight: '600',
                      color: isTodayPage ? colors.primary : colors.textMain,
                    }}
                  >
                    {isTodayPage ? `Today · ${format(date, 'MMM d (EEE)')}` : format(date, 'MMM d (EEE)')}
                  </Text>
                  {/* Show "Today" button for past/future dates */}
                  {!isTodayPage && (
                    <Pressable
                      onPress={goToToday}
                      style={{
                        backgroundColor: colors.primary,
                        paddingHorizontal: 10,
                        paddingVertical: 6,
                        borderRadius: borderRadius.md,
                      }}
                    >
                      <Text style={{ fontSize: 12, fontWeight: '600', color: colors.primaryForeground }}>
                        Today
                      </Text>
                    </Pressable>
                  )}
                </View>

                {/* Navigation Arrows */}
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                  <Pressable
                    onPress={() => {
                      const prevIndex = currentDateIndex - 1;
                      if (prevIndex >= 0) {
                        const prevDateStr = dateStrings[prevIndex];
                        if (prevDateStr && isDateInWeeklyRange(parseISO(prevDateStr))) {
                          flatListRef.current?.scrollToIndex({
                            index: prevIndex,
                            animated: true,
                          });
                        } else {
                          showToast('info', '범위 제한', '최대로 이동하였습니다.');
                        }
                      }
                    }}
                    disabled={currentDateIndex === 0}
                    style={{ 
                      padding: 12,
                      opacity: currentDateIndex === 0 ? 0.3 : 1,
                      minWidth: 44,
                      minHeight: 44,
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                    hitSlop={{ top: 20, bottom: 20, left: 20, right: 20 }}
                    pressRetentionOffset={{ top: 30, bottom: 30, left: 30, right: 30 }}
                  >
                    <ChevronLeft size={20} color={colors.textSub} strokeWidth={2} />
                  </Pressable>
                  <Pressable
                    onPress={() => {
                      const nextIndex = currentDateIndex + 1;
                      if (nextIndex < dateStrings.length) {
                        const nextDateStr = dateStrings[nextIndex];
                        if (nextDateStr && isDateInWeeklyRange(parseISO(nextDateStr))) {
                          flatListRef.current?.scrollToIndex({
                            index: nextIndex,
                            animated: true,
                          });
                        } else {
                          showToast('info', '범위 제한', '최대로 이동하였습니다.');
                        }
                      }
                    }}
                    disabled={currentDateIndex === dateStrings.length - 1}
                    style={{ 
                      padding: 12,
                      opacity: currentDateIndex === dateStrings.length - 1 ? 0.3 : 1,
                      minWidth: 44,
                      minHeight: 44,
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                    hitSlop={{ top: 20, bottom: 20, left: 20, right: 20 }}
                    pressRetentionOffset={{ top: 30, bottom: 30, left: 30, right: 30 }}
                  >
                    <ChevronRight size={20} color={colors.textSub} strokeWidth={2} />
                  </Pressable>
                </View>
              </View>
            </View>

            {/* Card Body - Task List */}
            <View
              style={{
                paddingHorizontal: 16,
                paddingVertical: 16,
              }}
            >
              {dayTasks.length === 0 ? (
                <View style={{ paddingVertical: 4 }}>
                  {/* Empty State with Quick Add - Only for Today and Future */}
                  {!isPast ? (
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
                        onPress={() => handleQuickAdd(dateStr)}
                        style={{
                          flexDirection: 'row',
                          alignItems: 'center',
                          backgroundColor: 'transparent',
                          borderWidth: 1,
                          borderColor: '#E2E8F0',
                          paddingHorizontal: 20,
                          paddingVertical: 10,
                          borderRadius: borderRadius.md,
                        }}
                      >
                        <Plus size={16} color="#94A3B8" strokeWidth={2} />
                        <Text style={{ fontSize: 14, color: '#94A3B8', fontWeight: '500', marginLeft: 6 }}>
                          Tap to add
                        </Text>
                      </Pressable>
                    </View>
                  ) : (
                    <EmptyState size="sm" message="No tasks scheduled" />
                  )}
                </View>
              ) : (
                <>
                  {dayTasks.map((task, index) => (
                    <MemoizedTaskItem
                      key={`${task.id}-${index}`}
                      task={task}
                      isFuture={isFuture}
                      isOverdue={task.isOverdue || false}
                      daysOverdue={task.daysOverdue || 0}
                      sectionDate={dateStr}
                      onDateChange={handleDateChange}
                      updateTaskInStore={updateTaskInStore}
                      toggleTaskCompleteInStore={toggleTaskCompleteInStore}
                      deleteTaskInStore={deleteTaskInStore}
                    />
                  ))}
                  {/* Footer - Quick Add Button (Only for Today and Future) */}
                  {!isPast && (
                    <Pressable
                      onPress={() => handleQuickAdd(dateStr)}
                      style={{
                        flexDirection: 'row',
                        alignItems: 'center',
                        justifyContent: 'center',
                        backgroundColor: 'transparent',
                        borderWidth: 1,
                        borderColor: '#E2E8F0',
                        paddingHorizontal: 20,
                        paddingVertical: 10,
                        marginTop: 8,
                        borderRadius: borderRadius.md,
                      }}
                    >
                      <Plus size={16} color="#94A3B8" strokeWidth={2} />
                      <Text style={{ fontSize: 14, color: '#94A3B8', fontWeight: '500', marginLeft: 6 }}>
                        Tap to add
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

  // Check if there's an error
  const isError = !!error;

  if (isLoading) {
    return (
      <SafeAreaView style={styles.container as any}>
        <View style={{ flex: 1 }}>
          <TaskListSkeleton />
        </View>
      </SafeAreaView>
    );
  }

  if (isError) {
    return (
      <SafeAreaView style={styles.container as any}>
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          <Text style={{ fontSize: 32, marginBottom: 16 }}>⚠️</Text>
          <Text style={[styles.textMain as any, { fontSize: 16, fontWeight: '600', marginBottom: 8 }]}>
            Failed to load tasks
          </Text>
          <Text style={[styles.textSub as any, { textAlign: 'center', marginBottom: 16 }]}>
            {error || 'Something went wrong'}
          </Text>
          <Pressable 
            onPress={() => initializeCalendar()}
            style={styles.primaryButton as any}
          >
            <Text style={{ color: '#FFFFFF', fontWeight: '600' }}>Try Again</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[
      styles.container as any,
      Platform.OS === 'web' && { minHeight: '100vh' as any }
    ]}>
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
          data={dateStrings}
          renderItem={renderDayPage}
          keyExtractor={(item) => item}
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
          initialScrollIndex={initialScrollIndexRef.current}
          onScrollToIndexFailed={(info) => {
            // Retry scrolling after a delay
            setTimeout(() => {
              flatListRef.current?.scrollToIndex({
                index: info.index,
                animated: false,
              });
            }, 100);
          }}
          // Performance optimizations for large datasets (180+ days)
          initialNumToRender={3} // Only render 3 items initially (default is 10) - faster first paint
          maxToRenderPerBatch={2} // Render 2 items per batch (default is 10) - smoother scrolling
          windowSize={5} // Render 5 screens worth of items (default is 21) - reduces initial render
          removeClippedSubviews={Platform.OS !== 'web'} // Remove off-screen views (better memory usage)
          updateCellsBatchingPeriod={50} // Batch updates every 50ms (default is 50)
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
      
      {/* Notification Center Modal */}
      <NotificationCenterModal
        visible={isNotificationModalVisible}
        onClose={() => setIsNotificationModalVisible(false)}
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
  updateTaskInStore,
  toggleTaskCompleteInStore,
  deleteTaskInStore,
}: { 
  task: TaskWithOverdue; 
  isFuture: boolean;
  isOverdue: boolean;
  daysOverdue: number;
  sectionDate: string; // yyyy-MM-dd
  onDateChange?: (dateStr: string) => void;
  updateTaskInStore: (taskId: string, updateFields: any) => Promise<{ success: boolean; error?: string }>;
  toggleTaskCompleteInStore: (taskId: string) => Promise<{ success: boolean; error?: string }>;
  deleteTaskInStore: (taskId: string) => Promise<{ success: boolean; error?: string }>;
}) {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const { groups } = useGroupStore();
  
  // Edit sheet state (must be at top level for React Hooks rules)
  const [isEditSheetVisible, setIsEditSheetVisible] = useState(false);
  
  // Create groups map for O(1) lookup instead of O(n) find operations
  const groupsMap = useMemo(() => {
    const map = new Map<string, typeof groups[0]>();
    groups.forEach(g => map.set(g.id, g));
    return map;
  }, [groups]);

  const titleLongPressHandledRef = useRef(false);
  const toggleInFlightRef = useRef(false);

  // Memoize expensive calculations
  const isCancelled = useMemo(() => task.status === 'CANCEL', [task.status]);
  const isDone = useMemo(() => task.status === 'DONE', [task.status]);
  const isTodo = useMemo(() => task.status === 'TODO', [task.status]);
  
  // Check if this is my task or someone else's (memoized)
  const isMyTask = useMemo(
    () => task.assignees?.some((a: any) => a.user_id === user?.id) || false,
    [task.assignees, user?.id]
  );
  const isGroupTask = useMemo(() => task.group_id !== null, [task.group_id]);
  
  // Get group name (memoized to avoid repeated find operations, using Map for O(1) lookup)
  const groupName = useMemo(() => {
    if (!isGroupTask || !task.group_id) return null;
    return groupsMap.get(task.group_id)?.name || null;
  }, [isGroupTask, task.group_id, groupsMap]);
  
  // Get group for role checking (memoized)
  const myGroup = useMemo(() => {
    if (!isGroupTask || !task.group_id) return null;
    return groupsMap.get(task.group_id) || null;
  }, [isGroupTask, task.group_id, groupsMap]);
  
  // Calculate progress for group tasks (memoized)
  const progress = useMemo(() => {
    if (!isGroupTask || !task.assignees || task.assignees.length === 0) return null;
    return calculateTaskProgress(task, user?.id);
  }, [isGroupTask, task.assignees, task, user?.id]);
  
  // Group task logic handled below
  
  // ✅ TIMEZONE-SAFE: Calculate late completion (completed_at > due_date or original_due_date)
  // Uses local time for both dates to ensure accurate day difference
  // Use original_due_date if available (for backlog tasks), otherwise use due_date
  // Memoized to avoid recalculation on every render
  const isLateCompletion = useMemo(() => {
    if (!isDone || !task.completed_at) return 0;
    const referenceDueDate = task.original_due_date || task.due_date;
    if (!referenceDueDate) return 0;
    
    // Parse UTC timestamp and convert to local date
    const completedDate = parseISO(task.completed_at); // UTC -> Local
    // Parse date-only string (no timezone conversion needed)
    const dueDate = parseISO(referenceDueDate);
    
    // differenceInCalendarDays compares calendar dates (ignores time)
    const daysLate = differenceInCalendarDays(completedDate, dueDate);
    return daysLate > 0 ? daysLate : 0;
  }, [isDone, task.completed_at, task.original_due_date, task.due_date]);
  

  // Change status (with validation)
  const changeStatus = async (targetStatus: TaskStatus) => {
    const validation = validateStateTransition(task.status, targetStatus);
    if (!validation.valid) {
      showToast('error', 'Invalid Action', validation.error);
      return;
    }
    if (toggleInFlightRef.current) return;
    toggleInFlightRef.current = true;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});

    const updateTaskInCache = (oldData: any, updateFn: (t: any) => any) => {
      if (!oldData) return oldData;
      return oldData.map((t: any) => t.id === task.id ? updateFn(t) : t);
    };

    try {
    // Group task: use assignee logic
    if (task.group_id && task.assignees) {
      const myGroup = groups.find(g => g.id === task.group_id);
      const myRole = myGroup?.myRole;
      const shouldComplete = targetStatus === 'DONE';

      if (myRole === 'OWNER' || myRole === 'ADMIN') {
        const originalTask = useCalendarStore.getState().getTaskById(task.id);

        queryClient.setQueriesData(
          { queryKey: ['tasks', 'unified'], exact: false },
          (oldData: any) => updateTaskInCache(oldData, (t: any) => ({
            ...t,
            assignees: t.assignees?.map((a: any) => ({
              ...a,
              is_completed: shouldComplete,
              completed_at: shouldComplete ? new Date().toISOString() : null,
            })),
            status: targetStatus,
            completed_at: shouldComplete ? new Date().toISOString() : null,
          }))
        );

        if (originalTask) {
          const updatedAssignees = originalTask.assignees?.map((a: any) => ({
            ...a,
            is_completed: shouldComplete,
            completed_at: shouldComplete ? new Date().toISOString() : null,
          })) || [];
          const optimisticTask = {
            ...originalTask,
            assignees: updatedAssignees,
            status: targetStatus,
            completed_at: shouldComplete ? new Date().toISOString() : null,
          };
          const tasksWithRollover = calculateRolloverInfo([optimisticTask]);
          useCalendarStore.getState().mergeTasksIntoStore(tasksWithRollover);
        }

        const { error } = await toggleAllAssigneesCompletion(task.id, shouldComplete);
        if (error) {
          if (originalTask) {
            const tasksWithRollover = calculateRolloverInfo([originalTask]);
            useCalendarStore.getState().mergeTasksIntoStore(tasksWithRollover);
          }
          queryClient.invalidateQueries({ queryKey: ['tasks', 'unified'] });
        }
      } else if (user) {
        // Member: toggle own status only
        const myAssignee = task.assignees.find((a: any) => a.user_id === user.id);
        if (!myAssignee) return;

        const shouldCompleteMyTask = !myAssignee.is_completed;
        const originalTask = useCalendarStore.getState().getTaskById(task.id);

        queryClient.setQueriesData(
          { queryKey: ['tasks', 'unified'], exact: false },
          (oldData: any) => updateTaskInCache(oldData, (t: any) => {
            const updatedAssignees = t.assignees?.map((a: any) =>
              a.user_id === user.id
                ? { ...a, is_completed: shouldCompleteMyTask, completed_at: shouldCompleteMyTask ? new Date().toISOString() : null }
                : a
            );
            const allCompleted = updatedAssignees?.every((a: any) => a.is_completed) ?? false;
            return {
              ...t,
              assignees: updatedAssignees,
              status: allCompleted ? 'DONE' : 'TODO',
              completed_at: allCompleted ? new Date().toISOString() : null,
            };
          })
        );

        if (originalTask) {
          const updatedAssignees = originalTask.assignees?.map((a: any) =>
            a.user_id === user.id
              ? { ...a, is_completed: shouldCompleteMyTask, completed_at: shouldCompleteMyTask ? new Date().toISOString() : null }
              : a
          ) || [];
          const allCompleted = updatedAssignees.every((a: any) => a.is_completed) ?? false;
          const optimisticTask: TaskWithRollover = {
            ...originalTask,
            assignees: updatedAssignees,
            status: (allCompleted ? 'DONE' : 'TODO') as TaskStatus,
            completed_at: allCompleted ? new Date().toISOString() : null,
          } as TaskWithRollover;
          const tasksWithRollover = calculateRolloverInfo([optimisticTask]);
          useCalendarStore.getState().mergeTasksIntoStore(tasksWithRollover);
        }

        try {
          const { error } = await toggleAssigneeCompletion(task.id, user.id, myAssignee.is_completed);
          if (error) {
            if (originalTask) {
              const tasksWithRollover = calculateRolloverInfo([originalTask]);
              useCalendarStore.getState().mergeTasksIntoStore(tasksWithRollover);
            }
            queryClient.invalidateQueries({ queryKey: ['tasks', 'unified'] });
          }
        } catch (error) {
          if (originalTask) {
            const tasksWithRollover = calculateRolloverInfo([originalTask]);
            useCalendarStore.getState().mergeTasksIntoStore(tasksWithRollover);
          }
          queryClient.invalidateQueries({ queryKey: ['tasks', 'unified'] });
        }
      }
      return;
    }

    // Personal task: Use store function for optimistic update
    const updates: any = { status: targetStatus };

    if (targetStatus === 'DONE') {
      // Complete: Set completed_at to today (actual completion date)
      // This allows delay calculation: completed_at - due_date = delay days
      updates.completed_at = new Date().toISOString();
    } else {
      // Uncomplete: Clear completed_at
      updates.completed_at = null;
    }

    // If unchecking (DONE -> TODO) and task has no due_date, assign today's date
    if (targetStatus === 'TODO' && !task.due_date) {
      const todayStr = format(new Date(), 'yyyy-MM-dd');
      updates.due_date = todayStr;
      updates.original_due_date = todayStr;
    }

    // Use store function (handles optimistic update and API call)
    await updateTaskInStore(task.id, updates);
    } finally {
      toggleInFlightRef.current = false;
    }
  };

  // Handle Checkbox Tap
  const handleCheckboxPress = () => {
    if (isTodo) {
      changeStatus('DONE');
    } else if (isDone) {
      changeStatus('TODO');
    } else if (isCancelled) {
      changeStatus('TODO');
    }
  };

  // Handle Title Press - Open Edit Sheet
  const handleTitlePress = useCallback(() => {
    if (Platform.OS === 'ios') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    }
    setIsEditSheetVisible(true);
  }, []);

  const handleTaskUpdate = useCallback(() => {
    // Store already updated via optimistic updates, no need to invalidate
    // This callback can be removed or kept for future use
  }, []);

  // Memoize task prop to prevent unnecessary re-renders
  const editTaskData = useMemo(() => ({
    id: task.id,
    title: task.title,
    due_date: task.due_date,
    due_time: task.due_time,
    due_time_end: task.due_time_end ?? null,
    group_id: task.group_id || null,
    assignees: task.assignees?.map((a: any) => ({
      user_id: a.user_id,
      profile: a.profile,
    })) || [],
    status: task.status,
  }), [task.id, task.title, task.due_date, task.due_time, task.due_time_end, task.group_id, task.assignees, task.status]);

  // Send to Backlog (remove due_date)
  const handleSendToBacklog = async () => {
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    
    // Use store function (handles optimistic update and API call)
    const result = await updateTaskInStore(task.id, {
      due_date: null,
      original_due_date: null,
    });
    
    if (result.success) {
      showToast('success', 'Moved', 'Task moved to Backlog');
    } else if (result.error) {
      const errorMsg = result.error.message?.includes('permission') || result.error.code === '42501'
        ? 'Permission denied. Only OWNER/ADMIN can modify this task.'
        : 'Could not move to backlog';
      showToast('error', 'Failed', errorMsg);
    }
  };

  // Swipe actions: Completed → 미완료 / Not completed → Backlog | Delete
  const renderRightActions = () => (
    <View style={{ flexDirection: 'row', alignItems: 'stretch', gap: 2, marginBottom: spacing.md }}>
      {isDone ? (
        <Pressable
          onPress={() => changeStatus('TODO')}
          style={{
            backgroundColor: '#64748B',
            justifyContent: 'center',
            alignItems: 'center',
            width: 60,
            alignSelf: 'stretch',
            borderTopLeftRadius: borderRadius.lg,
            borderBottomLeftRadius: borderRadius.lg,
          }}
        >
          <Undo2 size={18} color="#FFFFFF" strokeWidth={2} />
        </Pressable>
      ) : (
        <Pressable
          onPress={handleSendToBacklog}
          style={{
            backgroundColor: '#3B82F6',
            justifyContent: 'center',
            alignItems: 'center',
            width: 60,
            alignSelf: 'stretch',
            borderTopLeftRadius: borderRadius.lg,
            borderBottomLeftRadius: borderRadius.lg,
          }}
        >
          <Archive size={18} color="#FFFFFF" strokeWidth={2} />
        </Pressable>
      )}
      <Pressable
        onPress={async () => {
          await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
          await deleteTaskInStore(task.id);
        }}
        style={{
          backgroundColor: colors.error,
          justifyContent: 'center',
          alignItems: 'center',
          width: 60,
          alignSelf: 'stretch',
          borderTopRightRadius: borderRadius.lg,
          borderBottomRightRadius: borderRadius.lg,
        }}
      >
        <Trash2 size={18} color="#FFFFFF" strokeWidth={2} />
      </Pressable>
    </View>
  );

  // Render task item
  return (
    <>
    <Swipeable
      renderRightActions={renderRightActions}
      overshootRight={false}
      overshootLeft={false}
      friction={2}
      rightThreshold={40}
    >
      <View
        style={[
          styles.card as any,
          isOverdue && isTodo && (styles.cardOverdue as any),
          isDone && { backgroundColor: '#F8FAFC' }, // Completed task background
        ]}
      >
      <View style={{ flex: 1, paddingHorizontal: 12, paddingVertical: 12 }}>
          {/* 첫 번째 줄: 체크박스 + 제목 + 시간뱃지 + delay뱃지 */}
          <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 12, marginBottom: 8 }}>
            {/* Checkbox */}
            {(() => {
              // Check if MEMBER should have read-only checkbox
              const isCheckboxDisabled = !!(task.group_id && myGroup?.myRole === 'MEMBER');
              
              return (
                <Pressable
                  onPress={handleCheckboxPress}
                  disabled={isCheckboxDisabled}
                  hitSlop={{ top: 14, bottom: 14, left: 14, right: 14 }}
                  pressRetentionOffset={{ top: 22, bottom: 22, left: 22, right: 22 }}
                  style={[
                    {
                      width: 18,
                      height: 18,
                      borderRadius: borderRadius.full,
                      borderWidth: 2,
                      flexShrink: 0,
                      alignItems: 'center',
                      justifyContent: 'center',
                      marginTop: 0,
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
                    isCheckboxDisabled && {
                      opacity: 0.5, // Visual indicator for disabled state
                    },
                  ]}
                >
                  {isDone && (
                    <Check size={10} color="#FFFFFF" strokeWidth={3} />
                  )}
                  {isCancelled && (
                    <Text style={{ color: '#fff', fontSize: 14, fontWeight: '600' }}>✕</Text>
                  )}
                </Pressable>
              );
            })()}

            {/* Task Title: short press = complete/incomplete, long press = edit */}
            <View style={{ flex: 1, flexDirection: 'row', alignItems: 'center', gap: 4, minWidth: 0 }}>
              <Pressable
                onPress={() => {
                  if (titleLongPressHandledRef.current) {
                    titleLongPressHandledRef.current = false;
                    return;
                  }
                  handleCheckboxPress();
                }}
                onLongPress={() => {
                  titleLongPressHandledRef.current = true;
                  handleTitlePress();
                }}
                style={{ flexShrink: 1, minWidth: 0 }}
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                pressRetentionOffset={{ top: 20, bottom: 20, left: 20, right: 20 }}
              >
                <Text 
                  numberOfLines={0} // Show all lines (no truncation)
                  style={useMemo(() => {
                    const baseStyle = {
                      fontSize: 14,
                      fontWeight: '500' as '500',
                      minWidth: 0, // Allow text to shrink
                    };
                    
                    if (isDone) {
                      return { ...baseStyle, color: colors.textSub, textDecorationLine: 'line-through' as const };
                    }
                    if (isCancelled) {
                      return { ...baseStyle, color: colors.textDisabled, textDecorationLine: 'line-through' as const };
                    }
                    if (isMyTask) {
                      return { ...baseStyle, color: colors.textMain, fontWeight: '500' as '500' };
                    }
                    return { ...baseStyle, color: colors.textSub, fontWeight: '400' as '400' };
                  }, [isDone, isCancelled, isMyTask])}
                >
                  {task.title}
                </Text>
              </Pressable>

              {/* Time Badge - 제목 바로 옆에 표시 */}
              {(task.due_time || task.due_time_end) && (
                <View style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  backgroundColor: colors.gray100,
                  paddingHorizontal: 6,
                  paddingVertical: 4,
                  borderRadius: borderRadius.sm,
                  flexShrink: 0,
                }}>
                  <Clock size={10} color="#475569" strokeWidth={2} />
                  <Text style={{
                    fontSize: 10,
                    fontWeight: '500',
                    color: '#475569', // Slate 600
                    marginLeft: 4,
                  }}>
                    {formatTimeRange(task.due_time, task.due_time_end ?? null)}
                  </Text>
                </View>
              )}
            </View>

            {/* 지연 뱃지 (같은 줄에 표시) - TODO일 때 Rollover, DONE일 때 Late Completion */}
            {((isOverdue && daysOverdue > 0 && isTodo) || (isDone && isLateCompletion > 0)) && (
              <View style={{
                backgroundColor: 'rgba(245, 158, 11, 0.2)', // bg-warning/20
                paddingHorizontal: 8,
                paddingVertical: 4,
                borderRadius: borderRadius.sm,
                flexShrink: 0,
                marginTop: 2,
              }}>
                <Text style={{ 
                  color: colors.textMain,
                  fontSize: 12, 
                  fontWeight: '500' 
                }}>
                  +{isDone ? isLateCompletion : daysOverdue}
                </Text>
              </View>
            )}
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
            {groupName && (
              <View style={{
                flexDirection: 'row',
                alignItems: 'center',
                backgroundColor: colors.gray100,
                paddingHorizontal: 6,
                paddingVertical: 4,
                borderRadius: borderRadius.sm,
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
                  {groupName}
                </Text>
              </View>
            )}

            {/* Assignee Avatars (for group tasks) - show for both TODO and DONE */}
            {isGroupTask && task.assignees && task.assignees.length > 0 && (
              <AssigneeAvatars
                taskId={task.id}
                groupId={task.group_id}
                assignees={task.assignees.map((a: any) => ({
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
                backgroundColor: colors.gray100,
                paddingHorizontal: 6,
                paddingVertical: 4,
                borderRadius: borderRadius.sm,
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
    </Swipeable>
    
    {/* Edit Task Bottom Sheet */}
    <EditTaskBottomSheet
      visible={isEditSheetVisible}
      onClose={() => setIsEditSheetVisible(false)}
      task={editTaskData}
      onUpdate={handleTaskUpdate}
      onDateChange={onDateChange}
    />
    </>
  );
}

// Memoize TaskItem to prevent unnecessary re-renders
export const MemoizedTaskItem = React.memo(TaskItem, (prevProps, nextProps) => {
  // Custom comparison function for better performance
  return (
    prevProps.task.id === nextProps.task.id &&
    prevProps.task.status === nextProps.task.status &&
    prevProps.task.title === nextProps.task.title &&
    prevProps.task.due_date === nextProps.task.due_date &&
    prevProps.task.due_time === nextProps.task.due_time &&
    prevProps.task.due_time_end === nextProps.task.due_time_end &&
    prevProps.task.completed_at === nextProps.task.completed_at &&
    prevProps.task.group_id === nextProps.task.group_id &&
    JSON.stringify(prevProps.task.assignees) === JSON.stringify(nextProps.task.assignees) &&
    prevProps.isFuture === nextProps.isFuture &&
    prevProps.isOverdue === nextProps.isOverdue &&
    prevProps.daysOverdue === nextProps.daysOverdue &&
    prevProps.sectionDate === nextProps.sectionDate
  );
});

// Modern Minimalist Styles
const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
    // Note: minHeight: '100vh' is web-only and handled via Platform check in component
  } as any,
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
