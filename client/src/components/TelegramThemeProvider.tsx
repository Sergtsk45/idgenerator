/**
 * @file: TelegramThemeProvider.tsx
 * @description: Провайдер для применения темы Telegram к приложению
 * @dependencies: useTelegram
 * @created: 2026-02-20
 */

import { useEffect } from 'react';
import { useTelegram } from '../hooks/useTelegram';

interface TelegramThemeProviderProps {
  children: React.ReactNode;
}

export const TelegramThemeProvider = ({ children }: TelegramThemeProviderProps) => {
  const { themeParams, colorScheme, isInTelegram, viewportHeight } = useTelegram();

  useEffect(() => {
    const root = document.documentElement;
    const webApp = window.Telegram?.WebApp;

    const setViewportVar = (name: string, value?: number) => {
      if (typeof value === 'number' && Number.isFinite(value) && value > 0) {
        root.style.setProperty(name, `${value}px`);
        return;
      }

      root.style.removeProperty(name);
    };

    if (themeParams.bg_color) {
      root.style.setProperty('--tg-theme-bg-color', themeParams.bg_color);
    }
    if (themeParams.text_color) {
      root.style.setProperty('--tg-theme-text-color', themeParams.text_color);
    }
    if (themeParams.hint_color) {
      root.style.setProperty('--tg-theme-hint-color', themeParams.hint_color);
    }
    if (themeParams.link_color) {
      root.style.setProperty('--tg-theme-link-color', themeParams.link_color);
    }
    if (themeParams.button_color) {
      root.style.setProperty('--tg-theme-button-color', themeParams.button_color);
    }
    if (themeParams.button_text_color) {
      root.style.setProperty('--tg-theme-button-text-color', themeParams.button_text_color);
    }
    if (themeParams.secondary_bg_color) {
      root.style.setProperty('--tg-theme-secondary-bg-color', themeParams.secondary_bg_color);
    }
    if (themeParams.header_bg_color) {
      root.style.setProperty('--tg-theme-header-bg-color', themeParams.header_bg_color);
    }
    if (themeParams.accent_text_color) {
      root.style.setProperty('--tg-theme-accent-text-color', themeParams.accent_text_color);
    }
    if (themeParams.section_bg_color) {
      root.style.setProperty('--tg-theme-section-bg-color', themeParams.section_bg_color);
    }
    if (themeParams.section_header_text_color) {
      root.style.setProperty('--tg-theme-section-header-text-color', themeParams.section_header_text_color);
    }
    if (themeParams.subtitle_text_color) {
      root.style.setProperty('--tg-theme-subtitle-text-color', themeParams.subtitle_text_color);
    }
    if (themeParams.destructive_text_color) {
      root.style.setProperty('--tg-theme-destructive-text-color', themeParams.destructive_text_color);
    }

    if (isInTelegram && webApp) {
      setViewportVar('--tg-viewport-height', webApp.viewportHeight);
      setViewportVar('--tg-viewport-stable-height', webApp.viewportStableHeight);
      setViewportVar('--tg-viewport-width', window.visualViewport?.width ?? window.innerWidth);
    } else {
      root.style.removeProperty('--tg-viewport-height');
      root.style.removeProperty('--tg-viewport-stable-height');
      root.style.removeProperty('--tg-viewport-width');
    }

    if (colorScheme === 'dark') {
      root.classList.add('dark');
      root.classList.remove('light');
    } else {
      root.classList.add('light');
      root.classList.remove('dark');
    }
  }, [themeParams, colorScheme, isInTelegram, viewportHeight]);

  return <>{children}</>;
};
