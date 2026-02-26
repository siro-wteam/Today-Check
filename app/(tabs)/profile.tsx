import { AboutModal } from '@/components/AboutModal';
import { AppHeader } from '@/components/AppHeader';
import { EditNicknameModal } from '@/components/EditNicknameModal';
import { NotificationCenterModal } from '@/components/NotificationCenterModal';
import { NotificationSettingsModal } from '@/components/NotificationSettingsModal';
import { borderRadius, colors, spacing } from '@/constants/colors';
import { getProfileStats, type ProfileStats } from '@/lib/api/profile-stats';
import { subscriptionTestActivate, subscriptionTestDeactivate } from '@/lib/api/profiles';
import { ONBOARDING_STORAGE_KEY } from '@/lib/constants/onboarding';
import { signOut, useAuth } from '@/lib/hooks/use-auth';
import { useSubscription } from '@/lib/hooks/use-subscription';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useFocusEffect } from '@react-navigation/native';
import { useRouter } from 'expo-router';
import { useQueryClient } from '@tanstack/react-query';
import { Crown, Edit2, LogOut, Mail, User as UserIcon } from 'lucide-react-native';
import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Platform, Pressable, SafeAreaView, ScrollView, Text, View } from 'react-native';
import { showToast } from '@/utils/toast';

export default function ProfileScreen() {
  const router = useRouter();
  const { user, profile, updateProfile, refreshProfile } = useAuth();
  const { tier, isSubscribed } = useSubscription();
  const queryClient = useQueryClient();
  const [isEditModalVisible, setIsEditModalVisible] = useState(false);
  const [isNotificationModalVisible, setIsNotificationModalVisible] = useState(false);
  const [isNotificationSettingsVisible, setIsNotificationSettingsVisible] = useState(false);
  const [isAboutModalVisible, setIsAboutModalVisible] = useState(false);
  const [profileStats, setProfileStats] = useState<ProfileStats | null>(null);
  const [isLoadingStats, setIsLoadingStats] = useState(true);
  const [isSubscriptionActionLoading, setIsSubscriptionActionLoading] = useState(false);

  // Load profile stats when user is ready
  useEffect(() => {
    if (!user?.id) {
      setProfileStats(null);
      setIsLoadingStats(false);
      return;
    }
    loadProfileStats();
  }, [user?.id]);

  // Reload profile + stats when Profile tab gains focus (recover from failed or early first load)
  useFocusEffect(
    useCallback(() => {
      if (!user?.id) return;
      refreshProfile();
      let cancelled = false;
      (async () => {
        try {
          setIsLoadingStats(true);
          const { data, error } = await getProfileStats();
          if (!cancelled && data && !error) setProfileStats(data);
        } catch (e) {
          if (!cancelled) console.error('Error loading profile stats:', e);
        } finally {
          if (!cancelled) setIsLoadingStats(false);
        }
      })();
      return () => {
        cancelled = true;
      };
    }, [user?.id, refreshProfile])
  );

  const loadProfileStats = async () => {
    if (!user?.id) return;
    try {
      setIsLoadingStats(true);
      const { data, error } = await getProfileStats();
      if (data && !error) {
        setProfileStats(data);
      }
    } catch (error) {
      console.error('Error loading profile stats:', error);
    } finally {
      setIsLoadingStats(false);
    }
  };

  const handleNotificationPress = () => {
    setIsNotificationModalVisible(true);
  };

  const handleNotificationSettingsPress = () => {
    setIsNotificationSettingsVisible(true);
  };

  const handleAboutPress = () => {
    setIsAboutModalVisible(true);
  };

  /** 개발 시 온보딩 다시 보기 (재설치 없이 테스트) */
  const handleShowOnboardingAgain = async () => {
    await AsyncStorage.removeItem(ONBOARDING_STORAGE_KEY);
    router.replace('/onboarding');
  };

  const handleSignOut = async () => {
    if (Platform.OS === 'web') {
      const confirmed = window.confirm('Are you sure you want to sign out?');
      if (!confirmed) return;
      
      await signOut();
    } else {
      Alert.alert('Sign Out', 'Are you sure you want to sign out?', [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Sign Out',
          style: 'destructive',
          onPress: async () => {
            await signOut();
          },
        },
      ]);
    }
  };

  // Wait for user so profile/email are available (avoids empty on first load)
  if (!user) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }}>
        <AppHeader onNotificationPress={handleNotificationPress} />
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }}>
      {/* Header */}
      <AppHeader onNotificationPress={handleNotificationPress} />

      <ScrollView 
        style={{ flex: 1 }}
        contentContainerStyle={[
          { paddingHorizontal: spacing.lg, paddingVertical: spacing.xxl },
          Platform.OS === 'web' && { maxWidth: 600, width: '100%', alignSelf: 'center' }
        ]}
      >
        {/* Profile Card */}
        <View style={{
          backgroundColor: colors.card,
          borderRadius: borderRadius['2xl'],
          padding: spacing.xxl,
          borderWidth: 1,
          borderColor: colors.border,
          marginBottom: spacing.xxl,
        }}>
          {/* Avatar */}
          <View style={{ alignItems: 'center', marginBottom: spacing.xxl }}>
            <View style={{
              width: 80,
              height: 80,
              borderRadius: borderRadius.full,
              backgroundColor: '#DBEAFE',
              alignItems: 'center',
              justifyContent: 'center',
              marginBottom: spacing.md,
            }}>
              <UserIcon size={40} color={colors.primary} strokeWidth={2} />
            </View>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginBottom: spacing.xs }}>
              <Text style={{ fontSize: 20, fontWeight: '700', color: colors.textMain }}>
                {profile?.nickname || user?.email?.split('@')[0] || 'User'}
              </Text>
              <Pressable
                onPress={() => setIsEditModalVisible(true)}
                style={{ padding: spacing.xs }}
              >
                <Edit2 size={16} color={colors.textSub} strokeWidth={2} />
              </Pressable>
            </View>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
              <Mail size={16} color={colors.textSub} />
              <Text style={{ fontSize: 14, color: colors.textSub }}>
                {user?.email || 'No email'}
              </Text>
            </View>
            {/* Subscription */}
            <View style={{
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'center',
              gap: spacing.sm,
              marginTop: spacing.md,
              paddingVertical: spacing.sm,
              paddingHorizontal: spacing.md,
              borderRadius: borderRadius.md,
              backgroundColor: isSubscribed ? '#DBEAFE' : colors.gray100,
              alignSelf: 'center',
            }}>
              {isSubscribed ? (
                <Crown size={16} color={colors.primary} strokeWidth={2} />
              ) : null}
              <Text style={{
                fontSize: 14,
                fontWeight: '600',
                color: isSubscribed ? colors.primary : colors.textSub,
              }}>
                {isSubscribed ? 'Paid' : 'Free'}
              </Text>
            </View>

            {/* Subscription test (remove when payment is integrated) */}
            <View style={{
              marginTop: spacing.lg,
              paddingTop: spacing.lg,
              borderTopWidth: 1,
              borderTopColor: colors.border,
              gap: spacing.sm,
            }}>
              <Text style={{ fontSize: 12, fontWeight: '600', color: colors.textSub, marginBottom: spacing.xs }}>
                구독 테스트
              </Text>
              {profile?.subscriptionExpiresAt && profile?.subscriptionProvider === 'test' ? (
                <Text style={{ fontSize: 12, color: colors.textSub, marginBottom: spacing.sm }}>
                  만료: {new Date(profile.subscriptionExpiresAt).toLocaleDateString('ko-KR')}
                </Text>
              ) : null}
              <View style={{ flexDirection: 'row', gap: spacing.sm }}>
                {!isSubscribed ? (
                  <Pressable
                    onPress={async () => {
                      if (isSubscriptionActionLoading) return;
                      setIsSubscriptionActionLoading(true);
                      const { error } = await subscriptionTestActivate();
                      if (error) {
                        showToast('error', '구독하기 실패', error);
                      } else {
                        await refreshProfile();
                        queryClient.invalidateQueries({ queryKey: ['subscription-limits'] });
                        showToast('success', '구독 활성화', '테스트 구독이 활성화되었습니다.');
                      }
                      setIsSubscriptionActionLoading(false);
                    }}
                    disabled={isSubscriptionActionLoading}
                    style={{
                      flex: 1,
                      paddingVertical: spacing.sm,
                      paddingHorizontal: spacing.md,
                      borderRadius: borderRadius.md,
                      backgroundColor: colors.primary,
                      alignItems: 'center',
                    }}
                  >
                    <Text style={{ fontSize: 14, fontWeight: '600', color: colors.primaryForeground }}>
                      {isSubscriptionActionLoading ? '처리 중…' : '구독하기'}
                    </Text>
                  </Pressable>
                ) : null}
                {isSubscribed ? (
                  <Pressable
                    onPress={async () => {
                      if (isSubscriptionActionLoading) return;
                      setIsSubscriptionActionLoading(true);
                      const { error } = await subscriptionTestDeactivate();
                      if (error) {
                        showToast('error', '구독해제 실패', error);
                      } else {
                        await refreshProfile();
                        queryClient.invalidateQueries({ queryKey: ['subscription-limits'] });
                        showToast('success', '구독 해제', '테스트 구독이 해제되었습니다.');
                      }
                      setIsSubscriptionActionLoading(false);
                    }}
                    disabled={isSubscriptionActionLoading}
                    style={{
                      flex: 1,
                      paddingVertical: spacing.sm,
                      paddingHorizontal: spacing.md,
                      borderRadius: borderRadius.md,
                      backgroundColor: colors.gray200,
                      alignItems: 'center',
                    }}
                  >
                    <Text style={{ fontSize: 14, fontWeight: '600', color: colors.textMain }}>
                      {isSubscriptionActionLoading ? '처리 중…' : '구독해제'}
                    </Text>
                  </Pressable>
                ) : null}
              </View>
            </View>
          </View>

          {/* Stats */}
          <View style={{
            flexDirection: 'row',
            justifyContent: 'space-around',
            paddingVertical: spacing.lg,
            borderTopWidth: 1,
            borderTopColor: colors.border,
          }}>
            <View style={{ alignItems: 'center' }}>
              <Text style={{ fontSize: 24, fontWeight: '700', color: colors.textMain, marginBottom: spacing.xs }}>
                {isLoadingStats ? '...' : (profileStats?.completed ?? 0)}
              </Text>
              <Text style={{ fontSize: 12, color: colors.textSub }}>
                Completed
              </Text>
            </View>
            <View style={{ width: 1, backgroundColor: colors.border }} />
            <View style={{ alignItems: 'center' }}>
              <Text style={{ fontSize: 24, fontWeight: '700', color: colors.textMain, marginBottom: spacing.xs }}>
                {isLoadingStats ? '...' : (profileStats?.active ?? 0)}
              </Text>
              <Text style={{ fontSize: 12, color: colors.textSub }}>
                Active
              </Text>
            </View>
            <View style={{ width: 1, backgroundColor: colors.border }} />
            <View style={{ alignItems: 'center' }}>
              <Text style={{ fontSize: 24, fontWeight: '700', color: colors.textMain, marginBottom: spacing.xs }}>
                {isLoadingStats ? '...' : (profileStats?.streak ?? 0)}
              </Text>
              <Text style={{ fontSize: 12, color: colors.textSub }}>
                Streak
              </Text>
            </View>
          </View>
        </View>

        {/* Settings Section */}
        <View style={{
          backgroundColor: colors.card,
          borderRadius: borderRadius['2xl'],
          borderWidth: 1,
          borderColor: colors.border,
          overflow: 'hidden',
          marginBottom: spacing.xxl,
        }}>
          <Text style={{
            fontSize: 14,
            fontWeight: '600',
            color: colors.textSub,
            paddingHorizontal: spacing.lg,
            paddingTop: spacing.lg,
            paddingBottom: spacing.sm,
          }}>
            SETTINGS
          </Text>
          
          {/* 첫 번째 구분선 - Settings와 Notifications 사이 */}
          <View style={{
            height: 1,
            backgroundColor: colors.border,
            marginHorizontal: spacing.lg,
          }} />

          <Pressable 
            style={({ pressed }) => ({
              paddingHorizontal: spacing.lg,
              backgroundColor: pressed ? colors.gray50 : 'transparent',
              borderTopWidth: 0,  // 모든 border 제거
              borderBottomWidth: 0,
            })}
            onPress={handleNotificationSettingsPress}
          >
            <View style={{
              flexDirection: 'row',
              alignItems: 'center',
              paddingVertical: Platform.OS === 'web' ? spacing.xl : 20,  // 앱에서는 적당한 값 (20px)
            }}>
              <View style={{
                width: 40,
                height: 40,
                borderRadius: borderRadius.full,
                backgroundColor: colors.gray100,
                alignItems: 'center',
                justifyContent: 'center',
                marginLeft: spacing.lg,
                marginRight: 8,
              }}>
                <Text style={{ fontSize: 18 }}>🔔</Text>
              </View>
              <Text style={{ 
                fontSize: 16, 
                fontWeight: '500', 
                color: colors.textMain,
              }}>
                Notifications
              </Text>
            </View>
          </Pressable>

          {/* 구분선 - 양쪽 플랫폼 모두 보이도록 */}
          <View style={{
            height: 1,
            backgroundColor: colors.border,
            marginHorizontal: spacing.lg,
          }} />

          <Pressable 
            style={({ pressed }) => ({
              paddingHorizontal: spacing.lg,
              paddingVertical: Platform.OS === 'web' ? spacing.xl : 20,  // 앱에서는 적당한 값 (20px)
              backgroundColor: pressed ? colors.gray50 : 'transparent',
              borderTopWidth: 0,  // 위쪽 라인 제거 (별도 View로 처리)
              borderBottomWidth: 0,  // 아래쪽 라인 제거
            })}
            onPress={handleAboutPress}
          >
            <View style={{
              flexDirection: 'row',
              alignItems: 'center',
              paddingVertical: Platform.OS === 'web' ? spacing.xl : 20,  // 앱에서는 적당한 값 (20px)
            }}>
              <View style={{
                width: 40,
                height: 40,
                borderRadius: borderRadius.full,
                backgroundColor: colors.gray100,
                alignItems: 'center',
                justifyContent: 'center',
                marginLeft: spacing.lg,
                marginRight: 8,
              }}>
                <Text style={{ fontSize: 18 }}>ℹ️</Text>
              </View>
              <Text style={{ 
                fontSize: 16, 
                fontWeight: '500', 
                color: colors.textMain,
              }}>
                About
              </Text>
            </View>
          </Pressable>
        </View>

        {/* Sign Out Button */}
        <Pressable
          onPress={handleSignOut}
          style={({ pressed }) => ({
            backgroundColor: colors.card,
            borderRadius: borderRadius['2xl'],
            borderWidth: 1,
            borderColor: colors.border,
            padding: spacing.lg,
            opacity: pressed ? 0.7 : 1,
          })}
        >
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.md }}>
            <LogOut size={20} color={colors.error} strokeWidth={2} />
            <Text style={{ fontSize: 16, fontWeight: '600', color: colors.error }}>
              Sign Out
            </Text>
          </View>
        </Pressable>

        {/* App Version */}
        <Text style={{
          textAlign: 'center',
          fontSize: 12,
          color: colors.textDisabled,
          marginTop: spacing.xxl,
        }}>
          TodayCheck v1.0.0
        </Text>

        {/* 개발 시에만: 온보딩 다시 보기 (재설치 없이 테스트) */}
        {__DEV__ && (
          <Pressable
            onPress={handleShowOnboardingAgain}
            style={{ marginTop: spacing.lg, paddingVertical: spacing.sm }}
          >
            <Text style={{ textAlign: 'center', fontSize: 12, color: colors.primary }}>
              온보딩 다시 보기 (테스트)
            </Text>
          </Pressable>
        )}
      </ScrollView>

      {/* Edit Nickname Modal */}
      <EditNicknameModal
        visible={isEditModalVisible}
        currentNickname={profile?.nickname || user?.email?.split('@')[0] || 'User'}
        onClose={() => setIsEditModalVisible(false)}
        onSave={updateProfile}
      />
      
      {/* Notification Center Modal */}
      <NotificationCenterModal
        visible={isNotificationModalVisible}
        onClose={() => setIsNotificationModalVisible(false)}
      />
      
      {/* Notification Settings Modal */}
      <NotificationSettingsModal
        visible={isNotificationSettingsVisible}
        onClose={() => setIsNotificationSettingsVisible(false)}
      />
      
      {/* About Modal */}
      <AboutModal
        visible={isAboutModalVisible}
        onClose={() => setIsAboutModalVisible(false)}
      />
    </SafeAreaView>
  );
}
