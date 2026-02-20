/**
 * @file: use-telegram-back-button.ts
 * @description: React-хук для работы с BackButton Telegram WebApp
 * @dependencies: window.Telegram.WebApp
 * @created: 2026-02-20
 */

import { useEffect, useCallback } from "react";

interface BackButtonParams {
  onClick: () => void;
  isVisible?: boolean;
}

/**
 * Хук для управления кнопкой "Назад" Telegram MiniApp
 * 
 * @example
 * ```tsx
 * const { showButton, hideButton } = useTelegramBackButton({
 *   onClick: () => navigate('/'),
 *   isVisible: true
 * });
 * 
 * // Динамическое управление
 * useEffect(() => {
 *   if (isEditMode) {
 *     showButton();
 *   } else {
 *     hideButton();
 *   }
 * }, [isEditMode, showButton, hideButton]);
 * ```
 */
export function useTelegramBackButton(params: BackButtonParams) {
  const { onClick, isVisible = true } = params;

  const backButton = window.Telegram?.WebApp?.BackButton;

  useEffect(() => {
    if (!backButton) return;

    // Управление видимостью
    if (isVisible) {
      backButton.show();
    } else {
      backButton.hide();
    }

    // Подписка на клик
    backButton.onClick(onClick);

    // Очистка при размонтировании
    return () => {
      backButton.offClick(onClick);
      backButton.hide();
    };
  }, [backButton, onClick, isVisible]);

  const showButton = useCallback(() => {
    backButton?.show();
  }, [backButton]);

  const hideButton = useCallback(() => {
    backButton?.hide();
  }, [backButton]);

  return {
    showButton,
    hideButton,
  };
}
