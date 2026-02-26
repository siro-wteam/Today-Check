/**
 * Group list skeleton UI with blinking animation (Reanimated).
 * Used while groups are loading, for consistency with task list and backlog loading.
 */

import { borderRadius, colors, shadows } from '@/constants/colors';
import { useColorScheme } from '@/hooks/use-color-scheme';
import React, { useEffect } from 'react';
import { Platform, View } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';

const CARD_COUNT = 4;

const themeColors = {
  light: {
    card: colors.card,
    border: 'rgba(229, 231, 235, 0.5)',
    skeletonBase: colors.gray200,
  },
  dark: {
    card: colors.gray800,
    border: colors.gray700,
    skeletonBase: colors.gray600,
  },
} as const;

function SkeletonCard({
  cardBg,
  borderColor,
  skeletonBase,
}: {
  cardBg: string;
  borderColor: string;
  skeletonBase: string;
}) {
  const opacity = useSharedValue(0.5);

  useEffect(() => {
    opacity.value = withRepeat(
      withTiming(0.9, { duration: 800 }),
      -1,
      true
    );
  }, []);

  const animatedStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
  }));

  const cardStyle = {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    padding: 16,
    marginBottom: 12,
    borderRadius: borderRadius.xl,
    backgroundColor: cardBg,
    borderWidth: 1,
    borderColor,
    ...(Platform.OS !== 'web' ? shadows.sm : {}),
  };

  // On native, wrap in View with static opacity so first paint is visible (Reanimated can lag one frame)
  if (Platform.OS !== 'web') {
    return (
      <View style={[cardStyle, { opacity: 0.6 }]}>
        <SkeletonCardContent skeletonBase={skeletonBase} />
      </View>
    );
  }

  return (
    <Animated.View style={[animatedStyle, cardStyle]}>
      <SkeletonCardContent skeletonBase={skeletonBase} />
    </Animated.View>
  );
}

function SkeletonCardContent({ skeletonBase }: { skeletonBase: string }) {
  return (
    <>
      <View
        style={{
          width: 56,
          height: 56,
          borderRadius: borderRadius.md,
          backgroundColor: skeletonBase,
          marginRight: 16,
        }}
      />
      <View style={{ flex: 1, minWidth: 0 }}>
        <View
          style={{
            height: 16,
            borderRadius: borderRadius.xs,
            backgroundColor: skeletonBase,
            width: '70%',
            marginBottom: 8,
          }}
        />
        <View style={{ flexDirection: 'row' as const, alignItems: 'center' as const, gap: 8 }}>
          <View style={{ width: 72, height: 14, borderRadius: borderRadius.sm, backgroundColor: skeletonBase }} />
          <View style={{ width: 52, height: 14, borderRadius: borderRadius.full, backgroundColor: skeletonBase }} />
        </View>
      </View>
    </>
  );
}

export function GroupListSkeleton() {
  const colorScheme = useColorScheme() ?? 'light';
  const theme = themeColors[colorScheme === 'dark' ? 'dark' : 'light'];

  return (
    <View
      style={{
        paddingHorizontal: 16,
        paddingVertical: 16,
        ...(Platform.OS !== 'web' ? { minHeight: 280 } : {}),
      }}
    >
      {Array.from({ length: CARD_COUNT }).map((_, i) => (
        <SkeletonCard
          key={i}
          cardBg={theme.card}
          borderColor={theme.border}
          skeletonBase={theme.skeletonBase}
        />
      ))}
    </View>
  );
}
