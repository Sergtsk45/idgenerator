# Task Tracker: Миграция UI на Odoo-стиль

> **Ветка**: `feature/tablet-ui-v2`
> **Стайлгайд**: `docs/stilegidtopus/styleguide-odoo-tjr.md` (спецификация) + `styleguide-odoo-tjr.html` (live preview)
> **Оценка**: ~72 часа · 5 этапов · 22 задачи
> **Принцип**: foundation → high-traffic → features → polish → adaptive
>
> **Remote**: все коммиты этой ветки пушить в `clean-origin` → `git@github.com:Sergtsk45/idgenerator.git`
> ```bash
> git push clean-origin feature/tablet-ui-v2
> ```

---

## Этап 1 — Фундамент (~13 ч, 1 неделя)

### Задача 1: CSS-токены + Tailwind config
- **Статус**: Завершена ✅
- **Приоритет**: 🔴 Критично
- **Оценка**: 3 ч
- **Зависимости**: —
- **Описание**: Заменить текущие CSS-переменные (shadcn HSL) и `design-system.css` (makeui.dev) на Odoo-адаптированные токены из стайлгайда. Обновить Tailwind config.
- **Шаги выполнения**:
  - [x] 1.1 Создать ветку `ui_v2` от `main` _(работаем в `feature/tablet-ui-v2`)_
  - [x] 1.2 Заменить `client/src/design-system.css` — оставлены только motion-токены (`--duration-*`, `--ease-*`)
  - [x] 1.3 Обновить `:root` в `client/src/index.css`: Odoo-палитра (`--p50`–`--p900`, `--g50`–`--g900`), семантические цвета, поверхностная система
  - [x] 1.4 `.dark` тема — оставлена минимальная заглушка `color-scheme: dark`
  - [x] 1.5 Обновить `tailwind.config.ts`: `borderRadius` (sm 4px, md 8px, lg 12px, xl 16px, pill 9999px), `fontFamily` (убран Outfit), `colors` (status + stripe)
  - [x] 1.6 CSS-переменные `--o-spacing-*`, `--o-radius-*`, `--o-shadow-*` добавлены в index.css
  - [x] 1.7 Утилитарные классы добавлены в `@layer components`: `.o-card`, `.o-overline`, `.o-field-label`, `.o-th`, `.o-td`, `.o-numeric`
  - [x] 1.8 Outfit удалён из Google Fonts импорта, оставлены Inter + JetBrains Mono
  - [x] 1.9 `npm run check` — ✅ OK, `npm run build` — ✅ OK (только chunk-size предупреждения)
  - [x] 1.10 Визуальная проверка: `npm run check` ✅, `npm run build` ✅, токены в index.css — в наличии (56 совпадений), Outfit удалён, Inter + JetBrains Mono подключены

---

### Задача 2: OdooCard
- **Статус**: Завершена ✅
- **Приоритет**: 🔴 Критично
- **Оценка**: 2 ч
- **Зависимости**: #1
- **Описание**: Создать универсальный компонент `OdooCard` (замена `.glass-card` и текущего shadcn `Card`). Белый фон, тонкий border, минимальная тень, hover-эффект.
- **Шаги выполнения**:
  - [x] 2.1 Создать `client/src/components/ui/odoo-card.tsx` с вариантами: default, stat, status (CVA)
  - [x] 2.2 Props: `header`, `footer`, `hoverable`, `onClick`, `className`, `padding`, `statusColor`
  - [x] 2.3 CSS: `bg-white border border-[--o-card-border] rounded-[--o-radius-lg] shadow-[--o-shadow-sm]`, hover → `shadow-[--o-shadow-md]`, active → `scale(0.995)`
  - [x] 2.4 Добавить `OdooStatCard` вариант (overline + large number + delta + progress bar + actions)
  - [x] 2.5 Убрать `.glass-card` из `Schedule.tsx` (3 вхождения → `OdooCard`)
  - [x] 2.6 `card.tsx` помечен `@deprecated` — использовать `OdooCard` для нового кода

---

### Задача 3: OdooButton
- **Статус**: Не начата
- **Приоритет**: 🔴 Критично
- **Оценка**: 2 ч
- **Зависимости**: #1
- **Описание**: Создать систему кнопок Odoo-стиля: Primary (pill, filled), Secondary (pill, outline), Ghost (text), Icon (square), FAB (circle, fixed).
- **Шаги выполнения**:
  - [ ] 3.1 Обновить `client/src/components/ui/button.tsx` — добавить варианты `odoo-primary`, `odoo-secondary`, `odoo-ghost`, `odoo-icon`, `odoo-fab`. **📖 Context7**: запросить документацию class-variance-authority (CVA) — buttonVariants с новыми стилями
  - [ ] 3.2 Primary: `bg-[--p500] text-white rounded-full h-9 px-5 hover:bg-[--p700]`
  - [ ] 3.3 Secondary: `bg-transparent border border-[--g300] text-[--g700] rounded-full hover:bg-[--g100]`
  - [ ] 3.4 Ghost: `bg-transparent text-[--p500] hover:bg-[--p50] rounded-[--o-radius-md]`
  - [ ] 3.5 Icon: `w-9 h-9 rounded-[--o-radius-md] bg-transparent hover:bg-[--g100]`
  - [ ] 3.6 FAB: `w-14 h-14 rounded-full bg-[--p500] text-white shadow-[--o-shadow-lg] fixed bottom-[88px] right-4`
  - [ ] 3.7 Размеры: CTA `h-12`, стандарт `h-10`, компакт `h-8`
  - [ ] 3.8 Поэтапно заменить использования старых вариантов на новые (не ломая функционал)

---

### Задача 4: OdooBadge
- **Статус**: Не начата
- **Приоритет**: 🔴 Критично
- **Оценка**: 1 ч
- **Зависимости**: #1
- **Описание**: Pill-shaped бейджи с цветным фоном + тёмный текст. Варианты: success, warning, danger, info, neutral.
- **Шаги выполнения**:
  - [ ] 4.1 Обновить `client/src/components/ui/badge.tsx` — добавить Odoo-варианты. **📖 Context7**: запросить документацию class-variance-authority (CVA) — badgeVariants
  - [ ] 4.2 Стиль: `rounded-full px-2.5 py-0.5 text-[11px] font-semibold uppercase tracking-[0.03em] border-none`
  - [ ] 4.3 success: `bg-[--success-bg] text-[--success]`, warning: `bg-[--warning-bg] text-[--warning]`, и т.д.
  - [ ] 4.4 Заменить текущие `Badge variant="outline"` на семантические Odoo-варианты в компонентах актов, материалов, ЖР

---

### Задача 5: Header.tsx
- **Статус**: Не начата
- **Приоритет**: 🔴 Критично
- **Оценка**: 3 ч
- **Зависимости**: #1, #3
- **Описание**: Рестайл Header: убрать blur/glass-эффект, плоский белый фон, тонкий border-bottom. Odoo control panel стиль.
- **Шаги выполнения**:
  - [ ] 5.1 Прочитать текущий `client/src/components/Header.tsx`, понять все props и использования
  - [ ] 5.2 Заменить стили: `bg-white border-b border-[--g200] h-14`, убрать `backdrop-blur`, `glass-*`
  - [ ] 5.3 Левая часть: `← назад` (если subpage) + title + subtitle (объект)
  - [ ] 5.4 Правая часть: action-кнопки (OdooButton icon) + avatar
  - [ ] 5.5 Добавить иконку ⚡ для перехода на Home (/)
  - [ ] 5.6 На subpages: показывать стрелку «←» + `window.history.back()`
  - [ ] 5.7 Интеграция с Telegram BackButton (показывать на уровне 1+, скрывать на уровне 0)
  - [ ] 5.8 Проверить на всех страницах: Home, Works, Schedule, Acts, WorkLog, SourceData, Settings

---

### Задача 6: BottomNav.tsx
- **Статус**: Не начата
- **Приоритет**: 🔴 Критично
- **Оценка**: 2 ч
- **Зависимости**: #1
- **Описание**: Рестайл нижней навигации: 5 табов, Odoo-стиль (цвет без pill-фона). Скрывать на desktop (>1024px).
- **Шаги выполнения**:
  - [ ] 6.1 Прочитать текущий `client/src/components/BottomNav.tsx`
  - [ ] 6.2 Обновить стили: `h-14 + safe-area, bg-white, border-t border-[--g200], shadow-[0_-1px_3px_rgba(0,0,0,0.05)]`
  - [ ] 6.3 Неактивный таб: `text-[--g500] text-[10px]`, иконки Lucide `strokeWidth=1.5`
  - [ ] 6.4 Активный таб: `text-[--p700] font-semibold`, иконки `strokeWidth=2`, **без** pill-фона
  - [ ] 6.5 Добавить `lg:hidden` (скрыть на desktop >1024px)
  - [ ] 6.6 Home (/) убрать из BottomNav (доступен через ⚡ в Header)
  - [ ] 6.7 Проверить safe-area-inset-bottom на iOS

---

## Этап 2 — Базовые паттерны (~13 ч, 1 неделя)

### Задача 7: OdooForm inputs
- **Статус**: Не начата
- **Приоритет**: 🟡 Высокий
- **Оценка**: 3 ч
- **Зависимости**: #1
- **Описание**: Стилизация форм: label сверху, full-width input, overline-секции, inline validation на blur.
- **Шаги выполнения**:
  - [ ] 7.1 Обновить `client/src/components/ui/input.tsx`: `h-10, border border-[--g300], rounded-[--o-radius-md], focus:border-[--p500] focus:ring-3 focus:ring-sky-500/10`. **📖 Context7**: запросить документацию Radix UI — Form, Label примитивы
  - [ ] 7.2 Обновить `client/src/components/ui/label.tsx`: `text-[13px] font-medium text-[--g700]`, required: `<span class="text-[--danger]">*</span>`
  - [ ] 7.3 Обновить `client/src/components/ui/select.tsx` (native select или Radix Select) под Odoo-стиль
  - [ ] 7.4 Обновить `client/src/components/ui/textarea.tsx`
  - [ ] 7.5 Создать компонент `OdooFormSection` — overline-разделитель секций (`uppercase tracking-[0.06em] text-[--g500] text-[11px] font-semibold`)
  - [ ] 7.6 Inline validation: ошибка под полем с анимацией slide-down (0.2s), красная рамка `border-[--danger]`. **📖 Context7**: запросить документацию react-hook-form — useFormContext, field validation, error rendering
  - [ ] 7.7 Hint text под полем: `text-[12px] text-[--g500]`

---

### Задача 8: OdooTable
- **Статус**: Не начата
- **Приоритет**: 🟡 Высокий
- **Оценка**: 3 ч
- **Зависимости**: #1
- **Описание**: Компонент-обёртка таблицы: sticky header, горизонтальный скролл, zebra, hover. Шапки таблиц ЖР (Разд. 1–5) — без изменений.
- **Шаги выполнения**:
  - [ ] 8.1 Создать `client/src/components/ui/odoo-table.tsx` с wrapper `overflow-x-auto -webkit-overflow-scrolling-touch border rounded-[--o-radius-lg]`
  - [ ] 8.2 `<thead>`: `sticky top-0 bg-[--g100] border-b-2 border-[--g300]`, `<th>`: `text-[12px] font-semibold uppercase tracking-[0.03em] text-[--g700] whitespace-nowrap p-2`
  - [ ] 8.3 `<tbody>`: `<td>` — `text-[13px] p-[10px_12px] border-b border-[--g200]`, zebra — `even:bg-[--g50]`, hover — `hover:bg-[--p50]`
  - [ ] 8.4 Числовые колонки: `text-right font-mono tabular-nums text-[12px]`
  - [ ] 8.5 Mobile-подсказка «← Прокрутите →» (показывать на <768px)
  - [ ] 8.6 Применить к таблицам ВОР, материалов (НЕ к таблицам ЖР Разд. 1/2/4/5 — оставить как есть)

---

### Задача 9: Skeleton / Empty / Error states
- **Статус**: Не начата
- **Приоритет**: 🟡 Высокий
- **Оценка**: 3 ч
- **Зависимости**: #1, #2
- **Описание**: Создать переиспользуемые UX-паттерны: skeleton-загрузка вместо спиннеров, empty state с CTA, error state с кнопкой «Повторить».
- **Шаги выполнения**:
  - [ ] 9.1 Создать `client/src/components/ui/odoo-skeleton.tsx`: shimmer-анимация `linear-gradient(90deg, --g200 25%, --g100 50%, --g200 75%)`, `background-size: 200%`, `animation: shimmer 1.5s infinite`
  - [ ] 9.2 Варианты скелетонов: `SkeletonCard` (повторяет OdooCard), `SkeletonTableRow`, `SkeletonListItem`
  - [ ] 9.3 Создать `client/src/components/ui/odoo-empty-state.tsx`: иконка 48px + заголовок 16px + подсказка 13px + CTA-кнопка
  - [ ] 9.4 Создать `client/src/components/ui/odoo-error-state.tsx`: иконка ⚠ + «Не удалось загрузить» + «Повторить ↻»
  - [ ] 9.5 Правила: skeleton 3–5 элементов, повторяет структуру контента; спиннер — только для inline-действий (отправка формы)
  - [ ] 9.6 Интеграция с TanStack Query: `isLoading` → skeleton, `isError` → error state, `data.length === 0` → empty state. **📖 Context7**: запросить документацию TanStack React Query — query states (isLoading, isError, data), error handling patterns

---

### Задача 10: Toast система
- **Статус**: Не начата
- **Приоритет**: 🟡 Высокий
- **Оценка**: 2 ч
- **Зависимости**: #1
- **Описание**: Заменить текущую toast на Odoo-стиль: border-left цветовая индикация, верхний правый угол (desktop) / сверху по центру (mobile).
- **Шаги выполнения**:
  - [ ] 10.1 Обновить `client/src/components/ui/toaster.tsx` — новые стили. **📖 Context7**: запросить документацию Radix UI Toast или sonner — API, positioning, auto-dismiss
  - [ ] 10.2 Варианты: success (`border-l-4 border-l-[--success] bg-[--success-bg]`), error, warning, info
  - [ ] 10.3 Auto-dismiss: success/warning 4–5 сек, error 6 сек, info (процесс) — без auto-dismiss
  - [ ] 10.4 Анимация: `translateY(-12px) → 0, opacity 0 → 1` (0.3s)
  - [ ] 10.5 Максимум 3 toast одновременно, stack с gap 8px
  - [ ] 10.6 Mobile: full-width под Header; desktop: правый верхний угол

---

### Задача 11: PillTabs
- **Статус**: Не начата
- **Приоритет**: 🟡 Высокий
- **Оценка**: 2 ч
- **Зависимости**: #1
- **Описание**: Компонент pill-табов для замены shadcn Tabs: горизонтальный скролл, snap, pill-shape.
- **Шаги выполнения**:
  - [ ] 11.1 Создать `client/src/components/ui/pill-tabs.tsx`: контейнер `flex gap-2 overflow-x-auto scrollbar-hide scroll-snap-x`
  - [ ] 11.2 Неактивный таб: `bg-transparent border border-[--g300] text-[--g700] rounded-full px-4 py-1.5 text-[13px] whitespace-nowrap`
  - [ ] 11.3 Активный таб: `bg-[--p500] text-white border-[--p500] font-semibold`
  - [ ] 11.4 Hover (неактивный): `bg-[--g100]`
  - [ ] 11.5 Props: `tabs: { label, value }[]`, `activeTab`, `onTabChange`
  - [ ] 11.6 Scroll-snap: `scroll-snap-align: start` на каждом табе
  - [ ] 11.7 Заменить shadcn `Tabs` на `PillTabs` в WorkLog.tsx и Works.tsx

---

## Этап 3 — Экраны (~24 ч, 2 недели)

### Задача 12: Home.tsx (чат-журнал)
- **Статус**: Не начата
- **Приоритет**: 🟢 Средний
- **Оценка**: 4 ч
- **Зависимости**: #1–6, #9
- **Описание**: Рестайл главного экрана: чат-интерфейс с date separators, user bubbles, AI-карточками, input bar.
- **Шаги выполнения**:
  - [ ] 12.1 Date separator: Odoo chatter стиль — `flex items-center gap-2`, линии по бокам, `text-[11px] text-[--g500]`
  - [ ] 12.2 User bubble: `bg-[--p100] rounded-[16px_16px_4px_16px] p-[10px_14px] max-w-[85%] ml-auto`, timestamp внизу
  - [ ] 12.3 AI card (сопоставлено): `bg-white border border-[--success] border-l-4 rounded-[--o-radius-lg] p-4`; header `text-[11px] font-semibold text-[--success]`; key-value строки
  - [ ] 12.4 AI card кнопки: «Принять ✓» (OdooButton primary compact) + «Изменить ✎» (secondary compact)
  - [ ] 12.5 Processing state: shimmer-полоса + текст «⏳ Обрабатывается...»
  - [ ] 12.6 Input bar: `sticky bottom-[56px]` (над BottomNav), `bg-white border rounded-[--o-radius-lg] shadow-[--o-shadow-sm]`, input + 📎 + кнопка «Отпр»
  - [ ] 12.7 Reverse infinite scroll для подгрузки старых сообщений. **📖 Context7**: запросить документацию TanStack React Query — useInfiniteQuery, reverse infinite scroll pattern

---

### Задача 13: Acts.tsx (список актов)
- **Статус**: Не начата
- **Приоритет**: 🟢 Средний
- **Оценка**: 4 ч
- **Зависимости**: #1–6, #4, #9
- **Описание**: Рестайл экрана актов: primary CTA «Сформировать из графика», summary row, карточки актов с progress bar, infinite scroll.
- **Шаги выполнения**:
  - [ ] 13.1 Primary CTA кнопка full-width: «Сформировать / обновить из графика ↻»
  - [ ] 13.2 Summary row: `14 актов · 8 принято · 3 в работе · 3 черновик` — `text-[11px] text-[--g500]` с цветными числами
  - [ ] 13.3 Карточка акта: OdooCard + OdooBadge (статус в правом верхнем углу) + описание + progress bar + action buttons
  - [ ] 13.4 Warning block (нехватка документов): `bg-[--warning-bg] rounded-[--o-radius-md] text-[10px] text-[#713F12]`
  - [ ] 13.5 Progress bar: `h-1 bg-[--g200] rounded-full`, fill по статусу (success/primary/neutral)
  - [ ] 13.6 Infinite scroll по 10 актов. **📖 Context7**: запросить документацию TanStack React Query — useInfiniteQuery, getNextPageParam, IntersectionObserver
  - [ ] 13.7 Drill-down: нажатие → `/acts/:id` (full-page)
  - [ ] 13.8 Empty state: «Пока нет актов» + CTA «Сформировать акты»

---

### Задача 14: WorkLog.tsx (журнал работ)
- **Статус**: Не начата
- **Приоритет**: 🟢 Средний
- **Оценка**: 5 ч
- **Зависимости**: #1–6, #8, #11
- **Описание**: Рестайл журнала работ: PillTabs для разделов, info-badge, progress bar, список записей (Разд. 3), таблицы (Разд. 1/2/4/5). **ВАЖНО**: шапки таблиц ЖР — без изменений.
- **Шаги выполнения**:
  - [ ] 14.1 Заменить shadcn Tabs на PillTabs (задача #11): Разд. 1–5 + Титул
  - [ ] 14.2 Info badge: `bg-[--p50] border border-[--p300] rounded-[--o-radius-lg]` — название раздела + дата последней записи
  - [ ] 14.3 Общий прогресс: overline «ОБЩИЙ ПРОГРЕСС» + `78%` + progress bar
  - [ ] 14.4 Разд. 3 — список записей: дата (число/день/месяц) слева + OdooBadge (статус) + kebab ⋮ + текст записи
  - [ ] 14.5 Разд. 3 — ghost card «+ Добавить новую запись» (dashed border, `text-[--p500]`)
  - [ ] 14.6 Разд. 3 — FAB кнопка «+» (только на этом разделе)
  - [ ] 14.7 Разд. 1/2/4/5 — обернуть в OdooTable, **шапки без изменений**
  - [ ] 14.8 Infinite scroll для Разд. 3 (по дате), кнопочная пагинация для таблиц

---

### Задача 15: Schedule.tsx (график / Гант)
- **Статус**: Не начата
- **Приоритет**: 🟢 Средний
- **Оценка**: 4 ч
- **Зависимости**: #1–6
- **Описание**: Рестайл Ганта: info-card об источнике данных, period switcher, цвета полос, метаданные задач.
- **Шаги выполнения**:
  - [ ] 15.1 Info-card «График сформирован»: OdooCard с иконкой 📊 + дата обновления + кол-во задач
  - [ ] 15.2 Period switcher: pill-кнопки «Неделя | Месяц» (мини PillTabs)
  - [ ] 15.3 Цвета полос Ганта: завершено `bg-[--success]`, в работе `bg-[--p500]`, план `bg-[--g200]`, просрочено `bg-[--danger]`
  - [ ] 15.4 Метаданные задач: под названием — `акт N · Xч` в `text-[9px] text-[--g500]`
  - [ ] 15.5 Легенда цветов: flex-строка под Гантом
  - [ ] 15.6 Header задачи: `sticky left-0`, горизонтальный скролл для дат
  - [ ] 15.7 Навигация по месяцам: `◄ Март 2026 ►`

---

### Задача 16: SourceData.tsx (исходные данные)
- **Статус**: Не начата
- **Приоритет**: 🟢 Средний
- **Оценка**: 4 ч
- **Зависимости**: #1–6, #2, #4
- **Описание**: Рестайл дашборда: object selector, chip carousel участников, stat cards с drill-down.
- **Шаги выполнения**:
  - [ ] 16.1 Object selector: `bg-[--p50] border border-[--p300]`, иконка 🏗 + название объекта + адрес + `▾` (dropdown)
  - [ ] 16.2 Overline «СТОРОНЫ / УЧАСТНИКИ» + горизонтальный скролл chip-карточек
  - [ ] 16.3 Chip участника: `bg-white border rounded-[--o-radius-lg] p-2`, роль (font-semibold) + название + индикатор (✓ ИНН зелёный / ○ серый)
  - [ ] 16.4 Overline «РАЗДЕЛЫ» + Stat cards: иконка + название + счётчик + стрелка `›` (drill-down)
  - [ ] 16.5 Stat card «Материалы»: + progress bar + action buttons «+ Поставка» / «📷 Скан»
  - [ ] 16.6 Drill-down: нажатие → subpage (`/source-data/materials`, `/source-data/documents`)
  - [ ] 16.7 Accordion «Реквизиты объекта» внизу. **📖 Context7**: запросить документацию Radix UI Accordion — API, styling

---

### Задача 17: Works.tsx (ВОР/ВОИР)
- **Статус**: Не начата
- **Приоритет**: 🟢 Средний
- **Оценка**: 3 ч
- **Зависимости**: #1–6, #2, #8, #11
- **Описание**: Рестайл экрана ВОР: карточки работ, поиск, импорт, PillTabs для разделов.
- **Шаги выполнения**:
  - [ ] 17.1 PillTabs для переключения разделов ВОР (если применимо)
  - [ ] 17.2 Карточка работы: OdooCard + код ВОР (`font-mono text-[--p500]`) + описание + объём/единица
  - [ ] 17.3 Поиск: input с иконкой 🔍, `sticky top-14` (под Header)
  - [ ] 17.4 Импорт: кнопка «Импорт Excel» → full-page или Sheet
  - [ ] 17.5 Таблица работ: OdooTable со sticky header
  - [ ] 17.6 Empty state: «Нет работ в ВОР» + CTA

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
- **Статус**: Не начата
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
