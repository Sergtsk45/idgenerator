/**
 * @file: use-telegram-main-button.ts
 * @description: React-хук для работы с MainButton Telegram WebApp
 * @dependencies: window.Telegram.WebApp
 * @created: 2026-02-20
 */

import { useEffect, useCallback } from "react";

interface MainButtonParams {
  text: string;
  onClick: () => void;
  color?: string;
  textColor?: string;
  isActive?: boolean;
  isVisible?: boolean;
  isProgressVisible?: boolean;
}

/**
 * Хук для управления главной кнопкой Telegram MiniApp
 * 
 * @example
 * ```tsx
 * const { showButton, hideButton, setProgress } = useTelegramMainButton({
 *   text: "Сохранить",
 *   onClick: handleSave,
 *   isActive: true,
 *   isVisible: true
 * });
 * 
 * // Показать прогресс
 * setProgress(true);
 * await saveData();
 * setProgress(false);
 * ```
 */
export function useTelegramMainButton(params: MainButtonParams) {
  const {
    text,
    onClick,
    color,
    textColor,
    isActive = true,
    isVisible = true,
    isProgressVisible = false,
  } = params;

  const mainButton = window.Telegram?.WebApp?.MainButton;

  useEffect(() => {
    if (!mainButton) return;

    // Настройка текста и цветов
    mainButton.setText(text);
    if (color) mainButton.setParams({ color });
    if (textColor) mainButton.setParams({ text_color: textColor });

    // Управление состоянием
    if (isActive) {
      mainButton.enable();
    } else {
      mainButton.disable();
    }

    if (isVisible) {
      mainButton.show();
    } else {
      mainButton.hide();
    }

    if (isProgressVisible) {
      mainButton.showProgress();
    } else {
      mainButton.hideProgress();
    }

    // Подписка на клик
    mainButton.onClick(onClick);

    // Очистка при размонтировании
    return () => {
      mainButton.offClick(onClick);
      mainButton.hide();
    };
  }, [mainButton, text, onClick, color, textColor, isActive, isVisible, isProgressVisible]);

  const showButton = useCallback(() => {
    mainButton?.show();
  }, [mainButton]);

  const hideButton = useCallback(() => {
    mainButton?.hide();
  }, [mainButton]);

  const setProgress = useCallback((visible: boolean) => {
    if (visible) {
      mainButton?.showProgress();
    } else {
      mainButton?.hideProgress();
    }
  }, [mainButton]);

  const enable = useCallback(() => {
    mainButton?.enable();
  }, [mainButton]);

  const disable = useCallback(() => {
    mainButton?.disable();
  }, [mainButton]);

  const setText = useCallback((newText: string) => {
    mainButton?.setText(newText);
  }, [mainButton]);

  return {
    showButton,
    hideButton,
    setProgress,
    enable,
    disable,
    setText,
  };
}
