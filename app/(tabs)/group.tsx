import { AppHeader } from '@/components/AppHeader';
import { CreateGroupModal } from '@/components/CreateGroupModal';
import { GroupListSkeleton } from '@/components/GroupListSkeleton';
import { JoinGroupModal } from '@/components/JoinGroupModal';
import { borderRadius, colors, shadows } from '@/constants/colors';
import { useAuth } from '@/lib/hooks/use-auth';
import { useGroupDeleteLeave } from '@/lib/hooks/use-group-delete-leave';
import { useSubscriptionLimits } from '@/lib/hooks/use-subscription-limits';
import { useGroupStore } from '@/lib/stores/useGroupStore';
import { showToast } from '@/utils/toast';
import * as Haptics from 'expo-haptics';
import { Image } from 'expo-image';
import { useFocusEffect } from '@react-navigation/native';
import { useRouter } from 'expo-router';
import { Crown, LogOut, Plus, Trash2, UserPlus, Users } from 'lucide-react-native';
import { Link2 } from 'lucide-react-native';
import { useCallback, useEffect, useRef, useState, memo } from 'react';
import {
    ActivityIndicator,
    Dimensions,
    Platform,
    Pressable,
    RefreshControl,
    SafeAreaView,
    ScrollView,
    StyleSheet,
    Text,
    View,
} from 'react-native';
import { Swipeable } from 'react-native-gesture-handler';
import DraggableFlatList, { ScaleDecorator } from 'react-native-draggable-flatlist';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { Group } from '@/lib/types';

const SCREEN_WIDTH = Dimensions.get('window').width;
const PAGE_WIDTH = Platform.OS === 'web' ? Math.min(SCREEN_WIDTH, 600) : SCREEN_WIDTH;

// Memoized card; only icon and group name open detail (like backlog/week view)
const GroupCard = memo(function GroupCard({
  group,
  isOwner,
  onPress,
}: {
  group: Group;
  isOwner: boolean;
  onPress: () => void;
}) {
  return (
    <View style={styles.groupCard}>
      <View style={styles.groupCardHeader}>
        <Pressable
          onPress={onPress}
          style={styles.groupIcon}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          pressRetentionOffset={{ top: 20, bottom: 20, left: 20, right: 20 }}
        >
          {group.imageUrl ? (
            <Image source={{ uri: group.imageUrl }} style={styles.groupImage} contentFit="cover" />
          ) : (
            <Users size={22} color={colors.primary} strokeWidth={2} />
          )}
        </Pressable>
        <View style={styles.groupInfo}>
          <Pressable
            onPress={onPress}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            style={({ pressed }) => [pressed && { opacity: 0.7 }]}
          >
            <Text style={styles.groupName}>{group.name}</Text>
          </Pressable>
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
        </View>
      </View>
    </View>
  );
});

export default function GroupScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const groups = useGroupStore((s) => s.groups);
  const loading = useGroupStore((s) => s.loading);
  const fetchMyGroups = useGroupStore((s) => s.fetchMyGroups);
  const setGroupsOrder = useGroupStore((s) => s.setGroupsOrder);
  const createGroup = useGroupStore((s) => s.createGroup);
  const joinGroup = useGroupStore((s) => s.joinGroup);
  const deleteGroup = useGroupStore((s) => s.deleteGroup);
  const leaveGroup = useGroupStore((s) => s.leaveGroup);
  const { canCreateGroup, refetchGroupCount, limitMessages } = useSubscriptionLimits();
  const [isCreateModalVisible, setIsCreateModalVisible] = useState(false);
  const [isJoinModalVisible, setIsJoinModalVisible] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [initialLoadDone, setInitialLoadDone] = useState(false);
  const prevLoadingRef = useRef(loading);
  const insets = useSafeAreaInsets();
  const isActioningRef = useRef(false);

  // Mark initial load done when loading transitions from true → false (so we don't flash empty state)
  useEffect(() => {
    if (prevLoadingRef.current === true && loading === false) {
      setInitialLoadDone(true);
    }
    prevLoadingRef.current = loading;
  }, [loading]);

  // Fetch groups when user is ready (Group tab owns the first fetch so skeleton can show)
  useEffect(() => {
    if (user?.id) fetchMyGroups(user.id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);

  const lastFetchRef = useRef<number>(0);
  const FOCUS_REFETCH_MS = 10_000;
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

  useEffect(() => {
    return () => groupSwipeableClosers.current.clear();
  }, []);

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
  const groupSwipeableClosers = useRef(new Map<string, () => void>());

  const { confirmDeleteGroup, confirmLeaveGroup } = useGroupDeleteLeave(
    user?.id,
    deleteGroup,
    leaveGroup,
    {
      onSuccessDelete: (g) => groupSwipeableClosers.current.get(g.id)?.(),
      onSuccessLeave: (g) => groupSwipeableClosers.current.get(g.id)?.(),
      onCancelDelete: (g) => groupSwipeableClosers.current.get(g.id)?.(),
      onCancelLeave: (g) => groupSwipeableClosers.current.get(g.id)?.(),
    }
  );

  const copyInviteCode = useCallback(async (group: Group) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    if (Platform.OS === 'web') {
      try {
        if (navigator.clipboard?.writeText) {
          await navigator.clipboard.writeText(group.inviteCode);
          showToast('success', 'Invite code copied!');
        } else {
          const el = document.createElement('textarea');
          el.value = group.inviteCode;
          el.style.position = 'fixed';
          el.style.left = '-9999px';
          document.body.appendChild(el);
          el.select();
          document.execCommand('copy');
          document.body.removeChild(el);
          showToast('success', 'Invite code copied!');
        }
      } catch {
        showToast('info', 'Invite Code', `${group.inviteCode} — copy manually`);
      }
      return;
    }
    try {
      const Clipboard = require('@react-native-clipboard/clipboard').default;
      Clipboard.setString(group.inviteCode);
      showToast('success', 'Invite code copied to clipboard!');
    } catch {
      showToast('info', 'Invite Code', `${group.inviteCode} — copy manually`);
    }
  }, []);

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

  const myGroups = groups;
  const ownedCount = user?.id ? groups.filter((g) => g.ownerId === user.id).length : 0;
  const memberCount = groups.length;

  if (!user) {
    return (
      <SafeAreaView style={styles.container}>
        {Platform.OS === 'android' && <View style={{ height: insets.top }} />}
        <AppHeader />
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      {Platform.OS === 'android' && <View style={{ height: insets.top }} />}
      <AppHeader
        centerContent={
          <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1, minWidth: 0 }}>
            <View style={{ flex: 1, alignItems: 'flex-start', minWidth: 0 }}>
              <Text style={{ fontSize: 14, fontWeight: '600', color: colors.textMain }}>
                Groups
              </Text>
            </View>
            <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 4 }}>
              <Text style={{ fontSize: 14, fontWeight: '600', color: colors.textMain }}>
                I own{' '}
              </Text>
              <Text style={{ fontSize: 14, fontWeight: '500', color: colors.primary }}>
                {ownedCount}
              </Text>
              <Text style={{ fontSize: 14, fontWeight: '500', color: colors.textSub }}>
                ,{' '}
              </Text>
              <Text style={{ fontSize: 14, fontWeight: '600', color: colors.textMain }}>
                I'm in{' '}
              </Text>
              <Text style={{ fontSize: 14, fontWeight: '500', color: colors.primary }}>
                {memberCount}
              </Text>
            </View>
            <View style={{ flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end', gap: 8, minWidth: 0 }}>
              <Pressable
                onPress={() => {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
                  setIsJoinModalVisible(true);
                }}
                hitSlop={10}
                style={({ pressed }) => [{ opacity: pressed ? 0.7 : 1 }]}
              >
                <UserPlus size={18} color={colors.textSub} strokeWidth={2} />
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
                hitSlop={10}
                style={({ pressed }) => [{ opacity: canCreateGroup && pressed ? 0.7 : 1 }, !canCreateGroup && { opacity: 0.5 }]}
              >
                <Plus size={18} color={colors.textSub} strokeWidth={2} />
              </Pressable>
            </View>
          </View>
        }
      />

      {/* Group List: 주간/백로그와 동일 가로 폭, 가운데 정렬 */}
      <View
        style={{
          flex: 1,
          width: PAGE_WIDTH,
          alignSelf: 'center',
          ...(Platform.OS === 'web' ? { maxWidth: 600 } : {}),
        }}
      >
      {myGroups.length === 0 && (loading || !initialLoadDone) ? (
        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={Platform.OS === 'web'}
        >
          <GroupListSkeleton />
        </ScrollView>
      ) : myGroups.length === 0 ? (
        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={Platform.OS === 'web'}
        >
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
        </ScrollView>
      ) : (
        <DraggableFlatList<Group>
          data={myGroups}
          keyExtractor={(item) => item.id}
          onDragBegin={() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {})}
          onDragEnd={({ data }) => {
            if (user?.id) setGroupsOrder(data, user.id);
          }}
          renderItem={({ item, drag, isActive }) => {
            const isOwner = item.ownerId === user?.id;
            const renderRightActions = (
              _progress: unknown,
              _dragX: unknown,
              swipeable: { close: () => void } | undefined
            ) => {
              if (swipeable) groupSwipeableClosers.current.set(item.id, swipeable.close);
              return (
                <View style={styles.swipeActions}>
                  <Pressable
                    onPress={async () => {
                      await copyInviteCode(item);
                      swipeable?.close();
                    }}
                    style={styles.swipeActionInvite}
                  >
                    <Link2 size={20} color="#FFFFFF" strokeWidth={2} />
                    <Text style={styles.swipeActionText}>Invite</Text>
                  </Pressable>
                  {isOwner ? (
                    <Pressable
                      onPress={() => confirmDeleteGroup(item)}
                      style={styles.swipeActionDelete}
                    >
                      <Trash2 size={20} color="#FFFFFF" strokeWidth={2} />
                      <Text style={styles.swipeActionText}>Delete</Text>
                    </Pressable>
                  ) : (
                    <Pressable
                      onPress={() => confirmLeaveGroup(item)}
                      style={styles.swipeActionLeave}
                    >
                      <LogOut size={20} color="#FFFFFF" strokeWidth={2} />
                      <Text style={styles.swipeActionText}>Leave</Text>
                    </Pressable>
                  )}
                </View>
              );
            };
            return (
              <Swipeable
                renderRightActions={renderRightActions}
                overshootRight={false}
                friction={2}
                rightThreshold={40}
              >
                <ScaleDecorator activeScale={1.02}>
                  <Pressable
                    onLongPress={drag}
                    delayLongPress={200}
                    disabled={isActive}
                    style={[styles.dragRow, isActive && styles.dragRowActive]}
                  >
                    <GroupCard
                      group={item}
                      isOwner={isOwner}
                      onPress={() => handleGroupPress(item.id)}
                    />
                  </Pressable>
                </ScaleDecorator>
              </Swipeable>
            );
          }}
          contentContainerStyle={styles.scrollContent}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor={colors.primary}
              colors={[colors.primary]}
            />
          }
        />
      )}
      </View>

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
  dragRow: {},
  dragRowActive: {
    opacity: 0.95,
  },
  swipeActions: {
    flexDirection: 'row',
    alignItems: 'stretch',
    gap: 2,
    marginBottom: 12,
  },
  swipeActionInvite: {
    width: 72,
    backgroundColor: colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
    borderTopLeftRadius: borderRadius.xl,
    borderBottomLeftRadius: borderRadius.xl,
    gap: 2,
  },
  swipeActionDelete: {
    width: 72,
    backgroundColor: colors.error,
    justifyContent: 'center',
    alignItems: 'center',
    borderTopRightRadius: borderRadius.xl,
    borderBottomRightRadius: borderRadius.xl,
    gap: 2,
  },
  swipeActionLeave: {
    width: 72,
    backgroundColor: colors.error,
    justifyContent: 'center',
    alignItems: 'center',
    borderTopRightRadius: borderRadius.xl,
    borderBottomRightRadius: borderRadius.xl,
    gap: 2,
  },
  swipeActionText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  groupsList: {
    // unused when using DraggableFlatList
  },
  groupCard: {
    backgroundColor: colors.card,
    borderRadius: borderRadius.xl,
    paddingVertical: 12,
    paddingHorizontal: 12,
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
    width: 40,
    height: 40,
    borderRadius: borderRadius.md,
    backgroundColor: colors.primary + '1A',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
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
    fontSize: 14,
    fontWeight: '600',
    color: colors.textMain,
    marginBottom: 2,
  },
  groupMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
  },
  memberCount: {
    fontSize: 13,
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
