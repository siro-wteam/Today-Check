import { signIn, signUp, useAuth } from '@/lib/hooks/use-auth';
import { useGroupStore } from '@/lib/stores/useGroupStore';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import {
    ActivityIndicator,
    KeyboardAvoidingView,
    Platform,
    Pressable,
    Text,
    TextInput,
    View,
} from 'react-native';
import { showToast } from '@/utils/toast';

export default function AuthScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const { joinGroup } = useGroupStore();
  const [isSignUp, setIsSignUp] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [nickname, setNickname] = useState('');
  const [inviteCode, setInviteCode] = useState('');
  const [loading, setLoading] = useState(false);

  const handleAuth = async () => {
    if (!email || !password) {
      showToast('error', 'Error', 'Please fill in all fields');
      return;
    }

    if (isSignUp && !nickname.trim()) {
      showToast('error', 'Error', 'Please enter a nickname');
      return;
    }

    if (password.length < 6) {
      showToast('error', 'Error', 'Password must be at least 6 characters');
      return;
    }

    setLoading(true);

    try {
      if (isSignUp) {
        const { data, error } = await signUp(email, password, nickname);
        
        if (error) {
          showToast('error', 'Sign Up Failed', error.message);
        } else {
          // If invite code is provided, try to join group
          if (inviteCode.trim() && data?.user?.id) {
            const { success, error: joinError } = await joinGroup(inviteCode.trim().toUpperCase(), data.user.id);
            
            if (success) {
              showToast('success', 'Success!', 'Account created successfully. You have been automatically added to the group!');
              setTimeout(() => {
                setIsSignUp(false);
                setInviteCode('');
                router.replace('/(tabs)');
              }, 2000);
            } else {
              showToast('info', 'Account Created', `Couldn't add you to the group: ${joinError || 'Invalid invite code'}. You can try joining later.`);
              setTimeout(() => {
                setIsSignUp(false);
                setInviteCode('');
              }, 2000);
            }
          } else {
              showToast('success', 'Success!', 'Account created successfully. Please check your email to verify your account.');
              setTimeout(() => {
                setIsSignUp(false);
                setNickname('');
              }, 2000);
          }
        }
      } else {
        const { data, error } = await signIn(email, password);
        
        if (error) {
          showToast('error', 'Sign In Failed', error.message);
        } else {
          // Navigation will be handled by the auth state change listener
          router.replace('/(tabs)');
        }
      }
    } catch (error: any) {
      showToast('error', 'Error', error.message || 'Something went wrong');
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      className="flex-1 bg-gray-50 dark:bg-gray-950"
    >
      <View className="flex-1 justify-center px-6">
        {/* Header */}
        <View className="mb-12">
          <Text className="text-4xl font-bold text-gray-900 dark:text-white mb-2">
            Today-Check
          </Text>
          <Text className="text-lg text-gray-600 dark:text-gray-400">
            Simple like a To-do list, managed like pro
          </Text>
        </View>

        {/* Form */}
        <View className="space-y-4">
          <View>
            <Text className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Email
            </Text>
            <TextInput
              className="bg-white dark:bg-gray-900 border border-gray-300 dark:border-gray-700 rounded-xl px-4 py-3 text-gray-900 dark:text-white"
              placeholder="you@example.com"
              placeholderTextColor="#9ca3af"
              value={email}
              onChangeText={setEmail}
              autoCapitalize="none"
              keyboardType="email-address"
              editable={!loading}
            />
          </View>

          <View>
            <Text className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Password
            </Text>
            <TextInput
              className="bg-white dark:bg-gray-900 border border-gray-300 dark:border-gray-700 rounded-xl px-4 py-3 text-gray-900 dark:text-white"
              placeholder="••••••••"
              placeholderTextColor="#9ca3af"
              value={password}
              onChangeText={setPassword}
              secureTextEntry
              editable={!loading}
            />
            <Text className="text-xs text-gray-500 dark:text-gray-400 mt-1">
              At least 6 characters
            </Text>
          </View>

          {/* Nickname Input (Only for Sign Up) */}
          {isSignUp && (
            <View>
              <Text className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Nickname
              </Text>
              <TextInput
                className="bg-white dark:bg-gray-900 border border-gray-300 dark:border-gray-700 rounded-xl px-4 py-3 text-gray-900 dark:text-white"
                placeholder="Enter your nickname"
                placeholderTextColor="#9ca3af"
                value={nickname}
                onChangeText={setNickname}
                maxLength={30}
                editable={!loading}
              />
              <Text className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                This will be displayed in groups
              </Text>
            </View>
          )}

          {/* Invite Code Input (Only for Sign Up) */}
          {isSignUp && (
            <View>
              <Text className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Invite Code <Text className="text-gray-400 text-xs">(Optional)</Text>
              </Text>
              <TextInput
                className="bg-white dark:bg-gray-900 border border-gray-300 dark:border-gray-700 rounded-xl px-4 py-3 text-gray-900 dark:text-white uppercase"
                placeholder="Enter invite code"
                placeholderTextColor="#9ca3af"
                value={inviteCode}
                onChangeText={(text) => setInviteCode(text.toUpperCase().trim().slice(0, 6))}
                autoCapitalize="characters"
                maxLength={6}
                editable={!loading}
              />
              <Text className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                Enter the 6-digit code shared by the group owner
              </Text>
            </View>
          )}

          {/* Submit Button */}
          <Pressable
            onPress={handleAuth}
            disabled={loading}
            className={`bg-primary rounded-xl py-4 items-center mt-6 ${
              loading ? 'opacity-50' : 'active:opacity-70'
            }`}
          >
            {loading ? (
              <ActivityIndicator color="white" />
            ) : (
              <Text className="text-white font-semibold text-base">
                {isSignUp ? 'Sign Up' : 'Sign In'}
              </Text>
            )}
          </Pressable>

          {/* Toggle Sign Up / Sign In */}
          <View className="flex-row justify-center items-center mt-4">
            <Text className="text-gray-600 dark:text-gray-400">
              {isSignUp ? 'Already have an account?' : "Don't have an account?"}
            </Text>
            <Pressable onPress={() => setIsSignUp(!isSignUp)} disabled={loading}>
              <Text className="text-primary font-semibold ml-1">
                {isSignUp ? 'Sign In' : 'Sign Up'}
              </Text>
            </Pressable>
          </View>
        </View>

        {/* Footer */}
        <View className="mt-12">
          <Text className="text-xs text-gray-500 dark:text-gray-400 text-center">
            By continuing, you agree to our Terms of Service and Privacy Policy
          </Text>
        </View>
      </View>
    </KeyboardAvoidingView>
  );
}
