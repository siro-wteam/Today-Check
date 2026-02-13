/**
 * Notification Center Modal
 * Displays all notifications for the current user
 */

import { borderRadius, colors, spacing } from '@/constants/colors';
import {
    deleteNotification,
    getNotifications,
    getUnreadNotificationCount,
    markAllNotificationsAsRead,
    markNotificationAsRead,
} from '@/lib/api/notifications';
import type { Notification } from '@/lib/types';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { format, parseISO } from 'date-fns';
import * as Haptics from 'expo-haptics';
import { Trash2 } from 'lucide-react-native';
import { useState } from 'react';
import {
    ActivityIndicator,
    Modal,
    Platform,
    Pressable,
    RefreshControl,
    ScrollView,
    Text,
    View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ModalCloseButton } from './ModalCloseButton';

interface NotificationCenterModalProps {
  visible: boolean;
  onClose: () => void;
}

export function NotificationCenterModal({ visible, onClose }: NotificationCenterModalProps) {
  const insets = useSafeAreaInsets();
  const queryClient = useQueryClient();
  const [refreshing, setRefreshing] = useState(false);

  // Fetch notifications
  const {
    data: notificationsResponse,
    isLoading,
    error,
    refetch,
  } = useQuery({
    queryKey: ['notifications'],
    queryFn: () => getNotifications(50, 0),
    enabled: visible, // Only fetch when modal is visible
  });

  const notifications = notificationsResponse?.data || [];

  // Fetch unread count
  const { data: unreadCountResponse } = useQuery({
    queryKey: ['notifications', 'unread-count'],
    queryFn: getUnreadNotificationCount,
    enabled: visible,
  });

  const unreadCount = unreadCountResponse?.data || 0;

  // Mark as read mutation with optimistic update
  const markAsReadMutation = useMutation({
    mutationFn: markNotificationAsRead,
    onMutate: async (notificationId: string) => {
      // Cancel outgoing refetches
      await queryClient.cancelQueries({ queryKey: ['notifications'] });
      await queryClient.cancelQueries({ queryKey: ['notifications', 'unread-count'] });

      // Snapshot previous values
      const previousNotifications = queryClient.getQueryData(['notifications']);
      const previousUnreadCount = queryClient.getQueryData(['notifications', 'unread-count']);

      // Optimistically update notifications list
      queryClient.setQueryData(['notifications'], (old: any) => {
        if (!old?.data) return old;
        return {
          ...old,
          data: old.data.map((n: Notification) =>
            n.id === notificationId ? { ...n, is_read: true } : n
          ),
        };
      });

      // Optimistically update unread count (decrease by 1 if was unread)
      queryClient.setQueryData(['notifications', 'unread-count'], (old: any) => {
        if (!old?.data) return old;
        const notification = (previousNotifications as any)?.data?.find((n: Notification) => n.id === notificationId);
        const wasUnread = notification && !notification.is_read;
        return {
          ...old,
          data: wasUnread ? Math.max(0, (old.data || 0) - 1) : old.data,
        };
      });

      return { previousNotifications, previousUnreadCount };
    },
    onError: (err, notificationId, context) => {
      // Rollback on error
      if (context?.previousNotifications) {
        queryClient.setQueryData(['notifications'], context.previousNotifications);
      }
      if (context?.previousUnreadCount) {
        queryClient.setQueryData(['notifications', 'unread-count'], context.previousUnreadCount);
      }
    },
    onSuccess: () => {
      // No invalidateQueries needed - optimistic update already applied
      // Server state is already updated via API call, so no refetch needed
    },
  });

  // Mark all as read mutation with optimistic update
  const markAllAsReadMutation = useMutation({
    mutationFn: markAllNotificationsAsRead,
    onMutate: async () => {
      // Cancel outgoing refetches
      await queryClient.cancelQueries({ queryKey: ['notifications'] });
      await queryClient.cancelQueries({ queryKey: ['notifications', 'unread-count'] });

      // Snapshot previous values
      const previousNotifications = queryClient.getQueryData(['notifications']);
      const previousUnreadCount = queryClient.getQueryData(['notifications', 'unread-count']);

      // Optimistically update all notifications to read
      queryClient.setQueryData(['notifications'], (old: any) => {
        if (!old?.data) return old;
        return {
          ...old,
          data: old.data.map((n: Notification) => ({ ...n, is_read: true })),
        };
      });

      // Optimistically set unread count to 0
      queryClient.setQueryData(['notifications', 'unread-count'], (old: any) => {
        return { ...old, data: 0 };
      });

      return { previousNotifications, previousUnreadCount };
    },
    onError: (err, variables, context) => {
      // Rollback on error
      if (context?.previousNotifications) {
        queryClient.setQueryData(['notifications'], context.previousNotifications);
      }
      if (context?.previousUnreadCount) {
        queryClient.setQueryData(['notifications', 'unread-count'], context.previousUnreadCount);
      }
    },
    onSuccess: () => {
      // No invalidateQueries needed - optimistic update already applied
      // Server state is already updated via API call, so no refetch needed
    },
  });

  // Delete notification mutation with optimistic update
  const deleteMutation = useMutation({
    mutationFn: async (notificationId: string) => {
      const result = await deleteNotification(notificationId);
      if (result.error || !result.success) {
        throw result.error || new Error('Failed to delete notification');
      }
      return notificationId;
    },
    onMutate: async (notificationId: string) => {
      // Cancel outgoing refetches
      await queryClient.cancelQueries({ queryKey: ['notifications'] });
      await queryClient.cancelQueries({ queryKey: ['notifications', 'unread-count'] });

      // Snapshot previous values
      const previousNotifications = queryClient.getQueryData(['notifications']);
      const previousUnreadCount = queryClient.getQueryData(['notifications', 'unread-count']);

      // Find the notification to check if it was unread
      const notification = (previousNotifications as any)?.data?.find((n: Notification) => n.id === notificationId);
      const wasUnread = notification && !notification.is_read;

      // Optimistically remove notification from list
      queryClient.setQueryData(['notifications'], (old: any) => {
        if (!old?.data) return old;
        return {
          ...old,
          data: old.data.filter((n: Notification) => n.id !== notificationId),
        };
      });

      // Optimistically update unread count (decrease by 1 if was unread)
      if (wasUnread) {
        queryClient.setQueryData(['notifications', 'unread-count'], (old: any) => {
          if (!old?.data) return old;
          return {
            ...old,
            data: Math.max(0, (old.data || 0) - 1),
          };
        });
      }

      return { previousNotifications, previousUnreadCount };
    },
    onError: (err, notificationId, context) => {
      // Rollback on error
      if (context?.previousNotifications) {
        queryClient.setQueryData(['notifications'], context.previousNotifications);
      }
      if (context?.previousUnreadCount) {
        queryClient.setQueryData(['notifications', 'unread-count'], context.previousUnreadCount);
      }
    },
    onSuccess: () => {
      // No invalidateQueries needed - optimistic update already applied
      // Server state is already updated via API call, so no refetch needed
    },
  });

  const handleRefresh = async () => {
    setRefreshing(true);
    await refetch();
    setRefreshing(false);
  };

  const handleNotificationPress = async (notification: Notification) => {
    // Mark as read if unread (no navigation)
    if (!notification.is_read) {
      await markAsReadMutation.mutateAsync(notification.id);
    }
  };

  const handleMarkAllAsRead = async () => {
    if (Platform.OS === 'ios') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    }
    await markAllAsReadMutation.mutateAsync();
  };

  const handleDelete = async (notificationId: string, e: any) => {
    e.stopPropagation(); // Prevent triggering notification press
    if (Platform.OS === 'ios') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
    }
    try {
      await deleteMutation.mutateAsync(notificationId);
    } catch (err) {
      console.error('Error deleting notification:', err);
    }
  };

  const formatNotificationTime = (createdAt: string) => {
    try {
      const date = parseISO(createdAt);
      const now = new Date();
      const diffMs = now.getTime() - date.getTime();
      const diffMins = Math.floor(diffMs / 60000);
      const diffHours = Math.floor(diffMs / 3600000);
      const diffDays = Math.floor(diffMs / 86400000);

      if (diffMins < 1) return 'Just now';
      if (diffMins < 60) return `${diffMins} min ago`;
      if (diffHours < 24) return `${diffHours} hours ago`;
      if (diffDays < 7) return `${diffDays} days ago`;
      return format(date, 'MMM d');
    } catch {
      return '';
    }
  };

  // Web: viewport 기준 높이 제한으로 알림이 많을 때 레이아웃 깨짐 방지
  const isWeb = Platform.OS === 'web';

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <Pressable
        style={[
          {
            flex: 1,
            backgroundColor: 'rgba(0, 0, 0, 0.5)',
            justifyContent: 'flex-end',
          },
          isWeb && { minHeight: '100vh', position: 'absolute' as const, top: 0, left: 0, right: 0, bottom: 0 },
        ]}
        onPress={onClose}
      >
        <Pressable onPress={(e) => e.stopPropagation()}>
          <View
            style={[
              {
                backgroundColor: colors.background,
                borderTopLeftRadius: borderRadius['2xl'],
                borderTopRightRadius: borderRadius['2xl'],
                maxHeight: isWeb ? '60vh' : '60%',
                minHeight: 400,
                paddingBottom: Math.max(insets.bottom, spacing.lg),
                overflow: 'hidden',
              },
              isWeb && {
                maxWidth: 600,
                width: '100%',
                alignSelf: 'center' as const,
                height: '60vh', // 고정 높이로 스크롤 영역만 늘어나고 카드가 뷰포트 밖으로 나가지 않음
              },
            ]}
          >
            {/* Header */}
            <View
              style={{
                flexDirection: 'row',
                justifyContent: 'space-between',
                alignItems: 'center',
                paddingHorizontal: spacing.lg,
                paddingTop: spacing.lg,
                paddingBottom: spacing.md,
                borderBottomWidth: 1,
                borderBottomColor: colors.border,
              }}
            >
              <Text style={{ fontSize: 20, fontWeight: '700', color: colors.textMain }}>
                Notifications
              </Text>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md }}>
                {unreadCount > 0 && (
                  <Pressable
                    onPress={handleMarkAllAsRead}
                    style={{
                      paddingHorizontal: spacing.md,
                      paddingVertical: spacing.sm,
                      borderRadius: borderRadius.md,
                      backgroundColor: colors.gray100,
                    }}
                  >
                    <Text style={{ fontSize: 14, color: colors.primary, fontWeight: '500' }}>
                      Mark all as read
                    </Text>
                  </Pressable>
                )}
                <ModalCloseButton onPress={onClose} />
              </View>
            </View>

            {/* Content */}
            {isLoading ? (
              <View style={{ padding: spacing.xxl, alignItems: 'center' }}>
                <ActivityIndicator size="large" color={colors.primary} />
              </View>
            ) : error ? (
              <View style={{ padding: spacing.xxl, alignItems: 'center' }}>
                <Text style={{ fontSize: 16, color: colors.error, marginBottom: spacing.md }}>
                  Failed to load notifications
                </Text>
                <Pressable
                  onPress={() => refetch()}
                  style={{
                    paddingHorizontal: spacing.lg,
                    paddingVertical: spacing.md,
                    borderRadius: borderRadius.md,
                    backgroundColor: colors.primary,
                  }}
                >
                  <Text style={{ color: colors.primaryForeground, fontWeight: '600' }}>
                    Retry
                  </Text>
                </Pressable>
              </View>
            ) : notifications.length === 0 ? (
              <View style={{ padding: spacing.xxl, alignItems: 'center' }}>
                <Text style={{ fontSize: 48, marginBottom: spacing.md }}>🔔</Text>
                <Text style={{ fontSize: 16, color: colors.textSub, textAlign: 'center' }}>
                  No notifications
                </Text>
              </View>
            ) : (
              <View style={{ flex: 1, minHeight: 0 }}>
                <ScrollView
                  style={{ flex: 1 }}
                  contentContainerStyle={{ paddingBottom: spacing.md }}
                  refreshControl={
                    <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />
                  }
                >
                {notifications.map((notification) => (
                  <View
                    key={notification.id}
                    style={{
                      flexDirection: 'row',
                      paddingLeft: spacing.lg,
                      paddingRight: spacing.lg, // 헤더와 동일한 paddingRight
                      paddingVertical: spacing.md,
                      backgroundColor: notification.is_read ? 'transparent' : colors.primary + '08',
                      borderBottomWidth: 1,
                      borderBottomColor: colors.border,
                      alignItems: 'flex-start',
                      position: 'relative' as const, // absolute positioning을 위한 relative
                    }}
                  >
                    {/* New notification indicator (blue dot) - aligned with body content start */}
                    {!notification.is_read && (
                      <View
                        style={{
                          width: 8,
                          height: 8,
                          borderRadius: 4,
                          backgroundColor: colors.primary,
                          marginRight: spacing.sm,
                          marginTop: 28, // Align with body content start (title ~22px + margin ~6px)
                        }}
                      />
                    )}
                    {notification.is_read && (
                      <View style={{ width: 8, marginRight: spacing.sm }} />
                    )}
                    <Pressable
                      onPress={() => handleNotificationPress(notification)}
                      style={({ pressed }) => ({
                        flex: 1,
                        backgroundColor: pressed ? colors.gray50 : 'transparent',
                        paddingVertical: spacing.xs,
                        paddingRight: 40, // 휴지통 아이콘 공간 확보 (32px + 8px 여유)
                      })}
                    >
                      <View style={{ marginBottom: spacing.xs }}>
                        <Text
                          style={{
                            fontSize: 16,
                            fontWeight: notification.is_read ? '400' : '600',
                            color: colors.textMain,
                          }}
                        >
                          {notification.title}
                        </Text>
                      </View>
                      <Text
                        style={{
                          fontSize: 14,
                          color: colors.textSub,
                          marginBottom: spacing.xs,
                          lineHeight: 20,
                        }}
                      >
                        {notification.body}
                      </Text>
                      <Text
                        style={{
                          fontSize: 12,
                          color: colors.textDisabled,
                        }}
                      >
                        {formatNotificationTime(notification.created_at)}
                      </Text>
                    </Pressable>
                    {/* 휴지통 아이콘: absolute positioning으로 오른쪽 끝에 고정 */}
                    <View
                      style={{
                        position: 'absolute' as const,
                        right: spacing.lg, // 헤더의 paddingRight와 동일
                        top: spacing.md + spacing.xs, // paddingVertical + Pressable의 paddingVertical과 맞춤
                        justifyContent: 'flex-start',
                      }}
                    >
                      <Pressable
                        onPress={(e) => handleDelete(notification.id, e)}
                        style={({ pressed }) => ({
                          width: 32, // Match close button width
                          height: 32, // Match close button height
                          alignItems: 'center',
                          justifyContent: 'center',
                          backgroundColor: pressed ? colors.gray100 : 'transparent',
                          borderRadius: borderRadius.full,
                        })}
                        hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                      >
                        <Trash2 size={18} color={colors.textDisabled} strokeWidth={2} />
                      </Pressable>
                    </View>
                  </View>
                ))}
                </ScrollView>
              </View>
            )}
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}
