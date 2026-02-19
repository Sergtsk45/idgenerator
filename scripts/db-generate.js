/**
 * @file: db-generate.js
 * @description: Обёртка над drizzle-kit generate. Запрещает запуск в production.
 * @dependencies: drizzle-kit
 * @created: 2026-02-20
 */

import { execSync } from 'child_process';

const env = process.env.NODE_ENV;

if (env === 'production') {
  console.error(
    'ERROR: db:generate запрещён в production.\n' +
    'Миграции должны генерироваться только в dev-окружении.\n' +
    'Для применения существующих миграций используйте: npm run db:migrate'
  );
  process.exit(1);
}

console.log('Генерация SQL-миграции из shared/schema.ts ...');
try {
  execSync('drizzle-kit generate', { stdio: 'inherit' });
} catch (err) {
  process.exit(err.status ?? 1);
}
