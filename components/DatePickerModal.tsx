import DateTimePicker from '@react-native-community/datetimepicker';
import { format } from 'date-fns';
import { Calendar } from 'lucide-react-native';
import { useEffect, useRef, useState } from 'react';
import { Modal, Platform, Pressable, StyleSheet, Text, View } from 'react-native';

interface DatePickerModalProps {
  visible: boolean;
  onClose: () => void;
  onSelectDate: (date: string) => void; // yyyy-MM-dd format
  title?: string;
}

export function DatePickerModal({ visible, onClose, onSelectDate, title = 'Pick a Date' }: DatePickerModalProps) {
  const [selectedDate, setSelectedDate] = useState(new Date());
  const webDateInputRef = useRef<HTMLInputElement>(null);

  // Web: Open picker immediately when visible becomes true (synchronous, no setTimeout)
  useEffect(() => {
    if (visible && Platform.OS === 'web' && webDateInputRef.current) {
      // Call showPicker() immediately without setTimeout to preserve user gesture
      try {
        webDateInputRef.current.showPicker();
      } catch (error) {
        // Fallback: if showPicker fails, focus the input
        webDateInputRef.current.focus();
      }
    }
  }, [visible]);

  const handleConfirm = () => {
    const dateStr = format(selectedDate, 'yyyy-MM-dd');
    onSelectDate(dateStr);
    onClose();
  };

  const handleWebDateChange = (e: any) => {
    const dateStr = e.target.value;
    if (dateStr) {
      setSelectedDate(new Date(dateStr));
      // Auto-close and confirm on web when date is selected
      onSelectDate(dateStr);
      onClose();
    }
  };

  return (
    <>
      {/* Web: Hidden input (always rendered, outside modal) */}
      {Platform.OS === 'web' && (
        <input
          ref={webDateInputRef as any}
          type="date"
          value={format(selectedDate, 'yyyy-MM-dd')}
          onChange={handleWebDateChange}
          style={StyleSheet.flatten([
            {
              opacity: 0,
              position: 'absolute',
              zIndex: -1,
              pointerEvents: 'none',
              width: 0,
              height: 0,
              overflow: 'hidden',
            },
          ]) as any}
        />
      )}

      {/* Native: Modal (only for native platforms) */}
      {Platform.OS !== 'web' && (
        <Modal
          visible={visible}
          transparent
          animationType="fade"
          onRequestClose={onClose}
        >
          <Pressable 
            className="flex-1 bg-black/50 justify-center items-center"
            onPress={onClose}
          >
            <Pressable 
              className="bg-white dark:bg-gray-900 rounded-2xl p-6 mx-4 w-full max-w-sm"
              onPress={(e) => e.stopPropagation()}
            >
              {/* Header */}
              <View className="flex-row items-center mb-6">
                <Calendar size={24} color="#3B82F6" strokeWidth={2} />
                <Text className="text-xl font-bold text-gray-900 dark:text-white ml-3">
                  {title}
                </Text>
              </View>

              {/* Date Picker */}
              <View className="items-center mb-4">
                <DateTimePicker
                  value={selectedDate}
                  mode="date"
                  display="spinner"
                  onChange={(event, date) => {
                    if (date) setSelectedDate(date);
                  }}
                  minimumDate={new Date()}
                />
              </View>

              {/* Actions */}
              <View className="flex-row gap-3">
                <Pressable
                  onPress={onClose}
                  className="flex-1 bg-gray-100 dark:bg-gray-800 py-3 rounded-lg active:opacity-70"
                >
                  <Text className="text-center font-semibold text-gray-700 dark:text-gray-300">
                    Cancel
                  </Text>
                </Pressable>

                <Pressable
                  onPress={handleConfirm}
                  className="flex-1 bg-blue-600 py-3 rounded-lg active:opacity-70"
                >
                  <Text className="text-center font-semibold text-white">
                    Confirm
                  </Text>
                </Pressable>
              </View>
            </Pressable>
          </Pressable>
        </Modal>
      )}
    </>
  );
}
