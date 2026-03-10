/**
 * Shared confirm + execute logic for group delete and leave.
 * Used by group-detail and group list so one change applies everywhere.
 */

import * as Haptics from 'expo-haptics';
import { useCallback } from 'react';
import { Alert, Platform } from 'react-native';
import { showToast } from '@/utils/toast';
import type { Group } from '@/lib/types';

type DeleteGroupFn = (groupId: string, userId: string) => Promise<{ success: boolean; error?: string }>;
type LeaveGroupFn = (groupId: string, userId: string) => Promise<{ success: boolean; error?: string }>;

export function useGroupDeleteLeave(
  userId: string | undefined,
  deleteGroup: DeleteGroupFn,
  leaveGroup: LeaveGroupFn,
  options?: {
    onSuccessDelete?: (group: Group) => void;
    onSuccessLeave?: (group: Group) => void;
    onCancelDelete?: (group: Group) => void;
    onCancelLeave?: (group: Group) => void;
  }
) {
  const confirmDeleteGroup = useCallback(
    (group: Group) => {
      if (!userId || group.ownerId !== userId) return;

      if (Platform.OS === 'web') {
        const confirmed = window.confirm(
          'Are you sure you want to delete this group? This action cannot be undone.'
        );
        if (!confirmed) {
          options?.onCancelDelete?.(group);
          return;
        }
        deleteGroup(group.id, userId).then(({ success, error }) => {
          if (success) {
            showToast('success', 'Group deleted');
            options?.onSuccessDelete?.(group);
          } else {
            showToast('error', 'Error', error || 'Failed to delete group. Please try again.');
          }
        }).catch((err: any) => {
          showToast('error', 'Error', err.message || 'An error occurred while deleting the group.');
        });
        return;
      }

      Alert.alert(
        'Delete Group',
        'Are you sure you want to delete this group? This action cannot be undone.',
        [
          { text: 'Cancel', style: 'cancel', onPress: () => options?.onCancelDelete?.(group) },
          {
            text: 'Delete',
            style: 'destructive',
            onPress: async () => {
              try {
                await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
                const { success, error } = await deleteGroup(group.id, userId);
                if (success) {
                  showToast('success', 'Group deleted');
                  options?.onSuccessDelete?.(group);
                } else {
                  showToast('error', 'Error', error || 'Failed to delete group. Please try again.');
                }
              } catch (err: any) {
                showToast('error', 'Error', err.message || 'An error occurred while deleting the group.');
              }
            },
          },
        ]
      );
    },
    [userId, deleteGroup, options]
  );

  const confirmLeaveGroup = useCallback(
    (group: Group) => {
      if (!userId || group.ownerId === userId) return;

      if (Platform.OS === 'web') {
        const confirmed = window.confirm('Are you sure you want to leave this group?');
        if (!confirmed) {
          options?.onCancelLeave?.(group);
          return;
        }
        leaveGroup(group.id, userId).then(({ success, error }) => {
          if (success) {
            showToast('success', 'Left group');
            options?.onSuccessLeave?.(group);
          } else {
            showToast('error', 'Error', error || 'Failed to leave group. Please try again.');
          }
        }).catch((err: any) => {
          showToast('error', 'Error', err.message || 'An error occurred while leaving the group.');
        });
        return;
      }

      Alert.alert(
        'Leave Group',
        'Are you sure you want to leave this group?',
        [
          { text: 'Cancel', style: 'cancel', onPress: () => options?.onCancelLeave?.(group) },
          {
            text: 'Leave',
            style: 'destructive',
            onPress: async () => {
              try {
                await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                const { success, error } = await leaveGroup(group.id, userId);
                if (success) {
                  showToast('success', 'Left group');
                  options?.onSuccessLeave?.(group);
                } else {
                  showToast('error', 'Error', error || 'Failed to leave group. Please try again.');
                }
              } catch (err: any) {
                showToast('error', 'Error', err.message || 'An error occurred while leaving the group.');
              }
            },
          },
        ]
      );
    },
    [userId, leaveGroup, options]
  );

  return { confirmDeleteGroup, confirmLeaveGroup };
}
