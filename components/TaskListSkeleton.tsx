/**
 * Task list skeleton UI with blinking animation (Reanimated).
 * Used while tasks are loading instead of a spinner.
 * Colors follow light/dark mode for visual consistency.
 */

import { borderRadius, colors } from '@/constants/colors';
import { useColorScheme } from '@/hooks/use-color-scheme';
import React, { useEffect } from 'react';
import { View } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';

const ROW_COUNT = 5;

const themeColors = {
  light: {
    card: colors.card,
    border: colors.border,
    skeletonBase: colors.gray200,
  },
  dark: {
    card: colors.gray800,
    border: colors.gray700,
    skeletonBase: colors.gray600,
  },
} as const;

function SkeletonRow({
  cardBg,
  borderColor,
  skeletonBase,
}: {
  cardBg: string;
  borderColor: string;
  skeletonBase: string;
}) {
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
          backgroundColor: cardBg,
          borderWidth: 1,
          borderColor,
        },
      ]}
    >
      {/* Checkbox placeholder */}
      <View
        style={{
          width: 18,
          height: 18,
          borderRadius: borderRadius.full,
          backgroundColor: skeletonBase,
          marginRight: 12,
          marginTop: 0,
        }}
      />
      <View style={{ flex: 1, minWidth: 0 }}>
        {/* Title line */}
        <View
          style={{
            height: 14,
            borderRadius: borderRadius.xs,
            backgroundColor: skeletonBase,
            width: '75%',
            marginBottom: 8,
          }}
        />
        {/* Badges line */}
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginLeft: 0 }}>
          <View style={{ width: 48, height: 10, borderRadius: borderRadius.sm, backgroundColor: skeletonBase }} />
          <View style={{ width: 56, height: 10, borderRadius: borderRadius.sm, backgroundColor: skeletonBase }} />
          <View style={{ width: 40, height: 10, borderRadius: borderRadius.sm, backgroundColor: skeletonBase }} />
        </View>
      </View>
    </Animated.View>
  );
}

export function TaskListSkeleton() {
  const colorScheme = useColorScheme() ?? 'light';
  const theme = themeColors[colorScheme === 'dark' ? 'dark' : 'light'];

  return (
    <View style={{ paddingHorizontal: 16, paddingVertical: 16 }}>
      {Array.from({ length: ROW_COUNT }).map((_, i) => (
        <SkeletonRow
          key={i}
          cardBg={theme.card}
          borderColor={theme.border}
          skeletonBase={theme.skeletonBase}
        />
      ))}
    </View>
  );
}
