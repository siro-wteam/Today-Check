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
import { addDays, parse, format, differenceInCalendarDays } from 'date-fns';
import { useCreateTask } from '@/lib/hooks/use-create-task';

interface AddTaskModalProps {
  visible: boolean;
  onClose: () => void;
}

export function AddTaskModal({ visible, onClose }: AddTaskModalProps) {
  const [title, setTitle] = useState('');
  const [dueDate, setDueDate] = useState<Date | null>(null);
  const [dueTime, setDueTime] = useState<Date | null>(null);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [showTimePicker, setShowTimePicker] = useState(false);

  const dateInputRef = useRef<any>(null);
  const timeInputRef = useRef<any>(null);

  const { createTask, isCreating } = useCreateTask();

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

  const resetForm = () => {
    setTitle('');
    setDueDate(null);
    setDueTime(null);
  };

  const handleClose = () => {
    resetForm();
    onClose();
  };

  const handleSave = () => {
    if (!title.trim()) {
      if (Platform.OS === 'web') {
        alert('제목을 입력해주세요');
      } else {
        Alert.alert('알림', '제목을 입력해주세요');
      }
      return;
    }

    // date-fns format으로 로컬 타임존 기준 문자열 생성
    const taskData = {
      title: title.trim(),
      due_date: dueDate ? format(dueDate, 'yyyy-MM-dd') : null,
      due_time: dueTime ? format(dueTime, 'HH:mm:ss') : null,
    };

    createTask(taskData, {
      onSuccess: () => {
        handleClose();
      },
      onError: (error: any) => {
        if (Platform.OS === 'web') {
          alert('저장 실패: ' + error.message);
        } else {
          Alert.alert('저장 실패', error.message);
        }
      },
    });
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
    if (!dueDate) return '📅 날짜 선택';
    
    // 로컬 타임존 기준으로 오늘/내일 판단
    const today = new Date();
    const todayOnly = new Date(today.getFullYear(), today.getMonth(), today.getDate());
    const dueDateOnly = new Date(dueDate.getFullYear(), dueDate.getMonth(), dueDate.getDate());
    
    const diffDays = Math.floor((dueDateOnly.getTime() - todayOnly.getTime()) / (1000 * 60 * 60 * 24));
    
    if (diffDays === 0) return '오늘';
    if (diffDays === 1) return '내일';
    
    return `${dueDate.getMonth() + 1}월 ${dueDate.getDate()}일`;
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
            <View className="bg-white dark:bg-gray-900 rounded-t-3xl px-6 py-6">
              {/* Header */}
              <View className="flex-row justify-between items-center mb-6">
                <Text className="text-xl font-bold text-gray-900 dark:text-white">
                  새 할 일
                </Text>
                <Pressable onPress={handleClose}>
                  <Text className="text-gray-500 dark:text-gray-400 text-2xl">×</Text>
                </Pressable>
              </View>

              {/* Title Input */}
              <TextInput
                className="bg-gray-50 dark:bg-gray-800 rounded-xl px-4 py-4 text-base text-gray-900 dark:text-white mb-4"
                placeholder="할 일을 입력하세요"
                placeholderTextColor="#9ca3af"
                value={title}
                onChangeText={setTitle}
                autoFocus
                editable={!isCreating}
              />

              {/* Quick Date Chips */}
              <View className="flex-row gap-2 mb-4">
                {/* 오늘 버튼 */}
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
                    오늘
                  </Text>
                </Pressable>

                {/* 내일 버튼 */}
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
                    내일
                  </Text>
                </Pressable>

                {/* 날짜 선택 버튼 */}
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
                      ? format(dueDate, 'M월 d일')
                      : '📅 날짜 선택'}
                  </Text>
                </Pressable>
              </View>

              {/* Time Selection (only if date is selected) */}
              {dueDate && (
                <Pressable
                  onPress={() => setShowTimePicker(true)}
                  className="bg-gray-50 dark:bg-gray-800 rounded-xl px-4 py-3 mb-4"
                >
                  <Text className="text-gray-700 dark:text-gray-300">
                    {dueTime ? `⏰ ${format(dueTime, 'HH:mm')}` : '⏰ 시간 선택 (선택사항)'}
                  </Text>
                </Pressable>
              )}

              {/* DateTimePicker - Native iOS (Inline Spinner) */}
              {Platform.OS === 'ios' && showDatePicker && (
                <View className="bg-gray-50 dark:bg-gray-800 rounded-xl p-4 mb-4">
                  <DateTimePicker
                    value={dueDate || new Date()} // 기본값: 오늘
                    mode="date"
                    display="spinner"
                    onChange={(event, selectedDate) => {
                      if (selectedDate) {
                        setDueDate(selectedDate);
                      }
                    }}
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
                        취소
                      </Text>
                    </Pressable>
                    <Pressable
                      onPress={() => setShowDatePicker(false)}
                      className="flex-1 bg-blue-600 rounded-xl py-4 items-center"
                    >
                      <Text className="text-white font-semibold">확인</Text>
                    </Pressable>
                  </View>
                </View>
              )}

              {Platform.OS === 'ios' && showTimePicker && (
                <View className="bg-gray-50 dark:bg-gray-800 rounded-xl p-4 mb-4">
                  <DateTimePicker
                    value={dueTime || getDefaultTime()} // 기본값: 현재시간 + 1시간, 00분
                    mode="time"
                    display="spinner"
                    minuteInterval={5} // 5분 간격
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
                        취소
                      </Text>
                    </Pressable>
                    <Pressable
                      onPress={() => setShowTimePicker(false)}
                      className="flex-1 bg-blue-600 rounded-xl py-4 items-center"
                    >
                      <Text className="text-white font-semibold">확인</Text>
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
                    onPress={handleClose}
                    className="flex-1 bg-gray-100 dark:bg-gray-800 rounded-xl py-4 items-center"
                    disabled={isCreating}
                  >
                    <Text className="text-gray-700 dark:text-gray-300 font-semibold">
                      취소
                    </Text>
                  </Pressable>

                  <Pressable
                    onPress={handleSave}
                    className={`flex-1 bg-blue-600 rounded-xl py-4 items-center ${
                      isCreating ? 'opacity-50' : ''
                    }`}
                    disabled={isCreating}
                  >
                    <Text className="text-white font-semibold">
                      {isCreating ? '저장 중...' : '저장'}
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
