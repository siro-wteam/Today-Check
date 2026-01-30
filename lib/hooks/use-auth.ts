/**
 * Authentication Store + Hook (Singleton)
 *
 * - Supabase auth 리스너는 모듈 로드시 한 번만 등록
 * - Zustand 스토어를 통해 전역으로 user/session/profile/loading 공유
 * - 기존 useAuth() API는 그대로 유지 (user, profile, isAuthenticated 등)
 */

import type { Session, User } from '@supabase/supabase-js';
import { useEffect } from 'react';
import { Platform } from 'react-native';
import { create } from 'zustand';
import { clearProfileCache, fetchProfile as fetchProfileShared } from '../api/profiles';
import { useGroupStore } from '../stores/useGroupStore';
import { supabase } from '../supabase';
import type { Profile } from '../types';

interface AuthState {
  user: User | null;
  session: Session | null;
  profile: Profile | null;
  loading: boolean;
  isAuthenticated: boolean;
  updateProfile: (newNickname: string) => Promise<{ success: boolean; error?: string }>;
  refreshProfile: () => Promise<void>;
}

// 공용 프로필 fetch 유틸
const fetchProfile = async (userId: string): Promise<Profile | null> => {
  const profileData = await fetchProfileShared(userId);
  if (!profileData) {
    return null;
  }
  return {
    id: profileData.id,
    nickname: profileData.nickname,
    avatar_url: profileData.avatar_url,
    created_at: '',
    updatedAt: '',
  };
};

export const useAuthStore = create<AuthState>((set, get) => ({
  user: null,
  session: null,
  profile: null,
  loading: true,
  isAuthenticated: false,

  /**
   * Update user profile nickname
   */
  updateProfile: async (newNickname: string) => {
    const { user, profile } = get();

    if (!user?.id) {
      return { success: false, error: 'User not authenticated' };
    }

    if (!newNickname.trim()) {
      return { success: false, error: 'Nickname cannot be empty' };
    }

    // Optimistic update
    if (profile) {
      set({
        profile: {
          ...profile,
          nickname: newNickname.trim(),
          updatedAt: new Date().toISOString(),
        },
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
          set({ profile: originalProfile });
        }
        return { success: false, error: error.message };
      }

      // Refresh profile to get updated timestamp
      const updatedProfile = await fetchProfile(user.id);
      if (updatedProfile) {
        set({ profile: updatedProfile });
      }

      // Cascade update: Update nickname in all groups where this user is a member
      useGroupStore.getState().updateMemberProfile(user.id, newNickname.trim());

      return { success: true };
    } catch (err: any) {
      if (profile) {
        const originalProfile = await fetchProfile(user.id);
        set({ profile: originalProfile });
      }
      return { success: false, error: err.message || 'Failed to update profile' };
    }
  },

  /**
   * Refresh profile data from server
   */
  refreshProfile: async () => {
    const { user } = get();
    if (!user?.id) {
      return;
    }

    clearProfileCache();

    const updatedProfile = await fetchProfile(user.id);
    if (updatedProfile) {
      console.log('[useAuth] Profile refreshed, new avatar_url:', updatedProfile.avatar_url);
      set({ profile: updatedProfile });
    } else {
      console.warn('[useAuth] Profile refresh returned null');
    }
  },
}));

// 그룹 멤버 실시간 구독용 전역 변수
let unsubscribeGroupMembers: (() => void) | null = null;
let authListenerInitialized = false;

// Supabase Auth 변경 리스너 - 최초 한 번만 등록
async function ensureAuthListenerInitialized() {
  if (authListenerInitialized) return;
  authListenerInitialized = true;

  supabase.auth.onAuthStateChange(async (event, session) => {
  // Only log non-initial events to reduce noise
  if (event !== 'INITIAL_SESSION') {
    console.log('Auth state changed:', event, session?.user?.email || 'No user');
  }

  // Handle sign out: Clear all stores and caches
  if (event === 'SIGNED_OUT' || (!session && event !== 'INITIAL_SESSION')) {
    console.log('[Auth] User signed out, clearing all stores...');

    // Clear calendar store
    const { useCalendarStore } = await import('../stores/useCalendarStore');
    useCalendarStore.setState({
      tasks: [],
      isLoading: false,
      isPrefetching: false,
      error: null,
      isInitialized: false,
      selectedDate: new Date(),
    });

    // Clear group store
    const groupStore = useGroupStore.getState();
    groupStore.unsubscribeFromGroupUpdates();
    groupStore.unsubscribeFromGroupMembers();
    useGroupStore.setState({
      groups: [],
      currentGroup: null,
      loading: false,
      error: null,
      subscriptionChannel: null,
      membersSubscriptionChannel: null,
      onMemberChange: null,
      onKickedFromGroup: null,
    });

    // Clear React Query cache
    const { queryClient } = await import('../query-client');
    queryClient.clear();

    useAuthStore.setState({
      user: null,
      session: null,
      profile: null,
      loading: false,
      isAuthenticated: false,
    });

    // Unsubscribe from group members when user logs out
    if (unsubscribeGroupMembers) {
      unsubscribeGroupMembers();
      unsubscribeGroupMembers = null;
    }
    useGroupStore.getState().unsubscribeFromGroupMembers();

    return;
  }

  // SIGNED_IN: 캘린더 스토어는 유지 (기존 로직 유지)
  if (event === 'SIGNED_IN' && session?.user?.id) {
    const { useCalendarStore } = await import('../stores/useCalendarStore');
    const calendarState = useCalendarStore.getState();
    console.log(
      `[Auth] SIGNED_IN event (${Platform.OS}) - Preserving calendar data. isInitialized: ${calendarState.isInitialized}, tasks count: ${calendarState.tasks.length}`,
    );
  }

  // 세션/유저 기본 상태 업데이트
  useAuthStore.setState({
    session,
    user: session?.user ?? null,
    isAuthenticated: !!session?.user,
    // loading 플래그는 아래에서 프로필 fetch 후 false로 설정
    loading: true,
  });

  // Fetch profile if user exists
  if (session?.user?.id) {
    const userProfile = await fetchProfile(session.user.id);
    useAuthStore.setState({
      profile: userProfile,
      loading: false,
    });

    // Invalidate notification queries when user logs in (new account)
    // This ensures fresh data is fetched for the new user
    if (event === 'SIGNED_IN' || event === 'INITIAL_SESSION') {
      const { queryClient } = await import('../query-client');
      queryClient.invalidateQueries({ queryKey: ['notifications'] });
      queryClient.invalidateQueries({ queryKey: ['notifications', 'unread-count'] });
    }

    // Subscribe to group members changes when user logs in
    // Only subscribe once per session (avoid duplicate subscriptions)
    if ((event === 'SIGNED_IN' || event === 'INITIAL_SESSION') && !unsubscribeGroupMembers) {
      console.log('📡 [Auth] Setting up group members subscription for user:', session.user.id);
      unsubscribeGroupMembers = useGroupStore.getState().subscribeToGroupMembers(session.user.id, (groupId) => {
        console.log('🚪 [Realtime] User was kicked from group:', groupId);
      });
      console.log('✅ [Auth] Group members subscription set up');
    }
  } else {
    // 세션은 있지만 유저가 없는 경우는 거의 없지만, 방어적으로 처리
    useAuthStore.setState({
      profile: null,
      loading: false,
      isAuthenticated: false,
    });

    if (unsubscribeGroupMembers) {
      unsubscribeGroupMembers();
      unsubscribeGroupMembers = null;
    }
    useGroupStore.getState().unsubscribeFromGroupMembers();
  }
  });
}

/**
 * 기존 useAuth 훅과 동일한 API를 제공하는 래퍼
 * - 내부적으로는 Zustand 스토어를 사용
 */
export function useAuth() {
  // 컴포넌트 트리에서 최초로 useAuth가 호출될 때만 리스너를 등록
  useEffect(() => {
    ensureAuthListenerInitialized().catch((err) => {
      console.error('[Auth] Failed to initialize auth listener:', err);
      // 실패해도 앱이 완전히 막히지 않도록 loading false로 설정
      useAuthStore.setState({ loading: false });
    });
  }, []);

  return useAuthStore();
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
 * Clears all user data and state before signing out
 */
export async function signOut() {
  console.log('Calling supabase.auth.signOut()');
  
  try {
    // Clear all stores and caches before signing out
    const { useCalendarStore } = await import('../stores/useCalendarStore');
    const { useGroupStore } = await import('../stores/useGroupStore');
    const { queryClient } = await import('../query-client');
    
    // Clear calendar store
    useCalendarStore.setState({
      tasks: [],
      isLoading: false,
      isPrefetching: false,
      error: null,
      isInitialized: false,
      selectedDate: new Date(),
    });
    
    // Clear group store and unsubscribe from realtime
    const groupStore = useGroupStore.getState();
    groupStore.unsubscribeFromGroupUpdates();
    groupStore.unsubscribeFromGroupMembers();
    useGroupStore.setState({
      groups: [],
      currentGroup: null,
      loading: false,
      error: null,
      subscriptionChannel: null,
      membersSubscriptionChannel: null,
      onMemberChange: null,
      onKickedFromGroup: null,
    });
    
    // Clear React Query cache
    queryClient.clear();
    
    // Sign out from Supabase
    // Use scope: 'local' to only clear the current session (recommended for web)
    // This prevents 403 errors when session is already expired or invalid
    // Note: Supabase v2.43.1+ automatically handles 403s, but we use 'local' scope
    // to avoid issues with expired sessions on web
    const { error } = await supabase.auth.signOut({ scope: 'local' });
    
    // Clear localStorage on web as fallback (Supabase should handle this, but
    // we do it manually to ensure cleanup even if API call fails)
    // This is especially important when session is already expired (403 error)
    if (Platform.OS === 'web' && typeof window !== 'undefined') {
      try {
        // Clear all Supabase-related keys from localStorage
        const keys = Object.keys(window.localStorage);
        keys.forEach(key => {
          if (key.startsWith('sb-') || key.includes('supabase')) {
            window.localStorage.removeItem(key);
          }
        });
        console.log('Cleared Supabase keys from localStorage');
      } catch (e) {
        console.warn('Failed to clear localStorage:', e);
      }
    }
    
    if (error) {
      // 403 errors can occur when session is already expired/invalid
      // This is common after deployments or when tokens expire
      // Since we've already cleared local state, we treat this as success
      if (error.message?.includes('403') || error.message?.includes('session')) {
        console.warn('Sign out API returned 403 (session likely expired), but local state cleared');
        return { error: null };
      }
      console.warn('Sign out API error (but local state cleared):', error);
      // Don't return error if we've already cleared local state
      // The user is effectively logged out locally even if API call failed
      return { error: null };
    } else {
      console.log('Sign out successful - All state cleared');
    }
    
    return { error: null };
  } catch (err: any) {
    console.error('Error during sign out cleanup:', err);
    // Even if cleanup fails, try to sign out
    try {
      await supabase.auth.signOut({ scope: 'local' });
    } catch (signOutErr) {
      console.warn('Sign out API error:', signOutErr);
    }
    // Return success since local state is cleared
    return { error: null };
  }
}
