import { useCallback, useEffect, useState } from 'react';
import { AppState } from 'react-native';
import { permissions } from './permissionsBridge';
import type { PermissionStatus } from './permissionState';

/**
 * The live permission status: checked on mount and again whenever the app returns to the
 * foreground, which is where the user comes back from the system settings. `null` until the
 * first check has finished.
 */
export function usePermissionStatus(): PermissionStatus | null {
  const [status, setStatus] = useState<PermissionStatus | null>(null);

  const refresh = useCallback(() => {
    permissions
      .getStatus()
      .then(setStatus)
      .catch(() => undefined);
  }, []);

  useEffect(() => {
    refresh();
    const sub = AppState.addEventListener('change', (next) => {
      if (next === 'active') refresh();
    });
    return () => sub.remove();
  }, [refresh]);

  return status;
}
