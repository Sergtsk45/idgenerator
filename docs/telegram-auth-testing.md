# Тестирование Telegram Authentication

## Обзор

Серверная валидация Telegram WebApp initData реализована через middleware `server/middleware/telegramAuth.ts`.

## Как работает валидация

1. Клиент отправляет `initData` в заголовке `X-Telegram-Init-Data` или в теле запроса
2. Middleware проверяет подпись HMAC-SHA-256 согласно [документации Telegram](https://core.telegram.org/bots/webapps#validating-data-received-via-the-mini-app)
3. При успешной валидации данные пользователя добавляются в `req.telegramUser`
4. При ошибке возвращается 401 Unauthorized

## Режимы работы

### Development (без TELEGRAM_BOT_TOKEN)
- Middleware пропускает запросы без валидации
- Выводится предупреждение в консоль
- Приложение работает как обычный SPA

### Development (с TELEGRAM_BOT_TOKEN)
- Middleware проверяет initData, если он передан
- Запросы без initData пропускаются (опциональная аутентификация)

### Production
- Middleware требует валидный initData для всех защищённых эндпоинтов
- Запросы без initData или с невалидной подписью отклоняются (401)

## Генерация mock initData для тестирования

### Вариант 1: Использовать утилиту из middleware

```typescript
import { createMockInitData } from './server/middleware/telegramAuth';

const botToken = process.env.TELEGRAM_BOT_TOKEN!;
const mockInitData = createMockInitData(
  {
    id: 123456789,
    first_name: 'Сергей',
    last_name: 'Иванов',
    username: 'sergey_test',
    language_code: 'ru'
  },
  botToken
);

console.log('Mock initData:', mockInitData);
```

### Вариант 2: Создать Node.js скрипт

Создайте файл `scripts/generate-mock-initdata.js`:

```javascript
const crypto = require('crypto');

function createMockInitData(user, botToken) {
  const userData = {
    id: user.id || 123456789,
    first_name: user.first_name || 'Test',
    last_name: user.last_name,
    username: user.username,
    language_code: user.language_code || 'ru',
  };

  const params = new URLSearchParams();
  params.set('user', JSON.stringify(userData));
  params.set('auth_date', Math.floor(Date.now() / 1000).toString());
  params.set('query_id', 'AAHdF6IQAAAAAN0XohDhrOrc');

  const dataCheckString = Array.from(params.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, value]) => `${key}=${value}`)
    .join('\n');

  const secretKey = crypto
    .createHmac('sha256', 'WebAppData')
    .update(botToken)
    .digest();

  const hash = crypto
    .createHmac('sha256', secretKey)
    .update(dataCheckString)
    .digest('hex');

  params.set('hash', hash);

  return params.toString();
}

// Использование
const botToken = process.env.TELEGRAM_BOT_TOKEN || 'YOUR_BOT_TOKEN';
const mockInitData = createMockInitData(
  {
    id: 123456789,
    first_name: 'Сергей',
    username: 'sergey_test'
  },
  botToken
);

console.log('Mock initData:');
console.log(mockInitData);
console.log('\nДля использования в curl:');
console.log(`curl -H "X-Telegram-Init-Data: ${mockInitData}" http://localhost:5000/api/object/current`);
```

Запуск:
```bash
TELEGRAM_BOT_TOKEN=your_bot_token node scripts/generate-mock-initdata.js
```

## Тестирование с curl

### 1. Получить mock initData
```bash
node scripts/generate-mock-initdata.js
```

### 2. Отправить запрос с initData
```bash
curl -H "X-Telegram-Init-Data: auth_date=1708419600&hash=abc123...&query_id=AAHdF6IQ&user=%7B%22id%22%3A123456789%2C%22first_name%22%3A%22Test%22%7D" \
  http://localhost:5000/api/object/current
```

### 3. Проверить ошибку при невалидном initData
```bash
curl -H "X-Telegram-Init-Data: invalid_data" \
  http://localhost:5000/api/object/current
```

Ожидаемый ответ:
```json
{
  "error": "Invalid Telegram authentication data"
}
```

## Тестирование в браузере

### Через DevTools Console

```javascript
// Получить initData из Telegram WebApp
const initData = window.Telegram.WebApp.initData;

// Отправить запрос
fetch('/api/object/current', {
  headers: {
    'X-Telegram-Init-Data': initData
  }
})
  .then(r => r.json())
  .then(console.log);
```

## Получение реальных данных из Telegram

### 1. Создать бота через @BotFather
```
/newbot
Название: Test Construction Bot
Username: test_construction_bot
```

Сохраните токен бота.

### 2. Настроить Web App URL
```
/setmenubutton
Выберите бота
Введите текст кнопки: Открыть приложение
Введите URL: https://your-domain.com
```

### 3. Добавить токен в .env
```bash
TELEGRAM_BOT_TOKEN=1234567890:ABCdefGHIjklMNOpqrsTUVwxyz
```

### 4. Открыть приложение в Telegram
- Откройте бота в Telegram
- Нажмите кнопку меню
- Приложение откроется с валидным initData

## Структура initData

Пример декодированного initData:

```
query_id=AAHdF6IQAAAAAN0XohDhrOrc
user={"id":123456789,"first_name":"Сергей","last_name":"Иванов","username":"sergey_test","language_code":"ru"}
auth_date=1708419600
hash=a1b2c3d4e5f6...
```

Поля:
- `query_id` - уникальный ID запроса
- `user` - JSON с данными пользователя
- `auth_date` - Unix timestamp
- `hash` - HMAC-SHA-256 подпись

## Отладка

### Включить логирование middleware

В `server/middleware/telegramAuth.ts` раскомментируйте строки:

```typescript
console.log('[TelegramAuth] Received initData:', initData);
console.log('[TelegramAuth] Computed hash:', computedHash);
console.log('[TelegramAuth] Expected hash:', hash);
```

### Проверить переменные окружения

```bash
echo $TELEGRAM_BOT_TOKEN
```

### Проверить, что initData передаётся с клиента

В `client/src/lib/queryClient.ts` добавьте:

```typescript
console.log('[API] Sending initData:', getTelegramInitData());
```

## Безопасность

⚠️ **ВАЖНО:**

1. **Никогда не коммитьте** `TELEGRAM_BOT_TOKEN` в Git
2. **Не логируйте** initData в production (содержит данные пользователя)
3. **Используйте HTTPS** в production (initData передаётся в заголовках)
4. **Проверяйте auth_date** для защиты от replay-атак (опционально)

## Troubleshooting

### Ошибка: "TELEGRAM_BOT_TOKEN not configured"
- Убедитесь, что переменная окружения установлена
- Проверьте файл `.env`
- Перезапустите сервер после изменения `.env`

### Ошибка: "Invalid Telegram authentication data"
- Проверьте, что используется правильный Bot Token
- Убедитесь, что initData не был изменён
- Проверьте, что hash вычисляется корректно

### Ошибка: "Telegram authentication required"
- В production режиме все защищённые эндпоинты требуют initData
- Убедитесь, что клиент передаёт заголовок `X-Telegram-Init-Data`

### Приложение не работает в Telegram
- Проверьте, что Web App URL настроен правильно
- Убедитесь, что сервер доступен по HTTPS
- Проверьте логи сервера на наличие ошибок
