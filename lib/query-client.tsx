/**
 * React Query (TanStack Query) Configuration
 */

import { QueryClient } from '@tanstack/react-query';
import { Platform } from 'react-native';

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 5, // 5 minutes
      gcTime: 1000 * 60 * 60, // 1 hour (formerly cacheTime)
      retry: (failureCount, error: any) => {
        // AbortError인 경우 재시도하지 않음
        if (error?.name === 'AbortError' || error?.message?.includes('aborted')) {
          console.log('🔍 AbortError detected, skipping retry:', error.message);
          return false;
        }
        // 다른 에러는 1번만 재시도
        return failureCount < 1;
      },
      refetchOnWindowFocus: false,
      // 웹 환경에서 타임아웃 설정
      queryFn: undefined, // 각 쿼리에서 개별 설정
    },
    mutations: {
      retry: (failureCount, error: any) => {
        // AbortError인 경우 재시도하지 않음
        if (error?.name === 'AbortError' || error?.message?.includes('aborted')) {
          console.log('🔍 AbortError in mutation, skipping retry:', error.message);
          return false;
        }
        return failureCount < 1;
      },
    },
  },
});

// 웹 환경에서 글로벌 에러 핸들링
if (Platform.OS === 'web') {
  // 윈도우 포커스 시 모든 쿼리 취소 방지
  if (typeof window !== 'undefined') {
    window.addEventListener('beforeunload', () => {
      console.log('🔍 Page unloading, cancelling queries...');
      queryClient.cancelQueries();
    });
  }
}
