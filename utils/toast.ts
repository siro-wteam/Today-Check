import * as Burnt from 'burnt';
import * as Haptics from 'expo-haptics';
import { Platform } from 'react-native';

export type ToastType = 'success' | 'error' | 'info';

/**
 * Shows a toast with Haptic feedback.
 * Use for simple notifications only. Keep Alert.alert for confirmations (delete, etc.).
 */
export function showToast(type: ToastType, title: string, message?: string): void {
  // 1. Haptic Feedback (no-op on web)
  if (Platform.OS !== 'web') {
    if (type === 'success') {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } else if (type === 'error') {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    } else {
      Haptics.selectionAsync();
    }
  }

  // 2. Visual Toast (Burnt; web uses sonner via Toaster)
  const preset = type === 'success' ? 'done' : type === 'error' ? 'error' : 'none';
  Burnt.toast({
    title,
    message: message ?? undefined,
    preset,
    duration: 2,
    haptic: 'none', // we control Haptics above
  });
}
