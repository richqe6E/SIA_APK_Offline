import * as ScreenOrientation from 'expo-screen-orientation';
import { useEffect } from 'react';
import { useSettingsStore } from '@/stores/settingsStore';

export function useLockOrientation(
  defaultOverride?: ScreenOrientation.OrientationLock
) {
  const appOrientation = useSettingsStore((s) => s.appOrientation);

  useEffect(() => {
    if (appOrientation === 'landscape') {
      ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.LANDSCAPE);
    } else if (appOrientation === 'portrait') {
      ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.PORTRAIT_UP);
    } else if (defaultOverride) {
      ScreenOrientation.lockAsync(defaultOverride);
    } else {
      ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.PORTRAIT_UP);
    }
  }, [appOrientation, defaultOverride]);
}

