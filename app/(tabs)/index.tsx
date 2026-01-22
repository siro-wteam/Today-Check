import { AppHeader } from '@/components/AppHeader';
import { EmptyState } from '@/components/EmptyState';
import { colors, borderRadius, shadows, spacing } from '@/constants/colors';
import { updateTask } from '@/lib/api/tasks';
import { signOut } from '@/lib/hooks/use-auth';
import { useTimelineTasks } from '@/lib/hooks/use-timeline-tasks';
import type { Task } from '@/lib/types';
import { useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { Archive, ChevronLeft, ChevronRight, Clock, Package, Check } from 'lucide-react-native';
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
  const scrollViewRefs = useRef<Map<string, ScrollView>>(new Map()); // Refs for each week's ScrollView
  const cardPositions = useRef<Map<string, number>>(new Map()); // Store actual Y positions of cards
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

  // Auto scroll to this week on initial load and when screen gains focus
  // Initial load: scroll to current week (no auto-scroll to today)
  useEffect(() => {
    if (!isLoading && weekPages.length > 0) {
      const timeoutId = setTimeout(() => {
        flatListRef.current?.scrollToIndex({
          index: 2, // This week is at index 2
          animated: false,
        });
        setCurrentWeekIndex(2); // Update state to match
      }, 200);
      return () => clearTimeout(timeoutId);
    }
  }, [isLoading, weekPages.length]);

  // Scroll to today's card within a specific week using actual measured positions
  const scrollToTodayInWeek = useCallback((weekStartStr: string) => {
    const scrollViewRef = scrollViewRefs.current.get(weekStartStr);
    if (!scrollViewRef) return;

    const today = format(startOfDay(new Date()), 'yyyy-MM-dd');
    const cardKey = `${weekStartStr}-${today}`;
    const cardY = cardPositions.current.get(cardKey);

    if (cardY !== undefined) {
      // Use actual measured position - offset by 10px to show header
      scrollViewRef.scrollTo({
        y: Math.max(0, cardY - 10),
        animated: true,
      });
    } else {
      // Fallback: if position not measured yet, use estimated position
      const week = weekPages.find(w => w.weekStartStr === weekStartStr);
      if (!week) return;

      const todayIndex = week.dailyGroups.findIndex(g => g.date === today);
      if (todayIndex === -1) return;

      const estimatedCardHeight = 200;
      const paddingTop = 16;
      const scrollY = paddingTop + (todayIndex * estimatedCardHeight);

      scrollViewRef.scrollTo({
        y: Math.max(0, scrollY - 10),
        animated: true,
      });
    }
  }, [weekPages, scrollViewRefs, cardPositions]);


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

  const renderWeekPage = ({ item, index }: { item: WeekPage; index: number }) => {
    const pageWidth = Platform.OS === 'web' ? Math.min(SCREEN_WIDTH, 600) : SCREEN_WIDTH;
    
    return (
      <WeekPageComponent
        item={item}
        weekIndex={index}
        currentWeekIndex={currentWeekIndex}
        pageWidth={pageWidth}
        scrollViewRefs={scrollViewRefs}
        cardPositions={cardPositions}
        isLoading={isLoading}
        refreshing={refreshing}
        onRefresh={onRefresh}
        onDateCardPress={handleDateCardPress}
        scrollToTodayInWeek={scrollToTodayInWeek}
      />
    );
  };

  if (isLoading) {
    return (
      <SafeAreaView style={styles.container}>
        <AppHeader onNotificationPress={handleNotificationPress} />
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
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
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          <Text style={{ fontSize: 40, marginBottom: 16, color: colors.textMain }}>⚠️</Text>
          <Text style={[styles.textMain, { fontSize: 16, fontWeight: '600', marginBottom: 8 }]}>
            Failed to load weeks
          </Text>
          <Text style={[styles.textSub, { textAlign: 'center', marginBottom: 16 }]}>
            {error?.message || 'Something went wrong'}
          </Text>
          <Pressable 
            onPress={() => refetch()}
            style={styles.primaryButton}
          >
            <Text style={{ color: '#FFFFFF', fontWeight: '600' }}>Try Again</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  // Calculate progress based on current week
  const todayStr = format(startOfDay(new Date()), 'yyyy-MM-dd');
  const THIS_WEEK_INDEX = 2;
  const isCurrentWeek = currentWeekIndex === THIS_WEEK_INDEX;
  const isPastWeek = currentWeekIndex < THIS_WEEK_INDEX;
  const isFutureWeek = currentWeekIndex > THIS_WEEK_INDEX;

  let progressTitle = '';
  let progressText = '';
  let progressPercent = 0;
  let totalTasks = 0;
  let completedTasks = 0;

  if (isCurrentWeek) {
    // Current week: Show today's progress
    const todayGroup = currentWeekPage?.dailyGroups.find(g => g.date === todayStr);
    const todayTasks = todayGroup?.tasks || [];
    completedTasks = todayTasks.filter(t => t.status === 'DONE').length;
    totalTasks = todayTasks.length;
    progressTitle = "Today's Progress";
    progressText = `${completedTasks}/${totalTasks} Completed`;
    progressPercent = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;
  } else if (isPastWeek) {
    // Past week: Show week's overall progress
    const allWeekTasks = currentWeekPage?.dailyGroups.flatMap(g => g.tasks) || [];
    completedTasks = allWeekTasks.filter(t => t.status === 'DONE').length;
    totalTasks = allWeekTasks.length;
    progressTitle = "Week Progress";
    progressText = `${completedTasks}/${totalTasks} Completed`;
    progressPercent = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;
  } else if (isFutureWeek) {
    // Future week: Show upcoming tasks count
    const allWeekTasks = currentWeekPage?.dailyGroups.flatMap(g => g.tasks) || [];
    totalTasks = allWeekTasks.length;
    progressTitle = "Upcoming Tasks";
    progressText = `${totalTasks} tasks`;
    progressPercent = 0; // No progress for future
  }

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <AppHeader onNotificationPress={handleNotificationPress} />

      {/* Today's Progress Card */}
      <View 
        style={[
          {
            marginHorizontal: 16,
            marginTop: 16,
            marginBottom: 8,
            borderRadius: borderRadius.lg,
            backgroundColor: colors.primary,
            padding: 20,
            ...shadows.lg,
          },
          Platform.OS === 'web' && { maxWidth: 600, width: '100%', alignSelf: 'center' },
        ]}
      >
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
          <View>
            <Text style={{ fontSize: 14, color: colors.primaryForeground, opacity: 0.9, marginBottom: 4 }}>
              {progressTitle}
            </Text>
            <Text style={{ fontSize: 24, fontWeight: '700', color: colors.primaryForeground }}>
              {progressText}
            </Text>
          </View>
          {!isFutureWeek && (
            <View 
              style={{
                width: 64,
                height: 64,
                borderRadius: borderRadius.full,
                backgroundColor: 'rgba(255, 255, 255, 0.2)',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Text style={{ fontSize: 20, fontWeight: '700', color: colors.primaryForeground }}>
                {progressPercent}%
              </Text>
            </View>
          )}
        </View>
        {/* Progress Bar - Only show for current and past weeks */}
        {!isFutureWeek && (
          <View 
            style={{
              height: 8,
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
        )}
      </View>

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
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
          {/* Previous Week Button */}
          <Pressable
            onPress={goToPreviousWeek}
            disabled={currentWeekIndex === 0}
            style={[
              { padding: 8, borderRadius: borderRadius.md, opacity: currentWeekIndex === 0 ? 0.3 : 1 },
            ]}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <ChevronLeft size={24} color={colors.textSub} strokeWidth={2} />
          </Pressable>

          {/* Week Range Display */}
          <View style={{ alignItems: 'center' }}>
            <Text style={{ fontSize: 18, fontWeight: '600', color: colors.textMain }}>
              {currentWeekDisplay}
            </Text>
          </View>

          {/* Next Week Button */}
          <Pressable
            onPress={goToNextWeek}
            disabled={currentWeekIndex === weekPages.length - 1}
            style={[
              { padding: 8, borderRadius: borderRadius.md, opacity: currentWeekIndex === weekPages.length - 1 ? 0.3 : 1 },
            ]}
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

// Week Page Component (separate component to use hooks)
function WeekPageComponent({
  item,
  weekIndex,
  currentWeekIndex,
  pageWidth,
  scrollViewRefs,
  cardPositions,
  isLoading,
  refreshing,
  onRefresh,
  onDateCardPress,
  scrollToTodayInWeek,
}: {
  item: WeekPage;
  weekIndex: number;
  currentWeekIndex: number;
  pageWidth: number;
  scrollViewRefs: React.MutableRefObject<Map<string, ScrollView>>;
  cardPositions: React.MutableRefObject<Map<string, number>>;
  isLoading: boolean;
  refreshing: boolean;
  onRefresh: () => void;
  onDateCardPress: (date: string) => void;
  scrollToTodayInWeek: (weekStartStr: string) => void;
}) {
  const scrollViewRef = useRef<ScrollView>(null);
  const THIS_WEEK_INDEX = 2; // This week is always at index 2
  
  // Store ref for this week's ScrollView
  useEffect(() => {
    if (scrollViewRef.current) {
      scrollViewRefs.current.set(item.weekStartStr, scrollViewRef.current);
    }
    return () => {
      scrollViewRefs.current.delete(item.weekStartStr);
    };
  }, [item.weekStartStr, scrollViewRefs]);

  // Auto-scroll to today ONLY when viewing the week that contains today
  useEffect(() => {
    const today = format(startOfDay(new Date()), 'yyyy-MM-dd');
    const hasToday = item.dailyGroups.some(g => g.date === today);
    
    // Only scroll if:
    // - This week contains today's date
    // - We're currently viewing this week
    // - ScrollView ref is available
    // - Not loading
    if (hasToday && currentWeekIndex === weekIndex && scrollViewRef.current && !isLoading) {
      const timeoutId = setTimeout(() => {
        scrollToTodayInWeek(item.weekStartStr);
      }, 200);
      return () => clearTimeout(timeoutId);
    }
  }, [weekIndex, currentWeekIndex, item.weekStartStr, item.dailyGroups, isLoading, scrollToTodayInWeek]);

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
        ref={scrollViewRef}
        style={Platform.OS === 'web' ? { 
          height: AVAILABLE_HEIGHT,
          overflow: 'auto' as any,
        } : { flex: 1 }}
        contentContainerStyle={{
          paddingHorizontal: 16,
          paddingVertical: 16,
          paddingBottom: Platform.OS === 'web' ? 280 : 120, // Increased for tab bar clearance on web
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
            onPress={() => onDateCardPress(group.date)}
            weekStartStr={item.weekStartStr}
            cardPositions={cardPositions}
          />
        ))}
      </ScrollView>
    </View>
  );
}

// Daily Card Component
function DailyCard({ 
  group, 
  onPress,
  weekStartStr,
  cardPositions,
}: { 
  group: DailyGroup; 
  onPress: () => void;
  weekStartStr: string;
  cardPositions: React.MutableRefObject<Map<string, number>>;
}) {
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
        alignSelf: 'stretch',
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: colors.textSub,
        borderTopLeftRadius: borderRadius.lg,
        borderBottomLeftRadius: borderRadius.lg,
      }}
    >
      <Archive size={24} color="#FFFFFF" strokeWidth={2.5} />
    </View>
  );

  // Measure card position when it's laid out
  const handleLayout = useCallback((event: any) => {
    const { y } = event.nativeEvent.layout;
    const cardKey = `${weekStartStr}-${group.date}`;
    cardPositions.current.set(cardKey, y);
  }, [weekStartStr, group.date, cardPositions]);

  return (
    <Animated.View
      onLayout={handleLayout}
      style={[
        styles.card,
        isToday && styles.cardToday,
        isToday && { 
          backgroundColor: '#EFF6FF', // Today card background color
          borderColor: 'rgba(59, 130, 246, 0.3)', // border-primary/30
          borderWidth: 2, // border-2
          ...shadows.lg, // shadow-lg
          shadowColor: colors.primary, // shadow-primary/10
          shadowOpacity: 0.1,
        },
        !isToday && {
          backgroundColor: colors.card, // bg-card
          borderWidth: 1,
          borderColor: 'rgba(229, 231, 235, 0.5)', // border-border/50
        },
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
        style={[
          {
            padding: 16, // p-4 (v0)
            borderTopLeftRadius: borderRadius.lg, // rounded-2xl top corners
            borderTopRightRadius: borderRadius.lg,
          },
          isToday && { backgroundColor: '#EFF6FF' }, // Today background color
        ]}
      >
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1 }}>
            <Text 
              style={{
                fontSize: 16, // text-base
                fontWeight: '600', // font-semibold
                color: colors.textMain, // Dark grey to match Week Navigator
                marginRight: 12, // gap-3 (12px)
              }}
            >
              {String(group.displayDate)}
            </Text>

            {/* Today Badge */}
            {isToday && (
              <View 
                style={{
                  borderRadius: borderRadius.full, // rounded-full
                  backgroundColor: colors.primary, // bg-primary
                  paddingHorizontal: 10, // px-2.5
                  paddingVertical: 2, // py-0.5
                  marginRight: 8, // gap-2
                }}
              >
                <Text style={{ 
                  fontSize: 12, // text-xs
                  fontWeight: '500', // font-medium
                  color: colors.primaryForeground // text-primary-foreground
                }}>
                  Today
                </Text>
              </View>
            )}

          </View>

          {/* Right side: Completion Badge and Navigation hint */}
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            {/* Completion Badge */}
            {group.totalCount > 0 ? (
              <Text 
                style={{
                  fontSize: 14, // text-sm
                  color: colors.textSub, // text-muted-foreground
                }}
              >
                <Text style={[
                  isToday && { color: colors.primary, fontWeight: '500' } // text-primary font-medium when today
                ]}>
                  {String(group.completedCount)}
                </Text>
                /{String(group.totalCount)}
              </Text>
            ) : null}

            {/* Navigation hint - Chevron */}
            <ChevronRight size={20} color={colors.textSub} strokeWidth={2} />
          </View>
        </View>
      </Pressable>

      {/* Card Body - Task List */}
      <View style={{ 
        paddingHorizontal: 16, 
        paddingBottom: Platform.OS === 'web' ? 24 : 16, // Extra spacing on web
      }}>
        {visibleTasks.length === 0 ? (
          <View style={{ paddingVertical: 4 }}>
            <EmptyState size="sm" message="No tasks scheduled" />
          </View>
        ) : (
          <View>
            {visibleTasks.map((task, index) => {
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
                    {
                      borderRadius: borderRadius.lg, // rounded-xl (16px in v0, but using lg for consistency)
                      marginBottom: index < visibleTasks.length - 1 ? 8 : 0, // space-y-2
                    },
                    isDone && {
                      backgroundColor: '#F8FAFC', // Completed task background
                    },
                    !isDone && {
                      backgroundColor: colors.card, // bg-card
                      borderWidth: 1,
                      borderColor: 'rgba(229, 231, 235, 0.5)', // border-border/50
                      ...shadows.sm, // shadow-sm
                    },
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
                        <View style={{ flexDirection: 'row', alignItems: 'center', padding: 12 }}>
                          {/* Checkbox */}
                          <View 
                            style={[
                              {
                                width: 24, // h-6 w-6 (v0)
                                height: 24,
                                borderRadius: borderRadius.full, // rounded-full
                                borderWidth: 2,
                                flexShrink: 0,
                                alignItems: 'center',
                                justifyContent: 'center',
                                marginRight: 12, // gap-3 (12px)
                              },
                              isDone && {
                                backgroundColor: colors.success, // border-success bg-success
                                borderColor: colors.success,
                              },
                              isCancelled && {
                                backgroundColor: colors.gray300,
                                borderColor: colors.gray300,
                              },
                              !isDone && !isCancelled && {
                                borderColor: 'rgba(156, 163, 175, 0.3)', // border-muted-foreground/30
                              },
                            ]}
                          >
                            {isDone && (
                              <Check size={14} color="#FFFFFF" strokeWidth={3} />
                            )}
                            {isCancelled && (
                              <Text style={{ color: '#fff', fontSize: 14, fontWeight: '600' }}>✕</Text>
                            )}
                          </View>

                          {/* Task Title */}
                          <Text 
                            numberOfLines={1}
                            ellipsizeMode="tail"
                            style={[
                              {
                                fontSize: 14, // text-sm
                                fontWeight: '500', // font-medium
                                flex: 1,
                                marginRight: 8,
                                color: colors.textMain, // 기본 색상 명시
                              },
                              isDone && {
                                color: colors.textSub, // text-muted-foreground
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
                            {String(task.title || '(Untitled)')}
                          </Text>

                          {/* Badges - 오른쪽 정렬 */}
                          <View style={{ flexDirection: 'row', alignItems: 'center', flexShrink: 0 }}>
                            {/* Time Badge */}
                            {task.due_time && (
                              <View style={{
                                flexDirection: 'row',
                                alignItems: 'center',
                                backgroundColor: '#F1F5F9', // Slate 100
                                paddingHorizontal: 8,
                                paddingVertical: 4,
                                borderRadius: 6, // 4-6px range
                                marginRight: 8,
                              }}>
                                <View style={{ marginRight: 4 }}>
                                  <Clock size={12} color="#475569" strokeWidth={2} />
                                </View>
                                <Text style={{
                                  fontSize: 12,
                                  fontWeight: '500',
                                  color: '#475569', // Slate 600
                                }}>
                                  {String(formatTime(task.due_time) || '')}
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
                                marginRight: 8,
                              }}>
                                <Package size={12} color="#475569" strokeWidth={2} />
                                <Text style={{
                                  fontSize: 12,
                                  fontWeight: '500',
                                  color: '#475569', // Slate 600
                                  marginLeft: 4,
                                }}>
                                  {String('Backlog')}
                                </Text>
                              </View>
                            )}

                            {/* Late Completion Badge - for DONE tasks completed after due_date */}
                            {isLateCompletion > 0 && (
                              <View style={{
                                backgroundColor: 'rgba(245, 158, 11, 0.2)', // bg-warning/20
                                paddingHorizontal: 8, // px-2
                                paddingVertical: 4, // py-1
                                borderRadius: borderRadius.sm, // rounded-md
                                marginRight: 8, // gap-2
                              }}>
                                <Text style={{ 
                                  color: colors.textMain, // text-main
                                  fontSize: 12, // text-xs
                                  fontWeight: '500' // font-medium
                                }}>
                                  +{isLateCompletion}
                                </Text>
                              </View>
                            )}

                            {/* Rollover Badge - only for overdue TODO items */}
                            {isOverdue && isTodo && task.daysOverdue && task.daysOverdue > 0 && (
                              <View style={{
                                backgroundColor: 'rgba(245, 158, 11, 0.2)', // bg-warning/20
                                paddingHorizontal: 8, // px-2
                                paddingVertical: 4, // py-1
                                borderRadius: borderRadius.sm, // rounded-md
                                marginRight: 8, // gap-2
                              }}>
                                <Text style={{ 
                                  color: colors.textMain, // text-main
                                  fontSize: 12, // text-xs
                                  fontWeight: '500' // font-medium
                                }}>
                                  +{task.daysOverdue}
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
    borderColor: 'rgba(229, 231, 235, 0.5)', // border-border/50
    ...shadows.sm,
    overflow: 'hidden', // Ensure rounded corners are preserved
  },
  cardToday: {
    // Styles applied inline for dynamic colors
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
