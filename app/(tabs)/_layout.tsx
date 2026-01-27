import { AddTaskModal } from '@/components/AddTaskModal';
import { HapticTab } from '@/components/haptic-tab';
import { Archive, Home, Plus, User, Users } from 'lucide-react-native';
import { Tabs } from 'expo-router';
import { useState } from 'react';
import { Platform, View } from 'react-native';

export default function TabLayout() {
  const [isAddModalVisible, setIsAddModalVisible] = useState(false);

  return (
    <>
      <Tabs
        screenOptions={{
          headerShown: false,
          tabBarActiveTintColor: '#0080F0', // Primary color
          tabBarInactiveTintColor: '#4B5563', // Darker gray (gray600)
          tabBarButton: (props) => <HapticTab {...props} />,
          tabBarStyle: {
            borderTopWidth: 1,
            borderTopColor: 'rgba(229, 231, 235, 0.5)', // border-border/50
            backgroundColor: '#FFFFFF', // Pure white background
            paddingBottom: Platform.OS === 'ios' ? 20 : 10,
            paddingTop: 10,
            height: Platform.OS === 'ios' ? 90 : 70,
            pointerEvents: 'auto',
          },
          tabBarLabelStyle: {
            fontSize: 12,
            fontWeight: '600',
          },
        }}
      >
        {/* Home Tab (WeekScreen) */}
        <Tabs.Screen
          name="index"
          options={{
            title: 'Home',
            tabBarIcon: ({ color, size }) => (
              <Home size={size} color={color} strokeWidth={2} />
            ),
          }}
        />

        {/* Backlog Tab */}
        <Tabs.Screen
          name="backlog"
          options={{
            title: 'Backlog',
            tabBarIcon: ({ color, size }) => (
              <Archive size={size} color={color} strokeWidth={2} />
            ),
          }}
        />

        {/* Add Button (Center) - Special styling */}
        <Tabs.Screen
          name="add"
          options={{
            title: '',
            tabBarIcon: ({ focused }) => (
              <View
                className="w-14 h-14 rounded-full items-center justify-center"
                style={{
                  marginTop: -16, // -translate-y-4
                  backgroundColor: '#3B82F6', // bg-primary
                  shadowColor: '#3B82F6', // shadow-primary
                  shadowOffset: { width: 0, height: 4 },
                  shadowOpacity: 0.3, // shadow-primary/30
                  shadowRadius: 8,
                  elevation: 8,
                }}
              >
                <Plus size={28} color="#FFFFFF" strokeWidth={2.5} />
              </View>
            ),
          }}
          listeners={{
            tabPress: (e) => {
              e.preventDefault();
              setIsAddModalVisible(true);
            },
          }}
        />

        {/* Group Tab */}
        <Tabs.Screen
          name="group"
          options={{
            title: 'Group',
            tabBarIcon: ({ color, size }) => (
              <Users size={size} color={color} strokeWidth={2} />
            ),
          }}
        />

        {/* Profile Tab */}
        <Tabs.Screen
          name="profile"
          options={{
            title: 'Profile',
            tabBarIcon: ({ color, size }) => (
              <User size={size} color={color} strokeWidth={2} />
            ),
          }}
        />
      </Tabs>

      {/* Add Task Modal */}
      <AddTaskModal
        visible={isAddModalVisible}
        onClose={() => setIsAddModalVisible(false)}
      />
    </>
  );
}
