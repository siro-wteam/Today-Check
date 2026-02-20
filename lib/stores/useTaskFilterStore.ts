/**
 * Task list filter: by Mine (personal) or by group.
 * null = show all, 'mine' = personal only, string = that group only.
 * Toggle: tap same label again to clear filter.
 */

import { create } from 'zustand';

export type TaskFilter = null | 'mine' | string; // string = groupId

interface TaskFilterState {
  filter: TaskFilter;
  setFilter: (filter: TaskFilter) => void;
  /** Toggle: if current filter matches value, clear; else set to value */
  toggleFilter: (value: 'mine' | string) => void;
}

export const useTaskFilterStore = create<TaskFilterState>((set, get) => ({
  filter: null,
  setFilter: (filter) => set({ filter }),
  toggleFilter: (value) => {
    const current = get().filter;
    set({ filter: current === value ? null : value });
  },
}));
