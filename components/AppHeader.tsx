import { LogoIcon } from '@/components/ui/LogoIcon';
import { borderRadius, colors } from '@/constants/colors';
import { getUnreadNotificationCount } from '@/lib/api/notifications';
import { useAuth } from '@/lib/hooks/use-auth';
import { useNotificationRealtime } from '@/lib/hooks/use-notification-realtime';
import { useQuery } from '@tanstack/react-query';
import { Bell } from 'lucide-react-native';
import { useEffect, useState } from 'react';
import { Platform, Pressable, ReactNode, Text, View } from 'react-native';
import { NotificationCenterModal } from './NotificationCenterModal';

interface AppHeaderProps {
  onNotificationPress?: () => void;
  /** Optional: when provided, logo is pressable and triggers this (e.g. week view: go to today) */
  onLogoPress?: () => void;
  /** Optional center content (e.g. week view: date + progress + Today, backlog: Backlog [Total N]) */
  centerContent?: ReactNode;
}

export function AppHeader({ onNotificationPress, onLogoPress, centerContent }: AppHeaderProps) {
  const [isNotificationModalVisible, setIsNotificationModalVisible] = useState(false);
  const { user } = useAuth();
  
  // Subscribe to real-time notification changes
  useNotificationRealtime({ enabled: true });
  
  // Fetch unread notification count - only when user is authenticated
  const { data: unreadCountResponse } = useQuery({
    queryKey: ['notifications', 'unread-count'],
    queryFn: getUnreadNotificationCount,
    enabled: !!user?.id, // Only fetch when user is logged in
    refetchInterval: 30000, // Refetch every 30 seconds (backup)
    retry: 3, // Retry failed requests 3 times
    retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000), // Exponential backoff
  });

  // Handle errors with useEffect
  useEffect(() => {
    if (unreadCountResponse?.error) {
      console.warn('Notification count fetch failed:', unreadCountResponse.error);
    }
  }, [unreadCountResponse?.error]);

  const unreadCount = unreadCountResponse?.data || 0;

  const handleNotificationPress = () => {
    if (onNotificationPress) {
      // Use custom handler if provided
      onNotificationPress();
    } else {
      // Default: open notification modal
      setIsNotificationModalVisible(true);
    }
  };

  return (
    <>
      <View
        style={[
          {
            backgroundColor: 'rgba(255, 255, 255, 0.8)', // bg-card/80
            paddingHorizontal: 16, // px-4
            paddingVertical: 12, // py-3
            borderBottomWidth: 1,
            borderBottomColor: 'rgba(229, 231, 235, 0.5)', // border-border/50
          },
          Platform.OS === 'web' ? { maxWidth: 600, width: '100%', alignSelf: 'center' } : {},
        ]}
      >
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', width: '100%' }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1, minWidth: 0, marginRight: 8 }}>
            {onLogoPress ? (
              <Pressable
                onPress={onLogoPress}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                style={({ pressed }) => [
                  {
                    width: 28,
                    height: 28,
                    borderRadius: borderRadius.sm,
                    alignItems: 'center',
                    justifyContent: 'center',
                  },
                  pressed && { opacity: 0.7 },
                ]}
              >
                <LogoIcon size={28} color={colors.primary} />
              </Pressable>
            ) : (
              <View
                style={{
                  width: 28,
                  height: 28,
                  borderRadius: borderRadius.sm,
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <LogoIcon size={28} color={colors.primary} />
              </View>
            )}
            {centerContent != null ? (
              <View style={{ flex: 1, minWidth: 0, marginLeft: 12, justifyContent: 'center' }}>
                {centerContent}
              </View>
            ) : null}
          </View>
          <Pressable
            onPress={handleNotificationPress}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            style={({ pressed }) => [
              {
                width: 40,
                height: 40,
                borderRadius: borderRadius.full,
                alignItems: 'center',
                justifyContent: 'center',
                backgroundColor: pressed ? colors.gray100 : 'transparent',
              },
            ]}
          >
            <Bell size={20} color={colors.textSub} strokeWidth={2} />
            {unreadCount > 0 && (
              <View
                pointerEvents="none"
                style={{
                  position: 'absolute',
                  right: 6,
                  top: 6,
                  minWidth: 18,
                  height: 18,
                  borderRadius: borderRadius.full,
                  backgroundColor: colors.error,
                  alignItems: 'center',
                  justifyContent: 'center',
                  paddingHorizontal: 4,
                }}
              >
                <Text
                  style={{
                    color: colors.primaryForeground,
                    fontSize: 10,
                    fontWeight: '700',
                  }}
                >
                  {unreadCount > 99 ? '99+' : unreadCount}
                </Text>
              </View>
            )}
          </Pressable>
        </View>
      </View>

      {/* Notification Center Modal - Only render if no custom handler provided */}
      {!onNotificationPress && (
        <NotificationCenterModal
          visible={isNotificationModalVisible}
          onClose={() => setIsNotificationModalVisible(false)}
        />
      )}
    </>
  );
}
