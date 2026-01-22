import { AppHeader } from '@/components/AppHeader';
import { signOut, useAuth } from '@/lib/hooks/use-auth';
import { LogOut, Mail, User as UserIcon } from 'lucide-react-native';
import { Alert, Platform, Pressable, SafeAreaView, ScrollView, Text, View } from 'react-native';

export default function ProfileScreen() {
  const { user } = useAuth();

  const handleNotificationPress = () => {
    Alert.alert('Notifications', 'Notification feature coming soon!');
  };

  const handleSignOut = async () => {
    if (Platform.OS === 'web') {
      const confirmed = window.confirm('Are you sure you want to sign out?');
      if (!confirmed) return;
      
      const { error } = await signOut();
      if (error) {
        alert('Failed to sign out: ' + error.message);
      }
    } else {
      Alert.alert('Sign Out', 'Are you sure you want to sign out?', [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Sign Out',
          style: 'destructive',
          onPress: async () => {
            const { error } = await signOut();
            if (error) {
              Alert.alert('Error', 'Failed to sign out: ' + error.message);
            }
          },
        },
      ]);
    }
  };

  return (
    <SafeAreaView className="flex-1 bg-gray-50 dark:bg-gray-950">
      {/* Header */}
      <AppHeader onNotificationPress={handleNotificationPress} />

      <ScrollView 
        className="flex-1"
        contentContainerStyle={[
          { paddingHorizontal: 16, paddingVertical: 24 },
          Platform.OS === 'web' && { maxWidth: 600, width: '100%', alignSelf: 'center' }
        ]}
      >
        {/* Profile Card */}
        <View className="bg-white dark:bg-gray-900 rounded-2xl p-6 border border-gray-200 dark:border-gray-800 mb-6">
          {/* Avatar */}
          <View className="items-center mb-6">
            <View className="w-20 h-20 rounded-full bg-blue-100 dark:bg-blue-900/30 items-center justify-center mb-3">
              <UserIcon size={40} color="#3B82F6" strokeWidth={2} />
            </View>
            <Text className="text-xl font-bold text-gray-900 dark:text-white mb-1">
              {user?.email?.split('@')[0] || 'User'}
            </Text>
            <View className="flex-row items-center gap-2">
              <Mail size={16} color="#6B7280" />
              <Text className="text-sm text-gray-500 dark:text-gray-400">
                {user?.email || 'No email'}
              </Text>
            </View>
          </View>

          {/* Stats */}
          <View className="flex-row justify-around py-4 border-t border-gray-200 dark:border-gray-800">
            <View className="items-center">
              <Text className="text-2xl font-bold text-gray-900 dark:text-white mb-1">
                —
              </Text>
              <Text className="text-xs text-gray-500 dark:text-gray-400">
                Completed
              </Text>
            </View>
            <View className="w-px bg-gray-200 dark:bg-gray-800" />
            <View className="items-center">
              <Text className="text-2xl font-bold text-gray-900 dark:text-white mb-1">
                —
              </Text>
              <Text className="text-xs text-gray-500 dark:text-gray-400">
                Active
              </Text>
            </View>
            <View className="w-px bg-gray-200 dark:bg-gray-800" />
            <View className="items-center">
              <Text className="text-2xl font-bold text-gray-900 dark:text-white mb-1">
                —
              </Text>
              <Text className="text-xs text-gray-500 dark:text-gray-400">
                Streak
              </Text>
            </View>
          </View>
        </View>

        {/* Settings Section */}
        <View className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-800 overflow-hidden mb-6">
          <Text className="text-sm font-semibold text-gray-500 dark:text-gray-400 px-4 pt-4 pb-2">
            SETTINGS
          </Text>
          
          <Pressable className="flex-row items-center px-4 py-4 active:bg-gray-50 dark:active:bg-gray-800 border-t border-gray-200 dark:border-gray-800">
            <View className="w-10 h-10 rounded-full bg-gray-100 dark:bg-gray-800 items-center justify-center mr-3">
              <Text className="text-lg">🔔</Text>
            </View>
            <View className="flex-1">
              <Text className="text-base font-medium text-gray-900 dark:text-white">
                Notifications
              </Text>
              <Text className="text-sm text-gray-500 dark:text-gray-400">
                Manage your notifications
              </Text>
            </View>
          </Pressable>

          <Pressable className="flex-row items-center px-4 py-4 active:bg-gray-50 dark:active:bg-gray-800 border-t border-gray-200 dark:border-gray-800">
            <View className="w-10 h-10 rounded-full bg-gray-100 dark:bg-gray-800 items-center justify-center mr-3">
              <Text className="text-lg">🎨</Text>
            </View>
            <View className="flex-1">
              <Text className="text-base font-medium text-gray-900 dark:text-white">
                Appearance
              </Text>
              <Text className="text-sm text-gray-500 dark:text-gray-400">
                Theme and display settings
              </Text>
            </View>
          </Pressable>

          <Pressable className="flex-row items-center px-4 py-4 active:bg-gray-50 dark:active:bg-gray-800 border-t border-gray-200 dark:border-gray-800">
            <View className="w-10 h-10 rounded-full bg-gray-100 dark:bg-gray-800 items-center justify-center mr-3">
              <Text className="text-lg">ℹ️</Text>
            </View>
            <View className="flex-1">
              <Text className="text-base font-medium text-gray-900 dark:text-white">
                About
              </Text>
              <Text className="text-sm text-gray-500 dark:text-gray-400">
                Version and info
              </Text>
            </View>
          </Pressable>
        </View>

        {/* Sign Out Button */}
        <Pressable
          onPress={handleSignOut}
          className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-800 p-4 active:opacity-70"
        >
          <View className="flex-row items-center justify-center gap-3">
            <LogOut size={20} color="#EF4444" strokeWidth={2} />
            <Text className="text-base font-semibold text-red-600 dark:text-red-500">
              Sign Out
            </Text>
          </View>
        </Pressable>

        {/* App Version */}
        <Text className="text-center text-xs text-gray-400 dark:text-gray-600 mt-6">
          TodayCheck v1.0.0
        </Text>
      </ScrollView>
    </SafeAreaView>
  );
}
