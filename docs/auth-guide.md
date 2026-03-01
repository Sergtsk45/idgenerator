/**
 * @file: auth-guide.md
 * @description: Руководство по мультипровайдерной аутентификации системы
 * @dependencies: auth-service.ts, middleware/auth.ts, routes/auth.ts, client/lib/auth.ts
 * @created: 2026-03-01
 */

# Руководство по аутентификации (JWT + Multi-Provider)

## Обзор системы

TelegramJurnalRabot реализует **мультипровайдерную аутентификацию** через единый интерфейс управления пользователями и аутентификацией.

### Зачем нужна мультипровайдерная система?
- **Telegram MiniApp**: пользователи входят через Telegram (один клик)
- **Веб-браузер**: пользователи регистрируются по email/паролю
- **Будущее**: готовность к OAuth2, Phone-код и другим провайдерам
- **Профиль**: один пользователь может привязать несколько провайдеров к одному аккаунту

### Архитектура (три уровня)

```
┌─────────────────────────────────────────────────┐
│ Клиент (React)                                  │
│ - Login.tsx, Register.tsx, AuthGuard.tsx        │
│ - useAuth(), use-admin.ts (React Query)         │
│ - localStorage (JWT token)                      │
└──────────────────┬──────────────────────────────┘
                   │ JWT / X-Telegram-Init-Data
                   ▼
┌─────────────────────────────────────────────────┐
│ Middleware (Express)                            │
│ - auth.ts (unified)                             │
│ - parseJWT / parseTelegramInitData              │
│ - req.user = { id, email, role }               │
└──────────────────┬──────────────────────────────┘
                   │
                   ▼
┌─────────────────────────────────────────────────┐
│ Auth-сервис (server/auth-service.ts)            │
│ - hashPassword / verifyPassword (bcrypt)        │
│ - generateJWT / verifyJWT (jose/HS256)          │
│ - findOrCreateUserByProvider                    │
│ - validateTelegramAuthDate                      │
└──────────────────┬──────────────────────────────┘
                   │
                   ▼
┌─────────────────────────────────────────────────┐
│ БД (PostgreSQL)                                 │
│ - users (id, email, password_hash, role, ...)  │
│ - auth_providers (user_id, provider, ...)       │
└─────────────────────────────────────────────────┘
```

---

## Провайдеры аутентификации

### 1. Telegram (для MiniApp)

**Как это работает:**
1. Пользователь открывает приложение в Telegram (через Web App)
2. Telegram автоматически передаёт `initData` (данные пользователя + подпись)
3. Клиент отправляет на сервер: `POST /api/auth/login/telegram` с `initData`
4. Сервер:
   - Валидирует подпись HMAC-SHA-256 с `TELEGRAM_BOT_TOKEN`
   - Проверяет свежесть `auth_date` (< 600 сек)
   - Ищет пользователя по `telegram_user_id` в таблице `auth_providers`
   - Если не найден — создаёт новый пользователь + запись в `auth_providers`
   - Генерирует JWT токен
5. Клиент сохраняет JWT в localStorage
6. Все последующие запросы отправляют JWT в заголовке `Authorization: Bearer <token>`

**Request:**
```json
{
  "initData": "user=%7B%22id%22%3A123456789%2C%22is_bot%22%3Afalse%2C..."
}
```

**Response:**
```json
{
  "user": {
    "id": 1,
    "email": null,
    "role": "user",
    "providers": ["telegram"]
  },
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
}
```

**Особенности:**
- Автоматический вход (не требует пароля)
- Привязка к внутреннему `users.id`, но аутентификация по `telegram_user_id`
- Rate limiting: 5 попыток в минуту на IP

**Документация по настройке Telegram-бота:**
→ `docs/telegram-bot-setup.md`

### 2. Email/Password (для браузера)

**Регистрация:**
1. Пользователь заполняет форму на экране `/register`
   - Email (валидация: уникальность)
   - Password (валидация: минимум 8 символов)
2. Клиент отправляет: `POST /api/auth/register` с `{ email, password }`
3. Сервер:
   - Проверяет уникальность email
   - Хеширует пароль через bcrypt (cost factor 12)
   - Создаёт пользователя в `users`
   - Создаёт запись в `auth_providers` с `provider='email'`
   - Генерирует JWT токен
4. Клиент сохраняет JWT в localStorage

**Request:**
```json
{
  "email": "user@example.com",
  "password": "SecurePassword123!"
}
```

**Response:**
```json
{
  "user": {
    "id": 2,
    "email": "user@example.com",
    "role": "user",
    "providers": ["email"]
  },
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
}
```

**Вход:**
1. Пользователь заполняет форму на экране `/login`
   - Email
   - Password
2. Клиент отправляет: `POST /api/auth/login` с `{ email, password }`
3. Сервер:
   - Ищет пользователя по email
   - Проверяет пароль через bcrypt
   - Генерирует JWT токен
4. Клиент сохраняет JWT в localStorage

**Request:**
```json
{
  "email": "user@example.com",
  "password": "SecurePassword123!"
}
```

**Response:** (как при регистрации)

**Особенности:**
- Пароль хешируется через bcrypt (rounds=12)
- Rate limiting: 5 попыток в минуту (login), 3 попытки в час (register)
- Поддержка восстановления пароля (в планах)

### 3. Расширение новыми провайдерами

**Как добавить Phone-код:**
1. Создайте endpoint `POST /api/auth/login/phone`
2. Отправьте код на номер телефона (через внешний сервис, например Twilio)
3. Валидируйте код в `POST /api/auth/verify-phone`
4. В `auth-service.ts` добавьте метод `validatePhoneCode()`
5. Следуйте паттерну `findOrCreateUserByProvider('phone', phoneNumber)`

**Как добавить Google OAuth:**
1. Создайте endpoint `POST /api/auth/login/google`
2. Получите `googleIdToken` от клиента (через Google Sign-In SDK)
3. Валидируйте токен с Google API
4. В `auth-service.ts` добавьте метод `validateGoogleToken()`
5. Используйте паттерн `findOrCreateUserByProvider('google', googleUserId)`

---

## JWT токены

### Структура JWT

**Заголовок (Header):**
```json
{
  "alg": "HS256",
  "typ": "JWT"
}
```

**Payload:**
```json
{
  "sub": "1",
  "email": "user@example.com",
  "role": "user",
  "iat": 1705190400,
  "exp": 1705795200
}
```

- `sub` — ID пользователя (из `users.id`)
- `email` — email пользователя (может быть null для Telegram-пользователей)
- `role` — роль ('user' или 'admin')
- `iat` — время выдачи токена (в секундах Unix)
- `exp` — время истечения токена (по умолчанию +7 дней)

**Подпись (Signature):**
```
HMACSHA256(
  base64UrlEncode(header) + "." +
  base64UrlEncode(payload),
  SECRET_KEY
)
```

### Время жизни токена

**По умолчанию:** 7 дней

**Настройка через environment variable:**
```bash
JWT_EXPIRES_IN=24h    # 24 часа
JWT_EXPIRES_IN=7d     # 7 дней (default)
JWT_EXPIRES_IN=14d    # 14 дней
```

**Форматы поддерживаемые библиотекой `jose`:**
- `60` — 60 секунд
- `2m` — 2 минуты
- `1h` — 1 час
- `1d` — 1 день
- `7d` — 7 дней

### Хранение на клиенте

**localStorage:**
```javascript
// Сохранение
localStorage.setItem('authToken', token);

// Получение
const token = localStorage.getItem('authToken');

// Удаление (выход)
localStorage.removeItem('authToken');
```

**Отправка в запросах:**
```javascript
// Автоматически добавляется в queryClient (client/lib/queryClient.ts)
headers: {
  'Authorization': `Bearer ${token}`
}
```

### Обновление токена (Refresh Token)

⚠️ **Текущее состояние:** Refresh tokens не реализованы. Когда токен истечёт, пользователю нужно заново залогиниться.

**План реализации (MULTI-031):**
1. Добавить поле `refreshToken` в таблицу `auth_tokens`
2. Endpoint `POST /api/auth/refresh` — выдать новый JWT, используя refresh token
3. Автоматическое обновление токена на клиенте перед истечением (за 5 минут)
4. Rotary refresh tokens — каждый refresh выдаёт новый refresh token

---

## Безопасность

### Хеширование паролей (Bcrypt)

**Алгоритм:** bcrypt с salt rounds = 12

**Процесс:**
1. Пользователь вводит пароль: `"SecurePassword123!"`
2. Сервер генерирует соль и хеширует: `bcrypt.hash(password, 12)`
3. Результат сохраняется в БД: `$2b$12$R9h7cIPz0gi.URNNX3kh2OPST9/PgBkqquzi.Hn5huh8FY2wXOJrm`
4. При входе: `bcrypt.compare(inputPassword, hashedPassword)` → true/false

**Преимущества:**
- Медленное (что защищает от brute force)
- С солью (защита от rainbow tables)
- Адаптивное (можно увеличить rounds при нужде)

**Где вызывается:**
- `server/auth-service.ts`:
  ```typescript
  hashPassword(password: string): Promise<string>
  verifyPassword(password: string, hash: string): Promise<boolean>
  ```

### JWT секрет

**Обязателен в production** (`NODE_ENV=production`).

**Требования:**
- Минимум 32 символа
- Случайная строка (не "password123")
- Генерация: `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`

**Пример:**
```bash
JWT_SECRET=a7f3d8e2b1c9f4a6d5e8c1b3a7f9d2e5c8b1a4f6d9e2c5a8f1b4e7d0c3f6a9
```

**Ротация секрета:**
1. Сгенерируйте новый секрет
2. Обновите `JWT_SECRET` в environment
3. Перезагрузите сервер
4. Все существующие токены станут невалидными (пользователи заново залогинятся)

### Telegram auth_date валидация

**Защита от replay атак:**
- Проверяется, что `auth_date` был выдан менее 600 секунд назад (10 минут)
- Если старше — токен отклоняется

**Где вызывается:**
```typescript
server/auth-service.ts:
validateTelegramAuthDate(authDate: number): boolean
```

**Пример:**
```javascript
// Текущее время: 1705190400 (Unix timestamp)
// auth_date из Telegram: 1705190350 (50 секунд назад)
// Результат: ✅ Valid

// auth_date: 1705189800 (600+ секунд назад)
// Результат: ❌ Expired
```

### Rate limiting

**На login (`POST /api/auth/login`, `POST /api/auth/login/telegram`):**
- **Лимит:** 5 попыток в минуту на IP
- **Ответ при превышении:** 429 Too Many Requests

**На register (`POST /api/auth/register`):**
- **Лимит:** 3 попытки в час на IP
- **Ответ при превышении:** 429 Too Many Requests

**Библиотека:** `express-rate-limit`

**Где настраивается:**
```typescript
server/routes/auth.ts
```

### HTTPS обязателен в production

- JWT токены содержат данные пользователя (не чувствительные, но конфиденциальные)
- Передача по незащищённому каналу позволит перехватить токен
- Без HTTPS: cookie-флаги (secure, httpOnly) не работают

---

## Миграция существующих пользователей

### Что произошло

**До:** Пользователи идентифицировались только по `telegram_user_id` в таблице `objects`.

**Сейчас:** Введена унифицированная система с таблицами `users` и `auth_providers`.

### Как работает автоматическая миграция

**SQL миграция `0018_users_auth_providers.sql`:**
1. Создаёт таблицы `users` и `auth_providers`
2. Сканирует все уникальные `telegram_user_id` из `objects`
3. Для каждого `telegram_user_id` создаёт:
   - Запись в `users` (с email=null, password_hash=null, role='user')
   - Запись в `auth_providers` (provider='telegram', providerUserId=telegram_user_id)
4. Обновляет `objects.user_id` на `users.id`
5. Удаляет `objects.telegram_user_id` (в миграции `0019`)

**SQL миграция `0019_drop_legacy_telegram_columns.sql`:**
1. Удаляет таблицу `admin_users` (её функционал перенесён в `users.role='admin'`)
2. Удаляет колонку `telegram_user_id` из `objects`

### Что делать с orphan объектами

**Orphan объекты** — объекты без привязки к пользователю (случаются редко).

**Как найти:**
```sql
SELECT * FROM objects WHERE user_id IS NULL;
```

**Решение:**
1. **Удалить:** `DELETE FROM objects WHERE user_id IS NULL;`
2. **Привязать вручную:** `UPDATE objects SET user_id = ? WHERE id = ?;`
3. **Поддержка:** Создайте issue в репозитории

---

## Troubleshooting

### "Invalid JWT"
**Проблема:** JWT токен не валидируется на сервере.

**Решение:**
1. Проверьте переменную окружения `JWT_SECRET`:
   ```bash
   echo $JWT_SECRET
   ```
   Если пусто или отличается от того, что было при генерации токена → ошибка.

2. Проверьте срок истечения токена:
   ```javascript
   // Декодируйте JWT (без верификации)
   const payload = JSON.parse(atob(token.split('.')[1]));
   console.log('Expires at:', new Date(payload.exp * 1000));
   console.log('Current time:', new Date());
   ```
   Если текущее время > exp → токен истёк.

3. Проверьте, что клиент отправляет заголовок:
   ```
   Authorization: Bearer <token>
   ```
   (без "Bearer" будет ошибка парсинга)

**Действие:** Переавторизуйтесь (заново залогинитесь).

### "Telegram auth failed"
**Проблема:** Сервер отклонил Telegram initData.

**Решение:**
1. Проверьте переменную окружения `TELEGRAM_BOT_TOKEN`:
   ```bash
   echo $TELEGRAM_BOT_TOKEN
   ```
   Токен должен соответствовать боту, выданному @BotFather.

2. Проверьте свежесть `auth_date`:
   ```javascript
   // Если auth_date в initData старше 600 сек назад
   const authDate = new Date(initData.auth_date * 1000);
   const now = new Date();
   if ((now - authDate) / 1000 > 600) {
     console.error('auth_date слишком старый');
   }
   ```

3. Проверьте, что initData передана корректно:
   - Не забыли ли URL-encode?
   - Не обрезана ли во время передачи?

**Действие:** Перезагрузите приложение в Telegram или очистите кэш браузера.

### "Email already registered"
**Проблема:** Попытка зарегистрировать email, который уже существует.

**Решение:**
1. Если это ваш email → используйте `/login` вместо `/register`
2. Если это не ваш email → используйте другой email
3. Если забыли пароль → поддержка восстановления пароля (в планах)

**Действие:** Нажмите "Уже есть аккаунт?" и используйте вход по паролю.

---

## API Reference для разработчиков

### POST /api/auth/register

**Request:**
```json
{
  "email": "user@example.com",
  "password": "SecurePassword123!"
}
```

**Response (200):**
```json
{
  "user": {
    "id": 1,
    "email": "user@example.com",
    "role": "user",
    "providers": ["email"]
  },
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
}
```

**Errors:**
- `400` — Email некорректен или пароль слишком слаб
- `409` — Email уже зарегистрирован
- `429` — Too many requests (rate limit)

### POST /api/auth/login

**Request:**
```json
{
  "email": "user@example.com",
  "password": "SecurePassword123!"
}
```

**Response (200):** (как при регистрации)

**Errors:**
- `400` — Email или пароль не предоставлены
- `401` — Email не найден или пароль неверен
- `429` — Too many requests (rate limit)

### POST /api/auth/login/telegram

**Request:**
```json
{
  "initData": "user=%7B%22id%22%3A123456789%2C..."
}
```

**Response (200):**
```json
{
  "user": {
    "id": 1,
    "email": null,
    "role": "user",
    "providers": ["telegram"]
  },
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
}
```

**Errors:**
- `400` — initData не предоставлена
- `401` — initData невалидна (неверная подпись, истёк auth_date)
- `429` — Too many requests (rate limit)

### GET /api/auth/me

**Headers:**
```
Authorization: Bearer <token>
```

**Response (200):**
```json
{
  "id": 1,
  "email": "user@example.com",
  "role": "user",
  "providers": ["telegram", "email"],
  "linkedAt": "2026-03-01T12:00:00Z"
}
```

**Errors:**
- `401` — Токен отсутствует, невалиден или истёк

### POST /api/auth/link-provider

**Headers:**
```
Authorization: Bearer <token>
```

**Request:**
```json
{
  "provider": "telegram",
  "initData": "user=%7B%22id%22%3A987654321%2C..."
}
```

**Response (200):**
```json
{
  "success": true,
  "message": "Provider linked successfully",
  "providers": ["email", "telegram"]
}
```

**Errors:**
- `401` — Токен невалиден
- `409` — Этот провайдер уже привязан к другому аккаунту

---

## Контакты и поддержка

Вопросы по аутентификации?
- Создайте issue в репозитории
- Свяжитесь с командой разработки
- Документация: `docs/auth-guide.md`, `docs/project.md`
