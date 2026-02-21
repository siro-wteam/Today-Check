/**
 * Database Types for Today-Check App
 */

// Task status enum
export type TaskStatus = 'TODO' | 'DONE' | 'CANCEL';

// Task Assignee (from task_assignees table)
export interface TaskAssignee {
  task_id: string;
  user_id: string;
  is_completed: boolean;
  completed_at: string | null;
  created_at: string;
  // Profile info (joined)
  profile?: {
    nickname: string;
    avatar_url: string | null;
  };
}

// Main Task type matching the database schema
export interface Task {
  id: string;
  user_id: string; // Backward compatibility (deprecated, use assignees)
  creator_id: string; // User who created this task
  group_id: string | null; // NULL = personal task, NOT NULL = group task
  batch_id: string; // Groups tasks created together in a single distribution
  title: string;
  status: TaskStatus;
  due_date: string | null; // ISO date string (YYYY-MM-DD) or null for Backlog
  due_time: string | null; // Start time (HH:MM:SS) or null
  due_time_end: string | null; // End time (HH:MM:SS) or null, optional
  original_due_date: string | null; // ISO date string, set once on creation
  completed_at: string | null; // ISO timestamp when task was marked as DONE
  created_at: string; // ISO timestamp
  updated_at: string; // ISO timestamp
  deleted_at: string | null; // Soft delete timestamp. NULL = active
  // Joined data
  assignees?: TaskAssignee[]; // List of assignees with completion status
}

// Type for creating a new task (omits auto-generated fields)
export interface CreateTaskInput {
  title: string;
  status?: TaskStatus;
  due_date?: string | null;
  due_time?: string | null;
  due_time_end?: string | null;
  original_due_date?: string | null;
  group_id?: string | null; // For group tasks
  assignee_id?: string; // For personal tasks, defaults to current user
}

// Type for creating group tasks with multiple assignees (1 task -> N assignees)
export interface CreateTaskWithAssigneesInput {
  title: string;
  group_id: string;
  assignee_ids: string[]; // Array of user IDs to assign to the task
  due_date?: string | null;
  due_time?: string | null;
  due_time_end?: string | null;
}

// Type for updating a task (all fields optional except id)
export interface UpdateTaskInput {
  id: string;
  title?: string;
  status?: TaskStatus;
  due_date?: string | null;
  due_time?: string | null;
  due_time_end?: string | null;
  completed_at?: string | null;
  group_id?: string | null; // Allow changing group (null = personal task)
  // Set when scheduling from backlog; clear (null) when moving to backlog; omit when only rescheduling date
  original_due_date?: string | null;
}

// Helper type for task with calculated rollover info
export interface TaskWithRollover extends Task {
  daysOverdue: number;
  isOverdue: boolean;
}

// Helper type for task with progress info (for UI display)
export interface TaskWithProgress extends Task {
  // Progress tracking
  completedCount: number; // Number of assignees who completed
  totalCount: number; // Total number of assignees
  progressPercent: number; // 0-100
  // Current user status
  myCompletion?: boolean; // Am I completed? (if I'm an assignee)
  isMyTask: boolean; // Am I assigned to this task?
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

// Subscription tier (freemium). Payment integration can set 'paid' later.
export type SubscriptionTier = 'free' | 'paid';

// Profile Types
export interface Profile {
  id: string; // User ID (references auth.users.id)
  nickname: string;
  avatarUrl: string | null;
  subscriptionTier: SubscriptionTier;
  createdAt: string;
  updatedAt: string;
}

// Group Management Types
export type GroupRole = 'OWNER' | 'ADMIN' | 'MEMBER';

// Database schema types (from Supabase)
export interface GroupRow {
  id: string;
  name: string;
  owner_id: string;
  invite_code: string;
  image_url: string | null;
  created_at: string;
  updated_at: string;
}

export interface GroupMemberRow {
  group_id: string;
  user_id: string;
  role: GroupRole;
  profile_color: string;
  joined_at: string;
}

// Client-side types (with joined data)
export interface GroupMember {
  id: string; // User ID
  name: string; // Display name from auth.users or profile
  email?: string; // User email
  role: GroupRole;
  profileColor: string; // Color code for UI distinction
  joinedAt: string;
}

export interface Group {
  id: string;
  name: string; // e.g., "우리가족", "스터디"
  ownerId: string;
  inviteCode: string; // 6-digit random code for member invitation (OWNER only)
  imageUrl: string | null; // Public URL of group image
  members: GroupMember[];
  createdAt: string; // ISO timestamp
  updatedAt: string; // ISO timestamp
  myRole?: GroupRole; // Current user's role in this group (OWNER | MEMBER)
}

// Notification Types
export type NotificationType = 
  | 'TASK_ASSIGNED'
  | 'TASK_COMPLETED'
  | 'GROUP_INVITE'
  | 'GROUP_JOINED'
  | 'GROUP_KICKED'
  | 'GROUP_ROLE_CHANGED';

export interface Notification {
  id: string;
  user_id: string;
  actor_id: string | null;
  group_id: string | null;
  type: NotificationType;
  title: string;
  body: string;
  target_id: string | null;
  is_read: boolean;
  created_at: string;
  // Joined data (optional)
  actor?: {
    nickname: string;
    avatar_url: string | null;
  };
}
