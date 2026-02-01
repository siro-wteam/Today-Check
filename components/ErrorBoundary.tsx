/**
 * 글로벌 에러 바운더리 (웹 전용)
 * AbortError 및 기타 에러 처리
 */

import React from 'react';
import { Platform } from 'react-native';
import { View, Text } from 'react-native';

interface ErrorBoundaryState {
  hasError: boolean;
  error?: Error;
}

interface ErrorBoundaryProps {
  children: React.ReactNode;
  fallback?: React.ReactNode;
}

class ErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    // AbortError 특별 처리
    if (error.name === 'AbortError' || error.message.includes('aborted')) {
      console.log('🔍 AbortError caught in boundary:', error.message);
      console.log('🔍 Error info:', errorInfo);
      // AbortError는 치명적이 아니므로 자동 복구 시도
      setTimeout(() => {
        this.setState({ hasError: false, error: undefined });
      }, 1000);
      return;
    }

    // 다른 에러는 상세 로깅
    console.error('❌ Error caught in boundary:', error);
    console.error('❌ Error info:', errorInfo);
  }

  render() {
    if (this.state.hasError) {
      // 웹 환경에서는 더 나은 UI 제공
      if (Platform.OS === 'web') {
        return this.props.fallback || (
          <View style={{ 
            flex: 1, 
            justifyContent: 'center', 
            alignItems: 'center', 
            padding: 20,
            backgroundColor: '#f8f9fa'
          }}>
            <Text style={{ fontSize: 18, fontWeight: 'bold', marginBottom: 10 }}>
              오류가 발생했습니다
            </Text>
            <Text style={{ fontSize: 14, color: '#666', textAlign: 'center', marginBottom: 20 }}>
              {this.state.error?.message || '알 수 없는 오류가 발생했습니다.'}
            </Text>
            <button
              onClick={() => this.setState({ hasError: false, error: undefined })}
              style={{
                padding: '10px 20px',
                backgroundColor: '#007bff',
                color: 'white',
                border: 'none',
                borderRadius: '5px',
                cursor: 'pointer'
              }}
            >
              다시 시도
            </button>
          </View>
        );
      }

      // 네이티브 환경
      return this.props.fallback || (
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', padding: 20 }}>
          <Text style={{ fontSize: 18, fontWeight: 'bold', marginBottom: 10 }}>
            오류가 발생했습니다
          </Text>
          <Text style={{ fontSize: 14, color: '#666', textAlign: 'center' }}>
            {this.state.error?.message || '알 수 없는 오류가 발생했습니다.'}
          </Text>
        </View>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
