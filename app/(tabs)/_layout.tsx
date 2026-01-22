import { AddTaskModal } from '@/components/AddTaskModal';
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
          tabBarActiveTintColor: '#3B82F6',
          tabBarInactiveTintColor: '#9CA3AF',
          tabBarStyle: {
            borderTopWidth: 1,
            borderTopColor: '#E5E7EB',
            paddingBottom: Platform.OS === 'ios' ? 20 : 10,
            paddingTop: 10,
            height: Platform.OS === 'ios' ? 90 : 70,
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
                className="w-14 h-14 rounded-full bg-blue-600 items-center justify-center shadow-lg"
                style={{
                  marginTop: -20,
                  shadowColor: '#3B82F6',
                  shadowOffset: { width: 0, height: 4 },
                  shadowOpacity: 0.3,
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
