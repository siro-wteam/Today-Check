import { CreateGroupModal } from '@/components/CreateGroupModal';
import { JoinGroupModal } from '@/components/JoinGroupModal';
import { borderRadius, colors, shadows } from '@/constants/colors';
import { useAuth } from '@/lib/hooks/use-auth';
import { useGroupStore } from '@/lib/stores/useGroupStore';
import { showToast } from '@/utils/toast';
import * as Haptics from 'expo-haptics';
import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import { Crown, Plus, UserPlus, Users } from 'lucide-react-native';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
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

export default function GroupScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const { groups, createGroup, joinGroup, fetchMyGroups, loading } = useGroupStore();
  const [isCreateModalVisible, setIsCreateModalVisible] = useState(false);
  const [isJoinModalVisible, setIsJoinModalVisible] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const insets = useSafeAreaInsets();
  const isActioningRef = useRef(false);

  // Fetch groups on mount (only once)
  useEffect(() => {
    if (user?.id) {
      fetchMyGroups(user.id);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);

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

  const handleCreateGroup = async (name: string) => {
    if (!user) {
      showToast('error', 'Error', 'Please log in to create a group');
      return;
    }

    const { success, error } = await createGroup(name, user.id);
    
    if (success) {
      // Modal will be closed by CreateGroupModal
    } else {
      showToast('error', 'Error', error || 'Failed to create group');
    }
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
              setIsCreateModalVisible(true);
            }}
            style={({ pressed }) => [
              styles.addButton,
              pressed && { opacity: 0.7 },
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
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={colors.primary}
            colors={[colors.primary]}
          />
        }
      >
        {myGroups.length === 0 ? (
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
            {myGroups.map((group) => {
              const currentUser = group.members.find((m) => m.id === user?.id);
              const isOwner = group.ownerId === user?.id;

              return (
                <Pressable
                  key={group.id}
                  onPress={() => handleGroupPress(group.id)}
                  style={styles.groupCard}
                  hitSlop={{ top: 5, bottom: 5, left: 5, right: 5 }}
                  delayPressIn={0}
                  pressRetentionOffset={{ top: 20, bottom: 20, left: 20, right: 20 }}
                >
                  <View style={styles.groupCardHeader}>
                    <Pressable
                      onPress={() => handleGroupPress(group.id)}
                      style={styles.groupIcon}
                      hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                      pressRetentionOffset={{ top: 20, bottom: 20, left: 20, right: 20 }}
                    >
                      {group.imageUrl ? (
                        <Image
                          source={{ uri: group.imageUrl }}
                          style={styles.groupImage}
                          contentFit="cover"
                        />
                      ) : (
                        <Users size={28} color={colors.primary} strokeWidth={2} />
                      )}
                    </Pressable>
                    <Pressable
                      onPress={() => handleGroupPress(group.id)}
                      style={styles.groupInfo}
                      hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                      pressRetentionOffset={{ top: 20, bottom: 20, left: 20, right: 20 }}
                    >
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
            })}
          </View>
        )}
      </ScrollView>

      {/* Create Group Modal */}
      <CreateGroupModal
        visible={isCreateModalVisible}
        onClose={() => setIsCreateModalVisible(false)}
        onCreate={handleCreateGroup}
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
