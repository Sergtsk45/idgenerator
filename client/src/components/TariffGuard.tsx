/**
 * @file: TariffGuard.tsx
 * @description: Компонент для условного рендеринга на основе доступа к функциям по тарифу
 * @dependencies: use-tariff.ts, shared/tariff-features
 * @created: 2026-03-06
 */

import type { ReactNode } from 'react';
import { useTariff } from '@/hooks/use-tariff';
import type { FeatureKey } from '@shared/tariff-features';

interface TariffGuardProps {
  /** Ключ функции для проверки доступа */
  feature: FeatureKey;
  
  /** Что показать вместо children если нет доступа */
  fallback?: ReactNode;
  
  /** Дочерние элементы (контент, который нужно защитить) */
  children: ReactNode;
}

/**
 * Компонент-обертка для условного рендеринга на основе тарифа
 * 
 * @example
 * <TariffGuard feature="SPLIT_TASK" fallback={<LockedButton />}>
 *   <Button onClick={handleSplit}>Разделить задачу</Button>
 * </TariffGuard>
 */
export function TariffGuard({ feature, fallback = null, children }: TariffGuardProps) {
  const { hasFeature } = useTariff();

  // Если есть доступ - рендерим children
  if (hasFeature(feature)) {
    return <>{children}</>;
  }

  // Если нет доступа - показываем fallback
  return <>{fallback}</>;
}
