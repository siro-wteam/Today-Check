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
import { Users } from 'lucide-react-native';
import { colors, borderRadius, shadows } from '@/constants/colors';
import { ModalCloseButton } from './ModalCloseButton';

interface CreateGroupModalProps {
  visible: boolean;
  onClose: () => void;
  onCreate: (name: string) => void;
}

export function CreateGroupModal({ visible, onClose, onCreate }: CreateGroupModalProps) {
  const [groupName, setGroupName] = useState('');

  const handleCreate = () => {
    if (!groupName.trim()) {
      showToast('error', 'Required', 'Please enter a group name');
      return;
    }

    onCreate(groupName.trim());
    setGroupName('');
    onClose();
  };

  const handleCancel = () => {
    setGroupName('');
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

                {/* Action Buttons */}
                <View style={styles.actions}>
                  <Pressable
                    onPress={handleCancel}
                    style={[styles.button, styles.cancelButton]}
                  >
                    <Text style={styles.cancelButtonText}>Cancel</Text>
                  </Pressable>

                  <Pressable
                    onPress={handleCreate}
                    style={[styles.button, styles.createButton, !groupName.trim() && styles.buttonDisabled]}
                    disabled={!groupName.trim()}
                  >
                    <Text style={styles.createButtonText}>Create</Text>
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
