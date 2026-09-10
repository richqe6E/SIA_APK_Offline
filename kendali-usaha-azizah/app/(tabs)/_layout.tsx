import React from 'react';
import { View } from 'react-native';
import { Tabs } from 'expo-router';
import { FloatingNav } from '@/components/floating-nav';

export default function TabLayout() {
  return (
    <View style={{ flex: 1 }}>
      <Tabs
        screenOptions={{
          headerShown: false,
          tabBarStyle: {
            display: 'none',
          },
        }}
      >
        <Tabs.Screen name="index" />
        <Tabs.Screen name="reports" />
        <Tabs.Screen name="settings" />
      </Tabs>

      {/* Navigasi Mengambang Kanan Layar (Pop-up Balls) */}
      <FloatingNav />
    </View>
  );
}
