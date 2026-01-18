import { AddTaskModal } from '@/components/AddTaskModal';
import { signOut, useAuth } from '@/lib/hooks/use-auth';
import { useTodayTasks } from '@/lib/hooks/use-today-tasks';
import type { TaskWithRollover } from '@/lib/types';
import { useState } from 'react';
import { ActivityIndicator, Alert, Platform, Pressable, SafeAreaView, ScrollView, Text, View } from 'react-native';

export default function HomeScreen() {
  const { tasks, isLoading, isError, error, toggleTask, refetch } = useTodayTasks();
  const { user } = useAuth();
  const [isAddModalVisible, setIsAddModalVisible] = useState(false);
  
  const today = new Date().toLocaleDateString('en-US', { 
    weekday: 'short', 
    month: 'short', 
    day: 'numeric' 
  });

  const handleSignOut = async () => {
    console.log('Sign Out button pressed');
    
    // Web에서는 confirm 사용
    if (Platform.OS === 'web') {
      const confirmed = window.confirm('Are you sure you want to sign out?');
      if (!confirmed) return;
      
      console.log('Signing out...');
      const { error } = await signOut();
      if (error) {
        console.error('Sign out error:', error);
        alert('Failed to sign out: ' + error.message);
      } else {
        console.log('Sign out successful');
      }
    } else {
      // Native (iOS/Android)에서는 Alert 사용
      Alert.alert('Sign Out', 'Are you sure you want to sign out?', [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Sign Out',
          style: 'destructive',
          onPress: async () => {
            console.log('Signing out...');
            const { error } = await signOut();
            if (error) {
              console.error('Sign out error:', error);
              Alert.alert('Error', 'Failed to sign out: ' + error.message);
            } else {
              console.log('Sign out successful');
            }
          },
        },
      ]);
    }
  };

  return (
    <SafeAreaView className="flex-1 bg-gray-50 dark:bg-gray-950">
      {/* Header */}
      <View className="bg-white dark:bg-gray-900 px-6 py-4 border-b border-gray-200 dark:border-gray-800">
        <View className="flex-row justify-between items-center">
          <View>
            <Text className="text-sm text-gray-500 dark:text-gray-400">{today}</Text>
            <Text className="text-2xl font-bold text-gray-900 dark:text-white mt-1">Today</Text>
          </View>
          <Pressable
            onPress={handleSignOut}
            className="bg-gray-100 dark:bg-gray-800 px-4 py-2 rounded-lg active:opacity-70"
          >
            <Text className="text-sm font-medium text-gray-700 dark:text-gray-300">
              Sign Out
            </Text>
          </Pressable>
        </View>
      </View>

      <ScrollView className="flex-1">
        <View className="px-4 py-4">
          {/* Loading State */}
          {isLoading && (
            <View className="items-center justify-center py-20">
              <ActivityIndicator size="large" color="#3b82f6" />
              <Text className="text-sm text-gray-500 dark:text-gray-400 mt-4">
                Loading tasks...
              </Text>
            </View>
          )}

          {/* Error State */}
          {isError && (
            <View className="items-center justify-center py-20">
              <Text className="text-4xl mb-4">⚠️</Text>
              <Text className="text-base text-gray-900 dark:text-white font-semibold mb-2">
                Failed to load tasks
              </Text>
              <Text className="text-sm text-gray-500 dark:text-gray-400 text-center mb-4">
                {error?.message || 'Something went wrong'}
              </Text>
              <Pressable 
                onPress={() => refetch()}
                className="bg-blue-600 px-6 py-3 rounded-lg active:opacity-70"
              >
                <Text className="text-white font-semibold">Try Again</Text>
              </Pressable>
            </View>
          )}

          {/* Tasks List */}
          {!isLoading && !isError && tasks.length > 0 && (
            tasks.map((task: TaskWithRollover) => (
              <TaskItem 
                key={task.id} 
                task={task}
                isOverdue={task.isOverdue}
                daysOverdue={task.daysOverdue}
                onToggle={() => toggleTask(task.id, task.status)}
              />
            ))
          )}

          {/* Empty State */}
          {!isLoading && !isError && tasks.length === 0 && (
            <View className="items-center justify-center py-20">
              <Text className="text-4xl mb-4">📝</Text>
              <Text className="text-base text-gray-500 dark:text-gray-400">
                No tasks for today
              </Text>
              <Text className="text-sm text-gray-400 dark:text-gray-500 mt-2">
                Tap the + button to add a new task
              </Text>
            </View>
          )}
        </View>
      </ScrollView>

      {/* Bottom Actions */}
      <View className="px-4 pb-6 bg-white dark:bg-gray-900 border-t border-gray-200 dark:border-gray-800">
        <Pressable className="bg-gray-100 dark:bg-gray-800 rounded-xl py-4 items-center active:opacity-70">
          <Text className="text-base font-semibold text-gray-700 dark:text-gray-300">
            📋 Open Backlog
          </Text>
        </Pressable>
      </View>

      {/* FAB (Floating Action Button) */}
      <Pressable 
        onPress={() => setIsAddModalVisible(true)}
        className="absolute bottom-28 right-6 bg-blue-600 w-14 h-14 rounded-full items-center justify-center shadow-lg active:scale-95"
      >
        <Text className="text-white text-2xl font-light">+</Text>
      </Pressable>

      {/* Add Task Modal */}
      <AddTaskModal
        visible={isAddModalVisible}
        onClose={() => setIsAddModalVisible(false)}
      />
    </SafeAreaView>
  );
}

// Task Item Component
function TaskItem({ 
  task, 
  isOverdue = false,
  daysOverdue = 0,
  onToggle,
}: { 
  task: TaskWithRollover; 
  isOverdue: boolean;
  daysOverdue: number;
  onToggle: () => void;
}) {
  const isCompleted = task.status === 'DONE';
  
  // Format time from HH:MM:SS to HH:MM
  const formatTime = (time: string | null) => {
    if (!time) return null;
    return time.substring(0, 5); // Get HH:MM from HH:MM:SS
  };

  return (
    <Pressable 
      onPress={onToggle}
      className={`
        mb-2 p-4 rounded-xl border active:opacity-70
        ${isOverdue 
          ? 'bg-red-50 dark:bg-red-950/30 border-red-200 dark:border-red-900' 
          : 'bg-white dark:bg-gray-900 border-gray-200 dark:border-gray-800'
        }
      `}
    >
      <View className="flex-row items-start">
        {/* Checkbox */}
        <View 
          className={`
            w-5 h-5 rounded-full border-2 mr-3 mt-0.5
            ${isCompleted 
              ? 'bg-green-500 border-green-500' 
              : 'border-gray-300 dark:border-gray-600'
            }
          `}
        >
          {isCompleted && (
            <Text className="text-white text-xs text-center leading-4">✓</Text>
          )}
        </View>

        {/* Task Content */}
        <View className="flex-1">
          <View className="flex-row items-center justify-between">
            <Text 
              className={`
                text-base flex-1
                ${isCompleted 
                  ? 'line-through text-gray-400 dark:text-gray-600' 
                  : 'text-gray-900 dark:text-white'
                }
              `}
            >
              {task.title}
            </Text>
            
            {/* Rollover Badge - only show for overdue TODO items */}
            {isOverdue && daysOverdue > 0 && (
              <View className="bg-red-600 px-2 py-0.5 rounded ml-2">
                <Text className="text-white text-xs font-semibold">
                  +{daysOverdue}d
                </Text>
              </View>
            )}
          </View>

          {/* Due Time - show even when completed, but dimmed */}
          {task.due_time && (
            <Text 
              className={`
                text-sm mt-1
                ${isCompleted 
                  ? 'text-gray-400 dark:text-gray-600' 
                  : 'text-gray-500 dark:text-gray-400'
                }
              `}
            >
              ⏰ {formatTime(task.due_time)}
            </Text>
          )}
        </View>
      </View>
    </Pressable>
  );
}
