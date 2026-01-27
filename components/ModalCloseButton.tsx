import { Pressable, StyleSheet } from 'react-native';
import { X } from 'lucide-react-native';
import { colors, borderRadius } from '@/constants/colors';
import { useRef, useCallback } from 'react';
import * as Haptics from 'expo-haptics';

interface ModalCloseButtonProps {
  onPress: () => void;
  size?: number;
}

export function ModalCloseButton({ onPress, size = 20 }: ModalCloseButtonProps) {
  const isPressingRef = useRef(false);

  const handlePress = useCallback(() => {
    if (isPressingRef.current) return;
    
    isPressingRef.current = true;
    
    // Haptic feedback
    if (process.env.EXPO_OS === 'ios') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    }
    
    onPress();
    
    setTimeout(() => {
      isPressingRef.current = false;
    }, 100);
  }, [onPress]);

  return (
    <Pressable
      onPress={handlePress}
      style={styles.button}
      hitSlop={{ top: 15, bottom: 15, left: 15, right: 15 }}
      delayPressIn={0}
      delayPressOut={0}
      pressRetentionOffset={{ top: 40, bottom: 40, left: 40, right: 40 }}
    >
      <X size={size} color={colors.textSub} strokeWidth={2} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    width: 32,
    height: 32,
    borderRadius: borderRadius.full,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.gray100,
  },
});
