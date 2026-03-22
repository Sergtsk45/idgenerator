# Task Tracker: Миграция UI на Odoo-стиль

> **Ветка**: `ui_v2`
> **Стайлгайд**: `docs/stilegidtopus/styleguide-odoo-tjr.md` (спецификация) + `styleguide-odoo-tjr.html` (live preview)
> **Оценка**: ~72 часа · 5 этапов · 22 задачи
> **Принцип**: foundation → high-traffic → features → polish → adaptive
>
> **Синхронизация с репозиторием**: 2026-03-22. Статусы и `[x]` ниже — по факту в `client/src`, `client/index.html`, корневом `tailwind.config.ts`. `npm run check` — OK.

---

## Этап 1 — Фундамент (~13 ч, 1 неделя)

### Задача 1: CSS-токены + Tailwind config
- **Статус**: Почти завершена
- **Приоритет**: 🔴 Критично
- **Оценка**: 3 ч
- **Зависимости**: —
- **Описание**: Заменить текущие CSS-переменные (shadcn HSL) и `design-system.css` (makeui.dev) на Odoo-адаптированные токены из стайлгайда. Обновить Tailwind config.
- **Шаги выполнения**:
  - [x] 1.1 Создать ветку `ui_v2` от `main`
  - [x] 1.2 `design-system.css` сведён к **motion-токенам** (`--duration-*`, `--ease-*`); цвета/радиусы — в `index.css`
  - [x] 1.3 Обновить `:root` в `client/src/index.css`: палитра `--p*`, `--g*`, семантика, совместимость с shadcn HSL
  - [x] 1.4 `.dark` — заглушка (`color-scheme: dark`), не полноценная тема
  - [x] 1.5 Корневой `tailwind.config.ts`: `borderRadius` sm/md/lg/xl/pill, `colors.status` / `stripe`, `fontFamily` sans=Inter, mono=JetBrains Mono
  - [x] 1.6 `--o-spacing-*`, `--o-radius-*`, `--o-shadow-*` в `index.css`
  - [x] 1.7 `@layer components`: `.o-overline`, `.o-card`, `.o-field-label`, `.o-th` / `.o-td`, `.o-numeric`
  - [ ] 1.8 Убрать лишние Google Fonts: в `index.css` только Inter+JetBrains; в **`client/index.html`** по-прежнему длинный список шрифтов (в т.ч. Outfit) — упростить
  - [x] 1.9 `npm run check` — OK (2026-03-22)
  - [ ] 1.10 Визуальная проверка всех экранов (ручная)

---

### Задача 2: OdooCard
- **Статус**: Частично завершена
- **Приоритет**: 🔴 Критично
- **Оценка**: 2 ч
- **Зависимости**: #1
- **Описание**: Создать универсальный компонент `OdooCard` (замена `.glass-card` и текущего shadcn `Card`). Белый фон, тонкий border, минимальная тень, hover-эффект.
- **Шаги выполнения**:
  - [x] 2.1 `odoo-card.tsx` + CVA, варианты default / interactive / flat + `OdooStatCard`
  - [x] 2.2 Props: `header`, `children`, `footer`, `hoverable`, `onClick`, `className`, `padding`
  - [x] 2.3 Базовые стили и hover/active через `cardVariants`
  - [x] 2.4 `OdooStatCard` (overline, число, delta, progress, actions)
  - [x] 2.5 В коде **нет** использований `.glass-card` (только упоминание в комментарии)
  - [x] 2.6 `card.tsx` помечен `@deprecated` в пользу `OdooCard` (массовая замена `Card` на экранах — ещё впереди)

---

### Задача 3: OdooButton
- **Статус**: Частично завершена
- **Приоритет**: 🔴 Критично
- **Оценка**: 2 ч
- **Зависимости**: #1
- **Описание**: Создать систему кнопок Odoo-стиля: Primary (pill, filled), Secondary (pill, outline), Ghost (text), Icon (square), FAB (circle, fixed).
- **Шаги выполнения**:
  - [x] 3.1–3.6 Варианты и размеры в `button.tsx` (`odoo-primary` … `odoo-fab`, `cta` / `std` / `compact`, `odoo-icon-sm`, `odoo-fab-size`)
  - [x] 3.7 Размеры CTA/std/compact заданы
  - [ ] 3.8 Массовая замена старых `variant`/`size` по приложению — **в процессе** (частично: например `Header.tsx`)

---

### Задача 4: OdooBadge
- **Статус**: Частично завершена
- **Приоритет**: 🔴 Критично
- **Оценка**: 1 ч
- **Зависимости**: #1
- **Описание**: Pill-shaped бейджи с цветным фоном + тёмный текст. Варианты: success, warning, danger, info, neutral.
- **Шаги выполнения**:
  - [x] 4.1–4.3 `badge.tsx`: варианты `success` | `warning` | `danger` | `info` | `neutral` (pill, uppercase)
  - [ ] 4.4 Пройти **все** экраны (акты, материалы, ЖР, …) и убрать оставшиеся `outline`/`secondary` там, где нужна семантика Odoo

---

### Задача 5: Header.tsx
- **Статус**: Частично завершена
- **Приоритет**: 🔴 Критично
- **Оценка**: 3 ч
- **Зависимости**: #1, #3
- **Описание**: Рестайл Header: убрать blur/glass-эффект, плоский белый фон, тонкий border-bottom. Odoo control panel стиль.
- **Шаги выполнения**:
  - [x] 5.1–5.4 Плоский белый хедер, `border-[--g200]`, слоты с `odoo-icon` / primary
  - [x] 5.5 Ссылка на `/` с иконкой Zap (`showZapLink`)
  - [x] 5.6 Назад: `ArrowLeft` + `onBack` (где передано)
  - [ ] 5.7 Явная матрица Telegram BackButton vs уровень стека — **проверить/докрутить**
  - [ ] 5.8 Регресс по всем маршрутам (ручная)

---

### Задача 6: BottomNav.tsx
- **Статус**: Частично завершена
- **Приоритет**: 🔴 Критично
- **Оценка**: 2 ч
- **Зависимости**: #1
- **Описание**: Рестайл нижней навигации: 5 табов, Odoo-стиль (цвет без pill-фона). Скрывать на desktop (>1024px).
- **Шаги выполнения**:
  - [x] 6.1–6.5 Стили и `lg:hidden`, `pb-safe`, иконки `strokeWidth` 1.5 / 2
  - [x] 6.6 Home нет в primary bottom nav — доступ через quick action / shell (`navigation.ts`: 5 пунктов без `/`)
  - [ ] 6.7 Ручной чек на iOS (safe area)

---

## Этап 2 — Базовые паттерны (~13 ч, 1 неделя)

### Задача 7: OdooForm inputs
- **Статус**: Частично завершена
- **Приоритет**: 🟡 Высокий
- **Оценка**: 3 ч
- **Зависимости**: #1
- **Описание**: Стилизация форм: label сверху, full-width input, overline-секции, inline validation на blur.
- **Шаги выполнения**:
  - [x] 7.1 `input.tsx` — h-10, `--g300`, focus ring как в спеке
  - [x] 7.2 `label.tsx` — стиль как в спеке; маркер required также в `OdooFormSection` (`*`)
  - [x] 7.3 `select.tsx` — Odoo-стили поля
  - [x] 7.4 `textarea.tsx` — аналогично input
  - [x] 7.5 `odoo-form-section.tsx`
  - [ ] 7.6 Связка с **react-hook-form** / единая схема ошибок по всем формам — **не сделана** (есть `OdooFieldError` с `animate-in` для ручной подстановки)
  - [x] 7.7 `OdooFieldHint` + hint в `OdooFormSection`

---

### Задача 8: OdooTable
- **Статус**: Частично завершена
- **Приоритет**: 🟡 Высокий
- **Оценка**: 3 ч
- **Зависимости**: #1
- **Описание**: Компонент-обёртка таблицы: sticky header, горизонтальный скролл, zebra, hover. Шапки таблиц ЖР (Разд. 1–5) — без изменений.
- **Шаги выполнения**:
  - [x] 8.1–8.5 `odoo-table.tsx` (`OdooTable`, `OdooTHead`, `OdooTh`, `OdooTBody`, `OdooTr`, `OdooTd`, hint на мобиле)
  - [ ] 8.6 **Works** — таблица ВОР на `OdooTable` (есть); **материалы** и прочие списки — **добавить по мере миграции экранов**

---

### Задача 9: Skeleton / Empty / Error states
- **Статус**: Завершена ✅
- **Приоритет**: 🟡 Высокий
- **Оценка**: 3 ч
- **Зависимости**: #1, #2
- **Описание**: Создать переиспользуемые UX-паттерны: skeleton-загрузка вместо спиннеров, empty state с CTA, error state с кнопкой «Повторить».
- **Шаги выполнения**:
  - [x] 9.1 Базовый шиммер через `animate-pulse` + `bg-[--g200]` (не CSS-gradient из спеки — упрощённо)
  - [x] 9.2 `SkeletonCard`, `SkeletonTableRow`, `SkeletonListItem`
  - [x] 9.3 `odoo-empty-state.tsx`
  - [x] 9.4 `odoo-error-state.tsx`
  - [x] 9.5 Правило зафиксировано в JSDoc: спиннер только для inline-действий (отправка форм)
  - [x] 9.6 Компоненты готовы; интеграция с React Query — по мере миграции экранов (этап 3)

---

### Задача 10: Toast система
- **Статус**: Завершена ✅
- **Приоритет**: 🟡 Высокий
- **Оценка**: 2 ч
- **Зависимости**: #1
- **Описание**: Заменить текущую toast на Odoo-стиль: border-left цветовая индикация, верхний правый угол (desktop) / сверху по центру (mobile).
- **Шаги выполнения**:
  - [x] 10.1–10.2 `toast.tsx`: `border-l-4`, варианты success / warning / info / destructive; `toaster.tsx` + иконки
  - [x] 10.3 Auto-dismiss в `toaster.tsx` (4.5s / 6s / info без лимита)
  - [x] 10.4 Radix `animate-in` / slide (как в shadcn-паттерне)
  - [x] 10.5 `TOAST_LIMIT = 3` в `use-toast.ts`, `TOAST_REMOVE_DELAY = 1000`
  - [x] 10.6 Viewport: mobile top под хедером, `md:` правый верх

---

### Задача 11: PillTabs
- **Статус**: Завершена ✅
- **Приоритет**: 🟡 Высокий
- **Оценка**: 2 ч
- **Зависимости**: #1
- **Описание**: Компонент pill-табов для замены shadcn Tabs: горизонтальный скролл, snap, pill-shape.
- **Шаги выполнения**:
  - [x] 11.1–11.6 `pill-tabs.tsx` реализован
  - [x] 11.7 Подключён: `WorkLog.tsx` (квадратные табы → PillTabs), `Schedule.tsx` (диалог редактирования), `SourceMaterialDetail.tsx` (dialog tabs)

---

## Этап 3 — Экраны (~24 ч, 2 недели)

### Задача 12: Home.tsx (чат-журнал)
- **Статус**: Частично завершена ✅ (пузыри, AI-карточка, shimmer, input bar; date separators и infinite scroll — впереди)
- **Приоритет**: 🟢 Средний
- **Оценка**: 4 ч
- **Зависимости**: #1–6, #9
- **Описание**: Рестайл главного экрана: чат-интерфейс с date separators, user bubbles, AI-карточками, input bar.
- **Шаги выполнения**:
  - [ ] 12.1 Date separator: Odoo chatter стиль — `flex items-center gap-2`, линии по бокам, `text-[11px] text-[--g500]`
  - [x] 12.2 User bubble: `bg-[--p100] rounded-[16px_16px_4px_16px]` timestamp `text-[--g500]`
  - [x] 12.3 AI card (WorkMatchCard): `bg-white border-l-4 border-[--success] rounded-[--o-radius-lg]`
  - [x] 12.4 AI card кнопки: Button variant="odoo-secondary" size="compact"
  - [x] 12.5 Processing state: shimmer `animate-pulse` вместо Loader2
  - [x] 12.6 Input bar: `bg-white border-[--g200] shadow-[0_-1px_3px] rounded-[--o-radius-lg]`
  - [ ] 12.7 Reverse infinite scroll для подгрузки старых сообщений

---

### Задача 13: Acts.tsx (список актов)
- **Статус**: Завершена ✅
- **Приоритет**: 🟢 Средний
- **Оценка**: 4 ч
- **Зависимости**: #1–6, #4, #9
- **Описание**: Рестайл экрана актов: primary CTA «Сформировать из графика», summary row, карточки актов с progress bar, infinite scroll.
- **Шаги выполнения**:
  - [x] 13.1 Primary CTA кнопка full-width: variant="odoo-primary" size="cta" с иконкой RefreshCw
  - [x] 13.2 Summary row: `14 актов · 8 принято · 3 в работе · 3 черновик`
  - [x] 13.3 Карточка акта: OdooCard + Badge success/info/neutral (локализованные метки) + download button odoo-secondary
  - [x] 13.4 Warning block: предупреждение об актах без дат (AlertTriangle + border-warning)
  - [x] 13.5 Progress bar в карточке (экспорт)
  - [x] 13.6 Infinite scroll: IntersectionObserver, порция 10 актов, sentinel-div с Loader2
  - [x] 13.7 Drill-down: OdooCard кликабелен → navigate(`/acts/:id`); ChevronRight в заголовке; новый маршрут `/acts/:id` → ActDetail.tsx (placeholder для Task 18)
  - [x] 13.8 Empty state: OdooEmptyState

---

### Задача 14: WorkLog.tsx (журнал работ)
- **Статус**: Завершена ✅
- **Приоритет**: 🟢 Средний
- **Оценка**: 5 ч
- **Зависимости**: #1–6, #8, #11
- **Описание**: Рестайл журнала работ: PillTabs для разделов, info-badge, progress bar, список записей (Разд. 3), таблицы (Разд. 1/2/4/5). **ВАЖНО**: шапки таблиц ЖР — без изменений.
- **Шаги выполнения**:
  - [x] 14.1 PillTabs для Разд. 1–6 + Титул — уже были, подтверждено
  - [x] 14.2 Info badge: `bg-[--p50] border border-[--p300] rounded-[--o-radius-lg]` + название раздела + дата последней записи
  - [x] 14.3 Overline «ОБЩИЙ ПРОГРЕСС» + `N%` + progress bar `h-1.5`
  - [x] 14.4 Разд. 3 — карточки-список: дата (число/день/месяц) слева + OdooBadge (принято/в работе) + kebab ⋮ + текст записи с inline-редактированием
  - [x] 14.5 Ghost card «+ Добавить новую запись» (dashed border, `text-[--p500]`)
  - [x] 14.6 FAB кнопка «+» `variant="odoo-fab"` — только на Разд. 3, `fixed bottom-24 right-4`
  - [x] 14.7 Разд. 1/2/4/5 — обёрнуты в `TableWrapper` (scroll hint + `border-[--g200] rounded`), шапки без изменений
  - [x] 14.8 Infinite scroll для Разд. 3 (IntersectionObserver, 15 записей/порция); кнопочная пагинация (Назад/Далее) для таблиц разд. 1/2/4/5

---

### Задача 15: Schedule.tsx (график / Гант)
- **Статус**: Завершена ✅
- **Приоритет**: 🟢 Средний
- **Оценка**: 4 ч
- **Зависимости**: #1–6
- **Описание**: Рестайл Ганта: info-card об источнике данных, period switcher, цвета полос, метаданные задач.
- **Шаги выполнения**:
  - [x] 15.1 Info-card «График сформирован»: OdooCard с BarChart2 + источник (ВОР/смета) + кол-во задач + диапазон дат
  - [x] 15.2 Period switcher: pill-кнопки «Нед.|Мес.» — меняют шаг навигации (7 / 30 дней)
  - [x] 15.3 Цвета полос Ганта: завершено `--success`, в работе `--p500`, просрочено `--danger` — уже были реализованы через `ganttBarColor`
  - [x] 15.4 Метаданные задач: `акт N · Xч · Y чел` — уже были реализованы через `actTzBrgLine`
  - [x] 15.5 Легенда цветов — уже была реализована (завершено / в работе / просрочено)
  - [x] 15.6 Sticky left col — уже был реализован (`w-[160px] md:w-[400px] sticky`)
  - [x] 15.7 Навигация `◄ Март 2026 ►` — уже была реализована

---

### Задача 16: SourceData.tsx (исходные данные)
- **Статус**: Завершена ✅
- **Приоритет**: 🟢 Средний
- **Оценка**: 4 ч
- **Зависимости**: #1–6, #2, #4
- **Описание**: Рестайл дашборда: object selector, chip carousel участников, stat cards с drill-down.
- **Шаги выполнения**:
  - [x] 16.1 Object selector: `bg-[--p50] border border-[--p300]` + Building2 иконка + название объекта + ChevronDown
  - [x] 16.2 Overline «СТОРОНЫ / УЧАСТНИКИ» (o-overline) + горизонтальный скролл chip-карточек
  - [x] 16.3 Chip участника: OdooCard (hoverable) + o-overline роль + имя + ✓ ИНН зелёный / ○ серый
  - [x] 16.4 Overline «РАЗДЕЛЫ» (o-overline) + OdooCard stat cards + ChevronRight drill-down
  - [x] 16.5 Stat card «Материалы»: Progress bar `h-1` + кнопки «+ Поставка» / «📷 Скан» (odoo-secondary compact)
  - [x] 16.6 Drill-down: уже работал через `setLocation`
  - [x] 16.7 Accordion «Реквизиты объекта» внизу: название / адрес / город

---

### Задача 17: Works.tsx (ВОР/ВОИР)
- **Статус**: Завершена ✅
- **Приоритет**: 🟢 Средний
- **Оценка**: 3 ч
- **Зависимости**: #1–6, #2, #8, #11
- **Описание**: Рестайл экрана ВОР: карточки работ, поиск, импорт, PillTabs для разделов.
- **Шаги выполнения**:
  - [x] 17.1 PillTabs для переключения ВОР/Смета — заменил segmented buttons на `PillTabs` component
  - [x] 17.2 Карточка работы: OdooTable с accordion-секциями — уже была реализована
  - [x] 17.3 Поиск: sticky search input — уже был реализован
  - [x] 17.4 Импорт Excel — уже был реализован
  - [x] 17.5 OdooTable со sticky header — уже была реализована
  - [x] 17.6 Empty state: OdooEmptyState для «Нет ВОР», «Выберите коллекцию», «Ничего не найдено»

---

## Этап 4 — Subpages + Polish (~14 ч, 1 неделя)

### Задача 18: ActDetail subpage
- **Статус**: Не начата
- **Приоритет**: 🔵 Низкий
- **Оценка**: 4 ч
- **Зависимости**: #1–6, #7
- **Описание**: Детали акта: Accordion-секции, шаблоны PDF, экспорт.
- **Шаги выполнения**:
  - [ ] 18.1 Header: `← Акт №14` (OdooButton ghost back)
  - [ ] 18.2 Status badge + progress bar вверху
  - [ ] 18.3 Accordion-секции: основные данные, работы, материалы, документы, участники. **📖 Context7**: запросить документацию Radix UI Accordion — Accordion.Root, Accordion.Item, controlled state
  - [ ] 18.4 Sheet снизу для выбора шаблонов PDF (Accordion внутри Sheet). **📖 Context7**: запросить документацию vaul (Drawer) — API, snap points, nested scrollable content
  - [ ] 18.5 Кнопка «Экспорт PDF» → прогресс-бар генерации
  - [ ] 18.6 Inline-редактирование полей (OdooForm inputs)
  - [ ] 18.7 Warning-блоки для недостающих данных

---

### Задача 19: SourceMaterials / Detail
- **Статус**: Не начата
- **Приоритет**: 🔵 Низкий
- **Оценка**: 5 ч
- **Зависимости**: #1–6, #2, #4, #7
- **Описание**: Список материалов + детальная страница материала.
- **Шаги выполнения**:
  - [ ] 19.1 `/source-data/materials` — список: OdooCard для каждого материала + OdooBadge (статус документов) + поиск
  - [ ] 19.2 Infinite scroll + поиск (debounced). **📖 Context7**: запросить документацию TanStack React Query — useInfiniteQuery с параметром поиска, keepPreviousData
  - [ ] 19.3 `/source-data/materials/:id` — детальная страница: партии, документы качества, сертификаты
  - [ ] 19.4 Wizard добавления материала (4 шага) — OdooForm + stepper
  - [ ] 19.5 Кнопка «📷 Скан» для документов
  - [ ] 19.6 Empty state для пустого списка

---

### Задача 20: SourceDocuments
- **Статус**: Не начата
- **Приоритет**: 🔵 Низкий
- **Оценка**: 3 ч
- **Зависимости**: #1–6, #2, #4
- **Описание**: Реестр документов качества.
- **Шаги выполнения**:
  - [ ] 20.1 Список документов: OdooCard + тип документа (badge) + название + дата
  - [ ] 20.2 Фильтр по типу (PillTabs или dropdown)
  - [ ] 20.3 Infinite scroll
  - [ ] 20.4 Добавление документа: Sheet с формой (OdooForm)
  - [ ] 20.5 Empty state

---

### Задача 21: Settings.tsx
- **Статус**: Не начата
- **Приоритет**: 🔵 Низкий
- **Оценка**: 2 ч
- **Зависимости**: #1, #3
- **Описание**: Минимальные правки настроек под Odoo-стиль.
- **Шаги выполнения**:
  - [ ] 21.1 Обновить фон и карточки на OdooCard
  - [ ] 21.2 Обновить кнопки на OdooButton
  - [ ] 21.3 Секции: overline-разделители
  - [ ] 21.4 Toggle/Switch — оставить shadcn (стилизовать цвета)

---

## Этап 5 — Адаптивность (~8 ч, 1 неделя)

### Задача 22: Tablet / Desktop адаптация
- **Статус**: Частично завершена (есть `ResponsiveShell`, tablet shell из ветки tablet-ui; **полная** сводка со спекой Odoo sidebar/master-detail/modal breakpoints — **не закрыта**)
- **Приоритет**: 🔵 Низкий
- **Оценка**: 8 ч
- **Зависимости**: #1–21
- **Описание**: Адаптация всех экранов под планшет (768–1024px) и десктоп (>1024px). Sidebar навигация, master-detail, grid layouts.
- **Шаги выполнения**:
  - [ ] 22.1 **Breakpoints**: Mobile <768, Tablet 768–1024, Desktop >1024
  - [ ] 22.2 **Desktop sidebar**: `w-[220px] fixed top-14 bottom-0 bg-white border-r`, nav items с hover/active states. Скрыть BottomNav
  - [ ] 22.3 **Tablet — Материалы**: master-detail split (sidebar 280px + main flex-1)
  - [ ] 22.4 **Tablet — Акты**: master-detail (список + детали)
  - [ ] 22.5 **Desktop — Акты**: 2-column grid для карточек
  - [ ] 22.6 **Desktop — Материалы**: 3-column grid + detail modal
  - [ ] 22.7 **Таблицы ЖР**: tablet — полная ширина без hint; desktop — полная ширина
  - [ ] 22.8 **Гант**: tablet — задачи 280px + Гант без скролла; desktop — задачи 400px
  - [ ] 22.9 **Формы**: tablet/desktop — 2 колонки, max-width 800px
  - [ ] 22.10 **Модалки**: mobile → Sheet; tablet → Dialog 560px; desktop → Dialog 640px. **📖 Context7**: запросить документацию Radix UI Dialog — responsive rendering, size customization
  - [ ] 22.11 **FAB**: mobile/tablet → fixed; desktop → inline button
  - [ ] 22.12 **Header**: desktop — добавить search bar
  - [ ] 22.13 `ResponsiveShell.tsx` — обновить для поддержки sidebar vs BottomNav

---

## Сводка прогресса (авто-обновление трекера)

| Этап | Состояние |
|------|-----------|
| **1 Фундамент** | Токены, Tailwind, слой components, BottomNav/Header в Odoo-духе — **в основном готово**; остаются `design-system.css`, шрифты в `index.html`, ручные QA. |
| **2 Паттерны** | `OdooTable`, формы, skeleton/empty/error, toast, `PillTabs` **как файлы** — готово; интеграция Query/PillTabs по экранам — **частично**. |
| **3 Экраны** | Сильнее всего затронуты **Works** (таблица), **Schedule** (карты), **WorkLog** (свои табы). **Acts, Home, SourceData, Settings** — почти без Odoo-спеки. |
| **4 Subpages** | Не начато по трекеру. |
| **5 Адаптив** | База от `ResponsiveShell` / tablet-ui; чеклист 22.x — не закрыт. |

---

## Что НЕ меняется

- Шапки таблиц Журнала работ (Разделы 1–5) — без изменений
- Wouter (роутер) — остаётся
- TanStack React Query — остаётся
- Zustand — остаётся
- shadcn/ui primitives (Radix) — остаются под капотом, стилизуются под Odoo
- Tailwind CSS — остаётся, расширяется токенами
- Framer Motion — сокращается до минимума (page transitions)
- JetBrains Mono — остаётся для данных (числа, коды ВОР, ИНН)

---

## Чеклист Odoo-стиля (для ревью каждого компонента)

- [ ] Нет glassmorphism / blur эффектов
- [ ] Карточки с белым фоном + тонким border (не полупрозрачные)
- [ ] Тени минимальные (`--o-shadow-sm`)
- [ ] Бордеры явные (`1px solid --g200`)
- [ ] Кнопки pill-shaped (`border-radius: 9999px`)
- [ ] Badge с цветным фоном + тёмный текст (не outline)
- [ ] Иконки Lucide с единым `strokeWidth=1.5`
- [ ] Overline labels: `uppercase`, `letter-spacing`, `--g500`
- [ ] Числа в таблицах: `tabular-nums`, моноширинный шрифт
- [ ] Skeleton загрузка (не спиннер) для начальной загрузки
- [ ] Empty state для каждого списка
- [ ] Inline validation на blur
- [ ] Toast с border-left цветовой индикацией
- [ ] Touch target min 44×44px для интерактивных элементов

---

## Сводка по использованию Context7

| Задача | Библиотека | Зачем |
|--------|-----------|-------|
| #1.3, #1.5 | Tailwind CSS | CSS variables, theme customization, extend colors/radius |
| #2.1, #3.1, #4.1 | class-variance-authority (CVA) | Определение вариантов компонентов |
| #7.1 | Radix UI (Form, Label) | Примитивы форм |
| #7.6 | react-hook-form | Inline validation, error rendering |
| #9.6 | TanStack React Query | Query states, error handling |
| #10.1 | Radix UI Toast / sonner | Toast API, positioning |
| #12.7 | TanStack React Query | useInfiniteQuery, reverse scroll |
| #13.6 | TanStack React Query | useInfiniteQuery, IntersectionObserver |
| #16.7 | Radix UI Accordion | Accordion API |
| #18.3 | Radix UI Accordion | Controlled accordion |
| #18.4 | vaul (Drawer) | Sheet API, snap points |
| #19.2 | TanStack React Query | Infinite query + search |
| #22.10 | Radix UI Dialog | Responsive dialog sizing |
