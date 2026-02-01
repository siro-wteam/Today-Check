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

// 임시 하드코딩 (Vercel 환경 변수 설정 전까지)
const fallbackUrl = 'https://your-prod-project.supabase.co';
const fallbackKey = 'your-prod-anon-key-here';

// 환경 변수 디버깅
if (Platform.OS === 'web') {
  console.log('🔍 Supabase Config Debug:');
  console.log('supabaseUrl:', supabaseUrl ? '✅ Set' : '❌ Missing');
  console.log('supabaseAnonKey:', supabaseAnonKey ? '✅ Set' : '❌ Missing');
  console.log('fallbackUrl:', fallbackUrl);
  console.log('fallbackKey:', fallbackKey ? '✅ Set' : '❌ Missing');
}

// 환경 변수가 없으면 임시 값 사용 (테스트용)
const finalUrl = supabaseUrl || fallbackUrl;
const finalKey = supabaseAnonKey || fallbackKey;

if (!finalUrl || !finalKey) {
  console.error('❌ Supabase configuration error:');
  console.error('finalUrl:', finalUrl);
  console.error('finalKey:', finalKey);
  throw new Error('Supabase URL and Anon Key are required. Please check your environment variables.');
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
        return Promise.resolve();
      }
      return Promise.resolve();
    }
    return AsyncStorage.setItem(key, value);
  },
  removeItem: (key: string) => {
    if (Platform.OS === 'web') {
      if (typeof window !== 'undefined') {
        window.localStorage.removeItem(key);
        return Promise.resolve();
      }
      return Promise.resolve();
    }
    return AsyncStorage.removeItem(key);
  },
};

// Supabase 클라이언트 생성 (타임아웃 설정 추가)
export const supabase = createClient(finalUrl, finalKey, {
  auth: {
    persistSession: true,
    storage: Platform.OS === 'web' ? customStorageAdapter : AsyncStorage,
  },
  global: {
    headers: {
      'Accept': 'application/json',
      'Content-Type': 'application/json',
    },
  },
  db: {
    schema: 'public',
  },
  realtime: {
    params: {
      eventsPerSecond: 2,
    },
  },
});

// Supabase 연결 테스트 (웹 전용)
if (Platform.OS === 'web') {
  console.log('🔍 Testing Supabase connection...');
  supabase.from('profiles').select('count').then(
    (result) => {
      console.log('✅ Supabase connection successful:', result);
    },
    (error) => {
      console.error('❌ Supabase connection failed:', error);
    }
  );
}
