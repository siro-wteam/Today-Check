import { useState, useEffect } from 'react';
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
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, borderRadius, shadows } from '@/constants/colors';
import { ModalCloseButton } from './ModalCloseButton';

interface EditNicknameModalProps {
  visible: boolean;
  currentNickname: string;
  onClose: () => void;
  onSave: (newNickname: string) => Promise<{ success: boolean; error?: string }>;
}

export function EditNicknameModal({
  visible,
  currentNickname,
  onClose,
  onSave,
}: EditNicknameModalProps) {
  const insets = useSafeAreaInsets();
  const [nickname, setNickname] = useState(currentNickname);
  const [loading, setLoading] = useState(false);

  // Update nickname when currentNickname changes
  useEffect(() => {
    setNickname(currentNickname);
  }, [currentNickname]);

  const handleSave = async () => {
    const trimmedNickname = nickname.trim();
    
    if (!trimmedNickname) {
      showToast('error', 'Error', 'Nickname cannot be empty');
      return;
    }

    if (trimmedNickname === currentNickname) {
      onClose();
      return;
    }

    setLoading(true);
    try {
      const { success, error } = await onSave(trimmedNickname);
      
      if (success) {
        onClose();
      } else {
        showToast('error', 'Error', error || 'Failed to update nickname');
      }
    } catch (err: any) {
      showToast('error', 'Error', err.message || 'An error occurred');
    } finally {
      setLoading(false);
    }
  };

  const handleCancel = () => {
    setNickname(currentNickname);
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
                <Text style={styles.headerTitle}>Edit Nickname</Text>
                <ModalCloseButton onPress={handleCancel} />
              </View>

              <View style={styles.content}>
                {/* Nickname Input */}
                <View style={styles.inputContainer}>
                  <Text style={styles.label}>Nickname</Text>
                  <TextInput
                    style={styles.input}
                    placeholder="Enter your nickname"
                    placeholderTextColor={colors.textSub}
                    value={nickname}
                    onChangeText={setNickname}
                    autoFocus
                    maxLength={30}
                    editable={!loading}
                  />
                  <Text style={styles.charCount}>
                    {nickname.length}/30
                  </Text>
                </View>

                {/* Action Buttons */}
                <View style={styles.actions}>
                  <Pressable
                    onPress={handleCancel}
                    style={[styles.button, styles.cancelButton]}
                    disabled={loading}
                  >
                    <Text style={styles.cancelButtonText}>Cancel</Text>
                  </Pressable>

                  <Pressable
                    onPress={handleSave}
                    style={[
                      styles.button,
                      styles.saveButton,
                      (!nickname.trim() || nickname.trim() === currentNickname || loading) && styles.buttonDisabled,
                    ]}
                    disabled={!nickname.trim() || nickname.trim() === currentNickname || loading}
                  >
                    <Text style={styles.saveButtonText}>
                      {loading ? 'Saving...' : 'Save'}
                    </Text>
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
  saveButton: {
    backgroundColor: colors.primary,
  },
  buttonDisabled: {
    opacity: 0.5,
  },
  saveButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.primaryForeground,
  },
});
