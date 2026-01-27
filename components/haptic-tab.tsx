import { BottomTabBarButtonProps } from '@react-navigation/bottom-tabs';
import * as Haptics from 'expo-haptics';
import { useRef, useCallback } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

export function HapticTab(props: BottomTabBarButtonProps) {
  const isPressingRef = useRef(false);
  const lastPressTimeRef = useRef(0);

  const handlePress = useCallback(() => {
    const now = Date.now();
    
    // Prevent multiple rapid presses (minimum 100ms between presses)
    if (isPressingRef.current || !props.onPress || (now - lastPressTimeRef.current < 100)) {
      return;
    }
    
    isPressingRef.current = true;
    lastPressTimeRef.current = now;
    
    // Haptic feedback immediately
    if (process.env.EXPO_OS === 'ios') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    }
    
    // Call the original onPress handler immediately
    try {
      props.onPress();
    } catch (error) {
      console.warn('Tab press error:', error);
    }
    
    // Reset after a very short delay (reduced from 200ms to 100ms)
    setTimeout(() => {
      isPressingRef.current = false;
    }, 100);
  }, [props.onPress]);

  const handlePressIn = useCallback(() => {
    // Immediate haptic feedback on press down
    if (process.env.EXPO_OS === 'ios') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    }
    props.onPressIn?.();
  }, [props.onPressIn]);

  return (
    <Pressable
      onPress={handlePress}
      onPressIn={handlePressIn}
      delayPressIn={0}
      delayPressOut={0}
      pressRetentionOffset={{ top: 40, bottom: 40, left: 40, right: 40 }}
      hitSlop={{ top: 20, bottom: 20, left: 20, right: 20 }}
      style={({ pressed }) => [
        styles.button,
        props.style,
        pressed && styles.pressed,
      ]}
      accessibilityRole="button"
      accessibilityState={{ selected: props.accessibilityState?.selected }}
      accessibilityLabel={props.accessibilityLabel}
      disabled={props.disabled}
      pointerEvents="auto"
    >
      <View style={styles.content} pointerEvents="none">
        {props.children}
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pressed: {
    opacity: 0.7,
  },
  content: {
    alignItems: 'center',
    justifyContent: 'center',
  },
});
