// React
import { useEffect } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';

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
import { useColorScheme } from '@/hooks/use-color-scheme';
import { useAuth } from '@/lib/hooks/use-auth';
import { queryClient } from '@/lib/query-client';
import '../global.css';

// Keep the splash screen visible while we fetch resources
SplashScreen.preventAutoHideAsync();

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
  const { isAuthenticated, loading } = useAuth();
  const segments = useSegments();
  const router = useRouter();

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
      SplashScreen.hideAsync();
    }
  }, [fontsLoaded, fontError]);

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
      <QueryClientProvider client={queryClient}>
        <RootLayoutNav />
      </QueryClientProvider>
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
