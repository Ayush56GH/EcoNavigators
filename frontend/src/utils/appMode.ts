'use client';

import { useState, useEffect } from 'react';

export type AppMode = 'live' | 'demo';

const APP_MODE_STORAGE_KEY = 'econav_app_mode';

let memoryMode: AppMode | null = null;

export function getAppMode(): AppMode {
  if (typeof window !== 'undefined') {
    try {
      const stored = localStorage.getItem(APP_MODE_STORAGE_KEY);
      if (stored === 'demo' || stored === 'live') {
        return stored;
      }
    } catch {}
  }
  if (memoryMode !== null) {
    return memoryMode;
  }
  const envMode = process.env.NEXT_PUBLIC_APP_MODE?.toLowerCase();
  if (envMode === 'demo') {
    return 'demo';
  }
  return 'live';
}

export function setAppMode(mode: AppMode): void {
  memoryMode = mode;
  if (typeof window !== 'undefined') {
    try {
      localStorage.setItem(APP_MODE_STORAGE_KEY, mode);
      window.dispatchEvent(new CustomEvent('econav_app_mode_changed', { detail: mode }));
    } catch {}
  }
}

export function useAppMode(): { mode: AppMode; setMode: (mode: AppMode) => void } {
  const [mode, setModeState] = useState<AppMode>('live');

  useEffect(() => {
    setModeState(getAppMode());

    const handleModeChange = (e: Event) => {
      const customEvent = e as CustomEvent<AppMode>;
      if (customEvent.detail) {
        setModeState(customEvent.detail);
      } else {
        setModeState(getAppMode());
      }
    };

    window.addEventListener('econav_app_mode_changed', handleModeChange);
    window.addEventListener('storage', handleModeChange);
    return () => {
      window.removeEventListener('econav_app_mode_changed', handleModeChange);
      window.removeEventListener('storage', handleModeChange);
    };
  }, []);

  const setMode = (newMode: AppMode) => {
    setAppMode(newMode);
    setModeState(newMode);
  };

  return { mode, setMode };
}
