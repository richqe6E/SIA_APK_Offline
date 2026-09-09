import React, { useEffect } from 'react';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { useMonitorStore } from '@/stores/monitorStore';
import { ConnectionModal } from '@/components/connection-modal';

export default function RootLayout() {
  const { isConfigured, loading, autoRefreshInterval, loadSavedConfig, fetchData } = useMonitorStore();

  useEffect(() => {
    loadSavedConfig();
  }, []);

  // Background auto-refresh timer for executive monitoring
  useEffect(() => {
    if (!isConfigured || autoRefreshInterval <= 0) return;

    const timer = setInterval(() => {
      fetchData(false);
    }, autoRefreshInterval * 1000);

    return () => clearInterval(timer);
  }, [isConfigured, autoRefreshInterval, fetchData]);

  return (
    <SafeAreaProvider>
      <StatusBar style="dark" />
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="(tabs)" />
      </Stack>

      {!loading && !isConfigured && (
        <ConnectionModal visible={true} canClose={false} />
      )}
    </SafeAreaProvider>
  );
}
