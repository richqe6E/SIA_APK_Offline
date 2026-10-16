import React, { Suspense } from 'react';
import { ActivityIndicator, Text, View } from 'react-native';
import { DefaultTheme, ThemeProvider } from '@react-navigation/native';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import * as SQLite from 'expo-sqlite';
import { SafeAreaView } from 'react-native-safe-area-context';
import 'react-native-reanimated';

import { migrateDbIfNeeded } from '@/services/database';
import { AnimatedSplashScreen } from '@/components/animated-splash-screen';

export const unstable_settings = {
  anchor: '(tabs)',
};

function DatabaseLoadingFallback() {
  return (
    <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#FFFFFF' }}>
      <ActivityIndicator size="large" color="#2563EB" />
      <Text style={{ marginTop: 12, fontSize: 14, color: '#475569', fontWeight: '500' }}>
        Menyiapkan basis data lokal POS AZIZAH...
      </Text>
    </View>
  );
}

export default function RootLayout() {
  return (
    <ThemeProvider value={DefaultTheme}>
      <Suspense fallback={<DatabaseLoadingFallback />}>
        <SQLite.SQLiteProvider databaseName="pos.db" onInit={migrateDbIfNeeded} useSuspense>
          <SafeAreaView style={{ flex: 1 }} edges={['top', 'bottom']}>
            <Stack>
              <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
              <Stack.Screen name="transaksi" options={{ headerShown: false }} />
              <Stack.Screen name="debt-receivable" options={{ headerShown: false }} />
              <Stack.Screen name="modal" options={{ presentation: 'modal', title: 'Modal' }} />
            </Stack>
          </SafeAreaView>
          <AnimatedSplashScreen />
          <StatusBar style="dark" />
        </SQLite.SQLiteProvider>
      </Suspense>
    </ThemeProvider>
  );
}
