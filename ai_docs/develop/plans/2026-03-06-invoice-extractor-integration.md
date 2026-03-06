# План внедрения микросервиса invoice-extractor (Вариант А)

**Дата**: 2026-03-06
**Цель**: Адаптировать скопированный микросервис для работы в проекте TelegramJurnalRabot
**Ограничение**: Из извлечённых данных используются ТОЛЬКО `name` и `unit`

---

## Обнаруженные проблемы

### 1. Dockerfile — неверная команда запуска
- **CMD**: `gunicorn -c backend/gunicorn.conf.py backend.app:app`
- **Проблема**: `backend.app:app` не сработает — конфликт между `backend/app.py` (модуль) и `backend/app/` (пакет). Именно для этого автор создал `backend/wsgi.py`, который решает конфликт через `importlib`.
- **Решение**: Заменить на `backend.wsgi:app`

### 2. docker-compose.yml — несовпадение портов
- **Маппинг**: `5050:5000` (ожидает порт 5000 внутри контейнера)
- **gunicorn.conf.py**: слушает `PORT` → fallback `FLASK_PORT` → fallback `5002`
- **docker-compose env**: НЕ задаёт PORT/FLASK_PORT → gunicorn запустится на **5002**, а маппинг указывает на **5000**
- **healthcheck**: `http://localhost:5000/health` — тоже неверный порт
- **Решение**: Добавить `PORT=5000` в environment docker-compose ИЛИ сменить маппинг

### 3. Ненужные файлы Shell App
- `component.js` — Web Component для карточки в Shell App (другой проект)
- `manifest.json` — манифест регистрации в Shell App
- Эти файлы не используются в TelegramJurnalRabot

### 4. Лишние данные в API-контракте
- `shared/routes.ts` parseInvoice response содержит: `qty`, `price`, `amount_w_vat`, `vat_rate`
- `server/routes.ts` маппит все эти поля из ответа микросервиса
- `InvoicePreviewDialog.tsx` отображает qty/price, но при импорте передаёт только `name`/`unit`
- **Решение**: Убрать лишние поля из контракта, маппинга и UI

### 5. testFiles/files_invoice-extractor/
- Содержит старую версию extractor из другого проекта (flat-структура, run.py)
- Не связана с текущей интеграцией

---

## Детальный план по шагам

### Шаг 1: Исправление Dockerfile

**Файл**: `services/invoice-extractor/Dockerfile`

**Текущее состояние**:
```dockerfile
FROM python:3.11-slim
WORKDIR /app
RUN apt-get update && apt-get install -y --no-install-recommends \
    libgl1 libglib2.0-0 && rm -rf /var/lib/apt/lists/*
COPY backend/requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt
COPY backend/ backend/
RUN mkdir -p backend/uploads backend/outputs
EXPOSE 5002
CMD ["gunicorn", "-c", "backend/gunicorn.conf.py", "backend.app:app"]
```

**Изменения**:
1. CMD: `backend.app:app` → `backend.wsgi:app` (wsgi.py решает конфликт имён)
2. EXPOSE: `5002` → `5000` (совпадение с docker-compose маппингом)

**Результат**:
```dockerfile
FROM python:3.11-slim
WORKDIR /app
RUN apt-get update && apt-get install -y --no-install-recommends \
    libgl1 libglib2.0-0 && rm -rf /var/lib/apt/lists/*
COPY backend/requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt
COPY backend/ backend/
RUN mkdir -p backend/uploads backend/outputs
EXPOSE 5000
CMD ["gunicorn", "-c", "backend/gunicorn.conf.py", "backend.wsgi:app"]
```

---

### Шаг 2: Исправление docker-compose.yml

**Файл**: `docker-compose.yml`

**Текущее состояние**: не задаёт PORT → gunicorn слушает 5002 → маппинг 5050:5000 не работает

**Изменения**:
1. Добавить `PORT=5000` в environment (чтобы gunicorn слушал порт 5000)
2. healthcheck уже верный: `/health` — это правильный маршрут Flask

**Результат**:
```yaml
services:
  invoice-extractor:
    build:
      context: ./services/invoice-extractor
      dockerfile: Dockerfile
    ports:
      - "5050:5000"
    environment:
      - PORT=5000
      - LLM_PROVIDER=${LLM_PROVIDER:-anthropic}
      - ANTHROPIC_API_KEY=${ANTHROPIC_API_KEY}
      - OPENAI_API_KEY=${OPENAI_API_KEY:-}
      - OPENROUTER_API_KEY=${OPENROUTER_API_KEY:-}
      - MAX_FILE_SIZE_MB=${MAX_FILE_SIZE_MB:-50}
      - MAX_PAGES=${MAX_PAGES:-30}
      - REQUEST_TIMEOUT_SEC=${REQUEST_TIMEOUT_SEC:-120}
    restart: unless-stopped
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:5000/health"]
      interval: 30s
      timeout: 10s
      retries: 3
```

---

### Шаг 3: Настройка .env микросервиса

**Файл**: `services/invoice-extractor/backend/.env`

**Текущее состояние**: API-ключи LLM закомментированы. Text-first режим (pdfplumber) работает без ключей. Vision fallback невозможен.

**Действие**: Раскомментировать и вписать ключ нужного LLM-провайдера. Без ключа text-only парсинг работает, но для сложных/отсканированных PDF нужен Vision.

**Примечание**: Этот файл НЕ коммитится (в .gitignore). Настраивается вручную на каждой машине.

---

### Шаг 4: Удаление ненужных файлов Shell App

**Удалить файлы** (не используются в TelegramJurnalRabot):
- `services/invoice-extractor/component.js` — Web Component Shell App
- `services/invoice-extractor/manifest.json` — манифест Shell App

**Не удалять** (полезно):
- `services/invoice-extractor/README.md` — документация API
- `testFiles/files_invoice-extractor/` — решить отдельно (старая версия, можно удалить позже)

---

### Шаг 5: Упрощение API-контракта

**Файл**: `shared/routes.ts` (строки 424–446)

**Текущий контракт parseInvoice response**:
```typescript
items: z.array(z.object({
  name: z.string(),
  unit: z.string().optional().default(""),
  qty: z.union([z.number(), z.string()]).optional(),
  price: z.union([z.number(), z.string()]).optional(),
  amount_w_vat: z.union([z.number(), z.string()]).optional(),
  vat_rate: z.string().optional(),
})),
```

**Новый контракт** (только name + unit):
```typescript
items: z.array(z.object({
  name: z.string(),
  unit: z.string().optional().default(""),
})),
```

Остальные поля ответа (invoice_number, invoice_date, supplier_name, warnings) — оставить как есть, они используются в UI для отображения информации о счёте.

---

### Шаг 6: Упрощение backend-прокси

**Файл**: `server/routes.ts` (строки 424–437)

**Текущий маппинг**:
```typescript
items: (data.items || []).map((item: any) => ({
  name: String(item.name || '').trim(),
  unit: String(item.unit || '').trim(),
  qty: item.qty ?? '',
  price: item.price ?? '',
  amount_w_vat: item.amount_w_vat ?? '',
  vat_rate: item.vat_rate ?? '',
})).filter((item: any) => item.name.length > 0),
```

**Новый маппинг** (только name + unit):
```typescript
items: (data.items || []).map((item: any) => ({
  name: String(item.name || item.description || '').trim(),
  unit: String(item.unit || '').trim(),
})).filter((item: any) => item.name.length > 0),
```

**Примечание**: Добавляем fallback на `item.description` — микросервис может использовать разные имена полей в зависимости от режима парсинга (text-first vs Vision).

---

### Шаг 7: Упрощение frontend-типов и UI

**Файл**: `client/src/components/materials/InvoicePreviewDialog.tsx`

**7a. Тип ParsedInvoiceData** (строки 28–41):
Убрать `qty`, `price`, `amount_w_vat`, `vat_rate` из типа:
```typescript
type ParsedInvoiceData = {
  items: Array<{
    name: string;
    unit?: string;
  }>;
  invoice_number?: string;
  invoice_date?: string;
  supplier_name?: string;
  warnings?: string[];
};
```

**7b. Убрать отображение qty/price** (строки 262–271):
Удалить блок с `{item.qty != null && ...}` и `{item.price != null && ...}`.

**Результат UI**: в диалоге предпросмотра остаётся только наименование товара и единица измерения (с возможностью редактирования).

---

### Шаг 8: Верификация — сборка Docker-образа

**Действия**:
1. `docker-compose build invoice-extractor` — проверить сборку
2. `docker-compose up invoice-extractor` — проверить запуск
3. `curl http://localhost:5050/health` — проверить healthcheck
4. `curl -X POST -F "file=@test.pdf" -F "output=json" http://localhost:5050/convert` — проверить парсинг (если есть тестовый PDF)

**Ожидаемый результат**:
- healthcheck: `{"status":"ok","version":"1.0.0","service":"invoice-extractor"}`
- convert: JSON с полями items/invoice_number/...

---

### Шаг 9: Обновление документации

**Файлы**:
- `docs/changelog.md` — запись об интеграции
- `docs/tasktracker.md` — отметить шаги как завершённые
- `docs/project.md` — проверить актуальность (уже содержит описание invoice-extractor)

---

## Файлы, затрагиваемые изменениями

| # | Файл | Действие |
|---|------|----------|
| 1 | `services/invoice-extractor/Dockerfile` | Редактирование (CMD, EXPOSE) |
| 2 | `docker-compose.yml` | Редактирование (добавить PORT=5000) |
| 3 | `services/invoice-extractor/component.js` | Удаление |
| 4 | `services/invoice-extractor/manifest.json` | Удаление |
| 5 | `shared/routes.ts` | Редактирование (убрать qty/price/amount_w_vat/vat_rate) |
| 6 | `server/routes.ts` | Редактирование (убрать маппинг лишних полей) |
| 7 | `client/src/components/materials/InvoicePreviewDialog.tsx` | Редактирование (тип + UI) |
| 8 | `docs/changelog.md` | Редактирование (добавить запись) |
| 9 | `docs/tasktracker.md` | Редактирование (статус задачи) |

---

## Риски и примечания

1. **Микросервис без LLM-ключей**: text-first парсинг через pdfplumber работает для нативных PDF. Для сканов нужен LLM Vision — требуется настройка ключей в `.env` микросервиса.
2. **Поле `description` vs `name`**: микросервис в text-first режиме извлекает `name`, но в Vision-режиме может вернуть `description`. Backend добавляет fallback.
3. **Docker в WSL2**: `docker-compose` должен быть установлен (Docker Desktop или Docker Engine в WSL). Порт 5050 должен быть свободен.
4. **CORS**: не проблема — Express делает server-to-server запрос к Flask, CORS влияет только на браузерные запросы.
5. **testFiles/files_invoice-extractor/**: не удаляем в рамках этой задачи — содержит старую flat-версию extractor из другого проекта. Очистка — отдельная задача.

---

## Порядок выполнения

```
Шаг 1 (Dockerfile) ──┐
Шаг 2 (compose)    ──┤── параллельно, независимы
Шаг 4 (удаление)   ──┘
         │
Шаг 3 (.env) ── вручную, не коммитится
         │
Шаг 5 (shared/routes.ts) ──┐
Шаг 6 (server/routes.ts) ──┤── последовательно (контракт → реализация → UI)
Шаг 7 (frontend)          ──┘
         │
Шаг 8 (верификация Docker)
         │
Шаг 9 (документация)
```

**Оценка времени**: ~30–45 минут на код + тестирование Docker.
