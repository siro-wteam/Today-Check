import AsyncStorage from '@react-native-async-storage/async-storage';
import { useCallback, useEffect, useState } from 'react';
import { ONBOARDING_STORAGE_KEY, setJustCompletedOnboarding } from '@/lib/constants/onboarding';

/**
 * Returns whether the user has seen the onboarding flow.
 * null = still loading from storage.
 * reloadFromStorage: call after navigating away from onboarding so root layout sees updated value.
 */
export function useOnboardingComplete(): {
  hasSeenOnboarding: boolean | null;
  setOnboardingComplete: () => Promise<void>;
  reloadFromStorage: () => Promise<void>;
} {
  const [hasSeenOnboarding, setHasSeenOnboarding] = useState<boolean | null>(null);

  const reloadFromStorage = useCallback(async () => {
    const value = await AsyncStorage.getItem(ONBOARDING_STORAGE_KEY);
    setHasSeenOnboarding(value === 'true');
  }, []);

  useEffect(() => {
    reloadFromStorage();
  }, [reloadFromStorage]);

  const setOnboardingComplete = useCallback(async () => {
    await AsyncStorage.setItem(ONBOARDING_STORAGE_KEY, 'true');
    setJustCompletedOnboarding(true);
    setHasSeenOnboarding(true);
  }, []);

  return { hasSeenOnboarding, setOnboardingComplete, reloadFromStorage };
}
