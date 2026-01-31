import { ModalCloseButton } from '@/components/ModalCloseButton';
import { borderRadius, colors, spacing } from '@/constants/colors';
import { Info, Shield } from 'lucide-react-native';
import { Linking, Modal, Pressable, SafeAreaView, ScrollView, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

interface AboutModalProps {
  visible: boolean;
  onClose: () => void;
}

export function AboutModal({ visible, onClose }: AboutModalProps) {
  const insets = useSafeAreaInsets();

  const handlePrivacyPolicyPress = () => {
    Linking.openURL('https://example.com/privacy-policy');
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }}>
        {/* Header */}
        <View style={{
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          paddingHorizontal: spacing.lg,
          paddingVertical: spacing.md,
          borderBottomWidth: 1,
          borderBottomColor: colors.border,
        }}>
          <View style={{ flex: 1 }} />
          <Text style={{
            fontSize: 18,
            fontWeight: '600',
            color: colors.textMain,
            textAlign: 'center',
          }}>
            About
          </Text>
          <View style={{ flex: 1, alignItems: 'flex-end' }}>
            <ModalCloseButton onPress={onClose} />
          </View>
        </View>

        {/* Content */}
        <ScrollView style={{ flex: 1, padding: spacing.lg }}>
          {/* App Logo and Version */}
          <View style={{
            alignItems: 'center',
            marginBottom: spacing.xl,
          }}>
            <View style={{
              width: 80,
              height: 80,
              borderRadius: borderRadius['2xl'],
              backgroundColor: colors.primary,
              alignItems: 'center',
              justifyContent: 'center',
              marginBottom: spacing.md,
            }}>
              <Text style={{ fontSize: 32, color: colors.primaryForeground, fontWeight: 'bold' }}>
                TC
              </Text>
            </View>
            <Text style={{
              fontSize: 16,
              fontWeight: '600',
              color: colors.textMain,
              marginBottom: spacing.xs,
            }}>
              TodayCheck
            </Text>
            <Text style={{
              fontSize: 14,
              color: colors.textSub,
            }}>
              Version 1.0.0
            </Text>
          </View>

          {/* App Info */}
          <View style={{
            backgroundColor: colors.card,
            borderRadius: borderRadius.xl,
            padding: spacing.lg,
            marginBottom: spacing.xl,
            borderWidth: 1,
            borderColor: colors.border,
          }}>
            <View style={{
              flexDirection: 'row',
              alignItems: 'center',
              marginBottom: spacing.md,
            }}>
              <View style={{
                width: 40,
                height: 40,
                borderRadius: borderRadius.full,
                backgroundColor: colors.primary,
                alignItems: 'center',
                justifyContent: 'center',
                marginRight: spacing.md,
              }}>
                <Info size={20} color={colors.primaryForeground} strokeWidth={2} />
              </View>
              <Text style={{
                fontSize: 16,
                fontWeight: '600',
                color: colors.textMain,
              }}>
              Achieve more, together.
              </Text>
            </View>
            
            <Text style={{
              fontSize: 14,
              color: colors.textSub,
              lineHeight: 20,
              marginBottom: spacing.md,
            }}>
              TodayCheck isn't just about tracking tasks. It's about growing with your friends and family. 
              Create groups, share your progress, and keep each other motivated.
            </Text>

            <Text style={{
              fontSize: 14,
              color: colors.textSub,
              lineHeight: 20,
            }}>
              Join forces with loved ones to achieve your goals together and celebrate every success as a team.
            </Text>
          </View>

          {/* Features */}
          <View style={{
            backgroundColor: colors.card,
            borderRadius: borderRadius.xl,
            padding: spacing.lg,
            marginBottom: spacing.xl,
            borderWidth: 1,
            borderColor: colors.border,
          }}>
            <Text style={{
              fontSize: 16,
              fontWeight: '600',
              color: colors.textMain,
              marginBottom: spacing.md,
            }}>
              Key Features
            </Text>
            
            <View style={{ marginBottom: spacing.sm }}>
              <Text style={{ fontSize: 14, color: colors.textMain, marginBottom: spacing.xs }}>
                • Group Collaboration
              </Text>
              <Text style={{ fontSize: 14, color: colors.textSub, lineHeight: 18 }}>
                Create groups with friends and family to achieve goals together
              </Text>
            </View>
            
            <View style={{ marginBottom: spacing.sm }}>
              <Text style={{ fontSize: 14, color: colors.textMain, marginBottom: spacing.xs }}>
                • Shared Progress
              </Text>
              <Text style={{ fontSize: 14, color: colors.textSub, lineHeight: 18 }}>
                Track group progress and celebrate collective achievements
              </Text>
            </View>
            
            <View style={{ marginBottom: spacing.sm }}>
              <Text style={{ fontSize: 14, color: colors.textMain, marginBottom: spacing.xs }}>
                • Mutual Motivation
              </Text>
              <Text style={{ fontSize: 14, color: colors.textSub, lineHeight: 18 }}>
                Keep each other inspired and accountable on your journey
              </Text>
            </View>
            
            <View>
              <Text style={{ fontSize: 14, color: colors.textMain, marginBottom: spacing.xs }}>
                • Smart Notifications
              </Text>
              <Text style={{ fontSize: 14, color: colors.textSub, lineHeight: 18 }}>
                Get timely reminders for both personal and group tasks
              </Text>
            </View>
          </View>
        </ScrollView>

        {/* Footer */}
        <View style={{
          paddingHorizontal: spacing.lg,
          paddingVertical: spacing.lg,
          borderTopWidth: 1,
          borderTopColor: colors.border,
        }}>
          <View style={{
            flexDirection: 'row',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: spacing.md,
          }}>
            <Text style={{
              fontSize: 12,
              color: colors.textSub,
            }}>
              © 2024 TodayCheck
            </Text>
            <View style={{
              flexDirection: 'row',
              alignItems: 'center',
            }}>
              <Shield size={16} color={colors.textSub} style={{ marginRight: spacing.xs }} />
              <Pressable onPress={handlePrivacyPolicyPress}>
                <Text style={{
                  fontSize: 12,
                  color: colors.primary,
                  textDecorationLine: 'underline',
                }}>
                  Privacy Policy
                </Text>
              </Pressable>
            </View>
          </View>
        </View>
      </SafeAreaView>
    </Modal>
  );
}
