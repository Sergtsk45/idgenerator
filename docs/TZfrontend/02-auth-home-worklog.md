# ТЗ: Tablet UI адаптация — Аутентификация, Главная, Журнал Работ

**Версия:** 1.0  
**Дата:** 2026-03-10  
**Релиз:** tablet-ui-phase-2  
**Автор:** AI Assistant  

---

## 1. Область Покрытия

### Включаемые экраны и маршруты
- `/login` — страница входа (email/пароль или Telegram MiniApp автологин)
- `/register` — страница регистрации (email/пароль)
- `/` — главная страница (Home, журнал работ в формате чата)
- `/worklog` — общий журнал работ (таблицы с историей)

### Scope адаптации
Адаптация существующей mobile-first архитектуры на экраны **планшетов**:
- **Ширина**: 768–1024px (iPad, Galaxy Tab)
- **Ориентация**: основная — portrait, поддержка landscape
- **Input методы**: сенсорный + клавиатура (быстрый переход)
- **Цель**: использование horizontal space, улучшение информационной плотности, сохранение mobile-first логики

---

## 2. Текущие Ограничения и Риски Адаптации

### Архитектурные ограничения
1. **max-w-md shell** — контейнер ограничен 448px в ширину
   - **Риск**: на планшете превратится в узкую полоску с огромными боковыми отступами
   - **Решение**: условная адаптация max-w на планшете до max-w-2xl (672px) или max-w-4xl (896px)

2. **Fixed bottom navigation** — BottomNav зафиксирована внизу
   - **Риск**: на планшете может заширокать 5–7 кнопок, потребуется переверстка
   - **Решение**: либо горизонтальная прокрутка табов, либо двухрядное расположение, либо side-by-side сайдбар

3. **Telegram MainButton fallback** — нативная кнопка Telegram
   - **Риск**: в браузере (вне Telegram) кнопка может быть скрыта или не иметь нативного поведения
   - **Решение**: явная CSS-кнопка как fallback в ползователя

4. **Voice recorder** — микрофон в Home
   - **Риск**: на tablet может быть жест-конфликт (долгое нажатие / свайп)
   - **Решение**: кнопка с явным feedback, Telegram HapticFeedback

### Ограничения по данным
1. **Исторические сообщения (Home)** — большой список сообщений может тормозить при рендере
   - **Решение**: virtualisation (react-window) для списка сообщений

2. **Таблицы WorkLog** — горизонтальная прокрутка на мобильных
   - **Риск**: на планшете строки могут быть очень длинными, нужна горизонтальная прокрутка или sticky-колонки
   - **Решение**: sticky первой колонки + horizontal scroll-area для остальных

3. **Dialog/Sheet на tablet** — может быть слишком широким
   - **Решение**: max-width диалога на планшете, может быть modal + side-panel режимы

### Ограничения Telegram WebApp API
- **Theme** — Telegram передаёт `themeParams` в зависимости от версии клиента
- **Не все жесты поддерживаются** в MiniApp (например, swipe может быть зарезервирован)
- **Вне Telegram** — требуется браузерная аутентификация, JWT токен

---

## 3. Целевой Tablet UX

### 3.1 Auth Screens (`/login`, `/register`)

**Desktop layout — 2 колонки или 1 широкая**

#### `/login` 
- **Left side (опционально)**: логотип, промо-текст, обещания платформы (на планшетах — изображение или слоган может появиться)
- **Right side (или full-width)**: форма входа
  - Email / Password поля (широкие, padding-friendly)
  - Кнопка "Войти" (full-width или 2/3 ширины)
  - Ссылка "Зарегистрироваться" (secondary text)
  - Разделитель "Или"
  - Кнопка "Войти через Telegram" (если не в Telegram)
  - При запросе в Telegram → автологин за экран загрузки

**Состояния**:
- **Loading**: индикатор загрузки, disabled inputs
- **Error**: toast внизу + красный border поля
- **Network error**: alert-banner + кнопка retry
- **Success**: редирект на `/` или на `?redirect=...`

**Tablet improvements**:
- Более широкие input-поля (min-width: 300px вместо 100%)
- Кнопки side-by-side, если есть несколько actions
- Шрифты увеличены на 1–2 размера
- Иконки крупнее (нажимаемые area >= 48px)

#### `/register`
- Похожая структура, но с 3 полями (Email, Password, Password Confirm)
- Terms of Service ссылка
- Кнопка "Зарегистрироваться"
- Переход на Login если уже есть аккаунт

---

### 3.2 Home (`/`) — Журнал Работ (Chat View)

**Mobile layout (текущий)**: fixed header + scrollable chat + fixed composer внизу

**Tablet layout (целевой)**:
- **Split view** (опционально): left-side список последних объектов/фильтры, right-side основной чат
  - Или: full-width чат с боковой панелью свойств/метаданных
  - Или: 3-column (если есть место): список объектов + чат + properties/actions

**Главные компоненты**:

#### Header
- Sticky заголовок: `[Кнопка меню] [ОБЪЕКТ: Название строительства] [Иконка микрофона]`
- На планшете: может иметь иконки дополнительных действий (если нужны)

#### Chat area (ScrollArea)
- Message bubbles: `[Аватар / иконка / цвет] [Текст / данные] [Время] [Статус: отправка/обработка]`
- Left bubbles (user): color = primary, фон светлый
- Right bubbles (AI response / normalized data): color = secondary, фон акцент
- На планшете: макет может быть расширен до 60–70% ширины экрана
- Virtualization: если > 100 сообщений → использовать react-window для render-optimization

#### Composer (Fixed Bottom)
- Sticky контейнер внизу (над BottomNav)
- Flex layout:
  - `[Mic button (large)] [Textarea (flexible)] [Send button]` (на мобилке)
  - На планшете: иконки увеличены, textarea может быть multi-line (3–4 lines)
- **Voice input**:
  - Долгое нажатие микрофона → запись
  - Feedback: red indicator "REC", время записи, cancel/confirm buttons
  - Telegram HapticFeedback на старте/стопе
- **Text input**:
  - Автофокус при клике на любую часть композера
  - Enter = send (desktop-friendly), Shift+Enter = newline
  - Кнопка Send активна только если текст не пуст или есть attachment
- **MainButton fallback**:
  - В браузере (вне Telegram): явная кнопка `Send` внутри UI
  - В Telegram MiniApp: если используется MainButton → синхронизировать с Telegram API

#### States & Animations
- **Empty state**: "Нет записей. Начните с нажатия микрофона или введите текст."
- **Loading**: Skeleton bubbles, индикатор "Обработка..." для последнего сообщения
- **Processing**: AI normalization indicator на сообщении (иконка загрузки, "Обработка…")
- **Error**: Toast "Не удалось отправить", retry button в чате
- **Network error**: Banner "Нет интернета" или "Сервер недоступен"; сообщение остаётся в composer до явного повтора отправки
- **Message animations**: fade-in + slide-up для новых сообщений

---

### 3.3 WorkLog (`/worklog`) — Таблица Работ

**Mobile layout (текущий)**: горизонтальная прокрутка табов, таблица с горизонтальным скроллом

**Tablet layout (целевой)**:
- **Tabs** (sticky на top, горизонтальная прокрутка если много):
  - "По датам", "По статусам", "По кодам работ" (примеры)
  - На планшете: может вместиться 4–5 табов без прокрутки
  - Scroll-area для табов с drag-to-scroll поддержкой

**Таблица**:
- Sticky header (первая строка зафиксирована)
- Sticky левая колонка (код работы / дата, основной идентификатор)
- Горизонтальная прокрутка для остальных данных
- На планшете ширина:
  - Sticky колонка: 120–150px
  - Остальные: 100–150px каждая
  - Итого: 600–900px (требует горизонтального скролла при экране < 900px)

**Функциональность**:
- Сортировка: клик на заголовок → sort ascending/descending (индикатор ↑/↓)
- Фильтры: 
  - Кнопка "Фильтры" → выезжает side-panel или modal
  - По дате (date-picker), по статусу (checkboxes), по коду (text search)
  - Apply / Reset кнопки
- Экспорт:
  - Кнопка "Экспорт" → выбор формата (CSV, Excel, PDF)
  - Прогресс-индикатор при экспорте

**Density (компактность)**:
- Радио-button "Компактный / Средний / Просторный" 
  - Compact: visual row-height 28px, font-size 12px, padding 4px; interactive controls inside row must still keep hit area >= 44px
  - Normal: visual row-height 40px, font-size 14px, padding 8px (default); row actions and clickable zones must keep hit area >= 44px
  - Spacious: row-height 56px, font-size 16px, padding 12px

**States**:
- **Empty**: "Нет записей, начните с главной (Home) или импортируйте данные (Works)"
- **Loading**: Skeleton rows (10–20 в зависимости от viewport)
- **Error**: Alert + retry button
- **Network degradation**: уже загруженные данные могут оставаться видимыми до refresh; новые запросы должны показывать понятный retry state

---

## 4. Функциональные Требования

### 4.1 Auth (`/login`, `/register`)

#### Обязательные
1. **Email/Password валидация**
   - Email: regex pattern, required
   - Password: min 8 символов, required
   - Confirm Password (на /register): должна совпадать с Password
   - Real-time validation feedback (зелёная/красная иконка рядом с полем)

2. **Telegram автологин**
   - Если приложение открыто в Telegram MiniApp с valId initData → автоматический вход
   - Показывается loading экран ("Вход…") без interaction
   - На ошибку → fallback на ручной ввод email или повторный вход через Telegram

3. **Rate limiting UI**
   - На 401 (неверные credentials) после 3 попыток: "Слишком много попыток. Повторите через 1 минуту"
   - Countdown timer

4. **Redirect после логина**
   - Default: `/` (Home)
   - Если в URL есть `?redirect=...` → перенаправить на указанный маршрут (безопасность: валидировать против whitelist маршрутов)

5. **Remember device** (опционально)
   - Checkbox "Запомнить этот браузер" → не требовать 2FA, если добавится

#### Требования для браузера (вне Telegram)
- Полная форма email/пароль
- Кнопка "Войти через Telegram" визуально **отключена** или с подсказкой "Доступна только в Telegram" (если не isInTelegram)

---

### 4.2 Home (`/`)

#### Обязательные
1. **Чат-интерфейс**
   - Получение списка сообщений: `GET /api/messages`
   - Создание сообщения: `POST /api/messages` (text + metadata)
   - Real-time polling (5 сек) или WebSocket (если в плане)

2. **Voice recorder**
   - Старт запись: долгое нажатие на mic button, или клик для toggle
   - Во время записи: red indicator "REC", elapsed time (00:15)
   - Стоп: отпущение кнопки или клик стоп-кнопки
   - Отмена: кнопка X во время записи → очистка audio buffer
   - Отправка на `/api/voice/transcribe` с FormData
   - Результат: транскрипция вставляется в textarea
   - Ошибки: "Микрофон не доступен" / "Файл слишком большой" (>10MB)

3. **Text composer**
   - Textarea с auto-resize (growing, max 4–5 lines)
   - Enter = Send, Shift+Enter = newline
   - Send button disabled если текст пуст
   - Кнопка Clear (X) внутри composer для быстрой очистки

4. **Message display**
   - User message (left, или right в зависимости от дизайна):
     - Текст, время (HH:MM)
     - Статус: отправка (часики), обработка (spinner), готово (checkmark)
   - AI response / normalized data (right):
     - Структурированные данные в виде pills/badges (работа: код, объём, дата, место)
     - Время получения ответа
     - Опция "Отредактировать" или "Удалить"

5. **Object context**
   - Current object отображается в subtitle (если есть)
   - Можно переключить в Header (ObjectSelector)
   - При смене объекта → инвалидировать кеш сообщений

#### Опциональные
- Реакции на сообщения (emoji)
- Пиннинг важных сообщений
- Поиск в чате
- Фильтры (по датам, по типам, по кодам работ)

---

### 4.3 WorkLog (`/worklog`)

#### Обязательные
1. **Получение данных**
   - `GET /api/messages` → фильтровать нормализованные (is_normalized=true)
   - Трансформировать в таблицу (или несколько таблиц по группам)

2. **Таблицы**
   - Columns: 
     - Дата (или период)
     - Код работы
     - Описание работы
     - Объём (quantity + unit)
     - Место / локация
     - Статус (нормализовано, на проверке, ошибка)
     - Действия (edit, delete, export)
   - Row grouping (опционально): по датам или по кодам

3. **Сортировка & фильтры**
   - Сортировка: клик на header → sort ASC/DESC, индикатор
   - Фильтр по дате (date-picker range)
   - Фильтр по статусу (checkboxes)
   - Фильтр по коду (text search)
   - Quick filters в toolbar

4. **Экспорт**
   - Кнопка "Экспорт как CSV / Excel / PDF"
   - CSV: comma-separated, UTF-8 BOM для Excel
   - Excel: используя xlsx.js, форматирование (bold headers, widths)
   - PDF: таблица в PDF через pdfmake, A4 или landscape для больших таблиц

5. **Компактность (Density)**
   - Выбор: Compact / Normal / Spacious
   - Persists в localStorage

6. **Действия**
   - Row action buttons: Edit (открыть modal для редактирования), Delete (confirm, затем удалить), View Details
   - Bulk actions: Select multiple rows (checkbox), Delete selected, Export selected

---

## 5. Нефункциональные Требования

### Performance
- **LCP (Largest Contentful Paint)**: < 2.5s на планшете (768px)
- **FID (First Input Delay)**: < 100ms при вводе текста, клике на кнопку
- **CLS (Cumulative Layout Shift)**: < 0.1 (никаких неожиданных сдвигов контента)
- **Message list virtualization**: для > 100 сообщений использовать react-window
- **Table rendering**: для > 1000 rows — виртуализация или пагинация

### Accessibility
- **WCAG 2.1 AA** (как минимум)
- Семантический HTML (form, button, nav, section)
- ARIA labels для иконок, buttons
- Keyboard navigation: Tab, Enter, Escape, Arrow keys
- Focus indicators visible (outline или специальный стиль)
- Color contrast >= 4.5:1 для текста
- Цвет не единственный способ передачи информации (используются иконки + текст)

### Responsiveness
- **Mobile (320–479px)**: 1-column layout, max-w-full
- **Tablet portrait (480–767px)**: 2-column где применимо, max-w-md или max-w-lg
- **Tablet landscape (768–1023px)**: 2–3 column, max-w-2xl или max-w-4xl
- **Desktop (1024px+)**: full layout с side-panels
- **Orientation change**: debounce 300ms для re-layout

### Темы
- **Light theme**: Telegram default / Tailwind light
- **Dark theme**: Telegram dark / Tailwind dark
- **Автоматическое определение**: по Telegram.WebApp.colorScheme или window.matchMedia('prefers-color-scheme')
- **CSS переменные**: все цвета через `--tg-theme-*` и fallback на Tailwind

### Internationalization (i18n)
- **Язык**: русский (по умолчанию), английский
- **Текстовые строки**: из `lib/i18n.ts`
- **Даты**: используя date-fns с локализацией
- **Форматы**: валюта (если есть), числа (тысячи, десятичные)

### Security
- **CSRF protection**: если используется cookies
- **XSS prevention**: санитизирование user input, используя DOMPurify если нужно
- **Sensitive data**: никаких токенов в console.log
- **Rate limiting**: уважать 429 responses, show "Too many requests" alert
- **CORS**: параметры правильно установлены на бэкенде

### Browser Support
- **Modern browsers** (2021+):
  - Chrome 90+
  - Safari 14+
  - Firefox 88+
- **Telegram WebApp**: все версии, которые поддерживают ES2020 и CSS Grid
- **Fallbacks**: для функций типа MediaRecorder, requestAnimationFrame

### Design System & Touch Targets
- Все визуальные значения для tablet UI берутся только из `docs/TZfrontend/design-system-12.03.2026-design-system/` и связанных CSS variables/tokens
- Запрещены hardcoded colors, spacing, radius, shadows, font sizes и размеры контролов, если для них есть design token
- Все интерактивные элементы (buttons, icon buttons, tabs, chips, toolbar actions, row actions, segmented controls, inputs с trigger-элементами) обязаны иметь hit area не меньше `44x44px`
- Если visual size элемента равен `40px` по design token, необходимо расширять hit area через padding, wrapper или прозрачную интерактивную область до `44px+`
- Для всех interactive states обязательны состояния `default`, `hover`, `active`, `focus-visible`, `disabled`; focus state должен быть видимым и не полагаться только на изменение цвета
- В Auth, Home и WorkLog запрещено разъезжание visual contract между Telegram и browser mode: tokens, типографика и states должны оставаться консистентными

---

## 6. Edge Cases, Error States, Loading States

### 6.1 Auth

**Empty states**:
- Если это первая регистрация → приветственное письмо на email (опционально)
- После успешного входа → редирект, но если `?redirect` неверный → на `/`

**Error states**:
- 401 Unauthorized: "Неверный email или пароль"
- 400 Bad Request: "Некорректные данные, проверьте формат"
- 429 Too Many Requests: "Слишком много попыток входа. Повторите через [N] минут"
- 500 Server Error: "Сервер недоступен, попробуйте позже"
- Network error (offline): "Нет интернета", кнопка Retry

**Loading states**:
- Кнопка disabled, текст "Вход…", spinner
- Inputs блокированы
- Если Telegram auth → full-screen loading overlay с логотипом + "Вход через Telegram…"

**Validation errors**:
- Real-time: каждое поле показывает статус (✓ / ✗)
- Summary: если > 1 ошибки → alert над формой с перечислением

---

### 6.2 Home

**Empty states**:
- Нет сообщений: "Начните с нажатия микрофона или введите текст выше"
- Объект не выбран: "Выберите объект в Header, чтобы начать"

**Loading states**:
- Skeleton loader: 5–7 фейк-сообщений (пульсирующие placeholders)
- При отправке сообщения: сообщение сразу появляется с spinner, статус "Отправка…"
- При обработке AI: spinner на сообщении, статус "Обработка…"

**Error states**:
- Сообщение не отправлено: сообщение остаётся в композере, toast "Не удалось отправить", кнопка Retry
- Трансскрипция не удалась: "Ошибка распознавания голоса. Попробуйте снова"
- Микрофон не доступен: "Микрофон не найден или отказано в доступе"
- Сервер 500: "Ошибка сервера при обработке сообщения"

**Network degradation states**:
- Banner "Нет интернета" или "Сервер недоступен"
- Несохранённый текст остаётся в composer до явной отправки пользователем
- После восстановления соединения пользователь получает явный Retry action; автоматическая локальная очередь отправки не предполагается этим ТЗ

**Voice error specifics**:
- Recording > 1 minute: "Максимальная длина записи — 1 минута", автостоп
- File > 10 MB: "Файл слишком большой" (обычно не случится при 1 мин)
- Browser API not available: "MediaRecorder не поддерживается. Используйте текстовый ввод"

---

### 6.3 WorkLog

**Empty states**:
- Таблица пуста: "Нет данных. Начните с Home и создавайте записи"
- После фильтра: "По вашим фильтрам нет данных. Измените критерии"

**Loading states**:
- Skeleton rows: 10–15 строк таблицы с пульсирующими плейсхолдерами
- При экспорте: progress bar (если > 5 сек) или toast "Экспорт в прогрессе…"

**Error states**:
- Таблица не загружена: "Ошибка загрузки данных" + кнопка Retry
- Экспорт не удался: "Не удалось создать файл. Попробуйте позже"
- Отредактировать запись не удалось: "Ошибка сохранения. Проверьте интернет"

**Network degradation states**:
- Banner "Нет интернета. Проверьте соединение и повторите запрос"
- Уже загруженные данные могут оставаться на экране до refresh, но автономный режим и отдельная очередь синхронизации не входят в scope
- Экспорт и редактирование при ошибке сети должны завершаться понятным error state с Retry

**Density changes**:
- При переключении Compact/Normal/Spacious → плавная re-layout (transition: height 300ms)

---

## 7. Acceptance Criteria

### Auth screens
- [ ] `/login` отображается без ошибок на 480px, 768px, 1024px
- [ ] Валидация email и пароля в реальном времени
- [ ] Telegram автологин работает в Telegram MiniApp (если initData valid)
- [ ] После успешного входа редирект на `/` (или на ?redirect URL)
- [ ] Ошибки 401, 429, 500 отображаются пользователю в toast или alert
- [ ] Rate limiting: после 3 неверных попыток → блокировка на 60 сек, таймер обратного отсчёта

### Home page
- [ ] Чат отображается, сообщения загружаются из API
- [ ] Голосовой ввод: запись, отправка на `/api/voice/transcribe`, вставка текста
- [ ] Text composer: Enter отправляет, Shift+Enter = newline
- [ ] На планшете (768px) — минимум 2 видимых сообщения без скролла (если экран позволяет)
- [ ] Message animations (fade-in) присутствуют и плавны
- [ ] Микрофон не доступен → graceful fallback на текстовый ввод с alert
- [ ] При сетевой ошибке Home показывает banner/error state, текст пользователя не теряется и повторная отправка выполняется только по явному Retry

### WorkLog page
- [ ] Таблица отображается с сортировкой и фильтрами
- [ ] Sticky header и sticky левая колонка
- [ ] На 768px горизонтальный скролл работает (можно увидеть все колонки)
- [ ] Density переключатель работает (compact/normal/spacious), сохраняется в localStorage
- [ ] Экспорт в CSV/Excel/PDF работает, файл скачивается
- [ ] Пустая таблица → "Нет данных" сообщение
- [ ] Loading skeleton показывается при загрузке

### General
- [ ] Все экраны соответствуют WCAG 2.1 AA (keyboard nav, contrast, labels)
- [ ] Светлая и тёмная тема работают (переключение через Telegram settings)
- [ ] Русский и английский языки отображаются корректно
- [ ] Все интерактивные элементы соответствуют правилу hit area `44x44px+`, даже если визуальный токен компонента меньше
- [ ] Все цвета, spacing, radius, typography и states взяты из Design System без hardcoded значений
- [ ] Нет console errors, warnings (исключая third-party)
- [ ] Performance: LCP < 2.5s, FID < 100ms на throttled 4G (Lighthouse)
- [ ] Responsive: 320px, 480px, 768px, 1024px viewports тестированы

---

## 8. Зависимости от API, Данных, Компонентов

### API endpoints (required)
- `POST /api/auth/login` — вход по email/пароль
- `POST /api/auth/login/telegram` — вход через Telegram initData
- `POST /api/auth/register` — регистрация по email/пароль
- `GET /api/auth/me` — информация о текущем пользователе
- `GET /api/messages` — список сообщений (с фильтрацией и пагинацией)
- `POST /api/messages` — создание нового сообщения (текст)
- `POST /api/voice/transcribe` — транскрипция аудио (формат: FormData с 'audio' field)
- `PATCH /api/messages/:id` — редактирование сообщения (опционально)
- `DELETE /api/messages/:id` — удаление сообщения (опционально)
- `GET /api/objects` — список объектов пользователя (для ObjectSelector)
- `POST /api/objects/:id/select` — установить текущий объект

### Shared компоненты UI (shadcn/ui)
- Button, Input, Textarea, Form
- Dialog, AlertDialog, Sheet
- Card, Badge, Tabs
- Skeleton, Loader, Toast
- ScrollArea
- Select, Popover, Dropdown Menu
- Table (для WorkLog)

### Custom компоненты
- **Header** (fixed top): logo, title, subtitle (object name), actions (menu, object selector)
- **BottomNav** (fixed bottom): navigation tabs (Works, Schedule, Acts, Home?, WorkLog)
- **MessageBubble**: render message with avatar, text, time, status, actions
- **VoiceRecorder** hook: startRecording, stopRecording, recordingDuration, isRecording, error
- **ObjectSelector** (Sheet): выбор активного объекта

### Libraries
- `react-query` / `@tanstack/react-query` — server state management
- `wouter` — маршрутизация
- `zustand` — локальное состояние (язык)
- `date-fns` — работа с датами
- `lucide-react` — иконки
- `framer-motion` — анимации
- `tailwindcss` — стилизация
- `radix-ui` — accessibility primitives (через shadcn/ui)
- `xlsx` — парсинг/генерация Excel (если для экспорта)
- `zod` — валидация на клиенте (опционально)
- `clsx` / `classnames` — условные классы CSS

### Hooks (custom)
- `useAuth()` — текущий пользователь, login, logout, isLoading, isAuthenticated
- `useMessages()` — список сообщений, loading, error
- `useCreateMessage()` — отправка сообщения
- `useVoiceRecorder()` — управление записью голоса
- `useTelegram()` — Telegram WebApp API, user info, theme, color scheme
- `useToast()` — показ уведомлений
- `useLanguageStore()` — язык интерфейса
- `useObjects()` — список объектов
- `useCurrentObject()` — текущий выбранный объект
- `use-mobile()` — media query для breakpoints

### Сохраняемые данные (localStorage)
- JWT токен (если браузерная аутентификация)
- Язык интерфейса
- Density setting (для WorkLog)
- Черновики сообщений (опционально, для recovery)

### Переменные окружения (frontend)
- `VITE_API_URL` — базовый URL API (default: '/')
- `VITE_TELEGRAM_BOT_TOKEN` — (опционально, для dev) токен для тестирования
- `VITE_APP_NAME` — название приложения в шапке

---

## 9. Implementation Notes

### Migration Strategy
1. **Phase 1**: Обновить max-width breakpoints в Tailwind конфиге (добавить md:max-w-2xl, lg:max-w-4xl)
2. **Phase 2**: Адаптировать layout компонентов (Header, BottomNav, Composer) на планшет
3. **Phase 3**: Оптимизировать Home (virtualization, performance)
4. **Phase 4**: Оптимизировать WorkLog (sticky columns, table rendering)
5. **Phase 5**: Тестирование на реальных планшетах (iPad, Galaxy Tab) и Lighthouse audit

### Testing Checklist
- [ ] Responsive testing: Chrome DevTools device emulation (iPad, Galaxy Tab)
- [ ] Keyboard testing: Tab, Enter, Escape, Arrow keys
- [ ] Screen reader: NVDA / JAWS / VoiceOver
- [ ] Zoom testing: 100%, 150%, 200%
- [ ] Orientation change: portrait ↔ landscape
- [ ] Touch testing: if available on real device
- [ ] Lighthouse audit (Performance, Accessibility)
- [ ] Cross-browser: Chrome, Safari, Firefox

### Known Limitations & Future Work
1. **Не планируется** реализовать:
   - Автономная очередь синхронизации и auto-resume отправки без явного действия пользователя
   - Advanced text formatting (markdown, rich text editor)
   - Message reactions и threading

2. **Рассмотреть в будущем**:
   - Группировка сообщений по датам
   - Search внутри чата
   - Voice message playback (сохранение аудио)
   - Mentions и @-notifications

---

## Примечания для разработчика

**Приоритет адаптации:**
1. **High**: Layout (max-width, spacing), Tablet specific breakpoints
2. **High**: Composer и Voice recorder UX на планшете
3. **Medium**: Table optimization (sticky columns, virtualization)
4. **Low**: Advanced animations, transitions

**Рекомендуемый порядок работы:**
1. Обновить Tailwind конфиг для tablet breakpoints
2. Адаптировать Header, BottomNav, основные контейнеры
3. Прототипировать Home на планшете (debug с Chrome DevTools)
4. Оптимизировать performance (lighthouse)
5. Проверить WorkLog таблицы
6. Финальное тестирование на реальных девайсах

