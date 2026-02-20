import { AddTaskModal } from '@/components/AddTaskModal';
import { AppHeader } from '@/components/AppHeader';
import { AssigneeAvatars } from '@/components/AssigneeAvatars';
import { EditTaskBottomSheet } from '@/components/EditTaskBottomSheet';
import { EmptyState } from '@/components/EmptyState';
import { TaskListSkeleton } from '@/components/TaskListSkeleton';
import { NotificationCenterModal } from '@/components/NotificationCenterModal';
import { getWeeklyCalendarRanges, isDateInWeeklyRange } from '@/constants/calendar';
import { borderRadius, colors, shadows } from '@/constants/colors';
import { useAuth } from '@/lib/hooks/use-auth';
import { useCalendarStore } from '@/lib/stores/useCalendarStore';
import { useGroupStore } from '@/lib/stores/useGroupStore';
import type { TaskStatus } from '@/lib/types';
import { formatTimeRange } from '@/lib/utils/format-time-range';
import { getTasksForDate, groupTasksByDate, type TaskWithOverdue } from '@/lib/utils/task-filtering';
import { showToast } from '@/utils/toast';
import { useFocusEffect } from '@react-navigation/native';
import { useQueryClient } from '@tanstack/react-query';
import { addWeeks, differenceInCalendarDays, eachDayOfInterval, endOfWeek, format, parseISO, startOfDay, startOfWeek } from 'date-fns';
import * as Haptics from 'expo-haptics';
import { useRouter } from 'expo-router';
import { calculateRolloverInfo, duplicateTasksToNextWeek, moveTaskToBacklog, toggleAllAssigneesCompletion, toggleAssigneeCompletion } from '@/lib/api/tasks';
import { Archive, Check, ChevronLeft, ChevronRight, Clock, Package, Plus, Repeat, Trash2, Undo2, Users } from 'lucide-react-native';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Alert, Dimensions, FlatList, Platform, Pressable, RefreshControl, SafeAreaView, ScrollView, Text, View, ViewToken } from 'react-native';
import { Swipeable } from 'react-native-gesture-handler';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const SCREEN_WIDTH = Dimensions.get('window').width;
const SCREEN_HEIGHT = Dimensions.get('window').height;
const HEADER_HEIGHT = 60;
const NAVIGATOR_HEIGHT = 70;
const AVAILABLE_HEIGHT = SCREEN_HEIGHT - HEADER_HEIGHT - NAVIGATOR_HEIGHT;

interface DailyGroup {
  date: string;
  dateObj: Date;
  displayDate: string;
  tasks: TaskWithOverdue[];
  completedCount: number;
  totalCount: number;
}

interface WeekPage {
  weekStart: Date;
  weekEnd: Date;
  weekStartStr: string;
  weekEndStr: string;
  displayRange: string;
  dailyGroups: DailyGroup[];
}

export default function WeekScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const { 
    tasks, 
    isLoading, 
    selectedDate,
    setSelectedDate,
    initializeCalendar,
    updateTask: updateTaskInStore,
    toggleTaskComplete: toggleTaskCompleteInStore,
    deleteTask: deleteTaskInStore,
    mergeTasksIntoStore,
    rollbackCopyWeek,
  } = useCalendarStore();
  const queryClient = useQueryClient();
  const insets = useSafeAreaInsets();
  
  // Initialize calendar only when user is ready (avoids empty tasks on first load)
  useEffect(() => {
    if (user?.id) {
      initializeCalendar();
    }
  }, [user?.id, initializeCalendar]);
  
  const flatListRef = useRef<FlatList>(null);
  const scrollViewRefs = useRef<Map<string, ScrollView>>(new Map());
  const cardPositions = useRef<Map<string, number>>(new Map());
  const [refreshing, setRefreshing] = useState(false);
  const [isAddTaskModalVisible, setIsAddTaskModalVisible] = useState(false);
  const [addTaskInitialDate, setAddTaskInitialDate] = useState<string | undefined>(undefined);
  const [isNotificationModalVisible, setIsNotificationModalVisible] = useState(false);
  
  // Edit task modal state
  const [isEditTaskModalVisible, setIsEditTaskModalVisible] = useState(false);
  const [editingTask, setEditingTask] = useState<any>(null);
  const [copyInProgress, setCopyInProgress] = useState(false);

  // Calculate this week's weekStartStr (constant)
  const THIS_WEEK_START_STR = useMemo(() => {
    const today = startOfDay(new Date());
    const weekStart = startOfWeek(today, { weekStartsOn: 1 });
    return format(weekStart, 'yyyy-MM-dd');
  }, []);
  
  // Use weekStartStr as source of truth (not index)
  const [currentWeekStartStr, setCurrentWeekStartStr] = useState<string>(THIS_WEEK_START_STR);
  const currentWeekStartStrRef = useRef<string>(THIS_WEEK_START_STR);
  
  // Group tasks by date (O(1) lookup)
  // Use tasks.length and a hash of task IDs to detect changes
  const tasksHash = useMemo(() => {
    return tasks.map(t => `${t.id}:${t.status}`).join(',');
  }, [tasks]);
  
  const tasksByDate = useMemo(() => groupTasksByDate(tasks), [tasks, tasksHash]);
  
  // Generate ALL week pages upfront (fixed structure, -3 months ~ +3 months)
  // This array structure NEVER changes - only data gets updated
  const weekPages = useMemo(() => {
    const today = startOfDay(new Date());
    const { pastLimit, futureLimit } = getWeeklyCalendarRanges();
    
    // Calculate total number of weeks
    const pastWeekStart = startOfWeek(pastLimit, { weekStartsOn: 1 });
    const futureWeekStart = startOfWeek(futureLimit, { weekStartsOn: 1 });
    const thisWeekStart = startOfWeek(today, { weekStartsOn: 1 });
    
    const weeksToPast = Math.floor((thisWeekStart.getTime() - pastWeekStart.getTime()) / (7 * 24 * 60 * 60 * 1000));
    const weeksToFuture = Math.floor((futureWeekStart.getTime() - thisWeekStart.getTime()) / (7 * 24 * 60 * 60 * 1000));
    
    const pages: WeekPage[] = [];
    
    // Generate weeks from past to future
    for (let offset = -weeksToPast; offset <= weeksToFuture; offset++) {
      const targetWeek = addWeeks(thisWeekStart, offset);
      const weekStart = startOfWeek(targetWeek, { weekStartsOn: 1 });
      const weekEnd = endOfWeek(targetWeek, { weekStartsOn: 1 });
      
      const weekStartStr = format(weekStart, 'yyyy-MM-dd');
      const weekEndStr = format(weekEnd, 'yyyy-MM-dd');
      const displayRange = `${format(weekStart, 'MMM d')} - ${format(weekEnd, 'MMM d')}`;
      
      // Generate daily groups with tasks from tasksByDate
      const dailyGroups: DailyGroup[] = eachDayOfInterval({
        start: weekStart,
        end: weekEnd,
      }).map((date) => {
        const dateStr = format(date, 'yyyy-MM-dd');
        const dayTasks = getTasksForDate(tasksByDate, dateStr);
        
        return {
          date: dateStr,
          dateObj: date,
          displayDate: format(date, 'MMM d (EEE)'),
          tasks: dayTasks,
          completedCount: dayTasks.filter((t) => t.status === 'DONE').length,
          totalCount: dayTasks.length,
        };
      });
      
      pages.push({
        weekStart,
        weekEnd,
        weekStartStr,
        weekEndStr,
        displayRange,
        dailyGroups,
      });
    }
    
    return pages;
  }, [tasksByDate]); // Regenerate when tasks change
  
  // Map for O(1) lookup: weekStartStr -> index
  const weekPagesMap = useMemo(() => {
    const map = new Map<string, number>();
    weekPages.forEach((page, index) => {
      map.set(page.weekStartStr, index);
    });
    return map;
  }, [weekPages]);
  
  // Current week index (derived from weekStartStr)
  const currentWeekIndex = useMemo(() => {
    const index = weekPagesMap.get(currentWeekStartStr);
    return index !== undefined ? index : weekPagesMap.get(THIS_WEEK_START_STR) || 0;
  }, [weekPagesMap, currentWeekStartStr, THIS_WEEK_START_STR]);
  
  // Current week page
  const currentWeekPage = weekPages[currentWeekIndex];
  
  // Current week display
  const currentWeekDisplay = currentWeekPage?.displayRange || '';
  
  // Check if current week is this week
  const isCurrentWeek = currentWeekStartStr === THIS_WEEK_START_STR;
  const isPastWeek = currentWeekStartStr < THIS_WEEK_START_STR;
  const isFutureWeek = currentWeekStartStr > THIS_WEEK_START_STR;
  
  // Initial scroll index (this week)
  const initialScrollIndex = weekPagesMap.get(THIS_WEEK_START_STR) || 0;
  
  // onViewableItemsChanged: Only update currentWeekStartStr when user swipes
  const onViewableItemsChanged = useCallback(({ viewableItems }: { viewableItems: ViewToken[] }) => {
    if (viewableItems.length > 0 && viewableItems[0]) {
      const visibleItem = viewableItems[0].item as WeekPage;
      const newWeekStartStr = visibleItem.weekStartStr;
      
      if (newWeekStartStr !== currentWeekStartStrRef.current) {
        console.log('[onViewableItemsChanged] Week changed to:', newWeekStartStr);
        setCurrentWeekStartStr(newWeekStartStr);
        currentWeekStartStrRef.current = newWeekStartStr;
      }
    }
  }, []);
  
  const viewabilityConfig = useRef({
    itemVisiblePercentThreshold: 50,
  }).current;
  
  // Scroll to today within a week
  const scrollToTodayInWeek = useCallback((weekStartStr: string) => {
    const scrollViewRef = scrollViewRefs.current.get(weekStartStr);
    if (!scrollViewRef) {
      console.log('ScrollView ref not found for week:', weekStartStr);
      return;
    }
    
    const today = format(startOfDay(new Date()), 'yyyy-MM-dd');
    const cardKey = `${weekStartStr}-${today}`;
    const cardY = cardPositions.current.get(cardKey);
    
    console.log('Scroll to today details:', {
      weekStartStr,
      today,
      cardKey,
      cardY,
      hasCardPosition: cardY !== undefined
    });
    
    if (cardY !== undefined) {
      scrollViewRef.scrollTo({
        y: Math.max(0, cardY - 20), // Increased offset
        animated: true,
      });
    } else {
      // Fallback: try to scroll after a short delay
      setTimeout(() => {
        const retryCardY = cardPositions.current.get(cardKey);
        if (retryCardY !== undefined) {
          const retryScrollViewRef = scrollViewRefs.current.get(weekStartStr);
          if (retryScrollViewRef) {
            console.log('Retry scroll to today with position:', retryCardY);
            retryScrollViewRef.scrollTo({
              y: Math.max(0, retryCardY - 20),
              animated: true,
            });
          }
        }
      }, 300);
    }
  }, []);
  
  // Navigation functions
  const goToPreviousWeek = useCallback(() => {
    if (!currentWeekStartStr) return;
    
    const currentWeekStart = parseISO(currentWeekStartStr);
    const prevWeekStart = addWeeks(currentWeekStart, -1);
    const prevWeekStartStr = format(startOfWeek(prevWeekStart, { weekStartsOn: 1 }), 'yyyy-MM-dd');
    
    if (!isDateInWeeklyRange(prevWeekStart)) {
      showToast('info', '범위 제한', '최대로 이동하였습니다.');
      return;
    }
    
    const targetIndex = weekPagesMap.get(prevWeekStartStr);
    if (targetIndex !== undefined) {
      flatListRef.current?.scrollToIndex({
        index: targetIndex,
        animated: true,
      });
    }
  }, [currentWeekStartStr, weekPagesMap]);
  
  const goToNextWeek = useCallback(() => {
    if (!currentWeekStartStr) return;
    
    const currentWeekStart = parseISO(currentWeekStartStr);
    const nextWeekStart = addWeeks(currentWeekStart, 1);
    const nextWeekStartStr = format(startOfWeek(nextWeekStart, { weekStartsOn: 1 }), 'yyyy-MM-dd');
    
    if (!isDateInWeeklyRange(nextWeekStart)) {
      showToast('info', '범위 제한', '최대로 이동하였습니다.');
      return;
    }
    
    const targetIndex = weekPagesMap.get(nextWeekStartStr);
    if (targetIndex !== undefined) {
      flatListRef.current?.scrollToIndex({
        index: targetIndex,
        animated: true,
      });
    }
  }, [currentWeekStartStr, weekPagesMap]);

  // Handle task edit
  const handleTaskEdit = useCallback((task: any) => {
    if (Platform.OS === 'ios') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    }
    setEditingTask(task);
    setIsEditTaskModalVisible(true);
  }, []);

  // Make handleTaskEdit globally available for WeekPageComponent
  useEffect(() => {
    (globalThis as any).handleTaskEdit = handleTaskEdit;
    return () => {
      delete (globalThis as any).handleTaskEdit;
    };
  }, [handleTaskEdit]);

  // Handle task update
  const handleTaskUpdate = useCallback(() => {
    // Refresh data after update
    queryClient.invalidateQueries({ queryKey: ['tasks', 'unified'] });
  }, [queryClient]);

  // Go to this week (today)
  const goToThisWeek = useCallback(() => {
    const targetIndex = weekPagesMap.get(THIS_WEEK_START_STR);
    if (targetIndex !== undefined) {
      flatListRef.current?.scrollToIndex({
        index: targetIndex,
        animated: true,
      });
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
      
      // After scrolling to this week, scroll to today's date card
      // Use a delay to ensure the week page is rendered and card positions are measured
      setTimeout(() => {
        scrollToTodayInWeek(THIS_WEEK_START_STR);
      }, 500);
    }
  }, [weekPagesMap, THIS_WEEK_START_STR, scrollToTodayInWeek]);
  
  // Handle date card press
  const handleDateCardPress = useCallback((dateStr: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    router.push({
      pathname: '/day',
      params: { jumpToDate: dateStr },
    });
  }, [router]);
  
  // Pull-to-refresh
  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    // Force re-initialization to reload all tasks (including new group tasks)
    await initializeCalendar(true);
    setRefreshing(false);
  }, [initializeCalendar]);
  
  // Auto-refresh on focus
  useFocusEffect(
    useCallback(() => {
      initializeCalendar();
    }, [initializeCalendar])
  );

  // Copy visible week to next week (이번주 또는 미래주에서 해당 주 → 다음 주로 복사)
  const runCopyWeekToNext = useCallback(async () => {
    setCopyInProgress(true);
    const weekStart = parseISO(currentWeekStartStr);
    const weekEnd = endOfWeek(weekStart, { weekStartsOn: 1 });
    const weekEndStr = format(weekEnd, 'yyyy-MM-dd');

    const sourceWeekTasks = tasks.filter(
      t => t.due_date && t.due_date >= currentWeekStartStr && t.due_date <= weekEndStr
    );

    const now = new Date().toISOString();
    const nextWeekDate = (d: string) => format(addWeeks(parseISO(d), 1), 'yyyy-MM-dd');
    const optimisticTasks = sourceWeekTasks.map((t, i) => {
      const { isOverdue, daysOverdue, ...rest } = t as any;
      return {
        ...rest,
        id: `opt-copy-${Date.now()}-${i}`,
        due_date: nextWeekDate(t.due_date!),
        original_due_date: nextWeekDate(t.due_date!),
        status: 'TODO' as const,
        completed_at: null,
        created_at: now,
        updated_at: now,
        assignees: (t.assignees ?? []).map((a: any) => ({ ...a, is_completed: false, completed_at: null })),
      };
    });

    if (optimisticTasks.length > 0) {
      mergeTasksIntoStore(optimisticTasks);
    }

    const { error } = await duplicateTasksToNextWeek(weekStart, weekEnd);
    setCopyInProgress(false);

    if (error) {
      if (optimisticTasks.length > 0) rollbackCopyWeek();
      showToast('error', 'Copy failed', error?.message ?? 'Something went wrong.');
      return;
    }
    showToast('success', 'Done', 'Copy completed.');
    queryClient.invalidateQueries({ queryKey: ['tasks', 'unified'] });
    initializeCalendar();
  }, [currentWeekStartStr, tasks, mergeTasksIntoStore, rollbackCopyWeek, queryClient, initializeCalendar]);

  const handleCopyWeekToNext = useCallback(() => {
    if (Platform.OS === 'ios') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    }
    const title = 'Copy to next week';
    const message = "Copy this week's schedule to the same weekdays next week. Continue?";
    if (Platform.OS === 'web') {
      if (typeof window !== 'undefined' && window.confirm(`${title}\n\n${message}`)) {
        runCopyWeekToNext();
      }
      return;
    }
    Alert.alert(title, message, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'OK', onPress: runCopyWeekToNext },
    ]);
  }, [runCopyWeekToNext]);

  // Handle quick add task
  const handleQuickAdd = (dateStr: string) => {
    if (Platform.OS === 'ios') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    }
    setAddTaskInitialDate(dateStr);
    setIsAddTaskModalVisible(true);
  };
  
  // Render week page
  const renderWeekPage = ({ item }: { item: WeekPage }) => {
    const pageWidth = Platform.OS === 'web' ? Math.min(SCREEN_WIDTH, 600) : SCREEN_WIDTH;
    
    return (
      <WeekPageComponent
        item={item}
        pageWidth={pageWidth}
        scrollViewRefs={scrollViewRefs}
        cardPositions={cardPositions}
        isLoading={isLoading}
        refreshing={refreshing}
        onRefresh={onRefresh}
        onDateCardPress={handleDateCardPress}
        scrollToTodayInWeek={scrollToTodayInWeek}
        onQuickAdd={handleQuickAdd}
        updateTaskInStore={updateTaskInStore}
        toggleTaskCompleteInStore={toggleTaskCompleteInStore}
        deleteTaskInStore={deleteTaskInStore}
        onTaskEdit={handleTaskEditForWeek}
        thisWeekStartStr={THIS_WEEK_START_STR}
        currentWeekStartStr={currentWeekStartStr}
      />
    );
  };

  // Local task edit handler for WeekPageComponent
  const handleTaskEditForWeek = useCallback((task: any) => {
    console.log('handleTaskEditForWeek called:', task);
    handleTaskEdit(task);
  }, [handleTaskEdit]);
  
  // Calculate progress
  const todayStr = format(startOfDay(new Date()), 'yyyy-MM-dd');
  // 항상 "오늘(이번 주 오늘)" 데이터 — 지난주/미래주 카드의 오른쪽 Today's Progress용
  const thisWeekPage = weekPages.find(p => p.weekStartStr === THIS_WEEK_START_STR);
  const todayGroupFromThisWeek = thisWeekPage?.dailyGroups.find(g => g.date === todayStr);
  const todayTasksFromThisWeek = todayGroupFromThisWeek?.tasks || [];
  const todayCompleted = todayTasksFromThisWeek.filter(t => t.status === 'DONE').length;
  const todayTotal = todayTasksFromThisWeek.length;

  let progressTitle = '';
  let progressText = '';
  let progressPercent = 0;
  let totalTasks = 0;
  let completedTasks = 0;
  let weekLeftTitle = '';
  let weekLeftValue = '';
  let weekRightTitle = '';
  let weekRightValue = '';

  if (isCurrentWeek) {
    completedTasks = todayCompleted;
    totalTasks = todayTotal;
    progressTitle = "Today's Progress";
    progressText = `${completedTasks}/${totalTasks} Completed`;
    progressPercent = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;
  } else if (isPastWeek) {
    const allWeekTasks = currentWeekPage?.dailyGroups.flatMap(g => g.tasks) || [];
    completedTasks = allWeekTasks.filter(t => t.status === 'DONE').length;
    totalTasks = allWeekTasks.length;
    weekLeftTitle = 'Week completed';
    weekLeftValue = `${completedTasks} completed`;
    weekRightTitle = "Today's Progress";
    weekRightValue = `${todayCompleted}/${todayTotal} completed`;
    progressPercent = 0;
  } else if (isFutureWeek) {
    const allWeekTasks = currentWeekPage?.dailyGroups.flatMap(g => g.tasks) || [];
    totalTasks = allWeekTasks.length;
    weekLeftTitle = 'Week scheduled';
    weekLeftValue = `${totalTasks} scheduled`;
    weekRightTitle = "Today's Progress";
    weekRightValue = `${todayCompleted}/${todayTotal} completed`;
    progressPercent = 0;
  }

  const pageWidth = Platform.OS === 'web' ? Math.min(SCREEN_WIDTH, 600) : SCREEN_WIDTH;
  
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }}>
      <AppHeader onNotificationPress={() => setIsNotificationModalVisible(true)} />
      
      {/* Notification Center Modal */}
      <NotificationCenterModal
        visible={isNotificationModalVisible}
        onClose={() => setIsNotificationModalVisible(false)}
      />
      
      {/* 상단 영역: 테스크 영역과 동일한 가로 폭(pageWidth + padding 16) */}
      <View style={[ { width: pageWidth, alignSelf: 'center' as const }, Platform.OS === 'web' && { maxWidth: 600 } ]}>
      {/* Week Progress Card - 이번주: Today+%+바 / 지난주·미래주: 왼쪽 Week completed|scheduled, 오른쪽 Today's Progress */}
      <View 
        style={[
          {
            backgroundColor: colors.primary,
            marginHorizontal: 16,
            marginTop: 8,
            marginBottom: 10,
            paddingHorizontal: 16,
            paddingVertical: 12,
            borderRadius: borderRadius.xl,
            minHeight: 104,
            ...shadows.sm,
          },
        ]}
      >
        {isCurrentWeek ? (
          <>
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', minHeight: 64 }}>
              <View style={{ flex: 1 }}>
                <Text style={{ fontSize: 14, fontWeight: '500', color: colors.primaryForeground, opacity: 0.9 }}>
                  {progressTitle}
                </Text>
                <Text style={{ fontSize: 18, fontWeight: '700', color: colors.primaryForeground, marginTop: 2 }}>
                  {progressText}
                </Text>
              </View>
              <View
                style={{
                  width: 64,
                  height: 64,
                  borderRadius: borderRadius.full,
                  backgroundColor: 'rgba(255, 255, 255, 0.25)',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <Text style={{ fontSize: 18, fontWeight: '700', color: colors.primaryForeground }}>
                  {progressPercent}%
                </Text>
              </View>
            </View>
            <View
              style={{
                height: 6,
                marginTop: 10,
                borderRadius: borderRadius.full,
                backgroundColor: 'rgba(255, 255, 255, 0.2)',
                overflow: 'hidden',
              }}
            >
              <View
                style={{
                  height: '100%',
                  width: `${progressPercent}%`,
                  backgroundColor: colors.primaryForeground,
                  borderRadius: borderRadius.full,
                }}
              />
            </View>
          </>
        ) : (
          <View style={{ flexDirection: 'row', alignItems: 'stretch', minHeight: 64 }}>
            <View style={{ flex: 1, justifyContent: 'center' }}>
              <Text style={{ fontSize: 14, fontWeight: '500', color: colors.primaryForeground, opacity: 0.9 }}>
                {weekLeftTitle}
              </Text>
              <Text style={{ fontSize: 18, fontWeight: '700', color: colors.primaryForeground, marginTop: 2 }}>
                {weekLeftValue}
              </Text>
            </View>
            <View
              style={{
                width: 1,
                backgroundColor: 'rgba(255, 255, 255, 0.3)',
                marginVertical: 4,
                marginHorizontal: 16,
              }}
            />
            <View style={{ flex: 1, justifyContent: 'center' }}>
              <Text style={{ fontSize: 14, fontWeight: '500', color: colors.primaryForeground, opacity: 0.9 }}>
                {weekRightTitle}
              </Text>
              <Text style={{ fontSize: 18, fontWeight: '700', color: colors.primaryForeground, marginTop: 2 }}>
                {weekRightValue}
              </Text>
            </View>
          </View>
        )}
      </View>
      
      {/* Week Navigator - 테스크 영역과 동일 가로 여백 */}
      <View 
        style={{
          backgroundColor: colors.background,
          paddingHorizontal: 16,
          paddingVertical: 14,
          borderBottomWidth: 1,
          borderBottomColor: colors.borderLight,
        }}
      >
        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
          <View style={{ flex: 1 }} />
          <Text style={{ fontSize: 18, fontWeight: '600', color: colors.textMain }}>
            {currentWeekDisplay}
          </Text>
          <View style={{ flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end', gap: 8 }}>
            {!isCurrentWeek && (
              <Pressable
                onPress={goToThisWeek}
                disabled={isLoading}
                hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
                style={{
                  backgroundColor: colors.primary,
                  paddingHorizontal: 10,
                  paddingVertical: 6,
                  borderRadius: borderRadius.md,
                }}
              >
                <Text style={{ fontSize: 14, fontWeight: '600', color: colors.primaryForeground }}>
                  Today
                </Text>
              </Pressable>
            )}
            {(isCurrentWeek || isFutureWeek) && (
              <Pressable
                onPress={handleCopyWeekToNext}
                disabled={copyInProgress || isLoading}
                hitSlop={{ top: 16, bottom: 16, left: 16, right: 16 }}
                style={{
                  backgroundColor: colors.primary,
                  padding: 6,
                  borderRadius: borderRadius.md,
                  opacity: copyInProgress ? 0.6 : 1,
                }}
              >
                <Repeat size={20} color={colors.primaryForeground} strokeWidth={2} />
              </Pressable>
            )}
          </View>
        </View>
      </View>
      </View>
      
      {/* Horizontal Week Paging View (or skeleton while loading) */}
      <View 
        style={{
          flex: 1,
          height: Platform.OS === 'web' ? AVAILABLE_HEIGHT : undefined,
          ...(Platform.OS === 'web' && { maxWidth: 600, width: '100%', alignSelf: 'center' }),
        }}
      >
        {isLoading ? (
          <View style={{ flex: 1 }}>
            <TaskListSkeleton />
          </View>
        ) : (
        <FlatList
          ref={flatListRef}
          data={weekPages}
          renderItem={renderWeekPage}
          keyExtractor={(item) => item.weekStartStr}
          horizontal
          pagingEnabled
          showsHorizontalScrollIndicator={false}
          onViewableItemsChanged={onViewableItemsChanged}
          viewabilityConfig={viewabilityConfig}
          getItemLayout={(_, index) => ({
            length: Platform.OS === 'web' ? Math.min(SCREEN_WIDTH, 600) : SCREEN_WIDTH,
            offset: (Platform.OS === 'web' ? Math.min(SCREEN_WIDTH, 600) : SCREEN_WIDTH) * index,
            index,
          })}
          initialScrollIndex={initialScrollIndex}
          onScrollToIndexFailed={(info) => {
            setTimeout(() => {
              flatListRef.current?.scrollToIndex({
                index: info.index,
                animated: false,
              });
            }, 100);
          }}
          // Performance optimizations
          initialNumToRender={3}
          maxToRenderPerBatch={2}
          windowSize={5}
          removeClippedSubviews={Platform.OS !== 'web'}
          updateCellsBatchingPeriod={50}
        />
        )}
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
      
      {/* Edit Task Modal */}
      <EditTaskBottomSheet
        visible={isEditTaskModalVisible}
        onClose={() => setIsEditTaskModalVisible(false)}
        task={editingTask || {}}
        onUpdate={handleTaskUpdate}
      />
    </SafeAreaView>
  );
}

// Week Page Component (Memoized for performance)
const WeekPageComponent = React.memo(function WeekPageComponent({
  item,
  pageWidth,
  scrollViewRefs,
  cardPositions,
  isLoading,
  refreshing,
  onRefresh,
  onDateCardPress,
  scrollToTodayInWeek,
  onQuickAdd,
  updateTaskInStore,
  toggleTaskCompleteInStore,
  deleteTaskInStore,
  onTaskEdit,
  thisWeekStartStr,
  currentWeekStartStr,
}: {
  item: WeekPage;
  pageWidth: number;
  scrollViewRefs: React.MutableRefObject<Map<string, ScrollView>>;
  cardPositions: React.MutableRefObject<Map<string, number>>;
  isLoading: boolean;
  refreshing: boolean;
  onRefresh: () => void;
  onDateCardPress: (date: string) => void;
  scrollToTodayInWeek: (weekStartStr: string) => void;
  onQuickAdd: (dateStr: string) => void;
  updateTaskInStore: (taskId: string, updateFields: any) => Promise<{ success: boolean; error?: string }>;
  toggleTaskCompleteInStore: (taskId: string) => Promise<{ success: boolean; error?: string }>;
  deleteTaskInStore: (taskId: string) => Promise<{ success: boolean; error?: string }>;
  onTaskEdit: (task: any) => void;
  thisWeekStartStr: string;
  currentWeekStartStr: string;
}) {
  // Local handler for task edit
  const handleTaskEditLocal = useCallback((task: any) => {
    console.log('handleTaskEditLocal called:', task);
    if (onTaskEdit) {
      onTaskEdit(task);
    }
  }, [onTaskEdit]);

  console.log('WeekPageComponent props:', { onTaskEdit: typeof onTaskEdit });
  const scrollViewRef = useRef<ScrollView>(null);
  const hasAutoScrolled = useRef(false);
  
  // Store ref for this week's ScrollView
  useEffect(() => {
    if (scrollViewRef.current) {
      scrollViewRefs.current.set(item.weekStartStr, scrollViewRef.current);
    }
    return () => {
      scrollViewRefs.current.delete(item.weekStartStr);
    };
  }, [item.weekStartStr, scrollViewRefs]);
  
  // Auto-scroll to today ONLY ONCE when this week is visible
  useEffect(() => {
    const todayStr = format(startOfDay(new Date()), 'yyyy-MM-dd');
    const isThisWeek = item.weekStartStr === thisWeekStartStr;
    const isCurrentlyVisible = item.weekStartStr === currentWeekStartStr;
    
    // Add debug logging
    console.log('Auto-scroll check:', {
      isThisWeek,
      isCurrentlyVisible,
      hasAutoScrolled: hasAutoScrolled.current,
      hasScrollViewRef: !!scrollViewRef.current,
      weekStartStr: item.weekStartStr,
      thisWeekStartStr,
      currentWeekStartStr
    });
    
    if (isThisWeek && isCurrentlyVisible && !hasAutoScrolled.current && scrollViewRef.current) {
      const timeoutId = setTimeout(() => {
        console.log('Attempting to scroll to today...');
        scrollToTodayInWeek(item.weekStartStr);
        hasAutoScrolled.current = true;
      }, 800); // Increased delay for better reliability
      return () => clearTimeout(timeoutId);
    }
  }, [item.weekStartStr, thisWeekStartStr, currentWeekStartStr, scrollToTodayInWeek]);
  
  return (
    <View style={{ width: pageWidth, height: Platform.OS === 'web' ? AVAILABLE_HEIGHT : undefined, backgroundColor: colors.background, flex: Platform.OS === 'web' ? undefined : 1 }}>
      <ScrollView 
        ref={scrollViewRef}
        style={Platform.OS === 'web' ? { height: AVAILABLE_HEIGHT, overflow: 'auto' as any } : { flex: 1 }}
        contentContainerStyle={{
          paddingHorizontal: 16,
          paddingVertical: 16,
          paddingBottom: Platform.OS === 'web' ? 280 : 120,
        }}
        showsVerticalScrollIndicator={Platform.OS === 'web'}
        scrollEnabled={true}
        bounces={true}
        keyboardShouldPersistTaps="handled"
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
            onPress={() => onDateCardPress(group.date)}
            weekStartStr={item.weekStartStr}
            cardPositions={cardPositions}
            onQuickAdd={onQuickAdd}
            updateTaskInStore={updateTaskInStore}
            toggleTaskCompleteInStore={toggleTaskCompleteInStore}
            deleteTaskInStore={deleteTaskInStore}
          />
        ))}
      </ScrollView>
    </View>
  );
}, (prevProps, nextProps) => {
  // Simplified comparison: only skip re-render if weekStartStr and basic props are same
  // Let React handle task changes through weekPages recalculation
  // This ensures UI updates when tasks change
  if (prevProps.item.weekStartStr !== nextProps.item.weekStartStr) return false;
  if (prevProps.isLoading !== nextProps.isLoading) return false;
  if (prevProps.refreshing !== nextProps.refreshing) return false;
  if (prevProps.currentWeekStartStr !== nextProps.currentWeekStartStr) return false;
  if (prevProps.thisWeekStartStr !== nextProps.thisWeekStartStr) return false;
  
  // Check if dailyGroups reference changed (tasks updated)
  if (prevProps.item.dailyGroups !== nextProps.item.dailyGroups) return false;
  
  return true; // Skip re-render only if all props are identical
});

// Daily Card Component (Memoized for performance)
const DailyCard = React.memo(function DailyCard({ 
  group, 
  onPress,
  weekStartStr,
  cardPositions,
  onQuickAdd,
  updateTaskInStore,
  toggleTaskCompleteInStore,
  deleteTaskInStore,
}: { 
  group: DailyGroup; 
  onPress: () => void;
  weekStartStr: string;
  cardPositions: React.MutableRefObject<Map<string, number>>;
  onQuickAdd: (dateStr: string) => void;
  updateTaskInStore: (taskId: string, updateFields: any) => Promise<{ success: boolean; error?: string }>;
  toggleTaskCompleteInStore: (taskId: string) => Promise<{ success: boolean; error?: string }>;
  deleteTaskInStore: (taskId: string) => Promise<{ success: boolean; error?: string }>;
}) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { groups } = useGroupStore();
  const { user } = useAuth();
  
  // Create groups map for O(1) lookup
  const groupsMap = useMemo(() => {
    const map = new Map<string, typeof groups[0]>();
    groups.forEach(g => map.set(g.id, g));
    return map;
  }, [groups]);

  const titleLongPressHandledRef = useRef(false);
  const toggleInFlightRef = useRef(false);

  const todayDate = startOfDay(new Date());
  const today = format(todayDate, 'yyyy-MM-dd');
  const isToday = group.date === today;
  const isPast = group.dateObj < todayDate;

  // Show all tasks
  const visibleTasks = Array.isArray(group.tasks) ? group.tasks : [];

  const handleToggleComplete = async (task: TaskWithOverdue) => {
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
      const myGroup = groupsMap.get(task.group_id);
      const myRole = myGroup?.myRole;
      const newStatus: TaskStatus = task.status === 'DONE' ? 'TODO' : 'DONE';
      const shouldComplete = newStatus === 'DONE';

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
            status: newStatus,
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
            status: newStatus as TaskStatus,
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
        // Success: keep optimistic state; do not merge getTaskById to avoid late response overwriting
      } else if (user) {
        const myAssignee = task.assignees.find((a: any) => a.user_id === user.id);
        if (!myAssignee) return;
        const shouldCompleteMyTask = !myAssignee.is_completed;
        const originalTask = useCalendarStore.getState().getTaskById(task.id);

        // Optimistically update React Query cache
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

        // Optimistically update Calendar Store (for immediate UI update)
        if (originalTask) {
          const updatedAssignees = originalTask.assignees?.map((a: any) =>
            a.user_id === user.id
              ? { ...a, is_completed: shouldCompleteMyTask, completed_at: shouldCompleteMyTask ? new Date().toISOString() : null }
              : a
          ) || [];
          const allCompleted = updatedAssignees.every((a: any) => a.is_completed) ?? false;
          const optimisticTask = {
            ...originalTask,
            assignees: updatedAssignees,
            status: (allCompleted ? 'DONE' : 'TODO') as TaskStatus,
            completed_at: allCompleted ? new Date().toISOString() : null,
          };
          const tasksWithRollover = calculateRolloverInfo([optimisticTask]);
          useCalendarStore.getState().mergeTasksIntoStore(tasksWithRollover);
        }

        try {
          const { error } = await toggleAssigneeCompletion(
            task.id,
            user.id,
            myAssignee.is_completed
          );
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
    const newStatus = task.status === 'DONE' ? 'TODO' : 'DONE';
    const updates: any = { status: newStatus };

    if (newStatus === 'DONE') {
      updates.completed_at = new Date().toISOString();
    } else {
      updates.completed_at = null;
    }

    if (newStatus === 'TODO' && !task.due_date) {
      const todayStr = format(new Date(), 'yyyy-MM-dd');
      updates.due_date = todayStr;
      updates.original_due_date = todayStr;
    }

    await updateTaskInStore(task.id, updates);
    } finally {
      toggleInFlightRef.current = false;
    }
  };
  
  // Memoize isLateCompletion calculation helper
  const calculateLateCompletion = useCallback((task: TaskWithOverdue): number => {
    if (task.status !== 'DONE' || !task.completed_at) return 0;
    
    const referenceDueDate = task.original_due_date || task.due_date;
    if (!referenceDueDate) return 0;
    
    const completedDate = parseISO(task.completed_at);
    const dueDate = parseISO(referenceDueDate);
    const daysLate = differenceInCalendarDays(completedDate, dueDate);
    return daysLate > 0 ? daysLate : 0;
  }, []);
  
  const handleLayout = useCallback((event: any) => {
    const { y } = event.nativeEvent.layout;
    const cardKey = `${weekStartStr}-${group.date}`;
    cardPositions.current.set(cardKey, y);
  }, [weekStartStr, group.date, cardPositions]);
  
  return (
    <View
      onLayout={handleLayout}
      style={[
        {
          borderRadius: borderRadius.lg,
          marginBottom: 12,
          overflow: 'hidden',
        },
        isToday && {
          backgroundColor: '#EFF6FF',
          borderColor: 'rgba(59, 130, 246, 0.3)',
          borderWidth: 2,
          ...shadows.lg,
          shadowColor: colors.primary,
          shadowOpacity: 0.1,
        },
        !isToday && {
          backgroundColor: colors.card,
          borderWidth: 1,
          borderColor: 'rgba(229, 231, 235, 0.5)',
          ...shadows.sm,
        },
      ]}
    >
      {/* Card Header */}
      <Pressable
        onPress={onPress}
        hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        pressRetentionOffset={{ top: 20, bottom: 20, left: 20, right: 20 }}
        style={{
          padding: 16,
          borderTopLeftRadius: borderRadius.lg,
          borderTopRightRadius: borderRadius.lg,
          backgroundColor: isToday ? '#EFF6FF' : undefined,
        }}
      >
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1 }}>
            <Text style={{ fontSize: 16, fontWeight: '600', color: isToday ? colors.primary : colors.textMain, marginRight: 12 }}>
              {String(group.displayDate)}
            </Text>
          </View>
          
          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            {group.totalCount > 0 ? (
              <Text style={{ fontSize: 14, color: colors.textSub, marginRight: 8 }}>
                <Text style={isToday ? { color: colors.primary, fontWeight: '500' } : undefined}>
                  {String(group.completedCount)}
                </Text>
                /{String(group.totalCount)}
              </Text>
            ) : null}
            
            <ChevronRight size={20} color={colors.textSub} strokeWidth={2} />
          </View>
        </View>
      </Pressable>
      
      {/* Card Body */}
      <View style={{ paddingHorizontal: 16, paddingBottom: Platform.OS === 'web' ? 24 : 16 }}>
        {visibleTasks.length === 0 ? (
          <View style={{ paddingVertical: 4 }}>
            {!isPast ? (
              <View style={{ alignItems: 'center', justifyContent: 'center', paddingVertical: 20, paddingHorizontal: 16 }}>
                <Text style={{ fontSize: 14, color: colors.textSub, marginBottom: 12 }}>
                  No tasks scheduled
                </Text>
                <Pressable
                  onPress={() => onQuickAdd(group.date)}
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
          <View>
            {visibleTasks.map((task, index) => {
              const isDone = task.status === 'DONE';
              const isCancelled = task.status === 'CANCEL';
              const isTodo = task.status === 'TODO';
              const isOverdue = task.isOverdue === true && task.daysOverdue && task.daysOverdue > 0;
              
              // Use memoized calculation
              const isLateCompletion = calculateLateCompletion(task);
              
              // Swipe actions: Completed → 미완료 / Not completed → Backlog | Delete
              const renderRightActions = () => (
                <View style={{ flexDirection: 'row', alignItems: 'stretch', gap: 2, marginBottom: index < visibleTasks.length - 1 ? 8 : 0 }}>
                  {isDone ? (
                    <Pressable
                      onPress={() => handleToggleComplete(task)}
                      style={{
                        backgroundColor: colors.gray500,
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
                      onPress={async () => {
                        await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                        await updateTaskInStore(task.id, { due_date: null });
                        const { error } = await moveTaskToBacklog(task.id);
                        if (error) {
                          const errorMsg = error.message?.includes('permission') || error.code === '42501'
                            ? 'Permission denied. Only OWNER/ADMIN can modify this task.'
                            : 'Could not move to backlog';
                          showToast('error', 'Failed', errorMsg);
                          queryClient.invalidateQueries({ queryKey: ['tasks'] });
                        } else {
                          showToast('success', 'Moved', 'Task moved to backlog');
                          queryClient.invalidateQueries({ queryKey: ['tasks', 'backlog'] });
                        }
                      }}
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
              
              return (
                <Swipeable
                  key={task.id}
                  renderRightActions={renderRightActions}
                  overshootRight={false}
                  overshootLeft={false}
                  friction={2}
                  rightThreshold={40}
                >
                  <View
                    style={[
                    {
                      borderRadius: borderRadius.lg,
                      marginBottom: index < visibleTasks.length - 1 ? 8 : 0,
                    },
                    isDone && { backgroundColor: '#F8FAFC' },
                    !isDone && {
                      backgroundColor: colors.card,
                      borderWidth: 1,
                      borderColor: 'rgba(229, 231, 235, 0.5)',
                      ...shadows.sm,
                    },
                    (isOverdue && isTodo) ? {
                      backgroundColor: '#FEF2F2',
                      borderColor: colors.error,
                    } : {},
                  ]}
                >
                  <View style={{ paddingHorizontal: 12, paddingVertical: 12 }}>
                    {/* First line: Checkbox + Title + Delay Badge */}
                    <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 12 }}>
                      <Pressable
                        onPress={() => handleToggleComplete(task)}
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
                          isDone && { backgroundColor: colors.success, borderColor: colors.success },
                          isCancelled && { backgroundColor: colors.gray300, borderColor: colors.gray300 },
                          !isDone && !isCancelled && { borderColor: 'rgba(156, 163, 175, 0.3)' },
                        ]}
                      >
                        {isDone && <Check size={10} color="#FFFFFF" strokeWidth={3} />}
                        {isCancelled && <Text style={{ color: '#fff', fontSize: 9, fontWeight: '600' }}>✕</Text>}
                      </Pressable>
                      
                      <View style={{ flex: 1, minWidth: 0 }}>
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                          <Pressable
                            onPress={() => {
                              if (titleLongPressHandledRef.current) {
                                titleLongPressHandledRef.current = false;
                                return;
                              }
                              handleToggleComplete(task);
                            }}
                            onLongPress={() => {
                              titleLongPressHandledRef.current = true;
                              const globalHandler = (globalThis as any).handleTaskEdit;
                              if (typeof globalHandler === 'function') globalHandler(task);
                            }}
                            style={{ flex: 1, minWidth: 0 }}
                            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                            pressRetentionOffset={{ top: 20, bottom: 20, left: 20, right: 20 }}
                          >
                            <Text 
                              numberOfLines={1}
                              ellipsizeMode="tail"
                              style={[
                                { fontSize: 14, fontWeight: '500' },
                                isDone && { color: colors.textSub, textDecorationLine: 'line-through' },
                                isCancelled && { color: colors.textDisabled, textDecorationLine: 'line-through' },
                                !isDone && !isCancelled && { color: colors.textMain },
                              ]}
                            >
                              {String(task.title || '(Untitled)')}
                            </Text>
                          </Pressable>
                          
                          {((isOverdue && isTodo && task.daysOverdue && task.daysOverdue > 0) || (isDone && isLateCompletion > 0)) && (
                            <View style={{ backgroundColor: 'rgba(245, 158, 11, 0.2)', paddingHorizontal: 8, paddingVertical: 2, borderRadius: borderRadius.full, flexShrink: 0 }}>
                              <Text style={{ color: '#92400E', fontSize: 10, fontWeight: '600' }}>
                                +{isDone ? isLateCompletion : task.daysOverdue}
                              </Text>
                            </View>
                          )}
                        </View>
                      </View>
                    </View>
                    
                    {/* Second line: Badges (Assignees + Group + Time + Backlog) - shown for both TODO and DONE */}
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap', marginTop: 8, marginLeft: 36 }}>
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
                      
                      {task.group_id && (() => {
                        const groupName = groupsMap.get(task.group_id)?.name;
                        return groupName ? (
                          <View style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: colors.gray100, paddingHorizontal: 6, paddingVertical: 2, borderRadius: borderRadius.sm, flexShrink: 0, maxWidth: 100 }}>
                            <Users size={10} color={colors.textSub} strokeWidth={2} />
                            <Text style={{ fontSize: 10, fontWeight: '500', color: colors.textSub, marginLeft: 2 }} numberOfLines={1} ellipsizeMode="tail">
                              {String(groupName)}
                            </Text>
                          </View>
                        ) : null;
                      })()}
                      
                      {(task.due_time || task.due_time_end) && (
                        <View style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: colors.gray100, paddingHorizontal: 6, paddingVertical: 2, borderRadius: borderRadius.sm, flexShrink: 0 }}>
                          <Clock size={10} color={colors.textSub} strokeWidth={2} />
                          <Text style={{ fontSize: 10, fontWeight: '500', color: colors.textSub, marginLeft: 2 }}>
                            {String(formatTimeRange(task.due_time, task.due_time_end ?? null) || '')}
                          </Text>
                        </View>
                      )}
                      
                      {!task.due_date && (
                        <View style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: colors.gray100, paddingHorizontal: 6, paddingVertical: 2, borderRadius: borderRadius.sm, flexShrink: 0 }}>
                          <Package size={10} color={colors.textSub} strokeWidth={2} />
                          <Text style={{ fontSize: 10, fontWeight: '500', color: colors.textSub, marginLeft: 2 }}>
                            Backlog
                          </Text>
                        </View>
                      )}
                    </View>
                  </View>
                </View>
                </Swipeable>
              );
            })}
            
            {!isPast && visibleTasks.length > 0 && (
              <Pressable
                onPress={() => onQuickAdd(group.date)}
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
          </View>
        )}
      </View>
    </View>
  );
}, (prevProps, nextProps) => {
  // Simplified comparison: check reference equality first
  // If tasks array reference changed, re-render (this happens when store updates)
  if (prevProps.group.tasks !== nextProps.group.tasks) return false;
  
  // Then check other props
  if (prevProps.group.date !== nextProps.group.date) return false;
  if (prevProps.group.completedCount !== nextProps.group.completedCount) return false;
  if (prevProps.group.totalCount !== nextProps.group.totalCount) return false;
  if (prevProps.weekStartStr !== nextProps.weekStartStr) return false;
  
  return true; // Skip re-render only if all props are identical
});

const styles = {
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  card: {
    backgroundColor: colors.card,
    borderRadius: borderRadius.lg,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: 'rgba(229, 231, 235, 0.5)',
    ...shadows.sm,
    overflow: 'hidden',
  },
  cardToday: {},
  weekTaskCard: {
    backgroundColor: colors.card,
    borderRadius: borderRadius.lg,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: colors.border,
    ...shadows.sm,
  },
  weekTaskCardOverdue: {
    backgroundColor: '#FEF2F2',
    borderColor: colors.error,
  },
};
