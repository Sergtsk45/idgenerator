# Руководство по деплою TJR — памятка для администратора

## Архитектура Docker-стека

На сервере работают **два отдельных docker-compose стека**, которые связаны через общую сеть `n8n_web`:

```
┌─────────────────────────────────────────────────┐
│  docker-compose.yml (~/tjr/)                    │
│  ┌──────────┐    ┌────────────────────────────┐ │
│  │  db       │    │  tjr (Node.js)             │ │
│  │  postgres │◄───│  INVOICE_EXTRACTOR_URL ──────────┐
│  └──────────┘    └────────────────────────────┘ │    │
│                          сеть: n8n_web          │    │
└─────────────────────────────────────────────────┘    │
                                                       │
┌─────────────────────────────────────────────────┐    │
│  app/docker-compose.yml (~/tjr/app/)            │    │
│  ┌────────────────────────────────────────────┐ │    │
│  │  invoice-extractor (Flask, порт 5000)      │◄─────┘
│  └────────────────────────────────────────────┘ │
│                          сеть: n8n_web          │
└─────────────────────────────────────────────────┘
```

## Критически важные настройки (НЕ УДАЛЯТЬ!)

### 1. `~/tjr/docker-compose.yml` — сервис `tjr`

```yaml
environment:
  - INVOICE_EXTRACTOR_URL=http://invoice-extractor:5000
```

**Зачем:** Node.js обращается к invoice-extractor по DNS-имени внутри Docker-сети.
Без этой переменной используется дефолт `localhost:5050`, который внутри контейнера не работает.

### 2. `~/tjr/app/docker-compose.yml` — сервис `invoice-extractor`

```yaml
networks:
  - n8n_web

networks:
  n8n_web:
    external: true
```

**Зачем:** invoice-extractor должен быть в той же сети, что и tjr.
Без этого контейнеры не видят друг друга, импорт PDF-счетов вернёт ошибку "Invoice extractor unavailable".

## Порядок деплоя

```bash
# 1. Сначала invoice-extractor (он должен быть доступен до старта tjr)
cd ~/tjr && docker compose -f app/docker-compose.yml up -d

# 2. Потом основной стек
cd ~/tjr && docker compose up -d
```

## Проверка после деплоя

```bash
# Invoice-extractor работает?
docker exec tjr-tjr-1 wget -qO- http://invoice-extractor:5000/health
# Ожидаемый ответ: {"status":"ok","version":"1.0.0"}

# Контейнеры в одной сети?
docker network inspect n8n_web --format '{{range .Containers}}{{.Name}} {{end}}' | tr ' ' '\n' | grep -E "tjr|invoice"
# Ожидаемый вывод: tjr-tjr-1 и app-invoice-extractor-1
```

## Частые ошибки

| Симптом | Причина | Решение |
|---------|---------|---------|
| "Invoice extractor unavailable" | Контейнеры в разных сетях | Добавить `networks: n8n_web` в `app/docker-compose.yml` |
| "Invoice extractor configuration error" | URL не в allowlist кода | Использовать `http://invoice-extractor:5000` |
| "Failed to parse invoice" (500) | Таблица `invoice_imports` не создана | Применить миграцию `0024_invoice_imports.sql` |

## Миграции базы данных

Миграции применяются автоматически при старте контейнера `tjr` (команда `npm run db:migrate`).

Если нужно применить вручную:

```bash
docker exec tjr-db-1 psql -U tjr -d tjr -f /path/to/migration.sql
```

Критически важная миграция для импорта счетов: `migrations/0024_invoice_imports.sql`

## Переменные окружения

Основные переменные в `~/tjr/app/.env`:

- `DATABASE_URL` — строка подключения к PostgreSQL
- `JWT_SECRET` — секрет для JWT-токенов
- `TELEGRAM_BOT_TOKEN` — токен Telegram-бота
- ~~`INVOICE_EXTRACTOR_URL`~~ — **НЕ ИСПОЛЬЗУЕТСЯ** (задаётся в docker-compose.yml)

**Важно:** `INVOICE_EXTRACTOR_URL` в `.env` игнорируется, т.к. перекрывается `environment` в docker-compose.yml.

## Логи и диагностика

```bash
# Логи Node.js сервера
docker logs tjr-tjr-1 --tail 100 -f

# Логи invoice-extractor
docker logs app-invoice-extractor-1 --tail 100 -f

# Проверка статуса всех контейнеров
docker ps --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}"
```

## Контакты

При проблемах с деплоем — обращаться к разработчикам проекта TJR.
