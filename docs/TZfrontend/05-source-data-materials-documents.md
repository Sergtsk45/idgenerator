# ТЗ-05: Экраны Source Data, Materials, Documents (Tablet UI)

**Дата:** 2026-03-10  
**Статус:** Draft  
**Версия:** 1.0  
**Аудитория:** Frontend, QA, Product Owner  

---

## 📋 Оглавление
1. [Обзор](#обзор)
2. [Текущие риски](#текущие-риски)
3. [Целевой UX](#целевой-ux)
4. [Функциональные требования](#функциональные-требования)
5. [Нефункциональные требования](#нефункциональные-требования)
6. [Edge Cases](#edge-cases)
7. [Acceptance Criteria](#acceptance-criteria)

---

## Обзор

### Scope
Документация requirements для tablet UI трёх связанных экранов:
- **Source Data** (`/source-data`) - реестр источников данных с карточками
- **Materials** (`/source/materials`) - справочник материалов с деталями  
- **Documents** (`/source/documents`) - управление документами и импортом счётов

### Архитектурные предположения
- Mobile-first card model, адаптированная для tablet (2-column master-detail)
- TanStack Query cache с оптимистичными обновлениями
- CRUD через модальные диалоги с validation
- PDF invoice import через drag-drop и file input
- Haptic feedback на карточках и действиях
- Global current object в контексте приложения
- Drawer patterns для деталей на narrow layouts

---

## Текущие риски

| Риск | Вероятность | Влияние | Митигация |
|------|-------------|--------|-----------|
| **Производительность при большом объёме данных** | Высокая | Высокое | Virtualization списков (React Window), pagination, lazyLoad |
| **Конфликты concurrency при batch edit** | Средняя | Высокое | Optimistic updates + rollback, conflict resolution UI |
| **Отсутствие сети при import PDF** | Средняя | Среднее | Queue файлов, retry logic, offline indicator |
| **Несогласованность кэша при смене объекта** | Высокая | Высокое | Query key strategy, cache invalidation по scopeId |
| **Haptic не поддерживается на tablet** | Низкая | Низкое | Graceful degradation, fallback animation feedback |
| **Tablet breakpoint - неопределённый layout** | Средняя | Среднее | Strict 768px-1024px breakpoint, media queries, testing |

---

## Целевой UX

### Общие принципы
- **Card-centric:** Основная единица - карточка с inline preview
- **Master-Detail на tablet:** Слева реестр (300px+), справа детали (1:1 ratio)
- **Touch-friendly:** Min tap target 44x44px, haptic feedback, large affordances
- **Progressive disclosure:** Drawer для доп. опций, modal для редактирования
- **Offline-first UX:** Clear sync state, queue indicators, conflict notifications

### Source Data Screen
```
┌─────────────────────────────────────────────┐
│ 📍 Source Data [Search] [+ Add] [⚙️]       │  Header
├─────────────────┬──────────────────────────┤
│ List (300px)    │ Master-Detail (flex)     │
│                 │                          │
│ [Search filter] │ ┌──────────────────────┐ │
│ ├─ Card 1       │ │ Название: Склад №5   │ │
│   [badge]       │ │ Адрес:ул. Пушкина.. │ │
│   Tap → detail  │ │ Активный: ✓           │ │
│   Swipe ← edit  │ │                       │ │
│ ├─ Card 2       │ │ [Edit] [Delete] [..] │ │
│ └─ Card 3       │ │                       │ │
│ [Load more]     │ └──────────────────────┘ │
└─────────────────┴──────────────────────────┘
```

### Materials Screen
```
┌─────────────────────────────────────────────┐
│ 📦 Materials [🔍 Search] [+ Add] [Filter] │  Header
├──────────────────┬─────────────────────────┤
│ List:            │ Master-Detail:         │
│ ├─ Category 1    │ Material: Кирпич М100  │
│   [Product 1]    │ SKU: BR-M100-001       │
│   [Product 2]    │ ┌─────────────────────┐│
│ ├─ Category 2    │ │ Tabs: Info | Price  ││
│   [Product 3]    │ │ ┌─────────────────┐ ││
│                  │ │ │ Цена: 125 руб   │ ││
│ 🔄 Sync...       │ │ │ Ед-ца: шт        │ ││
│ [Pin to top]     │ │ └─────────────────┘ ││
│                  │ │ [Edit] [Share] [..] ││
│ (vertical scroll) │ └─────────────────────┘│
└──────────────────┴─────────────────────────┘
```

### Documents Screen
```
┌──────────────────────────────────────────┐
│ 📄 Documents [+ Upload] [Filter] [View] │  Header
├─────────────┬──────────────────────────┤
│ Types:      │ Detail / Import Area    │
│ ├─ Invoices │ ┌────────────────────┐  │
│   (45)      │ │ [Drag-drop PDF]    │  │
│ ├─ Quotes   │ │ или                │  │
│   (12)      │ │ [Выбрать файл]     │  │
│ ├─ Checks   │ │                    │  │
│   (3)       │ │ Обработано: 12/15  │  │
│             │ │ Ошибки: 2          │  │
│ [Details]   │ └────────────────────┘  │
│ [Sync Log]  │                         │
└─────────────┴──────────────────────────┘
```

---

## Функциональные требования

### 1. Source Data Screen (`/source-data`)

#### 1.1 Реестр источников данных
- **Card Layout:**
  - Обязательные поля: ID, Название, Статус (Active/Inactive)
  - Опциональные: Адрес, Контакт, Last sync timestamp
  - Badge для статуса (зелёный/серый)
  - Thumbnail/icon если доступен

- **Card Actions (Touch):**
  - Tap → открыть drawer с деталями
  - Long-press → context menu (Edit, Delete, Copy, Open in browser)
  - Swipe-left → reveal quick actions (Edit, Delete)
  - Swipe-right → pin to top

- **Interactions:**
  - Search в реальном времени (debounce 300ms)
  - Filtering: Active/Inactive toggle
  - Sorting: By name, by status, by last sync
  - Load more / pagination при >50 items
  - Virtual scroll при >100 items

#### 1.2 Master-Detail Panel (Tablet only)
- При клике на карточку → показать детали справа
- Retain scroll position при navigation
- Показать breadcrumb: "Source Data > [Selected]"
- Если экран уже узкий (<768px) → использовать drawer вместо side panel

#### 1.3 CRUD Operations
- **Create:** Button [+Add] → Modal with form
  - Fields: Name (required), Address, Contact, Status
  - Validation: Name не пусто, format validation для контактов
  - Submit → optimistic update в cache, затем API call

- **Read:** Drawer/Panel с полной информацией
  - Display all fields
  - Show related materials count
  - Show sync history (last 5 events)

- **Update:** Inline editing в drawer
  - [Edit] button → enable form fields
  - Auto-save при blur (debounce 1s) или [Save] button
  - Show loading state
  - Show error toast if failed

- **Delete:** 
  - Confirmation dialog
  - Soft delete (status = inactive) или hard delete по policy
  - Show affected materials warning if exists

#### 1.4 Синхронизация и сетевые ошибки
- Sync indicator: "🟢 In sync", "🟡 Syncing...", "🔴 Error - retry"
- Network error badge/state when request fails
- Preserve unsaved form state during transient network errors
- Auto-retry with exponential backoff

#### 1.5 Error & Empty States
- **Empty:** 
  - Illustration + "No sources yet"
  - Actionable: [Add first source]
  
- **Error on load:**
  - Illustration + error message
  - [Retry] button + [Report issue] link
  
- **No results for search:**
  - "No matches found"
  - Clear button

### 2. Materials Screen (`/source/materials`)

#### 2.1 Material List & Categories
- **Hierarchical structure:**
  - Collapsible categories (Building, Finishing, Tools, etc.)
  - Material cards within each category
  - Count badge per category

- **Material Card:**
  - SKU, Name, Unit, Current price
  - Thumbnail image if exists
  - Stock status badge (In stock / Low / Out)
  - Pin icon for favourites

#### 2.2 Detail Panel / Drawer
- **Tabs structure:**
  - **Info Tab:**
    - Full name, description, SKU
    - Category, unit of measure
    - Created date, last modified
    - Related source if bound
  
  - **Price Tab:**
    - Current price with currency
    - Price history (last 5 changes)
    - Effective date range
    - [Edit price] button → modal or inline
  
  - **Attachments Tab:**
    - Related documents/invoices
    - Upload new attachment
    - Delete option

#### 2.3 Material CRUD
- **Create:**
  - Form: Name (required), Description, Category, Unit, Price
  - Image upload
  - Form validation
  - Toast notification on success

- **Update:**
  - Edit any field
  - Auto-save after 1s inactivity
  - Show "Modified" indicator
  - Rollback on error

- **Delete:**
  - Soft delete (archive) by default
  - Warning: "This material will be archived"
  - Show in-use count

- **Batch Actions:**
  - Select multiple cards (checkbox)
  - Bulk edit category / status
  - Bulk delete with confirmation

#### 2.4 Search & Filter
- Search by name/SKU/description (full-text)
- Filter by category
- Filter by status (in stock / low / out)
- Sort by: name, price, created date
- Saved filters (up to 5)

#### 2.5 Inline Editing
- Double-tap card → inline edit mode
- Fields: Name, Description, Unit, Price
- Save/Cancel buttons appear below
- Validation feedback inline
- On save → optimistic update + API

### 3. Documents Screen (`/source/documents`)

#### 3.1 Document List & Organization
- **By type tabs:**
  - Invoices (счёта)
  - Quotes (коммерческие предложения)
  - Checks (акты проверки)
  - Other
  
- **Document Card:**
  - File icon / thumbnail
  - Name, date, size
  - Status badge (Processed / Pending / Error)
  - Source association if exists

#### 3.2 PDF Invoice Import
- **Import Area (Master-Detail right side):**
  - Drag-drop zone: "Drop PDF here"
  - Alternative: [Select file] button
  - Progress indicator: "Processing 3/5 files..."
  
- **Import Process:**
  - Upload file → show loading
  - Extract data (OCR if needed)
  - Show preview: Extracted fields in editable form
  - Bind to materials / source (optional)
  - [Confirm] → save to cache + API
  - [Cancel] → discard

- **Extracted Fields Display:**
  - Invoice #, Date, Total
  - Supplier info
  - Line items table with auto-bound materials
  - Manual correction UI for mismatches

#### 3.3 Document CRUD
- **Upload:**
  - Single or multiple files
  - Drag-drop or file picker
  - Progress bar per file
  - Toast notification

- **View:**
  - Drawer with document metadata
  - Show preview if possible
  - Show extracted data
  - Show bindings (materials / source)

- **Update bindings:**
  - Link to source data
  - Link to materials
  - Add notes / tags
  - Auto-save

- **Delete:**
  - Archive (default) or permanent delete
  - Confirmation dialog
  - Show if referenced by other records

#### 3.4 Error Handling for Import
- **File validation errors:**
  - Not a PDF → "Invalid file format"
  - Too large → "File exceeds 10MB limit"
  - Corrupted → "Cannot read file"
  
- **Processing errors:**
  - OCR failed → Show manual entry form
  - Binding failed → Show warning + manual override
  - Timeout → Allow retry

- **UI feedback:**
  - Error toast with details
  - Retry button
  - Manual correction mode

#### 3.5 Batch Management
- Select multiple documents
- Bulk actions: 
  - Tag/categorize
  - Bind to source
  - Archive
  - Delete
- Progress indicator for batch operations

#### 3.6 Сетевые сбои и восстановление
- При ошибке сети не терять пользовательский контекст экрана и введённые данные формы
- Показывать понятное сообщение об ошибке и кнопку `Повторить`
- После восстановления сети разрешать повторную отправку из UI без перезагрузки страницы
- Для долгих операций импорта показывать промежуточный статус и итог ошибки

---

## Нефункциональные требования

### Performance
- **Load time:** Source list load <2s, materials <1.5s
- **Search response:** <300ms (debounce 300ms)
- **Scroll smoothness:** 60 FPS on mid-range tablets
- **Memory:** Cache max 100MB (TanStack Query config)
- **Bundle size:** +15% max for new features

### Accessibility
- **WCAG 2.1 AA compliance**
- Screen reader support for all cards
- Keyboard navigation (Tab, Enter, Escape)
- Color contrast ratio 4.5:1 minimum
- Focus indicators visible (outline 2px)
- Labels for all form fields
- ARIA labels for icons

### Responsiveness (Tablet breakpoints)
```
Mobile:        < 600px  (single column, full drawer)
Tablet:        600px - 1024px  (master-detail, 2-col)
Desktop:       > 1024px  (3-col with sidebar)
```

Tablet layout specifics:
- Master width: 300-350px (28% of screen)
- Detail width: 1fr (remaining space)
- Minimum detail width: 400px (else revert to drawer)
- Header stays fixed, content scrolls

### Network & Caching
- **Cache strategy:**
  - TanStack Query staleTime: 5 minutes
  - cacheTime: 30 minutes
  - Auto-invalidate on mutation
  
- **Data sync:**
  - Повторный запрос по действию пользователя или после успешной мутации
  - Корректная инвалидация object-scoped query после изменений
  - Show last sync timestamp

### Security
- **Data:** 
  - HTTPS only
  - Не дублировать чувствительные данные в новых browser-хранилищах без отдельного решения
  - Validate file types before upload (mime type + magic bytes)
  
- **API:**
  - Auth token in Authorization header
  - CSRF protection if applicable
  - Rate limiting aware (show user-friendly error)

### Haptic & Feedback
- Tap feedback: Light haptic (10ms)
- Long-press: Medium haptic (50ms)
- Delete action: Strong haptic (100ms)
- Fallback: Visual feedback + sound (if user enabled)

### Device Support
- **Tablets:**
  - iPad (all sizes, 6+)
  - Android tablets (7" and 10")
  - Web on tablet browsers
  
- **Browsers:**
  - Chrome 90+
  - Safari 14+
  - Firefox 88+
  - Samsung Internet 14+

---

## Edge Cases

### Data Consistency
1. **Concurrent edits:** User A edits material, User B edits same material simultaneously
   - Solution: Optimistic update + server wins on conflict, show merge dialog
   
2. **Delete + Create same SKU:** Material deleted, immediately recreated with same SKU
   - Solution: Cache invalidation, show confirmation if conflict detected
   
3. **Network goes down mid-upload:** PDF import paused
   - Solution: Queue persisted, auto-resume on reconnect

### File Upload
4. **Large file (>100MB):** PDF too big to process
   - Solution: Chunked upload, progress indicator, graceful failure
   
5. **Corrupted PDF:** File claims to be PDF but is not
   - Solution: Validate MIME type + magic bytes, show error
   
6. **Password-protected PDF:** Cannot extract data
   - Solution: Show error, allow manual entry or skip

### Search & Filter
7. **Thousand+ materials in one category:** Virtual scroll needed
   - Solution: React Window integration, lazy load on scroll
   
8. **Search with special characters:** "Material (type) #1"
   - Solution: Escape special chars in search query, use exact match option

### Sync & Offline
9. **Сеть пропала во время редактирования или импорта:** показать ошибку, сохранить введённые поля в форме до повторной попытки
   - Solution: Query key invalidation + fresh fetch after going online
   
10. **Document upload queued but quota exceeded:** Upload fails when coming online
    - Solution: Show quota error, offer cleanup options

### UI Edge Cases
11. **Very long material name:** Overflow in card
    - Solution: Truncate with ellipsis, full text in tooltip/drawer
    
12. **No images for materials:** Placeholder needed
    - Solution: Generic icon placeholder, light gray background
    
13. **Tablet in landscape 2:1:** Layout breaks
    - Solution: Adjust master width to 25%, detail width to 75%

### Form Validation
14. **User submits empty name:** Validation error
    - Solution: Red border + error message below field, prevent submit
    
15. **Price field gets negative value:** Invalid
    - Solution: Input type="number" min="0" + validation message

---

## Acceptance Criteria

### Source Data Screen

**AC 1: Реестр отображается с карточками**
- [ ] На load экрана видны карточки с Названием, Статусом, Адресом
- [ ] Карточки отображаются в вертикальном списке
- [ ] Минимум 3 карточки видны без скролла на tablet
- [ ] Поле Search работает (debounce 300ms)
- [ ] Активные фильтры показываются как badges

**AC 2: Master-Detail работает на tablet**
- [ ] Клик на карточку → открывается детали справа (min width 400px)
- [ ] Детали показывают все поля источника
- [ ] При смене карточки → детали обновляются
- [ ] Scroll в списке не ломает detail panel
- [ ] На экранах <600px детали открываются в drawer

**AC 3: CRUD операции**
- [ ] [+Add] открывает модальный диалог с формой
- [ ] Валидация работает: Name обязательно, show error inline
- [ ] На submit → показывается loading, затем успешный toast
- [ ] [Edit] включает edit mode, auto-save после 1s inactivity
- [ ] [Delete] показывает confirmation, затем удаляет
- [ ] Optimistic update: UI обновляется до ответа API

**AC 4: Sync & Offline**
- [ ] Sync indicator показывает статус ("🟢 In sync" / "🟡 Syncing..." / "🔴 Error")
- [ ] При сетевой ошибке пользователь видит понятное сообщение и может повторить действие
- [ ] Локально введённые данные формы не теряются до закрытия экрана/диалога
- [ ] При reconnect → auto-retry с exponential backoff
- [ ] Sync лог доступен в drawer

**AC 5: Error States**
- [ ] Empty state с иллюстрацией и [Add first source]
- [ ] Load error с [Retry] и [Report issue]
- [ ] No search results с clear button
- [ ] Toast с error details если API fails

### Materials Screen

**AC 6: Иерархический список с категориями**
- [ ] Категории отображаются как collapsed headers
- [ ] Клик на категорию → expand/collapse
- [ ] Материалы показываются внутри категорий
- [ ] Count badge показывает кол-во материалов
- [ ] Virtual scroll работает при >100 материалов

**AC 7: Material Cards**
- [ ] Карточка показывает: SKU, Name, Unit, Price, Status badge
- [ ] Thumbnail показывается если есть изображение
- [ ] Pin icon работает (toggle favourite)
- [ ] Card actions доступны (tap, long-press, swipe)

**AC 8: Detail Panel с табами**
- [ ] Tabs: Info, Price, Attachments переключаются корректно
- [ ] Info tab показывает полную информацию
- [ ] Price tab показывает текущую цену и историю
- [ ] Attachments tab позволяет upload/delete

**AC 9: Material CRUD**
- [ ] [+Add] открывает форму с fields: Name, Description, Category, Unit, Price
- [ ] Валидация: Name required, Price число >0
- [ ] Create → optimistic update → toast success
- [ ] Inline edit: double-tap → enable fields → auto-save
- [ ] Batch edit: select multiple → bulk actions

**AC 10: Search & Filter**
- [ ] Search работает по Name, SKU, Description (full-text)
- [ ] Filter by Category (dropdown)
- [ ] Filter by Status (In stock / Low / Out)
- [ ] Sort: by Name, Price, Created date
- [ ] Сохранённые фильтры (до 5)

### Documents Screen

**AC 11: Document List & Type Tabs**
- [ ] Tabs: Invoices, Quotes, Checks, Other
- [ ] Документы группируются по типам
- [ ] Count badges показывают кол-во
- [ ] Документ card показывает: icon, name, date, size, status

**AC 12: PDF Invoice Import (Drag-drop)**
- [ ] Drag-drop zone видна в detail area
- [ ] Drag PDF → файл загружается
- [ ] [Select file] button работает
- [ ] Progress: "Processing 3/5 files..."
- [ ] Preview с extracted fields показывается

**AC 13: Import Data Extraction**
- [ ] После upload → extracted fields отображаются в форме
- [ ] Fields: Invoice #, Date, Total, Supplier, Line items
- [ ] Поля редактируемые (manual correction)
- [ ] Materials auto-bind если найдены matches
- [ ] [Confirm] → save, [Cancel] → discard

**AC 14: Document CRUD**
- [ ] Upload: single/multiple files, progress per file
- [ ] View: drawer с metadata + preview
- [ ] Update bindings: link to source/materials
- [ ] Delete: archive (default) или permanent с confirmation

**AC 15: Error Handling**
- [ ] Invalid format → "Invalid file format. Please upload PDF."
- [ ] File too large → "File exceeds 10MB limit"
- [ ] Corrupted file → "Cannot read file. Please check format."
- [ ] Processing error → "OCR failed. Manual entry required." [OK]
- [ ] Binding conflict → Warning с manual override option

**AC 16: Batch & Offline**
- [ ] Select multiple documents (checkboxes)
- [ ] Bulk tag/categorize/bind/archive
- [ ] Ошибки сети при импорте и сохранении обрабатываются без потери контекста и с возможностью повторной отправки
- [ ] Progress indicator для batch operations

### Cross-Screen

**AC 17: Responsive Layout**
- [ ] На tablet (600-1024px): master-detail (28% / 72%)
- [ ] На mobile (<600px): drawer для деталей
- [ ] На desktop (>1024px): 3-column с sidebar
- [ ] Media queries протестированы для всех breakpoints
- [ ] Horizontal scroll не появляется (no overflow-x)

**AC 18: Accessibility**
- [ ] WCAG 2.1 AA compliance по всем требованиям
- [ ] Screen reader: все elements labeled
- [ ] Keyboard nav: Tab/Enter/Escape работают
- [ ] Color contrast: 4.5:1 minimum
- [ ] Focus indicators видны (outline 2px)

**AC 19: Performance**
- [ ] Source list load: <2s
- [ ] Materials load: <1.5s
- [ ] Search response: <300ms
- [ ] Scroll FPS: ≥60 на mid-range tablet
- [ ] Memory usage: <100MB for all caches

**AC 20: Sync & Cache**
- [ ] TanStack Query configured: staleTime 5min, cacheTime 30min
- [ ] Retry and refetch logic defined for network errors
- [ ] User can safely repeat failed mutation without losing form context
- [ ] Last sync timestamp shown
- [ ] Conflict resolution UI если needed

---

## Контрольный чек-лист для разработки

- [ ] Component структура спланирована (SourceCard, MaterialCard, DocumentCard)
- [ ] API contracts определены для всех endpoints
- [ ] TanStack Query hooks созданы для всех queries/mutations
- [ ] Validation schemas написаны (Zod / Yup)
- [ ] Error boundary component added
- [ ] Сетевые ошибки обрабатываются без потери введённых данных
- [ ] Haptic feedback обёрнуто в try-catch
- [ ] Tablet breakpoint media queries добавлены
- [ ] Virtual scroll интегрирован для больших списков
- [ ] Accessibility тестирование запланировано (axe-core)
- [ ] Performance профилирование done (Lighthouse)
- [ ] Unit тесты для critical logic (CRUD, validation)
- [ ] E2E тесты для user flows (Playwright / Cypress)
- [ ] Visual regression tests setup (Percy / Chromatic, optional)

---

## Ссылки на связанные документы
- [04-navigation-flow.md](./04-navigation-flow.md) - навигация между экранами
- [07-qa-rollout.md](./07-qa-rollout.md) - QA стратегия и тестирование
- API Contracts (in project repo)
- Component library specs
