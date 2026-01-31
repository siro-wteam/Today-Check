/**
 * Notification Settings Context - 알림 설정 관리
 * 
 * React Context 기반으로 플랫폼 호환성 문제 해결
 * - 웹: localStorage 사용
 * - 네이티브: AsyncStorage 사용
 */

import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

interface NotificationSettingsState {
  notificationsEnabled: boolean;
  soundEnabled: boolean;
  vibrationEnabled: boolean;
}

interface NotificationSettingsContextType extends NotificationSettingsState {
  toggleNotifications: (enabled: boolean) => void;
  toggleSound: (enabled: boolean) => void;
  toggleVibration: (enabled: boolean) => void;
  resetSettings: () => void;
  isLoading: boolean;
}

const NotificationSettingsContext = createContext<NotificationSettingsContextType | null>(null);

const STORAGE_KEY = 'notification-settings';
const DEFAULT_SETTINGS: NotificationSettingsState = {
  notificationsEnabled: true,
  soundEnabled: true,
  vibrationEnabled: true,
};

interface NotificationSettingsProviderProps {
  children: ReactNode;
}

export function NotificationSettingsProvider({ children }: NotificationSettingsProviderProps) {
  const [settings, setSettings] = useState<NotificationSettingsState>(DEFAULT_SETTINGS);
  const [isLoading, setIsLoading] = useState(true);

  // Load settings from storage on mount
  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    try {
      setIsLoading(true);
      
      // Platform-specific storage access
      if (typeof window !== 'undefined' && window.localStorage) {
        // Web environment - use localStorage
        const stored = localStorage.getItem(STORAGE_KEY);
        if (stored) {
          const parsedSettings = JSON.parse(stored);
          setSettings({ ...DEFAULT_SETTINGS, ...parsedSettings });
        }
      } else {
        // Native environment - use AsyncStorage
        const stored = await AsyncStorage.getItem(STORAGE_KEY);
        if (stored) {
          const parsedSettings = JSON.parse(stored);
          setSettings({ ...DEFAULT_SETTINGS, ...parsedSettings });
        }
      }
    } catch (error) {
      console.error('Error loading notification settings:', error);
      // Use default settings on error
      setSettings(DEFAULT_SETTINGS);
    } finally {
      setIsLoading(false);
    }
  };

  const saveSettings = async (newSettings: NotificationSettingsState) => {
    try {
      const settingsToSave = JSON.stringify(newSettings);
      
      // Platform-specific storage save
      if (typeof window !== 'undefined' && window.localStorage) {
        // Web environment - use localStorage
        localStorage.setItem(STORAGE_KEY, settingsToSave);
      } else {
        // Native environment - use AsyncStorage
        await AsyncStorage.setItem(STORAGE_KEY, settingsToSave);
      }
    } catch (error) {
      console.error('Error saving notification settings:', error);
    }
  };

  const toggleNotifications = (enabled: boolean) => {
    const newSettings = { ...settings, notificationsEnabled: enabled };
    setSettings(newSettings);
    saveSettings(newSettings);
  };

  const toggleSound = (enabled: boolean) => {
    const newSettings = { ...settings, soundEnabled: enabled };
    setSettings(newSettings);
    saveSettings(newSettings);
  };

  const toggleVibration = (enabled: boolean) => {
    const newSettings = { ...settings, vibrationEnabled: enabled };
    setSettings(newSettings);
    saveSettings(newSettings);
  };

  const resetSettings = () => {
    setSettings(DEFAULT_SETTINGS);
    saveSettings(DEFAULT_SETTINGS);
  };

  const value: NotificationSettingsContextType = {
    ...settings,
    toggleNotifications,
    toggleSound,
    toggleVibration,
    resetSettings,
    isLoading,
  };

  return (
    <NotificationSettingsContext.Provider value={value}>
      {children}
    </NotificationSettingsContext.Provider>
  );
}

export function useNotificationSettings(): NotificationSettingsContextType {
  const context = useContext(NotificationSettingsContext);
  if (!context) {
    throw new Error('useNotificationSettings must be used within a NotificationSettingsProvider');
  }
  return context;
}
