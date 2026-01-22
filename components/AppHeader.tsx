import { Bell } from 'lucide-react-native';
import { Platform, Pressable, Text, View } from 'react-native';
import { colors } from '@/constants/colors';
import { LogoIcon } from '@/components/ui/LogoIcon';

interface AppHeaderProps {
  onNotificationPress?: () => void;
}

export function AppHeader({ onNotificationPress }: AppHeaderProps) {
  return (
    <View
      className="bg-card px-6 py-4 border-b border-border"
      style={Platform.OS === 'web' ? { maxWidth: 600, width: '100%', alignSelf: 'center' } : {}}
    >
      <View className="flex-row justify-between items-center">
        {/* Left: Logo + Wordmark */}
        <View className="flex-row items-center gap-2">
          <LogoIcon size={32} color={colors.primary} />
          <Text className="text-[22px] text-text-main">
            <Text className="font-bold">Today</Text>
            <Text className="font-normal">Check</Text>
          </Text>
        </View>

        {/* Right: Notification Bell */}
        <Pressable
          onPress={onNotificationPress}
          className="p-2 rounded-lg active:opacity-70 active:bg-gray-100"
        >
          <Bell size={24} color={colors.textSub} strokeWidth={2} />
        </Pressable>
      </View>
    </View>
  );
}
