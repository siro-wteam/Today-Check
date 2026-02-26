/**
 * First-run onboarding: usage guide slides (English).
 * Shown only when hasSeenOnboarding is false; after "Get started" we set the flag and go to main app.
 */

import { useOnboardingComplete } from '@/lib/hooks/use-onboarding';
import { useRouter } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { CheckSquare, ListTodo, Hand, Users } from 'lucide-react-native';
import { useCallback, useRef, useState } from 'react';
import {
  Dimensions,
  FlatList,
  NativeSyntheticEvent,
  NativeScrollEvent,
  Platform,
  Pressable,
  Text,
  View,
} from 'react-native';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

const SLIDES: { icon: typeof CheckSquare; title: string; description: string }[] = [
  {
    icon: CheckSquare,
    title: 'Your day in one place',
    description: 'Add tasks to Today and check them off as you go.',
  },
  {
    icon: ListTodo,
    title: 'Manage tasks without a date',
    description: 'Keep items in Backlog and bring them to Today when you\'re ready.',
  },
  {
    icon: Hand,
    title: 'Swipe to move or delete',
    description: 'On tasks: move to Backlog, bring to Today, or delete. In week or month view: swipe left or right for previous or next.',
  },
  {
    icon: Users,
    title: 'Organize with groups',
    description: 'Create groups to keep tasks by project or context. Switch between them from the Backlog tab.',
  },
];

export default function OnboardingScreen() {
  const router = useRouter();
  const { setOnboardingComplete } = useOnboardingComplete();
  const [index, setIndex] = useState(0);
  const listRef = useRef<FlatList>(null);

  const onScroll = useCallback((e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const i = Math.round(e.nativeEvent.contentOffset.x / SCREEN_WIDTH);
    if (i >= 0 && i < SLIDES.length) setIndex(i);
  }, []);

  const handleStart = useCallback(async () => {
    if (Platform.OS === 'ios') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    }
    await setOnboardingComplete();
    router.replace('/(tabs)');
  }, [setOnboardingComplete, router]);

  return (
    <View className="flex-1 bg-gray-50 dark:bg-gray-900">
      <FlatList
        ref={listRef}
        data={SLIDES}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onScroll={onScroll}
        scrollEventThrottle={16}
        keyExtractor={(_, i) => String(i)}
        renderItem={({ item }) => {
          const Icon = item.icon;
          return (
            <View style={{ width: SCREEN_WIDTH }} className="flex-1 px-10 justify-center items-center">
              <View className="w-20 h-20 rounded-2xl bg-blue-500 dark:bg-blue-600 items-center justify-center mb-8">
                <Icon size={40} color="#fff" strokeWidth={2} />
              </View>
              <Text className="text-xl font-semibold text-gray-900 dark:text-white text-center mb-3">
                {item.title}
              </Text>
              <Text className="text-base text-gray-600 dark:text-gray-400 text-center leading-6">
                {item.description}
              </Text>
            </View>
          );
        }}
      />
      <View className="px-6 pb-12 pt-4">
        <View className="flex-row justify-center gap-2 mb-6">
          {SLIDES.map((_, i) => (
            <View
              key={i}
              className={`h-2 rounded-full ${i === index ? 'w-6 bg-blue-500' : 'w-2 bg-gray-300 dark:bg-gray-600'}`}
            />
          ))}
        </View>
        <Pressable
          onPress={handleStart}
          className="bg-blue-500 dark:bg-blue-600 rounded-xl py-4 items-center justify-center active:opacity-80"
        >
          <Text className="text-white font-semibold text-base">Get started</Text>
        </Pressable>
      </View>
    </View>
  );
}
