/**
 * Group Management API Functions
 * 
 * Handles all Supabase operations for groups and group members
 */

import { supabase } from '../supabase';
import type { Group, GroupRow, GroupMemberRow, GroupMember } from '../types';

// Import shared profile fetching utility
import { fetchProfiles } from './profiles';

/**
 * Create a new group
 */
export async function createGroup(name: string, userId: string): Promise<{ data: Group | null; error: Error | null }> {
  try {
    // Call the database function to create group with auto-generated invite code
    const { data, error } = await supabase.rpc('create_group_with_code', {
      group_name: name,
      owner_uuid: userId,
    });

    if (error) {
      console.error('Error creating group:', error);
      return { data: null, error: new Error(error.message) };
    }

    if (!data) {
      return { data: null, error: new Error('Failed to create group') };
    }

    // Fetch the created group with members
    const group = await fetchGroupById(data);
    return group;
  } catch (err: any) {
    console.error('Exception creating group:', err);
    return { data: null, error: err };
  }
}

/**
 * Join a group by invite code
 */
export async function joinGroupByCode(
  inviteCode: string,
  userId: string
): Promise<{ data: Group | null; error: Error | null }> {
  try {
    const { data, error } = await supabase.rpc('join_group_by_code', {
      code: inviteCode.toUpperCase().trim(),
      user_uuid: userId,
    });

    if (error) {
      console.error('Error joining group:', error);
      return { data: null, error: new Error(error.message) };
    }

    if (!data) {
      return { data: null, error: new Error('Group not found') };
    }

    // Fetch the group with members (include userId to set myRole)
    const group = await fetchGroupById(data.id, userId);
    return group;
  } catch (err: any) {
    console.error('Exception joining group:', err);
    return { data: null, error: err };
  }
}

/**
 * Fetch a group by ID with all members
 */
export async function fetchGroupById(groupId: string, userId?: string): Promise<{ data: Group | null; error: Error | null }> {
  try {
    // Fetch group
    const { data: groupData, error: groupError } = await supabase
      .from('groups')
      .select('*')
      .eq('id', groupId)
      .single();

    if (groupError || !groupData) {
      return { data: null, error: new Error(groupError?.message || 'Group not found') };
    }

    // Fetch members
    const { data: membersData, error: membersError } = await supabase
      .from('group_members')
      .select('*')
      .eq('group_id', groupId);

    if (membersError) {
      console.error('Error fetching members:', membersError);
      return { data: null, error: new Error(membersError.message) };
    }

    // Fetch profiles for all members (using shared utility)
    const userIds = (membersData || []).map((m: GroupMemberRow) => m.user_id);
    const profilesMap = await fetchProfiles(userIds);
    
    // Convert to the format expected by GroupMember
    const profileMap = new Map<string, { nickname: string; avatar_url: string | null }>();
    profilesMap.forEach((profile, userId) => {
      profileMap.set(userId, {
        nickname: profile.nickname,
        avatar_url: profile.avatar_url,
      });
    });

    // Map members with profile data
    const members: GroupMember[] = (membersData || []).map((memberRow: GroupMemberRow) => {
      const profile = profileMap.get(memberRow.user_id);
      return {
        id: memberRow.user_id,
        name: profile?.nickname || `User ${memberRow.user_id.slice(0, 8)}`,
        email: undefined, // Can be added if needed
        role: memberRow.role as 'OWNER' | 'MEMBER',
        profileColor: memberRow.profile_color,
        joinedAt: memberRow.joined_at,
      };
    });

    // Get current user's role in this group (if userId provided)
    let myRole: GroupRole | undefined;
    if (userId) {
      const currentUserMember = membersData?.find((m) => m.user_id === userId);
      myRole = currentUserMember?.role as GroupRole | undefined;
    }

    const group: Group = {
      id: groupData.id,
      name: groupData.name,
      ownerId: groupData.owner_id,
      inviteCode: groupData.invite_code,
      members,
      createdAt: groupData.created_at,
      updatedAt: groupData.updated_at,
      myRole,
    };

    return { data: group, error: null };
  } catch (err: any) {
    console.error('Exception fetching group:', err);
    return { data: null, error: err };
  }
}

/**
 * Fetch all groups the current user is a member of
 */
export async function fetchMyGroups(userId: string): Promise<{ data: Group[] | null; error: Error | null }> {
  try {
    // Get all group_ids where user is a member, including their role
    const { data: memberRows, error: memberError } = await supabase
      .from('group_members')
      .select('group_id, role')
      .eq('user_id', userId);

    if (memberError) {
      console.error('Error fetching user groups:', memberError);
      return { data: null, error: new Error(memberError.message) };
    }

    if (!memberRows || memberRows.length === 0) {
      return { data: [], error: null };
    }

    const groupIds = memberRows.map((m) => m.group_id);
    // Create a map of group_id -> user's role
    const userRoleMap = new Map<string, GroupRole>();
    memberRows.forEach((m) => {
      userRoleMap.set(m.group_id, m.role as GroupRole);
    });

    // Fetch all groups
    const { data: groupsData, error: groupsError } = await supabase
      .from('groups')
      .select('*')
      .in('id', groupIds);

    if (groupsError) {
      console.error('Error fetching groups:', groupsError);
      return { data: null, error: new Error(groupsError.message) };
    }

    // Fetch members for each group with profile info
    const groups: Group[] = [];

    for (const groupRow of groupsData || []) {
      // Fetch members
      const { data: membersData } = await supabase
        .from('group_members')
        .select('*')
        .eq('group_id', groupRow.id);

      // Fetch profiles for all members in this group (using shared utility)
      const userIds = (membersData || []).map((m: GroupMemberRow) => m.user_id);
      const profilesMap = await fetchProfiles(userIds);
      
      // Convert to the format expected by GroupMember
      const profileMap = new Map<string, { nickname: string; avatar_url: string | null }>();
      profilesMap.forEach((profile, userId) => {
        profileMap.set(userId, {
          nickname: profile.nickname,
          avatar_url: profile.avatar_url,
        });
      });

      const members: GroupMember[] = (membersData || []).map((m: GroupMemberRow) => {
        const profile = profileMap.get(m.user_id);
        return {
          id: m.user_id,
          name: profile?.nickname || `User ${m.user_id.slice(0, 8)}`,
          role: m.role as 'OWNER' | 'MEMBER',
          profileColor: m.profile_color,
          joinedAt: m.joined_at,
        };
      });

      // Get current user's role in this group
      const myRole = userRoleMap.get(groupRow.id);

      groups.push({
        id: groupRow.id,
        name: groupRow.name,
        ownerId: groupRow.owner_id,
        inviteCode: groupRow.invite_code,
        members,
        createdAt: groupRow.created_at,
        updatedAt: groupRow.updated_at,
        myRole,
      });
    }

    return { data: groups, error: null };
  } catch (err: any) {
    console.error('Exception fetching my groups:', err);
    return { data: null, error: err };
  }
}

/**
 * Delete a group (owner only)
 */
export async function deleteGroup(groupId: string, userId: string): Promise<{ error: Error | null }> {
  try {
    // Verify user is owner
    const { data: groupData, error: groupError } = await supabase
      .from('groups')
      .select('owner_id')
      .eq('id', groupId)
      .single();

    if (groupError || !groupData) {
      return { error: new Error('Group not found') };
    }

    if (groupData.owner_id !== userId) {
      return { error: new Error('Only group owner can delete the group') };
    }

    // Delete group (cascade will delete members)
    const { error: deleteError } = await supabase.from('groups').delete().eq('id', groupId);

    if (deleteError) {
      console.error('Error deleting group:', deleteError);
      return { error: new Error(deleteError.message) };
    }

    return { error: null };
  } catch (err: any) {
    console.error('Exception deleting group:', err);
    return { error: err };
  }
}

/**
 * Leave a group (member only, not owner)
 */
export async function leaveGroup(groupId: string, userId: string): Promise<{ error: Error | null }> {
  try {
    // Verify user is not owner
    const { data: groupData, error: groupError } = await supabase
      .from('groups')
      .select('owner_id')
      .eq('id', groupId)
      .single();

    if (groupError || !groupData) {
      return { error: new Error('Group not found') };
    }

    if (groupData.owner_id === userId) {
      return { error: new Error('Owner cannot leave group. Please delete the group instead.') };
    }

    // Remove user from group_members
    console.log('Attempting to delete group_members record:', { groupId, userId });
    const { data: deleteData, error: deleteError } = await supabase
      .from('group_members')
      .delete()
      .eq('group_id', groupId)
      .eq('user_id', userId)
      .select();

    console.log('Delete result:', { data: deleteData, error: deleteError });

    if (deleteError) {
      console.error('Error leaving group:', deleteError);
      return { error: new Error(deleteError.message) };
    }

    // Check if any rows were deleted
    if (!deleteData || deleteData.length === 0) {
      console.warn('No rows deleted. User might not be a member of this group.');
      return { error: new Error('You are not a member of this group') };
    }

    return { error: null };
  } catch (err: any) {
    console.error('Exception leaving group:', err);
    return { error: err };
  }
}
