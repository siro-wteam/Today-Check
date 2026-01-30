/**
 * Group Management Store (Zustand)
 * 
 * Manages group creation, deletion, joining, and leaving functionality with Supabase backend.
 */

import { create } from 'zustand';
import type { Group } from '../types';
import { supabase } from '../supabase';
import type { RealtimeChannel } from '@supabase/supabase-js';
import {
  createGroup as createGroupAPI,
  joinGroupByCode as joinGroupByCodeAPI,
  fetchMyGroups as fetchMyGroupsAPI,
  fetchGroupById as fetchGroupByIdAPI,
  deleteGroup as deleteGroupAPI,
  leaveGroup as leaveGroupAPI,
  promoteMember as promoteMemberAPI,
  demoteMember as demoteMemberAPI,
  updateGroupName as updateGroupNameAPI,
  kickMember as kickMemberAPI,
} from '../api/groups';
import { fetchProfiles } from '../api/profiles';

// Lazy import for React Query (to avoid circular dependencies)
let queryClientInstance: any = null;
const getQueryClient = () => {
  if (!queryClientInstance) {
    // Dynamic import to avoid circular dependency
    try {
      const { useQueryClient } = require('@tanstack/react-query');
      // Note: This won't work in Zustand store context
      // We'll need to pass queryClient from outside
    } catch (e) {
      // Ignore
    }
  }
  return queryClientInstance;
};

// Set query client from outside (called from app initialization)
export const setQueryClientForGroupStore = (queryClient: any) => {
  queryClientInstance = queryClient;
};

interface GroupState {
  groups: Group[];
  currentGroup: Group | null;
  loading: boolean;
  error: string | null;
  subscriptionChannel: RealtimeChannel | null;
  membersSubscriptionChannel: RealtimeChannel | null;
  onMemberChange: ((event: 'INSERT' | 'DELETE') => void) | null;
  onKickedFromGroup: ((groupId: string) => void) | null;

  // Actions
  createGroup: (name: string, userId: string) => Promise<{ success: boolean; error?: string }>;
  joinGroup: (inviteCode: string, userId: string) => Promise<{ success: boolean; error?: string; group?: Group }>;
  fetchMyGroups: (userId: string) => Promise<void>;
  fetchGroupById: (groupId: string, userId?: string) => Promise<{ success: boolean; error?: string }>;
  deleteGroup: (groupId: string, userId: string) => Promise<{ success: boolean; error?: string }>;
  leaveGroup: (groupId: string, userId: string) => Promise<{ success: boolean; error?: string }>;
  promoteMember: (groupId: string, targetUserId: string) => Promise<{ success: boolean; error?: string }>;
  demoteMember: (groupId: string, targetUserId: string) => Promise<{ success: boolean; error?: string }>;
  updateGroupName: (groupId: string, newName: string) => Promise<{ success: boolean; error?: string }>;
  kickMember: (groupId: string, targetUserId: string) => Promise<{ success: boolean; error?: string }>;
  subscribeToGroupUpdates: (groupId: string, onMemberChange?: (event: 'INSERT' | 'DELETE') => void) => () => void;
  unsubscribeFromGroupUpdates: () => void;
  subscribeToGroupMembers: (userId: string, onKickedFromGroup?: (groupId: string) => void) => () => void;
  unsubscribeFromGroupMembers: () => void;
  setCurrentGroup: (group: Group | null) => void;
  clearError: () => void;
}

export const useGroupStore = create<GroupState>((set, get) => ({
  groups: [],
  currentGroup: null,
  loading: false,
  error: null,
  subscriptionChannel: null,
  membersSubscriptionChannel: null,
  onMemberChange: null,
  onKickedFromGroup: null,

  createGroup: async (name: string, userId: string) => {
    set({ loading: true, error: null });

    try {
      const { data, error } = await createGroupAPI(name, userId);

      if (error || !data) {
        const errorMessage = error?.message || 'Failed to create group';
        set({ loading: false, error: errorMessage });
        return { success: false, error: errorMessage };
      }

      // Optimistic update: Add new group to local state immediately
      set((state) => ({
        groups: [data, ...state.groups],
        loading: false,
        currentGroup: data,
      }));

      return { success: true };
    } catch (err: any) {
      const errorMessage = err.message || 'Failed to create group';
      set({ loading: false, error: errorMessage });
      return { success: false, error: errorMessage };
    }
  },

  joinGroup: async (inviteCode: string, userId: string) => {
    set({ loading: true, error: null });

    try {
      const { data, error } = await joinGroupByCodeAPI(inviteCode, userId);

      if (error || !data) {
        const errorMessage = error?.message || 'Failed to join group';
        set({ loading: false, error: errorMessage });
        return { success: false, error: errorMessage };
      }

      // Optimistic update: Add joined group to local state immediately
      set((state) => {
        // Check if group already exists (avoid duplicates)
        const exists = state.groups.some((g) => g.id === data.id);
        if (exists) {
          return {
            groups: state.groups.map((g) => (g.id === data.id ? data : g)),
            loading: false,
            currentGroup: data,
          };
        }
        return {
          groups: [data, ...state.groups],
          loading: false,
          currentGroup: data,
        };
      });

      // Reset calendar store initialization to force reload with new group tasks
      // This ensures group tasks are loaded after joining
      if (queryClientInstance) {
        // Invalidate all task queries to force refetch
        queryClientInstance.invalidateQueries({ queryKey: ['tasks'], exact: false });
        
        // Reset calendar store initialization flag
        const { useCalendarStore } = require('./useCalendarStore');
        useCalendarStore.getState().resetInitialization();
      }

      return { success: true, group: data };
    } catch (err: any) {
      const errorMessage = err.message || 'Failed to join group';
      set({ loading: false, error: errorMessage });
      return { success: false, error: errorMessage };
    }
  },

  fetchMyGroups: async (userId: string) => {
    set({ loading: true, error: null });

    try {
      const { data, error } = await fetchMyGroupsAPI(userId);

      if (error) {
        const errorMessage = error.message || 'Failed to fetch groups';
        set({ loading: false, error: errorMessage });
        return;
      }

      // Update groups array
      const updatedGroups = data || [];
      
      // Sync currentGroup with updated groups data if it exists
      set((state) => {
        let updatedCurrentGroup = state.currentGroup;
        if (updatedCurrentGroup) {
          // Find the updated group data from the fetched groups
          const updatedGroup = updatedGroups.find((g) => g.id === updatedCurrentGroup?.id);
          if (updatedGroup) {
            // Update currentGroup with latest data (especially members)
            updatedCurrentGroup = updatedGroup;
          }
        }

        return {
          groups: updatedGroups,
          currentGroup: updatedCurrentGroup,
          loading: false,
        };
      });
    } catch (err: any) {
      const errorMessage = err.message || 'Failed to fetch groups';
      set({ loading: false, error: errorMessage });
    }
  },

  fetchGroupById: async (groupId: string, userId?: string) => {
    set({ loading: true, error: null });

    try {
      const { data, error } = await fetchGroupByIdAPI(groupId, userId);

      if (error || !data) {
        const errorMessage = error?.message || 'Group not found';
        set({ loading: false, error: errorMessage });
        return { success: false, error: errorMessage };
      }

      // Update both currentGroup and groups array to keep them in sync
      set((state) => {
        // Update groups array if this group exists in it
        const updatedGroups = state.groups.map((g) =>
          g.id === groupId ? data : g
        );

        return {
          currentGroup: data,
          groups: updatedGroups,
          loading: false,
        };
      });

      return { success: true };
    } catch (err: any) {
      const errorMessage = err.message || 'Failed to fetch group';
      set({ loading: false, error: errorMessage });
      return { success: false, error: errorMessage };
    }
  },

  deleteGroup: async (groupId: string, userId: string) => {
    set({ loading: true, error: null });

    try {
      const { error } = await deleteGroupAPI(groupId, userId);

      if (error) {
        const errorMessage = error.message || 'Failed to delete group';
        set({ loading: false, error: errorMessage });
        return { success: false, error: errorMessage };
      }

      // Optimistic update: Remove group from local state immediately
      set((state) => ({
        groups: state.groups.filter((g) => g.id !== groupId),
        loading: false,
        currentGroup: state.currentGroup?.id === groupId ? null : state.currentGroup,
      }));

      // Remove all tasks from this group from React Query cache
      // (CASCADE DELETE will handle DB cleanup, but we need to update UI immediately)
      if (queryClientInstance) {
        // Remove tasks from unified queries (all date ranges)
        queryClientInstance.setQueriesData(
          { queryKey: ['tasks', 'unified'], exact: false },
          (oldData: any) => {
            if (!oldData || !Array.isArray(oldData)) return oldData;
            // Filter out all tasks from the deleted group
            return oldData.filter((task: any) => task.group_id !== groupId);
          }
        );
        
        // Remove tasks from today query
        queryClientInstance.setQueriesData(
          { queryKey: ['tasks', 'today'], exact: false },
          (oldData: any) => {
            if (!oldData || !Array.isArray(oldData)) return oldData;
            return oldData.filter((task: any) => task.group_id !== groupId);
          }
        );
        
        // Remove tasks from backlog query
        queryClientInstance.setQueriesData(
          { queryKey: ['tasks', 'backlog'], exact: false },
          (oldData: any) => {
            if (!oldData || !Array.isArray(oldData)) return oldData;
            return oldData.filter((task: any) => task.group_id !== groupId);
          }
        );
        
        // Invalidate to ensure server sync (but UI is already updated)
        queryClientInstance.invalidateQueries({ queryKey: ['tasks', 'unified'], exact: false });
        queryClientInstance.invalidateQueries({ queryKey: ['tasks', 'today'] });
        queryClientInstance.invalidateQueries({ queryKey: ['tasks', 'backlog'] });
      }

      return { success: true };
    } catch (err: any) {
      const errorMessage = err.message || 'Failed to delete group';
      set({ loading: false, error: errorMessage });
      return { success: false, error: errorMessage };
    }
  },

  leaveGroup: async (groupId: string, userId: string) => {
    set({ loading: true, error: null });

    try {
      const { error } = await leaveGroupAPI(groupId, userId);

      if (error) {
        const errorMessage = error.message || 'Failed to leave group';
        set({ loading: false, error: errorMessage });
        return { success: false, error: errorMessage };
      }

      // Optimistic update: Remove group from local state immediately
      set((state) => ({
        groups: state.groups.filter((g) => g.id !== groupId),
        loading: false,
        currentGroup: state.currentGroup?.id === groupId ? null : state.currentGroup,
      }));

      // Remove all tasks from this group from React Query cache
      // (DB trigger already cleaned up task_assignees, but we need to update UI immediately)
      if (queryClientInstance) {
        // Remove tasks from unified queries (all date ranges)
        queryClientInstance.setQueriesData(
          { queryKey: ['tasks', 'unified'], exact: false },
          (oldData: any) => {
            if (!oldData || !Array.isArray(oldData)) return oldData;
            // Filter out all tasks from the group we left
            return oldData.filter((task: any) => task.group_id !== groupId);
          }
        );
        
        // Remove tasks from today query
        queryClientInstance.setQueriesData(
          { queryKey: ['tasks', 'today'], exact: false },
          (oldData: any) => {
            if (!oldData || !Array.isArray(oldData)) return oldData;
            return oldData.filter((task: any) => task.group_id !== groupId);
          }
        );
        
        // Remove tasks from backlog query
        queryClientInstance.setQueriesData(
          { queryKey: ['tasks', 'backlog'], exact: false },
          (oldData: any) => {
            if (!oldData || !Array.isArray(oldData)) return oldData;
            return oldData.filter((task: any) => task.group_id !== groupId);
          }
        );
        
        // Invalidate to ensure server sync (but UI is already updated)
        queryClientInstance.invalidateQueries({ queryKey: ['tasks', 'unified'], exact: false });
        queryClientInstance.invalidateQueries({ queryKey: ['tasks', 'today'] });
        queryClientInstance.invalidateQueries({ queryKey: ['tasks', 'backlog'] });
      }

      return { success: true };
    } catch (err: any) {
      const errorMessage = err.message || 'Failed to leave group';
      set({ loading: false, error: errorMessage });
      return { success: false, error: errorMessage };
    }
  },

  promoteMember: async (groupId: string, targetUserId: string) => {
    set({ loading: true, error: null });

    try {
      const { success, error } = await promoteMemberAPI(groupId, targetUserId);

      if (!success || error) {
        const errorMessage = error?.message || 'Failed to promote member';
        set({ loading: false, error: errorMessage });
        return { success: false, error: errorMessage };
      }

      // Optimistic update: Update member role in local state
      set((state) => {
        const updateMemberRole = (group: Group) => {
          if (group.id !== groupId) return group;
          return {
            ...group,
            members: group.members.map((member) =>
              member.id === targetUserId ? { ...member, role: 'ADMIN' as const } : member
            ),
          };
        };

        return {
          groups: state.groups.map(updateMemberRole),
          currentGroup: state.currentGroup ? updateMemberRole(state.currentGroup) : null,
          loading: false,
        };
      });

      // Refresh group data from server to ensure consistency
      // (Note: group-detail.tsx also calls fetchGroupById, but this ensures store is updated)
      await get().fetchGroupById(groupId);

      return { success: true };
    } catch (err: any) {
      const errorMessage = err.message || 'Failed to promote member';
      set({ loading: false, error: errorMessage });
      return { success: false, error: errorMessage };
    }
  },

  demoteMember: async (groupId: string, targetUserId: string) => {
    set({ loading: true, error: null });

    try {
      const { success, error } = await demoteMemberAPI(groupId, targetUserId);

      if (!success || error) {
        const errorMessage = error?.message || 'Failed to demote member';
        set({ loading: false, error: errorMessage });
        return { success: false, error: errorMessage };
      }

      // Optimistic update: Update member role in local state
      set((state) => {
        const updateMemberRole = (group: Group) => {
          if (group.id !== groupId) return group;
          return {
            ...group,
            members: group.members.map((member) =>
              member.id === targetUserId ? { ...member, role: 'MEMBER' as const } : member
            ),
          };
        };

        return {
          groups: state.groups.map(updateMemberRole),
          currentGroup: state.currentGroup ? updateMemberRole(state.currentGroup) : null,
          loading: false,
        };
      });

      // Refresh group data from server to ensure consistency
      // (Note: group-detail.tsx also calls fetchGroupById, but this ensures store is updated)
      await get().fetchGroupById(groupId);

      return { success: true };
    } catch (err: any) {
      const errorMessage = err.message || 'Failed to demote member';
      set({ loading: false, error: errorMessage });
      return { success: false, error: errorMessage };
    }
  },

  updateGroupName: async (groupId: string, newName: string) => {
    set({ loading: true, error: null });

    try {
      const { success, error } = await updateGroupNameAPI(groupId, newName);

      if (!success || error) {
        const errorMessage = error?.message || 'Failed to update group name';
        set({ loading: false, error: errorMessage });
        return { success: false, error: errorMessage };
      }

      // Optimistic update: Update group name in local state
      set((state) => {
        const updateGroupName = (group: Group) => {
          if (group.id !== groupId) return group;
          return { ...group, name: newName.trim() };
        };

        return {
          groups: state.groups.map(updateGroupName),
          currentGroup: state.currentGroup ? updateGroupName(state.currentGroup) : null,
          loading: false,
        };
      });

      return { success: true };
    } catch (err: any) {
      const errorMessage = err.message || 'Failed to update group name';
      set({ loading: false, error: errorMessage });
      return { success: false, error: errorMessage };
    }
  },

  kickMember: async (groupId: string, targetUserId: string) => {
    set({ loading: true, error: null });

    try {
      const { success, error } = await kickMemberAPI(groupId, targetUserId);

      if (!success || error) {
        const errorMessage = error?.message || 'Failed to kick member';
        set({ loading: false, error: errorMessage });
        return { success: false, error: errorMessage };
      }

      // Optimistic update: Remove member from local state
      set((state) => {
        const removeMember = (group: Group) => {
          if (group.id !== groupId) return group;
          return {
            ...group,
            members: group.members.filter((member) => member.id !== targetUserId),
          };
        };

        return {
          groups: state.groups.map(removeMember),
          currentGroup: state.currentGroup ? removeMember(state.currentGroup) : null,
          loading: false,
        };
      });

      // Update React Query cache: Remove assignee from tasks in this group
      // DB trigger already removed incomplete task assignments, but we need to update UI immediately
      if (queryClientInstance) {
        // Optimistically update: Remove assignee from all tasks in this group
        queryClientInstance.setQueriesData(
          { queryKey: ['tasks', 'unified'], exact: false },
          (oldData: any) => {
            if (!oldData || !Array.isArray(oldData)) return oldData;
            
            return oldData.map((task: any) => {
              // Only update tasks in this group
              if (task.group_id !== groupId) return task;
              
              // Remove assignee from task
              if (task.assignees && Array.isArray(task.assignees)) {
                return {
                  ...task,
                  assignees: task.assignees.filter(
                    (assignee: any) => assignee.user_id !== targetUserId
                  ),
                };
              }
              return task;
            });
          }
        );
        
        // Also update other query keys
        queryClientInstance.setQueriesData(
          { queryKey: ['tasks', 'today'], exact: false },
          (oldData: any) => {
            if (!oldData || !Array.isArray(oldData)) return oldData;
            
            return oldData.map((task: any) => {
              if (task.group_id !== groupId) return task;
              
              if (task.assignees && Array.isArray(task.assignees)) {
                return {
                  ...task,
                  assignees: task.assignees.filter(
                    (assignee: any) => assignee.user_id !== targetUserId
                  ),
                };
              }
              return task;
            });
          }
        );
        
        queryClientInstance.setQueriesData(
          { queryKey: ['tasks', 'backlog'], exact: false },
          (oldData: any) => {
            if (!oldData || !Array.isArray(oldData)) return oldData;
            
            return oldData.map((task: any) => {
              if (task.group_id !== groupId) return task;
              
              if (task.assignees && Array.isArray(task.assignees)) {
                return {
                  ...task,
                  assignees: task.assignees.filter(
                    (assignee: any) => assignee.user_id !== targetUserId
                  ),
                };
              }
              return task;
            });
          }
        );
        
        // Invalidate after optimistic update to ensure accuracy
        // (DB trigger already cleaned up, but we want to sync with server)
        setTimeout(() => {
          queryClientInstance.invalidateQueries({ queryKey: ['tasks', 'unified'], exact: false });
        }, 500);
      }

      return { success: true };
    } catch (err: any) {
      const errorMessage = err.message || 'Failed to kick member';
      set({ loading: false, error: errorMessage });
      return { success: false, error: errorMessage };
    }
  },

  updateMemberProfile: (userId: string, newNickname: string) => {
    // Update member nickname in all groups and currentGroup
    set((state) => {
      // Update groups array
      const updatedGroups = state.groups.map((group) => {
        const updatedMembers = group.members.map((member) =>
          member.id === userId
            ? { ...member, name: newNickname }
            : member
        );
        return { ...group, members: updatedMembers };
      });

      // Update currentGroup if it exists
      let updatedCurrentGroup = state.currentGroup;
      if (updatedCurrentGroup) {
        const updatedCurrentMembers = updatedCurrentGroup.members.map((member) =>
          member.id === userId
            ? { ...member, name: newNickname }
            : member
        );
        updatedCurrentGroup = { ...updatedCurrentGroup, members: updatedCurrentMembers };
      }

      return {
        groups: updatedGroups,
        currentGroup: updatedCurrentGroup,
      };
    });
  },

  subscribeToGroupUpdates: (groupId: string, onMemberChange?: (event: 'INSERT' | 'DELETE') => void) => {
    // Unsubscribe from existing channel if any
    const existingChannel = get().subscriptionChannel;
    if (existingChannel) {
      supabase.removeChannel(existingChannel);
    }

    // Create new channel for this group
    const channel = supabase
      .channel(`group_members:${groupId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'group_members',
          filter: `group_id=eq.${groupId}`,
        },
        async (payload) => {
          console.log('New member joined:', payload);
          // Refresh group data
          // Note: userId not available in subscription callback, but fetchGroupById will handle it
          await get().fetchGroupById(groupId);
          // Call callback if provided
          if (onMemberChange) {
            onMemberChange('INSERT');
          }
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'DELETE',
          schema: 'public',
          table: 'group_members',
          filter: `group_id=eq.${groupId}`,
        },
        async (payload) => {
          console.log('Member left:', payload);
          // Refresh group data
          // Note: userId not available in subscription callback, but fetchGroupById will handle it
          await get().fetchGroupById(groupId);
          // Call callback if provided
          if (onMemberChange) {
            onMemberChange('DELETE');
          }
        }
      )
      .subscribe((status) => {
        console.log('Subscription status:', status);
        if (status === 'SUBSCRIBED') {
          console.log('Successfully subscribed to group updates');
        } else if (status === 'CHANNEL_ERROR') {
          console.error('Channel error occurred');
        }
      });

    set({ subscriptionChannel: channel, onMemberChange: onMemberChange || null });

    // Return unsubscribe function
    return () => {
      const currentChannel = get().subscriptionChannel;
      if (currentChannel) {
        supabase.removeChannel(currentChannel);
        set({ subscriptionChannel: null, onMemberChange: null });
      }
    };
  },

  unsubscribeFromGroupUpdates: () => {
    const channel = get().subscriptionChannel;
    if (channel) {
      supabase.removeChannel(channel);
      set({ subscriptionChannel: null, onMemberChange: null });
    }
  },

  subscribeToGroupMembers: (userId: string, onKickedFromGroup?: (groupId: string) => void) => {
    // Check if already subscribed with the same userId - avoid duplicate subscriptions
    const state = get();
    if (state.membersSubscriptionChannel) {
      // Already subscribed, just update callback if needed
      if (onKickedFromGroup) {
        set({ onKickedFromGroup });
      }
      return () => {
        // Return no-op unsubscribe function since we're not creating a new subscription
      };
    }

    // Unsubscribe from existing channel if any (safety check)
    const existingChannel = state.membersSubscriptionChannel;
    if (existingChannel) {
      supabase.removeChannel(existingChannel);
    }

    // Create channel for group_members changes
    // Note: We can't filter by multiple group_ids in Supabase Realtime filter
    // So we'll subscribe to all changes and filter in the handler
    console.log('📡 [Realtime] Setting up group_members subscription for user:', userId);
    const channel = supabase
      .channel('public:group_members')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'group_members',
        },
        async (payload) => {
          console.log('🟢 [Realtime] New member joined:', payload);
          const newMember = payload.new as { group_id: string; user_id: string; role: string; profile_color: string; joined_at: string };
          
          // Filter: only process events for groups I'm a member of
          const currentState = get();
          const group = currentState.groups.find((g) => g.id === newMember.group_id);
          
          console.log('🟢 [Realtime] Checking group:', newMember.group_id, 'Found in my groups:', !!group, 'Total groups:', currentState.groups.length);
          
          // If group not found in current state, it might be a new group we just joined
          // In that case, we need to fetch the group data first
          if (!group) {
            console.log('🟡 [Realtime] New member joined group not in my list, checking if I joined:', newMember.user_id === userId);
            // Check if I'm the new member (I just joined)
            if (newMember.user_id === userId) {
              // I just joined this group - fetch it
              console.log('🟡 [Realtime] I just joined this group, fetching:', newMember.group_id);
              await get().fetchGroupById(newMember.group_id, userId);
              
              // Reset calendar store initialization to force reload with new group tasks
              if (queryClientInstance) {
                // Invalidate all task queries to force refetch
                queryClientInstance.invalidateQueries({ queryKey: ['tasks'], exact: false });
                
                // Reset calendar store initialization flag
                const { useCalendarStore } = require('./useCalendarStore');
                useCalendarStore.getState().resetInitialization();
              }
            } else {
              // Someone else joined a group I'm not aware of - might be a timing issue
              // Try to check if I'm actually a member by fetching the group
              console.log('🟡 [Realtime] Someone joined a group not in my list, checking if I should have it:', newMember.group_id);
              // Don't fetch here to avoid infinite loops - let fetchMyGroups handle it
            }
            return;
          }
          
          // Fetch new member's profile
          const profiles = await fetchProfiles([newMember.user_id]);
          const profile = profiles.get(newMember.user_id);
          
          console.log('🟢 [Realtime] Adding new member to group:', newMember.group_id, 'Member:', newMember.user_id, 'Current members count:', group.members.length);
          
          // Update group members count and add new member
          set((state) => {
            const updateGroup = (g: Group) => {
              if (g.id !== newMember.group_id) return g;
              
              // Check if member already exists (avoid duplicates)
              const memberExists = g.members.some((m) => m.id === newMember.user_id);
              if (memberExists) {
                console.log('🟡 [Realtime] Member already exists, skipping:', newMember.user_id);
                return g;
              }
              
              console.log('✅ [Realtime] Adding new member to group state');
              return {
                ...g,
                members: [
                  ...g.members,
                  {
                    id: newMember.user_id,
                    name: profile?.nickname || `User ${newMember.user_id.slice(0, 8)}`,
                    role: newMember.role as 'OWNER' | 'ADMIN' | 'MEMBER',
                    profileColor: newMember.profile_color,
                    joinedAt: newMember.joined_at,
                  },
                ],
              };
            };
            
            const updatedGroups = state.groups.map(updateGroup);
            const updatedCurrentGroup = state.currentGroup ? updateGroup(state.currentGroup) : null;
            
            console.log('✅ [Realtime] Updated groups state, new members count:', updatedCurrentGroup?.members.length || 'N/A');
            
            return {
              groups: updatedGroups,
              currentGroup: updatedCurrentGroup,
            };
          });
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'DELETE',
          schema: 'public',
          table: 'group_members',
        },
        async (payload) => {
          console.log('🔴 [Realtime] Member left:', payload);
          const oldMember = payload.old as { group_id: string; user_id: string };
          
          const state = get();
          
          // Check if I was the one who left
          if (oldMember.user_id === userId) {
            // I was kicked or left - remove group from my groups list
            console.log('🔴 [Realtime] I was removed from group:', oldMember.group_id);
            set((state) => {
              return {
                groups: state.groups.filter((g) => g.id !== oldMember.group_id),
                currentGroup: state.currentGroup?.id === oldMember.group_id ? null : state.currentGroup,
              };
            });
            
            // Optimistically remove all tasks from this group from React Query cache
            // This ensures immediate UI update without waiting for refetch
            if (queryClientInstance) {
              // Remove tasks from unified queries (all date ranges)
              queryClientInstance.setQueriesData(
                { queryKey: ['tasks', 'unified'], exact: false },
                (oldData: any) => {
                  if (!oldData || !Array.isArray(oldData)) return oldData;
                  // Filter out all tasks from the group we left
                  return oldData.filter((task: any) => task.group_id !== oldMember.group_id);
                }
              );
              
              // Remove tasks from today query
              queryClientInstance.setQueriesData(
                { queryKey: ['tasks', 'today'], exact: false },
                (oldData: any) => {
                  if (!oldData || !Array.isArray(oldData)) return oldData;
                  return oldData.filter((task: any) => task.group_id !== oldMember.group_id);
                }
              );
              
              // Remove tasks from backlog query
              queryClientInstance.setQueriesData(
                { queryKey: ['tasks', 'backlog'], exact: false },
                (oldData: any) => {
                  if (!oldData || !Array.isArray(oldData)) return oldData;
                  return oldData.filter((task: any) => task.group_id !== oldMember.group_id);
                }
              );
              
              // Invalidate to ensure server sync (but UI is already updated)
              queryClientInstance.invalidateQueries({ queryKey: ['tasks', 'unified'], exact: false });
              queryClientInstance.invalidateQueries({ queryKey: ['tasks', 'today'] });
              queryClientInstance.invalidateQueries({ queryKey: ['tasks', 'backlog'] });
            }
            
            // Call callback for navigation handling
            if (onKickedFromGroup) {
              onKickedFromGroup(oldMember.group_id);
            }
          } else {
            // Someone else left - remove from current group members
            console.log('🔴 [Realtime] Someone else left group:', oldMember.group_id, 'user:', oldMember.user_id);
            const currentState = get();
            const group = currentState.groups.find((g) => g.id === oldMember.group_id);
            
            // Only update if this is a group I'm a member of
            if (group) {
              set((state) => {
                const updateGroup = (g: Group) => {
                  if (g.id !== oldMember.group_id) return g;
                  
                  return {
                    ...g,
                    members: g.members.filter((m) => m.id !== oldMember.user_id),
                  };
                };
                
                return {
                  groups: state.groups.map(updateGroup),
                  currentGroup: state.currentGroup ? updateGroup(state.currentGroup) : null,
                };
              });
            }
            
            // Update React Query cache: Remove assignee from tasks in this group
            // DB trigger already removed incomplete task assignments, but we need to update UI
            if (queryClientInstance) {
              // Optimistically update: Remove assignee from all tasks in this group
              queryClientInstance.setQueriesData(
                { queryKey: ['tasks', 'unified'], exact: false },
                (oldData: any) => {
                  if (!oldData || !Array.isArray(oldData)) return oldData;
                  
                  return oldData.map((task: any) => {
                    // Only update tasks in this group
                    if (task.group_id !== oldMember.group_id) return task;
                    
                    // Remove assignee from task
                    if (task.assignees && Array.isArray(task.assignees)) {
                      return {
                        ...task,
                        assignees: task.assignees.filter(
                          (assignee: any) => assignee.user_id !== oldMember.user_id
                        ),
                      };
                    }
                    return task;
                  });
                }
              );
              
              // Also update other query keys
              queryClientInstance.setQueriesData(
                { queryKey: ['tasks', 'today'], exact: false },
                (oldData: any) => {
                  if (!oldData || !Array.isArray(oldData)) return oldData;
                  
                  return oldData.map((task: any) => {
                    if (task.group_id !== oldMember.group_id) return task;
                    
                    if (task.assignees && Array.isArray(task.assignees)) {
                      return {
                        ...task,
                        assignees: task.assignees.filter(
                          (assignee: any) => assignee.user_id !== oldMember.user_id
                        ),
                      };
                    }
                    return task;
                  });
                }
              );
              
              queryClientInstance.setQueriesData(
                { queryKey: ['tasks', 'backlog'], exact: false },
                (oldData: any) => {
                  if (!oldData || !Array.isArray(oldData)) return oldData;
                  
                  return oldData.map((task: any) => {
                    if (task.group_id !== oldMember.group_id) return task;
                    
                    if (task.assignees && Array.isArray(task.assignees)) {
                      return {
                        ...task,
                        assignees: task.assignees.filter(
                          (assignee: any) => assignee.user_id !== oldMember.user_id
                        ),
                      };
                    }
                    return task;
                  });
                }
              );
              
              // Invalidate after optimistic update to ensure accuracy
              // (DB trigger already cleaned up, but we want to sync with server)
              setTimeout(() => {
                queryClientInstance.invalidateQueries({ queryKey: ['tasks', 'unified'], exact: false });
              }, 500);
            }
          }
        }
      )
      .subscribe((status) => {
        // Log all status changes for debugging
        console.log('📡 [Realtime] group_members subscription status:', status);
        if (status === 'SUBSCRIBED') {
          console.log('✅ [Realtime] Successfully subscribed to group_members');
        } else if (status === 'CHANNEL_ERROR') {
          console.error('🔴 [Realtime] Channel error occurred');
        } else if (status === 'TIMED_OUT') {
          console.error('🔴 [Realtime] Subscription timed out');
        } else if (status === 'CLOSED') {
          console.log('🔴 [Realtime] Subscription closed');
        }
      });

    set({ membersSubscriptionChannel: channel, onKickedFromGroup: onKickedFromGroup || null });

    // Return unsubscribe function
    return () => {
      const channel = get().membersSubscriptionChannel;
      if (channel) {
        supabase.removeChannel(channel);
        set({ membersSubscriptionChannel: null, onKickedFromGroup: null });
      }
    };
  },

  unsubscribeFromGroupMembers: () => {
    const channel = get().membersSubscriptionChannel;
    if (channel) {
      supabase.removeChannel(channel);
      set({ membersSubscriptionChannel: null, onKickedFromGroup: null });
    }
  },

  setCurrentGroup: (group: Group | null) => {
    set({ currentGroup: group });
  },

  clearError: () => {
    set({ error: null });
  },
}));
