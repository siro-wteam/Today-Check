/**
 * Authentication Hook
 */

import type { Session, User } from '@supabase/supabase-js';
import { useEffect, useState } from 'react';
import { clearProfileCache, fetchProfile as fetchProfileShared } from '../api/profiles';
import { useGroupStore } from '../stores/useGroupStore';
import { supabase } from '../supabase';
import type { Profile } from '../types';

export function useAuth() {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);

  // Fetch user profile using shared utility (avoids duplicate API calls)
  const fetchProfile = async (userId: string): Promise<Profile | null> => {
    const profileData = await fetchProfileShared(userId);
    if (!profileData) {
      return null;
    }
    // Convert to Profile type
    // Note: created_at and updatedAt are fetched separately only when needed
    // For most use cases, nickname and avatar_url are sufficient
    return {
      id: profileData.id,
      nickname: profileData.nickname,
      avatar_url: profileData.avatar_url,
      created_at: '', // Will be populated if needed elsewhere
      updatedAt: '', // Will be populated if needed elsewhere
    };
  };

  useEffect(() => {
    let mounted = true;
    let unsubscribeGroupMembers: (() => void) | null = null;

    // Listen for auth changes (includes initial session)
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (event, session) => {
      // Only log non-initial events to reduce noise
      if (event !== 'INITIAL_SESSION') {
        console.log('Auth state changed:', event, session?.user?.email || 'No user');
      }
      
      if (!mounted) return;

      setSession(session);
      setUser(session?.user ?? null);
      
      // Fetch profile if user exists
      if (session?.user?.id) {
        const userProfile = await fetchProfile(session.user.id);
        if (mounted) {
          setProfile(userProfile);
        }
        
        // TEMPORARILY DISABLED: Subscribe to group members changes when user logs in
        // Testing performance impact - will re-enable after testing
        // Only subscribe once per session (avoid duplicate subscriptions)
        // if ((event === 'SIGNED_IN' || event === 'INITIAL_SESSION') && !unsubscribeGroupMembers) {
        //   // Subscribe to group members changes
        //   unsubscribeGroupMembers = useGroupStore.getState().subscribeToGroupMembers(
        //     session.user.id,
        //     (groupId) => {
        //       // Callback when user is kicked from a group
        //       // Navigation will be handled by the component that uses this
        //       console.log('🚪 [Realtime] User was kicked from group:', groupId);
        //     }
        //   );
        // }
      } else {
        setProfile(null);
        
        // TEMPORARILY DISABLED: Unsubscribe from group members when user logs out
        // if (unsubscribeGroupMembers) {
        //   unsubscribeGroupMembers();
        //   unsubscribeGroupMembers = null;
        // }
        // useGroupStore.getState().unsubscribeFromGroupMembers();
      }
      
      setLoading(false);
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
      // TEMPORARILY DISABLED: Cleanup group members subscription
      // if (unsubscribeGroupMembers) {
      //   unsubscribeGroupMembers();
      // }
      // useGroupStore.getState().unsubscribeFromGroupMembers();
    };
  }, []);

  /**
   * Update user profile nickname
   */
  const updateProfile = async (newNickname: string): Promise<{ success: boolean; error?: string }> => {
    if (!user?.id) {
      return { success: false, error: 'User not authenticated' };
    }

    if (!newNickname.trim()) {
      return { success: false, error: 'Nickname cannot be empty' };
    }

    // Optimistic update: Update local state immediately
    if (profile) {
      setProfile({
        ...profile,
        nickname: newNickname.trim(),
        updatedAt: new Date().toISOString(),
      });
    }

    try {
      const { error } = await supabase
        .from('profiles')
        .update({ nickname: newNickname.trim() })
        .eq('id', user.id);

      if (error) {
        // Revert optimistic update on error
        if (profile) {
          const originalProfile = await fetchProfile(user.id);
          setProfile(originalProfile);
        }
        return { success: false, error: error.message };
      }

      // Refresh profile to get updated timestamp
      const updatedProfile = await fetchProfile(user.id);
      if (updatedProfile) {
        setProfile(updatedProfile);
      }

      // Cascade update: Update nickname in all groups where this user is a member
      // Use getState() to access store without hook dependency
      useGroupStore.getState().updateMemberProfile(user.id, newNickname.trim());

      return { success: true };
    } catch (err: any) {
      // Revert optimistic update on error
      if (profile) {
        const originalProfile = await fetchProfile(user.id);
        setProfile(originalProfile);
      }
      return { success: false, error: err.message || 'Failed to update profile' };
    }
  };

  /**
   * Refresh profile data from server
   * Clears cache and fetches fresh data
   */
  const refreshProfile = async (): Promise<void> => {
    if (!user?.id) {
      return;
    }

    // Clear cache to force fresh fetch
    clearProfileCache();
    
    const updatedProfile = await fetchProfile(user.id);
    if (updatedProfile) {
      console.log('[useAuth] Profile refreshed, new avatar_url:', updatedProfile.avatar_url);
      setProfile(updatedProfile);
    } else {
      console.warn('[useAuth] Profile refresh returned null');
    }
  };

  return {
    user,
    session,
    profile,
    loading,
    isAuthenticated: !!user,
    updateProfile,
    refreshProfile,
  };
}

/**
 * Sign up with email, password, and nickname
 */
export async function signUp(email: string, password: string, nickname: string) {
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: {
        nickname: nickname.trim(),
      },
    },
  });

  return { data, error };
}

/**
 * Sign in with email and password
 */
export async function signIn(email: string, password: string) {
  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });

  return { data, error };
}

/**
 * Sign out
 */
export async function signOut() {
  console.log('Calling supabase.auth.signOut()');
  const { error } = await supabase.auth.signOut();
  if (error) {
    console.error('Sign out error:', error);
  } else {
    console.log('Sign out successful - Supabase returned no error');
  }
  return { error };
}
