# Описание фронтенда и UI

## Архитектура фронтенда

### Технологический стек
- **React 18.3** + **TypeScript** — основной фреймворк
- **Vite** — сборщик и dev-сервер
- **Wouter** — легковесная маршрутизация
- **TanStack Query (React Query)** — управление серверным состоянием
- **Zustand** — локальное состояние (язык интерфейса)
- **Tailwind CSS** — стилизация
- **shadcn/ui** — UI компоненты (на базе Radix UI)
- **Framer Motion** — анимации
- **date-fns** — работа с датами

### Структура проекта

```
client/
├── index.html          # Точка входа HTML
├── src/
│   ├── main.tsx       # React entry point
│   ├── App.tsx        # Корневой компонент с роутингом
│   ├── index.css      # Глобальные стили + CSS переменные
│   ├── pages/         # Страницы приложения
│   │   ├── Home.tsx   # Журнал работ (чат-интерфейс)
│   │   ├── Works.tsx  # Ведомость объемов работ (ВОР)
│   │   ├── WorkLog.tsx # Общий журнал работ (таблицы)
│   │   ├── Schedule.tsx # График работ (диаграмма Ганта)
│   │   ├── Acts.tsx   # Акты АОСР
│   │   ├── SourceData.tsx # Исходные данные (анкета по объекту)
│   │   └── Settings.tsx # Настройки (язык)
│   ├── components/    # Переиспользуемые компоненты
│   │   ├── Header.tsx
│   │   ├── BottomNav.tsx
│   │   ├── MessageBubble.tsx
│   │   └── ui/        # shadcn/ui компоненты (40+ компонентов)
│   ├── hooks/         # React Query хуки для API
│   │   ├── use-messages.ts
│   │   ├── use-works.ts
│   │   └── use-acts.ts
│   └── lib/           # Утилиты
│       ├── queryClient.ts  # Настройка React Query
│       ├── i18n.ts         # Интернационализация
│       └── utils.ts        # cn() для классов
```

## UI-система

### Дизайн-система
- **Mobile-first** — ориентировано на Telegram MiniApp
- **Цветовая палитра**: синие/сланцевые тона (строительная тематика)
- **CSS-переменные** для тем (light/dark)
- **Шрифты**: Inter (основной), Outfit (заголовки), JetBrains Mono (моноширинный)

### Компоненты shadcn/ui
Используется библиотека **shadcn/ui** (New York style):
- Button, Input, Textarea, Select
- Dialog, Popover, Accordion
- Card, Badge, Tabs
- Calendar, ScrollArea
- Toast, Tooltip
- И другие (40+ компонентов)

**Особенности:**
- На базе **Radix UI** (доступность)
- Настраиваемые через Tailwind
- TypeScript-first

## Маршрутизация

```typescript
/          → Home (журнал работ)
/works     → Works (ВОР/ВОИР)
/worklog   → WorkLog (общий журнал)
/schedule  → Schedule (график работ)
/acts      → Acts (акты АОСР)
/source-data → SourceData (исходные данные по объекту)
/settings  → Settings (настройки)
```

## Управление состоянием

### 1. Серверное состояние — TanStack Query:
- `useMessages()` — список сообщений
- `useWorks()` — список работ
- `useActs()` — список актов
- Автоматическая инвалидация кэша
- Polling для обновлений (5 сек для сообщений)

### 2. Локальное состояние — React useState + Zustand:
- Язык интерфейса (Zustand с persist)
- Формы (локальный useState)
- UI-состояние (диалоги, табы)

## Интернационализация

- **Двуязычность**: русский (по умолчанию) и английский
- Хранение переводов в `lib/i18n.ts`
- Переключение через Zustand store
- Сохранение выбора в localStorage

## UI-паттерны

### 1. Mobile-first layout:
- Фиксированная нижняя навигация (`BottomNav`, mobile-only `md:hidden`)
- Фиксированный заголовок (`Header`)
- Контент с отступами под навигацию (`pb-24`)

### 1.1 Foundation contract для tablet UI (Sprint 1)
- Breakpoint contract зафиксирован в `tailwind.config.ts`: `sm=640`, `md=768`, `lg=1024`, `xl=1280`, `2xl=1536`
- В `client/index.html` используется `viewport-fit=cover` для корректной работы safe-area на iOS/iPadOS
- В `client/src/index.css` заведены foundation-токены shell: `--shell-header-height`, `--shell-bottom-nav-height`, `--shell-content-padding-x/y`, `--shell-content-max-width`, `--shell-font-scale`
- Там же определены safe-area utilities `pt-safe`, `pb-safe`, `pl-safe`, `pr-safe`
- `TelegramThemeProvider` синхронизирует `--tg-viewport-height`, `--tg-viewport-stable-height`, `--tg-viewport-width` с Telegram WebApp и очищает их в browser fallback
- В `client/src/lib/navigation.ts` вынесен единый navigation contract: `primary`, `secondary`, `quickAction`, surface visibility intent и matching rules для active-state
- Active-state `source-data` покрывает связанные nested routes: `/source/materials`, `/source/materials/:id`, `/source/documents`

### 1.2 Shell Adapters (Sprint 1, Subphase 2)
- **`ResponsiveShell` компонент** (`client/src/components/ResponsiveShell.tsx`):
  - Page-level presentational shell adapter, не владеет auth/router/state
  - Читает единый navigation manifest и рендерит surfaces в зависимости от breakpoint
  - **Mobile** (`< md`): скрыт (ничего не рендерит)
  - **Tablet** (`md..lg`): горизонтальная top-nav с primary-кнопками
  - **Desktop** (`>= lg`): top-nav (primary) + левая sidebar (secondary + quick-action)
- **`Header` (обновлён)**:
  - Hamburger + Sheet теперь только для mobile (`md:hidden`)
  - На `md+` hamburger скрыт, primary navigation даёт `ResponsiveShell` top-nav
  - Secondary/quick-action на tablet/desktop даёт `ResponsiveShell` sidebar
- **`BottomNav` (мобильный)**:
  - Остаётся мобильным (явно `md:hidden`)
  - Рендерит primary-кнопки в нижней позиции для узких экранов

### 2. Анимации (Framer Motion):
- Появление карточек
- Плавные переходы
- Индикаторы загрузки

### 3. Стилизация:
- Glassmorphism эффекты (`.glass`, `.glass-card`)
- Кастомные утилиты (`.mobile-safe-bottom`, `.bg-grain`)
- Скрытие скроллбаров (`.scrollbar-hide`)

## Особенности реализации

### 1. Home (журнал работ):
- Чат-интерфейс с пузырьками сообщений
- Автоскролл к новым сообщениям
- Индикация обработки AI
- Фиксированная форма ввода внизу

### 2. Works (ВОР):
- Импорт Excel на клиенте (XLSX.js)
- Поиск в реальном времени
- Табличное отображение с фиксированными заголовками

### 3. WorkLog (журнал):
- Табы для разных разделов
- Горизонтальная прокрутка табов
- Таблицы с данными из сообщений
- Индикация необработанных записей

### 4. Acts (акты):
- Генерация актов с выбором шаблонов
- Accordion для группировки шаблонов
- Календарь для выбора периода
- Экспорт PDF

## Интеграция с бэкендом

- API через `shared/routes.ts` (типизированные контракты)
- Fetch с `credentials: "include"` (сессии)
- Обработка ошибок через toast-уведомления
- Автоматическая инвалидация кэша после мутаций

## Стилизация и темы

- CSS-переменные для цветов
- Поддержка dark mode (через класс `.dark`)
- Кастомные утилиты Tailwind
- Адаптивные отступы для safe-area (iOS)
- Responsive foundation-слой строится additive-подходом: mobile стили остаются базой, tablet/layout enhancements добавляются поверх них через `min-width` breakpoints

## Итог

Современный React-стек с mobile-first подходом, типобезопасностью и готовыми UI-компонентами, ориентированный на Telegram MiniApp.
