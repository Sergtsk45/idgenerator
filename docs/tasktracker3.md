# Tasktracker: Расширение импорта счетов — количество и партии

**Created:** 2026-03-06  
**Orchestration:** orch-2026-03-06-invoice-batch  
**Status:** ✅ Завершено  
**Цель:** При импорте PDF-счёта показывать количество, автоматически создавать material_batches с qty/supplier/date  
**Всего задач:** 5  

## Общее описание

Сейчас импорт из PDF-счёта создаёт только записи `project_materials` (name + unit). Количество (qty), поставщик (supplier_name) и дата счёта (invoice_date) — извлекаются микросервисом, но отбрасываются на этапе маппинга в backend-роуте.

**Требуется:**
1. Пробросить `qty` в каждый item ответа `parseInvoice`
2. Показать qty в UI-диалоге (read-only)
3. Расширить `bulkCreate` input — принимать batch-данные (qty, unit, supplierName, deliveryDate)
4. В `bulkCreateProjectMaterials` после создания material автоматически создавать `material_batch`
5. Дедупликация: если material уже существует — он skipped, партия для него НЕ создаётся

## Граф зависимостей

```
INV-001 (API контракт)
  ├── INV-002 (Backend storage)
  ├── INV-003 (Backend routes)
  └── INV-004 (Frontend hooks)
        └── INV-005 (Frontend UI)
```

INV-002 и INV-003 можно выполнять параллельно после INV-001.

---

## Задача 1: INV-001 — API-контракт: расширить parseInvoice response и bulkCreate input

- **Статус**: ✅ Завершена
- **Приоритет**: High (критический путь)
- **Файлы**: `shared/routes.ts`
- **Описание**: Расширить Zod-схемы: (a) добавить `qty` в items ответа parseInvoice; (b) добавить batch-поля в bulkCreate input и response.

### Подзадачи
- [x] 1.1 Добавить поле `qty` в `parseInvoice.responses[200].items`
- [x] 1.2 Расширить `bulkCreate.input.items` — добавить `qty`, `supplierName`, `deliveryDate`
- [x] 1.3 Добавить `batchesCreated` в `bulkCreate.responses[200]`

### Что изменить

**Файл: `shared/routes.ts`**

**1.1 — parseInvoice response (строки ~430–433)**

Было:
```typescript
items: z.array(z.object({
  name: z.string(),
  unit: z.string().optional().default(""),
})),
```

Стало:
```typescript
items: z.array(z.object({
  name: z.string(),
  unit: z.string().optional().default(""),
  qty: z.string().optional(),
})),
```

> `qty` — строка (numeric string), optional, потому что не все позиции счёта содержат количество.

**1.2 — bulkCreate input (строки ~447–449)**

Было:
```typescript
items: z.array(z.object({
  nameOverride: z.string().trim().min(1),
  baseUnitOverride: z.string().trim().optional(),
})).min(1).max(500),
```

Стало:
```typescript
items: z.array(z.object({
  nameOverride: z.string().trim().min(1),
  baseUnitOverride: z.string().trim().optional(),
  qty: z.string().optional(),
})).min(1).max(500),
supplierName: z.string().optional(),
deliveryDate: z.string().optional(),
```

> `supplierName` и `deliveryDate` — общие для всего счёта, поэтому выносятся на уровень запроса, а не в каждый item.

**1.3 — bulkCreate response (строки ~453–456)**

Было:
```typescript
200: z.object({
  created: z.number().int().nonnegative(),
  skipped: z.number().int().nonnegative(),
  materials: z.array(z.custom<typeof projectMaterials.$inferSelect>()),
}),
```

Стало:
```typescript
200: z.object({
  created: z.number().int().nonnegative(),
  skipped: z.number().int().nonnegative(),
  batchesCreated: z.number().int().nonnegative(),
  materials: z.array(z.custom<typeof projectMaterials.$inferSelect>()),
}),
```

- **Зависимости**: Нет (первая задача в цепочке)

---

## Задача 2: INV-002 — Backend storage: bulkCreateProjectMaterials с созданием партий

- **Статус**: ✅ Завершена
- **Приоритет**: High
- **Файлы**: `server/storage.ts`
- **Описание**: Расширить метод `bulkCreateProjectMaterials` — принимать batch-данные, после создания материала создавать `material_batch`.

### Подзадачи
- [x] 2.1 Изменить сигнатуру метода в интерфейсе `IStorage`
- [x] 2.2 Расширить реализацию: после insert в `project_materials` создать записи в `material_batches`
- [x] 2.3 Вернуть `batchesCreated` в ответе

### Что изменить

**Файл: `server/storage.ts`**

**2.1 — Интерфейс IStorage (строки ~155–158)**

Было:
```typescript
bulkCreateProjectMaterials(
  objectId: number,
  items: Array<{ nameOverride: string; baseUnitOverride?: string }>
): Promise<{ created: number; skipped: number; materials: ProjectMaterial[] }>;
```

Стало:
```typescript
bulkCreateProjectMaterials(
  objectId: number,
  items: Array<{ nameOverride: string; baseUnitOverride?: string; qty?: string }>,
  batchMeta?: { supplierName?: string; deliveryDate?: string }
): Promise<{ created: number; skipped: number; batchesCreated: number; materials: ProjectMaterial[] }>;
```

**2.2 — Реализация (строки ~839–890)**

Было:
```typescript
async bulkCreateProjectMaterials(
  objectId: number,
  items: Array<{ nameOverride: string; baseUnitOverride?: string }>
): Promise<{ created: number; skipped: number; materials: ProjectMaterial[] }> {
  // ... дедупликация ...
  const created = await db
    .insert(projectMaterials)
    .values(toCreate.map(...))
    .returning();
  return { created: created.length, skipped, materials: created };
}
```

Стало (псевдокод логики):
```typescript
async bulkCreateProjectMaterials(
  objectId: number,
  items: Array<{ nameOverride: string; baseUnitOverride?: string; qty?: string }>,
  batchMeta?: { supplierName?: string; deliveryDate?: string }
): Promise<{ created: number; skipped: number; batchesCreated: number; materials: ProjectMaterial[] }> {
  // ... существующая дедупликация (без изменений) ...

  // Сохранить маппинг index → qty для последующего создания партий
  const qtyByIndex = new Map<number, string>();
  let createIdx = 0;
  for (const item of items) {
    const key = item.nameOverride.trim().toLowerCase();
    if (!existingNames.has(key) && !seen.has(key)) {
      if (item.qty) {
        qtyByIndex.set(createIdx, item.qty);
      }
      createIdx++;
      seen.add(key);
      toCreate.push({ ... });
    } else {
      skipped++;
    }
  }

  // ... insert project_materials (без изменений) ...

  // Создание партий для материалов, у которых есть qty
  let batchesCreated = 0;
  const batchValues = created
    .map((mat, idx) => {
      const qty = qtyByIndex.get(idx);
      if (!qty) return null;
      return {
        objectId,
        projectMaterialId: mat.id,
        quantity: qty,
        unit: mat.baseUnitOverride || null,
        supplierName: batchMeta?.supplierName || null,
        deliveryDate: batchMeta?.deliveryDate || null,
      };
    })
    .filter(Boolean);

  if (batchValues.length > 0) {
    await db.insert(materialBatches).values(batchValues as any);
    batchesCreated = batchValues.length;
  }

  return { created: created.length, skipped, batchesCreated, materials: created };
}
```

**Ключевые моменты:**
- Партия создаётся ТОЛЬКО для вновь созданных материалов (skipped → без партии)
- Партия создаётся ТОЛЬКО если есть `qty` у позиции
- `supplierName` и `deliveryDate` берутся из общих мета-данных счёта
- `unit` для партии берётся из `baseUnitOverride` созданного материала

- **Зависимости**: INV-001

---

## Задача 3: INV-003 — Backend routes: пробросить qty из микросервиса

- **Статус**: ✅ Завершена
- **Приоритет**: High
- **Файлы**: `server/routes.ts`
- **Описание**: В route-handler `parseInvoice` — добавить `qty` в маппинг items. В route-handler `bulkCreate` — передать `supplierName` и `deliveryDate` в storage.

### Подзадачи
- [x] 3.1 Добавить `qty` в маппинг ответа parseInvoice
- [x] 3.2 Передать `supplierName` и `deliveryDate` из body в `bulkCreateProjectMaterials`

### Что изменить

**Файл: `server/routes.ts`**

**3.1 — parseInvoice маппинг (строки ~424–432)**

Было:
```typescript
return res.status(200).json({
  items: (data.items || []).map((item: any) => ({
    name: String(item.name || item.description || '').trim(),
    unit: String(item.unit || '').trim(),
  })).filter((item: any) => item.name.length > 0),
  invoice_number: data.invoice_number || undefined,
  invoice_date: data.invoice_date || undefined,
  supplier_name: data.supplier?.name || undefined,
});
```

Стало:
```typescript
return res.status(200).json({
  items: (data.items || []).map((item: any) => ({
    name: String(item.name || item.description || '').trim(),
    unit: String(item.unit || '').trim(),
    qty: item.qty != null ? String(item.qty).trim() : undefined,
  })).filter((item: any) => item.name.length > 0),
  invoice_number: data.invoice_number || undefined,
  invoice_date: data.invoice_date || undefined,
  supplier_name: data.supplier?.name || undefined,
});
```

> Единственное изменение — добавлена строка `qty`. Если микросервис не вернул qty — поле будет undefined.

**3.2 — bulkCreate route (строки ~448–456)**

Было:
```typescript
const { items } = api.projectMaterials.bulkCreate.input.parse(req.body);
const result = await storage.bulkCreateProjectMaterials(objectId, items);
```

Стало:
```typescript
const { items, supplierName, deliveryDate } = api.projectMaterials.bulkCreate.input.parse(req.body);
const result = await storage.bulkCreateProjectMaterials(objectId, items, { supplierName, deliveryDate });
```

- **Зависимости**: INV-001

---

## Задача 4: INV-004 — Frontend hooks: обновить useBulkCreateMaterials

- **Статус**: ✅ Завершена
- **Приоритет**: Medium
- **Файлы**: `client/src/hooks/use-materials.ts`
- **Описание**: Расширить тип входных данных хука `useBulkCreateMaterials` — добавить `qty`, `supplierName`, `deliveryDate`.

### Подзадачи
- [x] 4.1 Изменить тип аргумента `mutationFn` — передавать объект `{ items, supplierName?, deliveryDate? }`
- [x] 4.2 Обновить тело запроса

### Что изменить

**Файл: `client/src/hooks/use-materials.ts`**

**Строки ~222–243**

Было:
```typescript
export function useBulkCreateMaterials(objectId: number) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (items: Array<{ nameOverride: string; baseUnitOverride?: string }>) => {
      const url = buildUrl(api.projectMaterials.bulkCreate.path, { objectId });
      const res = await fetch(url, {
        method: api.projectMaterials.bulkCreate.method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ items }),
        credentials: "include",
      });
      // ...
    },
    // ...
  });
}
```

Стало:
```typescript
interface BulkCreateInput {
  items: Array<{ nameOverride: string; baseUnitOverride?: string; qty?: string }>;
  supplierName?: string;
  deliveryDate?: string;
}

export function useBulkCreateMaterials(objectId: number) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: BulkCreateInput) => {
      const url = buildUrl(api.projectMaterials.bulkCreate.path, { objectId });
      const res = await fetch(url, {
        method: api.projectMaterials.bulkCreate.method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(input),
        credentials: "include",
      });
      // ... (обработка ошибок без изменений)
    },
    // ...
  });
}
```

- **Зависимости**: INV-001

---

## Задача 5: INV-005 — Frontend UI: показать qty, передать batch-данные при импорте

- **Статус**: ✅ Завершена
- **Приоритет**: Medium
- **Файлы**: `client/src/components/materials/InvoicePreviewDialog.tsx`
- **Описание**: Показать qty (read-only) в каждой позиции диалога. При импорте передать qty/supplierName/deliveryDate в bulkCreate.

### Подзадачи
- [x] 5.1 Отобразить qty рядом с unit (read-only badge/text)
- [x] 5.2 Передать qty в каждый item, supplierName и deliveryDate из parsedData в handleImport
- [x] 5.3 Обновить экран результата — показать `batchesCreated`

### Что изменить

**Файл: `client/src/components/materials/InvoicePreviewDialog.tsx`**

**5.1 — Показать qty (после блока с Unit, строки ~241–249)**

Добавить после блока `<div className="flex items-center gap-1">` (Unit):

```tsx
{items[idx].qty && (
  <div className="flex items-center gap-1">
    <span>{language === "ru" ? "Кол-во" : "Qty"}:</span>
    <span className="font-medium">{items[idx].qty}</span>
  </div>
)}
```

**5.2 — handleImport (строки ~103–130)**

Было:
```typescript
const itemsToCreate = Array.from(selectedItems)
  .map((idx) => {
    const data = getItemData(idx);
    return {
      nameOverride: data.name.trim(),
      baseUnitOverride: data.unit.trim() || undefined,
    };
  })
  .filter((item) => item.nameOverride.length > 0);

try {
  const res = await bulkCreate.mutateAsync(itemsToCreate);
  // ...
```

Стало:
```typescript
const itemsToCreate = Array.from(selectedItems)
  .map((idx) => {
    const data = getItemData(idx);
    return {
      nameOverride: data.name.trim(),
      baseUnitOverride: data.unit.trim() || undefined,
      qty: items[idx].qty || undefined,
    };
  })
  .filter((item) => item.nameOverride.length > 0);

try {
  const res = await bulkCreate.mutateAsync({
    items: itemsToCreate,
    supplierName: parsedData?.supplier_name,
    deliveryDate: parsedData?.invoice_date,
  });
  // ...
```

**5.3 — Экран результата (строки ~282–309)**

Обновить state и отображение:

```typescript
// Изменить тип result state:
const [result, setResult] = useState<{ created: number; skipped: number; batchesCreated: number } | null>(null);

// В handleImport:
setResult({ created: res.created, skipped: res.skipped, batchesCreated: res.batchesCreated });

// В JSX результата добавить Badge:
{result.batchesCreated > 0 && (
  <Badge variant="outline">
    {language === "ru" ? "Партий создано" : "Batches created"}: {result.batchesCreated}
  </Badge>
)}
```

- **Зависимости**: INV-004

---

## Критерии приёмки (Definition of Done)

1. При загрузке PDF-счёта в диалоге предпросмотра отображается количество (qty) рядом с каждой позицией
2. Qty отображается как read-only текст (без возможности редактирования)
3. При нажатии «Импортировать» создаются `project_materials` И `material_batches`
4. Каждая созданная партия содержит: quantity, unit, supplierName, deliveryDate
5. Дубликаты материалов пропускаются, партии для них НЕ создаются
6. Если qty отсутствует у позиции — партия для неё НЕ создаётся
7. Экран результата показывает количество созданных партий
8. Все Zod-схемы типобезопасны, нет `any` в новых типах
9. Обратная совместимость: bulk-create без batch-полей работает как раньше

## Риски и edge-cases

| Риск | Митигация |
|------|-----------|
| Микросервис не возвращает qty для некоторых позиций | qty — optional, партия создаётся только при наличии qty |
| invoice_date в нестандартном формате | Валидация на backend; если формат невалиден — deliveryDate = null |
| Большой счёт (500+ позиций) | Batch insert в одной транзакции; лимит 500 items уже есть |
| Ошибка создания партии не должна блокировать создание материала | Можно обернуть создание партий в try/catch, но лучше всё в транзакции |
