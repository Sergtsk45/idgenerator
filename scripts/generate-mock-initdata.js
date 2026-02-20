#!/usr/bin/env node
/**
 * @file: generate-mock-initdata.js
 * @description: Генерация mock Telegram initData для тестирования
 * @usage: TELEGRAM_BOT_TOKEN=your_token node scripts/generate-mock-initdata.js
 */

const crypto = require('crypto');

function createMockInitData(user, botToken) {
  const userData = {
    id: user.id || 123456789,
    first_name: user.first_name || 'Test',
    last_name: user.last_name,
    username: user.username,
    language_code: user.language_code || 'ru',
  };

  // Удаляем undefined поля
  Object.keys(userData).forEach(key => {
    if (userData[key] === undefined) {
      delete userData[key];
    }
  });

  const params = new URLSearchParams();
  params.set('user', JSON.stringify(userData));
  params.set('auth_date', Math.floor(Date.now() / 1000).toString());
  params.set('query_id', 'AAHdF6IQAAAAAN0XohDhrOrc');

  // Создаём data_check_string
  const dataCheckString = Array.from(params.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, value]) => `${key}=${value}`)
    .join('\n');

  // Вычисляем secret_key
  const secretKey = crypto
    .createHmac('sha256', 'WebAppData')
    .update(botToken)
    .digest();

  // Вычисляем hash
  const hash = crypto
    .createHmac('sha256', secretKey)
    .update(dataCheckString)
    .digest('hex');

  params.set('hash', hash);

  return params.toString();
}

// Основная логика
const botToken = process.env.TELEGRAM_BOT_TOKEN;

if (!botToken) {
  console.error('❌ Ошибка: TELEGRAM_BOT_TOKEN не установлен');
  console.error('');
  console.error('Использование:');
  console.error('  TELEGRAM_BOT_TOKEN=your_token node scripts/generate-mock-initdata.js');
  console.error('');
  console.error('Или добавьте TELEGRAM_BOT_TOKEN в файл .env');
  process.exit(1);
}

// Примеры пользователей
const users = [
  {
    id: 123456789,
    first_name: 'Сергей',
    last_name: 'Иванов',
    username: 'sergey_test',
    language_code: 'ru'
  },
  {
    id: 987654321,
    first_name: 'Test',
    username: 'test_user',
    language_code: 'en'
  }
];

console.log('🔐 Генерация mock Telegram initData');
console.log('═══════════════════════════════════════════════════════════════');
console.log('');

users.forEach((user, index) => {
  const mockInitData = createMockInitData(user, botToken);
  
  console.log(`Пользователь ${index + 1}: ${user.first_name} (ID: ${user.id})`);
  console.log('─────────────────────────────────────────────────────────────');
  console.log('initData:');
  console.log(mockInitData);
  console.log('');
  console.log('Для curl:');
  console.log(`curl -H "X-Telegram-Init-Data: ${mockInitData}" \\`);
  console.log(`  http://localhost:5000/api/object/current`);
  console.log('');
  console.log('Для JavaScript fetch:');
  console.log(`fetch('/api/object/current', {`);
  console.log(`  headers: { 'X-Telegram-Init-Data': '${mockInitData}' }`);
  console.log(`})`);
  console.log('');
  console.log('═══════════════════════════════════════════════════════════════');
  console.log('');
});

console.log('✅ Mock initData успешно сгенерирован');
console.log('');
console.log('💡 Совет: Сохраните initData для использования в тестах');
