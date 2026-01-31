import { ModalCloseButton } from '@/components/ModalCloseButton';
import { borderRadius, colors, spacing } from '@/constants/colors';
import { Bell, BellOff, Vibrate, VibrateOff, Volume2, VolumeX } from 'lucide-react-native';
import { Modal, SafeAreaView, Switch, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNotificationSettings } from '../lib/contexts/NotificationSettingsContext';

interface NotificationSettingsModalProps {
  visible: boolean;
  onClose: () => void;
}

export function NotificationSettingsModal({ visible, onClose }: NotificationSettingsModalProps) {
  const insets = useSafeAreaInsets();
  const {
    notificationsEnabled,
    soundEnabled,
    vibrationEnabled,
    toggleNotifications,
    toggleSound,
    toggleVibration,
  } = useNotificationSettings();

  const handleNotificationsToggle = (value: boolean) => {
    toggleNotifications(value);
  };

  const handleSoundToggle = (value: boolean) => {
    toggleSound(value);
  };

  const handleVibrationToggle = (value: boolean) => {
    toggleVibration(value);
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
            Notification Settings
          </Text>
          <View style={{ flex: 1, alignItems: 'flex-end' }}>
            <ModalCloseButton onPress={onClose} />
          </View>
        </View>

        {/* Settings Content */}
        <View style={{ flex: 1, padding: spacing.lg }}>
          {/* Main Notification Toggle */}
          <View style={{
            backgroundColor: colors.card,
            borderRadius: borderRadius.xl,
            padding: spacing.lg,
            marginBottom: spacing.lg,
            borderWidth: 1,
            borderColor: colors.border,
          }}>
            <View style={{
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'space-between',
            }}>
              <View style={{
                flexDirection: 'row',
                alignItems: 'center',
                flex: 1,
              }}>
                <View style={{
                  width: 44,
                  height: 44,
                  borderRadius: borderRadius.full,
                  backgroundColor: notificationsEnabled ? colors.primary : colors.gray100,
                  alignItems: 'center',
                  justifyContent: 'center',
                  marginRight: spacing.md,
                }}>
                  {notificationsEnabled ? (
                    <Bell size={24} color={colors.primaryForeground} strokeWidth={2} />
                  ) : (
                    <BellOff size={24} color={colors.textSub} strokeWidth={2} />
                  )}
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={{
                    fontSize: 16,
                    fontWeight: '600',
                    color: colors.textMain,
                    marginBottom: spacing.xs,
                  }}>
                    Notifications
                  </Text>
                  <Text style={{
                    fontSize: 14,
                    color: colors.textSub,
                  }}>
                    {notificationsEnabled 
                      ? 'All notifications are enabled' 
                      : 'All notifications are disabled'
                    }
                  </Text>
                </View>
              </View>
              <Switch
                value={notificationsEnabled}
                onValueChange={handleNotificationsToggle}
                trackColor={{ false: colors.gray200, true: colors.primary }}
                thumbColor={colors.primaryForeground}
                ios_backgroundColor={colors.gray200}
              />
            </View>
          </View>

          {/* Sound and Vibration Settings */}
          <View style={{
            backgroundColor: colors.card,
            borderRadius: borderRadius.xl,
            borderWidth: 1,
            borderColor: colors.border,
            overflow: 'hidden',
          }}>
            {/* Sound Setting */}
            <View style={{
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: spacing.lg,
              opacity: notificationsEnabled ? 1 : 0.5,
            }}>
              <View style={{
                flexDirection: 'row',
                alignItems: 'center',
                flex: 1,
              }}>
                <View style={{
                  width: 44,
                  height: 44,
                  borderRadius: borderRadius.full,
                  backgroundColor: soundEnabled ? colors.success : colors.gray100,
                  alignItems: 'center',
                  justifyContent: 'center',
                  marginRight: spacing.md,
                }}>
                  {soundEnabled ? (
                    <Volume2 size={24} color={colors.primaryForeground} strokeWidth={2} />
                  ) : (
                    <VolumeX size={24} color={colors.textSub} strokeWidth={2} />
                  )}
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={{
                    fontSize: 16,
                    fontWeight: '500',
                    color: colors.textMain,
                    marginBottom: spacing.xs,
                  }}>
                    Sound
                  </Text>
                  <Text style={{
                    fontSize: 14,
                    color: colors.textSub,
                  }}>
                    {soundEnabled ? 'Sound effects enabled' : 'Sound effects disabled'}
                  </Text>
                </View>
              </View>
              <Switch
                value={soundEnabled}
                onValueChange={handleSoundToggle}
                disabled={!notificationsEnabled}
                trackColor={{ false: colors.gray200, true: colors.success }}
                thumbColor={colors.primaryForeground}
                ios_backgroundColor={colors.gray200}
              />
            </View>

            {/* Divider */}
            <View style={{
              height: 1,
              backgroundColor: colors.border,
              marginHorizontal: spacing.lg,
            }} />

            {/* Vibration Setting */}
            <View style={{
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: spacing.lg,
              opacity: notificationsEnabled ? 1 : 0.5,
            }}>
              <View style={{
                flexDirection: 'row',
                alignItems: 'center',
                flex: 1,
              }}>
                <View style={{
                  width: 44,
                  height: 44,
                  borderRadius: borderRadius.full,
                  backgroundColor: vibrationEnabled ? colors.primary : colors.gray100,
                  alignItems: 'center',
                  justifyContent: 'center',
                  marginRight: spacing.md,
                }}>
                  {vibrationEnabled ? (
                    <Vibrate size={24} color={colors.primaryForeground} strokeWidth={2} />
                  ) : (
                    <VibrateOff size={24} color={colors.textSub} strokeWidth={2} />
                  )}
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={{
                    fontSize: 16,
                    fontWeight: '500',
                    color: colors.textMain,
                    marginBottom: spacing.xs,
                  }}>
                    Vibration
                  </Text>
                  <Text style={{
                    fontSize: 14,
                    color: colors.textSub,
                  }}>
                    {vibrationEnabled ? 'Vibration enabled' : 'Vibration disabled'}
                  </Text>
                </View>
              </View>
              <Switch
                value={vibrationEnabled}
                onValueChange={handleVibrationToggle}
                disabled={!notificationsEnabled}
                trackColor={{ false: colors.gray200, true: colors.primary }}
                thumbColor={colors.primaryForeground}
                ios_backgroundColor={colors.gray200}
              />
            </View>
          </View>

          {/* Info Section */}
          <View style={{
            marginTop: spacing.xl,
            padding: spacing.lg,
            backgroundColor: colors.gray50,
            borderRadius: borderRadius.lg,
          }}>
            <Text style={{
              fontSize: 14,
              color: colors.textSub,
              lineHeight: 20,
            }}>
              💡 When notifications are turned off, you won't receive any alerts for task reminders, group activities, or other app notifications.
            </Text>
          </View>
        </View>
      </SafeAreaView>
    </Modal>
  );
}
