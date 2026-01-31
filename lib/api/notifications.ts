/**
 * Notifications API
 * Handles fetching and updating notifications from Supabase
 */

import { supabase } from '../supabase';
import type { Notification } from '../types';

/**
 * Get all notifications for the current user
 * @param limit - Maximum number of notifications to fetch (default: 50)
 * @param offset - Offset for pagination (default: 0)
 */
export async function getNotifications(
  limit: number = 50,
  offset: number = 0
): Promise<{ data: Notification[] | null; error: Error | null }> {
  try {
    const { data, error } = await supabase
      .from('notifications')
      .select('*')
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (error) {
      console.error('Error fetching notifications:', error);
      return { data: null, error: new Error(error.message) };
    }

    return { data: data as Notification[], error: null };
  } catch (err: any) {
    console.error('Exception fetching notifications:', err);
    return { data: null, error: err };
  }
}

/**
 * Get unread notifications count
 */
export async function getUnreadNotificationCount(): Promise<{ data: number | null; error: Error | null }> {
  try {
    const { count, error } = await supabase
      .from('notifications')
      .select('*', { count: 'exact', head: true })
      .eq('is_read', false);

    if (error) {
      // Log with more context for debugging
      console.error('Error fetching unread notification count:', {
        error,
        message: error.message,
        details: error.details,
        hint: error.hint,
        code: error.code
      });
      return { data: null, error: new Error(error.message) };
    }

    return { data: count || 0, error: null };
  } catch (err: any) {
    console.error('Exception fetching unread notification count:', {
      error: err,
      message: err.message,
      stack: err.stack
    });
    return { data: null, error: err };
  }
}

/**
 * Mark a notification as read
 * @param notificationId - Notification ID to mark as read
 */
export async function markNotificationAsRead(
  notificationId: string
): Promise<{ success: boolean; error: Error | null }> {
  try {
    const { error } = await supabase
      .from('notifications')
      .update({ is_read: true })
      .eq('id', notificationId);

    if (error) {
      console.error('Error marking notification as read:', error);
      return { success: false, error: new Error(error.message) };
    }

    return { success: true, error: null };
  } catch (err: any) {
    console.error('Exception marking notification as read:', err);
    return { success: false, error: err };
  }
}

/**
 * Mark all notifications as read
 */
export async function markAllNotificationsAsRead(): Promise<{ success: boolean; error: Error | null }> {
  try {
    const { error } = await supabase
      .from('notifications')
      .update({ is_read: true })
      .eq('is_read', false);

    if (error) {
      console.error('Error marking all notifications as read:', error);
      return { success: false, error: new Error(error.message) };
    }

    return { success: true, error: null };
  } catch (err: any) {
    console.error('Exception marking all notifications as read:', err);
    return { success: false, error: err };
  }
}

/**
 * Delete a notification
 * @param notificationId - Notification ID to delete
 */
export async function deleteNotification(
  notificationId: string
): Promise<{ success: boolean; error: Error | null }> {
  try {
    const { error } = await supabase
      .from('notifications')
      .delete()
      .eq('id', notificationId);

    if (error) {
      console.error('Error deleting notification:', error);
      return { success: false, error: new Error(error.message) };
    }

    return { success: true, error: null };
  } catch (err: any) {
    console.error('Exception deleting notification:', err);
    return { success: false, error: err };
  }
}
