import * as ScreenOrientation from 'expo-screen-orientation';
import { useEffect } from 'react';
import { AppState } from 'react-native';
import { useSettingsStore } from '@/stores/settingsStore';

export function useLockOrientation(
  defaultOverride?: ScreenOrientation.OrientationLock
) {
  const appOrientation = useSettingsStore((s) => s.appOrientation);
  const currentUserRole = useSettingsStore((s) => s.currentUserRole);

  useEffect(() => {
    let isApplying = false;
    const applyLock = async () => {
      if (AppState.currentState !== 'active' || isApplying) return;
      isApplying = true;
      try {
        const targetLock =
          appOrientation === 'landscape'
            ? ScreenOrientation.OrientationLock.LANDSCAPE
            : appOrientation === 'portrait'
            ? ScreenOrientation.OrientationLock.PORTRAIT_UP
            : defaultOverride || ScreenOrientation.OrientationLock.PORTRAIT_UP;

        const currentOrientation = await ScreenOrientation.getOrientationAsync();
        const isAlreadyLandscape =
          currentOrientation === ScreenOrientation.Orientation.LANDSCAPE_LEFT ||
          currentOrientation === ScreenOrientation.Orientation.LANDSCAPE_RIGHT;
        const isAlreadyPortrait =
          currentOrientation === ScreenOrientation.Orientation.PORTRAIT_UP ||
          currentOrientation === ScreenOrientation.Orientation.PORTRAIT_DOWN;

        const isTargetLandscape = targetLock === ScreenOrientation.OrientationLock.LANDSCAPE;
        const isTargetPortrait = targetLock === ScreenOrientation.OrientationLock.PORTRAIT_UP;

        // Hanya jalankan lockAsync jika orientasi layar fisik saat ini berbeda dengan target
        if ((isTargetLandscape && !isAlreadyLandscape) || (isTargetPortrait && !isAlreadyPortrait)) {
          await ScreenOrientation.lockAsync(targetLock);
        }
      } catch {
        // Safe catch on Android Activity transitions
      } finally {
        isApplying = false;
      }
    };

    applyLock();

    const sub = AppState.addEventListener('change', (nextState) => {
      if (nextState === 'active') {
        applyLock();
      }
    });

    return () => {
      sub.remove();
    };
  }, [appOrientation, currentUserRole, defaultOverride]);
}

