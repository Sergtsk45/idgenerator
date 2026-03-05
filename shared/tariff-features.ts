/**
 * @file: tariff-features.ts
 * @description: Единый реестр фич и квот тарифной системы
 * @dependencies: shared/schema.ts
 * @created: 2026-03-06
 */

import { TARIFFS, type TariffType } from './schema';

// Уровни тарифов для сравнения (basic < standard < premium)
export const TARIFF_LEVELS: Record<TariffType, number> = {
  [TARIFFS.BASIC]: 0,
  [TARIFFS.STANDARD]: 1,
  [TARIFFS.PREMIUM]: 2,
};

// Маппинг фич на минимальный тариф
export const FEATURES = {
  SPLIT_TASK: TARIFFS.STANDARD,
  INVOICE_IMPORT: TARIFFS.STANDARD,
} as const;

export type FeatureKey = keyof typeof FEATURES;

// Квоты/лимиты для каждого тарифа
export const QUOTAS = {
  objects: {
    [TARIFFS.BASIC]: 1,
    [TARIFFS.STANDARD]: 5,
    [TARIFFS.PREMIUM]: Infinity,
  },
  invoiceImports: {
    [TARIFFS.BASIC]: 0,
    [TARIFFS.STANDARD]: 20,
    [TARIFFS.PREMIUM]: Infinity,
  },
} as const;

export type QuotaType = keyof typeof QUOTAS;

/**
 * Проверяет, имеет ли тариф доступ к функции
 */
export function hasFeatureAccess(
  userTariff: TariffType,
  featureKey: FeatureKey
): boolean {
  const requiredTariff = FEATURES[featureKey];
  return TARIFF_LEVELS[userTariff] >= TARIFF_LEVELS[requiredTariff];
}

/**
 * Вычисляет эффективный тариф с учётом истечения подписки
 * Если подписка истекла - возвращает basic, иначе - текущий тариф
 */
export function getEffectiveTariff(
  tariff: TariffType,
  subscriptionEndsAt: Date | null
): TariffType {
  // Если уже базовый - ничего не меняется
  if (tariff === TARIFFS.BASIC) {
    return TARIFFS.BASIC;
  }
  
  // Если нет даты окончания - тариф бессрочный
  if (!subscriptionEndsAt) {
    return tariff;
  }
  
  // Проверяем, истекла ли подписка
  const now = new Date();
  if (now > subscriptionEndsAt) {
    return TARIFFS.BASIC;
  }
  
  return tariff;
}

/**
 * Получает квоту для указанного тарифа
 */
export function getQuota(
  tariff: TariffType,
  quotaType: QuotaType
): number {
  return QUOTAS[quotaType][tariff];
}
