import { CreateGroupModal } from '@/components/CreateGroupModal';
import { GroupListSkeleton } from '@/components/GroupListSkeleton';
import { JoinGroupModal } from '@/components/JoinGroupModal';
import { borderRadius, colors, shadows } from '@/constants/colors';
import { useAuth } from '@/lib/hooks/use-auth';
import { useSubscriptionLimits } from '@/lib/hooks/use-subscription-limits';
import { useGroupStore } from '@/lib/stores/useGroupStore';
import { showToast } from '@/utils/toast';
import * as Haptics from 'expo-haptics';
import { Image } from 'expo-image';
import { useFocusEffect } from '@react-navigation/native';
import { useRouter } from 'expo-router';
import { Crown, Plus, UserPlus, Users } from 'lucide-react-native';
import { useCallback, useEffect, useRef, useState, memo } from 'react';
import {
    ActivityIndicator,
    Platform,
    Pressable,
    RefreshControl,
    SafeAreaView,
    ScrollView,
    StyleSheet,
    Text,
    View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

// Memoized card so list stays light when store updates
const GroupCard = memo(function GroupCard({
  group,
  isOwner,
  onPress,
}: {
  group: { id: string; name: string; imageUrl?: string | null; members: { id: string }[]; ownerId: string };
  isOwner: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={styles.groupCard}
      hitSlop={{ top: 5, bottom: 5, left: 5, right: 5 }}
      delayPressIn={0}
      pressRetentionOffset={{ top: 20, bottom: 20, left: 20, right: 20 }}
    >
      <View style={styles.groupCardHeader}>
        <Pressable onPress={onPress} style={styles.groupIcon} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }} pressRetentionOffset={{ top: 20, bottom: 20, left: 20, right: 20 }}>
          {group.imageUrl ? (
            <Image source={{ uri: group.imageUrl }} style={styles.groupImage} contentFit="cover" />
          ) : (
            <Users size={28} color={colors.primary} strokeWidth={2} />
          )}
        </Pressable>
        <Pressable onPress={onPress} style={styles.groupInfo} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }} pressRetentionOffset={{ top: 20, bottom: 20, left: 20, right: 20 }}>
          <Text style={styles.groupName}>{group.name}</Text>
          <View style={styles.groupMeta}>
            <Text style={styles.memberCount}>
              {group.members.length} {group.members.length === 1 ? 'member' : 'members'}
            </Text>
            <View style={styles.roleBadge}>
              {isOwner ? (
                <>
                  <Crown size={12} color="#F59E0B" strokeWidth={2} />
                  <Text style={styles.roleBadgeText}>Owner</Text>
                </>
              ) : (
                <Text style={styles.roleText}>Member</Text>
              )}
            </View>
          </View>
        </Pressable>
      </View>
    </Pressable>
  );
});

export default function GroupScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const groups = useGroupStore((s) => s.groups);
  const loading = useGroupStore((s) => s.loading);
  const fetchMyGroups = useGroupStore((s) => s.fetchMyGroups);
  const createGroup = useGroupStore((s) => s.createGroup);
  const joinGroup = useGroupStore((s) => s.joinGroup);
  const { canCreateGroup, refetchGroupCount, limitMessages } = useSubscriptionLimits();
  const [isCreateModalVisible, setIsCreateModalVisible] = useState(false);
  const [isJoinModalVisible, setIsJoinModalVisible] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [initialLoadDone, setInitialLoadDone] = useState(false);
  const [skeletonMinElapsed, setSkeletonMinElapsed] = useState(Platform.OS === 'web');
  const [focusSkeletonUntil, setFocusSkeletonUntil] = useState(0); // native: show skeleton when focusing with empty list
  const prevLoadingRef = useRef(loading);
  const insets = useSafeAreaInsets();
  const isActioningRef = useRef(false);

  // On native, keep skeleton visible for a minimum time on first mount
  useEffect(() => {
    if (Platform.OS === 'web') return;
    const id = setTimeout(() => setSkeletonMinElapsed(true), 400);
    return () => clearTimeout(id);
  }, []);

  // Mark initial load done when loading transitions from true → false
  useEffect(() => {
    if (prevLoadingRef.current === true && loading === false) {
      const id = setTimeout(() => setInitialLoadDone(true), Platform.OS === 'web' ? 0 : 80);
      prevLoadingRef.current = loading;
      return () => clearTimeout(id);
    }
    prevLoadingRef.current = loading;
  }, [loading]);

  // Fetch groups when user is ready
  useEffect(() => {
    if (user?.id) fetchMyGroups(user.id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);

  const lastFetchRef = useRef<number>(0);
  const FOCUS_REFETCH_MS = 10_000;
  useFocusEffect(
    useCallback(() => {
      if (!user?.id) return;
      if (Platform.OS !== 'web' && groups.length === 0) {
        setFocusSkeletonUntil(Date.now() + 400);
        const t = setTimeout(() => setFocusSkeletonUntil(0), 400);
        return () => {
          clearTimeout(t);
          setFocusSkeletonUntil(0);
        };
      }
    }, [user?.id, groups.length])
  );

  useFocusEffect(
    useCallback(() => {
      if (!user?.id) return;
      const now = Date.now();
      if (now - lastFetchRef.current < FOCUS_REFETCH_MS) return;
      lastFetchRef.current = now;
      fetchMyGroups(user.id);
      refetchGroupCount();
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [user?.id])
  );

  // Pull-to-Refresh handler
  const onRefresh = useCallback(async () => {
    if (!user?.id) return;
    
    setRefreshing(true);
    try {
      await fetchMyGroups(user.id);
    } finally {
      setRefreshing(false);
    }
  }, [user?.id, fetchMyGroups]);

  const handleCreateGroup = async (name: string): Promise<{ success: boolean; error?: string }> => {
    if (!user) {
      showToast('error', 'Error', 'Please log in to create a group');
      return { success: false, error: 'Please log in to create a group' };
    }

    const { success, error } = await createGroup(name, user.id);
    if (success) return { success: true };
    const message = error || 'Failed to create group';
    return { success: false, error: message };
  };

  const handleJoinGroup = async (inviteCode: string) => {
    if (!user) {
      showToast('error', 'Error', 'Please log in to join a group');
      return;
    }

    const { success, error, group } = await joinGroup(inviteCode, user.id);
    
    if (success && group) {
      // Navigate to the joined group's detail page
      router.push({
        pathname: '/group-detail',
        params: { groupId: group.id },
      });
    } else {
      showToast('error', 'Error', error || 'Group not found. Please check the invite code.');
    }
  };

  const isNavigatingRef = useRef(false);
  
  const handleGroupPress = useCallback((groupId: string) => {
    if (isNavigatingRef.current) return;
    isNavigatingRef.current = true;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    router.push({
      pathname: '/group-detail',
      params: { groupId },
    });
    setTimeout(() => {
      isNavigatingRef.current = false;
    }, 300);
  }, [router]);

  // groups already contains only groups the user is a member of (from fetchMyGroups)
  const myGroups = groups;

  // Wait for user so fetch runs with valid session (avoids empty on first load)
  if (!user) {
    return (
      <SafeAreaView style={styles.container}>
        {Platform.OS === 'android' && <View style={{ height: insets.top }} />}
        <View style={styles.header}>
          <Text style={styles.headerTitle}>My Groups</Text>
          <View style={styles.headerActions} />
        </View>
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      {/* Android only: Add top padding for status bar */}
      {Platform.OS === 'android' && <View style={{ height: insets.top }} />}
      
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>My Groups</Text>
        <View style={styles.headerActions}>
          <Pressable
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
              setIsJoinModalVisible(true);
            }}
            style={({ pressed }) => [
              styles.joinButton,
              pressed && { opacity: 0.7 },
            ]}
            hitSlop={{ top: 24, bottom: 24, left: 24, right: 24 }}
          >
            <UserPlus size={20} color={colors.primary} strokeWidth={2} />
          </Pressable>
          <Pressable
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
              if (!canCreateGroup) {
                showToast('error', 'Limit', limitMessages.groups);
                return;
              }
              setIsCreateModalVisible(true);
            }}
            style={({ pressed }) => [
              styles.addButton,
              pressed && { opacity: 0.7 },
              !canCreateGroup && { opacity: 0.6 },
            ]}
            hitSlop={{ top: 24, bottom: 24, left: 24, right: 24 }}
          >
            <Plus size={24} color={colors.primary} strokeWidth={2} />
          </Pressable>
        </View>
      </View>

      {/* Group List */}
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={Platform.OS === 'web'}
        keyboardShouldPersistTaps="handled"
        nestedScrollEnabled={true}
        removeClippedSubviews={Platform.OS !== 'web'}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={colors.primary}
            colors={[colors.primary]}
          />
        }
      >
        {myGroups.length === 0 && (loading || !initialLoadDone || !skeletonMinElapsed || (Platform.OS !== 'web' && focusSkeletonUntil > 0)) ? (
          <GroupListSkeleton />
        ) : myGroups.length === 0 ? (
          <View style={styles.emptyContainer}>
            <View style={styles.emptyIconContainer}>
              <Users size={40} color={colors.textSub} strokeWidth={2} />
            </View>
            <Text style={styles.emptyHint}>No groups yet</Text>
            <View style={styles.emptyActions}>
              <Pressable
                onPress={() => {
                  if (isActioningRef.current) return;
                  isActioningRef.current = true;
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
                  setIsJoinModalVisible(true);
                  setTimeout(() => { isActioningRef.current = false; }, 100);
                }}
                style={styles.emptyJoinButton}
                hitSlop={{ top: 15, bottom: 15, left: 15, right: 15 }}
                delayPressIn={0}
                delayPressOut={0}
                pressRetentionOffset={{ top: 40, bottom: 40, left: 40, right: 40 }}
              >
                <Text style={styles.emptyButtonText}>Join Group</Text>
              </Pressable>
              <Pressable
                onPress={() => {
                  if (isActioningRef.current) return;
                  isActioningRef.current = true;
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
                  setIsCreateModalVisible(true);
                  setTimeout(() => { isActioningRef.current = false; }, 100);
                }}
                style={styles.emptyCreateButton}
                hitSlop={{ top: 15, bottom: 15, left: 15, right: 15 }}
                delayPressIn={0}
                delayPressOut={0}
                pressRetentionOffset={{ top: 40, bottom: 40, left: 40, right: 40 }}
              >
                <Text style={[styles.emptyButtonText, { color: colors.primaryForeground }]}>
                  Create Group
                </Text>
              </Pressable>
            </View>
          </View>
        ) : (
          <View style={styles.groupsList}>
            {myGroups.map((group) => (
              <GroupCard
                key={group.id}
                group={group}
                isOwner={group.ownerId === user?.id}
                onPress={() => handleGroupPress(group.id)}
              />
            ))}
          </View>
        )}
      </ScrollView>

      {/* Create Group Modal */}
      <CreateGroupModal
        visible={isCreateModalVisible}
        onClose={() => setIsCreateModalVisible(false)}
        onCreate={handleCreateGroup}
        canCreateGroup={canCreateGroup}
        limitMessage={limitMessages.groups}
      />

      {/* Join Group Modal */}
      <JoinGroupModal
        visible={isJoinModalVisible}
        onClose={() => setIsJoinModalVisible(false)}
        onJoin={handleJoinGroup}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(229, 231, 235, 0.5)',
    backgroundColor: colors.background,
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: colors.textMain,
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  joinButton: {
    width: 44,
    height: 44,
    borderRadius: borderRadius.full,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.gray100,
  },
  addButton: {
    width: 44,
    height: 44,
    borderRadius: borderRadius.full,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.gray100,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
    paddingBottom: Platform.OS === 'web' ? 24 : 16,
  },
  emptyContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 80,
  },
  emptyIconContainer: {
    width: 80,
    height: 80,
    borderRadius: borderRadius.lg,
    backgroundColor: colors.gray100,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  emptyHint: {
    fontSize: 14,
    color: colors.textSub,
    marginBottom: 24,
    textAlign: 'center',
  },
  emptyActions: {
    flexDirection: 'row',
    marginTop: 8,
  },
  emptyJoinButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: colors.primary,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: borderRadius.md,
    marginRight: 12,
  },
  emptyCreateButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.primary,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: borderRadius.md,
  },
  emptyButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.primary,
  },
  groupsList: {
    // gap replaced with marginBottom on each card
  },
  groupCard: {
    backgroundColor: colors.card,
    borderRadius: borderRadius.xl,
    padding: 16,
    marginBottom: 12,
    ...shadows.sm,
    borderWidth: 1,
    borderColor: 'rgba(229, 231, 235, 0.5)',
  },
  groupCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  groupIcon: {
    width: 56,
    height: 56,
    borderRadius: borderRadius.md,
    backgroundColor: colors.primary + '1A',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 16,
    flexShrink: 0,
    overflow: 'hidden',
  },
  groupImage: {
    width: '100%',
    height: '100%',
  },
  groupInfo: {
    flex: 1,
    minWidth: 0,
  },
  groupName: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.textMain,
    marginBottom: 4,
  },
  groupMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
  },
  memberCount: {
    fontSize: 14,
    color: colors.textSub,
    marginRight: 8,
  },
  roleBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(245, 158, 11, 0.1)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: borderRadius.full,
  },
  roleBadgeText: {
    fontSize: 12,
    fontWeight: '500',
    color: '#F59E0B',
    marginLeft: 4,
  },
  roleText: {
    fontSize: 12,
    color: colors.textSub,
  },
});
