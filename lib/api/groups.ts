/**
 * Group Management API Functions
 * 
 * Handles all Supabase operations for groups and group members
 */

import { Platform } from 'react-native';
import { supabase } from '../supabase';
import type { Group, GroupRow, GroupMemberRow, GroupMember, GroupRole } from '../types';

// Import shared profile fetching utility
import { fetchProfiles } from './profiles';

/**
 * Create a new group
 * RPC creates the group; we then fetch it. If fetch fails (e.g. RLS/session timing),
 * we return a minimal group so the UI shows success and the list updates.
 */
export async function createGroup(name: string, userId: string): Promise<{ data: Group | null; error: Error | null }> {
  try {
    const { data: rpcData, error } = await supabase.rpc('create_group_with_code', {
      group_name: name,
      owner_uuid: userId,
    });

    if (error) {
      console.error('Error creating group:', error);
      return { data: null, error: new Error(error.message) };
    }

    const newGroupId = typeof rpcData === 'string' ? rpcData : (rpcData as { id?: string })?.id ?? rpcData;
    if (!newGroupId) {
      return { data: null, error: new Error('Failed to create group') };
    }

    // Ensure session is attached before fetch (avoids RLS seeing no user)
    await supabase.auth.getSession();

    let group = await fetchGroupById(newGroupId, userId);

    if (group.error || !group.data) {
      // RPC succeeded but fetch failed (e.g. RLS/session). Return minimal group so UI shows success.
      const now = new Date().toISOString();
      group = {
        data: {
          id: newGroupId,
          name,
          ownerId: userId,
          inviteCode: '',
          imageUrl: null,
          members: [
            {
              id: userId,
              name: 'You',
              role: 'OWNER' as const,
              profileColor: '#2563eb', // theme primary (V0 blue)
              joinedAt: now,
            },
          ],
          createdAt: now,
          updatedAt: now,
          myRole: 'OWNER' as const,
        },
        error: null,
      };
    }

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
    await supabase.auth.getSession();

    // Fetch group (.maybeSingle() avoids 406 when RLS returns 0 rows)
    const { data: groupData, error: groupError } = await supabase
      .from('groups')
      .select('*')
      .eq('id', groupId)
      .maybeSingle();

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
          role: memberRow.role as GroupRole,
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
      imageUrl: groupData.image_url || null,
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
 * OPTIMIZED: Fetch all groups the current user is a member of
 * Single API call for all group members (instead of N calls)
 */
export async function fetchMyGroups(userId: string): Promise<{ data: Group[] | null; error: Error | null }> {
  try {
    // Ensure session is attached so RLS allows reading group_members and groups
    await supabase.auth.getSession();

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

    // ✅ OPTIMIZED: Fetch ALL members for ALL groups in a single query
    const { data: allMembersData, error: allMembersError } = await supabase
      .from('group_members')
      .select('*')
      .in('group_id', groupIds);  // 1번 호출로 모든 그룹의 멤버 가져오기!

    if (allMembersError) {
      console.error('Error fetching all members:', allMembersError);
      return { data: null, error: new Error(allMembersError.message) };
    }

    // Group members by group_id (client-side)
    const membersByGroup = new Map<string, GroupMemberRow[]>();
    (allMembersData || []).forEach((member: GroupMemberRow) => {
      if (!membersByGroup.has(member.group_id)) {
        membersByGroup.set(member.group_id, []);
      }
      membersByGroup.get(member.group_id)!.push(member);
    });

    // ✅ OPTIMIZED: Fetch ALL profiles at once (instead of per-group)
    const allUserIds = (allMembersData || []).map((m: GroupMemberRow) => m.user_id);
    const uniqueUserIds = [...new Set(allUserIds)];  // Remove duplicates
    const allProfilesMap = await fetchProfiles(uniqueUserIds);

    // Build groups with members
    const groups: Group[] = [];

    for (const groupRow of groupsData || []) {
      const membersData = membersByGroup.get(groupRow.id) || [];

      // Map members with profile data
      const members: GroupMember[] = membersData.map((m: GroupMemberRow) => {
        const profile = allProfilesMap.get(m.user_id);
        return {
          id: m.user_id,
          name: profile?.nickname || `User ${m.user_id.slice(0, 8)}`,
          role: m.role as GroupRole,
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
        imageUrl: groupRow.image_url || null,
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
    // Verify user is owner (.maybeSingle() avoids 406 when RLS returns 0 rows)
    const { data: groupData, error: groupError } = await supabase
      .from('groups')
      .select('owner_id')
      .eq('id', groupId)
      .maybeSingle();

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
 * Update group name (OWNER only)
 */
export async function updateGroupName(
  groupId: string,
  newName: string
): Promise<{ success: boolean; error: Error | null }> {
  try {
    if (!newName || !newName.trim()) {
      return { success: false, error: new Error('Group name cannot be empty') };
    }

    const { error } = await supabase
      .from('groups')
      .update({ name: newName.trim() })
      .eq('id', groupId);

    if (error) {
      console.error('Error updating group name:', error);
      return { success: false, error: new Error(error.message) };
    }

    return { success: true, error: null };
  } catch (err: any) {
    console.error('Exception updating group name:', err);
    return { success: false, error: err };
  }
}

/**
 * Promote a member to ADMIN (OWNER only)
 * Uses direct UPDATE with RLS policy enforcement (no RPC needed)
 */
export async function promoteMember(
  groupId: string,
  targetUserId: string
): Promise<{ success: boolean; error: Error | null }> {
  try {
    const { error } = await supabase
      .from('group_members')
      .update({ role: 'ADMIN' })
      .eq('group_id', groupId)
      .eq('user_id', targetUserId);

    if (error) {
      console.error('Error promoting member:', error);
      return { success: false, error: new Error(error.message) };
    }

    return { success: true, error: null };
  } catch (err: any) {
    console.error('Exception promoting member:', err);
    return { success: false, error: err };
  }
}

/**
 * Demote an ADMIN to MEMBER (OWNER only)
 * Uses direct UPDATE with RLS policy enforcement (no RPC needed)
 */
export async function demoteMember(
  groupId: string,
  targetUserId: string
): Promise<{ success: boolean; error: Error | null }> {
  try {
    const { error } = await supabase
      .from('group_members')
      .update({ role: 'MEMBER' })
      .eq('group_id', groupId)
      .eq('user_id', targetUserId);

    if (error) {
      console.error('Error demoting member:', error);
      return { success: false, error: new Error(error.message) };
    }

    return { success: true, error: null };
  } catch (err: any) {
    console.error('Exception demoting member:', err);
    return { success: false, error: err };
  }
}

/**
 * Leave a group (member only, not owner)
 */
export async function leaveGroup(groupId: string, userId: string): Promise<{ error: Error | null }> {
  try {
    // Verify user is not owner (.maybeSingle() avoids 406 when RLS returns 0 rows)
    const { data: groupData, error: groupError } = await supabase
      .from('groups')
      .select('owner_id')
      .eq('id', groupId)
      .maybeSingle();

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

/**
 * Kick a member from a group (OWNER only)
 * Uses direct DELETE with RLS policy enforcement
 */
export async function kickMember(
  groupId: string,
  targetUserId: string
): Promise<{ success: boolean; error: Error | null }> {
  try {
    // Verify group exists and get owner_id (.maybeSingle() avoids 406 when RLS returns 0 rows)
    const { data: groupData, error: groupError } = await supabase
      .from('groups')
      .select('owner_id')
      .eq('id', groupId)
      .maybeSingle();

    if (groupError || !groupData) {
      return { success: false, error: new Error('Group not found') };
    }

    // Verify target user is not the group owner
    if (groupData.owner_id === targetUserId) {
      return { success: false, error: new Error('Cannot kick group owner') };
    }

    // Verify target user is a member
    const { data: targetMember, error: targetError } = await supabase
      .from('group_members')
      .select('user_id')
      .eq('group_id', groupId)
      .eq('user_id', targetUserId)
      .single();

    if (targetError || !targetMember) {
      return { success: false, error: new Error('Member not found') };
    }

    // Delete member (RLS will enforce OWNER permission)
    const { error: deleteError } = await supabase
      .from('group_members')
      .delete()
      .eq('group_id', groupId)
      .eq('user_id', targetUserId);

    if (deleteError) {
      console.error('Error kicking member:', deleteError);
      return { success: false, error: new Error(deleteError.message) };
    }

    // Add to blocked list so they cannot re-join with same invite code
    const { error: blockError } = await supabase
      .from('group_blocked_users')
      .upsert({ group_id: groupId, user_id: targetUserId }, { onConflict: 'group_id,user_id' });

    if (blockError) {
      console.warn('Failed to add kicked user to block list (member was still removed):', blockError);
    }

    return { success: true, error: null };
  } catch (err: any) {
    console.error('Exception kicking member:', err);
    return { success: false, error: err };
  }
}

/** Blocked member (kicked, cannot re-join until unblocked) */
export interface BlockedMember {
  id: string;
  name: string;
  blockedAt: string;
}

/**
 * Get list of blocked users for a group (OWNER only). Used to show "Blocked members" and allow unblock.
 */
export async function getBlockedMembers(groupId: string): Promise<{ data: BlockedMember[] | null; error: Error | null }> {
  try {
    const { data: rows, error } = await supabase
      .from('group_blocked_users')
      .select('user_id, blocked_at')
      .eq('group_id', groupId);

    if (error) {
      console.error('Error fetching blocked members:', error);
      return { data: null, error: new Error(error.message) };
    }

    if (!rows || rows.length === 0) {
      return { data: [], error: null };
    }

    const userIds = rows.map((r) => r.user_id);
    const profilesMap = await fetchProfiles(userIds);
    const blocked: BlockedMember[] = rows.map((r) => {
      const profile = profilesMap.get(r.user_id);
      return {
        id: r.user_id,
        name: profile?.nickname || `User ${r.user_id.slice(0, 8)}`,
        blockedAt: r.blocked_at,
      };
    });
    return { data: blocked, error: null };
  } catch (err: any) {
    console.error('Exception fetching blocked members:', err);
    return { data: null, error: err };
  }
}

/**
 * Unblock a user so they can re-join the group with the invite code (OWNER only).
 */
export async function unblockMember(
  groupId: string,
  userId: string
): Promise<{ success: boolean; error: Error | null }> {
  try {
    const { error } = await supabase
      .from('group_blocked_users')
      .delete()
      .eq('group_id', groupId)
      .eq('user_id', userId);

    if (error) {
      console.error('Error unblocking member:', error);
      return { success: false, error: new Error(error.message) };
    }
    return { success: true, error: null };
  } catch (err: any) {
    console.error('Exception unblocking member:', err);
    return { success: false, error: err };
  }
}

/**
 * Upload group image to Supabase Storage
 * @param groupId - Group ID
 * @param imageUri - Local image URI (from expo-image-picker)
 * @returns Public URL of uploaded image or error
 */
export async function uploadGroupImage(
  groupId: string,
  imageUri: string
): Promise<{ data: string | null; error: Error | null }> {
  try {
    // Generate unique filename with proper extension
    let fileExt = 'jpg'; // default
    
    if (imageUri.startsWith('data:')) {
      // Base64 data URI: extract extension from MIME type
      const mimeMatch = imageUri.match(/data:image\/([^;]+)/);
      if (mimeMatch) {
        const mimeType = mimeMatch[1];
        const mimeToExt: { [key: string]: string } = {
          'jpeg': 'jpg',
          'jpg': 'jpg',
          'png': 'png',
          'gif': 'gif',
          'webp': 'webp',
        };
        fileExt = mimeToExt[mimeType] || 'jpg';
      }
    } else {
      // File URI: extract extension from file path
      const uriParts = imageUri.split('.');
      if (uriParts.length > 1) {
        const ext = uriParts.pop()?.split('?')[0]?.toLowerCase();
        if (ext && ['jpg', 'jpeg', 'png', 'gif', 'webp'].includes(ext)) {
          fileExt = ext === 'jpeg' ? 'jpg' : ext;
        }
      }
    }
    
    // Get current user ID for folder structure
    // Store group images in user folder: {userId}/groups/{groupId}/...
    // This allows using existing Storage policies
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return { data: null, error: new Error('User not authenticated') };
    }
    
    // Verify user is the group owner (.maybeSingle() avoids 406 when RLS returns 0 rows)
    const { data: groupData, error: groupError } = await supabase
      .from('groups')
      .select('owner_id')
      .eq('id', groupId)
      .maybeSingle();
    
    if (groupError || !groupData) {
      return { data: null, error: new Error('Group not found') };
    }
    
    if (groupData.owner_id !== user.id) {
      return { data: null, error: new Error('Only group owner can upload group image') };
    }
    
    const fileName = `${user.id}/groups/${groupId}/${Date.now()}.${fileExt}`;
    
    console.log('[uploadGroupImage] Starting upload');
    console.log('[uploadGroupImage] Group ID:', groupId);
    console.log('[uploadGroupImage] User ID:', user.id);
    console.log('[uploadGroupImage] File name:', fileName);

    // Read file and prepare for upload - React Native compatible approach
    let fileData: Blob | Uint8Array;
    let contentType: string;
    let fileSize: number;
    
    if (Platform.OS === 'web') {
      // Web: Use fetch with blob
      const response = await fetch(imageUri);
      if (!response.ok) {
        throw new Error(`Failed to fetch image: ${response.statusText}`);
      }
      const blob = await response.blob();
      fileData = blob;
      contentType = blob.type || 'image/jpeg';
      fileSize = blob.size;
    } else {
      // React Native: Convert base64 or file URI to Uint8Array
      if (imageUri.startsWith('data:')) {
        // Base64 data URI - Decode directly to Uint8Array
        const base64Data = imageUri.split(',')[1];
        if (!base64Data) {
          throw new Error('Invalid base64 data URI format');
        }
        
        // Extract MIME type for contentType
        const mimeMatch = imageUri.match(/data:image\/([^;]+)/);
        contentType = mimeMatch ? `image/${mimeMatch[1]}` : 'image/jpeg';
        
        // Decode base64 to Uint8Array
        try {
          let byteArray: Uint8Array;
          
          if (typeof Buffer !== 'undefined') {
            byteArray = new Uint8Array(Buffer.from(base64Data, 'base64'));
          } else if (typeof atob !== 'undefined') {
            const byteCharacters = atob(base64Data);
            const byteNumbers = new Array(byteCharacters.length);
            for (let i = 0; i < byteCharacters.length; i++) {
              byteNumbers[i] = byteCharacters.charCodeAt(i);
            }
            byteArray = new Uint8Array(byteNumbers);
          } else {
            // Manual base64 decoding
            const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
            let result: number[] = [];
            let i = 0;
            
            const cleanBase64 = base64Data.replace(/[^A-Za-z0-9\+\/]/g, '');
            
            while (i < cleanBase64.length) {
              const encoded1 = chars.indexOf(cleanBase64.charAt(i++));
              const encoded2 = chars.indexOf(cleanBase64.charAt(i++));
              const encoded3 = chars.indexOf(cleanBase64.charAt(i++));
              const encoded4 = chars.indexOf(cleanBase64.charAt(i++));
              
              const bitmap = (encoded1 << 18) | (encoded2 << 12) | (encoded3 << 6) | encoded4;
              
              result.push((bitmap >> 16) & 255);
              if (encoded3 !== 64) result.push((bitmap >> 8) & 255);
              if (encoded4 !== 64) result.push(bitmap & 255);
            }
            
            byteArray = new Uint8Array(result);
          }
          
          fileData = byteArray;
          fileSize = fileData.length;
        } catch (decodeError: any) {
          throw new Error(`Failed to decode base64 image: ${decodeError.message}`);
        }
      } else {
        // File URI - use fetch and convert to Uint8Array
        const response = await fetch(imageUri);
        
        if (!response.ok) {
          throw new Error(`Failed to fetch image: ${response.status} ${response.statusText}`);
        }
        
        const arrayBuffer = await response.arrayBuffer();
        fileData = new Uint8Array(arrayBuffer);
        fileSize = fileData.length;
        contentType = response.headers.get('content-type') || 'image/jpeg';
        
        if (fileSize === 0) {
          throw new Error('Fetched file is empty');
        }
      }
    }

    // Validate file size
    if (!fileData || fileSize === 0) {
      return { data: null, error: new Error('Failed to read image file. File may be empty or corrupted.') };
    }

    // Check file size limit (5MB)
    const MAX_FILE_SIZE = 5 * 1024 * 1024;
    if (fileSize > MAX_FILE_SIZE) {
      return { data: null, error: new Error(`File size (${Math.round(fileSize / 1024)}KB) exceeds maximum allowed size (5MB). Please choose a smaller image.`) };
    }

    // Upload to Supabase Storage (use avatars bucket with group prefix)
    const { data: uploadData, error: uploadError } = await supabase.storage
      .from('avatars')
      .upload(fileName, fileData, {
        cacheControl: '3600',
        upsert: true,
        contentType: contentType,
      });

    if (uploadError) {
      console.error('[uploadGroupImage] Upload error:', uploadError.message);
      return { data: null, error: new Error(uploadError.message || 'Failed to upload group image') };
    }

    // Get public URL
    const { data: urlData } = supabase.storage
      .from('avatars')
      .getPublicUrl(fileName);

    if (!urlData?.publicUrl) {
      return { data: null, error: new Error('Failed to get public URL') };
    }

    // Trim and clean the URL
    const cleanUrl = urlData.publicUrl.trim();

    // Update group with new image URL
    const { error: updateError } = await supabase
      .from('groups')
      .update({ image_url: cleanUrl })
      .eq('id', groupId);

    if (updateError) {
      console.error('[uploadGroupImage] Update group error:', updateError);
      return { data: null, error: updateError as Error };
    }

    return { data: cleanUrl, error: null };
  } catch (error) {
    console.error('[uploadGroupImage] Unexpected error:', error);
    return { data: null, error: error as Error };
  }
}
