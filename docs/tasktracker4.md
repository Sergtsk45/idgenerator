# Feedback Loop для улучшения парсинга счетов

**Дата создания:** 2026-03-06  
**Orchestration ID:** orch-2026-03-06-feedback-loop  
**Цель:** Реализовать систему сбора и хранения пользовательских исправлений после парсинга PDF-счетов для анализа ошибок и улучшения парсера  
**Всего задач:** 6  
**Приоритет:** High

---

## Оглавление

1. [КОРР-1: Схема БД — таблица invoice_parse_corrections](#корр-1-схема-бд--таблица-invoice_parse_corrections)
2. [КОРР-2: API-контракт — Zod-схемы и описание эндпоинтов](#корр-2-api-контракт--zod-схемы-и-описание-эндпоинтов)
3. [КОРР-3: Backend — обработчики маршрутов](#корр-3-backend--обработчики-маршрутов)
4. [КОРР-4: Storage — методы работы с таблицей](#корр-4-storage--методы-работы-с-таблицей)
5. [КОРР-5: Frontend — отправка diff при импорте](#корр-5-frontend--отправка-diff-при-импорте)
6. [КОРР-6: Миграция БД](#корр-6-миграция-бд)

---

## Общее описание

При парсинге PDF-счетов микросервис `invoice-extractor` извлекает позиции (name, unit, qty). Пользователь в `InvoicePreviewDialog` может исправить любое из этих полей перед импортом. Сейчас эти исправления теряются — импорт сохраняет только итоговые данные.

**Что реализуем:** систему, которая при нажатии «Импорт» вычисляет diff между оригинальными (из парсера) и отредактированными данными, и отправляет массив исправлений на бэкенд fire-and-forget. Данные сохраняются в отдельную таблицу `invoice_parse_corrections` для последующего анализа частых ошибок парсера.

### Поток данных (целевой)

```
PDF → invoice-extractor → parsedData.items
                              ↓
                    InvoicePreviewDialog
                    (пользователь редактирует)
                              ↓
              ┌───────────────┴───────────────┐
              ↓                               ↓
    POST /api/.../bulk              POST /api/invoice-corrections
    (создание материалов)           (сохранение diff, fire-and-forget)
              ↓                               ↓
        project_materials            invoice_parse_corrections
```

### Граф зависимостей

```
КОРР-1 (Схема БД)
  ↓
КОРР-6 (Миграция)
  ↓
КОРР-2 (API-контракт) ← параллельно с КОРР-6
  ↓
КОРР-4 (Storage)
  ↓
КОРР-3 (Backend routes)
  ↓
КОРР-5 (Frontend)
```

---

## Задача: Схема БД — таблица invoice_parse_corrections
- **ID**: КОРР-1
- **Статус**: Не начата
- **Приоритет**: High
- **Сложность**: Simple
- **Описание**: Добавить определение новой таблицы `invoice_parse_corrections` в Drizzle-схему. Таблица хранит каждое отдельное исправление пользователя (одно поле = одна строка). Включает метаданные счёта для группировки и анализа.
- **Файлы**:
  - `shared/schema.ts` — определение таблицы + insertSchema + типы
- **Шаги выполнения**:
  - [ ] Добавить таблицу `invoiceParseCorrections` в `shared/schema.ts` со следующими полями:
    - `id` — serial PK
    - `objectId` — integer, FK → objects, NOT NULL
    - `userId` — integer, FK → users, NOT NULL
    - `fieldName` — text, NOT NULL (допустимые значения: 'name', 'unit', 'qty')
    - `originalValue` — text, NOT NULL (значение из парсера)
    - `correctedValue` — text, NOT NULL (значение от пользователя)
    - `itemIndex` — integer, NOT NULL (порядковый номер позиции в счёте, 0-based)
    - `invoiceNumber` — text, nullable (номер счёта для группировки)
    - `supplierName` — text, nullable (поставщик)
    - `pdfFilename` — text, nullable (имя загруженного файла)
    - `createdAt` — timestamp, defaultNow()
  - [ ] Добавить индексы: по `objectId`, `userId`, `fieldName`, `createdAt`
  - [ ] Добавить CHECK-constraint: `fieldName IN ('name', 'unit', 'qty')`
  - [ ] Создать `insertInvoiceParseCorrectionSchema` через `createInsertSchema`
  - [ ] Экспортировать типы `InvoiceParseCorrection` и `InsertInvoiceParseCorrection`
- **Зависимости**: нет
- **Критерии приёмки**:
  - Таблица определена в schema.ts со всеми полями и индексами
  - Insert-схема и типы экспортированы
  - Нет ошибок TypeScript

---

## Задача: API-контракт — Zod-схемы и описание эндпоинтов
- **ID**: КОРР-2
- **Статус**: Не начата
- **Приоритет**: High
- **Сложность**: Simple
- **Описание**: Определить API-контракт для двух новых эндпоинтов в `shared/routes.ts`: submit (приём массива исправлений) и stats (агрегированная статистика). Контракт включает Zod-схемы для валидации input/output.
- **Файлы**:
  - `shared/routes.ts` — новая секция `api.invoiceCorrections`
- **Шаги выполнения**:
  - [ ] Добавить секцию `invoiceCorrections` в объект `api`:
  - [ ] Определить `submit` эндпоинт:
    - Method: `POST`
    - Path: `/api/invoice-corrections`
    - Input (Zod):
      ```
      {
        objectId: z.number().int().positive(),
        invoiceNumber: z.string().optional(),
        supplierName: z.string().optional(),
        pdfFilename: z.string().optional(),
        corrections: z.array(z.object({
          itemIndex: z.number().int().min(0),
          fieldName: z.enum(['name', 'unit', 'qty']),
          originalValue: z.string(),
          correctedValue: z.string(),
        })).min(1).max(500),
      }
      ```
    - Responses:
      - 200: `{ saved: z.number() }`
      - 400: `{ message: z.string() }`
      - 401: `{ error: z.string() }`
  - [ ] Определить `stats` эндпоинт:
    - Method: `GET`
    - Path: `/api/invoice-corrections/stats`
    - Responses:
      - 200:
        ```
        {
          totalCorrections: z.number(),
          byField: z.array(z.object({
            fieldName: z.string(),
            count: z.number(),
          })),
          topPatterns: z.array(z.object({
            fieldName: z.string(),
            originalValue: z.string(),
            correctedValue: z.string(),
            count: z.number(),
          })),
        }
        ```
      - 401: `{ error: z.string() }`
  - [ ] Экспортировать нужные типы, если необходимо
- **Зависимости**: КОРР-1 (для ссылки на таблицу в типах)
- **Критерии приёмки**:
  - Zod-схемы определены, валидация проходит для валидных данных
  - Эндпоинты соответствуют REST-соглашениям проекта
  - Нет ошибок TypeScript

---

## Задача: Backend — обработчики маршрутов
- **ID**: КОРР-3
- **Статус**: Не начата
- **Приоритет**: High
- **Сложность**: Moderate
- **Описание**: Реализовать Express-обработчики для двух эндпоинтов: POST (приём и batch-сохранение исправлений) и GET (агрегированная статистика). Обработчики должны валидировать input через Zod, проверять аутентификацию и вызывать storage-методы.
- **Файлы**:
  - `server/routes.ts` — два новых обработчика
- **Шаги выполнения**:
  - [ ] Добавить `POST /api/invoice-corrections`:
    - Проверка аутентификации (extractUserId из middleware)
    - Валидация тела запроса через Zod-схему из `api.invoiceCorrections.submit.input`
    - Проверка доступа к objectId (пользователь имеет доступ к объекту)
    - Вызов `storage.saveInvoiceCorrections(userId, corrections)` с передачей всех полей
    - Возврат `{ saved: count }`
    - Обработка ошибок: 400 для невалидных данных, 401 для неавторизованных
  - [ ] Добавить `GET /api/invoice-corrections/stats`:
    - Проверка аутентификации
    - Опциональные query-параметры: `objectId`, `from`, `to` (фильтрация по дате)
    - Вызов `storage.getInvoiceCorrectionStats(filters)`
    - Возврат агрегированных данных
  - [ ] Добавить обработку ошибок и логирование
- **Зависимости**: КОРР-2, КОРР-4
- **Критерии приёмки**:
  - POST принимает массив исправлений, валидирует, сохраняет, возвращает count
  - GET возвращает агрегированную статистику по полям и паттернам
  - Ошибки обрабатываются корректно (400, 401)
  - Нет SQL-инъекций (всё через Drizzle ORM)

---

## Задача: Storage — методы работы с таблицей
- **ID**: КОРР-4
- **Статус**: Не начата
- **Приоритет**: High
- **Сложность**: Moderate
- **Описание**: Реализовать два метода в storage-слое: batch insert исправлений и агрегация статистики. Методы работают через Drizzle ORM и оптимизированы для batch-операций.
- **Файлы**:
  - `server/storage.ts` — два новых метода в объекте `storage`
- **Шаги выполнения**:
  - [ ] Импортировать таблицу `invoiceParseCorrections` из `shared/schema.ts`
  - [ ] Реализовать `saveInvoiceCorrections(data)`:
    - Принимает массив объектов `{ objectId, userId, fieldName, originalValue, correctedValue, itemIndex, invoiceNumber?, supplierName?, pdfFilename? }`
    - Выполняет `db.insert(invoiceParseCorrections).values(corrections)` одним batch insert
    - Возвращает количество вставленных строк
    - Обрабатывает пустой массив (возвращает 0)
  - [ ] Реализовать `getInvoiceCorrectionStats(filters?)`:
    - Принимает опциональные фильтры: `objectId`, `from` (date), `to` (date)
    - Возвращает:
      - `totalCorrections` — общее количество исправлений
      - `byField` — группировка по `fieldName` с подсчётом (`GROUP BY fieldName`)
      - `topPatterns` — топ-20 самых частых пар `(fieldName, originalValue, correctedValue)` (`GROUP BY ... ORDER BY count DESC LIMIT 20`)
    - Использует Drizzle ORM aggregate functions (`count`, `sql`)
  - [ ] Добавить JSDoc комментарии к методам
- **Зависимости**: КОРР-1
- **Критерии приёмки**:
  - Batch insert работает для 1–500 записей
  - Stats возвращает корректные агрегаты
  - Пустая таблица → `{ totalCorrections: 0, byField: [], topPatterns: [] }`
  - Фильтрация по objectId и датам работает

---

## Задача: Frontend — отправка diff при импорте
- **ID**: КОРР-5
- **Статус**: Не начата
- **Приоритет**: High
- **Сложность**: Moderate
- **Описание**: При нажатии "Импорт" в InvoicePreviewDialog — вычислить разницу между оригинальными данными из парсера и отредактированными пользователем данными. Отправить diff на бэкенд параллельно с bulk-create, не блокируя основной поток импорта (fire-and-forget).
- **Файлы**:
  - `client/src/hooks/use-materials.ts` — новый хук `useSubmitCorrections()`
  - `client/src/components/materials/InvoicePreviewDialog.tsx` — интеграция
- **Шаги выполнения**:
  - [ ] **Хук `useSubmitCorrections()` в `use-materials.ts`**:
    - Создать mutation-хук, вызывающий `POST /api/invoice-corrections`
    - Использует `api.invoiceCorrections.submit` из shared/routes
    - Не инвалидирует кэш (данные коррекций не отображаются в UI)
    - При ошибке — тихое логирование в console.warn, без toast
  - [ ] **Функция вычисления diff в `InvoicePreviewDialog.tsx`**:
    - Реализовать `computeCorrections(parsedItems, editedItems, selectedItems)`:
      - Для каждого выбранного item сравнить original и edited значения
      - Для каждого изменённого поля (name, unit, qty) создать запись `{ itemIndex, fieldName, originalValue, correctedValue }`
      - Игнорировать позиции, где ничего не менялось
      - Возвращать пустой массив, если нет исправлений
  - [ ] **Интеграция в `handleImport()`**:
    - После успешного `bulkCreate.mutateAsync()` (или параллельно):
      - Вычислить corrections через `computeCorrections()`
      - Если corrections.length > 0 — вызвать `submitCorrections.mutate()` fire-and-forget
      - Передать `objectId`, `invoiceNumber`, `supplierName`, `pdfFilename` из `parsedData`
    - Не блокировать переход в фазу `result` — коррекции отправляются в фоне
    - Ошибка отправки коррекций НЕ влияет на UX
  - [ ] Проверить, что `parsedData.items` и `editedItems` (Map) корректно сравниваются:
    - original = `parsedData.items[idx]` — `{ name, unit, qty }`
    - edited = `editedItems.get(idx)` или fallback к original
    - Сравнение строковое: `originalValue.trim() !== correctedValue.trim()`
- **Зависимости**: КОРР-2 (API-контракт), КОРР-3 (Backend)
- **Критерии приёмки**:
  - Если пользователь ничего не редактировал — запрос не отправляется
  - Если пользователь изменил 3 поля в 2 позициях — отправляется массив из 3 corrections
  - Импорт работает как раньше, даже если endpoint коррекций недоступен
  - Нет блокировки UI при отправке коррекций
  - console.warn при ошибке (не toast)

---

## Задача: Миграция БД
- **ID**: КОРР-6
- **Статус**: Не начата
- **Приоритет**: High
- **Сложность**: Simple
- **Описание**: Создать SQL-миграцию для новой таблицы `invoice_parse_corrections` с индексами и CHECK-constraint. Файл миграции: `migrations/0022_invoice_parse_corrections.sql`.
- **Файлы**:
  - `migrations/0022_invoice_parse_corrections.sql` — новый файл
- **Шаги выполнения**:
  - [ ] Создать файл `migrations/0022_invoice_parse_corrections.sql`
  - [ ] SQL: `CREATE TABLE invoice_parse_corrections`:
    ```sql
    CREATE TABLE IF NOT EXISTS invoice_parse_corrections (
      id SERIAL PRIMARY KEY,
      object_id INTEGER NOT NULL REFERENCES objects(id),
      user_id INTEGER NOT NULL REFERENCES users(id),
      field_name TEXT NOT NULL,
      original_value TEXT NOT NULL,
      corrected_value TEXT NOT NULL,
      item_index INTEGER NOT NULL,
      invoice_number TEXT,
      supplier_name TEXT,
      pdf_filename TEXT,
      created_at TIMESTAMP DEFAULT NOW(),
      CONSTRAINT invoice_parse_corrections_field_check
        CHECK (field_name IN ('name', 'unit', 'qty'))
    );
    ```
  - [ ] Индексы:
    ```sql
    CREATE INDEX idx_invoice_parse_corrections_object_id ON invoice_parse_corrections(object_id);
    CREATE INDEX idx_invoice_parse_corrections_user_id ON invoice_parse_corrections(user_id);
    CREATE INDEX idx_invoice_parse_corrections_field_name ON invoice_parse_corrections(field_name);
    CREATE INDEX idx_invoice_parse_corrections_created_at ON invoice_parse_corrections(created_at);
    ```
  - [ ] Проверить миграцию на пустой БД (сухой запуск)
- **Зависимости**: КОРР-1 (схема должна соответствовать миграции)
- **Критерии приёмки**:
  - Миграция применяется без ошибок
  - Таблица создаётся с правильными типами и FK
  - Индексы существуют
  - CHECK-constraint работает (INSERT с field_name='invalid' → ошибка)
  - Файл соответствует нумерации проекта (0022)

---

## Порядок реализации

| Этап | Задачи            | Параллелизм | Примерное время |
|------|--------------------|-------------|-----------------|
| 1    | КОРР-1 (Схема)     | —           | 20 мин          |
| 2    | КОРР-6 (Миграция) + КОРР-2 (API-контракт) | параллельно | 30 мин |
| 3    | КОРР-4 (Storage)   | —           | 40 мин          |
| 4    | КОРР-3 (Backend)   | —           | 40 мин          |
| 5    | КОРР-5 (Frontend)  | —           | 50 мин          |
|      | **Итого**          |             | **~3 часа**     |

## Прогресс

- ✅ КОРР-1: Схема БД — таблица invoice_parse_corrections
- ✅ КОРР-2: API-контракт — Zod-схемы и описание эндпоинтов
- ✅ КОРР-3: Backend — обработчики маршрутов
- ✅ КОРР-4: Storage — методы работы с таблицей
- ✅ КОРР-5: Frontend — отправка diff при импорте
- ✅ КОРР-6: Миграция БД

## Архитектурные решения

- **Fire-and-forget отправка**: коррекции отправляются параллельно с основным импортом и не блокируют UI. Ошибка отправки не влияет на пользовательский опыт.
- **Гранулярность записей**: одна строка = одно исправление одного поля. Это позволяет агрегировать по fieldName и находить паттерны ошибок парсера.
- **Отсутствие FK на ON DELETE CASCADE**: при удалении объекта или пользователя данные коррекций остаются (аналитическая ценность). При необходимости можно добавить CASCADE позже.
- **Без отдельного pdfFileId**: сохраняем `pdfFilename` как текст, т.к. PDF не хранятся в системе долгосрочно — они обрабатываются и удаляются.
- **Лимит 500 записей на запрос**: защита от злоупотреблений, соответствует лимиту в bulkCreate.

## Потенциальные риски

1. **Большие счета**: Счёт с 200+ позициями × 3 поля = до 600 corrections. Лимит 500 в input может потребовать корректировки, но на практике пользователь редактирует 5–15% позиций.
2. **Рост таблицы**: Без TTL/cleanup таблица будет расти. Рекомендуется в будущем добавить partitioning по `created_at` или scheduled cleanup старых записей (> 6 месяцев).
3. **Конкурентный импорт**: Если пользователь загружает несколько PDF подряд, коррекции могут отправляться параллельно — это безопасно, т.к. каждый запрос независим.
