import { PRIVACY_POLICY_LAST_UPDATED, PRIVACY_POLICY_SECTIONS } from '@/constants/privacy-policy';
import { colors, spacing } from '@/constants/colors';
import { Stack } from 'expo-router';
import { ScrollView, Text, View } from 'react-native';

/**
 * Privacy Policy page. Available at /privacy on web.
 * Set EXPO_PUBLIC_PRIVACY_POLICY_URL to your deployed web URL + '/privacy' for native and App Store.
 */
export default function PrivacyPage() {
  return (
    <>
      <Stack.Screen options={{ title: 'Privacy Policy', headerBackTitle: 'Back' }} />
      <ScrollView
        style={{ flex: 1, backgroundColor: colors.background }}
        contentContainerStyle={{ padding: spacing.lg, paddingBottom: spacing.xxl * 2 }}
      >
        <Text style={{ fontSize: 22, fontWeight: '700', color: colors.textMain, marginBottom: 8 }}>
          Privacy Policy
        </Text>
        <Text style={{ fontSize: 14, color: colors.textSub, marginBottom: spacing.xl }}>
          Last updated: {PRIVACY_POLICY_LAST_UPDATED}
        </Text>
        {PRIVACY_POLICY_SECTIONS.map((section, index) => (
          <View key={index} style={{ marginBottom: spacing.xl }}>
            <Text style={{ fontSize: 16, fontWeight: '600', color: colors.textMain, marginBottom: 8 }}>
              {section.title}
            </Text>
            <Text
              style={{
                fontSize: 14,
                color: colors.textSub,
                lineHeight: 22,
              }}
            >
              {section.body}
            </Text>
          </View>
        ))}
      </ScrollView>
    </>
  );
}
