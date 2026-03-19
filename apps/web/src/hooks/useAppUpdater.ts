import { useEffect, useState } from 'react';

import {
  checkForAppUpdate,
  installAppUpdate,
  type AppUpdateStatus,
} from '../services/tauriBridge';
import { useUIStore } from '../stores/uiStore';

const DEFAULT_STATUS: AppUpdateStatus = {
  configured: false,
  endpoint: null,
  currentVersion: 'dev',
  updateAvailable: false,
  latestVersion: null,
};

export function useAppUpdater() {
  const addToast = useUIStore((s) => s.addToast);
  const [status, setStatus] = useState<AppUpdateStatus>(DEFAULT_STATUS);
  const [checking, setChecking] = useState(false);
  const [installing, setInstalling] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function loadStatus() {
      try {
        const next = await checkForAppUpdate();
        if (!cancelled) {
          setStatus(next);
        }
      } catch (error) {
        if (!cancelled) {
          addToast({
            type: 'warning',
            message: `Update checks are unavailable: ${formatError(error)}`,
          });
        }
      }
    }

    void loadStatus();

    return () => {
      cancelled = true;
    };
  }, [addToast]);

  async function refresh(userInitiated = true) {
    setChecking(true);
    try {
      const next = await checkForAppUpdate();
      setStatus(next);

      if (userInitiated) {
        addToast({
          type: next.updateAvailable ? 'info' : 'success',
          message: next.updateAvailable
            ? `Update ${next.latestVersion} is available.`
            : 'You are already on the latest available build.',
        });
      }
    } catch (error) {
      addToast({
        type: 'error',
        message: `Failed to check for updates: ${formatError(error)}`,
      });
    } finally {
      setChecking(false);
    }
  }

  async function install() {
    setInstalling(true);
    try {
      const installed = await installAppUpdate();
      if (installed) {
        addToast({
          type: 'info',
          message: 'Update installed. The app may close to complete installation.',
          duration: 8000,
        });
      } else {
        addToast({
          type: 'warning',
          message: 'No pending update was available to install.',
        });
      }
    } catch (error) {
      addToast({
        type: 'error',
        message: `Failed to install update: ${formatError(error)}`,
      });
    } finally {
      setInstalling(false);
    }
  }

  return {
    status,
    checking,
    installing,
    refresh,
    install,
  };
}

function formatError(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }

  return String(error);
}
