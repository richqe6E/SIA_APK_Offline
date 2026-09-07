import React, { useEffect, useRef, useState } from 'react';
import { StyleSheet, Animated, Image, Dimensions, View } from 'react-native';
import { ThemedText } from '@/components/themed-text';
import * as SplashScreen from 'expo-splash-screen';

SplashScreen.preventAutoHideAsync().catch(() => {});

interface AnimatedSplashScreenProps {
  onFinish?: () => void;
}

export function AnimatedSplashScreen({ onFinish }: AnimatedSplashScreenProps) {
  const [visible, setVisible] = useState(true);
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const scaleAnim = useRef(new Animated.Value(0.88)).current;
  const exitAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    // Sembunyikan native splash screen segera setelah React Native siap
    SplashScreen.hideAsync().catch(() => {});

    Animated.sequence([
      // 1. Animasi Masuk: Fade In & Spring Scale Logo Lengkap
      Animated.parallel([
        Animated.timing(fadeAnim, {
          toValue: 1,
          duration: 650,
          useNativeDriver: true,
        }),
        Animated.spring(scaleAnim, {
          toValue: 1,
          friction: 7,
          tension: 40,
          useNativeDriver: true,
        }),
      ]),
      // 2. Pause agar nama dan identitas terbaca jelas
      Animated.delay(1000),
      // 3. Animasi Keluar: Fade Out halus membuka layar aplikasi
      Animated.timing(exitAnim, {
        toValue: 0,
        duration: 450,
        useNativeDriver: true,
      }),
    ]).start(() => {
      setVisible(false);
      onFinish?.();
    });
  }, [fadeAnim, scaleAnim, exitAnim, onFinish]);

  if (!visible) return null;

  return (
    <Animated.View
      style={[
        styles.container,
        {
          opacity: exitAnim,
        },
      ]}
      pointerEvents={visible ? 'auto' : 'none'}
    >
      <Animated.View
        style={[
          styles.logoContainer,
          {
            opacity: fadeAnim,
            transform: [{ scale: scaleAnim }],
          },
        ]}
      >
        <Image
          source={require('@/assets/images/app-logo-p.png')}
          style={styles.logoImage}
          resizeMode="contain"
        />
        <ThemedText style={styles.brandTitle}>POS AZIZAH</ThemedText>
        <ThemedText style={styles.brandSubtitle}>Sistem Kasir & Pembukuan Usaha</ThemedText>
        <View style={styles.badgePill}>
          <ThemedText style={styles.badgeText}>OFFLINE • CEPAT • AKURAT</ThemedText>
        </View>
      </Animated.View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: '#ffffff',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 99999,
    elevation: 99999,
  },
  logoContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
  logoImage: {
    width: 90,
    height: 90,
    marginBottom: 16,
  },
  brandTitle: {
    fontSize: 28,
    fontWeight: '900',
    color: '#1e1b4b',
    letterSpacing: 1.2,
    textAlign: 'center',
  },
  brandSubtitle: {
    fontSize: 13,
    fontWeight: '500',
    color: '#64748b',
    marginTop: 4,
    textAlign: 'center',
  },
  badgePill: {
    marginTop: 18,
    paddingHorizontal: 14,
    paddingVertical: 5,
    borderRadius: 20,
    backgroundColor: '#f5f3ff',
    borderWidth: 1,
    borderColor: '#ddd6fe',
  },
  badgeText: {
    fontSize: 10,
    fontWeight: '800',
    color: '#6d28d9',
    letterSpacing: 0.8,
  },
});
