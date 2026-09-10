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
    const applyLock = async () => {
      if (AppState.currentState !== 'active') return;
      try {
        if (appOrientation === 'landscape') {
          await ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.LANDSCAPE);
        } else if (appOrientation === 'portrait') {
          await ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.PORTRAIT_UP);
        } else if (defaultOverride) {
          await ScreenOrientation.lockAsync(defaultOverride);
        } else {
          await ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.PORTRAIT_UP);
        }
      } catch {
        // Safe catch on Android Activity transitions
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

