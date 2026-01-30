/**
 * Hook to subscribe to notifications changes
 * Automatically updates React Query cache when new notifications are created
 */

import type { RealtimeChannel } from '@supabase/supabase-js';
import { useQueryClient } from '@tanstack/react-query';
import { useEffect, useRef } from 'react';
import { supabase } from '../supabase';
import { useAuth } from './use-auth';

interface UseNotificationRealtimeOptions {
  enabled?: boolean;
}

/**
 * Subscribe to notifications table changes for the current user
 * Automatically invalidates React Query cache when new notifications are inserted
 */
export function useNotificationRealtime(options: UseNotificationRealtimeOptions = {}) {
  const { enabled = true } = options;
  const queryClient = useQueryClient();
  const channelRef = useRef<RealtimeChannel | null>(null);
  const { user } = useAuth();

  useEffect(() => {
    if (!enabled || !user?.id) {
      // User logged out or not authenticated - clear notification queries
      if (!user?.id) {
        queryClient.invalidateQueries({ queryKey: ['notifications'] });
        queryClient.invalidateQueries({ queryKey: ['notifications', 'unread-count'] });
      }
      return;
    }

    // User changed - invalidate queries to fetch fresh data for new user
    queryClient.invalidateQueries({ queryKey: ['notifications'] });
    queryClient.invalidateQueries({ queryKey: ['notifications', 'unread-count'] });

    // Create channel name
    const channelName = `notifications:${user.id}`;

    // Create subscription channel
    const channel = supabase
      .channel(channelName)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'notifications',
          filter: `user_id=eq.${user.id}`, // Only listen to notifications for current user
        },
        async (payload) => {
          console.log('🔔 [Realtime] New notification inserted:', payload);
          
          // Invalidate queries to refetch notifications
          queryClient.invalidateQueries({ queryKey: ['notifications'] });
          queryClient.invalidateQueries({ queryKey: ['notifications', 'unread-count'] });
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'notifications',
          filter: `user_id=eq.${user.id}`, // Only listen to notifications for current user
        },
        async (payload) => {
          console.log('🔔 [Realtime] Notification updated:', payload);
          
          // Optimistically update cache directly instead of invalidating
          // This avoids unnecessary API calls since we already have the updated data
          const updatedNotification = payload.new as Notification;
          
          // Update notifications list
          queryClient.setQueryData(['notifications'], (old: any) => {
            if (!old?.data) return old;
            return {
              ...old,
              data: old.data.map((n: Notification) =>
                n.id === updatedNotification.id ? updatedNotification : n
              ),
            };
          });
          
          // Update unread count if is_read changed
          if (payload.old?.is_read !== payload.new?.is_read) {
            queryClient.setQueryData(['notifications', 'unread-count'], (old: any) => {
              if (!old?.data) return old;
              const wasUnread = payload.old?.is_read === false;
              const isNowRead = payload.new?.is_read === true;
              if (wasUnread && isNowRead) {
                return { ...old, data: Math.max(0, (old.data || 0) - 1) };
              }
              return old;
            });
          }
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'DELETE',
          schema: 'public',
          table: 'notifications',
          filter: `user_id=eq.${user.id}`, // Only listen to notifications for current user
        },
        async (payload) => {
          console.log('🔔 [Realtime] Notification deleted:', payload);
          
          const deletedNotification = payload.old as Notification;
          const wasUnread = deletedNotification.is_read === false;
          
          // Optimistically remove from cache
          queryClient.setQueryData(['notifications'], (old: any) => {
            if (!old?.data) return old;
            return {
              ...old,
              data: old.data.filter((n: Notification) => n.id !== deletedNotification.id),
            };
          });
          
          // Update unread count if was unread
          if (wasUnread) {
            queryClient.setQueryData(['notifications', 'unread-count'], (old: any) => {
              if (!old?.data) return old;
              return { ...old, data: Math.max(0, (old.data || 0) - 1) };
            });
          }
        }
      )
      .subscribe((status) => {
        console.log('📡 [Realtime] Notification subscription status:', status);
        if (status === 'SUBSCRIBED') {
          console.log('✅ [Realtime] Successfully subscribed to notifications');
        } else if (status === 'CHANNEL_ERROR') {
          console.error('🔴 [Realtime] Notification channel error occurred');
        }
      });

    channelRef.current = channel;

    // Cleanup
    return () => {
      if (channelRef.current) {
        console.log('🔌 [Realtime] Unsubscribing from notifications');
        supabase.removeChannel(channelRef.current);
        channelRef.current = null;
      }
    };
  }, [enabled, user?.id, queryClient]);

  return {
    channel: channelRef.current,
  };
}
