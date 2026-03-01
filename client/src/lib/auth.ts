/**
 * @file: auth.ts
 * @description: Библиотека для управления JWT токенами аутентификации
 * @dependencies: localStorage
 * @created: 2026-03-01
 */

const TOKEN_KEY = 'auth_token';

/**
 * Получает JWT токен из localStorage
 */
export function getAuthToken(): string | null {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem(TOKEN_KEY);
}

/**
 * Сохраняет JWT токен в localStorage
 */
export function setAuthToken(token: string): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem(TOKEN_KEY, token);
}

/**
 * Удаляет JWT токен из localStorage
 */
export function clearAuthToken(): void {
  if (typeof window === 'undefined') return;
  localStorage.removeItem(TOKEN_KEY);
}

/**
 * Проверяет, аутентифицирован ли пользователь (наличие токена)
 */
export function isAuthenticated(): boolean {
  return !!getAuthToken();
}
