# ТЗ: Tablet UI адаптация — График Работ, Акты, Сложные Формы

**Версия:** 1.0  
**Дата:** 2026-03-10  
**Релиз:** tablet-ui-phase-2  
**Автор:** AI Assistant  

---

## 1. Область Покрытия

### Включаемые экраны и маршруты
- `/schedule` — график работ (Gantt-диаграмма, редактор задач)
- `/acts` — акты АОСР (список, просмотр, экспорт)
- `/select-act-template` — выбор шаблона акта (modal/drawer subflow)
- `/select-task-materials` — выбор материалов для задачи (modal/drawer subflow, multi-select)
- **Context**: интеграция с `/works`, `/source/materials`, `/source/documents`

### Scope адаптации
- **Ширина**: 768–1024px (планшеты landscape, portrait + split-view)
- **Ориентация**: основная landscape (для Gantt), поддержка portrait (свёрнутый вид)
- **Целевые улучшения**:
  - Gantt-диаграмма: прокрутка по горизонтали и вертикали, zoom levels
  - Task editor: side-by-side modal (left: задача, right: preview/properties)
  - Subflows: modal stacking (темплейты → материалы → документы)
  - Export: форма заполнения с preview
  - Split task: visual timeline editor для разделения

---

## 2. Текущие Ограничения и Риски Адаптации

### Архитектурные ограничения
1. **Gantt диаграмма** — требует горизонтального пространства
   - Риск: на portrait планшете может быть узкой и нечитабельной
   - Решение: Горизонтальная прокрутка + mini-calendar для быстрого навигирования по датам

2. **Task editor modal** — может быть перегруженным на tablet
   - Риск: form с 10+ полей, все в одном модале → не влезет на экран
   - Решение: Tabs внутри modal или multi-step form

3. **Material/Document selection** — multi-select interface
   - Риск: Большой список материалов может требовать поиска + фильтрации
   - Решение: Searchable dropdown + sticky header при скролле

4. **PDF export** — может быть медленным для больших актов
   - Риск: UI зависнет при генерации PDF (pdfmake работает на main thread)
   - Решение: Progress indicator, может быть WebWorker (если нужно)

5. **Split task timeline editor**
   - Риск: Визуальное перетаскивание маркера может быть неудобным на touch
   - Решение: Комбинация drag-to-move + date-picker для точного ввода

### Ограничения по данным
1. **Большой график** (500+ задач)
   - Риск: Gantt может быть медленным при рендере SVG или canvas
   - Решение: Виртуализация (только видимые задачи на экране)

2. **Много материалов/документов** (1000+ items)
   - Риск: Выборка медленная, нужен поиск
   - Решение: Lazy load + debounced search

3. **Много актов** (100+ за период)
   - Риск: Список может быть медленным
   - Решение: Пагинация или infinite scroll

### Ограничения интеграции
1. **Schedule → Acts генерация**
   - Endpoint может быть медленным (POST /api/schedules/:id/generate-acts)
   - Решение: Progress callback, websocket (если в плане), или polling

2. **Зависимость от /works и /source/materials**
   - Если данные не синхронизированы → могут быть нечитабельные ошибки
   - Решение: Валидация при save, informative error messages

---

## 3. Целевой Tablet UX

### 3.1 `/schedule` — Layout на планшете

**Основной layout (landscape)**:
```
┌────────────────────────────────────────────────────┐
│ [Header] - График работ                           │
├─────────────┬──────────────────────────────────────┤
│  [Task      │  [Gantt диаграмма]                   │
│   list]     │  ↓ vertical scroll                   │
│  ↓ scroll   │  → horizontal scroll (dates)         │
│             │                                      │
│ [Actions]   │  [Zoom controls] [View options]     │
└─────────────┴──────────────────────────────────────┘
```

**Portrait layout (на запрос)**:
```
┌──────────────────────────────────────┐
│ [Header]                             │
├──────────────────────────────────────┤
│ [Tabs: График | Список]              │
├──────────────────────────────────────┤
│ [Gantt atau List view]               │
│ ↓ vertical scroll                    │
└──────────────────────────────────────┘
```

---

### 3.2 Gantt Диаграмма

#### Компоненты
1. **Timeline header** (sticky top):
   - Дата начала / конца диапазона
   - Масштаб: месячный / недельный / дневной (radio buttons или dropdown)
   - Навигация: « Previous | Today | Next »
   - Mini calendar (popup по клику на дату) для быстрого перемещения

2. **Left panel** (sticky, ~200px width):
   - Task list (иерархия, если есть)
   - Каждая задача: код, описание, статус
   - Checkbox для выбора
   - Expand/collapse для групп (если есть)

3. **Center panel** (scrollable both H and V):
   - Gantt bars (полосы каждой задачи)
   - Color: status-based (not started, in progress, completed, delayed)
   - Hover: показать tooltip с датами, объёмом, актом
   - Click: открыть Task editor modal

4. **Controls** (sticky bottom или overlay):
   - Zoom buttons: 50% / 100% / 150% / 200%
   - View options: Gantt / List / Table (radio or dropdown)
   - Create task button
   - Generate acts button

#### Функциональность

1. **Zoom & Pan**:
   - Zoom: mouse wheel или кнопки, центрирование на курсоре
   - Pan: drag Gantt (all direction) или scroll
   - На планшете: two-finger zoom (pinch) может работать (если library поддерживает)

2. **Task selection & actions**:
   - Клик на task → select (highlight) + open context menu или slide-out panel
   - Drag-to-reorder (может быть отключено по умолчанию для безопасности)
   - Resize bar (drag edges) → изменить даты (если editing enabled)

3. **Task editor**:
   - Double-click на bar или кнопка Edit → modal
   - Содержимое: код, описание, даты, объём, статус, акт, материалы, документы
   - Tabs: "Основное" / "Материалы" / "Документация"
   - Save / Cancel buttons

4. **Split task**:
   - Правый клик на bar → "Разделить на захватки" → SplitTaskDialog
   - Или кнопка в task editor

5. **Generate acts**:
   - Кнопка "Сформировать акты из графика" (внизу или в toolbar)
   - Confirm dialog с деталями
   - Progress bar при генерации
   - После завершения → toast "Акты сформированы" + redirect на /acts

6. **Filters & search**:
   - Filter button → side-panel с фильтрами:
     - По статусу (not started, in progress, completed, delayed)
     - По коду акта (text search)
     - По дате диапазона (date-picker)
   - Search box (real-time filter по описанию задачи)

#### States
- **Loading**: Skeleton bars (20–30 задач)
- **Empty**: "Нет задач. Создайте новую или загрузите из ВОР"
- **Error**: "Ошибка загрузки графика" + Retry
- **Offline**: Banner + cached data

---

### 3.3 Task Editor Modal

**Layout на планшете (768px+)**:
```
┌─────────────────────────────────────────────────────┐
│ [X] Task Editor                                     │
├─────────────┬───────────────────────────────────────┤
│ [Tab 1:     │ [Основное]                            │
│ Основное]   │ Код: [______]  Статус: [dropdown]    │
│             │ Описание: [__________________]        │
│ [Tab 2:     │ Дата старт: [date] Дата конец: [date]│
│ Материалы]  │ Объём: [____] Акт: [dropdown]        │
│             │                                       │
│ [Tab 3:     │ [Независимые материалы] ☐            │
│ Документы]  │                                       │
│             │ [Сохранить] [Отмена] [Удалить]      │
└─────────────┴───────────────────────────────────────┘
```

**Side-by-side mode (1024px+)**:
- Left: form (как выше)
- Right: preview (как задача выглядит в графике, список материалов, timeline)

#### Tabs

1. **Основное**:
   - Code (text, read-only или editable)
   - Description (textarea, 2–3 lines)
   - Status (dropdown: Not started / In progress / Completed / Delayed)
   - Start date (date-picker)
   - End date (date-picker, computed from durationDays or editable)
   - Duration days (computed или read-only)
   - Quantity (number)
   - Act number (text)
   - Act template ID (dropdown для выбора типа акта)
   - "Независимые материалы" toggle (if split_group_id not null)

2. **Материалы**:
   - List of linked materials (from task_materials)
   - Add button → SelectTaskMaterials modal (multi-select)
   - Каждый материал: checkbox (remove?), название, кол-во, статус документов
   - Remove button на каждом материале

3. **Документация**:
   - Project drawings (textarea, JSON или markdown)
   - Normative refs (textarea)
   - Executive schemes (textarea)
   - Каждое поле имеет кнопку "Выбрать из документов" (опционально, если есть документы)

#### Функциональность

1. **Validation**:
   - Required: Code, Description, Start date, End date, Act number
   - End date >= Start date
   - Quantity > 0
   - Real-time validation feedback

2. **Save**:
   - PATCH /api/schedule-tasks/:id
   - После сохранения → Gantt refreshes, modal closes
   - Toast "Задача сохранена"

3. **Delete**:
   - Confirm dialog
   - DELETE /api/schedule-tasks/:id
   - После удаления → Gantt refreshes, modal closes
   - Toast "Задача удалена"

4. **Split task**:
   - Кнопка "Разделить на захватки" → opens SplitTaskDialog modal (overlay на текущий modal)

#### States
- **Loading**: skeleton inputs при открытии
- **Submitting**: save button disabled, spinner
- **Error**: validation errors inline + toast

---

### 3.4 Split Task Dialog

**Layout**:
```
┌─────────────────────────────────────────┐
│ [X] Разделить задачу на захватки      │
├─────────────────────────────────────────┤
│ Исходная задача:                        │
│ Код [_____] Объём [___] м³ Дата [_]–[_]│
│                                         │
│ Дата разделения: [date picker]         │
│ ◄─ [────────●────────] ►                │
│  Часть 1: от [date] до [date]          │
│  Часть 2: от [date] до [date]          │
│                                         │
│ Распределение объёма:                   │
│ Часть 1: [____] м³ (auto: 50%)          │
│ Часть 2: [____] м³ (auto: 50%)          │
│                                         │
│ Номер акта для Части 2: [________]     │
│                                         │
│ ☑ Копировать материалы                  │
│ ☑ Копировать чертежи                    │
│ ☑ Копировать нормативы                  │
│ ☑ Копировать схемы                      │
│                                         │
│ [Разделить] [Отмена]                    │
└─────────────────────────────────────────┘
```

#### Функциональность

1. **Timeline визуализация**:
   - Слайдер для выбора даты разделения (внутри диапазона исходной задачи)
   - Отображение: "Часть 1: 01-07 янв" и "Часть 2: 08-15 янв"

2. **Распределение объёма**:
   - Два input field (Часть 1, Часть 2)
   - Сумма должна = исходный объём
   - Real-time validation: красный border если не совпадает
   - "Распределить поровну" кнопка (auto-fill 50/50)

3. **Копирование данных**:
   - 4 checkbox для выбора (материалы, чертежи, нормативы, схемы)
   - По умолчанию: все checked (копировать всё)

4. **Валидация**:
   - Дата разделения: must be inside original date range
   - Sum of volumes: must equal original
   - Act number for part 2: must be unique (optional validation)
   - Feedback: inline errors, colors, icons

5. **Submit**:
   - POST /api/schedule-tasks/:id/split
   - Request: { splitDate, quantityFirst, quantitySecond, newActNumber, inherit: {...} }
   - На успех: close modal, refresh Gantt, toast "Задача разделена"
   - На ошибку: toast error message, keep modal open

#### States
- **Loading form**: skeleton inputs
- **Submitting**: submit button disabled, spinner
- **Error**: validation errors inline

---

### 3.5 SelectTaskMaterials Modal (Subflow)

**Layout**:
```
┌──────────────────────────────────────────┐
│ [X] Выбрать материалы для задачи        │
├──────────────────────────────────────────┤
│ [Search: ________] [Фильтры ▼]          │
├──────────────────────────────────────────┤
│ ☑ [Материал 1]          Статус: ✅      │
│ ☐ [Материал 2]          Статус: ⚠️      │
│ ☐ [Материал 3]          Статус: ❌      │
│ ...                                      │
│                                          │
│ [Добавить выбранные] [Отмена]           │
└──────────────────────────────────────────┘
```

#### Функциональность

1. **List of materials**:
   - Checkbox на каждом материале
   - Название, кол-во, ед. изм., статус документов (icons)
   - Статус: зелёный (all docs), жёлтый (some docs), красный (no docs)

2. **Search & Filter**:
   - Real-time search по названию материала
   - Фильтр по статусу документов (dropdown)
   - Фильтр по типу материала (если есть в данных)

3. **Bulk select**:
   - "Выбрать все", "Снять все" кнопки
   - Счётчик "3 из 50 выбрано"

4. **Submit**:
   - "Добавить выбранные" → POST /api/schedule-tasks/:id/materials (with selected material IDs)
   - На успех: close modal, reload task editor
   - На ошибку: toast error

#### States
- **Loading**: skeleton list (10–15 items)
- **Empty**: "Нет материалов. Добавьте на вкладке /source/materials"
- **Error**: "Ошибка загрузки материалов"

---

### 3.6 SelectActTemplate Modal (Subflow)

**Layout**:
```
┌─────────────────────────────────────────┐
│ [X] Выбрать шаблон акта                │
├─────────────────────────────────────────┤
│ [Search: ________]                      │
├─────────────────────────────────────────┤
│ ◯ [Акт 1 — АОСР]                        │
│ ◯ [Акт 2 — АКР]                         │
│ ◯ [Акт 3 — Приёмка]                     │
│ ...                                      │
│                                          │
│ Описание:                                │
│ Lorem ipsum dolor sit amet...            │
│                                          │
│ [Выбрать] [Отмена]                      │
└─────────────────────────────────────────┘
```

#### Функциональность

1. **List of templates**:
   - Radio button на каждом (single-select)
   - Название, описание (preview на hover или в panel ниже)

2. **Search**:
   - Real-time filter по названию

3. **Description panel**:
   - Показывает подробное описание выбранного шаблона (если есть)

4. **Submit**:
   - "Выбрать" → сохранить выбор и close modal
   - На успех: task editor refreshes с новым template ID

#### States
- **Loading**: skeleton list
- **Empty**: "Нет шаблонов актов. Загрузите через admin"
- **Error**: "Ошибка загрузки шаблонов"

---

### 3.7 `/acts` — Список Актов

**Layout на планшете (768px)**:
```
┌─────────────────────────────────────────┐
│ [Header] - Акты АОСР                   │
├─────────────────────────────────────────┤
│ [Фильтры] [Поиск ________] [Генерировать]
├─────────────────────────────────────────┤
│ [Акт 1]                                 │
│ Номер: 001  Период: 01-07 янв           │
│ Статус: готов  Задач: 5                 │
│ [Просмотр] [Экспорт] [⋮]                │
│                                          │
│ [Акт 2]                                 │
│ ...                                      │
│                                          │
└─────────────────────────────────────────┘
```

#### Компоненты

1. **Filters toolbar**:
   - Фильтр по периоду (date-picker range)
   - Фильтр по статусу (checkbox: готов, черновик, ошибка)
   - Фильтр по шаблону (dropdown)
   - Search по номеру акта (text input)

2. **Act list**:
   - Карточка на каждый акт (или компактный список если > 10)
   - Каждая карточка: номер, период, статус, кол-во задач
   - Actions: Просмотр (modal), Экспорт (dropdown: PDF, Excel), Удалить (confirm), More (⋮ menu)

3. **Generate acts button**:
   - Большая кнопка в toolbar
   - При клике → confirm dialog с опциями
   - После генерации → list refreshes, toast "Акты сформированы"

4. **Export flow**:
   - Клик "Экспорт" → dropdown с форматами (PDF, Excel, CSV)
   - Выбор формата → ExportActsForm modal (заполнение реквизитов, выбор шаблонов)
   - Прогресс при генерации файла
   - Скачивание файла

#### States
- **Empty**: "Нет актов. Сформируйте из графика"
- **Loading**: skeleton cards (5–10)
- **Error**: "Ошибка загрузки актов"
- **Generating**: progress bar "Генерирование актов…"

---

### 3.8 ExportActsForm — Форма для Экспорта

**Layout (modal, может быть wide на планшете)**:
```
┌───────────────────────────────────────────────┐
│ [X] Экспортировать в PDF                     │
├───────────────────────────────────────────────┤
│ Выбранные акты: 3 (001, 002, 003)            │
│                                               │
│ Шаблон: [dropdown: АОСР, АКР, ...]          │
│                                               │
│ Реквизиты (заполнить данные акта):           │
│ Заказчик: [_____________]                    │
│ Подрядчик: [_____________]                   │
│ Адрес объекта: [_____________________]      │
│ ...                                           │
│                                               │
│ ☑ Применить эти реквизиты ко всем актам    │
│                                               │
│ [Скачать PDF] [Отмена]                       │
└───────────────────────────────────────────────┘
```

#### Функциональность

1. **Form fields**:
   - Заполнение реквизитов (заказчик, подрядчик, адрес, ответственные лица и т.д.)
   - Pre-fill from /source-data (object parties, responsible persons)
   - Опция "Применить ко всем актам" (checkbox)

2. **Шаблон выбор**:
   - Dropdown с доступными шаблонами PDF

3. **Export button**:
   - POST /api/acts/:id/export (или /api/acts/export-batch для множественного)
   - Request: { format: 'pdf'|'excel', template: '...', formData: {...} }
   - Прогресс при генерации
   - После завершения → файл скачивается

4. **Error handling**:
   - Если реквизиты не заполнены → validation error
   - Если файл не сгенерировался → toast error

#### States
- **Loading form**: skeleton inputs
- **Exporting**: progress bar, disabled button
- **Success**: file download
- **Error**: validation errors inline + toast

---

## 4. Функциональные Требования

### 4.1 Schedule (Gantt) — Обязательные функции

#### API
- `GET /api/schedules/default` или `/api/schedules/:id` — получить график
- `GET /api/schedules/:id/schedule-tasks` — задачи графика
- `PATCH /api/schedule-tasks/:id` — обновить задачу
- `DELETE /api/schedule-tasks/:id` — удалить задачу
- `POST /api/schedule-tasks/:id/split` — разделить задачу
- `GET /api/schedule-tasks/:id/split-siblings` — получить задачи-захватки
- `GET /api/schedule-tasks/:id/materials` — материалы задачи
- `PUT /api/schedule-tasks/:id/materials` — обновить материалы
- `POST /api/schedules/:id/generate-acts` — сформировать акты из графика
- `POST /api/schedules/:id/bootstrap-from-works` — создать задачи из ВОР
- `GET /api/act-templates` — список шаблонов актов

#### Rendering
- Gantt bars: SVG или canvas (зависит от выбранной library, e.g., react-gantt-chart)
- Zoom levels: 50%, 100%, 150%, 200% (или continuous zoom)
- Scroll: horizontal + vertical
- Virtualization: для > 100 задач

#### Interactions
- Click on bar: select + open context menu или open editor
- Double-click: open editor modal
- Right-click: context menu (edit, delete, split, etc.)
- Drag bar: reorder (если enabled) или resize (change dates)
- Scroll + zoom: standard gestures

---

### 4.2 Task Editor — Обязательные функции

#### Form fields
- Code (read-only или editable)
- Description (textarea, required)
- Status (dropdown: Not started, In progress, Completed, Delayed)
- Start date (date-picker, required)
- End date (date-picker, required)
- Duration days (computed from dates)
- Quantity (number, required)
- Act number (text, required)
- Act template (dropdown, select via modal)
- Independent materials toggle (if split_group_id)
- Project drawings, normative refs, executive schemes (textareas)
- Materials (link to SelectTaskMaterials modal)

#### Validation
- Required fields check
- End date >= Start date
- Quantity > 0
- Act number must be unique (or validation from server)

#### Persistence
- PATCH /api/schedule-tasks/:id
- On save: Gantt refreshes, modal closes, toast success
- On delete: DELETE, Gantt refreshes, modal closes, toast success

---

### 4.3 Split Task Dialog — Обязательные функции

#### Inputs
- Split date (date-picker inside date range of original task)
- Quantity part 1, part 2 (sum must equal original)
- Act number for part 2 (text, required)
- Checkboxes: copy materials, drawings, refs, schemes

#### Validation
- Split date must be inside original date range
- Sum of quantities == original quantity
- Act number must be unique
- At least one copy option must be selected (opinionated)

#### Output
- POST /api/schedule-tasks/:id/split
- Request: { splitDate, quantityFirst, quantitySecond, newActNumber, inherit: {...} }
- Response: { original, created } (two tasks)
- On success: close modal, refresh Gantt

---

### 4.4 SelectTaskMaterials Modal — Обязательные функции

#### List
- Multi-select (checkboxes)
- Material name, quantity, unit, document status
- Search & filter
- "Select all" / "Deselect all" buttons

#### Submit
- "Add selected" → PUT /api/schedule-tasks/:id/materials
- Request: { materialIds: [...] }
- On success: close modal, reload task editor

---

### 4.5 SelectActTemplate Modal — Обязательные функции

#### List
- Single-select (radio buttons)
- Template name, description
- Search

#### Submit
- "Select" → set act template ID in task editor, close modal

---

### 4.6 Acts List (`/acts`) — Обязательные функции

#### API
- `GET /api/acts` — список актов (optional: filter, search, pagination)
- `DELETE /api/acts/:id` — удалить акт
- `POST /api/acts/:id/export` — экспорт в формат (PDF, Excel, CSV)
- `POST /api/schedules/:id/generate-acts` — генерация актов

#### Display
- Act cards or list rows (number, period, status, tasks count)
- Filters: date range, status, template
- Search: by act number
- Actions: View, Export, Delete, More

#### Export form
- Form to fill in requisites (заказчик, подрядчик, адрес, etc.)
- Template selection (dropdown)
- Apply to all button
- Submit → file download

---

## 5. Нефункциональные Требования

### Performance
- **Gantt rendering**: для > 500 задач использовать виртуализацию (render only visible rows)
- **LCP**: < 3.0s на планшете (768px)
- **FID**: < 100ms при клике на задачу, drag bar
- **CLS**: < 0.1 (не должно быть неожиданных сдвигов)
- **PDF export**: максимум 10 сек для одного акта (может быть прогресс bar)

### Accessibility
- **WCAG 2.1 AA**
- Keyboard navigation: Tab, Enter, Escape, Arrow keys
- Screen reader: semantic HTML, ARIA labels
- Color contrast: >= 4.5:1
- Focus indicators visible

### Responsiveness
- **Tablet portrait (600–767px)**: Gantt может быть в tabs (Graph / List view), narrow columns
- **Tablet landscape (768–1023px)**: full Gantt with left panel, sticky header/footer
- **Desktop (1024px+)**: wide Gantt, side-panels, all features visible

### Browser support
- Modern browsers (Chrome 90+, Safari 14+, Firefox 88+)
- Touch support (for tablet devices)
- Drag-and-drop (HTML5)
- Date picker (native or polyfill)

### Security
- **CSRF**: token protection if cookies
- **XSS**: sanitize user input in forms
- **API**: rate limiting for generate-acts (server-side)
- **Sensitive data**: no tokens in logs, no leaked auth headers

### Design System & Touch Targets
- Все визуальные значения экранов `Schedule`, `Task Editor`, `Split Task` и `Acts` должны браться из `docs/TZfrontend/design-system-12.03.2026-design-system/`
- Запрещены hardcoded colors, spacing, radius, elevations, typography sizes и размеры контролов, если для них есть design tokens
- Все интерактивные элементы обязаны иметь hit area не меньше `44x44px`: gantt toolbar buttons, zoom controls, tabs, row actions, modal actions, date pickers, checkboxes, radio buttons, export actions, dialog close buttons
- Если отдельный visual token задаёт размер `40px`, необходимо расширить реальную интерактивную область до `44px+` через padding, wrapper или дополнительную hit zone
- Dense gantt layouts, timeline controls и compact modal toolbars не являются исключением: уменьшать можно только визуальную часть, но не touch area
- Для gantt interactions и modal workflows обязательны состояния `default`, `hover`, `active`, `focus-visible`, `disabled`; focus-visible должен быть явно заметен и в светлой, и в тёмной теме

---

## 6. Edge Cases, Error States, Loading States

### 6.1 Gantt & Task Editor

**Empty states**:
- "Нет задач. Создайте новую или загрузите из ВОР"
- При фильтре: "По вашему фильтру нет задач"

**Loading states**:
- Skeleton bars (20–30 tasks)
- Skeleton in task editor form

**Error states**:
- Gantt не загружена: "Ошибка загрузки графика" + Retry
- Task editor save error: inline validation errors + toast "Не удалось сохранить"
- Split fails: "Ошибка разделения задачи. Проверьте данные"
- Delete confirm: "Это удалит [N] связанные материалы. Продолжить?"

**Edge cases**:
- Task with duration = 1 day (display correctly in Gantt)
- Many overlapping tasks (zoom out to see all, may be crowded)
- Task split creates 3+ parts (multiple splits on same task)
- Orphaned materials after split (if `independentMaterials = false`, material links must stay consistent with the updated task structure)
- Circular dependencies (если есть predecessor/successor, validate no cycles)

---

### 6.2 Split Task

**Validation errors**:
- "Дата разделения должна быть в пределах диапазона [start]–[end]"
- "Сумма объёмов не совпадает (ожидается [N], получено [M])"
- "Номер акта для Части 2 уже существует"

**Edge cases**:
- Split date = start date (technically valid? or error?)
- Split date = end date (technically valid? or error?)
- Quantity part 1 = 0 or part 2 = 0 (should reject or allow?)
- Material list is empty (allow split without materials?)

---

### 6.3 Acts & Export

**Empty states**:
- "Нет актов. Сформируйте из графика"
- "Нет результатов по фильтру"

**Loading states**:
- Skeleton cards (5–10 acts)
- Export form skeleton
- Progress bar during export (if > 2 sec)

**Error states**:
- Acts не загружены: "Ошибка загрузки актов" + Retry
- Generate fails: "Ошибка при генерировании актов. Проверьте данные графика"
- Export fails: "Ошибка при экспорте. Попробуйте позже"
- Form validation: "Заполните обязательные поля"

**Edge cases**:
- Act with 0 tasks (shouldn't exist, but validate server-side)
- Act with many materials (1000+ items, may be slow to export)
- Export large batch (100+ acts): implement progress + batching

---

## 7. Acceptance Criteria

### Gantt & Schedule
- [ ] Gantt отображается на 768px, 1024px без errors
- [ ] Задачи видны, bars имеют правильные даты и цвета
- [ ] Zoom buttons работают (50%, 100%, 150%, 200%)
- [ ] Scroll horizontal и vertical работают плавно
- [ ] Click на task → select + highlight (или open context menu)
- [ ] Double-click → open task editor modal
- [ ] Фильтры работают (по статусу, коду, дате)
- [ ] Search работает (real-time filter по описанию)
- [ ] View switcher (Gantt / List) работает
- [ ] Loading skeleton видно при загрузке
- [ ] Empty state видно если нет задач
- [ ] > 500 задач → virtualization работает (smooth scroll)

### Task Editor
- [ ] Modal открывается и закрывается корректно
- [ ] All form fields are rendered correctly
- [ ] Validation works (required fields, date order, quantity > 0)
- [ ] Save works (PATCH request, toast success)
- [ ] Delete works (confirm dialog, DELETE request, toast success)
- [ ] Tabs (Основное / Материалы / Документация) работают
- [ ] SelectTaskMaterials modal открывается из Материалы tab
- [ ] SelectActTemplate modal открывается из Основное tab
- [ ] Split task button works → SplitTaskDialog opens

### Split Task Dialog
- [ ] Dialog открывается и закрывается корректно
- [ ] Timeline slider работает (select split date)
- [ ] Quantity inputs show red border if sum != original
- [ ] "Distribute equally" button fills 50/50
- [ ] Checkboxes для copy options работают
- [ ] Validation: split date must be inside range
- [ ] Validation: sum of quantities must equal original
- [ ] Submit works (POST request, Gantt refreshes)
- [ ] Error handling: validation errors shown inline

### Acts & Export
- [ ] Acts list loaded и отображается на 768px, 1024px
- [ ] Filters work (date, status, template)
- [ ] Search works (by act number)
- [ ] "Generate acts" button works → confirm dialog → progress → list refreshes
- [ ] Export buttons work (PDF, Excel, CSV options)
- [ ] Export form appears, fillable, validation works
- [ ] File downloads successfully
- [ ] Delete works (confirm, DELETE request, toast success)
- [ ] Empty state и loading skeleton видны

### General
- [ ] Lighthouse: Performance > 80, Accessibility > 90 на 768px
- [ ] Responsive: 480px, 768px, 1024px тестированы
- [ ] Keyboard navigation: Tab, Enter, Escape работают
- [ ] Touch: drag-to-scroll, modal interactions работают на touchscreen
- [ ] WCAG 2.1 AA: color contrast, screen reader friendly
- [ ] Все интерактивные элементы, включая gantt toolbar, modal actions и export controls, соответствуют правилу hit area `44x44px+`
- [ ] Визуальные значения экранов берутся из Design System; hardcoded visual values в tablet UI отсутствуют
- [ ] No console errors, no warnings (except third-party)

---

## 8. Зависимости от API, Данных, Компонентов

### API endpoints
- `GET /api/schedules/:id` — получить график
- `GET /api/schedules/:id/schedule-tasks` — задачи
- `PATCH /api/schedule-tasks/:id` — обновить задачу
- `DELETE /api/schedule-tasks/:id` — удалить
- `POST /api/schedule-tasks/:id/split` — разделить
- `GET /api/schedule-tasks/:id/split-siblings` — захватки
- `GET /api/schedule-tasks/:id/materials` — материалы
- `PUT /api/schedule-tasks/:id/materials` — обновить материалы
- `POST /api/schedules/:id/generate-acts` — генерировать акты
- `POST /api/schedules/:id/bootstrap-from-works` — создать из ВОР
- `GET /api/act-templates` — шаблоны актов
- `GET /api/acts` — список актов
- `DELETE /api/acts/:id` — удалить акт
- `POST /api/acts/:id/export` — экспорт (PDF, Excel, CSV)
- `GET /api/objects/:objectId/materials` — материалы проекта (для SelectTaskMaterials)
- `GET /api/documents` — документы (для SelectActTemplate, если нужны)

### Libraries & Tools
- **Gantt library**: react-gantt-chart, framer-motion для zoom/pan animations (или custom SVG/Canvas)
- **Date picker**: date-fns, react-datepicker или shadcn/ui Calendar
- **Excel/PDF export**: xlsx.js, pdfmake
- **UI components**: shadcn/ui (Dialog, Sheet, Input, Select, Checkbox, etc.)
- **Icons**: lucide-react

### Custom components
- **GanttChart**: main Gantt visualization
- **TaskEditor**: modal с tabs и форма
- **SplitTaskDialog**: modal для split task
- **SelectTaskMaterials**: modal для выбора материалов (multi-select)
- **SelectActTemplate**: modal для выбора шаблона (single-select)
- **ExportActsForm**: modal для экспорта с заполнением реквизитов

### Custom hooks
- `useSchedules()` — получение графика
- `useScheduleTasks()` — задачи
- `useUpdateTask()` — PATCH task
- `useSplitTask()` — POST split
- `useActs()` — список актов
- `useGenerateActs()` — POST generate
- `useExportActs()` — POST export
- `useToast()` — уведомления
- `useMobile()` — media query

### Data structures
```typescript
interface ScheduleTask {
  id: number;
  scheduleId: number;
  code: string;
  description: string;
  startDate: string; // ISO date
  endDate: string;
  durationDays: number; // computed
  quantity: number;
  orderIndex: number;
  status: 'not_started' | 'in_progress' | 'completed' | 'delayed';
  actNumber: string;
  actTemplateId: number;
  projectDrawings?: string;
  normativeRefs?: string;
  executiveSchemes?: string;
  splitGroupId?: string; // UUID if split
  splitIndex?: number; // 0, 1, 2, ... if split
  independentMaterials?: boolean;
  createdAt: string;
}

interface Act {
  id: number;
  actNumber: string;
  actTemplateId: number;
  dateStart: string;
  dateEnd: string;
  status: 'draft' | 'ready' | 'error';
  worksData: any; // JSON aggregated works
  projectDrawingsAgg?: string;
  normativeRefsAgg?: string;
  executiveSchemesAgg?: string;
  createdAt: string;
}
```

---

## 9. Implementation Notes

### Gantt Library Selection
Options:
1. **react-gantt-chart** — lightweight, customizable
2. **Frappe Gantt** — feature-rich, but not React-native
3. **Custom SVG/Canvas** — full control, more work
4. **Plotly** — powerful, but heavyweight

Рекомендация: react-gantt-chart или custom SVG (для полного контроля над UX на планшете).

### Performance optimization
1. **Virtualization**: рендерить только видимые задачи (fixed height rows)
2. **Memoization**: `React.memo` для Task cards, Bar components
3. **Lazy loading**: загрузить материалы/документы по demand (при открытии task editor)
4. **Pagination**: для Acts, если > 50 items

### Testing checklist
- [ ] Gantt with 10, 100, 500, 1000 tasks
- [ ] Zoom & pan performance
- [ ] Task editor form validation
- [ ] Split task edge cases (quantities, dates)
- [ ] Material selection multi-select
- [ ] Act generation and export
- [ ] Responsive: 480px, 768px, 1024px
- [ ] Keyboard & touch interactions
- [ ] Lighthouse audit

### Known Limitations & Future work
- **Not planned**: undo/redo, version history, collaborative editing
- **Consider later**: Gantt export (as image), task dependencies (Gantt lines), resource allocation, capacity planning

---

## Примечания для разработчика

**Приоритет реализации:**
1. **High**: Gantt rendering + basic task editor
2. **High**: Task editor form, save/delete
3. **Medium**: Split task dialog
4. **Medium**: Material/Template selection modals
5. **Low**: Acts export form, advanced Gantt features (zoom, pan)

**Рекомендуемый подход:**
1. Выбрать Gantt library (или write custom if needed)
2. Прототипировать Gantt на 768px, 1024px
3. Реализовать task editor modal
4. Добавить split task, modals
5. Реализовать Acts list и export
6. Performance audit (Lighthouse, React Profiler)
7. Accessibility audit (keyboard, screen reader)
8. Device testing (iPad, Galaxy Tab if available)

