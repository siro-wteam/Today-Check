/**
 * Task Store - Centralized task state management
 * Single source of truth for all task data
 */

import { create } from 'zustand';
import { getActiveTasks, getTimelineTasksWithoutEnrichment, getCompletedTasksByDateRangeWithoutEnrichment, enrichTasksWithProfiles } from '../api/tasks';
import { format, addDays } from 'date-fns';
import type { Task } from '../types';

interface TaskState {
  activeTasks: Task[];
  timelineTasks: Task[];
  isLoading: boolean;
  lastFetchTime: number | null;
  
  // Actions
  fetchActiveTasks: () => Promise<void>;
  fetchTimelineTasks: (startDate: string, endDate: string) => Promise<void>;
  fetchAllTasks: () => Promise<void>;
  invalidateTasks: () => void;
}

const CACHE_DURATION = 2 * 60 * 1000; // 2 minutes

export const useTaskStore = create<TaskState>((set, get) => ({
  activeTasks: [],
  timelineTasks: [],
  isLoading: false,
  lastFetchTime: null,

  fetchActiveTasks: async () => {
    const state = get();
    const now = Date.now();
    
    // Skip if recently fetched (within cache duration)
    if (state.lastFetchTime && (now - state.lastFetchTime) < CACHE_DURATION) {
      return;
    }

    set({ isLoading: true });

    try {
      const result = await getActiveTasks();
      if (result.data) {
        set({ 
          activeTasks: result.data, 
          lastFetchTime: now,
          isLoading: false 
        });
      }
    } catch (error) {
      console.error('Error fetching active tasks:', error);
      set({ isLoading: false });
    }
  },

  fetchTimelineTasks: async (startDate: string, endDate: string) => {
    set({ isLoading: true });

    try {
      const [timelineResult, completedResult] = await Promise.all([
        getTimelineTasksWithoutEnrichment(startDate, endDate),
        getCompletedTasksByDateRangeWithoutEnrichment(startDate, endDate),
      ]);

      if (timelineResult.data || completedResult.data) {
        // Merge and deduplicate
        const taskMap = new Map<string, Task>();
        
        timelineResult.data?.forEach(task => {
          taskMap.set(task.id, task);
        });
        
        completedResult.data?.forEach(task => {
          if (!taskMap.has(task.id)) {
            taskMap.set(task.id, task);
          }
        });

        const mergedTasks = Array.from(taskMap.values());
        
        // Enrich with profiles ONCE
        const enrichedTasks = await enrichTasksWithProfiles(mergedTasks);
        
        set({ 
          timelineTasks: enrichedTasks, 
          isLoading: false 
        });
      }
    } catch (error) {
      console.error('Error fetching timeline tasks:', error);
      set({ isLoading: false });
    }
  },

  fetchAllTasks: async () => {
    const state = get();
    const now = Date.now();
    
    // Skip if recently fetched (within cache duration)
    if (state.lastFetchTime && (now - state.lastFetchTime) < CACHE_DURATION) {
      return;
    }

    set({ isLoading: true });

    const today = new Date();
    const startDate = format(addDays(today, -7), 'yyyy-MM-dd');
    const endDate = format(addDays(today, 7), 'yyyy-MM-dd');

    try {
      await Promise.all([
        get().fetchActiveTasks(),
        get().fetchTimelineTasks(startDate, endDate),
      ]);
    } catch (error) {
      console.error('Error fetching all tasks:', error);
      set({ isLoading: false });
    }
  },

  invalidateTasks: () => {
    set({ lastFetchTime: null });
  },
}));
