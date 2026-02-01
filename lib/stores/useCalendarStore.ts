/**
 * Calendar Store - Shared state for Weekly and Daily views
 * 
 * Features:
 * - Weekly View Range: -2 months ~ +4 months
 * - Initial load: -2 weeks ~ +2 weeks (fast display, 5 weeks total)
 * - Background prefetch: Remaining range (-2 months ~ +4 months)
 * - Optimistic updates for task operations
 * - Shared selectedDate between Weekly and Daily views
 */

import { format, startOfDay } from 'date-fns';
import * as Haptics from 'expo-haptics';
import { Platform } from 'react-native';
import { create } from 'zustand';
import { getWeeklyCalendarRanges } from '../../constants/calendar';
import { showToast } from '../../utils/toast';
import { calculateRolloverInfo, createTask, createTaskWithAssignees, deleteTask as deleteTaskAPI, getAllTasksInRange, updateTask as updateTaskAPI } from '../api/tasks';
import { queryClient } from '../query-client';
import { supabase } from '../supabase';
import type { CreateTaskInput, CreateTaskWithAssigneesInput, Task, TaskWithRollover, UpdateTaskInput } from '../types';
import { cancelAllNotificationsForTask, scheduleTaskNotification, updateTaskNotification } from '../utils/task-notifications';

interface CalendarState {
  // Data
  tasks: TaskWithRollover[];
  isLoading: boolean;
  isPrefetching: boolean;
  error: string | null;
  
  // Selected date (shared between Weekly and Daily views)
  selectedDate: Date;
  
  // Initialization flag
  isInitialized: boolean;
  
  // Actions
  initializeCalendar: (force?: boolean) => Promise<void>;
  prefetchRemainingRange: () => Promise<void>;
  setSelectedDate: (date: Date) => void;
  resetInitialization: () => void; // Reset isInitialized to force re-initialization
  
  // Optimistic updates
  updateTask: (taskId: string, updateFields: Partial<UpdateTaskInput>) => Promise<{ success: boolean; error?: string }>;
  toggleTaskComplete: (taskId: string) => Promise<{ success: boolean; error?: string }>;
  deleteTask: (taskId: string) => Promise<{ success: boolean; error?: string }>;
  addTask: (input: CreateTaskInput | CreateTaskWithAssigneesInput) => Promise<{ success: boolean; error?: string; task?: Task }>;
  
  // Public helpers (used by components for group task updates)
  mergeTasksIntoStore: (newTasks: Task[]) => void;
  getTaskById: (taskId: string) => Task | undefined;
}

export const useCalendarStore = create<CalendarState>((set, get) => ({
  tasks: [],
  isLoading: false,
  isPrefetching: false,
  error: null,
  selectedDate: startOfDay(new Date()),
  isInitialized: false,

  /**
   * Initialize calendar: Load initial range (-2 weeks ~ +2 weeks, 5 weeks total)
   * Fast initial display for user
   * @param force - If true, re-initialize even if already initialized
   */
  initializeCalendar: async (force: boolean = false) => {
    const state = get();
    if (state.isInitialized && !force) return;
    
    // 웹 환경에서 디버깅
    if (Platform.OS === 'web') {
      console.log('🔍 initializeCalendar called:', { isInitialized: state.isInitialized, force });
    }
    
    set({ isLoading: true, error: null });
    
    try {
      const { initialLoadStart, initialLoadEnd } = getWeeklyCalendarRanges();
      const startDate = format(initialLoadStart, 'yyyy-MM-dd');
      const endDate = format(initialLoadEnd, 'yyyy-MM-dd');
      
      const result = await getAllTasksInRange(startDate, endDate);
      
      if (result.error) {
        set({ isLoading: false, error: result.error.message || 'Failed to load calendar data' });
        return;
      }
      
      const tasks = result.data || [];
      const tasksWithRollover = calculateRolloverInfo(tasks);
      
      set({
        tasks: tasksWithRollover,
        isLoading: false,
        isInitialized: true,
      });
      
      // 웹 환경에서 디버깅
      if (Platform.OS === 'web') {
        console.log('✅ initializeCalendar success:', { 
          tasksCount: tasksWithRollover.length,
          isInitialized: true 
        });
      }
      
      // Start background prefetch after initial load (silent, non-blocking)
      setTimeout(() => {
        get().prefetchRemainingRange();
      }, 500);
    } catch (error: any) {
      // 웹 환경에서 디버깅
      if (Platform.OS === 'web') {
        console.error('❌ initializeCalendar failed:', error);
      }
      
      set({ isLoading: false, error: error.message || 'Failed to initialize calendar' });
    }
  },

  /**
   * Reset initialization flag to force re-initialization
   * Useful when group membership changes
   */
  resetInitialization: () => {
    set({ isInitialized: false });
  },

  /**
   * Prefetch remaining range in background (silent)
   * Fetches: -2 months ~ initialLoadStart and initialLoadEnd ~ +4 months
   */
  prefetchRemainingRange: async () => {
    const state = get();
    if (state.isPrefetching) return;
    
    set({ isPrefetching: true });
    
    try {
      const { pastLimit, futureLimit, initialLoadStart, initialLoadEnd } = getWeeklyCalendarRanges();
      
      // Past range: pastLimit (-2 months) to initialLoadStart (-2 weeks)
      const pastRangeStart = format(pastLimit, 'yyyy-MM-dd');
      const pastRangeEnd = format(initialLoadStart, 'yyyy-MM-dd');
      
      // Future range: initialLoadEnd (+2 weeks) to futureLimit (+4 months)
      const futureRangeStart = format(initialLoadEnd, 'yyyy-MM-dd');
      const futureRangeEnd = format(futureLimit, 'yyyy-MM-dd');
      
      // Fetch both ranges in parallel (silent, non-blocking)
      const [pastResult, futureResult] = await Promise.all([
        getAllTasksInRange(pastRangeStart, pastRangeEnd),
        getAllTasksInRange(futureRangeStart, futureRangeEnd),
      ]);
      
      // Merge past tasks
      if (pastResult.data && pastResult.data.length > 0) {
        const tasksWithRollover = calculateRolloverInfo(pastResult.data);
        get().mergeTasksIntoStore(tasksWithRollover);
      }
      
      // Merge future tasks
      if (futureResult.data && futureResult.data.length > 0) {
        const tasksWithRollover = calculateRolloverInfo(futureResult.data);
        get().mergeTasksIntoStore(tasksWithRollover);
      }
    } catch (error: any) {
      console.error('Error prefetching remaining range:', error);
    } finally {
      set({ isPrefetching: false });
    }
  },

  /**
   * Set selected date (shared between Weekly and Daily views)
   */
  setSelectedDate: (date: Date) => {
    set({ selectedDate: startOfDay(date) });
  },

  /**
   * Update task with optimistic update
   */
  updateTask: async (taskId: string, updateFields: Partial<UpdateTaskInput>) => {
    const state = get();
    const task = state.getTaskById(taskId);
    
    if (!task) {
      return { success: false, error: 'Task not found' };
    }
    
    // Optimistic update: Update immediately in store
    const updatedTask = { ...task, ...updateFields };
    get().mergeTasksIntoStore([updatedTask]);
    
    // Also update React Query cache optimistically
    queryClient.setQueriesData(
      { queryKey: ['tasks', 'unified'], exact: false },
      (oldData: any) => {
        if (!oldData) return oldData;
        return oldData.map((t: any) => t.id === taskId ? { ...t, ...updateFields } : t);
      }
    );
    
    // Handle notification scheduling/updating
    // If due_date or due_time changed, update notification
    if (updateFields.due_date !== undefined || updateFields.due_time !== undefined || updateFields.status !== undefined) {
      const finalTask = { ...task, ...updateFields } as Task;
      
      // If task is completed or cancelled, cancel notification
      if (finalTask.status === 'DONE' || finalTask.status === 'CANCEL') {
        cancelAllNotificationsForTask(taskId).catch(console.error);
      } else if (finalTask.due_date && finalTask.due_time) {
        // Reschedule notification if task has due_date and due_time
        updateTaskNotification(finalTask).catch(console.error);
      } else {
        // Cancel notification if due_date or due_time is removed
        cancelAllNotificationsForTask(taskId).catch(console.error);
      }
    }
    
    try {
      // API call in background
      const result = await updateTaskAPI({ id: taskId, ...updateFields });
      
      if (result.error) {
        // Rollback on error
        get().mergeTasksIntoStore([task]);
        queryClient.setQueriesData(
          { queryKey: ['tasks', 'unified'], exact: false },
          (oldData: any) => {
            if (!oldData) return oldData;
            return oldData.map((t: any) => t.id === taskId ? task : t);
          }
        );
        showToast('error', '업데이트 실패', result.error.message || '작업을 업데이트할 수 없습니다.');
        return { success: false, error: result.error.message };
      }
      
      // Update with server response (in case server modified data)
      if (result.data) {
        get().mergeTasksIntoStore([result.data]);
        queryClient.setQueriesData(
          { queryKey: ['tasks', 'unified'], exact: false },
          (oldData: any) => {
            if (!oldData) return oldData;
            return oldData.map((t: any) => t.id === taskId ? result.data : t);
          }
        );
      }
      
      return { success: true };
    } catch (error: any) {
      // Rollback on exception
      get().mergeTasksIntoStore([task]);
      queryClient.setQueriesData(
        { queryKey: ['tasks', 'unified'], exact: false },
        (oldData: any) => {
          if (!oldData) return oldData;
          return oldData.map((t: any) => t.id === taskId ? task : t);
        }
      );
      showToast('error', '업데이트 실패', error.message || '작업을 업데이트할 수 없습니다.');
      return { success: false, error: error.message };
    }
  },

  /**
   * Toggle task complete status
   */
  toggleTaskComplete: async (taskId: string) => {
    const state = get();
    const task = state.getTaskById(taskId);
    
    if (!task) {
      return { success: false, error: 'Task not found' };
    }
    
    // Haptic feedback
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    
    // Toggle status
    const newStatus = task.status === 'DONE' ? 'TODO' : 'DONE';
    return get().updateTask(taskId, { status: newStatus });
  },

  /**
   * Delete task with optimistic update
   */
  deleteTask: async (taskId: string) => {
    const state = get();
    const task = state.getTaskById(taskId);
    
    if (!task) {
      return { success: false, error: 'Task not found' };
    }
    
    // Cancel notification for deleted task
    cancelAllNotificationsForTask(taskId).catch(console.error);
    
    // Optimistic delete: Remove immediately from store
    const tasksBeforeDelete = [...state.tasks];
    set({ tasks: state.tasks.filter(t => t.id !== taskId) });
    
    try {
      // API call in background
      const result = await deleteTaskAPI(taskId);
      
      if (result.error) {
        // Rollback on error
        set({ tasks: tasksBeforeDelete });
        showToast('error', '삭제 실패', result.error.message || '작업을 삭제할 수 없습니다.');
        return { success: false, error: result.error.message };
      }
      
      showToast('success', '삭제 완료', '작업이 삭제되었습니다.');
      return { success: true };
    } catch (error: any) {
      // Rollback on exception
      set({ tasks: tasksBeforeDelete });
      showToast('error', '삭제 실패', error.message || '작업을 삭제할 수 없습니다.');
      return { success: false, error: error.message };
    }
  },

  /**
   * Add task with optimistic update
   */
  addTask: async (input: CreateTaskInput | CreateTaskWithAssigneesInput) => {
    const state = get();
    
    // Generate temporary ID for optimistic task
    const tempId = `temp-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    
    // Get current user ID for creator_id
    const { data: { user } } = await supabase.auth.getUser();
    const creatorId = user?.id || '';
    
    // Create optimistic task object
    const optimisticTask: Task = {
      id: tempId,
      title: input.title,
      status: 'TODO' as const,
      due_date: input.due_date || null,
      due_time: input.due_time || null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      completed_at: null,
      deleted_at: null,
      user_id: creatorId, // Backward compatibility
      creator_id: creatorId,
      batch_id: `batch-${Date.now()}`, // Temporary batch ID
      group_id: 'group_id' in input && input.group_id ? input.group_id : null,
      original_due_date: input.due_date || null,
      assignees: [], // Will be populated by server response
    };
    
    // Optimistic update: Add immediately to store
    const tasksWithRollover = calculateRolloverInfo([optimisticTask]);
    get().mergeTasksIntoStore(tasksWithRollover);
    
    try {
      // Determine which API to use
      const isGroupTask = 'group_id' in input && input.group_id && 'assignee_ids' in input;
      
      let result;
      if (isGroupTask) {
        result = await createTaskWithAssignees(input as CreateTaskWithAssigneesInput);
      } else {
        result = await createTask(input as CreateTaskInput);
      }
      
      if (result.error || !result.data) {
        // Rollback on error: Remove optimistic task
        set({ tasks: state.tasks.filter(t => t.id !== tempId) });
        showToast('error', '생성 실패', result.error?.message || '작업을 생성할 수 없습니다.');
        return { success: false, error: result.error?.message };
      }
      
      // Replace optimistic task with server response (with rollover info)
      const tasksWithRolloverServer = calculateRolloverInfo([result.data]);
      // Remove optimistic task and merge server task
      const tasksWithoutOptimistic = state.tasks.filter(t => t.id !== tempId);
      set({ tasks: tasksWithoutOptimistic });
      get().mergeTasksIntoStore(tasksWithRolloverServer);
      
      // Schedule notification if task has due_date and due_time
      if (result.data.due_date && result.data.due_time) {
        scheduleTaskNotification(result.data).catch(console.error);
      }
      
      showToast('success', '생성 완료', '작업이 생성되었습니다.');
      return { success: true, task: result.data };
    } catch (error: any) {
      // Rollback on exception: Remove optimistic task
      set({ tasks: state.tasks.filter(t => t.id !== tempId) });
      showToast('error', '생성 실패', error.message || '작업을 생성할 수 없습니다.');
      return { success: false, error: error.message };
    }
  },

  /**
   * Merge new tasks into store (deduplicate by id)
   */
  mergeTasksIntoStore: (newTasks: Task[] | TaskWithRollover[]) => {
    const state = get();
    const taskMap = new Map(state.tasks.map(t => [t.id, t]));
    
    // Convert Task[] to TaskWithRollover[] if needed
    const tasksWithRollover: TaskWithRollover[] = newTasks.some(t => 'daysOverdue' in t && 'isOverdue' in t)
      ? (newTasks as TaskWithRollover[])
      : calculateRolloverInfo(newTasks as Task[]);
    
    tasksWithRollover.forEach(newTask => {
      const existingTask = taskMap.get(newTask.id);
      
      // Preserve assignees order from existing task if it exists
      if (existingTask && existingTask.assignees && newTask.assignees) {
        // Create a map of new assignees by user_id
        const newAssigneesMap = new Map(
          newTask.assignees.map((a: any) => [a.user_id, a])
        );
        
        // Preserve original order, but update with new data
        const existingAssignees = existingTask.assignees || [];
        const preservedAssignees = existingAssignees.map((existingAssignee: any) => {
          const newAssignee = newAssigneesMap.get(existingAssignee.user_id);
          return newAssignee || existingAssignee;
        });
        
        // Add any new assignees that weren't in the original (shouldn't happen often)
        const newAssignees = newTask.assignees || [];
        newAssignees.forEach((newAssignee: any) => {
          if (!existingAssignees.some((a: any) => a.user_id === newAssignee.user_id)) {
            preservedAssignees.push(newAssignee);
          }
        });
        
        // Update task with preserved assignees order
        taskMap.set(newTask.id, {
          ...newTask,
          assignees: preservedAssignees,
        });
      } else {
        // No existing task or no assignees, just use new task as-is
        taskMap.set(newTask.id, newTask);
      }
    });
    
    set({ tasks: Array.from(taskMap.values()) });
  },

  /**
   * Get task by ID
   */
  getTaskById: (taskId: string) => {
    const state = get();
    return state.tasks.find(t => t.id === taskId) as TaskWithRollover | undefined;
  },
}));
