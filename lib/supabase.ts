/**
 * Supabase Client Configuration
 * 
 * Setup instructions:
 * 1. Install Supabase: npm install @supabase/supabase-js
 * 2. Install AsyncStorage: npm install @react-native-async-storage/async-storage
 * 3. Create .env.local file with:
 *    EXPO_PUBLIC_SUPABASE_URL=your_supabase_url
 *    EXPO_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient } from '@supabase/supabase-js';
import Constants from 'expo-constants';
import { Platform } from 'react-native';

const supabaseUrl = Constants.expoConfig?.extra?.supabaseUrl || process.env.EXPO_PUBLIC_SUPABASE_URL || '';
const supabaseAnonKey = Constants.expoConfig?.extra?.supabaseAnonKey || process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || '';

// 🔍 웹 환경에서 환경 변수 강제 확인
if (typeof window !== 'undefined') {
  console.log('🌐 Web environment detected');
  console.log('🔑 Supabase URL:', supabaseUrl ? 'SET' : 'MISSING');
  console.log('🔑 Supabase Key:', supabaseAnonKey ? 'SET' : 'MISSING');
  console.log('📋 Process env:', {
    EXPO_PUBLIC_SUPABASE_URL: process.env.EXPO_PUBLIC_SUPABASE_URL,
    EXPO_PUBLIC_SUPABASE_ANON_KEY: process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ? 'SET' : 'MISSING'
  });
}

if (!supabaseUrl || !supabaseAnonKey) {
  console.warn('⚠️ Supabase credentials not found. Please set EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_ANON_KEY in your environment.');
  
  // 🛡️ 웹 환경에서는 에러를 더 명확하게 표시
  if (typeof window !== 'undefined') {
    console.error('🚨 CRITICAL: Supabase credentials missing in web environment!');
    console.error('🔧 Check Netlify/Vercel environment variables');
  }
}

// Custom storage for web platform
const customStorageAdapter = {
  getItem: (key: string) => {
    if (Platform.OS === 'web') {
      if (typeof window !== 'undefined') {
        return Promise.resolve(window.localStorage.getItem(key));
      }
      return Promise.resolve(null);
    }
    return AsyncStorage.getItem(key);
  },
  setItem: (key: string, value: string) => {
    if (Platform.OS === 'web') {
      if (typeof window !== 'undefined') {
        window.localStorage.setItem(key, value);
      }
      return Promise.resolve();
    }
    return AsyncStorage.setItem(key, value);
  },
  removeItem: (key: string) => {
    if (Platform.OS === 'web') {
      if (typeof window !== 'undefined') {
        window.localStorage.removeItem(key);
      }
      return Promise.resolve();
    }
    return AsyncStorage.removeItem(key);
  },
};

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    storage: customStorageAdapter,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
});

// 🔍 디버깅을 위한 전역 노출 (웹 환경에서만)
if (typeof window !== 'undefined') {
  (window as any).supabase = supabase;
  console.log('🔍 Supabase client exposed globally for debugging');
  
  // 🛡️ 초기화 상태 모니터링
  supabase.auth.onAuthStateChange((event, session) => {
    console.log('🔐 Auth state change:', { event, hasSession: !!session });
    if (session) {
      console.log('👤 User authenticated:', session.user.email);
    }
  });
  
  // Note: Do NOT wrap getSession() to return session: null - that causes groups/tasks
  // API to run with auth.uid() = null and RLS returns [] (e.g. groups?select=*&id=eq.xxx → []).
}
