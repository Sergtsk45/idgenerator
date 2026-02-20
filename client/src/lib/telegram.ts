/**
 * @file: telegram.ts
 * @description: Утилиты для работы с Telegram WebApp
 * @dependencies: window.Telegram.WebApp
 * @created: 2026-02-20
 */

/**
 * Получает initData из Telegram WebApp
 * В dev-режиме без Telegram возвращает null
 */
export function getTelegramInitData(): string | null {
  if (typeof window === 'undefined') {
    return null;
  }

  const webApp = window.Telegram?.WebApp;
  
  if (!webApp || !webApp.initData) {
    // В dev-режиме можно работать без Telegram
    if (import.meta.env.DEV) {
      console.warn('[Telegram] WebApp not available, running without Telegram authentication');
      return null;
    }
    
    console.error('[Telegram] WebApp initData not available');
    return null;
  }

  return webApp.initData;
}

/**
 * Проверяет, доступен ли Telegram WebApp
 */
export function isTelegramWebAppAvailable(): boolean {
  return typeof window !== 'undefined' && 
         !!window.Telegram?.WebApp?.initData;
}

/**
 * Получает данные пользователя из Telegram WebApp
 */
export function getTelegramUser() {
  if (typeof window === 'undefined') {
    return null;
  }

  return window.Telegram?.WebApp?.initDataUnsafe?.user || null;
}
