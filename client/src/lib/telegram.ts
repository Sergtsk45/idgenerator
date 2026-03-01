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

/**
 * Получает ID пользователя Telegram из initData
 * Парсит initData как URLSearchParams, извлекает поле user и возвращает его id
 */
export function getTelegramUserId(): number | null {
  const initData = getTelegramInitData();
  
  if (!initData) {
    return null;
  }

  try {
    const params = new URLSearchParams(initData);
    const userParam = params.get('user');
    
    if (!userParam) {
      return null;
    }

    const userData = JSON.parse(userParam);
    
    if (typeof userData.id === 'number') {
      return userData.id;
    }

    return null;
  } catch (error) {
    console.error('[Telegram] Failed to parse user ID from initData:', error);
    return null;
  }
}
