/**
 * Task list skeleton UI with blinking animation (Reanimated).
 * Used while tasks are loading instead of a spinner.
 */

import { borderRadius, colors } from '@/constants/colors';
import React, { useEffect } from 'react';
import { View } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';

const SKELETON_BASE = colors.gray200;
const ROW_COUNT = 5;

function SkeletonRow() {
  const opacity = useSharedValue(0.4);

  useEffect(() => {
    opacity.value = withRepeat(
      withTiming(0.85, { duration: 800 }),
      -1,
      true
    );
  }, []);

  const animatedStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
  }));

  return (
    <Animated.View
      style={[
        animatedStyle,
        {
          flexDirection: 'row',
          alignItems: 'flex-start',
          paddingHorizontal: 12,
          paddingVertical: 12,
          borderRadius: borderRadius.lg,
          marginBottom: 8,
          backgroundColor: colors.card,
          borderWidth: 1,
          borderColor: colors.border,
        },
      ]}
    >
      {/* Checkbox placeholder */}
      <View
        style={{
          width: 18,
          height: 18,
          borderRadius: borderRadius.full,
          backgroundColor: SKELETON_BASE,
          marginRight: 12,
          marginTop: 0,
        }}
      />
      <View style={{ flex: 1, minWidth: 0 }}>
        {/* Title line */}
        <View
          style={{
            height: 14,
            borderRadius: 4,
            backgroundColor: SKELETON_BASE,
            width: '75%',
            marginBottom: 8,
          }}
        />
        {/* Badges line */}
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginLeft: 0 }}>
          <View style={{ width: 48, height: 10, borderRadius: 6, backgroundColor: SKELETON_BASE }} />
          <View style={{ width: 56, height: 10, borderRadius: 6, backgroundColor: SKELETON_BASE }} />
          <View style={{ width: 40, height: 10, borderRadius: 6, backgroundColor: SKELETON_BASE }} />
        </View>
      </View>
    </Animated.View>
  );
}

export function TaskListSkeleton() {
  return (
    <View style={{ paddingHorizontal: 16, paddingVertical: 16 }}>
      {Array.from({ length: ROW_COUNT }).map((_, i) => (
        <SkeletonRow key={i} />
      ))}
    </View>
  );
}
