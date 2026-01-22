import { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  TextInput,
  Pressable,
  Modal,
  KeyboardAvoidingView,
  Platform,
  Alert,
} from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import { addDays, parse, format, isToday, isTomorrow, parseISO } from 'date-fns';
import { Trash2 } from 'lucide-react-native';
import { updateTask, deleteTask } from '@/lib/api/tasks';

interface EditTaskBottomSheetProps {
  visible: boolean;
  onClose: () => void;
  task: {
    id: string;
    title: string;
    due_date: string | null;
    due_time: string | null;
  };
  onUpdate: () => void; // Callback after task is updated
  onDateChange?: (dateStr: string) => void; // Optional callback when date changes (for navigation)
}

export function EditTaskBottomSheet({ visible, onClose, task, onUpdate, onDateChange }: EditTaskBottomSheetProps) {
  const [title, setTitle] = useState(task.title);
  const [dueDate, setDueDate] = useState<Date | null>(task.due_date ? parseISO(task.due_date) : null);
  const [dueTime, setDueTime] = useState<Date | null>(task.due_time ? parseISO(`2000-01-01T${task.due_time}`) : null);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [showTimePicker, setShowTimePicker] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);

  const dateInputRef = useRef<any>(null);
  const timeInputRef = useRef<any>(null);

  // Reset form when task changes
  useEffect(() => {
    if (visible) {
      setTitle(task.title);
      setDueDate(task.due_date ? parseISO(task.due_date) : null);
      setDueTime(task.due_time ? parseISO(`2000-01-01T${task.due_time}`) : null);
      setHasChanges(false);
    }
  }, [visible, task]);

  // Track changes
  useEffect(() => {
    const titleChanged = title !== task.title;
    const dateChanged = (dueDate ? format(dueDate, 'yyyy-MM-dd') : null) !== task.due_date;
    const timeChanged = (dueTime ? format(dueTime, 'HH:mm:ss') : null) !== task.due_time;
    setHasChanges(titleChanged || dateChanged || timeChanged);
  }, [title, dueDate, dueTime, task]);

  // 웹에서 날짜 선택기 자동 열기
  useEffect(() => {
    if (Platform.OS === 'web' && showDatePicker && dateInputRef.current) {
      setTimeout(() => {
        dateInputRef.current?.showPicker?.();
      }, 100);
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

  // 기본 시간 계산: 현재시간 + 1시간, 분은 00분
  const getDefaultTime = () => {
    const now = new Date();
    const defaultTime = new Date();
    defaultTime.setHours(now.getHours() + 1);
    defaultTime.setMinutes(0);
    defaultTime.setSeconds(0);
    return defaultTime;
  };

  const handleSave = async () => {
    if (!title.trim()) {
      if (Platform.OS === 'web') {
        alert('Task title cannot be empty');
      } else {
        Alert.alert('Error', 'Task title cannot be empty');
      }
      return;
    }

    const updates: any = {
      title: title.trim(),
    };

    if (dueDate) {
      updates.due_date = format(dueDate, 'yyyy-MM-dd');
      updates.original_due_date = format(dueDate, 'yyyy-MM-dd');
    } else {
      updates.due_date = null;
      updates.original_due_date = null;
    }

    if (dueTime) {
      updates.due_time = format(dueTime, 'HH:mm:ss');
    } else {
      updates.due_time = null;
    }

    await updateTask({ id: task.id, ...updates });
    onUpdate();
    onClose();
  };

  const handleDelete = async () => {
    await deleteTask(task.id);
    onUpdate();
    onClose();
  };

  const handleQuickDate = (date: Date | null) => {
    // DatePicker가 열려있으면 닫기
    setShowDatePicker(false);
    setShowTimePicker(false);

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
    
    const newDate = date;
    setDueDate(newDate);
    
    // If date changed, notify parent for navigation
    if (onDateChange && newDate) {
      const dateStr = format(newDate, 'yyyy-MM-dd');
      if (task.due_date !== dateStr) {
        onDateChange(dateStr);
      }
    }
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
      onRequestClose={onClose}
    >
      <Pressable
        className="flex-1 bg-black/50 justify-end"
        onPress={onClose}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        >
          <Pressable onPress={(e) => e.stopPropagation()}>
            <View className="bg-white dark:bg-gray-900 rounded-t-3xl px-6 py-6">
              {/* Header */}
              <View className="flex-row justify-between items-center mb-6">
                <Text className="text-xl font-bold text-gray-900 dark:text-white">
                  Edit Task
                </Text>
                <View className="flex-row items-center gap-3">
                  {/* Delete Button */}
                  <Pressable onPress={handleDelete}>
                    <Trash2 size={24} color="#EF4444" strokeWidth={2} />
                  </Pressable>
                  {/* Close Button */}
                  <Pressable onPress={onClose}>
                    <Text className="text-gray-500 dark:text-gray-400 text-2xl">×</Text>
                  </Pressable>
                </View>
              </View>

              {/* Title Input */}
              <TextInput
                className="bg-gray-50 dark:bg-gray-800 rounded-xl px-4 py-4 text-base text-gray-900 dark:text-white mb-4"
                placeholder="What do you want to do?"
                placeholderTextColor="#9ca3af"
                value={title}
                onChangeText={setTitle}
                autoFocus
              />

              {/* Quick Date Chips */}
              <View className="flex-row gap-2 mb-4">
                {/* Today button */}
                <Pressable
                  onPress={() => handleQuickDate(new Date())}
                  className={`px-4 py-2 rounded-full ${
                    isDateSelected(new Date())
                      ? 'bg-blue-600'
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
                  onPress={() => handleQuickDate(addDays(new Date(), 1))}
                  className={`px-4 py-2 rounded-full ${
                    isDateSelected(addDays(new Date(), 1))
                      ? 'bg-blue-600'
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
                  onPress={() => setShowDatePicker(true)}
                  className={`px-4 py-2 rounded-full ${
                    dueDate && !isToday(dueDate) && !isTomorrow(dueDate)
                      ? 'bg-blue-600'
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

              {/* Time Selection (only if date is selected AND date picker is closed) */}
              {dueDate && !showDatePicker && (
                <Pressable
                  onPress={() => setShowTimePicker(true)}
                  className="bg-gray-50 dark:bg-gray-800 rounded-xl px-4 py-3 mb-4"
                >
                  <Text className="text-gray-700 dark:text-gray-300">
                    {dueTime ? `⏰ ${format(dueTime, 'HH:mm')}` : '⏰ Pick Time (Optional)'}
                  </Text>
                </Pressable>
              )}

              {/* DateTimePicker - Native iOS (Inline Spinner) */}
              {Platform.OS === 'ios' && showDatePicker && (
                <View className="bg-gray-50 dark:bg-gray-800 rounded-xl p-4 mb-4">
                  <DateTimePicker
                    value={dueDate || new Date()} // Default: today
                    mode="date"
                    display="spinner"
                    onChange={(event, selectedDate) => {
                      if (selectedDate) {
                        const newDate = selectedDate;
                        setDueDate(newDate);
                        
                        // If date changed, notify parent for navigation
                        if (onDateChange) {
                          const dateStr = format(newDate, 'yyyy-MM-dd');
                          if (task.due_date !== dateStr) {
                            onDateChange(dateStr);
                          }
                        }
                      }
                    }}
                    minimumDate={new Date()}
                  />
                  <View className="flex-row gap-3 mt-4">
                    <Pressable
                      onPress={() => {
                        setDueDate(null);
                        setShowDatePicker(false);
                      }}
                      className="flex-1 bg-white dark:bg-gray-900 rounded-xl py-4 items-center border border-gray-200 dark:border-gray-700"
                    >
                      <Text className="text-gray-700 dark:text-gray-300 font-semibold">
                        Cancel
                      </Text>
                    </Pressable>
                    <Pressable
                      onPress={() => setShowDatePicker(false)}
                      className="flex-1 bg-blue-600 rounded-xl py-4 items-center"
                    >
                      <Text className="text-white font-semibold">Confirm</Text>
                    </Pressable>
                  </View>
                </View>
              )}

              {Platform.OS === 'ios' && showTimePicker && (
                <View className="bg-gray-50 dark:bg-gray-800 rounded-xl p-4 mb-4">
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
                  <View className="flex-row gap-3 mt-4">
                    <Pressable
                      onPress={() => {
                        setDueTime(null);
                        setShowTimePicker(false);
                      }}
                      className="flex-1 bg-white dark:bg-gray-900 rounded-xl py-4 items-center border border-gray-200 dark:border-gray-700"
                    >
                      <Text className="text-gray-700 dark:text-gray-300 font-semibold">
                        Remove Time
                      </Text>
                    </Pressable>
                    <Pressable
                      onPress={() => setShowTimePicker(false)}
                      className="flex-1 bg-blue-600 rounded-xl py-4 items-center"
                    >
                      <Text className="text-white font-semibold">Confirm</Text>
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
                  onChange={(event, selectedDate) => {
                    setShowDatePicker(false);
                    if (event.type === 'set' && selectedDate) {
                      setDueDate(selectedDate);
                      
                      // If date changed, notify parent for navigation
                      if (onDateChange) {
                        const dateStr = format(selectedDate, 'yyyy-MM-dd');
                        if (task.due_date !== dateStr) {
                          onDateChange(dateStr);
                        }
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
              {Platform.OS === 'web' && showDatePicker && (
                <View className="mb-4">
                  <input
                    ref={dateInputRef}
                    type="date"
                    defaultValue={dueDate ? format(dueDate, 'yyyy-MM-dd') : format(new Date(), 'yyyy-MM-dd')}
                    onChange={(e) => {
                      if (e.target.value) {
                        const selected = parse(e.target.value, 'yyyy-MM-dd', new Date());
                        setDueDate(selected);
                        
                        // If date changed, notify parent for navigation
                        if (onDateChange) {
                          const dateStr = e.target.value;
                          if (task.due_date !== dateStr) {
                            onDateChange(dateStr);
                          }
                        }
                      }
                      setShowDatePicker(false);
                    }}
                    onBlur={() => setShowDatePicker(false)}
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
                    onPress={onClose}
                    className="flex-1 bg-gray-100 dark:bg-gray-800 rounded-xl py-4 items-center"
                  >
                    <Text className="text-gray-700 dark:text-gray-300 font-semibold">
                      Cancel
                    </Text>
                  </Pressable>

                  <Pressable
                    onPress={handleSave}
                    className={`flex-1 bg-blue-600 rounded-xl py-4 items-center ${
                      !hasChanges ? 'opacity-50' : ''
                    }`}
                    disabled={!hasChanges}
                  >
                    <Text className="text-white font-semibold">
                      Save
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
