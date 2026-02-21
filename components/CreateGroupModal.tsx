import { useEffect, useState } from 'react';
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
import { Users } from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, borderRadius, shadows } from '@/constants/colors';
import { ModalCloseButton } from './ModalCloseButton';

interface CreateGroupModalProps {
  visible: boolean;
  onClose: () => void;
  /** Must return { success, error? }. Modal stays open until resolved; on failure, error is shown in modal and via toast. */
  onCreate: (name: string) => void | Promise<{ success: boolean; error?: string }>;
  canCreateGroup?: boolean;
  limitMessage?: string;
}

export function CreateGroupModal({ visible, onClose, onCreate, canCreateGroup = true, limitMessage }: CreateGroupModalProps) {
  const insets = useSafeAreaInsets();
  const [groupName, setGroupName] = useState('');
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (visible) setSubmitError(null);
  }, [visible]);

  const handleCreate = async () => {
    if (!groupName.trim()) {
      showToast('error', 'Required', 'Please enter a group name');
      return;
    }
    if (!canCreateGroup) {
      showToast('error', 'Limit', limitMessage ?? 'Free plan: max 2 groups. Upgrade to add more.');
      return;
    }

    setSubmitError(null);
    setIsSubmitting(true);
    try {
      const result = await Promise.resolve(onCreate(groupName.trim()));
      const success = result && typeof result === 'object' && (result as { success?: boolean }).success !== false;
      const errorMsg = result && typeof result === 'object' ? (result as { error?: string }).error : undefined;

      if (success) {
        setGroupName('');
        setSubmitError(null);
        onClose();
      } else {
        const message = errorMsg || 'Failed to create group';
        setSubmitError(message);
        showToast('error', 'Error', message);
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to create group';
      setSubmitError(message);
      showToast('error', 'Error', message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCancel = () => {
    setGroupName('');
    setSubmitError(null);
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
            <View style={[styles.modalContent, { paddingBottom: Math.max(insets.bottom, 24) }]}>
              {/* Header */}
              <View style={styles.header}>
                <Text style={styles.headerTitle}>Create Group</Text>
                <ModalCloseButton onPress={handleCancel} />
              </View>

              <View style={styles.content}>
                {/* Group Icon Preview */}
                <View style={styles.iconPreview}>
                  <View style={styles.iconContainer}>
                    <Users size={40} color={colors.primary} strokeWidth={2} />
                  </View>
                </View>

                {/* Group Name Input */}
                <View style={styles.inputContainer}>
                  <Text style={styles.label}>Group Name</Text>
                  <TextInput
                    style={styles.input}
                    placeholder="Enter group name"
                    placeholderTextColor={colors.textSub}
                    value={groupName}
                    onChangeText={setGroupName}
                    autoFocus
                    maxLength={30}
                  />
                  <Text style={styles.charCount}>
                    {groupName.length}/30
                  </Text>
                </View>

                {limitMessage && !canCreateGroup && (
                  <Text style={styles.limitHint}>{limitMessage}</Text>
                )}
                {submitError ? (
                  <Text style={styles.errorText}>{submitError}</Text>
                ) : null}
                {/* Action Buttons */}
                <View style={styles.actions}>
                  <Pressable
                    onPress={handleCancel}
                    style={[styles.button, styles.cancelButton]}
                    disabled={isSubmitting}
                  >
                    <Text style={styles.cancelButtonText}>Cancel</Text>
                  </Pressable>

                  <Pressable
                    onPress={handleCreate}
                    style={[styles.button, styles.createButton, (!groupName.trim() || !canCreateGroup || isSubmitting) && styles.buttonDisabled]}
                    disabled={!groupName.trim() || !canCreateGroup || isSubmitting}
                  >
                    <Text style={styles.createButtonText}>{isSubmitting ? 'Creating…' : 'Create'}</Text>
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
    paddingVertical: 12,
    fontSize: 16,
    color: colors.textMain,
    height: 48,
  },
  charCount: {
    fontSize: 12,
    color: colors.textSub,
    textAlign: 'right',
    marginTop: 4,
  },
  limitHint: {
    fontSize: 13,
    color: colors.textSub,
    marginBottom: 12,
    textAlign: 'center',
  },
  errorText: {
    fontSize: 14,
    color: colors.error,
    marginBottom: 12,
    textAlign: 'center',
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
  createButton: {
    backgroundColor: colors.primary,
  },
  buttonDisabled: {
    opacity: 0.5,
  },
  createButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.primaryForeground,
  },
});
