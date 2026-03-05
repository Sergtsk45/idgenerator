/**
 * @file: UpgradePrompt.tsx
 * @description: Компонент для отображения предложения обновить тариф
 * @dependencies: use-tariff.ts, shadcn/ui (Alert, Button)
 * @created: 2026-03-06
 */

import { AlertCircle } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { useTariff } from '@/hooks/use-tariff';
import { FEATURES, type FeatureKey } from '@shared/tariff-features';

interface UpgradePromptProps {
  /** Ключ функции, для которой требуется обновление тарифа */
  feature: FeatureKey;
  
  /** Класс для кастомизации стилей (опционально) */
  className?: string;
}

/**
 * Компонент для отображения предложения обновить тариф
 * 
 * @example
 * <UpgradePrompt feature="SPLIT_TASK" />
 */
export function UpgradePrompt({ feature, className }: UpgradePromptProps) {
  const { effectiveTariff } = useTariff();
  const requiredTariff = FEATURES[feature];

  const featureName: Record<FeatureKey, string> = {
    SPLIT_TASK: 'Разделение задач',
    INVOICE_IMPORT: 'Импорт PDF-счетов',
  };

  const tariffName: Record<string, string> = {
    basic: 'Базовый',
    standard: 'Стандарт',
    premium: 'Премиум',
  };

  return (
    <Alert className={className}>
      <AlertCircle className="h-4 w-4" />
      <AlertTitle>Требуется тариф "{tariffName[requiredTariff]}"</AlertTitle>
      <AlertDescription className="mt-2 space-y-2">
        <p>
          Функция "{featureName[feature]}" доступна на тарифе {tariffName[requiredTariff]} и выше.
        </p>
        <p className="text-sm text-muted-foreground">
          Текущий тариф: {tariffName[effectiveTariff]}
        </p>
        <Button variant="default" size="sm" className="mt-2">
          Обновить тариф
        </Button>
      </AlertDescription>
    </Alert>
  );
}
