import { AppHeader } from '@/components/AppHeader';
import { EditNicknameModal } from '@/components/EditNicknameModal';
import { signOut, useAuth } from '@/lib/hooks/use-auth';
import { Edit2, LogOut, Mail, User as UserIcon } from 'lucide-react-native';
import { useState } from 'react';
import { Alert, Platform, Pressable, SafeAreaView, ScrollView, Text, View } from 'react-native';
import { colors, borderRadius, spacing } from '@/constants/colors';

export default function ProfileScreen() {
  const { user, profile, updateProfile } = useAuth();
  const [isEditModalVisible, setIsEditModalVisible] = useState(false);

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
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }}>
      {/* Header */}
      <AppHeader onNotificationPress={handleNotificationPress} />

      <ScrollView 
        style={{ flex: 1 }}
        contentContainerStyle={[
          { paddingHorizontal: spacing.lg, paddingVertical: spacing.xxl },
          Platform.OS === 'web' && { maxWidth: 600, width: '100%', alignSelf: 'center' }
        ]}
      >
        {/* Profile Card */}
        <View style={{
          backgroundColor: colors.card,
          borderRadius: borderRadius['2xl'],
          padding: spacing.xxl,
          borderWidth: 1,
          borderColor: colors.border,
          marginBottom: spacing.xxl,
        }}>
          {/* Avatar */}
          <View style={{ alignItems: 'center', marginBottom: spacing.xxl }}>
            <View style={{
              width: 80,
              height: 80,
              borderRadius: borderRadius.full,
              backgroundColor: '#DBEAFE',
              alignItems: 'center',
              justifyContent: 'center',
              marginBottom: spacing.md,
            }}>
              <UserIcon size={40} color={colors.primary} strokeWidth={2} />
            </View>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginBottom: spacing.xs }}>
              <Text style={{ fontSize: 20, fontWeight: '700', color: colors.textMain }}>
                {profile?.nickname || user?.email?.split('@')[0] || 'User'}
              </Text>
              <Pressable
                onPress={() => setIsEditModalVisible(true)}
                style={{ padding: spacing.xs }}
              >
                <Edit2 size={16} color={colors.textSub} strokeWidth={2} />
              </Pressable>
            </View>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
              <Mail size={16} color={colors.textSub} />
              <Text style={{ fontSize: 14, color: colors.textSub }}>
                {user?.email || 'No email'}
              </Text>
            </View>
          </View>

          {/* Stats */}
          <View style={{
            flexDirection: 'row',
            justifyContent: 'space-around',
            paddingVertical: spacing.lg,
            borderTopWidth: 1,
            borderTopColor: colors.border,
          }}>
            <View style={{ alignItems: 'center' }}>
              <Text style={{ fontSize: 24, fontWeight: '700', color: colors.textMain, marginBottom: spacing.xs }}>
                —
              </Text>
              <Text style={{ fontSize: 12, color: colors.textSub }}>
                Completed
              </Text>
            </View>
            <View style={{ width: 1, backgroundColor: colors.border }} />
            <View style={{ alignItems: 'center' }}>
              <Text style={{ fontSize: 24, fontWeight: '700', color: colors.textMain, marginBottom: spacing.xs }}>
                —
              </Text>
              <Text style={{ fontSize: 12, color: colors.textSub }}>
                Active
              </Text>
            </View>
            <View style={{ width: 1, backgroundColor: colors.border }} />
            <View style={{ alignItems: 'center' }}>
              <Text style={{ fontSize: 24, fontWeight: '700', color: colors.textMain, marginBottom: spacing.xs }}>
                —
              </Text>
              <Text style={{ fontSize: 12, color: colors.textSub }}>
                Streak
              </Text>
            </View>
          </View>
        </View>

        {/* Settings Section */}
        <View style={{
          backgroundColor: colors.card,
          borderRadius: borderRadius['2xl'],
          borderWidth: 1,
          borderColor: colors.border,
          overflow: 'hidden',
          marginBottom: spacing.xxl,
        }}>
          <Text style={{
            fontSize: 14,
            fontWeight: '600',
            color: colors.textSub,
            paddingHorizontal: spacing.lg,
            paddingTop: spacing.lg,
            paddingBottom: spacing.sm,
          }}>
            SETTINGS
          </Text>
          
          <Pressable style={({ pressed }) => ({
            flexDirection: 'row',
            alignItems: 'center',
            paddingHorizontal: spacing.lg,
            paddingVertical: spacing.lg,
            backgroundColor: pressed ? colors.gray50 : 'transparent',
            borderTopWidth: 1,
            borderTopColor: colors.border,
          })}>
            <View style={{
              width: 40,
              height: 40,
              borderRadius: borderRadius.full,
              backgroundColor: colors.gray100,
              alignItems: 'center',
              justifyContent: 'center',
              marginRight: spacing.md,
            }}>
              <Text style={{ fontSize: 18 }}>🔔</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={{ fontSize: 16, fontWeight: '500', color: colors.textMain }}>
                Notifications
              </Text>
              <Text style={{ fontSize: 14, color: colors.textSub }}>
                Manage your notifications
              </Text>
            </View>
          </Pressable>

          <Pressable style={({ pressed }) => ({
            flexDirection: 'row',
            alignItems: 'center',
            paddingHorizontal: spacing.lg,
            paddingVertical: spacing.lg,
            backgroundColor: pressed ? colors.gray50 : 'transparent',
            borderTopWidth: 1,
            borderTopColor: colors.border,
          })}>
            <View style={{
              width: 40,
              height: 40,
              borderRadius: borderRadius.full,
              backgroundColor: colors.gray100,
              alignItems: 'center',
              justifyContent: 'center',
              marginRight: spacing.md,
            }}>
              <Text style={{ fontSize: 18 }}>🎨</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={{ fontSize: 16, fontWeight: '500', color: colors.textMain }}>
                Appearance
              </Text>
              <Text style={{ fontSize: 14, color: colors.textSub }}>
                Theme and display settings
              </Text>
            </View>
          </Pressable>

          <Pressable style={({ pressed }) => ({
            flexDirection: 'row',
            alignItems: 'center',
            paddingHorizontal: spacing.lg,
            paddingVertical: spacing.lg,
            backgroundColor: pressed ? colors.gray50 : 'transparent',
            borderTopWidth: 1,
            borderTopColor: colors.border,
          })}>
            <View style={{
              width: 40,
              height: 40,
              borderRadius: borderRadius.full,
              backgroundColor: colors.gray100,
              alignItems: 'center',
              justifyContent: 'center',
              marginRight: spacing.md,
            }}>
              <Text style={{ fontSize: 18 }}>ℹ️</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={{ fontSize: 16, fontWeight: '500', color: colors.textMain }}>
                About
              </Text>
              <Text style={{ fontSize: 14, color: colors.textSub }}>
                Version and info
              </Text>
            </View>
          </Pressable>
        </View>

        {/* Sign Out Button */}
        <Pressable
          onPress={handleSignOut}
          style={({ pressed }) => ({
            backgroundColor: colors.card,
            borderRadius: borderRadius['2xl'],
            borderWidth: 1,
            borderColor: colors.border,
            padding: spacing.lg,
            opacity: pressed ? 0.7 : 1,
          })}
        >
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.md }}>
            <LogOut size={20} color={colors.error} strokeWidth={2} />
            <Text style={{ fontSize: 16, fontWeight: '600', color: colors.error }}>
              Sign Out
            </Text>
          </View>
        </Pressable>

        {/* App Version */}
        <Text style={{
          textAlign: 'center',
          fontSize: 12,
          color: colors.textDisabled,
          marginTop: spacing.xxl,
        }}>
          TodayCheck v1.0.0
        </Text>
      </ScrollView>

      {/* Edit Nickname Modal */}
      <EditNicknameModal
        visible={isEditModalVisible}
        currentNickname={profile?.nickname || user?.email?.split('@')[0] || 'User'}
        onClose={() => setIsEditModalVisible(false)}
        onSave={updateProfile}
      />
    </SafeAreaView>
  );
}
