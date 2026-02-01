// React
import { useEffect } from 'react';
import { ActivityIndicator, Platform, StyleSheet, View } from 'react-native';

// burnt web toaster (for showToast on web)
import { Toaster } from 'burnt/web';

// Third-party libraries
import { DarkTheme, DefaultTheme, ThemeProvider } from '@react-navigation/native';
import { QueryClientProvider } from '@tanstack/react-query';
import { useFonts } from 'expo-font';
import { Stack, useRouter, useSegments } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import 'react-native-reanimated';

// Local imports
import ErrorBoundary from '@/components/ErrorBoundary';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { NotificationSettingsProvider } from '@/lib/contexts/NotificationSettingsContext';
import { useAuth } from '@/lib/hooks/use-auth';
import { queryClient } from '@/lib/query-client';
import { setQueryClientForGroupStore, useGroupStore } from '@/lib/stores/useGroupStore';
import '../global.css';

// 환경 변수 디버깅 (웹 전용)
if (Platform.OS === 'web') {
  console.log('🔍 Environment Variables Debug:');
  console.log('EXPO_PUBLIC_SUPABASE_URL:', process.env.EXPO_PUBLIC_SUPABASE_URL);
  console.log('EXPO_PUBLIC_SUPABASE_ANON_KEY:', process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ? '✅ Set' : '❌ Missing');
}

// Keep the splash screen visible while we fetch resources
// Use try-catch to handle cases where this might fail
SplashScreen.preventAutoHideAsync().catch((error) => {
  console.warn('SplashScreen.preventAutoHideAsync error (ignored):', error);
});

// Expo Router configuration
export const unstable_settings = {
  anchor: '(tabs)',
};

/**
 * RootLayoutNav Component
 * 
 * Handles authentication routing and navigation setup.
 * - Redirects unauthenticated users to /auth
 * - Redirects authenticated users away from /auth to /(tabs)
 */
function RootLayoutNav() {
  const colorScheme = useColorScheme();
  const { isAuthenticated, loading, user } = useAuth();
  const segments = useSegments();
  const router = useRouter();
  const { fetchMyGroups } = useGroupStore();

  // Fetch groups once when user is authenticated (centralized)
  useEffect(() => {
    if (isAuthenticated && user?.id) {
      fetchMyGroups(user.id);
    }
  }, [isAuthenticated, user?.id, fetchMyGroups]);

  // Handle authentication-based navigation
  useEffect(() => {
    if (loading) return;

    const inAuthGroup = segments[0] === 'auth';
    
    console.log('Auth State:', { isAuthenticated, loading, segments, inAuthGroup });

    if (!isAuthenticated && !inAuthGroup) {
      // Redirect to auth if not authenticated
      console.log('Redirecting to /auth');
      router.replace('/auth');
    } else if (isAuthenticated && inAuthGroup) {
      // Redirect to home if authenticated
      console.log('Redirecting to /(tabs)');
      router.replace('/(tabs)');
    }
  }, [isAuthenticated, loading, segments, router]);

  // Show loading indicator while checking authentication
  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#3b82f6" />
      </View>
    );
  }

  return (
    <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
      <Stack>
        <Stack.Screen 
          name="auth" 
          options={{ headerShown: false }} 
        />
        <Stack.Screen 
          name="(tabs)" 
          options={{ headerShown: false }} 
        />
        <Stack.Screen 
          name="day" 
          options={{ 
            presentation: 'modal',
            headerShown: false, // Hide header for popup-like appearance
          }} 
        />
        <Stack.Screen 
          name="group-detail" 
          options={{ 
            presentation: 'modal',
            headerShown: false, // Hide header for popup-like appearance
          }} 
        />
        <Stack.Screen 
          name="modal" 
          options={{ 
            presentation: 'modal', 
            title: 'Modal' 
          }} 
        />
      </Stack>
      <StatusBar style="auto" />
    </ThemeProvider>
  );
}

/**
 * RootLayout Component
 * 
 * Main entry point for the app.
 * - Loads Geist fonts with fallback to system fonts
 * - Manages splash screen visibility during font loading
 * - Provides gesture handler and query client context
 */
export default function RootLayout() {
  // Load Geist font family
  const [fontsLoaded, fontError] = useFonts({
    'Geist-Regular': require('../assets/fonts/Geist-Regular.ttf'),
    'Geist-Medium': require('../assets/fonts/Geist-Medium.ttf'),
    'Geist-SemiBold': require('../assets/fonts/Geist-SemiBold.ttf'),
    'Geist-Bold': require('../assets/fonts/Geist-Bold.ttf'),
  });

  // Hide splash screen once fonts are loaded (or if there's an error)
  useEffect(() => {
    if (fontsLoaded || fontError) {
      // Use setTimeout to ensure splash screen is fully registered before hiding
      // This prevents "No native splash screen registered" errors on iOS
      const hideSplash = async () => {
        try {
          // Small delay to ensure native module is ready
          await new Promise(resolve => setTimeout(resolve, 100));
          await SplashScreen.hideAsync();
        } catch (error) {
          // Ignore errors if splash screen is not registered
          // This can happen on some platforms or during development
          if (Platform.OS !== 'web') {
            console.warn('SplashScreen.hideAsync error (ignored):', error);
          }
        }
      };
      
      hideSplash();
    }
  }, [fontsLoaded, fontError]);

  // Set query client for group store (for realtime task synchronization)
  // Must be called before any conditional returns to maintain hook order
  useEffect(() => {
    setQueryClientForGroupStore(queryClient);
  }, []);

  // Initialize notifications on app startup
  useEffect(() => {
    import('@/lib/utils/task-notifications').then(({ initializeNotifications }) => {
      initializeNotifications().catch(console.error);
    });
  }, []);

  // Show loading indicator while fonts are loading
  if (!fontsLoaded && !fontError) {
    return (
      <View style={styles.fontLoadingContainer}>
        <ActivityIndicator size="large" color="#0080F0" />
      </View>
    );
  }

  // Log font loading errors but continue with system font fallback
  if (fontError) {
    console.warn('Font loading error (using system fonts):', fontError);
  }

  return (
    <GestureHandlerRootView style={styles.gestureContainer}>
      <>
        <QueryClientProvider client={queryClient}>
          <ErrorBoundary>
            <NotificationSettingsProvider>
              <RootLayoutNav />
            </NotificationSettingsProvider>
          </ErrorBoundary>
        </QueryClientProvider>
        {Platform.OS === 'web' && <Toaster position="bottom-center" />}
      </>
    </GestureHandlerRootView>
  );
}

// Styles
const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    backgroundColor: '#F9FAFB', // bg-gray-50 equivalent
    alignItems: 'center',
    justifyContent: 'center',
  },
  fontLoadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#FAFAFA',
  },
  gestureContainer: {
    flex: 1,
  },
});
