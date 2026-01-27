import { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  Pressable,
  Modal,
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
} from 'react-native';
import { showToast } from '@/utils/toast';
import { UserPlus } from 'lucide-react-native';
import { colors, borderRadius, shadows } from '@/constants/colors';
import { ModalCloseButton } from './ModalCloseButton';

interface JoinGroupModalProps {
  visible: boolean;
  onClose: () => void;
  onJoin: (inviteCode: string) => void;
}

export function JoinGroupModal({ visible, onClose, onJoin }: JoinGroupModalProps) {
  const [inviteCode, setInviteCode] = useState('');

  const handleJoin = () => {
    const code = inviteCode.trim().toUpperCase();
    
    if (!code) {
      showToast('error', 'Required', 'Please enter an invite code');
      return;
    }

    if (code.length !== 6) {
      showToast('error', 'Invalid Code', 'Invite code must be 6 characters');
      return;
    }

    onJoin(code);
    setInviteCode('');
    onClose();
  };

  const handleCancel = () => {
    setInviteCode('');
    onClose();
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={handleCancel}
    >
      <Pressable
        style={styles.overlay}
        onPress={handleCancel}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        >
          <Pressable onPress={(e) => e.stopPropagation()}>
            <View style={styles.modalContent}>
              {/* Header */}
              <View style={styles.header}>
                <Text style={styles.headerTitle}>Join Group</Text>
                <ModalCloseButton onPress={handleCancel} />
              </View>

              <View style={styles.content}>
                {/* Icon Preview */}
                <View style={styles.iconPreview}>
                  <View style={styles.iconContainer}>
                    <UserPlus size={40} color={colors.primary} strokeWidth={2} />
                  </View>
                </View>

                {/* Invite Code Input */}
                <View style={styles.inputContainer}>
                  <Text style={styles.label}>Invite Code</Text>
                  <TextInput
                    style={styles.input}
                    placeholder="Enter invite code"
                    placeholderTextColor={colors.textSub}
                    value={inviteCode}
                    onChangeText={(text) => setInviteCode(text.toUpperCase().slice(0, 8))}
                    autoFocus
                    maxLength={8}
                    autoCapitalize="characters"
                    textAlign="center"
                  />
                  <Text style={styles.hint}>
                    Enter the code shared by the group owner
                  </Text>
                </View>

                {/* Action Buttons */}
                <View style={styles.actions}>
                  <Pressable
                    onPress={handleCancel}
                    style={[styles.button, styles.cancelButton]}
                  >
                    <Text style={styles.cancelButtonText}>Cancel</Text>
                  </Pressable>

                  <Pressable
                    onPress={handleJoin}
                    style={[styles.button, styles.joinButton, (!inviteCode.trim() || inviteCode.length !== 6) && styles.buttonDisabled]}
                    disabled={!inviteCode.trim() || inviteCode.length !== 6}
                  >
                    <Text style={styles.joinButtonText}>Join</Text>
                  </Pressable>
                </View>
              </View>
            </View>
          </Pressable>
        </KeyboardAvoidingView>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: colors.card,
    borderTopLeftRadius: borderRadius.xl,
    borderTopRightRadius: borderRadius.xl,
    paddingHorizontal: 24,
    paddingTop: 24,
    paddingBottom: Platform.OS === 'ios' ? 40 : 24,
    ...shadows.lg,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 24,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: colors.textMain,
  },
  closeButton: {
    width: 32,
    height: 32,
    borderRadius: borderRadius.full,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.gray100,
  },
  content: {
    paddingTop: 8,
  },
  iconPreview: {
    alignItems: 'center',
    marginBottom: 24,
  },
  iconContainer: {
    width: 80,
    height: 80,
    borderRadius: borderRadius.xl,
    backgroundColor: colors.primary + '1A',
    alignItems: 'center',
    justifyContent: 'center',
  },
  inputContainer: {
    marginBottom: 24,
  },
  label: {
    fontSize: 14,
    fontWeight: '500',
    color: colors.textSub,
    marginBottom: 8,
  },
  input: {
    backgroundColor: colors.gray50,
    borderRadius: borderRadius.md,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 20,
    fontWeight: '700',
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    color: colors.textMain,
    height: 56,
    letterSpacing: 4,
    textTransform: 'uppercase',
  },
  hint: {
    fontSize: 12,
    color: colors.textSub,
    textAlign: 'center',
    marginTop: 8,
  },
  actions: {
    flexDirection: 'row',
    marginTop: 8,
  },
  button: {
    flex: 1,
    height: 48,
    borderRadius: borderRadius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cancelButton: {
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: colors.border,
    marginRight: 12,
  },
  cancelButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.textMain,
  },
  joinButton: {
    backgroundColor: colors.primary,
  },
  buttonDisabled: {
    opacity: 0.5,
  },
  joinButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.primaryForeground,
  },
});
