/**
 * @file: use-tariff.ts
 * @description: Хук для работы с тарифной системой на клиенте
 * @dependencies: use-auth.ts, shared/tariff-features
 * @created: 2026-03-06
 */

import { useAuth } from './use-auth';
import { 
  hasFeatureAccess, 
  getEffectiveTariff, 
  getQuota,
  type FeatureKey,
  type QuotaType,
} from '@shared/tariff-features';
import { TARIFFS, type TariffType } from '@shared/schema';

export function useTariff() {
  const { user } = useAuth();
  
  // Вычисляем эффективный тариф с учётом истечения подписки
  const effectiveTariff = user
    ? getEffectiveTariff(
        user.tariff as TariffType,
        user.subscriptionEndsAt ? new Date(user.subscriptionEndsAt) : null
      )
    : (TARIFFS.BASIC as TariffType);

  /**
   * Проверяет, имеет ли пользователь доступ к функции
   */
  const hasFeature = (feature: FeatureKey): boolean => {
    return hasFeatureAccess(effectiveTariff, feature);
  };

  /**
   * Получает лимит квоты для текущего тарифа
   */
  const getQuotaLimit = (quotaType: QuotaType): number => {
    return getQuota(effectiveTariff, quotaType);
  };

  return {
    // Исходный тариф (из БД)
    tariff: user?.tariff || TARIFFS.BASIC,
    
    // Эффективный тариф (с учётом истечения подписки)
    effectiveTariff,
    
    // Дата окончания подписки
    subscriptionEndsAt: user?.subscriptionEndsAt || null,
    
    // Использован ли Trial
    trialUsed: user?.trialUsed || false,
    
    // Хелперы
    hasFeature,
    getQuotaLimit,
    
    // Флаги для удобства
    isBasic: effectiveTariff === TARIFFS.BASIC,
    isStandard: effectiveTariff === TARIFFS.STANDARD,
    isPremium: effectiveTariff === TARIFFS.PREMIUM,
  };
}
