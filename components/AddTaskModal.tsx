import { borderRadius, colors } from '@/constants/colors';
import { useAuth } from '@/lib/hooks/use-auth';
import { useSubscriptionLimits } from '@/lib/hooks/use-subscription-limits';
import { useGroupStore } from '@/lib/stores/useGroupStore';
import { useCalendarStore } from '@/lib/stores/useCalendarStore';
import DateTimePicker from '@react-native-community/datetimepicker';
import { useQueryClient } from '@tanstack/react-query';
import { addDays, format, isToday, isTomorrow, parse } from 'date-fns';
import { MapPin, Users, X } from 'lucide-react-native';
import { useEffect, useRef, useState } from 'react';
import {
    KeyboardAvoidingView,
    Modal,
    Platform,
    Pressable,
    ScrollView,
    Text,
    TextInput,
    View,
} from 'react-native';
import { showToast } from '@/utils/toast';
import { LocationInput } from './LocationInput';
import { ModalCloseButton } from './ModalCloseButton';
import * as Haptics from 'expo-haptics';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

interface AddTaskModalProps {
  visible: boolean;
  onClose: () => void;
  initialDate?: string; // yyyy-MM-dd format, optional default date
}

export function AddTaskModal({ visible, onClose, initialDate }: AddTaskModalProps) {
  const insets = useSafeAreaInsets();
  const [title, setTitle] = useState('');
  const [dueDate, setDueDate] = useState<Date | null>(null);
  const [dueTime, setDueTime] = useState<Date | null>(null);
  const [dueTimeEnd, setDueTimeEnd] = useState<Date | null>(null);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [showTimePicker, setShowTimePicker] = useState(false);
  const [showEndTimePicker, setShowEndTimePicker] = useState(false);
  const [timePickerValue, setTimePickerValue] = useState<Date | null>(null);
  const [endTimePickerValue, setEndTimePickerValue] = useState<Date | null>(null);
  const [webStartPickerValue, setWebStartPickerValue] = useState<Date | null>(null);
  const [webEndPickerValue, setWebEndPickerValue] = useState<Date | null>(null);

  // Group task fields
  const [selectedGroupId, setSelectedGroupId] = useState<string | null>(null); // null = personal task
  const [selectedAssigneeIds, setSelectedAssigneeIds] = useState<string[]>([]);
  const [location, setLocation] = useState<string | null>(null);
  const [showLocationField, setShowLocationField] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const dateInputRef = useRef<any>(null);
  const timeInputRef = useRef<any>(null);
  const endTimeInputRef = useRef<any>(null);
  const timeBeforeOpenRef = useRef<Date | null>(null);
  const endTimeBeforeOpenRef = useRef<Date | null>(null);

  const { addTask } = useCalendarStore();
  const { groups, fetchMyGroups } = useGroupStore();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const { canAddToBacklog, checkCanAddTaskToDate, refetchBacklog, isSubscribed } = useSubscriptionLimits();

  // Get current group's members
  const currentGroup = groups.find(g => g.id === selectedGroupId);

  // Fetch groups only when modal opens and we don't have groups yet (avoids duplicate API calls)
  useEffect(() => {
    if (!visible || !user?.id) return;
    if (groups.length === 0) fetchMyGroups(user.id);
    refetchBacklog();
  }, [visible, user?.id, groups.length, fetchMyGroups, refetchBacklog]);

  // Set initial date when modal opens or initialDate changes
  useEffect(() => {
    if (visible && initialDate) {
      const parsedDate = parse(initialDate, 'yyyy-MM-dd', new Date());
      if (!isNaN(parsedDate.getTime())) {
        setDueDate(parsedDate);
      }
    } else if (visible && !initialDate) {
      // Reset to null if no initialDate provided
      setDueDate(null);
    }
  }, [visible, initialDate]);

  useEffect(() => {
    if (visible) setSubmitError(null);
  }, [visible]);

  // 기본 시간 계산: 현재시간 + 1시간, 분은 00분
  const getDefaultTime = () => {
    const now = new Date();
    const defaultTime = new Date();
    defaultTime.setHours(now.getHours() + 1);
    defaultTime.setMinutes(0);
    defaultTime.setSeconds(0);
    return defaultTime;
  };

  // 웹에서 날짜 선택기 자동 열기
  useEffect(() => {
    if (Platform.OS === 'web' && showDatePicker && dateInputRef.current) {
      // Use requestAnimationFrame to ensure DOM is ready
      requestAnimationFrame(() => {
        try {
          dateInputRef.current?.showPicker?.();
        } catch (error) {
          // Fallback: focus the input if showPicker fails
          dateInputRef.current?.focus?.();
        }
      });
    }
  }, [showDatePicker]);

  // 웹에서는 커스텀 모달(Cancel/Apply) 사용 → showPicker 호출 안 함
  useEffect(() => {
    if (Platform.OS === 'web') return;
    if (showTimePicker && timeInputRef.current) {
      setTimeout(() => timeInputRef.current?.showPicker?.(), 100);
    }
  }, [showTimePicker]);

  useEffect(() => {
    if (Platform.OS === 'web') return;
    if (showEndTimePicker && endTimeInputRef.current) {
      setTimeout(() => endTimeInputRef.current?.showPicker?.(), 100);
    }
  }, [showEndTimePicker]);

  const resetForm = () => {
    setTitle('');
    setDueDate(null);
    setDueTime(null);
    setDueTimeEnd(null);
    setSelectedGroupId(null);
    setSelectedAssigneeIds([]);
    setLocation(null);
    setShowLocationField(false);
  };

  const handleClose = () => {
    resetForm();
    onClose();
  };

  // Handle saving task (personal or group distribution)
  const handleSave = async () => {
    if (!title.trim()) {
      showToast('error', 'Required', 'Please enter a title');
      return;
    }

    // Subscription limits (free tier)
    const dueDateStr = dueDate ? format(dueDate, 'yyyy-MM-dd') : null;
    setSubmitError(null);
    if (!isSubscribed) {
      if (!dueDateStr) {
        if (!canAddToBacklog) {
          const msg = 'Free plan: max 5 backlog items. Upgrade to add more.';
          setSubmitError(msg);
          showToast('error', 'Limit', msg);
          return;
        }
      } else {
        const { allowed, message } = await checkCanAddTaskToDate(dueDateStr);
        if (!allowed) {
          const msg = message ?? 'Free plan: max 5 tasks per date. Upgrade to add more.';
          setSubmitError(msg);
          showToast('error', 'Limit', msg);
          return;
        }
      }
    }

    // Remove @mentions from title before saving (using actual selected assignee nicknames)
    let cleanedTitle = title;

    // Remove each selected assignee's @mention exactly
    if (selectedGroupId && currentGroup) {
      selectedAssigneeIds.forEach(assigneeId => {
        const member = currentGroup.members.find(m => m.id === assigneeId);
        if (member) {
          const escapedNickname = member.name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
          const mentionRegex = new RegExp(`@${escapedNickname}\\s*`, 'g');
          cleanedTitle = cleanedTitle.replace(mentionRegex, '');
        }
      });
    }

    cleanedTitle = cleanedTitle
      .replace(/[,\s]+/g, ' ')
      .trim();

    const dueTimeStr = dueTime ? format(dueTime, 'HH:mm:ss') : null;
    const dueTimeEndStr = dueTimeEnd ? format(dueTimeEnd, 'HH:mm:ss') : null;

    const payload = selectedGroupId
      ? {
          title: cleanedTitle,
          group_id: selectedGroupId,
          assignee_ids: selectedAssigneeIds,
          due_date: dueDateStr,
          due_time: dueTimeStr,
          due_time_end: dueTimeEndStr,
          location: location?.trim() || null,
        }
      : {
          title: cleanedTitle,
          due_date: dueDateStr,
          due_time: dueTimeStr,
          due_time_end: dueTimeEndStr,
          location: location?.trim() || null,
        };

    setIsSubmitting(true);
    try {
      const result = await addTask(payload);
      if (result.success) {
        queryClient.invalidateQueries({ queryKey: ['tasks', 'today'] });
        queryClient.invalidateQueries({ queryKey: ['tasks'] });
        handleClose();
      } else {
        const msg = result.error ?? '작업을 생성할 수 없습니다.';
        setSubmitError(msg);
        showToast('error', '생성 실패', msg);
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : '작업을 생성할 수 없습니다.';
      setSubmitError(msg);
      showToast('error', '생성 실패', msg);
    } finally {
      setIsSubmitting(false);
    }
  };

  // Toggle assignee selection
  const toggleAssignee = (userId: string) => {
    const isCurrentlySelected = selectedAssigneeIds.includes(userId);
    
    if (isCurrentlySelected) {
      // Remove from selection
      setSelectedAssigneeIds(prev => prev.filter(id => id !== userId));
    } else {
      // Add to selection
      setSelectedAssigneeIds(prev => [...prev, userId]);
    }
  };

  // Reset assignees when group changes
  useEffect(() => {
    setSelectedAssigneeIds([]);
  }, [selectedGroupId]);

  const handleQuickDate = (date: Date | null) => {
    // DatePicker가 열려있으면 닫기
    setShowDatePicker(false);
    setShowTimePicker(false);

    if (!date) {
      setDueDate(null);
      setDueTime(null);
      return;
    }

    // Prevent past dates
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const selectedDate = new Date(date);
    selectedDate.setHours(0, 0, 0, 0);

    if (selectedDate < today) {
      showToast('error', '날짜 선택', '과거 날짜는 선택할 수 없습니다.');
      return;
    }

    if (dueDate && date) {
      // 날짜만 비교 (시간 제외)
      const dueDateOnly = new Date(dueDate.getFullYear(), dueDate.getMonth(), dueDate.getDate());
      const targetDateOnly = new Date(date.getFullYear(), date.getMonth(), date.getDate());
      
      if (dueDateOnly.getTime() === targetDateOnly.getTime()) {
        // 같은 날짜를 다시 클릭하면 토글 (백로그로 변경)
        setDueDate(null);
        setDueTime(null); // 날짜 해제 시 시간도 초기화
        return;
      }
    }
    
    setDueDate(date);
  };

  const isDateSelected = (targetDate: Date | null) => {
    if (!dueDate || !targetDate) return false;
    
    // 날짜만 비교 (시간 제외)
    const dueDateOnly = new Date(dueDate.getFullYear(), dueDate.getMonth(), dueDate.getDate());
    const targetDateOnly = new Date(targetDate.getFullYear(), targetDate.getMonth(), targetDate.getDate());
    
    return dueDateOnly.getTime() === targetDateOnly.getTime();
  };

  const getDateButtonText = () => {
    if (!dueDate) return '📅 Pick Date';
    
    // Check if today or tomorrow in local timezone
    const today = new Date();
    const todayOnly = new Date(today.getFullYear(), today.getMonth(), today.getDate());
    const dueDateOnly = new Date(dueDate.getFullYear(), dueDate.getMonth(), dueDate.getDate());
    
    const diffDays = Math.floor((dueDateOnly.getTime() - todayOnly.getTime()) / (1000 * 60 * 60 * 24));
    
    if (diffDays === 0) return 'Today';
    if (diffDays === 1) return 'Tomorrow';
    
    return format(dueDate, 'MMM d');
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={handleClose}
    >
      <Pressable
        className="flex-1 bg-black/50 justify-end"
        onPress={handleClose}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        >
          <Pressable onPress={(e) => e.stopPropagation()}>
            <View 
              className="bg-white dark:bg-gray-900 rounded-t-3xl px-6 py-6"
              style={{ paddingBottom: Math.max(insets.bottom, 24) }}
            >
              {/* Header */}
              <View className="flex-row justify-between items-center mb-6">
                <Text className="text-xl font-bold text-gray-900 dark:text-white">
                  New Task
                </Text>
                <ModalCloseButton onPress={handleClose} />
              </View>

              {/* Group Selector */}
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                className="mb-4"
              >
                <View className="flex-row gap-2">
                  {/* Group buttons - only show groups where user is OWNER or ADMIN */}
                  {groups
                    .filter(group => group.myRole === 'OWNER' || group.myRole === 'ADMIN')
                    .map(group => (
                      <Pressable
                        key={group.id}
                        onPress={() => {
                          if (Platform.OS === 'ios') {
                            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
                          }
                          // Toggle: if already selected, deselect it
                          if (selectedGroupId === group.id) {
                            setSelectedGroupId(null);
                            setSelectedAssigneeIds([]);
                          } else {
                            // Select this group (only one group can be selected)
                            setSelectedGroupId(group.id);
                            setSelectedAssigneeIds([]); // Reset assignees when changing group
                          }
                        }}
                        className={`px-4 py-2 rounded-full flex-row items-center gap-2 ${
                          selectedGroupId === group.id
                            ? 'bg-primary'
                            : 'bg-gray-100 dark:bg-gray-800'
                        }`}
                      >
                        <Users 
                          size={14} 
                          color={selectedGroupId === group.id ? '#ffffff' : colors.textSub} 
                        />
                        <Text
                          className={`font-semibold ${
                            selectedGroupId === group.id
                              ? 'text-white'
                              : 'text-gray-700 dark:text-gray-300'
                          }`}
                        >
                          {group.name}
                        </Text>
                      </Pressable>
                    ))}
                </View>
              </ScrollView>

              {/* Title row: input + location icon (icon only when no location; tap to open field) */}
              <View className="flex-row items-center gap-2 mb-4">
                <TextInput
                  className="flex-1 bg-gray-50 dark:bg-gray-800 rounded-xl px-4 py-4 text-base text-gray-900 dark:text-white min-w-0"
                  placeholder="What do you want to do?"
                  placeholderTextColor="#9ca3af"
                  value={title}
                  onChangeText={setTitle}
                  editable={true}
                />
                {location == null && (
                  <Pressable
                    onPress={() => {
                      if (Platform.OS === 'ios') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
                      setShowLocationField(true);
                    }}
                    className="rounded-xl bg-gray-50 dark:bg-gray-800 p-3 border border-gray-200 dark:border-gray-600"
                  >
                    <MapPin size={22} color={colors.textSub} strokeWidth={2} />
                  </Pressable>
                )}
              </View>

              {/* Location field: only when icon was tapped (no location) or when location is set (chip) */}
              {(showLocationField && location == null) || location != null ? (
                <View className="mb-4">
                  <LocationInput
                    value={location}
                    onChange={(v) => {
                      setLocation(v);
                      if (v == null) setShowLocationField(false);
                    }}
                    hideTriggerWhenEmpty={true}
                    expandedWhenEmpty={showLocationField && location == null}
                    onCollapse={() => setShowLocationField(false)}
                  />
                </View>
              ) : null}

              {/* Assignee Bar (only for group tasks) */}
              {selectedGroupId && currentGroup && (
                <View className="mb-4">
                  <Text className="text-sm text-gray-600 dark:text-gray-400 mb-2">
                    Assign to:
                  </Text>
                  <ScrollView
                    horizontal
                    showsHorizontalScrollIndicator={false}
                  >
                    <View className="flex-row gap-3">
                      {currentGroup.members.map(member => {
                        const isSelected = selectedAssigneeIds.includes(member.id);
                        const isCurrentUser = member.id === user?.id;
                        
                        return (
                          <Pressable
                            key={member.id}
                            onPress={() => {
                              if (Platform.OS === 'ios') {
                                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
                              }
                              toggleAssignee(member.id);
                            }}
                            className={`px-4 py-2 rounded-full flex-row items-center gap-2 border-2 ${
                              isSelected
                                ? 'bg-blue-50 dark:bg-blue-900/30 border-primary'
                                : 'bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700'
                            }`}
                          >
                            {/* Avatar placeholder */}
                            <View 
                              className="w-6 h-6 rounded-full items-center justify-center"
                              style={{ backgroundColor: member.profileColor }}
                            >
                              <Text className="text-white text-xs font-bold">
                                {member.name.charAt(0).toUpperCase()}
                              </Text>
                            </View>
                            
                            <Text
                              className={`font-semibold ${
                                isSelected
                                  ? 'text-primary dark:text-primary'
                                  : 'text-gray-700 dark:text-gray-300'
                              }`}
                            >
                              {member.name} {isCurrentUser ? '(Me)' : ''}
                            </Text>
                          </Pressable>
                        );
                      })}
                    </View>
                  </ScrollView>
                  
                  {/* Assignee count */}
                  {selectedAssigneeIds.length > 0 && (
                    <Text className="text-xs text-gray-500 dark:text-gray-400 mt-2">
                      {selectedAssigneeIds.length} {selectedAssigneeIds.length === 1 ? 'person' : 'people'} selected
                    </Text>
                  )}
                </View>
              )}

              {/* Quick Date Chips */}
              <View className="flex-row gap-2 mb-4">
                {/* Today button */}
                <Pressable
                  onPress={() => {
                    if (Platform.OS === 'ios') {
                      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
                    }
                    handleQuickDate(new Date());
                  }}
                  className={`px-4 py-2 rounded-full ${
                    isDateSelected(new Date())
                      ? 'bg-primary'
                      : 'bg-gray-100 dark:bg-gray-800'
                  }`}
                >
                  <Text
                    className={`font-semibold ${
                      isDateSelected(new Date())
                        ? 'text-white'
                        : 'text-gray-700 dark:text-gray-300'
                    }`}
                  >
                    Today
                  </Text>
                </Pressable>

                {/* Tomorrow button */}
                <Pressable
                  onPress={() => {
                    if (Platform.OS === 'ios') {
                      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
                    }
                    handleQuickDate(addDays(new Date(), 1));
                  }}
                  className={`px-4 py-2 rounded-full ${
                    isDateSelected(addDays(new Date(), 1))
                      ? 'bg-primary'
                      : 'bg-gray-100 dark:bg-gray-800'
                  }`}
                >
                  <Text
                    className={`font-semibold ${
                      isDateSelected(addDays(new Date(), 1))
                        ? 'text-white'
                        : 'text-gray-700 dark:text-gray-300'
                    }`}
                  >
                    Tomorrow
                  </Text>
                </Pressable>

                {/* Pick date button */}
                <Pressable
                  onPress={() => {
                    if (Platform.OS === 'ios') {
                      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
                    }
                    setShowDatePicker(true);
                  }}
                  className={`px-4 py-2 rounded-full ${
                    dueDate && !isToday(dueDate) && !isTomorrow(dueDate)
                      ? 'bg-primary'
                      : 'bg-gray-100 dark:bg-gray-800'
                  }`}
                >
                  <Text
                    className={`font-semibold ${
                      dueDate && !isToday(dueDate) && !isTomorrow(dueDate)
                        ? 'text-white'
                        : 'text-gray-700 dark:text-gray-300'
                    }`}
                  >
                    {dueDate && !isToday(dueDate) && !isTomorrow(dueDate)
                      ? format(dueDate, 'MMM d')
                      : '📅 Date'}
                  </Text>
                </Pressable>
              </View>

              {/* Time Selection: [아이콘+시작시간+제거] ~ [아이콘+종료시간+제거] */}
              {dueDate && (
                <View className="flex-row items-center flex-wrap gap-2 mb-4" style={{ flexDirection: 'row', alignItems: 'center' }}>
                  {/* 그룹: 시작시간 */}
                  <View className="flex-row items-center rounded-lg border border-gray-200 dark:border-gray-600 bg-gray-50 dark:bg-gray-800 pl-2 pr-1 py-2" style={{ flexDirection: 'row', alignItems: 'center' }}>
                    <Text className="text-gray-700 dark:text-gray-300 mr-1.5">🕐</Text>
                    <Pressable
                      onPress={() => {
                        if (Platform.OS === 'ios') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
                      timeBeforeOpenRef.current = dueTime ? new Date(dueTime.getTime()) : null;
                        setTimePickerValue(dueTime ?? getDefaultTime());
                        if (Platform.OS === 'web') setWebStartPickerValue(dueTime ?? getDefaultTime());
                        setShowTimePicker(true);
                      }}
                    className="py-1 px-1 rounded min-w-[64px]"
                    >
                      <Text className="text-gray-700 dark:text-gray-300 font-medium">
                        {dueTime ? format(dueTime, 'HH:mm') : 'Start (Optional)'}
                      </Text>
                    </Pressable>
                    {dueTime != null && (
                      <Pressable
                        onPress={() => {
                          if (Platform.OS === 'ios') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
                          setDueTime(null);
                        }}
                        className="rounded-full p-1 ml-0.5 items-center justify-center bg-gray-200/40 dark:bg-gray-600/40 active:opacity-70"
                        hitSlop={{ top: 16, bottom: 16, left: 16, right: 16 }}
                      >
                        <X size={14} color="#64748B" strokeWidth={2.5} />
                      </Pressable>
                    )}
                  </View>
                  <Text className="text-gray-500 dark:text-gray-400 font-medium">~</Text>
                  {/* 그룹: 종료시간 */}
                  <View className="flex-row items-center rounded-lg border border-gray-200 dark:border-gray-600 bg-gray-50 dark:bg-gray-800 pl-2 pr-1 py-2" style={{ flexDirection: 'row', alignItems: 'center' }}>
                    <Text className="text-gray-700 dark:text-gray-300 mr-1.5">🕐</Text>
                    <Pressable
                      onPress={() => {
                        if (Platform.OS === 'ios') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
                      endTimeBeforeOpenRef.current = dueTimeEnd ? new Date(dueTimeEnd.getTime()) : null;
                        setEndTimePickerValue(dueTimeEnd ?? dueTime ?? getDefaultTime());
                        if (Platform.OS === 'web') setWebEndPickerValue(dueTimeEnd ?? dueTime ?? getDefaultTime());
                        setShowEndTimePicker(true);
                      }}
                    className="py-1 px-1 rounded min-w-[64px]"
                    >
                      <Text className="text-gray-700 dark:text-gray-300 font-medium">
                        {dueTimeEnd ? format(dueTimeEnd, 'HH:mm') : 'End (Optional)'}
                      </Text>
                    </Pressable>
                    {dueTimeEnd != null && (
                      <Pressable
                        onPress={() => {
                          if (Platform.OS === 'ios') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
                          setDueTimeEnd(null);
                        }}
                        className="rounded-full p-1 ml-0.5 items-center justify-center bg-gray-200/40 dark:bg-gray-600/40 active:opacity-70"
                        hitSlop={{ top: 16, bottom: 16, left: 16, right: 16 }}
                      >
                        <X size={14} color="#64748B" strokeWidth={2.5} />
                      </Pressable>
                    )}
                  </View>
                </View>
              )}

              {/* DateTimePicker - Native iOS (Calendar) */}
              {Platform.OS === 'ios' && showDatePicker && (
                <View className="bg-gray-50 dark:bg-gray-800 rounded-xl p-2 mb-4" style={{ maxHeight: 350 }}>
                  <View style={{ transform: [{ scale: 0.85 }], marginTop: -10, marginBottom: -10 }}>
                    <DateTimePicker
                      value={dueDate || new Date()} // Default: today
                      mode="date"
                      display="inline"
                      accentColor="#2563eb" // theme primary (V0 blue)
                      minimumDate={new Date()} // Prevent past dates
                      onChange={(event, selectedDate) => {
                        if (selectedDate) {
                          // Double check: ensure selected date is not in the past
                          const today = new Date();
                          today.setHours(0, 0, 0, 0);
                          const selected = new Date(selectedDate);
                          selected.setHours(0, 0, 0, 0);
                          
                          if (selected >= today) {
                            handleQuickDate(selectedDate);
                          } else {
                            showToast('error', '날짜 선택', '과거 날짜는 선택할 수 없습니다.');
                          }
                        }
                      }}
                    />
                  </View>
                  <View className="flex-row gap-3 mt-2">
                    <Pressable
                      onPress={() => {
                        if (Platform.OS === 'ios') {
                          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
                        }
                        setDueDate(null);
                        setDueTime(null);
                        setDueTimeEnd(null);
                        setShowDatePicker(false);
                      }}
                      className="flex-1 bg-white dark:bg-gray-900 rounded-xl py-3 items-center border border-gray-200 dark:border-gray-700"
                    >
                      <Text className="text-gray-700 dark:text-gray-300 font-semibold">
                        Cancel
                      </Text>
                    </Pressable>
                    <Pressable
                      onPress={() => {
                        if (Platform.OS === 'ios') {
                          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
                        }
                        setShowDatePicker(false);
                      }}
                      className="flex-1 bg-primary rounded-xl py-3 items-center"
                    >
                      <Text className="text-white font-semibold">Apply</Text>
                    </Pressable>
                  </View>
                </View>
              )}

              {Platform.OS === 'ios' && showTimePicker && (
                <View className="bg-gray-50 dark:bg-gray-800 rounded-xl p-2 mb-4" style={{ maxHeight: 250 }}>
                  <View style={{ transform: [{ scale: 0.85 }], marginTop: -10, marginBottom: -10 }}>
                    <DateTimePicker
                      value={timePickerValue ?? getDefaultTime()}
                      mode="time"
                      display="spinner"
                      minuteInterval={5}
                      onChange={(event, selectedTime) => {
                        if (selectedTime) {
                          setTimePickerValue(selectedTime);
                          setDueTime(selectedTime);
                        }
                      }}
                    />
                  </View>
                  <View className="flex-row gap-3 mt-2">
                    <Pressable
                      onPress={() => {
                        if (Platform.OS === 'ios') {
                          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
                        }
                        setDueTime(timeBeforeOpenRef.current);
                        setShowTimePicker(false);
                      }}
                      className="flex-1 bg-white dark:bg-gray-900 rounded-xl py-3 items-center border border-gray-200 dark:border-gray-700"
                    >
                      <Text className="text-gray-700 dark:text-gray-300 font-semibold">
                        Cancel
                      </Text>
                    </Pressable>
                    <Pressable
                      onPress={() => {
                        if (Platform.OS === 'ios') {
                          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
                        }
                        setDueTime(timePickerValue ?? getDefaultTime());
                        setShowTimePicker(false);
                      }}
                      className="flex-1 bg-primary rounded-xl py-3 items-center"
                    >
                      <Text className="text-white font-semibold">Apply</Text>
                    </Pressable>
                  </View>
                </View>
              )}

              {Platform.OS === 'ios' && showEndTimePicker && (
                <View className="bg-gray-50 dark:bg-gray-800 rounded-xl p-2 mb-4" style={{ maxHeight: 250 }}>
                  <View style={{ transform: [{ scale: 0.85 }], marginTop: -10, marginBottom: -10 }}>
                    <DateTimePicker
                      value={endTimePickerValue ?? dueTime ?? getDefaultTime()}
                      mode="time"
                      display="spinner"
                      minuteInterval={5}
                      onChange={(event, selectedTime) => {
                        if (selectedTime) {
                          setEndTimePickerValue(selectedTime);
                          setDueTimeEnd(selectedTime);
                        }
                      }}
                    />
                  </View>
                  <View className="flex-row gap-3 mt-2">
                    <Pressable
                      onPress={() => {
                        if (Platform.OS === 'ios') {
                          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
                        }
                        setDueTimeEnd(endTimeBeforeOpenRef.current);
                        setShowEndTimePicker(false);
                      }}
                      className="flex-1 bg-white dark:bg-gray-900 rounded-xl py-3 items-center border border-gray-200 dark:border-gray-700"
                    >
                      <Text className="text-gray-700 dark:text-gray-300 font-semibold">
                        Cancel
                      </Text>
                    </Pressable>
                    <Pressable
                      onPress={() => {
                        if (Platform.OS === 'ios') {
                          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
                        }
                        setDueTimeEnd(endTimePickerValue ?? dueTime ?? getDefaultTime());
                        setShowEndTimePicker(false);
                      }}
                      className="flex-1 bg-primary rounded-xl py-3 items-center"
                    >
                      <Text className="text-white font-semibold">Apply</Text>
                    </Pressable>
                  </View>
                </View>
              )}

              {/* DateTimePicker - Android (Dialog) */}
              {Platform.OS === 'android' && showDatePicker && (
                <DateTimePicker
                  value={dueDate || new Date()}
                  mode="date"
                  display="default"
                  minimumDate={new Date()} // Prevent past dates
                  onChange={(event, selectedDate) => {
                    setShowDatePicker(false);
                    if (event.type === 'set' && selectedDate) {
                      // Double check: ensure selected date is not in the past
                      const today = new Date();
                      today.setHours(0, 0, 0, 0);
                      const selected = new Date(selectedDate);
                      selected.setHours(0, 0, 0, 0);
                      
                      if (selected >= today) {
                        setDueDate(selectedDate);
                      } else {
                        showToast('error', '날짜 선택', '과거 날짜는 선택할 수 없습니다.');
                      }
                    }
                  }}
                />
              )}

              {Platform.OS === 'android' && showTimePicker && (
                <DateTimePicker
                  value={dueTime || getDefaultTime()}
                  mode="time"
                  display="default"
                  minuteInterval={5}
                  onChange={(event, selectedTime) => {
                    setShowTimePicker(false);
                    if (event.type === 'set' && selectedTime) {
                      setDueTime(selectedTime);
                    }
                  }}
                />
              )}

              {Platform.OS === 'android' && showEndTimePicker && (
                <DateTimePicker
                  value={dueTimeEnd || dueTime || getDefaultTime()}
                  mode="time"
                  display="default"
                  minuteInterval={5}
                  onChange={(event, selectedTime) => {
                    setShowEndTimePicker(false);
                    if (event.type === 'set' && selectedTime) {
                      setDueTimeEnd(selectedTime);
                    }
                  }}
                />
              )}

              {/* DateTimePicker - Web (HTML Input) */}
              {Platform.OS === 'web' && (
                <>
                  {/* Hidden input for date picker - always rendered */}
                  <input
                    ref={dateInputRef}
                    type="date"
                    value={dueDate ? format(dueDate, 'yyyy-MM-dd') : ''}
                    min={format(new Date(), 'yyyy-MM-dd')} // Prevent past dates
                    onChange={(e) => {
                      if (e.target.value) {
                        const selected = parse(e.target.value, 'yyyy-MM-dd', new Date());
                        // Double check: ensure selected date is not in the past
                        const today = new Date();
                        today.setHours(0, 0, 0, 0);
                        const selectedDate = new Date(selected);
                        selectedDate.setHours(0, 0, 0, 0);
                        
                        if (selectedDate >= today) {
                          setDueDate(selected);
                        } else {
                          showToast('error', '날짜 선택', '과거 날짜는 선택할 수 없습니다.');
                        }
                      }
                      setShowDatePicker(false);
                    }}
                    onBlur={() => setShowDatePicker(false)}
                    style={{
                      position: 'absolute',
                      opacity: 0,
                      width: 0,
                      height: 0,
                      pointerEvents: 'none',
                      zIndex: -1,
                    }}
                  />
                  {/* Visible date picker UI when showDatePicker is true */}
                  {showDatePicker && (
                    <View className="mb-4">
                      <Text className="text-sm text-gray-600 dark:text-gray-400 mb-2">
                        날짜를 선택하세요 (과거 날짜는 선택할 수 없습니다)
                      </Text>
                    </View>
                  )}
                </>
              )}

              {Platform.OS === 'web' && showTimePicker && (
                <View className="mb-4 p-4 bg-gray-100 dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700">
                  <Text className="text-sm text-gray-600 dark:text-gray-400 mb-2">시작 시간</Text>
                  <input
                    ref={timeInputRef}
                    type="time"
                    value={format(webStartPickerValue ?? getDefaultTime(), 'HH:mm')}
                    step="300"
                    onChange={(e) => {
                      if (e.target.value) {
                        const [h, m] = e.target.value.split(':');
                        const d = new Date();
                        d.setHours(parseInt(h, 10), parseInt(m, 10), 0);
                        setWebStartPickerValue(d);
                      }
                    }}
                    style={{
                      width: '100%',
                      padding: 12,
                      borderRadius: borderRadius.md,
                      border: '1px solid #d1d5db',
                      fontSize: 16,
                      marginBottom: 12,
                    }}
                  />
                  <View className="flex-row gap-3">
                    <Pressable
                      onPress={() => {
                        setDueTime(timeBeforeOpenRef.current);
                        setShowTimePicker(false);
                      }}
                      className="flex-1 bg-white dark:bg-gray-700 rounded-xl py-3 items-center border border-gray-200 dark:border-gray-600"
                    >
                      <Text className="text-gray-700 dark:text-gray-300 font-semibold">Cancel</Text>
                    </Pressable>
                    <Pressable
                      onPress={() => {
                        setDueTime(webStartPickerValue ?? getDefaultTime());
                        setShowTimePicker(false);
                      }}
                      className="flex-1 bg-primary rounded-xl py-3 items-center"
                    >
                      <Text className="text-white font-semibold">Apply</Text>
                    </Pressable>
                  </View>
                </View>
              )}

              {Platform.OS === 'web' && showEndTimePicker && (
                <View className="mb-4 p-4 bg-gray-100 dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700">
                  <Text className="text-sm text-gray-600 dark:text-gray-400 mb-2">종료 시간</Text>
                  <input
                    ref={endTimeInputRef}
                    type="time"
                    value={format(webEndPickerValue ?? getDefaultTime(), 'HH:mm')}
                    step="300"
                    onChange={(e) => {
                      if (e.target.value) {
                        const [h, m] = e.target.value.split(':');
                        const d = new Date();
                        d.setHours(parseInt(h, 10), parseInt(m, 10), 0);
                        setWebEndPickerValue(d);
                      }
                    }}
                    style={{
                      width: '100%',
                      padding: 12,
                      borderRadius: borderRadius.md,
                      border: '1px solid #d1d5db',
                      fontSize: 16,
                      marginBottom: 12,
                    }}
                  />
                  <View className="flex-row gap-3">
                    <Pressable
                      onPress={() => {
                        setDueTimeEnd(endTimeBeforeOpenRef.current);
                        setShowEndTimePicker(false);
                      }}
                      className="flex-1 bg-white dark:bg-gray-700 rounded-xl py-3 items-center border border-gray-200 dark:border-gray-600"
                    >
                      <Text className="text-gray-700 dark:text-gray-300 font-semibold">Cancel</Text>
                    </Pressable>
                    <Pressable
                      onPress={() => {
                        setDueTimeEnd(webEndPickerValue ?? getDefaultTime());
                        setShowEndTimePicker(false);
                      }}
                      className="flex-1 bg-primary rounded-xl py-3 items-center"
                    >
                      <Text className="text-white font-semibold">Apply</Text>
                    </Pressable>
                  </View>
                </View>
              )}

              {/* Action Buttons - DatePicker/시간 모달이 열려있지 않을 때만 표시 */}
              {!showDatePicker && !showTimePicker && !showEndTimePicker && (
                <>
                  {submitError ? (
                    <Text className="text-red-600 dark:text-red-400 text-center text-sm mt-2 mb-1">
                      {submitError}
                    </Text>
                  ) : null}
                  <View className="flex-row gap-3 mt-2">
                    <Pressable
                      onPress={() => {
                        if (Platform.OS === 'ios') {
                          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
                        }
                        handleClose();
                      }}
                      className="flex-1 bg-gray-100 dark:bg-gray-800 rounded-xl py-4 items-center"
                      disabled={isSubmitting}
                    >
                      <Text className="text-gray-700 dark:text-gray-300 font-semibold">
                        Cancel
                      </Text>
                    </Pressable>

                    <Pressable
                      onPress={() => {
                        if (Platform.OS === 'ios') {
                          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
                        }
                        handleSave();
                      }}
                      className={`flex-1 bg-primary rounded-xl py-4 items-center ${isSubmitting ? 'opacity-70' : ''}`}
                      disabled={isSubmitting}
                    >
                      <Text className="text-white font-semibold">
                        {isSubmitting ? 'Saving…' : 'Save'}
                      </Text>
                    </Pressable>
                  </View>
                </>
              )}
            </View>
          </Pressable>
        </KeyboardAvoidingView>
      </Pressable>
    </Modal>
  );
}
