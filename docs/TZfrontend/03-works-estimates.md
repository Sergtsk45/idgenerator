# ТЗ: Tablet UI адаптация — ВОР, Сметы, Импорты

**Версия:** 1.0  
**Дата:** 2026-03-10  
**Релиз:** tablet-ui-phase-2  
**Автор:** AI Assistant  

---

## 1. Область Покрытия

### Включаемые экраны и маршруты
- `/works` — ведомость объёмов работ (ВОР), сметы (ЛСР), импорт Excel
- **Context**: данные материалов из `/source/materials`, ссылки на `/schedule` для использования в графике

### Scope адаптации
- **Ширина**: 768–1024px (планшеты, landscape mobile)
- **Ориентация**: portrait и landscape (важно для таблиц)
- **Целевые улучшения**: 
  - Горизонтальный скролл таблиц с sticky столбцами
  - Более информативное отображение Excel импорта (preview перед upload)
  - Multi-tab интерфейс с выбором режима (ВОР / Смета / Импорт)
  - Компактные виды (реестр, таблица, карточки)

---

## 2. Текущие Ограничения и Риски Адаптации

### Архитектурные ограничения
1. **Excel парсинг на клиенте** (xlsx.js)
   - Риск: Large files (> 5 MB) могут зависнуть при парсинге
   - Решение: WebWorker для async парсинга, progress callback

2. **Таблица данных в UI** (shadcn/ui Table)
   - Текущая реализация: базовая, без sticky columns
   - Риск: На планшете горизонтальный скролл неудобен без sticky левой колонки
   - Решение: Использовать CSS `position: sticky` + `overflow: auto` для контейнера

3. **max-w-md контейнер**
   - Риск: Таблица будет узкой и непригодной на 768px
   - Решение: Conditional max-w (md:max-w-none или md:max-w-4xl)

4. **Импорт без preview**
   - Текущий flow: upload → парсинг → submit → импорт
   - Риск: Ошибки парсинга выявляются поздно
   - Решение: Preview modal перед финальным импортом

### Ограничения по данным
1. **Большие ВОР** (1000+ строк)
   - Риск: Render performance, прокрутка медленная
   - Решение: Виртуализация (react-window) или пагинация (50 rows per page)

2. **Множественные сметы (ЛСР)**
   - Текущий state: один импорт = одна смета
   - Риск: Много смет → UI перегруженный
   - Решение: Accordion или tabs для каждой сметы, collapse/expand

3. **Экспорт больших таблиц**
   - Риск: Browser может перестать отвечать при генерации Excel (> 10k rows)
   - Решение: Батчинг (200 rows per write), progress indicator

### Ограничения интеграции
1. **API rate limiting**
   - POST /api/works/import: может быть медленным на больших файлах
   - Решение: показывать progress bar, disable кнопки

2. **Связь с Schedule**
   - При импорте ВОР / Смета → может требовать re-bootstrap графика
   - Решение: Alert "Чтобы использовать новые данные в графике, перейдите в Schedule > Re-bootstrap"

---

## 3. Целевой Tablet UX

### 3.1 `/works` — Layout на планшете

**Tab-based interface**:
```
┌─────────────────────────────────────────────────┐
│ [Header] - ВОР/Смета                           │
├─────────────────────────────────────────────────┤
│ [Tabs: ВОР | Смета | Импорт] [Фильтры] [Вид]  │
├─────────────────────────────────────────────────┤
│                                                 │
│  [Таблица или карточки с горизонтальным scroll]│
│                                                 │
├─────────────────────────────────────────────────┤
│ [BottomNav]                                     │
└─────────────────────────────────────────────────┘
```

---

### 3.2 Таб ВОР (Works)

#### Отображение (Таблица)
- **Sticky столбцы**:
  - Левая: Код работы (120px fixed)
  - Основной контент: Описание, ед. изм., объём (flexible)
  - Остальные: Синонимы, примечания (horizontal scroll)

- **Структура таблицы**:
  ```
  ┌─────────┬────────────────┬─────────┬────────┬───────────┐
  │ Код (s) │ Описание (flex) │ Ед. изм │ Объём  │ Действия  │
  ├─────────┼────────────────┼─────────┼────────┼───────────┤
  │ 01.02.1 │ Земляные работы│ м³      │ 100.5  │ ⋮         │
  │ 01.02.2 │ Буронабивные...│ шт      │ 50     │ ⋮         │
  └─────────┴────────────────┴─────────┴────────┴───────────┘
  ```

- **Горизонтальный скролл**: контейнер с overflow-x auto, на mobile — дополнительный indicator "← Свайп для деталей"

#### Функциональность
1. **Поиск** (real-time):
   - Input field в toolbar: поиск по коду или описанию
   - Highlighting результатов в таблице

2. **Фильтры** (кнопка в toolbar):
   - Side-panel или modal с фильтрами:
     - По коду (text field, regex?)
     - По типу (dropdown: все, земляные, бетонные и т.д.)
     - By volume (min–max range slider)
   - Кнопки Apply / Reset
   - Кол-во активных фильтров в badge на кнопке

3. **Сортировка** (клик на заголовок таблицы):
   - Ascending / Descending
   - Indicator: ↑ / ↓

4. **Вид данных** (кнопка в toolbar):
   - Radio button group: Таблица / Карточки / Компактный список
   - **Таблица** (default): стандартная таблица
   - **Карточки**: каждая работа на отдельной карточке (flex column), удобно на portrait
   - **Компактный список**: одна строка на работу, minimal information

5. **Bulk действия**:
   - Checkbox на каждой строке / заголовок для select all
   - Булавки "Удалить выбранные" при наличии selection
   - Экспорт выбранных в CSV / Excel

6. **Действия на строку** (кнопка ⋮ или drag):
   - **Просмотр деталей**: modal с полной информацией (код, описание, объём, все синонимы)
   - **Редактирование**: inline edit или modal form
   - **Удаление**: confirm dialog
   - **Дублирование**: создать копию

#### States
- **Empty**: "Нет ВОР. Начните с импорта Excel"
- **Loading**: Skeleton rows (15–20)
- **Error**: "Ошибка загрузки" + Retry button
- **Filtered empty**: "По вашему фильтру нет результатов"

---

### 3.3 Таб Смета (Estimates)

#### Layout
- **List view**: аккордион со сметами (collapse/expand)
- Каждая смета показывает:
  - Название / код сметы
  - Регион, квартал (если в данных)
  - Кол-во позиций в смете
  - Сумма (итого)
  - Статус (активна, не используется)

#### Функциональность

1. **Выбор сметы и просмотр позиций**:
   - Клик на смету → expand accordion, показать таблица позиций
   - Аналогично ВОР: sticky колонки, горизонтальный скролл
   - Таблица позиций сметы:
     ```
     ┌────┬──────────────┬──────────┬──────────┬──────────┐
     │ № п│ Обоснование  │ Наимено- │ Кол-во   │ Сумма    │
     ├────┼──────────────┼──────────┼──────────┼──────────┤
     │ 1  │ ЭСН 01-02-1  │ Земляные │ 100.5 м³ │ 50,250р  │
     └────┴──────────────┴──────────┴──────────┴──────────┘
     ```

2. **Поиск в сметах**:
   - Global search: ищет по названиям смет и позициям
   - Результаты: выделяет/раскрывает совпадения

3. **Фильтры**:
   - По типу сметы (dropdown)
   - По периоду (если есть)
   - По статусу использования

4. **Действия на смету**:
   - **Использовать в графике**: кнопка "Сделать источником графика" (если нет, то disabled)
   - **Экспорт**: CSV / Excel только этой сметы
   - **Удалить**: confirm dialog + опция "Сбросить график?" если смета используется
   - **Просмотреть подробности**: modal с полной информацией

5. **Иерархия позиций** (если в file):
   - Вложенные позиции (родитель-потомок через indent)
   - Свёртывание/развёртывание группы

#### States
- **Empty**: "Нет смет. Начните с импорта Excel на вкладке Импорт"
- **Loading**: Skeleton accordion items (5–10)
- **Error**: "Ошибка загрузки смет" + Retry

---

### 3.4 Таб Импорт

#### File upload
- **Drag-and-drop zone**:
  - Large drop area (min 200px height)
  - Upload icon, текст "Перетащите Excel файл сюда"
  - Кнопка "Или выберите файл" → file input

- **Поддерживаемые форматы**: `.xlsx`, `.xls` (показать в UI)
- **Максимальный размер**: 10 MB (показать ограничение)

#### File preview & validation
После выбора файла:
1. **Парсинг** (на клиенте, WebWorker):
   - Детект типа (ВОР или Смета) по заголовкам
   - Если Смета: поиск строки "№ п/п / Обоснование / Наименование"
   - Если ВОР: стандартная структура (код, описание, ед. изм., объём)

2. **Preview modal**:
   - Заголовок: "Предпросмотр: [Тип] — [Кол-во строк] позиций"
   - Таблица с первыми 10–20 строк (чтобы проверить парсинг)
   - Вкладки: "Данные" (таблица) / "Проверка" (лог ошибок, if any)
   - Кнопки: "Импортировать" / "Отмена" / "Заново выбрать файл"

3. **Обработка ошибок при парсинге**:
   - Невозможно определить тип: "Не удалось определить тип файла. Проверьте структуру."
   - Заголовки не найдены: "Обязательные колонки не найдены: [список]"
   - Пустой файл: "Файл содержит менее 2 строк"
   - Невалидные значения: Таблица с ошибками (строка, колонка, причина)

#### Import process
1. **Кнопка "Импортировать"** в preview:
   - Disabled state с spinner "Импортирование…"
   - Progress bar (если > 2 сек)
   - Может быть разбито на батчи (100–200 строк за раз)

2. **Успешный импорт**:
   - Toast "Успешно импортировано [N] позиций"
   - Автоматический редирект на соответствующий таб (ВОР / Смета)
   - Таблица обновляется

3. **Ошибка при импорте**:
   - Alert: "Ошибка при импорте: [детали]"
   - Кнопка Retry / Cancel
   - Если частичный импорт: "Импортировано [N] из [M] позиций"

#### Дополнительно
- **Merge vs Replace**: radio button choice
  - **Merge** (default): добавить к существующим данным
  - **Replace**: очистить текущие данные и загрузить новые (с confirm)
- **Статистика**: "В системе уже [N] позиций. Новый импорт добавит [M] позиций."

#### States
- **Idle**: empty upload zone
- **Dragging**: highlighted drop zone (border, background color)
- **Parsing**: progress "Анализирование файла…" (50–1000 ms)
- **Preview**: show parsed data
- **Importing**: progress bar
- **Success**: toast + update
- **Error**: error alert + option to retry

---

## 4. Функциональные Требования

### 4.1 Works (ВОР) — ВСЕ требования

#### API
- `GET /api/works` — получить все работы (опционально: filter, sort, pagination)
- `GET /api/works?search=...` — поиск по коду или описанию
- `POST /api/works/import` — импорт из Excel (request: array работ)
- `PATCH /api/works/:id` — редактирование работы (опционально)
- `DELETE /api/works/:id` — удаление (опционально)
- `DELETE /api/works` — очистка всех (с confirm)

#### UI Components
- **SearchInput**: debounced, real-time highlights
- **FilterPanel**: modal или side-panel
- **Table**: sticky left column (код), horizontal scroll
- **ViewSwitcher**: radio buttons (table / cards / list)
- **BulkActionBar**: appears when rows selected

#### Data structures
```typescript
// Work item from API
interface Work {
  id: number;
  code: string;           // "01.02.1"
  description: string;    // "Земляные работы"
  unit: string;          // "м³"
  quantity: number;      // 100.5
  synonyms?: string[];   // alternative codes
  notes?: string;
  createdAt: string;
}
```

#### Sorting
- Default: by code (ascending)
- Sortable columns: Code, Description, Unit, Quantity
- Visual indicator: ↑ / ↓ in header

#### Filtering
- **Code** (text, case-insensitive): "01" ← finds "01.02.1", "01.03"
- **Type** (enum dropdown): "Земляные", "Бетонные", etc.
- **Volume range** (min–max): "100 — 500 m³"

#### Export
- Button in toolbar (or bulk actions)
- Formats: CSV (comma-sep, UTF-8 BOM), Excel (.xlsx)
- Включить: selected rows или all rows

---

### 4.2 Estimates (Sметы/ЛСР) — ВСЕ требования

#### API
- `GET /api/estimates` — список всех смет (user's object)
- `GET /api/estimates/:id` — получить смету со всеми позициями
- `POST /api/estimates/import` — импорт сметы из Excel
- `DELETE /api/estimates/:id` — удаление сметы (опционально: resetSchedule=1)

#### UI Components
- **EstimateAccordion**: collapse/expand каждую смету
- **PositionTable**: таблица позиций (для каждой раскрытой сметы)
- **EstimateDetails**: modal с полной информацией (регион, квартал, итоги)

#### Data structures
```typescript
interface Estimate {
  id: number;
  code: string;              // "РФ-2026"
  name: string;              // "Смета на строительство"
  region?: string;           // "Московская"
  quarter?: string;          // "Q2 2026"
  totalAmount: number;       // in rubles
  positionsCount: number;
  createdAt: string;
}

interface EstimatePosition {
  id: number;
  estimateId: number;
  positionNumber: number;    // "1"
  basis: string;            // "ЭСН 01-02-1"
  description: string;       // "Земляные работы"
  unit: string;             // "м³"
  quantity: number;         // 100.5
  unitPrice?: number;
  totalPrice?: number;
  notes?: string;
  resources?: Resource[];   // вложенные ресурсы
}
```

#### Функциональность
- **Accordion**: при expand → загрузить позиции (lazy load)
- **Иерархия**: если position.resources → показать вложенную таблицу (отступ)
- **Active status**: визуальный индикатор если смета используется в графике
- **Usage info**: "Используется в графике" (если используется)

---

### 4.3 Import tab — ВСЕ требования

#### File handling
- **Drag-and-drop** + file input
- **File validation**:
  - Тип: .xlsx, .xls
  - Размер: < 10 MB
  - Не пуст (> 2 rows)

#### Parsing logic
- **ВОР detection**: заголовок должен содержать "код" / "обоснование" / "описание" / "объём"
- **Смета detection**: "№ п/п" / "Обоснование" / "Наименование"
- **Fallback**: если не определится → ask user (radio buttons)

#### Import options
- **Merge/Replace**: radio button (merge default)
- **Validation**: перед импортом check duplicates by code (case-insensitive)
  - Если дубликат: option to skip / overwrite / prompt

#### Rate limiting
- API side: POST /api/works/import rate-limited
- UI side: disable кнопку на 2-3 сек, show "Импорт в прогрессе…"

---

## 5. Нефункциональные Требования

### Performance
- **Table rendering**: для > 1000 rows использовать react-window (virtualization)
- **Excel parsing**: для large files (> 5 MB) использовать WebWorker (async, non-blocking UI)
- **LCP**: < 2.5s на планшете (768px)
- **FID**: < 100ms при клике на фильтр, поиск
- **Таблица скролл**: плавный (60 fps) даже с 1000+ rows

### Accessibility
- **WCAG 2.1 AA**
- **Keyboard navigation**: Tab через фильтры, поиск, таблицу
- **Screen reader**: таблицы с proper `<th>`, `<tbody>`, headers
- **Color contrast**: >= 4.5:1
- **Resizable**: zoom до 200% должно быть читабельно

### Responsiveness
- **Mobile (480px)**: single-column table, horizontal scroll with sticky left column
- **Tablet portrait (600–767px)**: wider table columns, фильтры в drawer
- **Tablet landscape (768–1023px)**: full table, фильтры в side-panel (опционально)
- **Desktop (1024px+)**: full layout, многоколонные таблицы

### Browser compatibility
- Chrome 90+, Safari 14+, Firefox 88+
- ES2020, CSS Grid, Sticky positioning поддерживается
- File API, ArrayBuffer (для XLSX парсинга)

### Security
- **File upload**: валидация MIME type, size
- **Injection**: sanitize user input в поиске и фильтрах
- **API calls**: CSRF protection (если cookies)
- **Large files**: timeout protection при парсинге (max 30 сек)

### Design System & Touch Targets
- Все визуальные значения экранов `Works`, `Estimates` и `Import` должны использовать tokens из `docs/TZfrontend/design-system-12.03.2026-design-system/`
- Запрещены hardcoded colors, spacing, border radius, typography sizes, shadows и размеры таблиц/toolbar controls, если для них существует design token
- Все интерактивные элементы обязаны иметь hit area не меньше `44x44px`: search triggers, filter buttons, row actions, bulk actions, accordion toggles, tabs, file-picker buttons, import actions, pagination controls
- Если visual height контрола по design token составляет `40px`, необходимо расширить hit area до `44px+` через padding, wrapper или невидимую интерактивную область
- Sticky headers, sticky columns и dense table rows не отменяют правило `44px+` для кликабельных зон; компактность таблицы решается визуально, но не за счёт уменьшения touch area
- Обязательны состояния `default`, `hover`, `active`, `focus-visible`, `disabled` для toolbar actions, tabs, accordion items и destructive actions

---

## 6. Edge Cases, Error States, Loading States

### 6.1 Works table

**Empty states**:
- "Нет ВОР. Начните с импорта файла" (кнопка на таб Импорт)

**Loading states**:
- Skeleton rows (15–20 placeholders)
- Skeleton при применении фильтра (0.5–1 сек)

**Error states**:
- Таблица не загружена: "Ошибка загрузки данных" + Retry button
- Поиск не сработал: "Ошибка при поиске. Попробуйте позже"
- Удаление не сработало: toast "Не удалось удалить" + Retry

**Search edge cases**:
- Пусто search field: показать всё (фильтр reset)
- Нет результатов: "По запросу '[текст]' ничего не найдено"
- Регулярное выражение (если используется): если невалидное → error message

**Bulk operations**:
- Удалить 1000 rows: progress bar, может занять 3–5 сек
- Export 5000 rows: progress bar, уведомление "Файл готовится…"

---

### 6.2 Estimates accordion

**Empty states**:
- "Нет смет. Начните с импорта на вкладке Импорт"

**Loading states**:
- Skeleton accordion items (5–10)
- Lazy-load позиций при expand (skeleton rows в таблице)

**Error states**:
- Expand fails: "Не удалось загрузить позиции. Повторите"
- Удаление не сработало: "Не удалось удалить смету" + Retry

**Edge cases**:
- Смета с 10000 позиций: lazy pagination (load first 100, then paginate)
- Смета используется в графике + удаление: confirm "Это удалит связанные задачи в графике?"
- Иерархия позиций глубокая (5+ уровней): indent visualization может быть узким

---

### 6.3 Import flow

**File selection edge cases**:
- Выбран текстовый файл вместо Excel: "Поддерживаются только .xlsx и .xls файлы"
- Файл 10 MB точно: "Файл слишком большой (максимум 10 MB)"
- Файл пуст (1 row): "Файл должен содержать заголовок и минимум 1 строку данных"

**Parsing errors**:
- Невозможно определить тип: modal с radio buttons "Это файл ВОР или Смета?"
- Заголовки не найдены: show preview с ошибками "Не найдены колонки: Код, Объём"
- Невалидные значения (non-numeric в quantity): таблица с ошибками (строка 5, колонка 3: "Ожидается число, получено 'abc'")

**Parsing performance**:
- File 1 MB: парсится < 1 сек
- File 5 MB: может занять 3–5 сек (progress bar с процентом)
- File > 10 MB: rejected до загрузки

**Import process**:
- Батчинг: если 10000 rows, импортировать по 200 за раз (5 батчей)
- Прогресс: "Импортировано 200/10000…"
- Успех: "Успешно импортировано 10000 позиций. Таблица обновлена"
- Ошибка на батче: "Ошибка на позиции 2150. Описание: …" + Retry батча или Continue

**Merge/Replace**:
- Merge: "В системе уже 500 позиций. Будет добавлено 300 новых"
- Replace confirm: "Это удалит все существующие 500 позиций. Продолжить?"

---

## 7. Acceptance Criteria

### Works table
- [ ] Таблица отображается на 480px, 768px, 1024px
- [ ] Левая колонка (код) sticky, остальное скроллится horizontally
- [ ] Поиск: real-time, находит по коду и описанию
- [ ] Фильтры: по коду (regex), типу, объёму (range)
- [ ] Сортировка: по клику на заголовок, индикатор ↑/↓
- [ ] Вид переключатель: таблица, карточки, список работают
- [ ] Bulk select: checkbox select, "Выделить все" работает
- [ ] Удаление: с confirm, работает (delete, затем refresh таблицы)
- [ ] Экспорт: CSV и Excel скачиваются и открываются корректно
- [ ] Empty state и loading skeleton видны

### Estimates accordion
- [ ] Аккордион отображается, можно expand/collapse
- [ ] Таблица позиций загружается при expand (lazy load OK)
- [ ] Sticky header и sticky левая колонка в таблице позиций
- [ ] Hierarchy (if present): вложенные позиции показываются с indent
- [ ] Удаление сметы: с confirm, работает
- [ ] Если смета used in schedule: флаг "Используется" видна
- [ ] Empty state видно

### Import tab
- [ ] Drag-and-drop зона видна, файл можно перетащить
- [ ] File input: можно выбрать файл через кнопку
- [ ] Validation: > 10 MB rejected до upload, неверный format rejected
- [ ] Preview modal: показывает первые 10 rows, таблица валидна
- [ ] Parsing errors: если ошибки в файле, они показаны в preview
- [ ] Import button: импортирует, показывает прогресс
- [ ] Успех: toast и редирект на соответствующий таб (ВОР / Смета)
- [ ] Ошибка: alert с деталями, option retry
- [ ] Merge/Replace: radio choice работает, confirm показывается при Replace

### General
- [ ] Таблицы с 1000+ rows: virtualization работает (smooth scroll)
- [ ] Excel парсинг > 5 MB: не зависает UI (WebWorker)
- [ ] Lighthouse: Performance > 80, Accessibility > 90 на 768px
- [ ] Responsive: 320px, 480px, 768px, 1024px тестированы
- [ ] Keyboard: Tab, Enter, Escape навигация работает
- [ ] WCAG 2.1 AA: color contrast, screen reader friendly
- [ ] Все интерактивные элементы и row actions соответствуют правилу hit area `44x44px+`
- [ ] Визуальные значения экранов берутся из Design System; hardcoded visual values в tablet UI отсутствуют

---

## 8. Зависимости от API, Данных, Компонентов

### API endpoints
- `GET /api/works` — работы (опционально: `?search=...`, `?sort=`, `?filter=`)
- `POST /api/works/import` — импорт (request: { data: Work[], mode: 'merge'|'replace' })
- `DELETE /api/works` — очистить всё (dev?)
- `GET /api/estimates` — сметы
- `GET /api/estimates/:id` — смета + позиции
- `POST /api/estimates/import` — импорт сметы из Excel
- `DELETE /api/estimates/:id` — удалить смету (опционально: `?resetSchedule=1`)

### Libraries
- `xlsx` / `xlsx-js-style` — парсинг и генерация Excel
- `react-window` — виртуализация больших таблиц
- `lucide-react` — иконки (search, filter, download, delete, etc.)
- `date-fns` — форматирование дат (если нужны)
- `tailwindcss` — стилизация (sticky, grid, flex)
- `clsx` / `classnames` — условные классы

### Custom components
- **Table** (shadcn/ui): базовая таблица, нужно расширить для sticky columns
- **Dialog** (shadcn/ui): модальные окна (preview, confirm)
- **Sheet** (shadcn/ui): side-panel для фильтров на планшете
- **Input**, **Button**, **Select**, **Checkbox** (shadcn/ui): формы
- **Accordion** (shadcn/ui): для смет

### Custom hooks
- `useWorks()` — получение, кеширование работ
- `useImportWorks()` — импорт (mutation)
- `useEstimates()` — получение смет
- `useImportEstimate()` — импорт сметы
- `useToast()` — уведомления
- `useMobile()` — media query для breakpoints

### Utilities
- **Excel парсер**: `parseWorkbookToWorks()`, `parseEstimateWorkbook()` (из `lib/estimateParser.ts`)
- **CSV экспорт**: функция для генерации CSV (может быть в utils)
- **Debounce**: для поиска (в React уже есть через State)

### localStorage
- Фильтры (опционально): persist фильтры state
- Вид (таблица/карточки): persist выбор
- Последний импортированный file (опционально)

---

## 9. Implementation Notes

### Parsing Strategy
1. **Detect type**: проверить заголовки
   - ВОР: "код", "описание", "объём" (в любом порядке, case-insensitive)
   - Смета: "№ п/п", "обоснование", "наименование"
2. **Extract rows**: skip empty rows, parse numbers
3. **Validation**: для каждой строки check required fields
4. **Return**: массив объектов или error list

### Table optimization (sticky + scroll)
```css
/* Sticky header */
table {
  position: relative;
}
thead tr {
  position: sticky;
  top: 0;
  z-index: 10;
  background: white;
}

/* Sticky left column */
td:first-child {
  position: sticky;
  left: 0;
  z-index: 5;
  min-width: 120px;
}
th:first-child {
  position: sticky;
  left: 0;
  top: 0;
  z-index: 11;
}

/* Horizontal scroll container */
.table-container {
  overflow-x: auto;
}
```

### Testing Checklist
- [ ] Works table: filter, sort, search, delete, export
- [ ] Estimates: expand/collapse, load positions, delete
- [ ] Import: drag-drop, file validation, preview, import success/error
- [ ] Performance: virtualization test (1000+ rows)
- [ ] Responsive: 480px, 768px, 1024px
- [ ] Keyboard: Tab, Enter, Escape
- [ ] Accessibility: WCAG 2.1 AA

### Known Limitations
- **WebWorker для парсинга**: может не поддерживаться в older browsers, fallback на main thread
- **Sticky positioning**: не поддерживается в IE11 (но проект не обязан поддерживать IE)
- **Large datasets**: если > 5000 rows, может быть медленно даже с виртуализацией (consider pagination)

---

## Примечания для разработчика

**Приоритет реализации:**
1. **High**: Таблица с sticky столбцами + горизонтальный скролл
2. **High**: Импорт с preview и парсингом
3. **Medium**: Фильтры и поиск
4. **Medium**: Экспорт (CSV / Excel)
5. **Low**: Виртуализация (если > 1000 rows станет проблемой)

**Testing environments:**
- Chrome DevTools: iPad (768px) and Galaxy Tab (800px) emulation
- Real device: if available
- Lighthouse audit after implementation

