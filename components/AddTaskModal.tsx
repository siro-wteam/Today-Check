import { colors } from '@/constants/colors';
import { useAuth } from '@/lib/hooks/use-auth';
import { useGroupStore } from '@/lib/stores/useGroupStore';
import { useCalendarStore } from '@/lib/stores/useCalendarStore';
import DateTimePicker from '@react-native-community/datetimepicker';
import { useQueryClient } from '@tanstack/react-query';
import { addDays, format, isToday, isTomorrow, parse } from 'date-fns';
import { Users } from 'lucide-react-native';
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
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [showTimePicker, setShowTimePicker] = useState(false);
  
  // Group task fields
  const [selectedGroupId, setSelectedGroupId] = useState<string | null>(null); // null = personal task
  const [selectedAssigneeIds, setSelectedAssigneeIds] = useState<string[]>([]);

  const dateInputRef = useRef<any>(null);
  const timeInputRef = useRef<any>(null);

  const { addTask } = useCalendarStore();
  const { groups, fetchMyGroups } = useGroupStore();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [isCreating, setIsCreating] = useState(false);
  
  // Get current group's members
  const currentGroup = groups.find(g => g.id === selectedGroupId);

  // Fetch groups when modal opens (ensure fresh data)
  useEffect(() => {
    if (visible && user?.id) {
      // Fetch groups to ensure we have latest data
      fetchMyGroups(user.id);
    }
  }, [visible, user?.id, fetchMyGroups]);

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

  // 웹에서 시간 선택기 자동 열기
  useEffect(() => {
    if (Platform.OS === 'web' && showTimePicker && timeInputRef.current) {
      setTimeout(() => {
        timeInputRef.current?.showPicker?.();
      }, 100);
    }
  }, [showTimePicker]);

  const resetForm = () => {
    setTitle('');
    setDueDate(null);
    setDueTime(null);
    setSelectedGroupId(null);
    setSelectedAssigneeIds([]);
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

    // Remove @mentions from title before saving (using actual selected assignee nicknames)
    let cleanedTitle = title;
    
    // Remove each selected assignee's @mention exactly
    if (selectedGroupId && currentGroup) {
      selectedAssigneeIds.forEach(assigneeId => {
        const member = currentGroup.members.find(m => m.id === assigneeId);
        if (member) {
          // Remove exact @nickname (escape special regex characters)
          const escapedNickname = member.name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
          const mentionRegex = new RegExp(`@${escapedNickname}\\s*`, 'g');
          cleanedTitle = cleanedTitle.replace(mentionRegex, '');
        }
      });
    }
    
    // Clean up extra spaces and commas
    cleanedTitle = cleanedTitle
      .replace(/[,\s]+/g, ' ')
      .trim();

    // date-fns format으로 로컬 타임존 기준 문자열 생성
    const dueDateStr = dueDate ? format(dueDate, 'yyyy-MM-dd') : null;
    const dueTimeStr = dueTime ? format(dueTime, 'HH:mm:ss') : null;

    setIsCreating(true);
    
    try {
      if (selectedGroupId) {
        // Group task (with or without assignees)
        const result = await addTask({
          title: cleanedTitle,
          group_id: selectedGroupId,
          assignee_ids: selectedAssigneeIds, // Can be empty array
          due_date: dueDateStr,
          due_time: dueTimeStr,
        });

        if (result.success) {
          // Invalidate queries to refresh React Query cache
          queryClient.invalidateQueries({ queryKey: ['tasks', 'today'] });
          queryClient.invalidateQueries({ queryKey: ['tasks'] });
          handleClose();
        } else {
          // Error toast is already shown by addTask
        }
      } else {
        // Personal task (single user)
        const result = await addTask({
          title: cleanedTitle,
          due_date: dueDateStr,
          due_time: dueTimeStr,
        });

        if (result.success) {
          // Invalidate queries to refresh React Query cache
          queryClient.invalidateQueries({ queryKey: ['tasks', 'today'] });
          queryClient.invalidateQueries({ queryKey: ['tasks'] });
          handleClose();
        } else {
          // Error toast is already shown by addTask
        }
      }
    } catch (error: any) {
      showToast('error', 'Save Failed', error.message);
    } finally {
      setIsCreating(false);
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

              {/* Title Input */}
              <TextInput
                className="bg-gray-50 dark:bg-gray-800 rounded-xl px-4 py-4 text-base text-gray-900 dark:text-white mb-4"
                placeholder="What do you want to do?"
                placeholderTextColor="#9ca3af"
                value={title}
                onChangeText={setTitle}
                editable={!isCreating}
              />

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
                      : '📅 Pick Date'}
                  </Text>
                </Pressable>
              </View>

              {/* Time Selection (only if date is selected) */}
              {dueDate && (
                <Pressable
                  onPress={() => {
                    if (Platform.OS === 'ios') {
                      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
                    }
                    setShowTimePicker(true);
                  }}
                  className="bg-gray-50 dark:bg-gray-800 rounded-xl px-4 py-3 mb-4"
                >
                  <Text className="text-gray-700 dark:text-gray-300">
                    {dueTime ? `⏰ ${format(dueTime, 'HH:mm')}` : '⏰ Pick Time (Optional)'}
                  </Text>
                </Pressable>
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
                      value={dueTime || getDefaultTime()} // Default: current time + 1 hour, 00 min
                      mode="time"
                      display="spinner"
                      minuteInterval={5} // 5-minute intervals
                      onChange={(event, selectedTime) => {
                        if (selectedTime) {
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
                        setDueTime(null);
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
                        setShowTimePicker(false);
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
                <View className="mb-4">
                  <input
                    ref={timeInputRef}
                    type="time"
                    defaultValue={dueTime ? format(dueTime, 'HH:mm') : format(getDefaultTime(), 'HH:mm')}
                    step="300"
                    onChange={(e) => {
                      if (e.target.value) {
                        const [hours, minutes] = e.target.value.split(':');
                        const selected = new Date();
                        selected.setHours(parseInt(hours), parseInt(minutes), 0);
                        setDueTime(selected);
                      }
                      setShowTimePicker(false);
                    }}
                    onBlur={() => setShowTimePicker(false)}
                    style={{
                      width: '100%',
                      padding: '12px',
                      borderRadius: '12px',
                      border: '1px solid #d1d5db',
                      fontSize: '16px',
                    }}
                  />
                </View>
              )}

              {/* Action Buttons - DatePicker가 열려있지 않을 때만 표시 */}
              {!showDatePicker && !showTimePicker && (
                <View className="flex-row gap-3 mt-2">
                  <Pressable
                    onPress={() => {
                      if (Platform.OS === 'ios') {
                        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
                      }
                      handleClose();
                    }}
                    className="flex-1 bg-gray-100 dark:bg-gray-800 rounded-xl py-4 items-center"
                    disabled={isCreating}
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
                    className={`flex-1 bg-primary rounded-xl py-4 items-center ${
                      isCreating ? 'opacity-50' : ''
                    }`}
                    disabled={isCreating}
                  >
                    <Text className="text-white font-semibold">
                      {isCreating ? 'Saving...' : 'Save'}
                    </Text>
                  </Pressable>
                </View>
              )}
            </View>
          </Pressable>
        </KeyboardAvoidingView>
      </Pressable>
    </Modal>
  );
}
