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

// 환경 변수 디버깅
if (Platform.OS === 'web') {
  console.log('🔍 Supabase Config Debug:');
  console.log('supabaseUrl:', supabaseUrl ? '✅ Set' : '❌ Missing');
  console.log('supabaseAnonKey:', supabaseAnonKey ? '✅ Set' : '❌ Missing');
}

if (!supabaseUrl || !supabaseAnonKey) {
  console.error('❌ Supabase configuration error:');
  console.error('supabaseUrl:', supabaseUrl);
  console.error('supabaseAnonKey:', supabaseAnonKey);
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
export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
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
  
  // 타임아웃 추가
  const timeoutPromise = new Promise((_, reject) => {
    setTimeout(() => reject(new Error('Connection timeout after 5 seconds')), 5000);
  });
  
  const connectionPromise = supabase.from('profiles').select('count').single();
  
  Promise.race([connectionPromise, timeoutPromise])
    .then((result) => {
      console.log('✅ Supabase connection successful:', result);
    })
    .catch((error) => {
      console.error('❌ Supabase connection failed:', error);
      console.error('Error details:', error.message);
      
      // 네트워크 탭에서 확인할 수 있도록 상세 정보
      if (error.message.includes('timeout')) {
        console.error('🔍 This appears to be a network/CORS issue');
      } else if (error.message.includes('CORS')) {
        console.error('🔍 CORS issue detected');
      } else {
        console.error('🔍 Other error:', error);
      }
    });
}
