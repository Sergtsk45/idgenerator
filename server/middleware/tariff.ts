/**
 * @file: tariff.ts
 * @description: Middleware для проверки доступа к функциям на основе тарифа пользователя
 * @dependencies: express, shared/tariff-features
 * @created: 2026-03-06
 */

import type { Request, Response, NextFunction } from 'express';
import { hasFeatureAccess, FEATURES, type FeatureKey } from '@shared/tariff-features';

/**
 * Middleware для проверки доступа к функции по тарифу
 * 
 * @param featureKey - Ключ функции из реестра FEATURES
 * @returns Express middleware
 * 
 * @example
 * app.post('/api/split-task', requireFeature('SPLIT_TASK'), handler);
 */
export function requireFeature(featureKey: FeatureKey) {
  return (req: Request, res: Response, next: NextFunction) => {
    // Проверка аутентификации
    if (!req.user) {
      return res.status(401).json({ 
        error: 'Unauthorized',
        message: 'Authentication required' 
      });
    }

    // Проверка доступа к функции
    const hasAccess = hasFeatureAccess(req.user.tariff, featureKey);

    if (!hasAccess) {
      return res.status(403).json({
        error: 'TARIFF_REQUIRED',
        message: `Для этой функции требуется тариф "${FEATURES[featureKey]}" или выше`,
        feature: featureKey,
        requiredTariff: FEATURES[featureKey],
        currentTariff: req.user.tariff,
      });
    }

    // Доступ разрешен
    next();
  };
}
