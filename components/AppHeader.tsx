import { Bell } from 'lucide-react-native';
import { Platform, Pressable, Text, View } from 'react-native';
import { colors, borderRadius } from '@/constants/colors';
import { LogoIcon } from '@/components/ui/LogoIcon';

interface AppHeaderProps {
  onNotificationPress?: () => void;
}

export function AppHeader({ onNotificationPress }: AppHeaderProps) {
  return (
    <View
      style={[
        {
          backgroundColor: 'rgba(255, 255, 255, 0.8)', // bg-card/80
          paddingHorizontal: 16, // px-4
          paddingVertical: 12, // py-3
          borderBottomWidth: 1,
          borderBottomColor: 'rgba(229, 231, 235, 0.5)', // border-border/50
        },
        Platform.OS === 'web' ? { maxWidth: 600, width: '100%', alignSelf: 'center' } : {},
      ]}
    >
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          <View
            style={{
              width: 36,
              height: 36,
              borderRadius: 8,
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <LogoIcon size={36} color={colors.primary} />
          </View>
          <Text style={{ fontSize: 20, fontWeight: '700' }}>
            <Text style={{ color: colors.primary }}>Today</Text>
            <Text style={{ color: colors.textMain }}>Check</Text>
          </Text>
        </View>

        <Pressable
          onPress={onNotificationPress}
          style={({ pressed }) => [
            {
              width: 40,
              height: 40,
              borderRadius: borderRadius.full,
              alignItems: 'center',
              justifyContent: 'center',
              backgroundColor: pressed ? colors.gray100 : 'transparent',
            },
          ]}
        >
          <Bell size={20} color={colors.textSub} strokeWidth={2} />
          <View
            style={{
              position: 'absolute',
              right: 8,
              top: 8,
              width: 8,
              height: 8,
              borderRadius: 4,
              backgroundColor: colors.error,
            }}
          />
        </Pressable>
      </View>
    </View>
  );
}
