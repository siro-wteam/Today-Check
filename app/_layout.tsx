import { DarkTheme, DefaultTheme, ThemeProvider } from '@react-navigation/native';
import { QueryClientProvider } from '@tanstack/react-query';
import { useFonts } from 'expo-font';
import { Stack, useRouter, useSegments } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { ActivityIndicator, View } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import 'react-native-reanimated';

import { useColorScheme } from '@/hooks/use-color-scheme';
import { useAuth } from '@/lib/hooks/use-auth';
import { queryClient } from '@/lib/query-client';
import '../global.css';

// Keep the splash screen visible while we fetch resources
SplashScreen.preventAutoHideAsync();

export const unstable_settings = {
  anchor: '(tabs)',
};

function RootLayoutNav() {
  const colorScheme = useColorScheme();
  const { isAuthenticated, loading } = useAuth();
  const segments = useSegments();
  const router = useRouter();

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
  }, [isAuthenticated, loading, segments]);

  if (loading) {
    return (
      <View className="flex-1 bg-gray-50 dark:bg-gray-950 items-center justify-center">
        <ActivityIndicator size="large" color="#3b82f6" />
      </View>
    );
  }

  return (
    <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
      <Stack>
        <Stack.Screen name="auth" options={{ headerShown: false }} />
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen 
          name="day" 
          options={{ 
            presentation: 'modal',
            headerShown: false, // Hide header for popup-like appearance
          }} 
        />
        <Stack.Screen name="modal" options={{ presentation: 'modal', title: 'Modal' }} />
      </Stack>
      <StatusBar style="auto" />
    </ThemeProvider>
  );
}

export default function RootLayout() {
  // Conditionally load fonts only if files exist
  // For now, we'll skip font loading and use system fonts
  // Uncomment and add font files to assets/fonts/ to enable Geist fonts
  const [fontsLoaded, fontError] = useFonts({
    // Uncomment these lines after adding font files to assets/fonts/
     'Geist-Regular': require('../assets/fonts/Geist-Regular.ttf'),
     'Geist-Medium': require('../assets/fonts/Geist-Medium.ttf'),
     'Geist-SemiBold': require('../assets/fonts/Geist-SemiBold.ttf'),
     'Geist-Bold': require('../assets/fonts/Geist-Bold.ttf'),
  });

  useEffect(() => {
    if (fontsLoaded || fontError) {
      // Hide the splash screen once fonts are loaded (or if there's an error)
      SplashScreen.hideAsync();
    }
  }, [fontsLoaded, fontError]);

  // Show loading indicator if fonts are still loading
  if (!fontsLoaded && !fontError) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#FAFAFA' }}>
        <ActivityIndicator size="large" color="#0080F0" />
      </View>
    );
  }

  // If there's a font error, log it but continue (will use system font as fallback)
  if (fontError) {
    console.warn('Font loading error (using system fonts):', fontError);
  }

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <QueryClientProvider client={queryClient}>
        <RootLayoutNav />
      </QueryClientProvider>
    </GestureHandlerRootView>
  );
}
