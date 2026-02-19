/**
 * @file: app-settings.ts
 * @description: Zustand store для настроек приложения (localStorage persistence)
 * @dependencies: zustand
 * @created: 2026-02-19
 */

import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface AppSettingsState {
  showWorkVolumes: boolean;
  setShowWorkVolumes: (value: boolean) => void;
}

export const useAppSettings = create<AppSettingsState>()(
  persist(
    (set) => ({
      showWorkVolumes: false,
      setShowWorkVolumes: (value) => set({ showWorkVolumes: value }),
    }),
    {
      name: 'app-settings-storage',
    }
  )
);
