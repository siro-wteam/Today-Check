import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import {
  View,
  Text,
  Pressable,
  ScrollView,
  SafeAreaView,
  StyleSheet,
  Platform,
  Alert,
  Share,
  Linking,
  RefreshControl,
  TextInput,
  BackHandler,
  Dimensions,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Copy, Crown, Users, Trash2, LogOut, Share2, Shield, MoreVertical, Edit2, Camera, Image as ImageIcon } from 'lucide-react-native';
import { colors, borderRadius, shadows } from '@/constants/colors';
import { useGroupStore } from '@/lib/stores/useGroupStore';
import { useAuth } from '@/lib/hooks/use-auth';
import * as Haptics from 'expo-haptics';
import { showToast } from '@/utils/toast';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, { runOnJS, useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated';
import * as ImagePicker from 'expo-image-picker';
import { Image } from 'expo-image';
import { uploadGroupImage } from '@/lib/api/groups';

const SCREEN_HEIGHT = Dimensions.get('window').height;
const DRAG_THRESHOLD = 100; // Minimum drag distance to dismiss

export default function GroupDetailScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ groupId: string }>();
  const { user } = useAuth();
  const { 
    currentGroup, 
    groups,
    deleteGroup, 
    leaveGroup, 
    fetchGroupById, 
    setCurrentGroup,
    promoteMember,
    demoteMember,
    updateGroupName,
    kickMember,
    loading,
  } = useGroupStore();
  
  const group = currentGroup;
  const currentUser = group?.members.find((m) => m.id === user?.id);
  // Use myRole from group data, fallback to checking ownerId
  const isOwner = group?.myRole === 'OWNER' || group?.ownerId === user?.id;
  const isAdmin = group?.myRole === 'ADMIN';
  const canManageGroup = isOwner || isAdmin; // OWNER or ADMIN can manage (invite, share, etc.)
  const canManageRoles = isOwner; // Only OWNER can promote/demote members
  const [refreshing, setRefreshing] = useState(false);
  const [isEditingGroupName, setIsEditingGroupName] = useState(false);
  const [editingGroupName, setEditingGroupName] = useState(group?.name || '');
  const [isSavingGroupName, setIsSavingGroupName] = useState(false);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [imageTimestamp, setImageTimestamp] = useState(Date.now());
  
  // Prevent multiple rapid button presses
  const isActioningRef = useRef(false);
  
  // Drag to dismiss animation values
  const translateY = useSharedValue(0);
  const scale = useSharedValue(1);
  const startY = useSharedValue(0);
  const isAtTop = useSharedValue(true);
  
  // Dismiss modal (go back to previous screen)
  const dismissModal = useCallback(() => {
    if (router.canGoBack()) {
      router.back();
    } else {
      // Fallback: navigate to home
      router.replace('/(tabs)/group');
    }
  }, [router]);
  
  // Handle Android back button with zoom-out animation
  useEffect(() => {
    if (Platform.OS !== 'android') return;

    const backHandler = BackHandler.addEventListener('hardwareBackPress', () => {
      // Trigger zoom-out animation
      translateY.value = withSpring(SCREEN_HEIGHT);
      scale.value = withSpring(0.9);
      // Dismiss modal after a short delay to allow animation to start
      setTimeout(() => {
        dismissModal();
      }, 100);
      return true;
    });

    return () => backHandler.remove();
  }, [dismissModal, translateY, scale]);
  
  // Pan gesture handler for drag to dismiss (Native only - Web has pointer capture issues)
  const panGesture = useMemo(
    () => {
      if (Platform.OS === 'web') {
        // Return a no-op gesture for web to avoid pointer capture errors
        return Gesture.Pan().enabled(false);
      }
      return Gesture.Pan()
        .onStart(() => {
          // Store initial position
          startY.value = translateY.value;
        })
        .onUpdate((event) => {
          // Only allow downward drag when at top
          if (event.translationY > 0 && isAtTop.value) {
            translateY.value = startY.value + event.translationY;
            // Scale down slightly as user drags
            scale.value = Math.max(0.95, 1 - event.translationY / 500);
          }
        })
        .onEnd((event) => {
          if (event.translationY > DRAG_THRESHOLD && isAtTop.value) {
            // Dismiss: zoom out and close modal
            translateY.value = withSpring(SCREEN_HEIGHT);
            scale.value = withSpring(0.9);
            runOnJS(dismissModal)();
          } else {
            // Spring back to original position
            translateY.value = withSpring(0);
            scale.value = withSpring(1);
          }
        })
        .activeOffsetY(10)
        .failOffsetX([-50, 50]);
    },
    [dismissModal, isAtTop, startY, translateY, scale]
  );

  // Animated style for drag to dismiss
  const animatedContainerStyle = useAnimatedStyle(() => {
    return {
      transform: [
        { translateY: translateY.value },
        { scale: scale.value },
      ],
    };
  });

  // Track ScrollView scroll position
  const handleScroll = useCallback((event: any) => {
    const offsetY = event.nativeEvent.contentOffset.y;
    isAtTop.value = offsetY <= 0;
  }, [isAtTop]);

  // Fetch group on mount or when groupId changes
  useEffect(() => {
    if (!params.groupId) return;

    // Check if we already have this group in the groups list (from fetchMyGroups)
    // This ensures we use the latest data from the groups list if available
    const existingGroup = groups.find((g) => g.id === params.groupId);
    
    if (existingGroup) {
      // Use the group from the list (which is already up-to-date from fetchMyGroups)
      // This syncs currentGroup with the latest data from groups array
      setCurrentGroup(existingGroup);
    } else if (params.groupId !== group?.id) {
      // Only fetch if we don't have it in the list
      fetchGroupById(params.groupId, user?.id);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params.groupId, user?.id, groups]);

  // Update editingGroupName when group name changes
  useEffect(() => {
    if (group?.name) {
      setEditingGroupName(group.name);
    }
  }, [group?.name]);

  // Handle navigation when kicked from group
  useEffect(() => {
    if (!params.groupId || !user?.id) return;

    // Set up callback for when user is kicked
    useGroupStore.setState({
      onKickedFromGroup: (groupId: string) => {
        if (groupId === params.groupId) {
          // User was kicked from the current group, navigate back
          router.back();
        }
      },
    });

    return () => {
      // Cleanup callback on unmount
      useGroupStore.setState({ onKickedFromGroup: null });
    };
  }, [params.groupId, user?.id, router]);

  // Pull-to-Refresh handler
  const onRefresh = useCallback(async () => {
    if (!params.groupId) return;
    
    setRefreshing(true);
    try {
      await fetchGroupById(params.groupId, user?.id);
    } finally {
      setRefreshing(false);
    }
  }, [params.groupId, user?.id, fetchGroupById]);

  const handleCopyInviteCode = async () => {
    if (!group || !canManageGroup) return; // Only owner/admin can copy invite code
    
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    
    if (Platform.OS === 'web') {
      // Web: Use Clipboard API with fallback
      try {
        if (navigator.clipboard && navigator.clipboard.writeText) {
          await navigator.clipboard.writeText(group.inviteCode);
          showToast('success', 'Invite code copied!');
        } else {
          // Fallback for older browsers or when clipboard API is not available
          const textArea = document.createElement('textarea');
          textArea.value = group.inviteCode;
          textArea.style.position = 'fixed';
          textArea.style.left = '-9999px';
          textArea.style.top = '0';
          document.body.appendChild(textArea);
          textArea.focus();
          textArea.select();
          
          try {
            const successful = document.execCommand('copy');
            document.body.removeChild(textArea);
            if (successful) {
              showToast('success', 'Invite code copied!');
            } else {
              throw new Error('execCommand failed');
            }
          } catch (err) {
            document.body.removeChild(textArea);
            throw err;
          }
        }
      } catch (err) {
        console.error('Failed to copy:', err);
        showToast('info', 'Invite Code', `${group.inviteCode} — copy manually`);
      }
    } else {
      // React Native: Try to use Clipboard API if available
      try {
        // Check if Clipboard is available (from @react-native-clipboard/clipboard)
        let Clipboard;
        try {
          Clipboard = require('@react-native-clipboard/clipboard').default;
        } catch {
          // Package not installed, use fallback
          throw new Error('Clipboard package not available');
        }
        
        Clipboard.setString(group.inviteCode);
        showToast('success', 'Invite code copied to clipboard!');
      } catch (err) {
        showToast('info', 'Invite Code', `${group.inviteCode} — copy manually`);
      }
    }
  };

  const handleShareInvite = async () => {
    if (!group || !canManageGroup) return; // Only owner/admin can share invite code

    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

    // Create invite message
    const appStoreLink = Platform.OS === 'ios' 
      ? 'https://apps.apple.com/app/todaycheck' // Replace with actual App Store link
      : 'https://play.google.com/store/apps/details?id=com.todaycheck'; // Replace with actual Play Store link
    
    const message = `[Today-Check] '${group.name}' 그룹에 초대되었습니다.\n\n앱 가입 시 코드 **${group.inviteCode}**를 입력하세요.\n\n다운로드: ${appStoreLink}`;

    try {
      if (Platform.OS === 'web') {
        // Web: Use Web Share API if available, otherwise copy to clipboard
        if (navigator.share) {
          await navigator.share({
            title: `${group.name} 그룹 초대`,
            text: message,
          });
        } else {
          await navigator.clipboard.writeText(message);
          showToast('success', '초대 메시지가 클립보드에 복사되었습니다!');
        }
      } else {
        // React Native: Use Share API
        const result = await Share.share({
          message,
          title: `${group.name} 그룹 초대`,
        });

        if (result.action === Share.sharedAction) {
          // Shared successfully
        } else if (result.action === Share.dismissedAction) {
          // Dismissed
        }
      }
    } catch (error: any) {
      console.error('Error sharing:', error);
      if (error.message !== 'User did not share') {
        showToast('error', 'Error', 'Failed to share invite. Please try again.');
      }
    }
  };

  const handleDelete = async () => {
    if (!group || !isOwner) return;

    if (!user?.id) {
      showToast('error', 'Error', 'User not found');
      return;
    }

    // Web: Use window.confirm
    if (Platform.OS === 'web') {
      const confirmed = window.confirm('Are you sure you want to delete this group? This action cannot be undone.');
      if (!confirmed) {
        console.log('User cancelled deleting group');
        return;
      }

      try {
        console.log('Deleting group:', group.id, 'User:', user.id);
        const { success, error } = await deleteGroup(group.id, user.id);
        
        if (success) {
          console.log('Successfully deleted group');
          router.back();
        } else {
          console.error('Failed to delete group:', error);
          showToast('error', 'Error', error || 'Failed to delete group. Please try again.');
        }
      } catch (err: any) {
        console.error('Exception deleting group:', err);
        showToast('error', 'Error', err.message || 'An error occurred while deleting the group.');
      }
      return;
    }

    // Native: Use Alert.alert
    Alert.alert(
      'Delete Group',
      'Are you sure you want to delete this group? This action cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
              console.log('Deleting group:', group.id, 'User:', user.id);
              const { success, error } = await deleteGroup(group.id, user.id);
              
              if (success) {
                console.log('Successfully deleted group');
                router.back();
              } else {
                console.error('Failed to delete group:', error);
                showToast('error', 'Error', error || 'Failed to delete group. Please try again.');
              }
            } catch (err: any) {
              console.error('Exception deleting group:', err);
              showToast('error', 'Error', err.message || 'An error occurred while deleting the group.');
            }
          },
        },
      ]
    );
  };

  const handlePromoteMember = async (targetUserId: string) => {
    if (!group || !canManageRoles) return;

    if (!user?.id) {
      showToast('error', 'Error', 'User not found');
      return;
    }

    if (Platform.OS === 'web') {
      const confirmed = window.confirm('Are you sure you want to promote this member to admin?');
      if (!confirmed) return;

      try {
        const { success, error } = await promoteMember(group.id, targetUserId);
        if (success) {
          await fetchGroupById(group.id, user.id);
        } else {
          showToast('error', 'Error', error || 'Failed to promote member');
        }
      } catch (err: any) {
        showToast('error', 'Error', err.message || 'An error occurred');
      }
      return;
    }

    Alert.alert(
      'Promote to Admin',
      'Are you sure you want to promote this member to admin?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Promote',
          onPress: async () => {
            try {
              await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
              const { success, error } = await promoteMember(group.id, targetUserId);
              if (success) {
                await fetchGroupById(group.id, user.id);
              } else {
                showToast('error', 'Error', error || 'Failed to promote member');
              }
            } catch (err: any) {
              showToast('error', 'Error', err.message || 'An error occurred');
            }
          },
        },
      ]
    );
  };

  const handleDemoteMember = async (targetUserId: string) => {
    if (!group || !canManageRoles) return;

    if (!user?.id) {
      showToast('error', 'Error', 'User not found');
      return;
    }

    if (Platform.OS === 'web') {
      const confirmed = window.confirm('Are you sure you want to demote this admin to member?');
      if (!confirmed) return;

      try {
        const { success, error } = await demoteMember(group.id, targetUserId);
        if (success) {
          await fetchGroupById(group.id, user.id);
        } else {
          showToast('error', 'Error', error || 'Failed to demote member');
        }
      } catch (err: any) {
        showToast('error', 'Error', err.message || 'An error occurred');
      }
      return;
    }

    Alert.alert(
      'Demote to Member',
      'Are you sure you want to demote this admin to member?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Demote',
          onPress: async () => {
            try {
              await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
              const { success, error } = await demoteMember(group.id, targetUserId);
              if (success) {
                await fetchGroupById(group.id, user.id);
              } else {
                showToast('error', 'Error', error || 'Failed to demote member');
              }
            } catch (err: any) {
              showToast('error', 'Error', err.message || 'An error occurred');
            }
          },
        },
      ]
    );
  };

  const handleKickMember = async (targetUserId: string) => {
    if (!group || !isOwner) return;

    if (!user?.id) {
      showToast('error', 'Error', 'User not found');
      return;
    }

    const targetMember = group.members.find((m) => m.id === targetUserId);
    if (!targetMember) return;

    if (Platform.OS === 'web') {
      const confirmed = window.confirm(
        `Are you sure you want to kick ${targetMember.name} from this group? This action cannot be undone.`
      );
      if (!confirmed) return;

      try {
        const { success, error } = await kickMember(group.id, targetUserId);
        if (success) {
          await fetchGroupById(group.id, user.id);
        } else {
          showToast('error', 'Error', error || 'Failed to kick member');
        }
      } catch (err: any) {
        showToast('error', 'Error', err.message || 'An error occurred');
      }
      return;
    }

    Alert.alert(
      'Kick Member',
      `Are you sure you want to kick ${targetMember.name} from this group? This action cannot be undone.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Kick',
          style: 'destructive',
          onPress: async () => {
            try {
              await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
              const { success, error } = await kickMember(group.id, targetUserId);
              if (success) {
                await fetchGroupById(group.id, user.id);
              } else {
                showToast('error', 'Error', error || 'Failed to kick member');
              }
            } catch (err: any) {
              showToast('error', 'Error', err.message || 'An error occurred');
            }
          },
        },
      ]
    );
  };

  const handleGroupImagePress = useCallback(async () => {
    if (!group || !isOwner || uploadingImage) return;

    // Request permissions
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      showToast('error', 'Permission Denied', 'We need camera roll permissions to upload group image.');
      return;
    }

    // Show action sheet
    if (Platform.OS === 'web') {
      // Web: Use file input
      const input = document.createElement('input');
      input.type = 'file';
      input.accept = 'image/*';
      input.onchange = async (e: any) => {
        const file = e.target.files?.[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = async (event) => {
          const imageUri = event.target?.result as string;
          if (imageUri) {
            await performGroupImageUpload(imageUri);
          }
        };
        reader.readAsDataURL(file);
      };
      input.click();
    } else {
      // Mobile: Show action sheet
      Alert.alert(
        'Change Group Image',
        'Choose an option',
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Take Photo',
            onPress: async () => {
              const { status: cameraStatus } = await ImagePicker.requestCameraPermissionsAsync();
              if (cameraStatus !== 'granted') {
                showToast('error', 'Permission Denied', 'We need camera permissions to take a photo.');
                return;
              }
              const result = await ImagePicker.launchCameraAsync({
                mediaTypes: ['images'],
                allowsEditing: true,
                aspect: [1, 1],
                quality: 0.8,
                base64: true,
              });
              if (!result.canceled && result.assets[0]) {
                const asset = result.assets[0];
                const imageData = asset.base64 
                  ? `data:image/jpeg;base64,${asset.base64}` 
                  : asset.uri;
                await performGroupImageUpload(imageData);
              }
            },
          },
          {
            text: 'Choose from Library',
            onPress: async () => {
              const result = await ImagePicker.launchImageLibraryAsync({
                mediaTypes: ['images'],
                allowsEditing: true,
                aspect: [1, 1],
                quality: 0.8,
                base64: true,
              });
              if (!result.canceled && result.assets[0]) {
                const asset = result.assets[0];
                const imageData = asset.base64 
                  ? `data:image/jpeg;base64,${asset.base64}` 
                  : asset.uri;
                await performGroupImageUpload(imageData);
              }
            },
          },
          ...(group.imageUrl ? [{
            text: 'Remove Image',
            style: 'destructive' as const,
            onPress: async () => {
              showToast('info', 'Remove Image', 'This feature will be implemented soon.');
            },
          }] : []),
        ]
      );
    }
  }, [group, isOwner, uploadingImage, user?.id, fetchGroupById]);

  const performGroupImageUpload = async (imageUri: string) => {
    if (!group) return;

    setUploadingImage(true);
    try {
      const { data: imageUrl, error } = await uploadGroupImage(group.id, imageUri);
      if (error) {
        showToast('error', 'Upload Failed', error.message || 'Failed to upload group image. Please try again.');
        return;
      }

      if (!imageUrl) {
        showToast('error', 'Upload Failed', 'Failed to get image URL. Please try again.');
        return;
      }

      // Update timestamp to force image reload
      setImageTimestamp(Date.now());

      // Refresh group data
      await fetchGroupById(group.id, user?.id);
      
      showToast('success', 'Success', 'Group image updated successfully!');
    } catch (error) {
      console.error('Error uploading group image:', error);
      showToast('error', 'Upload Failed', 'An unexpected error occurred. Please try again.');
    } finally {
      setUploadingImage(false);
    }
  };

  const handleMemberPress = (member: typeof group.members[0]) => {
    if (!canManageRoles || member.id === user?.id || member.role === 'OWNER') {
      return; // Don't show menu for self, or if not owner, or for owner
    }

    if (Platform.OS === 'web') {
      const options = [];
      if (member.role === 'MEMBER') {
        options.push('Promote to Admin');
      } else if (member.role === 'ADMIN') {
        options.push('Demote to Member');
      }
      options.push('Kick from Group');
      options.push('Cancel');

      const choice = window.prompt(
        `Options for ${member.name}:\n${options.map((opt, idx) => `${idx + 1}. ${opt}`).join('\n')}\n\nEnter number:`
      );
      
      if (choice === '1' && member.role === 'MEMBER') {
        handlePromoteMember(member.id);
      } else if (choice === '1' && member.role === 'ADMIN') {
        handleDemoteMember(member.id);
      } else if (choice === String(options.length - 1)) {
        // Kick option (second to last, before Cancel)
        handleKickMember(member.id);
      }
      return;
    }

    // Native: Use Alert.alert with options
    const options = [];
    if (member.role === 'MEMBER') {
      options.push({ text: 'Promote to Admin', onPress: () => handlePromoteMember(member.id) });
    } else if (member.role === 'ADMIN') {
      options.push({ text: 'Demote to Member', onPress: () => handleDemoteMember(member.id) });
    }
    options.push({ 
      text: 'Kick from Group', 
      style: 'destructive',
      onPress: () => handleKickMember(member.id) 
    });
    options.push({ text: 'Cancel', style: 'cancel' });

    Alert.alert(`Manage ${member.name}`, undefined, options);
  };

  const handleLeave = async () => {
    if (!group || isOwner) {
      console.log('Cannot leave: group=', group, 'isOwner=', isOwner);
      return;
    }

    if (!user?.id) {
      showToast('error', 'Error', 'User not found');
      return;
    }

    // Web: Use window.confirm
    if (Platform.OS === 'web') {
      const confirmed = window.confirm('Are you sure you want to leave this group?');
      if (!confirmed) {
        console.log('User cancelled leaving group');
        return;
      }

      try {
        console.log('Leaving group:', group.id, 'User:', user.id);
        const { success, error } = await leaveGroup(group.id, user.id);
        
        if (success) {
          console.log('Successfully left group');
          router.back();
        } else {
          console.error('Failed to leave group:', error);
          showToast('error', 'Error', error || 'Failed to leave group. Please try again.');
        }
      } catch (err: any) {
        console.error('Exception leaving group:', err);
        showToast('error', 'Error', err.message || 'An error occurred while leaving the group.');
      }
      return;
    }

    // Native: Use Alert.alert
    Alert.alert(
      'Leave Group',
      'Are you sure you want to leave this group?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Leave',
          style: 'destructive',
          onPress: async () => {
            try {
              await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
              console.log('Leaving group:', group.id, 'User:', user.id);
              const { success, error } = await leaveGroup(group.id, user.id);
              
              if (success) {
                console.log('Successfully left group');
                router.back();
              } else {
                console.error('Failed to leave group:', error);
                showToast('error', 'Error', error || 'Failed to leave group. Please try again.');
              }
            } catch (err: any) {
              console.error('Exception leaving group:', err);
              showToast('error', 'Error', err.message || 'An error occurred while leaving the group.');
            }
          },
        },
      ]
    );
  };

  if (!group) {
    return (
      <SafeAreaView style={styles.container}>
        {/* Handle Bar (Visual Hint) - Only show on native */}
        {Platform.OS !== 'web' && (
          <View
            style={{
              alignItems: 'center',
              paddingTop: 8,
              paddingBottom: 4,
            }}
          >
            <View
              style={{
                width: 40,
                height: 4,
                backgroundColor: colors.textSub,
                borderRadius: 2,
                opacity: 0.3,
              }}
            />
          </View>
        )}
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Group Details</Text>
        </View>
        <View style={styles.content}>
          <Text style={styles.errorText}>Group not found</Text>
        </View>
      </SafeAreaView>
    );
  }

  const containerContent = (
    <Animated.View
      style={[
        {
          flex: 1,
          backgroundColor: colors.background,
        },
        animatedContainerStyle,
      ]}
    >
      <SafeAreaView style={styles.container}>
        {/* Handle Bar (Visual Hint) - Only show on native */}
        {Platform.OS !== 'web' && (
          <View
            style={{
              alignItems: 'center',
              paddingTop: 8,
              paddingBottom: 4,
            }}
          >
            <View
              style={{
                width: 40,
                height: 4,
                backgroundColor: colors.textSub,
                borderRadius: 2,
                opacity: 0.3,
              }}
            />
          </View>
        )}

        {/* Web: Close button hint */}
        {Platform.OS === 'web' && (
          <View
            style={{
              alignItems: 'center',
              paddingTop: 8,
              paddingBottom: 4,
            }}
          >
            <Text style={{ fontSize: 12, color: colors.textSub }}>
              Press ESC to close
            </Text>
          </View>
        )}

        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Group Details</Text>
        </View>

        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
          nestedScrollEnabled={true}
          onScroll={handleScroll}
          scrollEventThrottle={16}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor={colors.primary}
              colors={[colors.primary]}
            />
          }
        >
        {/* Group Image */}
        {isOwner && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Group Image</Text>
            <View style={styles.groupImageContainer}>
              <Pressable
                onPress={handleGroupImagePress}
                disabled={uploadingImage}
                style={styles.groupImagePressable}
              >
                <View style={styles.groupImageWrapper}>
                  {group.imageUrl ? (
                    <Image
                      key={`group-image-${group.imageUrl}-${imageTimestamp}`}
                      source={{
                        uri: group.imageUrl.trim() + (group.imageUrl.includes('?') ? '&' : '?') + `t=${imageTimestamp}`
                      }}
                      style={styles.groupImage}
                      contentFit="cover"
                      transition={200}
                    />
                  ) : (
                    <View style={styles.groupImagePlaceholder}>
                      <Users size={40} color={colors.primary} strokeWidth={2} />
                    </View>
                  )}
                  {uploadingImage && (
                    <View style={styles.groupImageOverlay}>
                      <Text style={styles.groupImageOverlayText}>Uploading...</Text>
                    </View>
                  )}
                  {!uploadingImage && (
                    <View style={styles.groupImageEditBadge}>
                      <Camera size={16} color="#FFFFFF" strokeWidth={2} />
                    </View>
                  )}
                </View>
              </Pressable>
              <Text style={styles.groupImageHint}>Tap to change image</Text>
            </View>
          </View>
        )}

        {/* Group Name */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Group Name</Text>
          {isEditingGroupName && isOwner ? (
            <View style={styles.groupNameEditContainer}>
              <TextInput
                style={styles.groupNameInput}
                value={editingGroupName}
                onChangeText={setEditingGroupName}
                autoFocus
                maxLength={50}
                editable={!isSavingGroupName}
                onSubmitEditing={async () => {
                  const trimmedName = editingGroupName.trim();
                  if (!trimmedName) {
                    showToast('error', 'Error', 'Group name cannot be empty');
                    setEditingGroupName(group.name);
                    setIsEditingGroupName(false);
                    return;
                  }

                  if (trimmedName === group.name) {
                    setIsEditingGroupName(false);
                    return;
                  }

                  setIsSavingGroupName(true);
                  try {
                    const { success, error } = await updateGroupName(group.id, trimmedName);
                    if (success) {
                      // Refresh group data
                      await fetchGroupById(group.id, user?.id);
                      setIsEditingGroupName(false);
                    } else {
                      showToast('error', 'Error', error || 'Failed to update group name');
                      setEditingGroupName(group.name);
                    }
                  } catch (err: any) {
                    showToast('error', 'Error', err.message || 'An error occurred');
                    setEditingGroupName(group.name);
                  } finally {
                    setIsSavingGroupName(false);
                  }
                }}
                onBlur={async () => {
                  const trimmedName = editingGroupName.trim();
                  if (!trimmedName || trimmedName === group.name) {
                    setEditingGroupName(group.name);
                    setIsEditingGroupName(false);
                    return;
                  }

                  setIsSavingGroupName(true);
                  try {
                    const { success, error } = await updateGroupName(group.id, trimmedName);
                    if (success) {
                      await fetchGroupById(group.id, user?.id);
                      setIsEditingGroupName(false);
                    } else {
                      showToast('error', 'Error', error || 'Failed to update group name');
                      setEditingGroupName(group.name);
                    }
                  } catch (err: any) {
                    showToast('error', 'Error', err.message || 'An error occurred');
                    setEditingGroupName(group.name);
                  } finally {
                    setIsSavingGroupName(false);
                    setIsEditingGroupName(false);
                  }
                }}
              />
            </View>
          ) : (
            <Pressable
              onPress={() => {
                if (isActioningRef.current || !isOwner) return;
                isActioningRef.current = true;
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
                setIsEditingGroupName(true);
                setTimeout(() => { isActioningRef.current = false; }, 300);
              }}
              disabled={!isOwner}
              style={[
                styles.groupNameContainer,
                isOwner && styles.groupNameEditable,
              ]}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              pressRetentionOffset={{ top: 20, bottom: 20, left: 20, right: 20 }}
            >
              <Text style={styles.groupName}>{group.name}</Text>
              {isOwner && (
                <Edit2 size={16} color={colors.textSub} strokeWidth={2} style={{ marginLeft: 8 }} />
              )}
            </Pressable>
          )}
        </View>

        {/* Invite Code - OWNER/ADMIN Only */}
        {/* Note: Currently hidden via UI. Future: RLS policy can return null for invite_code for MEMBERs */}
        {canManageGroup && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Invite Code</Text>
            <View style={styles.inviteCodeContainer}>
              <Text style={styles.inviteCode}>{group.inviteCode}</Text>
              <Pressable
                onPress={() => {
                  if (isActioningRef.current) return;
                  isActioningRef.current = true;
                  handleCopyInviteCode();
                  setTimeout(() => { isActioningRef.current = false; }, 300);
                }}
                style={styles.copyButton}
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                delayPressIn={0}
                pressRetentionOffset={{ top: 20, bottom: 20, left: 20, right: 20 }}
              >
                <Text style={styles.copyButtonText}>Copy</Text>
              </Pressable>
            </View>
            <Text style={styles.inviteCodeHint}>
              Share this code with others to invite them to the group
            </Text>
            
            {/* Share Invite Button */}
            <Pressable
              onPress={() => {
                if (isActioningRef.current) return;
                isActioningRef.current = true;
                handleShareInvite();
                setTimeout(() => { isActioningRef.current = false; }, 300);
              }}
              style={styles.shareButton}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              delayPressIn={0}
              pressRetentionOffset={{ top: 20, bottom: 20, left: 20, right: 20 }}
            >
              <Share2 size={20} color={colors.primaryForeground} strokeWidth={2} />
              <Text style={styles.shareButtonText}>Share Invite</Text>
            </Pressable>
          </View>
        )}

        {/* Members List */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Members</Text>
            <View style={styles.memberCountBadge}>
              <Users size={16} color={colors.textSub} strokeWidth={2} />
              <Text style={[styles.memberCountText, { marginLeft: 4 }]}>{group.members.length}</Text>
            </View>
          </View>
          
          <View style={styles.membersList}>
            {group.members.map((member) => (
              <Pressable
                key={member.id}
                style={styles.memberItem}
                onPress={() => {
                  if (isActioningRef.current) return;
                  isActioningRef.current = true;
                  handleMemberPress(member);
                  setTimeout(() => { isActioningRef.current = false; }, 300);
                }}
                disabled={!canManageRoles || member.id === user?.id || member.role === 'OWNER'}
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                delayPressIn={0}
                pressRetentionOffset={{ top: 20, bottom: 20, left: 20, right: 20 }}
              >
                <View
                  style={[
                    styles.memberAvatar,
                    { backgroundColor: member.profileColor },
                  ]}
                >
                  <Text style={styles.memberAvatarText}>
                    {member.name.charAt(0).toUpperCase()}
                  </Text>
                </View>
                <View style={styles.memberInfo}>
                  <View style={styles.memberNameRow}>
                    <Text style={styles.memberName}>{member.name}</Text>
                    {member.role === 'OWNER' && (
                      <View style={styles.ownerBadge}>
                        <Crown size={14} color="#F59E0B" strokeWidth={2} />
                        <Text style={[styles.ownerBadgeText, { marginLeft: 4 }]}>Owner</Text>
                      </View>
                    )}
                    {member.role === 'ADMIN' && (
                      <View style={styles.adminBadge}>
                        <Shield size={14} color="#3B82F6" strokeWidth={2} />
                        <Text style={[styles.adminBadgeText, { marginLeft: 4 }]}>Admin</Text>
                      </View>
                    )}
                    {member.id === user?.id && (
                      <Text style={styles.youBadge}>(You)</Text>
                    )}
                  </View>
                </View>
                {canManageRoles && member.id !== user?.id && member.role !== 'OWNER' && (
                  <Pressable
                    onPress={() => handleMemberPress(member)}
                    style={styles.memberActionButton}
                    hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                    delayPressIn={0}
                    pressRetentionOffset={{ top: 20, bottom: 20, left: 20, right: 20 }}
                  >
                    <MoreVertical size={20} color={colors.textSub} strokeWidth={2} />
                  </Pressable>
                )}
              </Pressable>
            ))}
          </View>
        </View>

        {/* Action Buttons */}
        <View style={styles.actions}>
          {isOwner ? (
            <Pressable
              onPress={() => {
                if (isActioningRef.current) return;
                isActioningRef.current = true;
                handleDelete();
                setTimeout(() => { isActioningRef.current = false; }, 300);
              }}
              style={[styles.actionButton, styles.deleteButton]}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              delayPressIn={0}
              pressRetentionOffset={{ top: 20, bottom: 20, left: 20, right: 20 }}
            >
              <Trash2 size={20} color="#EF4444" strokeWidth={2} />
              <Text style={[styles.deleteButtonText, { marginLeft: 8 }]}>Delete Group</Text>
            </Pressable>
          ) : (
            <Pressable
              onPress={() => {
                if (isActioningRef.current) return;
                isActioningRef.current = true;
                console.log('Leave button pressed. Group:', group?.id, 'User:', user?.id, 'isOwner:', isOwner);
                handleLeave();
                setTimeout(() => { isActioningRef.current = false; }, 300);
              }}
              style={[styles.actionButton, styles.leaveButton]}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              delayPressIn={0}
              pressRetentionOffset={{ top: 20, bottom: 20, left: 20, right: 20 }}
            >
              <LogOut size={20} color="#EF4444" strokeWidth={2} />
              <Text style={[styles.leaveButtonText, { marginLeft: 8 }]}>Leave Group</Text>
            </Pressable>
          )}
        </View>
        </ScrollView>
      </SafeAreaView>
    </Animated.View>
  );

  // Wrap with GestureDetector only on native (web has pointer capture issues)
  if (Platform.OS === 'web') {
    return containerContent;
  }

  return (
    <GestureDetector gesture={panGesture}>
      {containerContent}
    </GestureDetector>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(229, 231, 235, 0.5)',
    backgroundColor: colors.background,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.textMain,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
  },
  section: {
    marginBottom: 24,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.textSub,
    marginBottom: 8,
  },
  groupNameContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  groupNameEditable: {
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: borderRadius.md,
    backgroundColor: 'transparent',
  },
  groupName: {
    fontSize: 24,
    fontWeight: '700',
    color: colors.textMain,
  },
  groupNameEditContainer: {
    marginTop: 4,
  },
  groupNameInput: {
    fontSize: 24,
    fontWeight: '700',
    color: colors.textMain,
    backgroundColor: colors.gray50,
    borderRadius: borderRadius.md,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderWidth: 2,
    borderColor: colors.primary,
  },
  inviteCodeContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.card,
    borderRadius: borderRadius.xl,
    padding: 16,
    borderWidth: 2,
    borderColor: colors.primary + '4D',
    marginBottom: 8,
    ...shadows.sm,
  },
  inviteCode: {
    fontSize: 24,
    fontWeight: '700',
    color: colors.primary,
    letterSpacing: 3.2,
    flex: 1,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
  copyButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.primary,
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: borderRadius.full,
  },
  copyButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.primaryForeground,
  },
  inviteCodeHint: {
    fontSize: 12,
    color: colors.textSub,
    marginTop: 4,
    marginBottom: 12,
  },
  shareButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.primary,
    paddingVertical: 14,
    paddingHorizontal: 20,
    borderRadius: borderRadius.md,
    marginTop: 16,
  },
  shareButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.primaryForeground,
    marginLeft: 8,
  },
  memberCountBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.gray100,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: borderRadius.md,
  },
  memberCountText: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.textSub,
  },
  membersList: {
    // gap replaced with marginBottom on each item
  },
  memberItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.card,
    borderRadius: borderRadius.md,
    padding: 16,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: 'rgba(229, 231, 235, 0.5)',
    ...shadows.sm,
  },
  memberAvatar: {
    width: 40,
    height: 40,
    borderRadius: borderRadius.full,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  memberAvatarText: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.primaryForeground,
  },
  memberInfo: {
    flex: 1,
  },
  memberNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  memberName: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.textMain,
    marginRight: 8,
  },
  ownerBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(245, 158, 11, 0.1)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: borderRadius.full,
    marginRight: 8,
  },
  ownerBadgeText: {
    fontSize: 12,
    fontWeight: '500',
    color: '#F59E0B',
    marginLeft: 4,
  },
  adminBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(59, 130, 246, 0.1)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: borderRadius.full,
    marginRight: 8,
  },
  adminBadgeText: {
    fontSize: 12,
    fontWeight: '500',
    color: '#3B82F6',
    marginLeft: 4,
  },
  youBadge: {
    fontSize: 14,
    color: colors.textSub,
  },
  memberActionButton: {
    padding: 8,
    marginLeft: 8,
  },
  actions: {
    marginTop: 8,
    marginBottom: 24,
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    paddingHorizontal: 20,
    borderRadius: borderRadius.md,
  },
  deleteButton: {
    backgroundColor: 'rgba(239, 68, 68, 0.1)',
    borderWidth: 1,
    borderColor: '#EF4444',
  },
  deleteButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#EF4444',
  },
  leaveButton: {
    backgroundColor: 'rgba(239, 68, 68, 0.1)',
    borderWidth: 1,
    borderColor: '#EF4444',
  },
  leaveButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#EF4444',
  },
  content: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
  },
  errorText: {
    fontSize: 16,
    color: colors.textSub,
  },
  groupImageContainer: {
    alignItems: 'center',
    marginBottom: 16,
  },
  groupImagePressable: {
    position: 'relative',
  },
  groupImageWrapper: {
    width: 120,
    height: 120,
    borderRadius: borderRadius.xl,
    overflow: 'hidden',
    backgroundColor: colors.gray100,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: colors.primary + '40',
  },
  groupImage: {
    width: '100%',
    height: '100%',
  },
  groupImagePlaceholder: {
    width: '100%',
    height: '100%',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.primary + '1A',
  },
  groupImageOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  groupImageOverlayText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
  },
  groupImageEditBadge: {
    position: 'absolute',
    bottom: 8,
    right: 8,
    width: 32,
    height: 32,
    borderRadius: borderRadius.full,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    ...shadows.sm,
  },
  groupImageHint: {
    fontSize: 12,
    color: colors.textSub,
    marginTop: 8,
  },
});
