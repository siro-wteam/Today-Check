import { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  Pressable,
  KeyboardAvoidingView,
  Platform,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { useRouter } from 'expo-router';
import { signUp, signIn } from '@/lib/hooks/use-auth';

export default function AuthScreen() {
  const router = useRouter();
  const [isSignUp, setIsSignUp] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  const handleAuth = async () => {
    if (!email || !password) {
      Alert.alert('Error', 'Please fill in all fields');
      return;
    }

    if (password.length < 6) {
      Alert.alert('Error', 'Password must be at least 6 characters');
      return;
    }

    setLoading(true);

    try {
      if (isSignUp) {
        const { data, error } = await signUp(email, password);
        
        if (error) {
          Alert.alert('Sign Up Failed', error.message);
        } else {
          Alert.alert(
            'Success!',
            'Account created successfully. Please check your email to verify your account.',
            [{ text: 'OK', onPress: () => setIsSignUp(false) }]
          );
        }
      } else {
        const { data, error } = await signIn(email, password);
        
        if (error) {
          Alert.alert('Sign In Failed', error.message);
        } else {
          // Navigation will be handled by the auth state change listener
          router.replace('/(tabs)');
        }
      }
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Something went wrong');
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
            Simple like a To-do list, but managed like Jira
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

          {/* Submit Button */}
          <Pressable
            onPress={handleAuth}
            disabled={loading}
            className={`bg-blue-600 rounded-xl py-4 items-center mt-6 ${
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
              <Text className="text-blue-600 font-semibold ml-1">
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
