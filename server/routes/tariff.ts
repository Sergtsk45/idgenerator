/**
 * @file: tariff.ts
 * @description: Tariff status route with quota checks for objects and invoice imports
 * @dependencies: _common.ts, @shared/routes, @shared/tariff-features, server/db, drizzle-orm
 * @created: 2026-03-21
 */

import type { Express } from 'express';
import { eq, sql } from 'drizzle-orm';
import { api } from '@shared/routes';
import { getQuota } from '@shared/tariff-features';
import { storage, appAuth } from './_common';
import { db } from '../db';
import { objects } from '@shared/schema';

export function registerTariffRoutes(app: Express): void {
  app.get(api.tariff.status.path, ...appAuth, async (req, res) => {
    try {
      const user = req.user!;

      // Подсчет объектов пользователя
      const objectsCount = await db
        .select({ count: sql`count(*)::int` })
        .from(objects)
        .where(eq(objects.userId, user.id));

      const invoiceImportsUsed = await storage.countMonthlyInvoiceImports(user.id);

      const objectsLimit = getQuota(user.tariff, 'objects');
      const invoiceImportsLimit = getQuota(user.tariff, 'invoiceImports');

      return res.status(200).json({
        tariff: user.tariff,
        effectiveTariff: user.tariff,
        subscriptionEndsAt: user.subscriptionEndsAt?.toISOString() || null,
        trialUsed: user.trialUsed,
        quotas: {
          objects: {
            limit: objectsLimit,
            used: Number(objectsCount[0]?.count || 0),
          },
          invoiceImports: {
            limit: invoiceImportsLimit,
            used: invoiceImportsUsed,
          },
        },
      });
    } catch (err) {
      console.error('Get tariff status failed:', err);
      return res.status(500).json({ error: 'Internal Server Error' });
    }
  });
}
