import React, { useEffect, useRef, useState } from 'react';
import { StyleSheet, Animated, Image, Dimensions } from 'react-native';
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
          source={require('@/assets/images/app-logo-full.png')}
          style={styles.logoImage}
          resizeMode="contain"
        />
      </Animated.View>
    </Animated.View>
  );
}

const { width } = Dimensions.get('window');

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
    width: Math.min(width * 0.8, 380),
    height: 150,
  },
  logoImage: {
    width: '100%',
    height: '100%',
  },
});
