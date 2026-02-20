/**
 * @file: use-telegram-haptic.ts
 * @description: React-хук для тактильной обратной связи через Telegram WebApp HapticFeedback
 * @dependencies: window.Telegram.WebApp
 * @created: 2026-02-20
 */

import { useCallback } from "react";

type ImpactStyle = "light" | "medium" | "heavy" | "rigid" | "soft";
type NotificationStyle = "error" | "success" | "warning";

/**
 * Хук для управления тактильной обратной связью в Telegram MiniApp
 * 
 * @example
 * ```tsx
 * const haptic = useTelegramHaptic();
 * 
 * // При нажатии кнопки
 * <button onClick={() => {
 *   haptic.impact('light');
 *   handleClick();
 * }}>
 *   Нажми меня
 * </button>
 * 
 * // При успешном сохранении
 * const handleSave = async () => {
 *   try {
 *     await saveData();
 *     haptic.notificationOccurred('success');
 *   } catch (error) {
 *     haptic.notificationOccurred('error');
 *   }
 * };
 * ```
 */
export function useTelegramHaptic() {
  const hapticFeedback = window.Telegram?.WebApp?.HapticFeedback;

  /**
   * Вызывает тактильную обратную связь типа "impact"
   * 
   * @param style - Стиль вибрации:
   *   - 'light' - легкое касание (кнопки, переключатели)
   *   - 'medium' - среднее воздействие (сохранение данных, подтверждение)
   *   - 'heavy' - сильное воздействие (удаление, критичные действия)
   *   - 'rigid' - жесткое воздействие
   *   - 'soft' - мягкое воздействие
   */
  const impact = useCallback((style: ImpactStyle = "medium") => {
    hapticFeedback?.impactOccurred(style);
  }, [hapticFeedback]);

  /**
   * Вызывает тактильную обратную связь типа "notification"
   * 
   * @param type - Тип уведомления:
   *   - 'success' - успешная операция
   *   - 'error' - ошибка
   *   - 'warning' - предупреждение
   */
  const notificationOccurred = useCallback((type: NotificationStyle) => {
    hapticFeedback?.notificationOccurred(type);
  }, [hapticFeedback]);

  /**
   * Вызывает тактильную обратную связь при изменении выбора
   * Используется для переключателей, слайдеров, выбора опций
   */
  const selectionChanged = useCallback(() => {
    hapticFeedback?.selectionChanged();
  }, [hapticFeedback]);

  return {
    impact,
    notificationOccurred,
    selectionChanged,
  };
}

/**
 * Утилита для быстрого доступа к haptic feedback без хука
 * Полезна для использования вне React компонентов
 */
export const haptic = {
  impact: (style: ImpactStyle = "medium") => {
    window.Telegram?.WebApp?.HapticFeedback?.impactOccurred(style);
  },
  
  notificationOccurred: (type: NotificationStyle) => {
    window.Telegram?.WebApp?.HapticFeedback?.notificationOccurred(type);
  },
  
  selectionChanged: () => {
    window.Telegram?.WebApp?.HapticFeedback?.selectionChanged();
  },
};
