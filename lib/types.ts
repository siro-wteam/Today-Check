/**
 * Database Types for Today-Check App
 */

// Task status enum
export type TaskStatus = 'TODO' | 'DONE' | 'CANCEL';

// Main Task type matching the database schema
export interface Task {
  id: string;
  user_id: string;
  title: string;
  status: TaskStatus;
  due_date: string | null; // ISO date string (YYYY-MM-DD) or null for Backlog
  due_time: string | null; // Time string (HH:MM:SS) or null
  original_due_date: string | null; // ISO date string, set once on creation
  completed_at: string | null; // ISO timestamp when task was marked as DONE
  created_at: string; // ISO timestamp
  updated_at: string; // ISO timestamp
  deleted_at: string | null; // Soft delete timestamp. NULL = active
}

// Type for creating a new task (omits auto-generated fields)
export interface CreateTaskInput {
  title: string;
  status?: TaskStatus;
  due_date?: string | null;
  due_time?: string | null;
  original_due_date?: string | null;
}

// Type for updating a task (all fields optional except id)
export interface UpdateTaskInput {
  id: string;
  title?: string;
  status?: TaskStatus;
  due_date?: string | null;
  due_time?: string | null;
  completed_at?: string | null;
  // Note: original_due_date should NOT be updated after creation
}

// Helper type for task with calculated rollover info
export interface TaskWithRollover extends Task {
  daysOverdue: number;
  isOverdue: boolean;
}

// Supabase response types
export interface SupabaseResponse<T> {
  data: T | null;
  error: Error | null;
}

export interface SupabaseListResponse<T> {
  data: T[] | null;
  error: Error | null;
}
