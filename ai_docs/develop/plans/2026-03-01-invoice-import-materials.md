# Plan: Импорт материалов из счетов поставщиков (PDF)

**Created:** 2026-03-01
**Orchestration:** orch-2026-03-01-12-00-invoice-import
**Status:** ⏳ Ready to execute
**Goal:** Реализовать полный цикл импорта материалов из PDF-счетов поставщиков: загрузка файла → парсинг через invoice-extractor → предпросмотр → выборочный импорт в проектные материалы
**Total Tasks:** 10
**Estimated Time:** ~8–10 часов

---

## User Flow

1. Пользователь на странице `SourceMaterials.tsx` (`/source/materials`), вкладка «Локальные»
2. Нажимает кнопку «Добавить файл» (рядом с FAB «+»)
3. Выбирает PDF-файл через нативный file picker
4. PDF отправляется на сервер → проксируется в invoice-extractor
5. Сервер возвращает распознанные позиции
6. Появляется диалог предпросмотра с таблицей позиций (name, unit, qty, price)
7. Пользователь выбирает/снимает чекбоксы, может редактировать name и unit
8. Нажимает «Импортировать» → выбранные позиции создаются как локальные материалы
9. Дубликаты по имени автоматически пропускаются
10. Диалог показывает итог: создано X, пропущено Y дубликатов

---

## Архитектурная схема

```
┌─────────────┐     PDF upload     ┌──────────────┐  multipart/form-data  ┌──────────────────┐
│   Client     │ ─────────────────► │  Express API  │ ──────────────────► │ invoice-extractor │
│ (React SPA)  │                    │  /parse-inv.  │                     │  (Flask, port 5000)│
│              │ ◄───────────────── │              │ ◄────────────────── │                    │
│  Preview     │   parsed items[]   │              │   JSON response     │                    │
│  Dialog      │                    │              │                     │                    │
│              │   bulk-create      │  /bulk       │                     │                    │
│              │ ─────────────────► │              │                     │                    │
│  Result      │ ◄───────────────── │  storage     │                     │                    │
│  Summary     │   {created, skip}  │              │                     │                    │
└─────────────┘                    └──────────────┘                     └──────────────────────┘
```

---

## Tasks Overview

### Phase 1: Infrastructure (INV-001, INV-002)

1. **INV-001:** Fix invoice-extractor package structure & Docker setup
   - Priority: **Critical**
   - Complexity: Simple
   - Time: ~30 min
   - Dependencies: None

2. **INV-002:** Docker Compose — add invoice-extractor service
   - Priority: **Critical**
   - Complexity: Simple
   - Time: ~30 min
   - Dependencies: INV-001

### Phase 2: Backend API (INV-003, INV-004, INV-005, INV-006)

3. **INV-003:** Shared routes — Zod schemas for new endpoints
   - Priority: **High**
   - Complexity: Simple
   - Time: ~30 min
   - Dependencies: None

4. **INV-004:** Storage — bulkCreateProjectMaterials method
   - Priority: **High**
   - Complexity: Moderate
   - Time: ~1 час
   - Dependencies: INV-003

5. **INV-005:** Server routes — parse-invoice proxy endpoint
   - Priority: **High**
   - Complexity: Moderate
   - Time: ~1 час
   - Dependencies: INV-003, INV-002

6. **INV-006:** Server routes — bulk-create endpoint
   - Priority: **High**
   - Complexity: Moderate
   - Time: ~45 мин
   - Dependencies: INV-003, INV-004

### Phase 3: Frontend (INV-007, INV-008, INV-009)

7. **INV-007:** Frontend hooks — useParseInvoice & useBulkCreateMaterials
   - Priority: **High**
   - Complexity: Simple
   - Time: ~30 мин
   - Dependencies: INV-003

8. **INV-008:** Frontend — InvoicePreviewDialog component
   - Priority: **High**
   - Complexity: Complex
   - Time: ~2–3 часа
   - Dependencies: INV-007

9. **INV-009:** Frontend — InvoiceImportButton + wire into SourceMaterials
   - Priority: **High**
   - Complexity: Moderate
   - Time: ~1 час
   - Dependencies: INV-007, INV-008

### Phase 4: Finalization (INV-010)

10. **INV-010:** Documentation & testing
    - Priority: **Medium**
    - Complexity: Moderate
    - Time: ~1 час
    - Dependencies: All above

---

## Dependencies Graph

```
INV-001 ──► INV-002 ──► INV-005
                            │
INV-003 ──┬─► INV-004 ──► INV-006
          │                  │
          ├─► INV-005        │
          │                  │
          └─► INV-007 ──► INV-008 ──► INV-009
                                         │
                                    INV-010 ◄── (all)
```

Параллельно можно выполнять:
- INV-001 + INV-003 (инфраструктура + схемы)
- INV-004 + INV-005 (storage + proxy endpoint, после INV-003)
- INV-007 параллельно с INV-004–INV-006

---

## Detailed Task Descriptions

---

### INV-001: Fix invoice-extractor package structure & Docker setup

**Problem:** `run.py` импортирует из `from app.extractor import ...`, `from app.llm_client import ...`, `from app.normalizer import ...`, но файлы `extractor.py`, `llm_client.py`, `normalizer.py`, `validators.py`, `excel_builder.py` лежат в корне, а не в пакете `app/`.

**Solution:**
- Переместить сервис из `testFiles/files_invoice-extractor/` → `services/invoice-extractor/`
- Создать пакет `app/`:
  - `services/invoice-extractor/app/__init__.py` (пустой)
  - Переместить `extractor.py`, `llm_client.py`, `normalizer.py`, `validators.py`, `excel_builder.py` в `app/`
- `run.py`, `gunicorn.conf.py`, `Dockerfile`, `requirements.txt`, `.env.example` остаются в корне сервиса
- Обновить `Dockerfile` WORKDIR при необходимости

**Files:**
- Create: `services/invoice-extractor/` (вся структура)
  - `services/invoice-extractor/app/__init__.py`
  - `services/invoice-extractor/app/extractor.py`
  - `services/invoice-extractor/app/llm_client.py`
  - `services/invoice-extractor/app/normalizer.py`
  - `services/invoice-extractor/app/validators.py`
  - `services/invoice-extractor/app/excel_builder.py`
  - `services/invoice-extractor/run.py`
  - `services/invoice-extractor/Dockerfile`
  - `services/invoice-extractor/requirements.txt`
  - `services/invoice-extractor/gunicorn.conf.py`
  - `services/invoice-extractor/.env.example`
- Можно оставить `testFiles/files_invoice-extractor/` как есть (старая копия) или удалить

**Acceptance Criteria:**
- `docker build` проходит без ошибок
- `gunicorn -c gunicorn.conf.py run:app` стартует
- Импорты `from app.extractor import ...` работают корректно

---

### INV-002: Docker Compose — add invoice-extractor service

**Problem:** В проекте нет `docker-compose.yml`. Invoice-extractor должен запускаться как отдельный сервис.

**Solution:**
Создать `docker-compose.yml` (или дополнить, если появится) с сервисом:

```yaml
services:
  invoice-extractor:
    build:
      context: ./services/invoice-extractor
      dockerfile: Dockerfile
    ports:
      - "5050:5000"           # внешний 5050, внутри 5000
    environment:
      - LLM_PROVIDER=${LLM_PROVIDER:-anthropic}
      - ANTHROPIC_API_KEY=${ANTHROPIC_API_KEY}
      - OPENAI_API_KEY=${OPENAI_API_KEY:-}
      - OPENROUTER_API_KEY=${OPENROUTER_API_KEY:-}
      - MAX_FILE_SIZE_MB=50
      - MAX_PAGES=30
      - REQUEST_TIMEOUT_SEC=120
    restart: unless-stopped
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:5000/health"]
      interval: 30s
      timeout: 10s
      retries: 3
```

Добавить в `.env` (или `.env.example` проекта) переменную:
```
INVOICE_EXTRACTOR_URL=http://localhost:5050
```

Для production / Docker-сети:
```
INVOICE_EXTRACTOR_URL=http://invoice-extractor:5000
```

**Files:**
- Create/Modify: `docker-compose.yml`
- Modify: `.env.example` (добавить `INVOICE_EXTRACTOR_URL`)

**Acceptance Criteria:**
- `docker compose up invoice-extractor` успешно стартует
- `curl http://localhost:5050/health` возвращает `{"status": "ok"}`

---

### INV-003: Shared routes — Zod schemas for new endpoints

**Description:** Добавить в `shared/routes.ts` два новых эндпоинта в секцию `projectMaterials`.

**Новые эндпоинты:**

#### 1. `parseInvoice`
```typescript
parseInvoice: {
  method: "POST" as const,
  path: "/api/objects/:objectId/materials/parse-invoice",
  input: z.object({}),  // тело пустое, файл приходит через multipart
  responses: {
    200: z.object({
      items: z.array(z.object({
        name: z.string(),
        unit: z.string(),
        qty: z.number().or(z.string()),
        price: z.number().or(z.string()),
        amount_w_vat: z.number().or(z.string()).optional(),
        vat_rate: z.string().optional(),
      })),
      invoice_number: z.string().optional(),
      invoice_date: z.string().optional(),
      supplier: z.object({
        name: z.string(),
      }).passthrough().optional(),
      warnings: z.array(z.string()).optional(),
    }),
    400: z.object({ message: z.string() }),
    500: z.object({ message: z.string() }),
  },
},
```

#### 2. `bulkCreate`
```typescript
bulkCreate: {
  method: "POST" as const,
  path: "/api/objects/:objectId/materials/bulk",
  input: z.object({
    items: z.array(z.object({
      nameOverride: z.string().trim().min(1),
      baseUnitOverride: z.string().trim().optional(),
    })).min(1).max(500),
  }),
  responses: {
    200: z.object({
      created: z.number().int().nonnegative(),
      skipped: z.number().int().nonnegative(),
      materials: z.array(z.custom<typeof projectMaterials.$inferSelect>()),
    }),
    400: z.object({ message: z.string() }),
  },
},
```

**Files:**
- Modify: `shared/routes.ts` — добавить `parseInvoice` и `bulkCreate` в `api.projectMaterials`

**Acceptance Criteria:**
- TypeScript компилируется без ошибок
- Схемы корректно валидируют тестовые данные

---

### INV-004: Storage — bulkCreateProjectMaterials method

**Description:** Добавить метод `bulkCreateProjectMaterials` в `IStorage` и `DatabaseStorage`.

**Логика:**
1. Принимает `objectId` и массив `{ nameOverride, baseUnitOverride }`
2. Получает все существующие материалы объекта: `SELECT * FROM project_materials WHERE object_id = $objectId AND deleted_at IS NULL`
3. Строит Set из существующих `nameOverride` (в нижнем регистре, trim)
4. Фильтрует входящие items — пропускает те, чьё имя уже есть (case-insensitive)
5. Создает оставшиеся через `INSERT INTO project_materials ... RETURNING *`
6. Возвращает `{ created: number, skipped: number, materials: ProjectMaterial[] }`

**Edge Cases:**
- Пустой массив → `{ created: 0, skipped: 0, materials: [] }`
- Все дубликаты → `{ created: 0, skipped: N, materials: [] }`
- Дубликаты внутри самого массива (два одинаковых имени) → оставить только первый

**Files:**
- Modify: `server/storage.ts` — добавить интерфейс + реализацию `bulkCreateProjectMaterials`

**Implementation:**

```typescript
// В интерфейсе IStorage:
bulkCreateProjectMaterials(
  objectId: number,
  items: Array<{ nameOverride: string; baseUnitOverride?: string }>
): Promise<{ created: number; skipped: number; materials: ProjectMaterial[] }>;

// В классе DatabaseStorage:
async bulkCreateProjectMaterials(
  objectId: number,
  items: Array<{ nameOverride: string; baseUnitOverride?: string }>
): Promise<{ created: number; skipped: number; materials: ProjectMaterial[] }> {
  if (items.length === 0) return { created: 0, skipped: 0, materials: [] };

  // Существующие имена (нижний регистр)
  const existing = await db
    .select({ nameOverride: projectMaterials.nameOverride })
    .from(projectMaterials)
    .where(
      and(
        eq(projectMaterials.objectId, objectId),
        isNull(projectMaterials.deletedAt)
      )
    );
  const existingNames = new Set(
    existing
      .map(e => e.nameOverride?.trim().toLowerCase())
      .filter(Boolean)
  );

  // Дедупликация внутри массива + фильтрация дубликатов
  const seen = new Set<string>();
  const toCreate: typeof items = [];
  let skipped = 0;

  for (const item of items) {
    const key = item.nameOverride.trim().toLowerCase();
    if (existingNames.has(key) || seen.has(key)) {
      skipped++;
      continue;
    }
    seen.add(key);
    toCreate.push(item);
  }

  if (toCreate.length === 0) return { created: 0, skipped, materials: [] };

  const created = await db
    .insert(projectMaterials)
    .values(toCreate.map(item => ({
      objectId,
      nameOverride: item.nameOverride.trim(),
      baseUnitOverride: item.baseUnitOverride?.trim() || null,
      paramsOverride: {},
    })))
    .returning();

  return { created: created.length, skipped, materials: created };
}
```

**Acceptance Criteria:**
- Дубликаты по имени (case-insensitive) пропускаются
- Дубликаты внутри входного массива дедуплицируются
- Soft-deleted материалы не учитываются как дубликаты
- Возвращает точные счётчики created/skipped

---

### INV-005: Server routes — parse-invoice proxy endpoint

**Description:** Реализовать `POST /api/objects/:objectId/materials/parse-invoice` — принимает PDF как multipart/form-data, проксирует в invoice-extractor, возвращает распознанные позиции.

**Зависимости NPM:**
- `multer` — для приёма multipart/form-data (возможно, уже есть? проверить)
- `form-data` или `undici` (или встроенный `fetch` Node 18+) — для отправки в invoice-extractor

**Логика:**

1. `multer` middleware принимает PDF (max 50 MB, only `.pdf`)
2. Валидация: objectId, наличие файла, расширение
3. Создаёт `FormData`, прикладывает PDF-буфер как `file`
4. Добавляет `output=json` в form data
5. `POST` на `${INVOICE_EXTRACTOR_URL}/convert`
6. Парсит JSON-ответ, извлекает `items[]`
7. Возвращает клиенту структуру согласно Zod-схеме из INV-003
8. Очищает временный файл

**Error Handling:**
- invoice-extractor не доступен → 502 с понятным сообщением
- PDF не распознан (пустой items) → 200 с пустым массивом + warnings
- Таймаут → 504

**Environment:**
- `INVOICE_EXTRACTOR_URL` — URL сервиса (default: `http://localhost:5050`)

**Files:**
- Modify: `server/routes.ts` — новый роут
- Possibly modify: `package.json` — добавить `multer`, `@types/multer`, `form-data`

**Implementation (pseudocode):**

```typescript
import multer from 'multer';
const upload = multer({ 
  storage: multer.memoryStorage(), 
  limits: { fileSize: 50 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (file.mimetype !== 'application/pdf') cb(new Error('Only PDF'));
    else cb(null, true);
  }
});

app.post(
  api.projectMaterials.parseInvoice.path,
  upload.single('file'),
  async (req, res) => {
    const objectId = Number(req.params.objectId);
    if (!req.file) return res.status(400).json({ message: "PDF file required" });

    const extractorUrl = process.env.INVOICE_EXTRACTOR_URL || 'http://localhost:5050';
    
    const formData = new FormData();
    formData.append('file', new Blob([req.file.buffer]), req.file.originalname);
    formData.append('output', 'json');

    const response = await fetch(`${extractorUrl}/convert`, {
      method: 'POST',
      body: formData,
    });

    if (!response.ok) {
      return res.status(502).json({ message: "Invoice extractor error" });
    }

    const data = await response.json();
    return res.status(200).json({
      items: (data.items || []).map(item => ({
        name: item.name || '',
        unit: item.unit || '',
        qty: item.qty ?? '',
        price: item.price ?? '',
        amount_w_vat: item.amount_w_vat ?? '',
        vat_rate: item.vat_rate ?? '',
      })),
      invoice_number: data.invoice_number,
      invoice_date: data.invoice_date,
      supplier: data.supplier ? { name: data.supplier.name } : undefined,
      warnings: data.warnings,
    });
  }
);
```

**Acceptance Criteria:**
- PDF-файл корректно проксируется в invoice-extractor
- Ответ соответствует Zod-схеме
- Ошибки extractor'а корректно проксируются (502/504)
- Нет утечки файлов (memory storage, без записи на диск)

---

### INV-006: Server routes — bulk-create endpoint

**Description:** Реализовать `POST /api/objects/:objectId/materials/bulk`.

**Логика:**
1. Валидация `objectId` и `req.body` через Zod-схему из INV-003
2. Вызов `storage.bulkCreateProjectMaterials(objectId, items)`
3. Возвращение результата `{ created, skipped, materials }`

**Files:**
- Modify: `server/routes.ts` — новый роут (10–20 строк)

**Implementation:**

```typescript
app.post(api.projectMaterials.bulkCreate.path, async (req, res) => {
  const objectId = Number(req.params.objectId);
  if (!Number.isFinite(objectId) || objectId <= 0) {
    return res.status(400).json({ message: "Invalid objectId" });
  }
  try {
    const { items } = api.projectMaterials.bulkCreate.input.parse(req.body);
    const result = await storage.bulkCreateProjectMaterials(objectId, items);
    return res.status(200).json(result);
  } catch (err) {
    if (err instanceof z.ZodError) {
      return res.status(400).json({ message: err.errors[0].message });
    }
    console.error("Bulk create materials failed:", err);
    return res.status(500).json({ message: "Internal Server Error" });
  }
});
```

**Acceptance Criteria:**
- Корректная валидация входных данных
- Дубликаты пропускаются (логика в storage)
- Возвращает `{ created, skipped, materials }`
- Обрабатывает ошибки (400, 500)

---

### INV-007: Frontend hooks — useParseInvoice & useBulkCreateMaterials

**Description:** Добавить React Query mutations для двух новых эндпоинтов.

**Files:**
- Modify: `client/src/hooks/use-materials.ts`

**Implementation:**

```typescript
export function useParseInvoice(objectId: number) {
  return useMutation({
    mutationFn: async (file: File) => {
      const url = buildUrl(api.projectMaterials.parseInvoice.path, { objectId });
      const formData = new FormData();
      formData.append('file', file);
      const res = await fetch(url, {
        method: 'POST',
        body: formData,
        credentials: 'include',
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.message || 'Failed to parse invoice');
      }
      return api.projectMaterials.parseInvoice.responses[200].parse(await res.json());
    },
  });
}

export function useBulkCreateMaterials(objectId: number) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (items: Array<{ nameOverride: string; baseUnitOverride?: string }>) => {
      const url = buildUrl(api.projectMaterials.bulkCreate.path, { objectId });
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ items }),
        credentials: 'include',
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.message || 'Failed to bulk create materials');
      }
      return api.projectMaterials.bulkCreate.responses[200].parse(await res.json());
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [api.projectMaterials.list.path, objectId] });
    },
  });
}
```

**Acceptance Criteria:**
- `useParseInvoice` отправляет PDF как FormData и парсит ответ
- `useBulkCreateMaterials` отправляет JSON и инвалидирует кеш списка
- Типы совпадают с Zod-схемами

---

### INV-008: Frontend — InvoicePreviewDialog component

**Description:** Модальный диалог предпросмотра распознанных позиций. Основной UI-компонент фичи.

**UI Design:**

```
┌─────────────────────────────────────────────────┐
│  Импорт из счёта                            [X] │
│  Счёт №123 от 2026-01-15 | Поставщик ООО "..."  │
│─────────────────────────────────────────────────│
│  [✓] Выделить все (12 позиций)                  │
│─────────────────────────────────────────────────│
│  [✓] 1. Кирпич керамический М-150    | шт       │
│       Кол-во: 5000  Цена: 12.50                 │
│  [✓] 2. Цемент М-500                 | т        │
│       Кол-во: 10    Цена: 4500.00               │
│  [ ] 3. Песок строительный            | м³       │
│       Кол-во: 25    Цена: 800.00                │
│  ...                                            │
│─────────────────────────────────────────────────│
│  ⚠ 2 предупреждения                             │
│─────────────────────────────────────────────────│
│           [Отмена]   [Импортировать (10)]        │
└─────────────────────────────────────────────────┘
```

**После импорта (result summary):**

```
┌─────────────────────────────────────────────────┐
│  Результат импорта                          [X] │
│─────────────────────────────────────────────────│
│  ✅ Создано: 8 материалов                       │
│  ⏭ Пропущено: 2 дубликата                      │
│─────────────────────────────────────────────────│
│                              [Закрыть]           │
└─────────────────────────────────────────────────┘
```

**Компоненты (shadcn/ui):**
- `Dialog`, `DialogContent`, `DialogHeader`, `DialogTitle`, `DialogFooter`
- `Checkbox` — для выбора/снятия позиций
- `Input` (inline) — для редактирования name/unit в строке
- `ScrollArea` — для прокрутки длинного списка
- `Button` — Отмена / Импортировать
- `Badge` — для предупреждений
- Framer Motion — для анимации появления/пропадания

**State Management:**
- `selectedItems: Set<number>` (индексы выбранных)
- `editedItems: Map<number, { name: string; unit: string }>` (отредактированные значения)
- `phase: 'preview' | 'importing' | 'result'`

**Props:**
```typescript
interface InvoicePreviewDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  objectId: number;
  parsedData: ParsedInvoiceData; // тип из Zod-схемы
}
```

**Поведение:**
- По умолчанию все позиции выбраны
- Checkbox «Выделить все» — toggle all
- Inline-редактирование name/unit по клику на текст (или карандаш-иконка)
- Кнопка «Импортировать» disabled, пока нет выбранных
- При импорте: spinning loader, кнопки disabled
- После импорта: показ result summary

**Files:**
- Create: `client/src/components/materials/InvoicePreviewDialog.tsx`

**Acceptance Criteria:**
- Таблица позиций с чекбоксами
- Inline-редактирование name и unit
- Select all / deselect all
- Loading state при импорте
- Result summary с created/skipped
- i18n (ru/en) для всех строк
- Responsive (мобильный вид)

---

### INV-009: Frontend — InvoiceImportButton + wire into SourceMaterials

**Description:** Кнопка «Добавить файл» и скрытый `<input type="file">`, видимые только на вкладке «Локальные». Интеграция в `SourceMaterials.tsx`.

**Поведение:**
- Кнопка видна **только** когда `filter === "local"`
- Расположение: рядом с FAB «+» (чуть левее или выше), либо в шапке секции
- По клику открывает file picker (accept=".pdf")
- При выборе файла:
  1. Вызывает `parseInvoice.mutate(file)`
  2. Показывает loading toast или спиннер на кнопке
  3. По успешному парсингу — открывает `InvoicePreviewDialog`
  4. При ошибке — показывает toast с ошибкой

**Вариант размещения кнопки (рекомендуемый):**
- В FAB-зоне: второй FAB-кнопкой рядом с существующей «+»
- На вкладке «Локальные» — левее основной FAB, с иконкой `FileUp`

**Files:**
- Create: `client/src/components/materials/InvoiceImportButton.tsx`
- Modify: `client/src/pages/SourceMaterials.tsx`

**Изменения в SourceMaterials.tsx:**
1. Импортировать `InvoiceImportButton` и `InvoicePreviewDialog`
2. Добавить state: `parsedInvoice`, `previewDialogOpen`
3. Рендер `InvoiceImportButton` в FAB-зоне (условно `filter === "local"`)
4. Рендер `InvoicePreviewDialog` с `parsedInvoice` данными

**Implementation (InvoiceImportButton):**

```tsx
interface InvoiceImportButtonProps {
  objectId: number;
  onParsed: (data: ParsedInvoiceData) => void;
}

export function InvoiceImportButton({ objectId, onParsed }: InvoiceImportButtonProps) {
  const fileRef = useRef<HTMLInputElement>(null);
  const parseInvoice = useParseInvoice(objectId);
  const { toast } = useToast();

  const handleFileChange = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = '';  // reset for re-upload
    
    parseInvoice.mutate(file, {
      onSuccess: (data) => onParsed(data),
      onError: (err) => toast({ title: "Ошибка", description: err.message, variant: "destructive" }),
    });
  };

  return (
    <>
      <input ref={fileRef} type="file" accept=".pdf" hidden onChange={handleFileChange} />
      <Button
        size="icon"
        variant="secondary"
        className="h-14 w-14 rounded-full shadow-xl"
        disabled={parseInvoice.isPending}
        onClick={() => fileRef.current?.click()}
      >
        {parseInvoice.isPending ? <Loader2 className="animate-spin" /> : <FileUp />}
      </Button>
    </>
  );
}
```

**Acceptance Criteria:**
- Кнопка видна только на вкладке «Локальные»
- File picker принимает только `.pdf`
- Loading indicator при парсинге
- Диалог открывается при успешном парсинге
- Toast при ошибке
- Работает на мобильных

---

### INV-010: Documentation & testing

**Description:** Обновить документацию и провести ручное тестирование.

**Files:**
- Modify: `docs/project.md` — добавить описание invoice-extractor сервиса и новых API
- Modify: `docs/changelog.md` — запись об импорте материалов из PDF
- Modify: `docs/tasktracker.md` — задача со всеми шагами
- Возможно: обновить `docs/materials-import-guide.md` (если он описывает эту фичу)

**Тестирование:**
1. Docker: `docker compose up invoice-extractor` — проверить health
2. Загрузить тестовый PDF → проверить парсинг через curl
3. Frontend: загрузить PDF → предпросмотр → выборочный импорт
4. Проверить дубликаты: повторный импорт того же файла → все пропущены
5. Проверить edge cases: пустой PDF, большой файл, не-PDF

**Acceptance Criteria:**
- Документация актуальна
- Changelog обновлён
- Все user flow проходят корректно

---

## Progress (updated by orchestrator)

- ⏳ INV-001: Fix invoice-extractor package structure & Docker setup (Pending)
- ⏳ INV-002: Docker Compose — add invoice-extractor service (Pending)
- ⏳ INV-003: Shared routes — Zod schemas for parse-invoice & bulk-create (Pending)
- ⏳ INV-004: Storage — bulkCreateProjectMaterials method (Pending)
- ⏳ INV-005: Server routes — parse-invoice proxy endpoint (Pending)
- ⏳ INV-006: Server routes — bulk-create endpoint (Pending)
- ⏳ INV-007: Frontend hooks — useParseInvoice & useBulkCreateMaterials (Pending)
- ⏳ INV-008: Frontend — InvoicePreviewDialog component (Pending)
- ⏳ INV-009: Frontend — InvoiceImportButton + wire into SourceMaterials (Pending)
- ⏳ INV-010: Documentation & testing (Pending)

---

## Architecture Decisions

1. **Proxy через Express, а не прямой вызов с клиента** — безопасность (API-ключи LLM на сервере), CORS, возможность кэширования и логирования
2. **Bulk create с skip дубликатов** — вместо upsert, чтобы не перезаписывать существующие материалы
3. **Case-insensitive duplicate check** — «Кирпич» и «кирпич» считаются одним материалом
4. **Memory storage для multer** — не записываем PDF на диск сервера, сразу проксируем буфер
5. **Только name + unit при импорте** — qty, price и остальные поля только для предпросмотра, не сохраняются в project_materials (по бизнес-требованию)
6. **Сервис в `services/`** — выделенная папка для микросервисов, отделяет от основного монолита

## Security Considerations

- PDF-файлы не сохраняются на диске сервера
- Размер файла ограничен (50 MB)
- Валидация MIME type (только `application/pdf`)
- API-ключи LLM передаются только через env variables сервиса, не попадают на клиент
- objectId валидируется на каждом эндпоинте

## Implementation Notes

- Для `fetch` к invoice-extractor на Node 18+ можно использовать встроенный `fetch` + `Blob`/`FormData`
- Если нужна совместимость с Node 16 — использовать `node-fetch` + `form-data` package
- В Dockerfile invoice-extractor WORKDIR уже `/app`, что совпадает с `from app.` импортами
- `multer` с `memoryStorage()` хранит файл в RAM — для PDF до 50 MB это приемлемо
