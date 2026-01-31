/**
 * Task Notification Utilities
 * Handles local push notifications for tasks using expo-notifications
 */

import { format, parseISO, subMinutes } from 'date-fns';
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import type { Task } from '../types';

// Configure notification handler
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

/**
 * Request notification permissions
 * Should be called on app startup
 */
export async function requestNotificationPermissions(): Promise<boolean> {
  try {
    const { status: existingStatus } = await Notifications.getPermissionsAsync();
    let finalStatus = existingStatus;
    
    if (existingStatus !== 'granted') {
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
    }
    
    return finalStatus === 'granted';
  } catch (error) {
    console.error('Error requesting notification permissions:', error);
    return false;
  }
}

/**
 * Schedule a notification for a task (10 minutes before due time)
 * @param task - Task to schedule notification for
 * @returns Notification ID or null if scheduling failed
 */
export async function scheduleTaskNotification(task: Task): Promise<string | null> {
  try {
    // Import notification settings dynamically to avoid circular dependencies
    // For now, we'll use a simple check - in a real app, you might want to 
    // create a separate API function to get settings
    let notificationsEnabled = true;
    
    try {
      // Simple platform-specific settings check
      if (typeof window !== 'undefined' && window.localStorage) {
        const settings = localStorage.getItem('notification-settings');
        if (settings) {
          const parsed = JSON.parse(settings);
          notificationsEnabled = parsed.notificationsEnabled ?? true;
        }
      }
    } catch (error) {
      console.log('Could not check notification settings, using default');
    }
    
    // Check if notifications are enabled
    if (!notificationsEnabled) {
      console.log('[scheduleTaskNotification] Notifications are disabled');
      return null;
    }
    
    // Local scheduled notifications are only supported on native platforms.
    // On web, expo-notifications does not support scheduled triggers.
    if (Platform.OS === 'web') {
      console.log('[scheduleTaskNotification] Skipping scheduling on web platform');
      return null;
    }
    
    // Check if task has both due_date and due_time
    if (!task.due_date || !task.due_time) {
      return null; // No notification needed for tasks without time
    }
    
    // Parse due date and time (interpreted in device local time)
    const dueDate = parseISO(task.due_date);
    const [hours, minutes, seconds] = task.due_time.split(':').map(Number);
    dueDate.setHours(hours, minutes, seconds || 0);
    
    // Calculate notification time (10 minutes before)
    const notificationTime = subMinutes(dueDate, 10);
    
    // Don't schedule if notification time is in the past
    if (notificationTime < new Date()) {
      return null;
    }
    
    // On Android, ensure a notification channel exists
    if (Platform.OS === 'android') {
      await Notifications.setNotificationChannelAsync('default', {
        name: 'Default',
        importance: Notifications.AndroidImportance.HIGH,
      });
    }

    // Use an absolute date trigger; include type to satisfy Expo SDK 54+
    const trigger: any =
      Platform.OS === 'android'
        ? { type: 'date', date: notificationTime, channelId: 'default' }
        : { type: 'date', date: notificationTime };

    const notificationId = await Notifications.scheduleNotificationAsync({
      content: {
        title: '⏰ Task Reminder',
        body: `"${task.title}" is due in 10 minutes.`,
        data: {
          taskId: task.id,
          type: 'TASK_REMINDER',
        },
        sound: true,
        priority: Notifications.AndroidNotificationPriority.HIGH,
      },
      trigger,
    });
    
    console.log(
      `[scheduleTaskNotification] Scheduled notification for task ${task.id} at ${format(
        notificationTime,
        'yyyy-MM-dd HH:mm',
      )}`,
    );
    return notificationId;
  } catch (error) {
    console.error('[scheduleTaskNotification] Error scheduling notification:', error);
    return null;
  }
}

/**
 * Cancel a scheduled notification for a task
 * @param notificationId - Notification ID to cancel
 */
export async function cancelTaskNotification(notificationId: string): Promise<void> {
  try {
    await Notifications.cancelScheduledNotificationAsync(notificationId);
    console.log(`[cancelTaskNotification] Cancelled notification ${notificationId}`);
  } catch (error) {
    console.error('[cancelTaskNotification] Error cancelling notification:', error);
  }
}

/**
 * Cancel all notifications for a specific task
 * This is useful when a task is deleted or completed
 * @param taskId - Task ID to cancel notifications for
 */
export async function cancelAllNotificationsForTask(taskId: string): Promise<void> {
  try {
    const scheduledNotifications = await Notifications.getAllScheduledNotificationsAsync();
    
    // Find all notifications for this task
    const taskNotifications = scheduledNotifications.filter(
      (notification) => notification.content.data?.taskId === taskId
    );
    
    // Cancel each notification
    for (const notification of taskNotifications) {
      await Notifications.cancelScheduledNotificationAsync(notification.identifier);
    }
    
    if (taskNotifications.length > 0) {
      console.log(`[cancelAllNotificationsForTask] Cancelled ${taskNotifications.length} notification(s) for task ${taskId}`);
    }
  } catch (error) {
    console.error('[cancelAllNotificationsForTask] Error cancelling notifications:', error);
  }
}

/**
 * Update notification for a task (cancel old, schedule new)
 * Useful when task due_date or due_time changes
 * @param task - Updated task
 * @param oldNotificationId - Previous notification ID to cancel
 */
export async function updateTaskNotification(
  task: Task,
  oldNotificationId?: string | null
): Promise<string | null> {
  // Cancel old notification if provided
  if (oldNotificationId) {
    await cancelTaskNotification(oldNotificationId);
  } else {
    // Try to cancel all existing notifications for this task
    await cancelAllNotificationsForTask(task.id);
  }
  
  // Schedule new notification
  return await scheduleTaskNotification(task);
}

/**
 * Initialize notification system
 * Should be called on app startup
 */
export async function initializeNotifications(): Promise<void> {
  try {
    const hasPermission = await requestNotificationPermissions();
    if (!hasPermission) {
      console.warn('[initializeNotifications] Notification permissions not granted');
    }
  } catch (error) {
    console.error('[initializeNotifications] Error initializing notifications:', error);
  }
}
